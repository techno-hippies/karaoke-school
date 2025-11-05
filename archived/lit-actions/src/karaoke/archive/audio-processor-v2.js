/**
 * Audio Processor v2: Complete karaoke processing pipeline with Spleeter
 *
 * Flow:
 * 1. Verify segment ownership in KaraokeCreditsV1 contract (paid operation)
 * 2. Verify audio availability on maid.zone (SoundCloud)
 * 3. Process section with Modal Spleeter (download → trim → separate vocals+accompaniment)
 * 4. Enhance accompaniment (instrumental) with fal.ai audio-to-audio
 * 5. Upload all assets to Grove with PKP
 * 6. Update KaraokeCatalog contract with Grove URIs
 *
 * Changes from v1:
 * - Uses Spleeter instead of Demucs (2x faster)
 * - Separates into vocals + accompaniment (instrumental)
 * - Enhances accompaniment instead of drums
 * - Removed ElevenLabs alignment (already done in match-and-segment-v5)
 * - Simplified pipeline for <30s Lit Action timeout
 *
 * Input:
 * - geniusId: Genius song ID
 * - sectionIndex: User-selected section (1-based)
 * - sections: Array of section objects with timestamps
 * - soundcloudPermalink: SoundCloud URL permalink
 * - userAddress: User's wallet address (for ownership verification)
 * - falApiKey* (encrypted)
 *
 * Output:
 * - section: Selected section metadata
 * - grove: Grove URIs for vocals, accompaniment (instrumental)
 * - blockchain: Transaction hash for registry update
 * - processing: Detailed timing breakdown
 */

const go = async () => {
  try {
    const {
      geniusId,
      sectionIndex,
      sections,
      soundcloudPermalink,
      userAddress,
      falApiKeyAccessControlConditions,
      falApiKeyCiphertext,
      falApiKeyDataToEncryptHash
    } = jsParams || {};

    // Validate required params
    if (!userAddress) {
      throw new Error('userAddress required for ownership verification');
    }
    if (!sectionIndex || sectionIndex < 1 || sectionIndex > sections?.length) {
      throw new Error(`Invalid section index ${sectionIndex}. Must be 1-${sections?.length || 0}`);
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

    // Step 2: Decrypt fal.ai API key

    if (!falApiKeyAccessControlConditions || !falApiKeyCiphertext) {
      throw new Error('fal.ai API key required for accompaniment enhancement');
    }

    const falApiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: falApiKeyAccessControlConditions,
      ciphertext: falApiKeyCiphertext,
      dataToEncryptHash: falApiKeyDataToEncryptHash,
      authSig: null,
      chain: 'ethereum'
    });

    // Step 3: Construct audio URL for maid.zone
    // Note: Skipping 30s snippet check for speed - Modal will fail if audio unavailable
    const audioUrl = `https://sc.maid.zone/_/restream/${soundcloudPermalink}`;

    // Step 4: Process karaoke section with Modal Spleeter (trim + separate vocals+accompaniment)
    const pipelineStartTime = Date.now();
    const timing = {};

    const formData = new FormData();
    formData.append('audio_url', audioUrl);
    formData.append('start_time', selectedSection.startTime.toString());
    formData.append('duration', selectedSection.duration.toString());
    formData.append('mp3', 'true');
    formData.append('mp3_bitrate', '192');

    const modalStartTime = Date.now();
    const modalResp = await fetch('https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/process-karaoke', {
      method: 'POST',
      body: formData
    });

    if (!modalResp.ok) {
      const error = await modalResp.text();
      throw new Error(`Modal Spleeter error (${modalResp.status}): ${error}`);
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
    const accompanimentZipRaw = base64ToBytes(modalResult.stems.accompaniment);

    // Step 5: Enhance accompaniment (instrumental) with fal.ai
    const falStartTime = Date.now();

    const accompanimentRaw = extractMp3FromZip(accompanimentZipRaw);

    // Convert Uint8Array to base64 for fal.ai (in chunks to avoid stack overflow)
    const chunkSize = 8192;
    let accompanimentBase64 = '';
    for (let i = 0; i < accompanimentRaw.length; i += chunkSize) {
      const chunk = accompanimentRaw.slice(i, i + chunkSize);
      accompanimentBase64 += btoa(String.fromCharCode.apply(null, chunk));
    }

    const falResp = await fetch('https://fal.run/fal-ai/stable-audio-25/audio-to-audio', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: `data:audio/mp3;base64,${accompanimentBase64}`,
        prompt: 'high quality instrumental, enhanced clarity, professional mixing',
        seconds_total: selectedSection.duration,
        cfg_scale: 7
      })
    });

    if (!falResp.ok) {
      const error = await falResp.text();
      throw new Error(`fal.ai error (${falResp.status}): ${error}`);
    }

    const falResult = await falResp.json();
    const enhancedAccompanimentUrl = falResult.audio?.url;
    if (!enhancedAccompanimentUrl) {
      throw new Error('fal.ai did not return enhanced accompaniment URL');
    }

    // Download enhanced accompaniment
    const enhancedAccompanimentResp = await fetch(enhancedAccompanimentUrl);
    const enhancedAccompanimentBytes = new Uint8Array(await enhancedAccompanimentResp.arrayBuffer());

    timing.falai = (Date.now() - falStartTime) / 1000;

    // Step 6: Upload to Grove and update catalog
    const groveStartTime = Date.now();

    // Note: Grove upload requires @lens-chain/storage-client
    // For now, return URLs for frontend to upload
    // TODO: Implement PKP-signed Grove upload in Lit Action

    const vocalsRaw = extractMp3FromZip(vocalsZip);

    const segmentHash = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "getSegmentHash" },
      async () => {
        const provider = new ethers.JsonRpcProvider(baseSepoliaRpc);
        const catalogContract = new ethers.Contract(
          '0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6', // Base Sepolia KaraokeCatalog
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
          enhancedAccompaniment: enhancedAccompanimentUrl, // fal.ai enhanced instrumental URL
          _note: 'Frontend should download these URLs, extract vocals from original, and upload to Grove'
        },
        assets: {
          vocalsSize: vocalsRaw.length,
          accompanimentSize: enhancedAccompanimentBytes.length
        },
        processing: {
          modal: timing.modal,
          falai: timing.falai,
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
