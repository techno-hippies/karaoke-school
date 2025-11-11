import { TurboFactory, ArweaveSigner } from "@ardrive/turbo-sdk";
import Arweave from "arweave";
import fs from "fs";

// Sample immutable karaoke metadata (NON-COPYRIGHTED FICTIONAL DATA)
const sampleMetadata = {
  spotify_track_id: "demo-track-karaoke-test-001",
  track_title: "Test Song Demo",
  artist: "Sample Demo Artist", 
  lyrics: {
    original: {
      lines: [
        { index: 0, text: "Sample lyric line one for testing", startTime: 0.0, endTime: 2.8 },
        { index: 1, text: "Demo words for word alignment test", startTime: 2.8, endTime: 5.2 },
        { index: 2, text: "Non copyrighted sample text here", startTime: 5.2, endTime: 7.5 }
      ]
    },
    translations: {
      es: [
        { index: 0, text: "Línea de letra de muestra uno para prueba", startTime: 0.0, endTime: 2.8 },
        { index: 1, text: "Palabras de demostración para prueba de alineación", startTime: 2.8, endTime: 5.2 },
        { index: 2, text: "Texto de muestra sin derechos de autor aquí", startTime: 5.2, endTime: 7.5 }
      ],
      fr: [
        { index: 0, text: "Ligne de paroles d'échantillon un pour test", startTime: 0.0, endTime: 2.8 },
        { index: 1, text: "Mots de démonstration pour test d'alignement", startTime: 2.8, endTime: 5.2 },
        { index: 2, text: "Texte d'échantillon non protégé par le droit d'auteur ici", startTime: 5.2, endTime: 7.5 }
      ]
    }
  },
  alignments: {
    segment_id: "demo-segment-test-001",
    segment_hash: "0x1234567890abcdef",
    duration: 7.5,
    word_timing: [
      { word: "Sample", startTime: 0.0, endTime: 0.3 },
      { word: "lyric", startTime: 0.3, endTime: 0.6 },
      { word: "line", startTime: 0.6, endTime: 1.0 },
      { word: "one", startTime: 1.0, endTime: 1.2 },
      { word: "for", startTime: 1.2, endTime: 1.4 },
      { word: "testing", startTime: 1.4, endTime: 1.8 }
    ]
  },
  created_at: new Date().toISOString(),
  immutable: true,
  test_mode: true,
  copyright_status: "non_copyrighted_sample_data",
  data_type: "test_metadata_for_turbo_integration"
};

async function uploadRealData() {
  console.log("🚀 Uploading NON-COPYRIGHTED TEST DATA to Arweave via Turbo!\n");
  console.log("📝 This uses fictional sample data - safe for testing and demonstration\n");
  
  try {
    // Create Arweave instance
    console.log("🔗 Initializing Arweave...");
    const arweave = new Arweave({
      host: "arweave.net",
      port: 443,
      protocol: "https",
    });
    
    // Generate real Arweave wallet
    console.log("🔑 Generating real Arweave wallet...");
    const jwk = await arweave.wallets.generate();
    console.log("✅ Real wallet generated successfully!");
    
    // Save the wallet
    fs.writeFileSync("./real-wallet.json", JSON.stringify(jwk, null, 2));
    console.log("💾 Wallet saved to: ./real-wallet.json");
    
    // Get wallet address
    const address = await arweave.wallets.jwkToAddress(jwk);
    console.log(`📍 Wallet address: ${address}\n`);
    
    // Initialize Turbo with real wallet
    console.log("🔧 Initializing Turbo with real authentication...");
    const signer = new ArweaveSigner(jwk);
    const turbo = TurboFactory.authenticated({ signer });
    console.log("✅ Turbo client authenticated!\n");
    
    // Get wallet balance
    console.log("💰 Checking wallet balance...");
    const { winc: balance } = await turbo.getBalance();
    console.log(`💳 Balance: ${balance} Winston Credits\n`);
    
    // Upload the real data
    console.log("📤 Uploading sample karaoke metadata to Arweave...");
    const result = await turbo.upload({
      data: JSON.stringify(sampleMetadata, null, 2),
      dataItemOpts: {
        tags: [
          { name: "Content-Type", value: "application/json" },
          { name: "App-Name", value: "KaraokeSchool-TurboTest" },
          { name: "Data-Type", value: "ImmutableMetadata" },
          { name: "Track-ID", value: sampleMetadata.spotify_track_id },
          { name: "Version", value: "1.0.0" },
          { name: "Content-Encoding", value: "UTF-8" }
        ],
      },
      events: {
        onProgress: ({ totalBytes, processedBytes, step }) => {
          const percent = ((processedBytes / totalBytes) * 100).toFixed(2);
          console.log(`   Progress (${step}): ${percent}% (${processedBytes}/${totalBytes} bytes)`);
        },
        onSuccess: () => {
          console.log("✅ Upload completed successfully!");
        },
        onError: ({ error, step }) => {
          console.error(`❌ Upload error (${step}):`, error);
        }
      }
    });
    
    console.log("\n🎉 SUCCESS! Real Arweave upload completed!\n");
    console.log("📋 Upload Results:");
    console.log(`   🔗 Transaction ID: ${result.id}`);
    console.log(`   👤 Owner: ${result.owner}`);
    console.log(`   🌐 Arweave URL: https://arweave.net/${result.id}`);
    console.log(`   📊 Data Size: ${JSON.stringify(sampleMetadata).length} bytes`);
    console.log(`   🎵 Track: ${sampleMetadata.track_title} by ${sampleMetadata.artist}`);
    console.log(`   🆔 Test Track ID: ${sampleMetadata.spotify_track_id}`);
    console.log(`   📝 Content Type: Non-copyrighted sample/test data`);
    
    // Final balance check
    const finalBalance = await turbo.getBalance();
    console.log(`\n💰 Final Balance: ${finalBalance.winc} Winston Credits`);
    
    console.log("\n🏆 REAL ARWEAVE TRANSACTION HASH:");
    console.log(`   ${result.id}`);
    console.log("\n🔗 Direct Link:");
    console.log(`   https://arweave.net/${result.id}`);
    
  } catch (error) {
    console.error("❌ Upload failed:", error);
    throw error;
  }
}

// Run the real upload
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadRealData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export { uploadRealData };
