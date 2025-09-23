import { describe, it, expect, beforeAll } from 'vitest';
import { TwitterAPI, SpotifyAPI } from '@campnetwork/origin';

// Custom TikTokAPI implementation to test
class TikTokAPI {
  private apiKey: string;
  private baseUrl = 'https://wv2h4to5qa.execute-api.us-east-2.amazonaws.com/dev';

  constructor({ apiKey }: { apiKey: string }) {
    this.apiKey = apiKey;
  }

  private async fetchWithAuth(url: string) {
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': this.apiKey,
        },
      });
      
      console.log(`📡 ${url.split('?')[0]} - Status: ${response.status}`);
      
      if (!response.ok) {
        const text = await response.text();
        console.log(`❌ Error response: ${text}`);
        return { error: true, status: response.status, message: text };
      }
      
      const data = await response.json();
      console.log(`✅ Success:`, JSON.stringify(data).slice(0, 200));
      return data;
    } catch (error) {
      console.log(`💥 Fetch error:`, error);
      return { error: true, message: error.message };
    }
  }

  async fetchUserByUsername(username: string) {
    // Correct endpoint: /video/:userHandle (confusingly named!)
    const url = `${this.baseUrl}/tiktok/video/${username}`;
    return this.fetchWithAuth(url);
  }

  async fetchVideoById(userHandle: string, videoId: string) {
    // Correct endpoint: /videos/:userHandle with videoId as query param
    const url = `${this.baseUrl}/tiktok/videos/${userHandle}?videoId=${videoId}`;
    return this.fetchWithAuth(url);
  }

  async fetchFollowersByUsername(username: string) {
    const url = `${this.baseUrl}/tiktok/followers/${username}`;
    return this.fetchWithAuth(url);
  }

  async fetchFollowingsByUsername(username: string) {
    const url = `${this.baseUrl}/tiktok/followings/${username}`;
    return this.fetchWithAuth(url);
  }
}

describe('Camp API Integration Tests', () => {
  const API_KEY = process.env.VITE_CAMP_API_KEY || 'test-api-key';
  
  describe('Twitter API', () => {
    const twitterApi = new TwitterAPI({ apiKey: API_KEY });
    
    it('should attempt to fetch Twitter user', async () => {
      const result = await twitterApi.fetchUserByUsername('elonmusk');
      console.log('Twitter API Response:', result);
      
      // We expect this to fail without proper auth, but it tells us the endpoint exists
      expect(result).toBeDefined();
    });
  });

  describe('Spotify API', () => {
    const spotifyApi = new SpotifyAPI({ apiKey: API_KEY });
    
    it('should attempt to fetch Spotify data by wallet', async () => {
      const result = await spotifyApi.fetchUserByWalletAddress('0x0000000000000000000000000000000000000000');
      console.log('Spotify API Response:', result);
      
      expect(result).toBeDefined();
    });
  });

  describe('TikTok API (Custom Implementation)', () => {
    const tiktokApi = new TikTokAPI({ apiKey: API_KEY });
    
    it('should test TikTok user endpoint', async () => {
      console.log('\n🎵 Testing TikTok /video/:userHandle endpoint (gets user data)...');
      const result = await tiktokApi.fetchUserByUsername('yourstudyspace');
      
      expect(result).toBeDefined();
      if (!result.error) {
        console.log('TikTok user data:', JSON.stringify(result.data?.user, null, 2).slice(0, 500));
      }
    });

    it('should test TikTok video by ID endpoint', async () => {
      console.log('\n🎬 Testing TikTok /videos/:userHandle endpoint with videoId...');
      // Using the example from docs
      const result = await tiktokApi.fetchVideoById('yourstudyspace', '7269439155992562976');
      
      expect(result).toBeDefined();
      if (!result.error) {
        console.log('TikTok video stats:', result.data?.stats);
      }
    });

    it('should test TikTok followers endpoint', async () => {
      console.log('\n👥 Testing TikTok /followers/:userHandle endpoint...');
      const result = await tiktokApi.fetchFollowersByUsername('yourstudyspace');
      
      expect(result).toBeDefined();
      if (!result.error) {
        console.log('TikTok followers data structure:', Object.keys(result));
      }
    });
  });

  describe('Endpoint Discovery', () => {
    it('should probe correct TikTok endpoints', async () => {
      const API_BASE = 'https://wv2h4to5qa.execute-api.us-east-2.amazonaws.com/dev';
      const endpoints = [
        '/tiktok/video/yourstudyspace',  // User endpoint (confusingly named!)
        '/tiktok/videos/yourstudyspace', // Videos endpoint
        '/tiktok/followers/yourstudyspace',
        '/tiktok/followings/yourstudyspace',
      ];

      console.log('\n🔍 Probing TikTok endpoints...\n');
      
      for (const endpoint of endpoints) {
        const url = `${API_BASE}${endpoint}`;
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'x-api-key': API_KEY,
            },
          });
          
          console.log(`${endpoint.padEnd(30)} -> ${response.status} ${response.statusText}`);
        } catch (error) {
          console.log(`${endpoint.padEnd(30)} -> ERROR: ${error.message}`);
        }
      }
    });
  });
});