#!/usr/bin/env bun

import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';
import { privateKeyToAccount } from 'viem/accounts';
import { MusicEntityCreator } from './music-entities';
import chalk from 'chalk';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function mintGenesis() {
  console.log(chalk.cyan.bold('\n🎵 Minting "Genesis" by Grimes on The Graph\n'));
  console.log(chalk.gray('=' .repeat(50)));
  
  // Get wallet details
  console.log(chalk.yellow('\nYou need a wallet with testnet ETH to deploy the space.'));
  console.log(chalk.gray('Get testnet ETH from: https://faucet.conduit.xyz/geo-test-zc16z3tcvf\n'));
  
  const privateKey = await question('Enter your private key (0x...): ');
  rl.close();
  
  if (!privateKey.startsWith('0x')) {
    console.log(chalk.red('❌ Private key must start with 0x'));
    return;
  }
  
  const { address } = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(chalk.green(`✅ Wallet address: ${address}`));
  
  try {
    // 1. Create wallet client
    console.log(chalk.cyan('\n1. Setting up wallet client...'));
    const walletClient = await getWalletClient({
      privateKey: privateKey as `0x${string}`,
    });
    
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
    
    // 4. Load Grimes data (hardcoded for now)
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
        title: "Genesys"
      }],
      alsoKnownAs: [],
      nameVariants: []
    };
    
    const grimesId = await creator.createArtistEntity(grimesData);
    console.log(chalk.green(`✅ Created Grimes entity`));
    
    // 5. Create the Genesis/Genesys release
    console.log(chalk.cyan('\n5. Creating Genesys release entity...'));
    const genesysRelease = grimesData.releases[0];
    const releaseId = await creator.createReleaseEntity(genesysRelease, grimesId);
    console.log(chalk.green(`✅ Created Genesys release`));
    
    // 6. Create Genesis song entity (the first song!)
    console.log(chalk.cyan('\n6. Creating Genesis song entity...'));
    const songId = await creator.createSongEntity(
      'Genesis', // Song name
      grimesId,  // Artist ID
      releaseId, // Release ID
      {
        // Add any metadata we have
        year: '2012' // Genesis was released in 2012
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
    
    const { to, data } = await result.json();
    console.log(chalk.gray(`Contract: ${to}`));
    
    // 9. Send transaction
    console.log(chalk.cyan('\n9. Sending transaction to blockchain...'));
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
    console.log(chalk.green('Genesis by Grimes is now the first song minted on The Graph!'));
    console.log(chalk.cyan(`\nSpace ID: ${space.id}`));
    console.log(chalk.cyan(`Song Entity ID: ${songId}`));
    console.log(chalk.cyan(`Transaction: ${txResult}`));
    console.log(chalk.gray('\nView on Geo Genesis: https://www.geobrowser.io'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

// Run the script
mintGenesis();