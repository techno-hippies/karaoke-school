/**
 * Audio Processor v3: Simplified orchestration using Modal complete pipeline
 *
 * Flow:
 * 1. Verify segment ownership in KaraokeCreditsV1 contract (paid operation)
 * 2. Call Modal /process-karaoke-grove endpoint (Spleeter + fal.ai + Grove upload)
 * 3. Update KaraokeCatalog contract with Grove URIs
 *
 * Changes from v2:
 * - No fal.ai key decryption in Lit Action (Modal uses its own secret)
 * - Single Modal endpoint call instead of multiple steps
 * - All heavy processing (Spleeter + fal.ai + Grove) happens on Modal (no timeout limits)
 * - Lit Action is pure orchestration (~5s total)
 *
 * Input:
 * - geniusId: Genius song ID
 * - sectionIndex: User-selected section (1-based)
 * - sections: Array of section objects with timestamps
 * - soundcloudPermalink: SoundCloud URL permalink
 * - userAddress: User's wallet address (for ownership verification)
 *
 * Output:
 * - section: Selected section metadata
 * - grove: Grove URIs for vocals, enhanced accompaniment
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
      userAddress
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

    // Step 2: Call Modal complete pipeline (Spleeter + fal.ai + Grove)
    const pipelineStartTime = Date.now();
    const timing = {};

    // Construct audio URL
    const audioUrl = `https://sc.maid.zone/_/restream/${soundcloudPermalink}`;

    // Build FormData for Modal endpoint
    const formData = new FormData();
    formData.append('audio_url', audioUrl);
    formData.append('start_time', selectedSection.startTime.toString());
    formData.append('duration', selectedSection.duration.toString());
    formData.append('chain_id', '37111'); // Lens testnet
    formData.append('mp3_bitrate', '192');
    formData.append('strength', '0.4'); // fal.ai strength (0=keep original, 0.4=light transform)

    const modalStartTime = Date.now();
    const modalResp = await fetch('https://techno-hippies--spleeter-karaoke-fastapi-app.modal.run/process-karaoke-grove', {
      method: 'POST',
      body: formData
    });

    if (!modalResp.ok) {
      const error = await modalResp.text();
      throw new Error(`Modal pipeline error (${modalResp.status}): ${error}`);
    }

    const modalResult = await modalResp.json();
    timing.modal_complete = (Date.now() - modalStartTime) / 1000;

    if (!modalResult.success) {
      throw new Error(`Modal pipeline failed: ${JSON.stringify(modalResult)}`);
    }

    // Extract Grove URIs
    const groveUris = {
      vocals: modalResult.grove_uris.vocals,
      accompaniment: modalResult.grove_uris.accompaniment
    };

    // Step 3: Update KaraokeCatalog contract
    const catalogStartTime = Date.now();

    const catalogContract = '0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6'; // Base Sepolia

    // Get segment hash for contract update
    const segmentHash = await Lit.Actions.runOnce(
      { waitForResponse: true, name: "getSegmentHash" },
      async () => {
        const provider = new ethers.JsonRpcProvider(baseSepoliaRpc);
        const contract = new ethers.Contract(
          catalogContract,
          ['function getSegmentHash(uint32,string,string) view returns (bytes32)'],
          provider
        );
        return await contract.getSegmentHash(geniusId, '', segmentId);
      }
    );

    timing.catalog_read = (Date.now() - catalogStartTime) / 1000;
    timing.total = (Date.now() - pipelineStartTime) / 1000;

    // Return success response
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        geniusId,
        segmentId,
        segmentHash,
        section: {
          index: sectionIndex,
          type: selectedSection.type,
          startTime: selectedSection.startTime,
          endTime: selectedSection.endTime,
          duration: selectedSection.duration
        },
        grove: groveUris,
        grove_gateway_urls: modalResult.gateway_urls,
        processing: {
          modal: {
            spleeter: modalResult.timing.spleeter,
            replicate: modalResult.timing.replicate,
            grove_upload: modalResult.timing.grove_upload,
            total: modalResult.timing.total
          },
          lit_action: {
            modal_complete: timing.modal_complete,
            catalog_read: timing.catalog_read,
            total: timing.total
          }
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
