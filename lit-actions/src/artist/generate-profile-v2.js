/**
 * Generate Artist Profile v2: On-Demand Profile Creation via Render
 *
 * Flow:
 * 1. Check if artist already exists in ArtistRegistryV2 contract
 * 2. If exists → return cached data immediately
 * 3. If not → trigger Render service to generate profile (fast-track)
 * 4. Render creates: PKP → Lens Account → Contract Registration (~15s)
 * 5. Return profile data immediately
 * 6. Background: Render runs video pipeline (TikTok crawl → processing → Lens posts)
 * 7. Frontend listens for ContentFlagUpdated event when videos are ready
 *
 * Input:
 * - geniusArtistId: Genius artist ID
 *
 * Output (Immediate):
 * - success: true
 * - source: "CACHED" | "GENERATED"
 * - profileReady: true (profile always ready after this call)
 * - contentGenerating: true | false (videos processing in background?)
 * - artistName: Artist display name
 * - geniusArtistId: Genius ID
 * - pkpAddress: PKP Ethereum address
 * - pkpTokenId: PKP token ID
 * - lensHandle: Lens username (e.g., "@madonna")
 * - lensAccountAddress: Lens account address
 * - hasContent: true | false (videos available yet?)
 * - registryTxHash: Transaction hash for contract registration
 * - nextSteps: Array of what happens next
 *
 * Background (Async):
 * - TikTok crawler finds top 3 videos
 * - Videos transcribed + translated
 * - Metadata enriched (ISRC, Genius, MLC)
 * - Videos uploaded to Grove + Lens posts created
 * - ContentFlagUpdated event emitted when done
 */

