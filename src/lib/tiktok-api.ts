/**
 * Custom TikTokAPI implementation
 * This should exist in @campnetwork/origin but is missing
 * Based on the pattern from TwitterAPI and SpotifyAPI
 */

class APIError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}

const TIKTOK_BASE_URL = 'https://wv2h4to5qa.execute-api.us-east-2.amazonaws.com/dev/tiktok';

async function fetchWithAuth(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const error = await response.text();
    throw new APIError(error || response.statusText, response.status);
  }
  
  const data = await response.json();
  if (data.isError) {
    throw new APIError(data.message || 'Request failed', 400);
  }
  
  return data.data;
}

export class TikTokAPI {
  constructor() {
    // No auth needed for now
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    // Auth headers can be added here in the future if needed
    return headers;
  }

  /**
   * Fetch TikTok user by username
   * Note: The endpoint is confusingly named /video/:userHandle
   */
  async fetchUserByUsername(username: string) {
    if (!this.apiKey) {
      throw new APIError('API key is required for fetching data', 401);
    }
    
    const url = `${TIKTOK_BASE_URL}/video/${username}`;
    return fetchWithAuth(url, this.getHeaders());
  }

  /**
   * Fetch TikTok video by ID
   */
  async fetchVideoById(userHandle: string, videoId: string) {
    if (!this.apiKey) {
      throw new APIError('API key is required for fetching data', 401);
    }
    
    const url = `${TIKTOK_BASE_URL}/videos/${userHandle}?videoId=${videoId}`;
    return fetchWithAuth(url, this.getHeaders());
  }

  /**
   * Fetch multiple videos by username
   * NOTE: This endpoint might not exist - needs testing
   */
  async fetchVideosByUsername(username: string, page = 1, limit = 10) {
    if (!this.apiKey) {
      throw new APIError('API key is required for fetching data', 401);
    }
    
    // This endpoint might need different params
    const url = `${TIKTOK_BASE_URL}/videos/${username}?page=${page}&limit=${limit}`;
    return fetchWithAuth(url, this.getHeaders());
  }

  /**
   * Fetch TikTok followers
   */
  async fetchFollowersByUsername(username: string) {
    if (!this.apiKey) {
      throw new APIError('API key is required for fetching data', 401);
    }
    
    const url = `${TIKTOK_BASE_URL}/followers/${username}`;
    return fetchWithAuth(url, this.getHeaders());
  }

  /**
   * Fetch TikTok following
   */
  async fetchFollowingByUsername(username: string) {
    if (!this.apiKey) {
      throw new APIError('API key is required for fetching data', 401);
    }
    
    const url = `${TIKTOK_BASE_URL}/followings/${username}`;
    return fetchWithAuth(url, this.getHeaders());
  }
}