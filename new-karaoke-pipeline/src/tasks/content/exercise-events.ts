import { ethers } from 'ethers';
import ExerciseEventsArtifact from '../../../../contracts/out/ExerciseEvents.sol/ExerciseEvents.json' assert { type: 'json' };
import { EXERCISE_EVENTS_ADDRESS, LENS_TESTNET_RPC } from '../../../../lit-actions/config/contracts.config.js';
import { GroveService } from '../../services/grove';

const groveService = new GroveService();
let exerciseEventsContract: ethers.Contract | null = null;

function isAddressConfigured(address?: string): boolean {
  if (!address) {
    return false;
  }

  try {
    const normalized = ethers.getAddress(address);
    return normalized !== ethers.ZeroAddress;
  } catch (error) {
    return false;
  }
}

export const exerciseEventsEnabled = isAddressConfigured(EXERCISE_EVENTS_ADDRESS);

function getFormattedPrivateKey(): `0x${string}` {
  const rawKey = process.env.PRIVATE_KEY?.trim();
  if (!rawKey) {
    throw new Error('PRIVATE_KEY environment variable required for ExerciseEvents emissions');
  }

  return (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
}

function getExerciseEventsContract(): ethers.Contract {
  if (!exerciseEventsEnabled) {
    throw new Error('ExerciseEvents address not configured');
  }

  if (exerciseEventsContract) {
    return exerciseEventsContract;
  }

  const provider = new ethers.JsonRpcProvider(LENS_TESTNET_RPC);
  const wallet = new ethers.Wallet(getFormattedPrivateKey(), provider);

  exerciseEventsContract = new ethers.Contract(
    EXERCISE_EVENTS_ADDRESS,
    ExerciseEventsArtifact.abi,
    wallet
  );

  return exerciseEventsContract;
}

export function uuidToBytes32(uuid: string): string {
  const normalized = uuid.replace(/-/g, '').toLowerCase();
  if (normalized.length !== 32) {
    throw new Error(`Invalid UUID length for conversion: ${uuid}`);
  }

  return ethers.zeroPadValue(`0x${normalized}`, 32);
}

export function bufferToHex(value: Buffer | Uint8Array | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return value as string;
    }
    if (value.startsWith('\\x')) {
      return `0x${value.slice(2)}`;
    }
    return `0x${value}`;
  }

  if (value instanceof Uint8Array) {
    return `0x${Buffer.from(value).toString('hex')}`;
  }

  if (Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`;
  }

  return null;
}

export async function uploadExerciseMetadata(
  fileName: string,
  payload: Record<string, unknown>
): Promise<string> {
  const buffer = Buffer.from(JSON.stringify(payload));
  const uploadResult = await groveService.uploadFile(buffer, fileName, 'application/json');
  return uploadResult.url;
}

export interface TranslationQuestionOnChainPayload {
  questionUuid: string;
  lineUuid: string;
  segmentHash: string;
  lineIndex: number;
  spotifyTrackId: string;
  languageCode: string;
  metadataUri: string;
  distractorPoolSize: number;
}

export async function emitTranslationQuestionOnChain(payload: TranslationQuestionOnChainPayload): Promise<void> {
  if (!exerciseEventsEnabled) {
    return;
  }

  const contract = getExerciseEventsContract();
  const tx = await contract.emitTranslationQuestionRegistered(
    uuidToBytes32(payload.questionUuid),
    uuidToBytes32(payload.lineUuid),
    payload.segmentHash,
    payload.spotifyTrackId,
    payload.lineIndex,
    payload.languageCode,
    payload.metadataUri,
    payload.distractorPoolSize
  );

  const receipt = await tx.wait();
  console.log(`      ✅ TranslationQuestionRegistered -> tx ${receipt.transactionHash}`);
}

export interface TriviaQuestionOnChainPayload {
  questionUuid: string;
  spotifyTrackId: string;
  languageCode: string;
  metadataUri: string;
  distractorPoolSize: number;
}

export async function emitTriviaQuestionOnChain(payload: TriviaQuestionOnChainPayload): Promise<void> {
  if (!exerciseEventsEnabled) {
    return;
  }

  const contract = getExerciseEventsContract();
  const tx = await contract.emitTriviaQuestionRegistered(
    uuidToBytes32(payload.questionUuid),
    payload.spotifyTrackId,
    payload.languageCode,
    payload.metadataUri,
    payload.distractorPoolSize
  );

  const receipt = await tx.wait();
  console.log(`      ✅ TriviaQuestionRegistered -> tx ${receipt.transactionHash}`);
}

export async function toggleExerciseQuestion(questionUuid: string, enabled: boolean): Promise<void> {
  if (!exerciseEventsEnabled) {
    return;
  }

  const contract = getExerciseEventsContract();
  const tx = await contract.toggleQuestion(uuidToBytes32(questionUuid), enabled);
  const receipt = await tx.wait();
  console.log(`      ✅ Question toggled (${questionUuid}) -> ${enabled} (tx ${receipt.transactionHash})`);
}
