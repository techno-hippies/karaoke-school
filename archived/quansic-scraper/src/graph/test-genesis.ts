#!/usr/bin/env bun

import { Graph, Ipfs } from '@graphprotocol/grc-20';
import { MusicEntityCreator } from './music-entities';
import chalk from 'chalk';

async function testGenesis() {
  console.log(chalk.cyan.bold('\n🎵 Testing Genesis Entity Creation\n'));
  console.log(chalk.gray('=' .repeat(50)));
  
  try {
    // Create music schema and entities
    console.log(chalk.cyan('1. Creating music schema...'));
    const creator = new MusicEntityCreator();
    await creator.createMusicSchema();
    console.log(chalk.green('✅ Schema created'));
    
    // Create Grimes artist entity
    console.log(chalk.cyan('\n2. Creating Grimes artist entity...'));
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
        title: "Genesys",
        year: "2012"
      }],
      alsoKnownAs: [],
      nameVariants: []
    };
    
    const grimesId = await creator.createArtistEntity(grimesData);
    console.log(chalk.green(`✅ Grimes entity created with ID: ${grimesId}`));
    
    // Create Genesys release
    console.log(chalk.cyan('\n3. Creating Genesys release...'));
    const releaseId = await creator.createReleaseEntity(grimesData.releases[0], grimesId);
    console.log(chalk.green(`✅ Release created with ID: ${releaseId}`));
    
    // Create Genesis song
    console.log(chalk.cyan('\n4. Creating Genesis song...'));
    const songId = await creator.createSongEntity(
      'Genesis',
      grimesId,
      releaseId,
      {
        year: '2012',
        // Genesis is track 1 on Visions album
        isrc: 'CAARR1200001', // This would need to be verified
      }
    );
    console.log(chalk.green(`✅ Genesis song created with ID: ${songId}`));
    
    // Get the ops
    const ops = creator.getOps();
    console.log(chalk.cyan(`\n5. Total operations created: ${ops.length}`));
    
    // Show summary
    console.log(chalk.green.bold('\n✨ Entity Structure Created:'));
    console.log(chalk.gray('├─ Music Schema (Properties & Types)'));
    console.log(chalk.gray('├─ Artist: Grimes'));
    console.log(chalk.gray('├─ Release: Genesys'));
    console.log(chalk.gray('└─ Song: Genesis (THE FIRST!)'));
    
    console.log(chalk.yellow('\n📝 Next Steps:'));
    console.log(chalk.gray('1. Get a wallet with testnet ETH'));
    console.log(chalk.gray('2. Run: bun run src/graph/mint-genesis.ts'));
    console.log(chalk.gray('3. Provide your private key when prompted'));
    console.log(chalk.gray('4. Genesis will be minted on The Graph!'));
    
    console.log(chalk.cyan('\n🔗 Testnet faucet: https://faucet.conduit.xyz/geo-test-zc16z3tcvf'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

testGenesis();