import 'dotenv/config';

import { Graph, Ipfs, getCalldataForSpaceGovernanceType, getWalletClient } from '@graphprotocol/grc-20';
import { createPublicClient, http } from 'viem';

import {
  GEO_NETWORK,
  GEO_TESTNET_RPC_URL,
  GRC20_PROPERTY_IDS,
  GRC20_SPACE_ADDRESSES,
  GRC20_LEGACY_WORK_PROPERTIES,
} from '../../config/grc20-space';
import { query } from '../../db/connection';

interface MintedWorkRow {
  id: number;
  title: string;
  grc20_entity_id: string;
  iswc_source: string | null;
  release_date: string | null;
}

async function getMintedWorks(): Promise<MintedWorkRow[]> {
  return query<MintedWorkRow>(
    `
      SELECT id, title, grc20_entity_id, iswc_source, release_date::text
      FROM grc20_works
      WHERE grc20_entity_id IS NOT NULL
      ORDER BY id
    `,
  );
}

const ISWC_SOURCE_LABELS: Record<string, string> = {
  musicbrainz_work: 'MusicBrainz',
  wikidata_work: 'Wikidata',
  quansic: 'Quansic',
  mlc: 'MLC',
};

function formatIswcSource(source: string | null): string | null {
  if (!source) return null;
  return ISWC_SOURCE_LABELS[source] ?? source;
}

function formatReleaseDate(dateValue: string | null): string | null {
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateValue;
  }
}

async function submitOps(
  label: string,
  ops: ReturnType<typeof Graph.createEntity>['ops'],
  walletClient: Awaited<ReturnType<typeof getWalletClient>>,
  publicClient: ReturnType<typeof createPublicClient>,
) {
  if (!ops.length) {
    console.log('ℹ️  Nothing to submit');
    return;
  }

  const author = walletClient.account.address;
  const { cid } = await Ipfs.publishEdit({
    name: label,
    ops,
    author,
    network: GEO_NETWORK,
  });

  const calldata = getCalldataForSpaceGovernanceType({
    type: 'PERSONAL',
    cid,
    spacePluginAddress: GRC20_SPACE_ADDRESSES.space,
  });

  const hash = await walletClient.sendTransaction({
    account: walletClient.account,
    to: GRC20_SPACE_ADDRESSES.plugin,
    data: calldata,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ ${label} → ${cid} (${hash})`);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required');
  }

  const walletClient = await getWalletClient({ privateKey, rpcUrl: GEO_TESTNET_RPC_URL });
  const publicClient = createPublicClient({
    chain: walletClient.chain,
    transport: http(GEO_TESTNET_RPC_URL),
  });

  console.log('➡️  Loading minted works');
  const works = await getMintedWorks();

  const ops: ReturnType<typeof Graph.createEntity>['ops'] = [];

  for (const work of works) {
    const recordProps = [...GRC20_LEGACY_WORK_PROPERTIES];
    const { ops: unsetOps } = Graph.unsetEntityValues({
      id: work.grc20_entity_id,
      properties: recordProps,
    });
    if (unsetOps.length) {
      ops.push(...unsetOps);
      console.log(`   → queueing recording field cleanup for #${work.id} ${work.title}`);
    }

    const friendlySource = formatIswcSource(work.iswc_source);
    if (friendlySource && friendlySource !== work.iswc_source) {
      const { ops: updateOps } = Graph.updateEntity({
        id: work.grc20_entity_id,
        values: [
          {
            property: GRC20_PROPERTY_IDS.workIswcSource,
            value: friendlySource,
          },
        ],
      });
      ops.push(...updateOps);
      console.log(`   → normalizing ISWC source for #${work.id} ${work.title} → ${friendlySource}`);
    }

    const formattedDate = formatReleaseDate(work.release_date);
    if (formattedDate) {
      const { ops: dateOps } = Graph.updateEntity({
        id: work.grc20_entity_id,
        values: [
          {
            property: GRC20_PROPERTY_IDS.workReleaseDate,
            value: formattedDate,
          },
        ],
      });
      ops.push(...dateOps);
      console.log(`   → formatting release date for #${work.id} ${work.title} → ${formattedDate}`);
    }
  }

  if (!ops.length) {
    console.log('ℹ️  No recording fields or ISWC sources required updates');
    return;
  }

  await submitOps('Normalize GRC-20 work metadata', ops, walletClient, publicClient);
  console.log('✅ Completed work metadata cleanup');
}

main().catch(error => {
  console.error('❌ Failed to sanitize GRC-20 work entities');
  console.error(error);
  process.exit(1);
});
