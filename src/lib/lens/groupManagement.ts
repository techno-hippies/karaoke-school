import { evmAddress } from "@lens-protocol/client";
import {
  joinGroup,
  fetchGroupMembers,
  requestGroupMembership
  // approveGroupMembershipRequests
} from "@lens-protocol/client/actions";
import { getLensSession } from "./sessionClient";

// Your Group contract address
export const KARAOKE_GROUP_ADDRESS = '0x269797597B879D53D0A3Bd4b38d646197373d6b1';

/**
 * Add a PKP account to the karaoke group
 * For PKP accounts that should be auto-approved
 */
export async function addPKPToGroup(pkpAddress: string): Promise<boolean> {
  try {
    const sessionClient = getLensSession();
    if (!sessionClient) {
      console.error('[GroupManagement] No Lens session available');
      return false;
    }

    console.log('[GroupManagement] Adding PKP to group:', pkpAddress);

    // Since PKPs are pre-verified accounts, we can add them directly
    // First try to join the group (if open membership)
    const joinResult = await joinGroup(sessionClient, {
      group: evmAddress(KARAOKE_GROUP_ADDRESS)
    });

    if (joinResult.isErr()) {
      console.error('[GroupManagement] Failed to join group:', joinResult.error);

      // If joining failed, try requesting membership (for approval-based groups)
      const requestResult = await requestGroupMembership(sessionClient, {
        group: evmAddress(KARAOKE_GROUP_ADDRESS)
      });

      if (requestResult.isErr()) {
        console.error('[GroupManagement] Failed to request group membership:', requestResult.error);
        return false;
      }

      console.log('[GroupManagement] Membership request sent for PKP:', pkpAddress);
      return true;
    }

    console.log('[GroupManagement] PKP successfully joined group:', pkpAddress);
    return true;

  } catch (error) {
    console.error('[GroupManagement] Error adding PKP to group:', error);
    return false;
  }
}

/**
 * Add an organic user to the karaoke group
 * For regular users who sign up through the app
 */
export async function addOrganicUserToGroup(): Promise<boolean> {
  try {
    const sessionClient = getLensSession();
    if (!sessionClient) {
      console.error('[GroupManagement] No Lens session available');
      return false;
    }

    // Debug session client structure
    console.log('[GroupManagement] Session client structure:', {
      hasAccount: !!sessionClient.account,
      accountAddress: sessionClient.account?.address,
      sessionClientKeys: Object.keys(sessionClient)
    });

    const userAddress = sessionClient.account?.address;
    if (!userAddress) {
      console.error('[GroupManagement] No account address found in session client');
      return false;
    }

    console.log('[GroupManagement] Adding organic user to group:', userAddress);

    // Try to join the group directly
    const joinResult = await joinGroup(sessionClient, {
      group: evmAddress(KARAOKE_GROUP_ADDRESS)
    });

    if (joinResult.isErr()) {
      console.error('[GroupManagement] Failed to join group:', joinResult.error);

      // If joining failed, request membership for approval
      const requestResult = await requestGroupMembership(sessionClient, {
        group: evmAddress(KARAOKE_GROUP_ADDRESS)
      });

      if (requestResult.isErr()) {
        console.error('[GroupManagement] Failed to request group membership:', requestResult.error);
        return false;
      }

      console.log('[GroupManagement] Membership request sent for user:', userAddress);
      return true;
    }

    console.log('[GroupManagement] User successfully joined group:', userAddress);
    return true;

  } catch (error) {
    console.error('[GroupManagement] Error adding organic user to group:', error);
    return false;
  }
}

/**
 * Check if a user is a member of the karaoke group
 */
export async function isGroupMember(address: string): Promise<boolean> {
  try {
    const sessionClient = getLensSession();
    if (!sessionClient) {
      console.error('[GroupManagement] No Lens session available');
      return false;
    }

    const membersResult = await fetchGroupMembers(sessionClient, {
      group: evmAddress(KARAOKE_GROUP_ADDRESS)
    });

    if (membersResult.isErr()) {
      console.error('[GroupManagement] Failed to fetch group members:', membersResult.error);
      return false;
    }

    const members = membersResult.value.items;
    const isMember = members.some(member =>
      member.account.address.toLowerCase() === address.toLowerCase()
    );

    console.log('[GroupManagement] Group membership check:', { address, isMember });
    return isMember;

  } catch (error) {
    console.error('[GroupManagement] Error checking group membership:', error);
    return false;
  }
}

/**
 * Get all group members for debugging
 */
export async function getGroupMembers() {
  try {
    const sessionClient = getLensSession();
    if (!sessionClient) {
      console.error('[GroupManagement] No Lens session available');
      return [];
    }

    const membersResult = await fetchGroupMembers(sessionClient, {
      group: evmAddress(KARAOKE_GROUP_ADDRESS)
    });

    if (membersResult.isErr()) {
      console.error('[GroupManagement] Failed to fetch group members:', membersResult.error);
      return [];
    }

    const members = membersResult.value.items;
    console.log('[GroupManagement] Current group members:', members.length);

    members.forEach((member, index) => {
      console.log(`[GroupManagement] Member ${index}:`, {
        address: member.account.address,
        username: member.account.username?.value,
        joinedAt: member.joinedAt
      });
    });

    return members;

  } catch (error) {
    console.error('[GroupManagement] Error fetching group members:', error);
    return [];
  }
}

/**
 * Initialize PKP accounts in the group
 * Call this once to add all existing PKP accounts to the group
 */
export async function initializePKPGroupMembership(pkpAddresses: string[]): Promise<void> {
  console.log('[GroupManagement] Initializing PKP group membership for:', pkpAddresses.length, 'accounts');

  for (const address of pkpAddresses) {
    console.log('[GroupManagement] Processing PKP:', address);

    // Check if already a member
    const isMember = await isGroupMember(address);
    if (isMember) {
      console.log('[GroupManagement] PKP already in group:', address);
      continue;
    }

    // Add to group
    const success = await addPKPToGroup(address);
    if (success) {
      console.log('[GroupManagement] ✅ PKP added to group:', address);
    } else {
      console.log('[GroupManagement] ❌ Failed to add PKP to group:', address);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('[GroupManagement] PKP group initialization complete');
}