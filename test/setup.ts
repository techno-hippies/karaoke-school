import { vi } from 'vitest';

// Mock environment variables for testing
vi.stubEnv('VITE_CAMP_API_KEY', 'test-api-key');
vi.stubEnv('VITE_CAMP_CLIENT_ID', 'test-client-id');

// Add any global test setup here
beforeAll(() => {
  console.log('🧪 Starting test suite...');
});

afterAll(() => {
  console.log('✅ Test suite completed');
});