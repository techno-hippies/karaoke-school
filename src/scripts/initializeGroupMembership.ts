/**
 * Script to initialize PKP accounts in the Lens Group
 * Run this once to add all existing PKP accounts to the group
 */

import { initializePKPGroupMembership, getGroupMembers } from '../lib/lens/groupManagement';

// PKP addresses from your current system
const PKP_ADDRESSES = [
  '0x0C6433789d14050aF47198B2751f6689731Ca79C',
  '0x40e5d361A3E508B07Cab70D0929f0b08Cf8581A4', // lens/pkptest731709
  '0x4825986613716dc1cFa41E695b32Ee5D05191Bb4',
  '0xA40347E56F3d400800545e08B5305bE9ccA601e5', // lens/bellapoarch_t1
  '0xDC7E1B9063B7Fbdf6F0b40c5aa36E5dD698d598D', // lens/pkptest744473
  '0xf1a92Ec7cbb29b41942F0d9D4eEeABFEdC22ef9d', // lens/theevaelfie_t1
  '0xfbc6e6F734253fe36aFF3FC96BB13B4968B71E08', // lens/addisonre1218
];

async function main() {
  console.log('🚀 Starting PKP Group Membership Initialization...');

  // First, show current group members
  console.log('\n📋 Current Group Members:');
  await getGroupMembers();

  // Initialize PKP membership
  console.log('\n🔄 Adding PKP accounts to group...');
  await initializePKPGroupMembership(PKP_ADDRESSES);

  // Show updated group members
  console.log('\n📋 Updated Group Members:');
  await getGroupMembers();

  console.log('\n✅ PKP Group Membership Initialization Complete!');
}

// Export for use in development
export { main as initializeGroupMembership };

// Allow running from browser console
if (typeof window !== 'undefined') {
  (window as any).initializeGroupMembership = main;
  console.log('Run initializeGroupMembership() in the browser console to add PKPs to the group');
}