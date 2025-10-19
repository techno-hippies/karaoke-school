/**
 * Add study-scorer-v1 as permitted action on SYSTEM_PKP
 * This allows the Lit Action to sign transactions with SYSTEM_PKP
 */

import { LitNodeClient } from '@lit-protocol/lit-node-client'
import { LitNetwork } from '@lit-protocol/constants'
import { ethers } from 'ethers'
import 'dotenv/config'

const SYSTEM_PKP = {
  publicKey: '043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
  tokenId: '18495970405190900970517221272825216094387884724482470185691150662171839015831'
}

const STUDY_SCORER_CID = 'QmVFp9WvRQTvYQKhYHjCUHw1pWx6hGzTVNWoX73TUwY39L'

async function main() {
  console.log('🔐 Adding permitted action to SYSTEM_PKP...')
  console.log('PKP Token ID:', SYSTEM_PKP.tokenId)
  console.log('Lit Action CID:', STUDY_SCORER_CID)

  // Connect to Lit Network
  const litClient = new LitNodeClient({
    litNetwork: LitNetwork.DatilDev,
    debug: false
  })

  await litClient.connect()
  console.log('✅ Connected to Lit network')

  try {
    // Add permitted action
    const ipfsCid = `ipfs://${STUDY_SCORER_CID}`

    console.log(`📝 Adding permitted action: ${ipfsCid}`)

    // This requires the PKP owner's signature
    // For SYSTEM_PKP, we need the private key that controls it
    const ownerPrivateKey = process.env.SYSTEM_PKP_OWNER_KEY
    if (!ownerPrivateKey) {
      throw new Error('SYSTEM_PKP_OWNER_KEY not found in env')
    }

    const wallet = new ethers.Wallet(ownerPrivateKey)
    console.log('Owner address:', wallet.address)

    // Use Lit SDK to add permitted action
    await litClient.addPermittedAction({
      ipfsId: STUDY_SCORER_CID,
      pkpTokenId: SYSTEM_PKP.tokenId,
      authSig: {
        sig: '', // Will be generated
        derivedVia: 'web3.eth.personal.sign',
        signedMessage: '',
        address: wallet.address
      }
    })

    console.log('✅ Permitted action added successfully!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  await litClient.disconnect()
}

main()
