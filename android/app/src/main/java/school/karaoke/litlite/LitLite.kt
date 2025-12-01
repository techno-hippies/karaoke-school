package school.karaoke.litlite

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.web3j.crypto.Hash
import java.util.concurrent.TimeUnit

/**
 * Lit Protocol "Lite" Client for Android
 *
 * Implements the minimal subset of Lit Protocol needed for:
 * 1. PKP minting via auth service
 * 2. PKP lookup by auth data
 * 3. Session signature creation (TODO)
 * 4. executeJs for signing (TODO)
 */
class LitLite(
    private val network: LitNetwork = LitNetwork.NAGA_DEV
) {
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMediaType = "application/json".toMediaType()

    // =========================================================================
    // Data Classes
    // =========================================================================

    data class PKPInfo(
        val publicKey: String,
        val ethAddress: String,
        val tokenId: String
    )

    data class AuthData(
        val authMethodType: Int,
        val authMethodId: String,
        val accessToken: String
    )

    data class WebAuthnAttestation(
        val rawId: String,
        val id: String,
        val type: String,
        val response: AttestationResponse,
        val authenticatorAttachment: String? = null,
        val clientExtensionResults: Map<String, Any> = emptyMap()
    )

    data class AttestationResponse(
        val clientDataJSON: String,
        val attestationObject: String,
        val transports: List<String>? = null
    )

    data class WebAuthnAssertion(
        val rawId: String,
        val id: String,
        val type: String,
        val response: AssertionResponse,
        val authenticatorAttachment: String? = null,
        val clientExtensionResults: Map<String, Any> = emptyMap()
    )

    data class AssertionResponse(
        val clientDataJSON: String,
        val authenticatorData: String,
        val signature: String,
        val userHandle: String?
    )

    // Auth service request/response types
    private data class MintRequest(
        val authMethodType: Int,
        val authMethodId: String,
        val pubkey: String,
        val scopes: List<String>
    )

    private data class MintJobResponse(
        val jobId: String,
        val message: String
    )

    private data class JobStatusResponse(
        val state: String,
        val returnValue: ReturnValue?
    )

    private data class ReturnValue(
        val hash: String?,
        val data: PKPData?
    )

    private data class PKPData(
        val pubkey: String,
        val ethAddress: String,
        val tokenId: String
    )

    data class RegistrationOptions(
        val challenge: String,
        val rp: RelyingParty,
        val user: UserEntity,
        val pubKeyCredParams: List<PubKeyCredParam>,
        val timeout: Long,
        val attestation: String,
        val authenticatorSelection: AuthenticatorSelection?
    )

    data class RelyingParty(
        val name: String,
        val id: String
    )

    data class UserEntity(
        val id: String,
        val name: String,
        val displayName: String
    )

    data class PubKeyCredParam(
        val type: String,
        val alg: Int
    )

    data class AuthenticatorSelection(
        val authenticatorAttachment: String?,
        val residentKey: String?,
        val requireResidentKey: Boolean?,
        val userVerification: String?
    )

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Get WebAuthn registration options from Lit auth service
     */
    suspend fun getRegistrationOptions(username: String? = null): RegistrationOptions {
        return withContext(Dispatchers.IO) {
            val url = buildString {
                append("${network.authServiceUrl}/auth/webauthn/generate-registration-options")
                if (!username.isNullOrBlank()) {
                    append("?username=${java.net.URLEncoder.encode(username, "UTF-8")}")
                }
            }

            val request = Request.Builder()
                .url(url)
                .get()
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty response")

            if (!response.isSuccessful) {
                throw Exception("Failed to get registration options: ${response.code} - $body")
            }

            gson.fromJson(body, RegistrationOptions::class.java)
        }
    }

    /**
     * Mint a new PKP using WebAuthn attestation
     */
    suspend fun mintPKP(
        attestation: WebAuthnAttestation,
        publicKeyHex: String,
        scopes: List<String> = listOf("sign-anything")
    ): PKPInfo {
        return withContext(Dispatchers.IO) {
            // Compute auth method ID
            val authMethodId = computeAuthMethodId(attestation.rawId)

            // Prepare mint request
            val mintRequest = MintRequest(
                authMethodType = AUTH_METHOD_TYPE_WEBAUTHN,
                authMethodId = authMethodId,
                pubkey = publicKeyHex,
                scopes = scopes
            )

            // Submit mint job
            val mintUrl = "${network.authServiceUrl}/pkp/mint"
            val request = Request.Builder()
                .url(mintUrl)
                .post(gson.toJson(mintRequest).toRequestBody(jsonMediaType))
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty response")

            if (response.code != 202) {
                throw Exception("Failed to initiate PKP mint: ${response.code} - $body")
            }

            val jobResponse = gson.fromJson(body, MintJobResponse::class.java)

            // Poll for completion
            val pkpData = pollJobStatus(jobResponse.jobId)

            PKPInfo(
                publicKey = pkpData.pubkey,
                ethAddress = pkpData.ethAddress,
                tokenId = pkpData.tokenId
            )
        }
    }

    /**
     * Compute auth method ID from WebAuthn credential ID
     * Uses keccak256(credentialId + ":lit")
     */
    fun computeAuthMethodId(credentialId: String, rpName: String = "lit"): String {
        val input = "$credentialId:$rpName"
        val hash = Hash.sha3(input.toByteArray())
        return "0x" + hash.toHex()
    }

    /**
     * Get the latest blockhash from Lit network (for WebAuthn challenge)
     */
    suspend fun getLatestBlockhash(): String {
        return withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(network.rpcUrl)
                .post("""{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}"""
                    .toRequestBody(jsonMediaType))
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty response")

            // Parse JSON to get block hash
            val jsonResponse = gson.fromJson(body, Map::class.java)
            val result = jsonResponse["result"] as? Map<*, *>
            result?.get("hash") as? String ?: throw Exception("No block hash in response")
        }
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private suspend fun pollJobStatus(jobId: String, maxRetries: Int = 20): PKPData {
        val statusUrl = "${network.authServiceUrl}/status/$jobId"

        for (attempt in 0 until maxRetries) {
            delay(2000) // Wait 2 seconds between polls

            val request = Request.Builder()
                .url(statusUrl)
                .get()
                .build()

            val response = httpClient.newCall(request).execute()
            val body = response.body?.string()

            if (body == null || !response.isSuccessful) {
                continue
            }

            val status = gson.fromJson(body, JobStatusResponse::class.java)

            when (status.state) {
                "completed" -> {
                    val data = status.returnValue?.data
                        ?: throw Exception("Job completed but no PKP data returned")
                    return data
                }
                "failed", "error" -> {
                    throw Exception("PKP minting failed: ${status.state}")
                }
            }
        }

        throw Exception("PKP minting timed out after $maxRetries attempts")
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }

    companion object {
        const val AUTH_METHOD_TYPE_WEBAUTHN = 3
    }
}

/**
 * Lit Protocol network configuration
 */
enum class LitNetwork(
    val authServiceUrl: String,
    val rpcUrl: String,
    val chainId: Int
) {
    NAGA_DEV(
        authServiceUrl = "https://naga-dev-auth-service.getlit.dev",
        rpcUrl = "https://yellowstone-rpc.litprotocol.com/",
        chainId = 175188 // Chronicle Yellowstone
    ),
    NAGA_STAGING(
        authServiceUrl = "https://naga-staging-auth-service.getlit.dev",
        rpcUrl = "https://yellowstone-rpc.litprotocol.com/",
        chainId = 175188
    )
}
