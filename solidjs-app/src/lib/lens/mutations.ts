/**
 * Lens GraphQL Mutations
 * Raw GraphQL mutations for operations not covered by SDK helpers
 *
 * Used for:
 * - Custom namespace account creation (2-step flow)
 * - Username creation with payment rules
 * - Operations requiring rulesSubject parameter
 */

import { gql } from 'graphql-request'

/**
 * Create Account Mutation (Step 1 of 2-step flow)
 * Creates account without username (can add username later)
 */
export const CREATE_ACCOUNT_MUTATION = gql`
  mutation CreateAccount($request: CreateAccountRequest!) {
    createAccount(request: $request) {
      ... on CreateAccountResponse {
        hash
      }
      ... on SelfFundedTransactionRequest {
        reason
        raw {
          from
          to
          data
          value
          nonce
          gasLimit
          maxPriorityFeePerGas
          maxFeePerGas
        }
      }
      ... on TransactionWillFail {
        reason
      }
    }
  }
`

/**
 * Create Username Mutation (Step 2 of 2-step flow)
 * Creates username in custom namespace with payment rules support
 */
export const CREATE_USERNAME_MUTATION = gql`
  mutation CreateUsername($request: CreateUsernameRequest!) {
    createUsername(request: $request) {
      ... on CreateUsernameResponse {
        hash
      }
      ... on SponsoredTransactionRequest {
        reason
        sponsoredReason
        raw {
          from
          to
          data
          value
          nonce
          gasLimit
          maxPriorityFeePerGas
          maxFeePerGas
        }
      }
      ... on SelfFundedTransactionRequest {
        reason
        raw {
          from
          to
          data
          value
          nonce
          gasLimit
          maxPriorityFeePerGas
          maxFeePerGas
        }
      }
      ... on TransactionWillFail {
        reason
      }
    }
  }
`

/**
 * Set Account Metadata Mutation
 * Updates account metadata URI
 */
export const SET_ACCOUNT_METADATA_MUTATION = gql`
  mutation SetAccountMetadata($request: SetAccountMetadataRequest!) {
    setAccountMetadata(request: $request) {
      ... on SetAccountMetadataResponse {
        hash
      }
      ... on SponsoredTransactionRequest {
        reason
        sponsoredReason
        raw {
          from
          to
          data
          value
          nonce
          gasLimit
          maxPriorityFeePerGas
          maxFeePerGas
        }
      }
      ... on SelfFundedTransactionRequest {
        reason
        raw {
          from
          to
          data
          value
          nonce
          gasLimit
          maxPriorityFeePerGas
          maxFeePerGas
        }
      }
      ... on TransactionWillFail {
        reason
      }
    }
  }
`

/**
 * Authentication Challenge Mutation
 * Requests challenge for signing
 */
export const CHALLENGE_MUTATION = gql`
  mutation Challenge($request: ChallengeRequest!) {
    challenge(request: $request) {
      id
      text
    }
  }
`

/**
 * Authenticate Mutation
 * Submits signed challenge for authentication
 */
export const AUTHENTICATE_MUTATION = gql`
  mutation Authenticate($request: SignedAuthChallenge!) {
    authenticate(request: $request) {
      ... on AuthenticationTokens {
        accessToken
        refreshToken
        idToken
      }
      ... on WrongSignerError {
        reason
      }
      ... on ExpiredChallengeError {
        reason
      }
      ... on ForbiddenError {
        reason
      }
    }
  }
`

/**
 * Account Query
 * Fetches account by transaction hash or address
 */
export const ACCOUNT_QUERY = gql`
  query Account($request: AccountRequest!) {
    account(request: $request) {
      address
      owner
      username {
        value
        localName
        namespace {
          address
        }
      }
      metadata {
        ... on AccountMetadata {
          name
          bio
          picture
          coverPicture
          attributes {
            key
            value
          }
        }
      }
    }
  }
`

/**
 * Check Username Availability Query
 * Validates username against namespace rules
 *
 * Note: Using minimal query structure to avoid schema mismatches
 * We only check __typename and reason, not detailed rule information
 */
export const CAN_CREATE_USERNAME_QUERY = gql`
  query CanCreateUsername($request: CanCreateUsernameRequest!) {
    canCreateUsername(request: $request) {
      __typename
      ... on NamespaceOperationValidationPassed {
        __typename
      }
      ... on NamespaceOperationValidationFailed {
        reason
      }
      ... on NamespaceOperationValidationUnknown {
        __typename
      }
      ... on UsernameTaken {
        __typename
      }
    }
  }
`

/**
 * TypeScript types for mutation responses
 */

export interface CreateAccountResponse {
  hash?: string
  reason?: string
  raw?: RawTransaction
}

export interface CreateUsernameResponse {
  hash?: string
  reason?: string
  sponsoredReason?: string
  id?: string
  typedData?: TypedData
  raw?: RawTransaction
}

export interface RawTransaction {
  from: string
  to: string
  data: string
  value: string
  nonce: string
  gasLimit: string
  maxPriorityFeePerGas: string
  maxFeePerGas: string
}

export interface TypedData {
  types: Record<string, Array<{ name: string; type: string }>>
  domain: {
    name: string
    version: string
    chainId: string
    verifyingContract: string
  }
  value: Record<string, any>
}

export interface ChallengeResponse {
  id: string
  text: string
}

export interface AuthenticationTokens {
  accessToken: string
  refreshToken: string
  idToken: string
}

export interface AccountResponse {
  address: string
  owner: string
  username?: {
    value: string
    localName: string
    namespace: {
      address: string
    }
  }
  metadata?: {
    name?: string
    bio?: string
    picture?: string
    coverPicture?: string
    attributes?: Array<{
      key: string
      value: string
    }>
  }
}

export interface CanCreateUsernameResponse {
  __typename: 'NamespaceOperationValidationPassed' | 'NamespaceOperationValidationFailed' | 'NamespaceOperationValidationUnknown' | 'UsernameTaken'
  reason?: string
}