const go = async () => {
  try {
    const { geniusArtistId } = jsParams || {};

    console.log('[Artist Profile v2] Starting profile generation...');
    console.log(`  Genius Artist ID: ${geniusArtistId}`);

    // Validate required params
    if (!geniusArtistId) {
      throw new Error('geniusArtistId is required');
    }

    const artistIdNum = parseInt(geniusArtistId);
    if (isNaN(artistIdNum) || artistIdNum <= 0) {
      throw new Error(`Invalid geniusArtistId: ${geniusArtistId}`);
    }

    // Step 1: Check if artist already exists in contract
    console.log('[Artist Profile v2 - Step 1] Checking ArtistRegistryV2...');
    const registryContract = '0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7'; // Base Sepolia
    const baseSepoliaRpc = 'https://sepolia.base.org';
    const provider = new ethers.providers.JsonRpcProvider(baseSepoliaRpc);

    const registryAbi = [
      'function getArtist(uint32) view returns (tuple(uint32 geniusArtistId, address pkpAddress, string name, address lensAccountAddress, uint8 source, bool hasContent, bool isVerified, bool isBlacklisted, uint64 createdAt, uint64 updatedAt))'
    ];

    const registry = new ethers.Contract(registryContract, registryAbi, provider);

    let artistData;
    let alreadyExists = false;

    try {
      artistData = await registry.getArtist(artistIdNum);

      // Check if artist exists (geniusArtistId > 0 means it exists)
      if (artistData.geniusArtistId > 0) {
        alreadyExists = true;
        console.log('[Artist Profile v2] ✅ Artist already exists in registry!');
        console.log(`  Name: ${artistData.name}`);
        console.log(`  PKP: ${artistData.pkpAddress}`);
        console.log(`  Lens: ${artistData.lensAccountAddress}`);
        console.log(`  Has Content: ${artistData.hasContent}`);
        console.log(`  Source: ${artistData.source === 0 ? 'IMPORTED' : 'GENERATED'}`);

        // Return cached data immediately
        Lit.Actions.setResponse({
          response: JSON.stringify({
            success: true,
            source: artistData.source === 0 ? 'IMPORTED' : 'GENERATED',
            profileReady: true,
            contentGenerating: false, // Already processed
            geniusArtistId: artistIdNum,
            artistName: artistData.name,
            pkpAddress: artistData.pkpAddress,
            lensAccountAddress: artistData.lensAccountAddress,
            hasContent: artistData.hasContent,
            isVerified: artistData.isVerified,
            createdAt: parseInt(artistData.createdAt),
            alreadyRegistered: true,
            message: 'Artist profile already exists (returned cached data)',
            nextSteps: artistData.hasContent
              ? ['Profile and videos ready', 'User can view artist page immediately']
              : ['Profile ready but no videos yet', 'Check back later for video content']
          })
        });

        return;
      }
    } catch (error) {
      console.log('[Artist Profile v2] Artist not found in registry (expected for new artists)');
      alreadyExists = false;
    }

    // Step 2: Artist doesn't exist → Trigger Render to generate profile
    console.log('[Artist Profile v2 - Step 2] Triggering Render profile generation...');

    const renderUrl = 'https://artist-profile-service.onrender.com/generate-artist-profile';
    const pipelineStartTime = Date.now();

    // Use runOnce to ensure only ONE Lit node calls Render (prevent duplicate profile creation)
    const result = await Lit.Actions.runOnce(
      { waitForResponse: true, name: `generateProfile_${geniusArtistId}` },
      async () => {
        try {
          console.log(`[Artist Profile v2] Calling Render API: ${renderUrl}`);

          const response = await fetch(renderUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              geniusArtistId: artistIdNum
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Artist Profile v2] Render API error (${response.status}): ${errorText}`);
            throw new Error(`Render API failed: ${response.status} ${errorText}`);
          }

          const profileData = await response.json();
          console.log(`[Artist Profile v2] ✅ Profile generation response received`);

          return profileData;
        } catch (error) {
          console.error(`[Artist Profile v2] Render API call failed: ${error.message}`);
          throw error;
        }
      }
    );

    const totalTime = (Date.now() - pipelineStartTime) / 1000;

    console.log('[Artist Profile v2] ✅ Profile generation complete');
    console.log(`  Total time: ${totalTime}s`);
    console.log(`  Artist: ${result.artistName}`);
    console.log(`  PKP: ${result.pkpAddress}`);
    console.log(`  Lens: ${result.lensHandle}`);
    console.log(`  Registry Tx: ${result.registryTxHash}`);

    if (result.success) {
      // Success! Return profile data
      Lit.Actions.setResponse({
        response: JSON.stringify({
          success: true,
          source: result.source || 'GENERATED',
          profileReady: true,
          contentGenerating: true, // Background video pipeline is running
          geniusArtistId: artistIdNum,
          artistName: result.artistName,
          pkpAddress: result.pkpAddress,
          pkpTokenId: result.pkpTokenId,
          pkpMintTxHash: result.pkpMintTxHash,
          lensHandle: result.lensHandle,
          lensAccountAddress: result.lensAccountAddress,
          lensTxHash: result.lensTxHash,
          registryTxHash: result.registryTxHash,
          hasContent: false, // Not yet, processing in background
          processing: {
            totalTime: totalTime,
            renderResponse: result.message
          },
          message: 'Profile created! Video content generation in progress.',
          nextSteps: [
            '1. Profile is ready - user can view artist page now',
            '2. Background: TikTok crawler finding top 3 videos',
            '3. Background: Videos being transcribed + translated',
            '4. Background: Metadata enrichment (ISRC, Genius, MLC)',
            '5. Background: Videos uploading to Grove + Lens posts',
            '6. Listen for ContentFlagUpdated(geniusArtistId, true) event',
            '7. When event received, videos are ready to play'
          ],
          renderService: {
            url: renderUrl,
            healthCheck: 'https://artist-profile-service.onrender.com/health'
          }
        })
      });
    } else {
      // Error from Render
      throw new Error(result.error || 'Profile generation failed');
    }

  } catch (error) {
    console.error('[Artist Profile v2] Error:', error.message);
    console.error('[Artist Profile v2] Stack:', error.stack);

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        geniusArtistId: jsParams?.geniusArtistId
      })
    });
  }
};

go();
