package school.karaoke.litlite

import android.content.Context
import android.util.Base64
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import com.google.gson.Gson
import org.json.JSONObject

/**
 * Manages Android Passkey (WebAuthn) operations using Credential Manager API
 *
 * Key points:
 * - Uses RP ID "lit" to match Lit Protocol's web implementation
 * - Credentials created on web with same RP ID should sync via Google Password Manager
 */
class PasskeyManager(context: Context) {

    private val credentialManager = CredentialManager.create(context)
    private val gson = Gson()

    /**
     * Result of passkey registration
     */
    data class RegistrationResult(
        val attestation: LitLite.WebAuthnAttestation,
        val publicKeyHex: String
    )

    /**
     * Result of passkey authentication
     */
    data class AuthenticationResult(
        val assertion: LitLite.WebAuthnAssertion,
        val authMethodId: String
    )

    /**
     * Register a new passkey using options from Lit auth service
     */
    suspend fun register(
        context: Context,
        options: LitLite.RegistrationOptions
    ): RegistrationResult {
        // Convert Lit options to Android Credential Manager JSON format
        val requestJson = buildRegistrationRequestJson(options)

        val request = CreatePublicKeyCredentialRequest(
            requestJson = requestJson,
            preferImmediatelyAvailableCredentials = false
        )

        val response = credentialManager.createCredential(
            context = context,
            request = request
        ) as CreatePublicKeyCredentialResponse

        // Parse the response
        val responseJson = JSONObject(response.registrationResponseJson)

        val attestation = parseAttestationResponse(responseJson)
        val publicKeyHex = extractPublicKeyFromAttestation(responseJson)

        return RegistrationResult(
            attestation = attestation,
            publicKeyHex = publicKeyHex
        )
    }

    /**
     * Authenticate with an existing passkey
     */
    suspend fun authenticate(
        context: Context,
        challenge: String,
        rpId: String = "lit"
    ): AuthenticationResult {
        // Build authentication request JSON
        val requestJson = buildAuthenticationRequestJson(challenge, rpId)

        val publicKeyCredentialOption = GetPublicKeyCredentialOption(
            requestJson = requestJson
        )

        val request = GetCredentialRequest(
            credentialOptions = listOf(publicKeyCredentialOption)
        )

        val response = credentialManager.getCredential(
            context = context,
            request = request
        )

        val credential = response.credential as PublicKeyCredential
        val responseJson = JSONObject(credential.authenticationResponseJson)

        val assertion = parseAssertionResponse(responseJson)

        // Compute auth method ID same way as web SDK
        val authMethodId = computeAuthMethodId(assertion.rawId)

        return AuthenticationResult(
            assertion = assertion,
            authMethodId = authMethodId
        )
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private fun buildRegistrationRequestJson(options: LitLite.RegistrationOptions): String {
        return JSONObject().apply {
            put("challenge", options.challenge)
            put("rp", JSONObject().apply {
                put("name", options.rp.name)
                put("id", options.rp.id)
            })
            put("user", JSONObject().apply {
                put("id", options.user.id)
                put("name", options.user.name)
                put("displayName", options.user.displayName)
            })
            put("pubKeyCredParams", org.json.JSONArray().apply {
                options.pubKeyCredParams.forEach { param ->
                    put(JSONObject().apply {
                        put("type", param.type)
                        put("alg", param.alg)
                    })
                }
            })
            put("timeout", options.timeout)
            put("attestation", options.attestation)
            options.authenticatorSelection?.let { sel ->
                put("authenticatorSelection", JSONObject().apply {
                    sel.authenticatorAttachment?.let { put("authenticatorAttachment", it) }
                    sel.residentKey?.let { put("residentKey", it) }
                    sel.requireResidentKey?.let { put("requireResidentKey", it) }
                    sel.userVerification?.let { put("userVerification", it) }
                })
            }
        }.toString()
    }

    private fun buildAuthenticationRequestJson(challenge: String, rpId: String): String {
        return JSONObject().apply {
            put("challenge", challenge)
            put("timeout", 60000)
            put("userVerification", "required")
            put("rpId", rpId)
        }.toString()
    }

    private fun parseAttestationResponse(json: JSONObject): LitLite.WebAuthnAttestation {
        val response = json.getJSONObject("response")

        return LitLite.WebAuthnAttestation(
            rawId = json.getString("rawId"),
            id = json.getString("id"),
            type = json.getString("type"),
            response = LitLite.AttestationResponse(
                clientDataJSON = response.getString("clientDataJSON"),
                attestationObject = response.getString("attestationObject"),
                transports = response.optJSONArray("transports")?.let { arr ->
                    (0 until arr.length()).map { arr.getString(it) }
                }
            ),
            authenticatorAttachment = json.optString("authenticatorAttachment", null)
        )
    }

    private fun parseAssertionResponse(json: JSONObject): LitLite.WebAuthnAssertion {
        val response = json.getJSONObject("response")

        return LitLite.WebAuthnAssertion(
            rawId = json.getString("rawId"),
            id = json.getString("id"),
            type = json.getString("type"),
            response = LitLite.AssertionResponse(
                clientDataJSON = response.getString("clientDataJSON"),
                authenticatorData = response.getString("authenticatorData"),
                signature = response.getString("signature"),
                userHandle = response.optString("userHandle", null)
            ),
            authenticatorAttachment = json.optString("authenticatorAttachment", null)
        )
    }

    /**
     * Extract COSE public key from attestation and convert to hex
     * This matches how the web SDK extracts the key
     */
    private fun extractPublicKeyFromAttestation(json: JSONObject): String {
        val response = json.getJSONObject("response")
        val attestationObject = response.getString("attestationObject")

        // Decode base64 attestation object
        val attestationBytes = Base64.decode(attestationObject, Base64.URL_SAFE or Base64.NO_PADDING)

        // Parse CBOR to extract authData -> attestedCredentialData -> credentialPublicKey
        // This is simplified - in production you'd use a proper CBOR parser
        val publicKey = extractCredentialPublicKey(attestationBytes)

        return "0x" + publicKey.toHex()
    }

    /**
     * Extract credential public key from attestation object bytes
     * Attestation object is CBOR encoded with structure:
     * {
     *   fmt: string,
     *   attStmt: {},
     *   authData: bytes
     * }
     * authData contains: rpIdHash (32) + flags (1) + signCount (4) + attestedCredentialData
     * attestedCredentialData: aaguid (16) + credIdLen (2) + credId (credIdLen) + credentialPublicKey (COSE)
     */
    private fun extractCredentialPublicKey(attestationBytes: ByteArray): ByteArray {
        // Find authData in CBOR structure
        // This is a simplified parser - looks for the authData bytes after "authData" key

        // For now, we'll use a heuristic approach:
        // The authData starts after the CBOR map structure
        // A proper implementation would use a CBOR library

        // Skip CBOR map header and find authData
        // In practice, authData starts around byte 37+ depending on fmt length

        // Find the rpIdHash (SHA-256 of RP ID "lit" = 32 bytes starting at authData offset)
        // Then: flags (1 byte) + signCount (4 bytes) + aaguid (16 bytes) + credIdLen (2 bytes) + credId + publicKey

        // This needs proper CBOR parsing - for now return a placeholder
        // TODO: Implement proper CBOR parsing or use a library

        return attestationBytes.takeLast(77).toByteArray() // Approximate COSE key location
    }

    private fun computeAuthMethodId(credentialId: String, rpName: String = "lit"): String {
        val input = "$credentialId:$rpName"
        val hash = org.web3j.crypto.Hash.sha3(input.toByteArray())
        return "0x" + hash.toHex()
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
}
