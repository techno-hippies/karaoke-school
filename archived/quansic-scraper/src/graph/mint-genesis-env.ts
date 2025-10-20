#!/usr/bin/env bun

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { MusicEntityCreator } from './music-entities';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function mintGenesis() {
  console.log(chalk.cyan.bold('\n🎵 Minting "Genesis" by Grimes on The Graph\n'));
  console.log(chalk.gray('=' .repeat(50)));
  
  // Get private key from environment
  let privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.log(chalk.red('❌ PRIVATE_KEY not found in .env file'));
    console.log(chalk.yellow('Make sure to decrypt it with:'));
    console.log(chalk.gray("DOTENV_PRIVATE_KEY='5e0de9a9ff18cf1c16d5aeda3da49323323f38fe55ecb41c45e9bac2f5b390ee' dotenvx get PRIVATE_KEY"));
    return;
  }
  
  // Add 0x prefix if not present
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }
  
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(chalk.green(`✅ Wallet address: ${address}`));
  console.log(chalk.gray('   Using testnet (Geo testnet)'));
  
  try {
    // 1. Create wallet client
    console.log(chalk.cyan('\n1. Setting up wallet client...'));
    const walletClient = await getWalletClient({
      privateKey: privateKey as `0x${string}`,
    });
    console.log(chalk.green('✅ Wallet client ready'));
    
    // 2. Deploy a space for music
    console.log(chalk.cyan('\n2. Deploying Music Space on testnet...'));
    const space = await Graph.createSpace({
      editorAddress: address,
      name: 'Quansic-Music',
      network: 'TESTNET',
    });
    console.log(chalk.green(`✅ Space created with ID: ${space.id}`));
    
    // 3. Create music schema and entities
    console.log(chalk.cyan('\n3. Creating music schema...'));
    const creator = new MusicEntityCreator();
    await creator.createMusicSchema();
    console.log(chalk.green('✅ Schema created'));
    
    // 4. Create Grimes artist entity
    console.log(chalk.cyan('\n4. Creating artist entity for Grimes...'));
    const grimesData = {
      id: "0000000356358936",
      name: "Grimes",
      type: "Person" as const,
      identifiers: {
        isni: "0000000356358936",
        spotifyId: "053q0ukIDRgzwTr4vNSwab",
        musicbrainzId: "7e5a2a59-6d9f-4a17-b7c2-e1eedb7bd222",
      },
      comments: "Canadian singer and producer",
      image: "https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Grimes.jpg&width=300",
      releases: [{
        upc: "0602458330724",
        title: "Visions", // The album containing Genesis
        year: "2012"
      }],
      alsoKnownAs: [],
      nameVariants: []
    };
    
    const grimesId = await creator.createArtistEntity(grimesData);
    console.log(chalk.green(`✅ Created Grimes entity`));
    
    // 5. Create the Visions album
    console.log(chalk.cyan('\n5. Creating Visions album entity...'));
    const visionsRelease = {
      upc: "0652637320862", // Correct UPC for Visions
      title: "Visions",
      year: "2012",
      type: "Album"
    };
    const releaseId = await creator.createReleaseEntity(visionsRelease, grimesId);
    console.log(chalk.green(`✅ Created Visions album`));
    
    // 6. Create Genesis song entity (THE FIRST SONG!)
    console.log(chalk.cyan('\n6. Creating Genesis song entity...'));
    const songId = await creator.createSongEntity(
      'Genesis', // Song name
      grimesId,  // Artist ID
      releaseId, // Release ID
      {
        year: '2012',
        duration: '4:15', // Genesis is 4:15 long
        iswc: 'T9114723227' // The actual ISWC we found!
      }
    );
    console.log(chalk.green(`✅ Created Genesis song - THE FIRST SONG ON THE GRAPH!`));
    
    // 7. Publish to IPFS
    console.log(chalk.cyan('\n7. Publishing to IPFS...'));
    const { cid } = await Ipfs.publishEdit({
      name: 'Genesis - First Music on The Graph',
      ops: creator.getOps(),
      author: address,
      network: 'TESTNET',
    });
    console.log(chalk.green(`✅ Published to IPFS: ${cid}`));
    
    // 8. Get calldata and publish onchain
    console.log(chalk.cyan('\n8. Getting calldata for onchain transaction...'));
    const result = await fetch(`${Graph.TESTNET_API_ORIGIN}/space/${space.id}/edit/calldata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid }),
    });
    
    if (!result.ok) {
      const error = await result.text();
      throw new Error(`Failed to get calldata: ${error}`);
    }
    
    const { to, data } = await result.json();
    console.log(chalk.gray(`   Contract: ${to}`));
    console.log(chalk.gray(`   Data length: ${data.length} bytes`));
    
    // 9. Send transaction
    console.log(chalk.cyan('\n9. Sending transaction to blockchain...'));
    console.log(chalk.yellow('   This may take a moment...'));
    
    const txResult = await walletClient.sendTransaction({
      // @ts-ignore
      account: walletClient.account,
      to: to as `0x${string}`,
      value: 0n,
      data: data as `0x${string}`,
    });
    
    console.log(chalk.green(`✅ Transaction sent: ${txResult}`));
    
    // Success!
    console.log(chalk.green.bold('\n🎉 SUCCESS! 🎉'));
    console.log(chalk.green.bold('Genesis by Grimes is now the FIRST SONG minted on The Graph!'));
    console.log(chalk.cyan(`\n📊 Summary:`));
    console.log(chalk.gray(`   Space ID: ${space.id}`));
    console.log(chalk.gray(`   Artist ID: ${grimesId}`));
    console.log(chalk.gray(`   Album ID: ${releaseId}`));
    console.log(chalk.gray(`   Song ID: ${songId}`));
    console.log(chalk.gray(`   IPFS CID: ${cid}`));
    console.log(chalk.gray(`   Transaction: ${txResult}`));
    console.log(chalk.cyan('\n🌐 View on Geo Genesis: https://www.geobrowser.io'));
    console.log(chalk.gray(`   Search for space: ${space.id}`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
    if (error instanceof Error) {
      console.error(chalk.red('Details:'), error.message);
    }
  }
}

// Run the script
mintGenesis();