/**
 * Audio Processor v4: Song-Based Demucs Pipeline
 *
 * Flow:
 * 1. Verify segment ownership in KaraokeCreditsV1 contract (paid operation)
 * 2. Trigger Demucs /process-song-async (processes ALL segments for the song)
 * 3. Return jobId for frontend to poll
 * 4. Demucs processes in background → calls webhook → updates contract
 *
 * Changes from v3:
 * - Song-based processing: ALL segments processed at once (not one at a time)
 * - Uses Demucs mdx_extra (not Spleeter)
 * - Async processing: Returns jobId immediately, webhook updates contract later
 * - Cost optimization: $0.20/song (not $0.20/segment)
 * - Time optimization: ~79s for all segments (not ~50s per segment)
 *
 * Input:
 * - geniusId: Genius song ID
 * - sectionIndex: User-selected section (1-based) - for ownership verification
 * - sections: Array of ALL section objects with timestamps
 * - soundcloudPermalink: SoundCloud URL permalink
 * - userAddress: User's wallet address (for ownership verification)
 * - songDuration: Full song duration in seconds (from LRClib)
 *
 * Output:
 * - jobId: Modal job ID for polling status
 * - selectedSegment: The segment user wants to practice
 * - allSegments: All segments being processed
 * - status: "processing"
 * - pollUrl: URL to check job status
 */

