/**
 * Test parameter validation only
 */

const go = async () => {
  const {
    userAddress,
    source,
    contentId,
    itemsReviewed,
    averageScore,
    pkpPublicKey,
  } = jsParams || {};

  console.log('Received params:', {
    userAddress,
    source,
    contentId,
    itemsReviewed,
    averageScore,
    pkpPublicKey: pkpPublicKey ? pkpPublicKey.substring(0, 20) + '...' : 'missing'
  });

  try {
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      throw new Error('INVALID_USER_ADDRESS');
    }

    if (source === undefined || source === null || source < 0 || source > 1) {
      throw new Error('INVALID_SOURCE');
    }

    if (!contentId || typeof contentId !== 'string' || contentId.trim() === '') {
      throw new Error('INVALID_CONTENT_ID');
    }

    if (!itemsReviewed || itemsReviewed < 1 || itemsReviewed > 65535) {
      throw new Error('INVALID_ITEMS_REVIEWED');
    }

    if (averageScore === undefined || averageScore < 0 || averageScore > 100) {
      throw new Error('INVALID_AVERAGE_SCORE');
    }

    if (!pkpPublicKey) {
      throw new Error('MISSING_PKP_PUBLIC_KEY');
    }

    console.log('All validations passed!');

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        message: 'All parameters valid',
        validated: { userAddress, source, contentId, itemsReviewed, averageScore }
      })
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message
      })
    });
  }
};

go();
