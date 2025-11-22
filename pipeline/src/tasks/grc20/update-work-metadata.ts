import 'dotenv/config';

import { Graph, Ipfs, getCalldataForSpaceGovernanceType, getWalletClient } from '@graphprotocol/grc-20';
import { createPublicClient, http } from 'viem';

import {
  GEO_NETWORK,
  GEO_TESTNET_RPC_URL,
  GRC20_SPACE_ADDRESSES,
  GRC20_LEGACY_WORK_PROPERTIES,
} from '../../config/grc20-space';
import { query } from '../../db/connection';
import {
  WORK_MANAGED_PROPERTY_IDS,
  WorkMetadataRow,
  buildWorkValues,
} from './utils/work-values';

type MintedWorkRow = WorkMetadataRow & { grc20_entity_id: string };

async function getMintedWorks(): Promise<MintedWorkRow[]> {
  return query<MintedWorkRow>(
    `
      SELECT
        id,
        title,
        alternate_titles,
        iswc,
        iswc_source,
        genius_song_id,
        genius_url,
        wikidata_url,
        release_date::text as release_date,
        duration_ms,
        language,
        image_grove_url,
        grc20_entity_id
      FROM grc20_works
      WHERE grc20_entity_id IS NOT NULL
        AND needs_update = TRUE
      ORDER BY id
    `,
  );
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
    const values = buildWorkValues(work);
    const managedSet = new Set(values.map(v => v.property));
    const unset = WORK_MANAGED_PROPERTY_IDS.filter(id => !managedSet.has(id));

    if (unset.length) {
      const { ops: unsetOps } = Graph.unsetEntityValues({
        id: work.grc20_entity_id,
        properties: unset,
      });
      ops.push(...unsetOps);
    }

    if (GRC20_LEGACY_WORK_PROPERTIES.length) {
      const { ops: legacyOps } = Graph.unsetEntityValues({
        id: work.grc20_entity_id,
        properties: [...GRC20_LEGACY_WORK_PROPERTIES],
      });
      ops.push(...legacyOps);
    }

    if (values.length) {
      const { ops: updateOps } = Graph.updateEntity({
        id: work.grc20_entity_id,
        values,
      });
      ops.push(...updateOps);
      console.log(`   → queued metadata refresh for #${work.id} ${work.title}`);
    }
  }

  await submitOps('Update work metadata', ops, walletClient, publicClient);
  console.log('✅ Completed work metadata refresh');
}

main().catch(error => {
  console.error('❌ Failed to update work metadata');
  console.error(error);
  process.exit(1);
});
