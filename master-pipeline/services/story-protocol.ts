/**
 * Story Protocol Service
 *
 * Mints IP Assets with licensing terms on Story Protocol
 * Handles metadata, NFTs, and royalty vaults
 */

import { StoryClient, StoryConfig, PILFlavor } from '@story-protocol/core-sdk';
import { http, zeroAddress, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createHash } from 'crypto';
import { BaseService, ServiceConfig } from './base.js';

export interface StoryProtocolConfig extends ServiceConfig {
  privateKey: string;
  rpcUrl?: string;
  chainId?: number; // 1315 = Aeneid testnet, 1514 = mainnet
  spgNftContract?: Address; // Reusable NFT collection
  currency?: Address; // Currency for royalties (default: $WIP testnet)
  safeWallet?: Address; // Safe multisig for 82% royalty split
}

export interface IPAssetMetadata {
  title: string;
  description: string;
  createdAt: string;
  image: string;
  imageHash: string;
  creators: Array<{
    name: string;
    address: Address;
    contributionPercent: number;
    role: string;
    description: string;
  }>;
  mediaUrl: string;
  mediaHash: string;
  mediaType: string;
  ipType: string;
  tags: string[];
  [key: string]: any; // Allow custom fields
}

export interface MintIPAssetParams {
  metadata: IPAssetMetadata;
  metadataUri: string;
  recipient: Address;
  commercialRevShare?: number; // Default: 18%
  mintingFee?: number; // Default: 0
}

export interface MintIPAssetResult {
  ipId: string;
  txHash: string;
  metadataUri: string;
  licenseTermsIds?: string[];
  royaltyVault?: string;
}

export class StoryProtocolService extends BaseService {
  private client: StoryClient;
  private config: StoryProtocolConfig;

