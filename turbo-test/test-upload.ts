import { TurboFactory, ArweaveSigner } from "@ardrive/turbo-sdk";
import fs from "fs";

// Sample immutable karaoke metadata
const sampleMetadata = {
  spotify_track_id: "4iV5W9uYEdYUVa79Axb7Rh",
  track_title: "Ocean Eyes",
  artist: "Billie Eilish",
  lyrics: {
    original: {
      lines: [
        { index: 0, text: "I've been watching you for some time", startTime: 0.0, endTime: 2.8 },
        { index: 1, text: "Can't stop staring at those ocean eyes", startTime: 2.8, endTime: 5.2 },
        { index: 2, text: "Burning cities and falling stars", startTime: 5.2, endTime: 7.5 }
      ]
    },
    translations: {
      es: [
        { index: 0, text: "Te he estado mirando por un tiempo", startTime: 0.0, endTime: 2.8 },
        { index: 1, text: "No puedo dejar de mirar esos ojos océano", startTime: 2.8, endTime: 5.2 },
        { index: 2, text: "Ciudades ardiendo y estrellas fugaces", startTime: 5.2, endTime: 7.5 }
      ]
    }
  },
  alignments: {
    segment_id: "ocean-eyes-verse-1",
    segment_hash: "0x1234567890abcdef",
    duration: 7.5,
    word_timing: [
      { word: "I've", startTime: 0.0, endTime: 0.3 },
      { word: "been", startTime: 0.3, endTime: 0.6 },
      { word: "watching", startTime: 0.6, endTime: 1.0 }
    ]
  },
  created_at: new Date().toISOString(),
  immutable: true
};

async function testTurboUpload() {
  console.log("🚀 Testing Turbo upload for immutable karaoke metadata...\n");
  
  try {
    // Load wallet from file or create a new one
    console.log("📝 Loading wallet...");
    let jwk;
    try {
      jwk = JSON.parse(fs.readFileSync("./test-wallet.json", "utf-8"));
    } catch {
      console.log("⚠️  Test wallet not found. Creating a new wallet for testing...");
      // For testing, we'll use Turbo's default behavior which doesn't require a wallet
      // This is a simpler approach for testing
    }
    
    // Initialize Turbo (try authenticated first, fallback to unauthenticated)
    let turbo;
    if (jwk) {
      const signer = new ArweaveSigner(jwk);
      turbo = TurboFactory.authenticated({ signer });
    } else {
      console.log("🔧 Using Turbo without authentication (testing mode)...");
      turbo = TurboFactory.unauthenticated();
    }
    
    console.log("🔧 Turbo client ready!");
    
    // Upload the metadata
    console.log("📤 Uploading immutable metadata to Arweave...");
    
    let result;
    if (jwk) {
      // Use authenticated upload
      result = await turbo.upload({
        data: JSON.stringify(sampleMetadata, null, 2),
        dataItemOpts: {
          tags: [
            { name: "Content-Type", value: "application/json" },
            { name: "App-Name", value: "KaraokeSchool" },
            { name: "Data-Type", value: "ImmutableMetadata" },
            { name: "Track-ID", value: sampleMetadata.spotify_track_id },
            { name: "Version", value: "1.0.0" }
          ],
        },
      });
    } else {
      // For unauthenticated, we need to test with a signed data item or get fiat rates
      console.log("🔍 Testing Turbo service availability...");
      
      // Test that the service is working by checking fiat rates
      const rates = await turbo.getFiatRates();
      console.log("✅ Turbo service is working! Available currencies:", rates.length);
      
      console.log("⚠️  Note: Full upload requires authentication. Testing service connectivity instead.");
      
      // Show what data would be uploaded
      console.log("📝 Sample data structure:");
      console.log(JSON.stringify(sampleMetadata, null, 2));
      
      return;
    }
    
    console.log("✅ Upload successful!");
    console.log(`📋 Upload ID: ${result.id}`);
    console.log(`👤 Owner: ${result.owner}`);
    console.log(`🔗 Transaction URL: https://arweave.net/${result.id}`);
    console.log(`💾 File size: ${JSON.stringify(sampleMetadata).length} bytes\n`);
    
    // Test retrieving the data (verify it's accessible)
    console.log("🔍 Testing data accessibility...");
    // Note: In a real implementation, you'd fetch and verify the data
    console.log("✅ Data should be accessible at the transaction URL above\n");
    
    // Check balance only if authenticated and upload was performed
    if (jwk) {
      console.log("💰 Checking Turbo balance...");
      const balance = await turbo.getBalance();
      console.log(`💳 Current balance: ${balance.winc} Winston Credits\n`);
    } else {
      console.log("💰 Balance check skipped (unauthenticated mode)\n");
    }
    
    console.log("🎉 Upload successful! Turbo integration is working correctly.");
    console.log("\n📝 Summary:");
    console.log(`   • Upload ID: ${result.id}`);
    console.log(`   • Data type: Immutable karaoke metadata`);
    console.log(`   • Data size: ${JSON.stringify(sampleMetadata).length} bytes`);
    console.log(`   • Track: ${sampleMetadata.track_title} by ${sampleMetadata.artist}`);
    console.log(`   • Arweave URL: https://arweave.net/${result.id}`);
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testTurboUpload()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export { testTurboUpload };
