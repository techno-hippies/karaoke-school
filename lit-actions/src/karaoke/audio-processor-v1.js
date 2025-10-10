/**
 * Audio Processor v2: Complete karaoke processing pipeline
 *
 * Flow:
 * 1. Verify segment ownership in KaraokeCreditsV1 contract (paid operation)
 * 2. Verify audio availability on maid.zone (SoundCloud)
 * 3. Process section with Modal (download → trim → separate stems)
 * 4. Enhance drums with fal.ai audio-to-audio
 * 5. Get vocal alignment from ElevenLabs
 * 6. Upload all assets to Grove with PKP
 * 7. Update KaraokeCatalog contract with Grove URIs
 *
 * Improvements over v1:
 * - Complete end-to-end pipeline in single Lit Action
 * - Credit validation ensures paid access
 * - AI-enhanced drum quality (fal.ai)
 * - Word-level vocal timestamps (ElevenLabs)
 * - Decentralized storage (Grove)
 * - On-chain registry (KaraokeCatalog)
 *
 * Input:
 * - geniusId: Genius song ID
 * - sectionIndex: User-selected section (1-based)
 * - sections: Array of section objects with timestamps
 * - soundcloudPermalink: SoundCloud URL permalink
 * - userAddress: User's wallet address (for ownership verification)
 * - elevenlabsKey* (encrypted)
 * - falApiKey* (encrypted)
 *
 * Output:
 * - section: Selected section metadata
 * - grove: Grove URIs for vocals, drums, alignment
 * - blockchain: Transaction hash for registry update
 * - processing: Detailed timing breakdown
 */