const go = async () => {
  try {
    const {
      geniusId,
      sectionIndex,
      sections,
      userAddress,
      songDuration
    } = jsParams || {};

    console.log('[Audio Processor v4] Starting song-based processing...');
    console.log(`  Genius ID: ${geniusId}`);
    console.log(`  User selected: section ${sectionIndex}`);
    console.log(`  Total sections: ${sections?.length}`);
    console.log(`  Song duration: ${songDuration}s`);

    // Validate required params
    if (!userAddress) {
      throw new Error('userAddress required for ownership verification');
    }
    if (!geniusId) {
      throw new Error('geniusId is required');
    }
    if (!sections || sections.length === 0) {
      throw new Error('sections array is required');
    }
    if (!sectionIndex || sectionIndex < 1 || sectionIndex > sections.length) {
      throw new Error(`Invalid section index ${sectionIndex}. Must be 1-${sections.length}`);
    }
    if (!songDuration) {
      throw new Error('songDuration is required (from LRClib)');
    }

    // Step 0: Read soundcloudPath from contract
    console.log('[Audio Processor v4 - Step 0] Reading soundcloudPath from contract...');
    const catalogContract = '0xd7e442f4aA8da4CaCd786896d8Fd60A7B5DA0E3e'; // Base Sepolia
    const baseSepoliaRpc = 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(baseSepoliaRpc);
    const catalogAbi = [
      'function getSongByGeniusId(uint32) view returns (tuple(string id, uint32 geniusId, string title, string artist, uint32 duration, string soundcloudPath, bool hasFullAudio, bool requiresPayment, string audioUri, string metadataUri, string coverUri, string thumbnailUri, string musicVideoUri, bool enabled, uint64 addedAt))'
    ];
    const catalog = new ethers.Contract(catalogContract, catalogAbi, provider);
    const songData = await catalog.getSongByGeniusId(geniusId);

    const soundcloudPath = songData.soundcloudPath;
    if (!soundcloudPath) {
      throw new Error('Song has no soundcloudPath in contract. Cannot download audio.');
    }
    console.log(`✅ SoundCloud path from contract: ${soundcloudPath}`);

    const selectedSection = sections[sectionIndex - 1];

    // Generate segmentId (matches contract format: "chorus-1", "verse-2")
    const selectedSegmentId = selectedSection.type.toLowerCase().replace(/\s+/g, '-');

    console.log(`[Audio Processor v4] User selected: ${selectedSegmentId}`);

    // Step 1: Verify segment ownership (paid operation)
    const creditsContract = '0x6de183934E68051c407266F877fafE5C20F74653'; // Base Sepolia
    const baseSepoliaRpc = 'https://sepolia.base.org';

    console.log('[Audio Processor v4] Verifying ownership...');
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
          return await contract.ownsSegment(userAddress, 1, geniusId.toString(), selectedSegmentId);
        } catch (error) {
          console.error('Ownership check failed:', error.message);
          return false;
        }
      }
    );

    if (!owned) {
      throw new Error(
        `Segment not owned. Purchase credits and unlock segment "${selectedSegmentId}" (Genius ID ${geniusId}) before generating karaoke.`
      );
    }

    console.log('[Audio Processor v4] ✅ Ownership verified');

    // Step 2: Trigger Demucs song-based processing (ALL segments)
    console.log('[Audio Processor v4] Triggering Demucs song-based processing...');

    const pipelineStartTime = Date.now();

    // Construct audio URL using soundcloudPath from contract
    const audioUrl = `https://sc.maid.zone/_/restream/${soundcloudPath}`;
    console.log(`[Audio Processor v4] Audio URL: ${audioUrl}`);

    // Build segments array for Demucs (ALL segments, not just selected one)
    const allSegments = sections.map(section => ({
      id: section.type.toLowerCase().replace(/\s+/g, '-'),
      startTime: section.startTime,
      endTime: section.endTime
    }));

    console.log(`[Audio Processor v4] Processing ${allSegments.length} segments:`);
    allSegments.forEach(seg => {
      console.log(`  - ${seg.id}: ${seg.startTime}s - ${seg.endTime}s`);
    });

    // Generate unique job ID
    const jobId = `audio-v4-${geniusId}-${Date.now()}`;

    console.log('[Audio Processor v4] Calling Demucs API (with runOnce to prevent duplicates)...');
    const modalStartTime = Date.now();

    // Use runOnce to ensure only ONE node calls Modal (prevent 3 duplicate jobs)
    // NOTE: Don't use waitForResponse to avoid timeout - just trigger and return immediately
    Lit.Actions.runOnce(
      { waitForResponse: false, name: `triggerDemucs_${jobId}` },
      async () => {
        // Build FormData for Demucs /process-song-async (inside runOnce for serialization)
        const formData = new FormData();
        formData.append('job_id', jobId);
        formData.append('user_address', userAddress);
        formData.append('genius_id', geniusId.toString());
        formData.append('audio_url', audioUrl);
        formData.append('full_duration', songDuration.toString());
        formData.append('segments_json', JSON.stringify(allSegments));
        formData.append('chain_id', '84532');
        formData.append('mp3_bitrate', '192');
        formData.append('fal_strength', '0.3');
        formData.append('webhook_url', 'https://karaoke-webhook-server.onrender.com/webhook/song-complete');

        try {
          const modalResp = await fetch('https://techno-hippies--demucs-karaoke-fastapi-app.modal.run/process-song-async', {
            method: 'POST',
            body: formData
          });

          if (!modalResp.ok) {
            const error = await modalResp.text();
            console.error(`[Audio Processor v4] Modal API error (${modalResp.status}): ${error}`);
            return;
          }

          const result = await modalResp.json();
          console.log(`[Audio Processor v4] Modal job started: ${result.job_id}`);
        } catch (error) {
          console.error(`[Audio Processor v4] Modal API failed: ${error.message}`);
        }
      }
    );

    const modalTime = (Date.now() - modalStartTime) / 1000;

    console.log('[Audio Processor v4] ✅ Demucs job triggered (fire-and-forget via runOnce)');
    console.log(`  Job ID: ${jobId}`);

    const totalTime = (Date.now() - pipelineStartTime) / 1000;

    console.log('[Audio Processor v4] Complete - processing in background');

    // Return success response with jobId (fire-and-forget, so status is immediately "processing")
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        geniusId,
        jobId: jobId,
        status: 'processing', // Always "processing" since we don't wait for Modal response
        selectedSegment: {
          index: sectionIndex,
          id: selectedSegmentId,
          type: selectedSection.type,
          startTime: selectedSection.startTime,
          endTime: selectedSection.endTime,
          duration: selectedSection.duration
        },
        allSegments: allSegments.map(seg => seg.id),
        segmentCount: allSegments.length,
        songDuration: songDuration,
        pollUrl: `https://techno-hippies--demucs-karaoke-fastapi-app.modal.run/job/${jobId}`,
        webhookUrl: 'https://karaoke-webhook-server.onrender.com/webhook/song-complete',
        estimatedTime: '~79s for Demucs + ~10s for contract update = ~90s total',
        processing: {
          demucs_trigger: modalTime,
          total: totalTime
        },
        optimization: {
          method: 'song-based (all segments at once)',
          model: 'Demucs mdx_extra',
          cost: '$0.20 for all segments (vs $1.00 segment-based)',
          savings: '$0.80 (80%)'
        },
        nextSteps: [
          '1. Poll pollUrl for job status',
          '2. When status=complete, all segments have Grove URIs',
          '3. Webhook will have updated contract via processSegmentsBatch',
          '4. User can practice any segment'
        ]
      })
    });

  } catch (error) {
    console.error('[Audio Processor v4] Error:', error.message);
    console.error('[Audio Processor v4] Stack:', error.stack);

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