  constructor(config: StoryProtocolConfig) {
    super('StoryProtocol', config);
    this.config = config;

    const formattedKey = config.privateKey.startsWith('0x')
      ? config.privateKey
      : `0x${config.privateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const storyConfig: StoryConfig = {
      account,
      transport: http(config.rpcUrl || 'https://aeneid.storyrpc.io'),
      chainId: config.chainId || 1315, // Aeneid testnet
    };

    this.client = StoryClient.newClient(storyConfig);
    this.log(`Connected to Story Protocol (chainId: ${storyConfig.chainId})`);
    this.log(`Wallet: ${account.address}`);
  }

  /**
   * Create SPG NFT collection (reusable for all IP Assets)
   */
  async createNFTCollection(
    name: string,
    symbol: string,
    maxSupply: number = 100000
  ): Promise<Address> {
    this.log(`Creating NFT collection: ${name} (${symbol})`);

    const result = await this.client.nftClient.createNFTCollection({
      name,
      symbol,
      isPublicMinting: true,
      mintFeeRecipient: zeroAddress,
      mintOpen: true,
      maxSupply,
      contractURI: '',
    });

    const spgNftContract = result.spgNftContract || result.nftContract;
    if (!spgNftContract) {
      throw new Error('Failed to get NFT contract address');
    }

    this.log(`✓ NFT Collection: ${spgNftContract}`);
    this.log(`  Transaction: ${result.txHash}`);

    return spgNftContract as Address;
  }

  /**
   * Hash metadata for Story Protocol (SHA-256)
   */
  private hashMetadata(metadata: any): `0x${string}` {
    const metadataJson = JSON.stringify(metadata);
    const hash = createHash('sha256').update(metadataJson).digest('hex');
    return `0x${hash}`;
  }

  /**
   * Hash file from URL (for image/media verification)
   */
  async hashUrl(url: string): Promise<`0x${string}`> {
    try {
      // Convert lens:// URIs to HTTPS
      let fetchUrl = url;
      if (url.startsWith('lens://')) {
        const hash = url.replace('lens://', '');
        fetchUrl = `https://api.grove.storage/${hash}`;
      }

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const hash = createHash('sha256').update(Buffer.from(buffer)).digest('hex');
      return `0x${hash}`;
    } catch (error: any) {
      this.log(`⚠️  Failed to hash URL (using fallback): ${error.message}`);
      // Fallback: hash the URL string
      const hash = createHash('sha256').update(url).digest('hex');
      return `0x${hash}`;
    }
  }

  /**
   * Mint IP Asset with Commercial Remix license
   */
  async mintIPAsset(params: MintIPAssetParams): Promise<MintIPAssetResult> {
    this.log('Minting IP Asset...');

    const {
      metadata,
      metadataUri,
      recipient,
      commercialRevShare = 18,
      mintingFee = 0,
    } = params;

    // Ensure SPG NFT contract exists
    if (!this.config.spgNftContract) {
      throw new Error('SPG NFT contract not configured. Call createNFTCollection() first.');
    }

    this.log(`  Metadata URI: ${metadataUri.slice(0, 60)}...`);
    this.log(`  Recipient: ${recipient}`);
    this.log(`  Commercial Rev Share: ${commercialRevShare}%`);

    // Hash metadata
    const metadataHash = this.hashMetadata(metadata);
    this.log(`  Metadata Hash: ${metadataHash.slice(0, 20)}...`);

    // Mint IP Asset with license terms
    const currency = this.config.currency || '0x1514000000000000000000000000000000000000'; // $WIP testnet

    const response = await this.client.ipAsset.registerIpAsset({
      nft: {
        type: 'mint',
        spgNftContract: this.config.spgNftContract,
        recipient,
      },
      ipMetadata: {
        ipMetadataURI: metadataUri,
        ipMetadataHash: metadataHash,
        nftMetadataURI: metadataUri,
        nftMetadataHash: metadataHash,
      },
      licenseTermsData: [
        {
          terms: PILFlavor.commercialRemix({
            defaultMintingFee: mintingFee,
            commercialRevShare,
            currency: currency as Address,
            override: {
              uri: 'https://raw.githubusercontent.com/piplabs/pil-document/ad67bb632a310d2557f8abcccd428e4c9c798db1/off-chain-terms/CommercialRemix.json',
            },
          }),
        },
      ],
      deadline: BigInt(Date.now() + 1000 * 60 * 5), // 5 min
    });

    this.log('✓ IP Asset minted!');
    this.log(`  IP Asset ID: ${response.ipId}`);
    this.log(`  Transaction: ${response.txHash}`);

    const result: MintIPAssetResult = {
      ipId: response.ipId!,
      txHash: response.txHash!,
      metadataUri,
    };

    // Log license terms if attached
    if ('licenseTermsIds' in response && response.licenseTermsIds) {
      result.licenseTermsIds = response.licenseTermsIds.map(id => id.toString());
      this.log(`  License Terms: ${result.licenseTermsIds.join(', ')}`);
    }

    // Get royalty vault
    try {
      const vaultAddress = await this.client.royalty.getRoyaltyVaultAddress(response.ipId!);
      result.royaltyVault = vaultAddress;
      this.log(`  Royalty Vault: ${vaultAddress}`);
    } catch (error: any) {
      this.log(`⚠️  Could not get royalty vault: ${error.message}`);
    }

    // Setup royalty split if Safe wallet configured
    if (this.config.safeWallet && result.royaltyVault) {
      await this.setupRoyaltySplit(response.ipId!, result.royaltyVault, commercialRevShare);
    }

    return result;
  }

  /**
   * Setup 18/82 royalty split
   * Transfers 82 royalty tokens to Safe multisig
   */
  private async setupRoyaltySplit(
    ipId: string,
    vaultAddress: string,
    creatorShare: number
  ): Promise<void> {
    if (!this.config.safeWallet) {
      return;
    }

    try {
      this.log(`Setting up ${creatorShare}/${100 - creatorShare} royalty split...`);

      // Transfer (100 - creatorShare) tokens to Safe
      await this.client.ipAccount.transferErc20({
        ipId,
        tokens: [
          {
            address: vaultAddress as Address,
            amount: 100 - creatorShare,
            target: this.config.safeWallet,
          },
        ],
      });

      this.log(`✓ Royalty Split: ${creatorShare}% creator, ${100 - creatorShare}% to Safe`);
    } catch (error: any) {
      this.log(`⚠️  Royalty split failed: ${error.message}`);
    }
  }

  /**
   * Build IPA metadata for a song
   */
  static buildSongMetadata(params: {
    title: string;
    description: string;
    artist: string;
    creatorName: string;
    creatorAddress: Address;
    imageUrl: string;
    imageHash: string;
    mediaUrl: string;
    mediaHash: string;
    tiktokUrl: string;
    spotifyUrl?: string;
    geniusUrl?: string;
    copyrightType: string;
    mlcData?: any;
    spotifyData?: any;
    geniusData?: any;
  }): IPAssetMetadata {
    return {
      title: params.title,
      description: params.description,
      createdAt: new Date().toISOString(),
      image: params.imageUrl,
      imageHash: params.imageHash,
      creators: [
        {
          name: params.creatorName,
          address: params.creatorAddress,
          contributionPercent: 18,
          role: 'derivative_performer',
          description: 'User-generated performance video creator',
        },
        {
          name: params.artist,
          address: zeroAddress,
          contributionPercent: 82,
          role: 'original_rights_holder',
          description: 'Original artist(s) and rights holder(s)',
        },
      ],
      mediaUrl: params.mediaUrl,
      mediaHash: params.mediaHash,
      mediaType: 'video/mp4',
      ipType: 'Music',
      tags: ['karaoke', 'cover', 'music', params.copyrightType],
      original_work: {
        title: params.title,
        primary_artists: [params.artist],
        isrc: params.spotifyData?.isrc || null,
        iswc: params.mlcData?.iswc || null,
        mlc_work_id: params.mlcData?.songCode || null,
        source_url: params.spotifyUrl || null,
        genius_url: params.geniusUrl || null,
      },
      rights_metadata: params.mlcData
        ? {
            mlc_data: {
              song_code: params.mlcData.songCode,
              title: params.mlcData.title,
              iswc: params.mlcData.iswc,
              total_publisher_share: params.mlcData.totalPublisherShare,
              writers: params.mlcData.writers || [],
              publishers: params.mlcData.publishers || [],
            },
            spotify_data: params.spotifyData || null,
            genius_data: params.geniusData || null,
          }
        : null,
      provenance: {
        created_at: new Date().toISOString(),
        uploader: params.creatorAddress,
        tiktok_url: params.tiktokUrl,
        copyright_type: params.copyrightType,
      },
    };
  }
}