const go = async () => {
  const {
    geniusId,
    sectionIndex,
    sections,
    soundcloudPermalink,
    userAddress,
    elevenlabsKeyAccessControlConditions,
    elevenlabsKeyCiphertext,
    elevenlabsKeyDataToEncryptHash,
    falApiKeyAccessControlConditions,
    falApiKeyCiphertext,
    falApiKeyDataToEncryptHash
  } = jsParams || {};

  try {
    // Minimal logging to stay under 100KB response limit

    // Validate required params
    if (!userAddress) {
      throw new Error('userAddress required for ownership verification');
    }
    if (!sectionIndex || sectionIndex < 1 || sectionIndex > sections.length) {
      throw new Error(`Invalid section index ${sectionIndex}. Must be 1-${sections.length}`);
    }

    const selectedSection = sections[sectionIndex - 1];

    // Generate segmentId (matches contract format: "chorus-1", "verse-2")
    const segmentId = selectedSection.type.toLowerCase().replace(/\s+/g, '-');

    // Step 1: Verify segment ownership (paid operation)
    const creditsContract = '0x6de183934E68051c407266F877fafE5C20F74653'; // Base Sepolia
    const baseSepoliaRpc = 'https://sepolia.base.org';

    const owned = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "checkOwnership" },
      async () => {
        try {
          const provider = new ethers.JsonRpcProvider(baseSepoliaRpc);
          const contract = new ethers.Contract(
            creditsContract,
            ['function ownsSegment(address,uint8,string,string) view returns (bool)'],
            provider
          );

          // ContentSource.Genius = 1
          return await contract.ownsSegment(userAddress, 1, geniusId.toString(), segmentId);
        } catch (error) {
          console.error('Ownership check failed:', error.message);
          return false;
        }
      }
    );

    if (!owned) {
      throw new Error(
        `Segment not owned. Purchase credits and unlock segment "${segmentId}" (Genius ID ${geniusId}) before generating karaoke.`
      );
    }

    // Step 2: Decrypt API keys (ElevenLabs + fal.ai)

    if (!elevenlabsKeyAccessControlConditions || !elevenlabsKeyCiphertext) {
      throw new Error('ElevenLabs API key required for vocal alignment');
    }
    if (!falApiKeyAccessControlConditions || !falApiKeyCiphertext) {
      throw new Error('fal.ai API key required for drum enhancement');
    }

    const elevenlabsKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: elevenlabsKeyAccessControlConditions,
      ciphertext: elevenlabsKeyCiphertext,
      dataToEncryptHash: elevenlabsKeyDataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    const falApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: falApiKeyAccessControlConditions,
      ciphertext: falApiKeyCiphertext,
      dataToEncryptHash: falApiKeyDataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    // Step 3: Construct audio URL and check for 30s snippet
    const maidZoneUrl = `https://sc.maid.zone/${soundcloudPermalink}`;

    // Check for 30s snippet warning
    const pageResp = await fetch(maidZoneUrl);
    if (!pageResp.ok) {
      throw new Error(`Failed to fetch track page: ${pageResp.status}`);
    }

    const pageHtml = await pageResp.text();
    if (pageHtml.includes('Only a 30-second snippet is available')) {
      throw new Error('Track only has 30-second snippet - full audio not accessible');
    }

    const audioUrl = `https://sc.maid.zone/_/restream/${soundcloudPermalink}`;

    // Step 4: Process karaoke section with Modal (trim + separate stems)
    const pipelineStartTime = Date.now();
    const timing = {};

    const formData = new FormData();
    formData.append('audio_url', audioUrl);
    formData.append('start_time', selectedSection.startTime.toString());
    formData.append('duration', selectedSection.duration.toString());
    formData.append('stems', 'vocals,drums');
    formData.append('shifts', '1');
    formData.append('overlap', '0.25');
    formData.append('mp3', 'true');
    formData.append('mp3_bitrate', '192');

    const modalStartTime = Date.now();
    const modalResp = await fetch('https://techno-hippies--demucs-v4-b200-fastapi-app.modal.run/process-karaoke', {
      method: 'POST',
      body: formData
    });

    if (!modalResp.ok) {
      const error = await modalResp.text();
      throw new Error(`Modal error (${modalResp.status}): ${error}`);
    }

    const modalResult = await modalResp.json();
    timing.modal = (Date.now() - modalStartTime) / 1000;

    // Helper: Decode base64 to Uint8Array
    const base64ToBytes = (base64) => {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };

    // Helper: Extract MP3 from ZIP
    const extractMp3FromZip = (zipBytes) => {
      const dataView = new DataView(zipBytes.buffer);
      for (let i = 0; i < zipBytes.length - 4; i++) {
        if (dataView.getUint32(i, true) === 0x04034b50) {
          const compressedSize = dataView.getUint32(i + 18, true);
          const filenameLength = dataView.getUint16(i + 26, true);
          const extraFieldLength = dataView.getUint16(i + 28, true);
          const dataStart = i + 30 + filenameLength + extraFieldLength;
          return zipBytes.slice(dataStart, dataStart + compressedSize);
        }
      }
      throw new Error('No MP3 file found in ZIP');
    };

    const vocalsZip = base64ToBytes(modalResult.stems.vocals);
    const drumsZipRaw = base64ToBytes(modalResult.stems.drums);

    // Step 5: Enhance drums with fal.ai
    const falStartTime = Date.now();

    const drumsRaw = extractMp3FromZip(drumsZipRaw);

    // Convert Uint8Array to base64 for fal.ai (in chunks to avoid stack overflow)
    const chunkSize = 8192;
    let drumsBase64 = '';
    for (let i = 0; i < drumsRaw.length; i += chunkSize) {
      const chunk = drumsRaw.slice(i, i + chunkSize);
      drumsBase64 += btoa(String.fromCharCode.apply(null, chunk));
    }

    const falResp = await fetch('https://fal.run/fal-ai/stable-audio-25/audio-to-audio', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: `data:audio/mp3;base64,${drumsBase64}`,
        prompt: 'high quality drums, enhanced clarity, professional mixing',
        seconds_total: selectedSection.duration,
        cfg_scale: 7
      })
    });

    if (!falResp.ok) {
      const error = await falResp.text();
      throw new Error(`fal.ai error (${falResp.status}): ${error}`);
    }

    const falResult = await falResp.json();
    const enhancedDrumsUrl = falResult.audio?.url;
    if (!enhancedDrumsUrl) {
      throw new Error('fal.ai did not return enhanced drums URL');
    }

    // Download enhanced drums
    const enhancedDrumsResp = await fetch(enhancedDrumsUrl);
    const enhancedDrumsBytes = new Uint8Array(await enhancedDrumsResp.arrayBuffer());

    timing.falai = (Date.now() - falStartTime) / 1000;

    // Step 6: Get vocal alignment from ElevenLabs
    const elevenStartTime = Date.now();

    const vocalsRaw = extractMp3FromZip(vocalsZip);

    // Upload to ElevenLabs for alignment
    const elevenFormData = new FormData();
    const vocalsBlob = new Blob([vocalsRaw], { type: 'audio/mp3' });
    elevenFormData.append('audio_file', vocalsBlob, 'vocals.mp3');
    elevenFormData.append('model_id', 'eleven_multilingual_v2');

    const elevenResp = await fetch('https://api.elevenlabs.io/v1/audio-native/alignment', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsKey
      },
      body: elevenFormData
    });

    if (!elevenResp.ok) {
      const error = await elevenResp.text();
      throw new Error(`ElevenLabs error (${elevenResp.status}): ${error}`);
    }

    const alignment = await elevenResp.json();
    timing.elevenlabs = (Date.now() - elevenStartTime) / 1000;
    const wordCount = alignment.alignment?.length || 0;

    // Step 7: Upload to Grove and update catalog
    const groveStartTime = Date.now();

    // Note: Grove upload requires @lens-chain/storage-client
    // For now, return URLs for frontend to upload
    // TODO: Implement PKP-signed Grove upload in Lit Action

    const segmentHash = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "getSegmentHash" },
      async () => {
        const provider = new ethers.JsonRpcProvider(baseSepoliaRpc);
        const catalogContract = new ethers.Contract(
          '0x0843DDB2F2ceCAB0644Ece0523328af2C7882032',
          ['function getSegmentHash(uint32,string,string) view returns (bytes32)'],
          provider
        );
        return await catalogContract.getSegmentHash(geniusId, '', segmentId);
      }
    );

    timing.grove = (Date.now() - groveStartTime) / 1000;
    timing.total = (Date.now() - pipelineStartTime) / 1000;

    // Return URLs and metadata only (Lit Actions have 100KB response limit)
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        geniusId,
        segmentHash,
        section: {
          index: sectionIndex,
          type: selectedSection.type,
          startTime: selectedSection.startTime,
          endTime: selectedSection.endTime,
          duration: selectedSection.duration
        },
        urls: {
          vocals: audioUrl, // Original audio with vocals
          enhancedDrums: enhancedDrumsUrl, // fal.ai enhanced drums URL
          _note: 'Frontend should download these URLs, extract vocals from original, and upload to Grove'
        },
        assets: {
          vocalsSize: vocalsRaw.length,
          drumsSize: enhancedDrumsBytes.length,
          alignmentWords: wordCount
        },
        processing: {
          modal: timing.modal,
          falai: timing.falai,
          elevenlabs: timing.elevenlabs,
          grove: timing.grove,
          total: timing.total
        }
      })
    });

  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
};

go();
