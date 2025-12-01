package school.karaoke.litlite

import android.os.Bundle
import android.util.Base64
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import school.karaoke.litlite.databinding.ActivityMainBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var litLite: LitLite
    private lateinit var passkeyManager: PasskeyManager

    // Store current session
    private var currentPkpInfo: LitLite.PKPInfo? = null
    private var currentAuthData: LitLite.AuthData? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize
        litLite = LitLite(LitNetwork.NAGA_DEV)
        passkeyManager = PasskeyManager(this)

        setupClickListeners()
        log("Initialized with Naga Dev network")
        log("Auth service: ${LitNetwork.NAGA_DEV.authServiceUrl}")
    }

    private fun setupClickListeners() {
        binding.btnRegisterPasskey.setOnClickListener {
            registerNewPasskey()
        }

        binding.btnAuthenticatePasskey.setOnClickListener {
            authenticateWithPasskey()
        }

        binding.btnTestSign.setOnClickListener {
            testPkpSigning()
        }
    }

    /**
     * Register a new passkey and mint a PKP
     */
    private fun registerNewPasskey() {
        lifecycleScope.launch {
            try {
                log("Starting passkey registration...")

                // Step 1: Get registration options from Lit auth service
                log("Fetching registration options from Lit...")
                val options = withContext(Dispatchers.IO) {
                    litLite.getRegistrationOptions(username = "KSchool-Android-Test")
                }

                log("Got options:")
                log("  RP ID: ${options.rp.id}")
                log("  RP Name: ${options.rp.name}")
                log("  Challenge: ${options.challenge.take(20)}...")

                // Step 2: Create passkey using Android Credential Manager
                log("Creating passkey (check your device)...")
                val registrationResult = passkeyManager.register(
                    context = this@MainActivity,
                    options = options
                )

                log("Passkey created!")
                log("  Credential ID: ${registrationResult.attestation.id.take(20)}...")

                // Step 3: Mint PKP with the attestation
                log("Minting PKP (this may take 30-60 seconds)...")
                val pkpInfo = withContext(Dispatchers.IO) {
                    litLite.mintPKP(
                        attestation = registrationResult.attestation,
                        publicKeyHex = registrationResult.publicKeyHex
                    )
                }

                // Store for later use
                currentPkpInfo = pkpInfo
                currentAuthData = LitLite.AuthData(
                    authMethodType = LitLite.AUTH_METHOD_TYPE_WEBAUTHN,
                    authMethodId = litLite.computeAuthMethodId(registrationResult.attestation.rawId),
                    accessToken = "" // Will be set during authentication
                )

                // Update UI
                updatePkpDisplay(pkpInfo, currentAuthData!!)
                binding.btnTestSign.isEnabled = true

                log("SUCCESS! PKP minted:")
                log("  Address: ${pkpInfo.ethAddress}")
                log("  Token ID: ${pkpInfo.tokenId}")

                Toast.makeText(this@MainActivity, "PKP Created!", Toast.LENGTH_SHORT).show()

            } catch (e: Exception) {
                log("ERROR: ${e.message}")
                e.printStackTrace()
                Toast.makeText(
                    this@MainActivity,
                    "Registration failed: ${e.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    /**
     * Authenticate with an existing passkey
     * This tests if passkeys created on web sync to Android
     */
    private fun authenticateWithPasskey() {
        lifecycleScope.launch {
            try {
                log("Starting passkey authentication...")

                // Step 1: Get latest blockhash for challenge
                log("Fetching blockhash for challenge...")
                val blockhash = withContext(Dispatchers.IO) {
                    litLite.getLatestBlockhash()
                }
                log("Got blockhash: ${blockhash.take(20)}...")

                // Convert blockhash to base64url challenge
                val blockhashBytes = blockhash.removePrefix("0x").chunked(2)
                    .map { it.toInt(16).toByte() }.toByteArray()
                val challenge = Base64.encodeToString(
                    blockhashBytes,
                    Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP
                )

                // Step 2: Authenticate with passkey
                log("Authenticating with passkey (check your device)...")
                val authResult = passkeyManager.authenticate(
                    context = this@MainActivity,
                    challenge = challenge,
                    rpId = "lit" // Must match web RP ID
                )

                log("Passkey authenticated!")
                log("  Auth Method ID: ${authResult.authMethodId.take(20)}...")

                // Step 3: Look up PKPs for this credential
                // TODO: Implement PKP lookup via contract call or auth service
                log("TODO: Look up PKPs for this auth method ID")

                // For now, store the auth data
                currentAuthData = LitLite.AuthData(
                    authMethodType = LitLite.AUTH_METHOD_TYPE_WEBAUTHN,
                    authMethodId = authResult.authMethodId,
                    accessToken = "" // Would come from Lit in full implementation
                )

                updateAuthDisplay(currentAuthData!!)

                Toast.makeText(
                    this@MainActivity,
                    "Authenticated! Check logs for auth method ID",
                    Toast.LENGTH_SHORT
                ).show()

            } catch (e: Exception) {
                log("ERROR: ${e.message}")
                e.printStackTrace()

                // Check for specific error types
                val errorMessage = when {
                    e.message?.contains("No credentials available") == true ->
                        "No passkeys found. Create one on web first or register a new one."
                    e.message?.contains("User cancelled") == true ->
                        "Authentication cancelled"
                    else ->
                        "Authentication failed: ${e.message}"
                }

                Toast.makeText(this@MainActivity, errorMessage, Toast.LENGTH_LONG).show()
            }
        }
    }

    /**
     * Test PKP signing (placeholder - needs session sig implementation)
     */
    private fun testPkpSigning() {
        log("PKP signing test - NOT YET IMPLEMENTED")
        log("Need to implement:")
        log("  1. Session signature creation")
        log("  2. executeJs call to Lit nodes")
        Toast.makeText(this, "Signing not yet implemented", Toast.LENGTH_SHORT).show()
    }

    // =========================================================================
    // UI Helpers
    // =========================================================================

    private fun updatePkpDisplay(pkpInfo: LitLite.PKPInfo, authData: LitLite.AuthData) {
        binding.tvPkpAddress.text = pkpInfo.ethAddress
        binding.tvAuthMethodId.text = authData.authMethodId.take(42) + "..."
        binding.tvTokenId.text = pkpInfo.tokenId
    }

    private fun updateAuthDisplay(authData: LitLite.AuthData) {
        binding.tvPkpAddress.text = "Looking up PKP..."
        binding.tvAuthMethodId.text = authData.authMethodId.take(42) + "..."
        binding.tvTokenId.text = "-"
    }

    private fun log(message: String) {
        val timestamp = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
        val logLine = "[$timestamp] $message\n"

        runOnUiThread {
            binding.tvLogs.append(logLine)
        }

        // Also log to Logcat
        android.util.Log.d("LitLite", message)
    }
}
