/**
 * Ollama EmbeddingGemma Service
 *
 * Provides embeddings via the local Ollama server running EmbeddingGemma.
 * Handles batching, error handling, and retries.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL_NAME = 'embeddinggemma:latest';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface EmbeddingResponse {
  embedding: number[];
}

interface BatchEmbeddingResult {
  text: string;
  embedding: number[] | null;
  error?: string;
}

/**
 * Compute embedding for a single text
 */
export async function computeEmbedding(
  text: string,
  retryCount = 0
): Promise<number[]> {
  if (!text || text.length === 0) {
    throw new Error('Text cannot be empty');
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: text.slice(0, 8000),  // Truncate to fit in context window
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as EmbeddingResponse;

    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response from Ollama');
    }

    return data.embedding;
  } catch (error: any) {
    if (retryCount < MAX_RETRIES) {
      console.warn(`   ⚠️  Retry ${retryCount + 1}/${MAX_RETRIES}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)));
      return computeEmbedding(text, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Compute embeddings for multiple texts in parallel
 * Handles errors gracefully and returns null for failed embeddings
 */
export async function computeBatchEmbeddings(
  texts: string[],
  concurrency = 5
): Promise<BatchEmbeddingResult[]> {
  const results: BatchEmbeddingResult[] = [];

  // Process in batches to avoid overwhelming Ollama
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (text) => {
        try {
          const embedding = await computeEmbedding(text);
          return { text, embedding };
        } catch (error: any) {
          return { text, embedding: null, error: error.message };
        }
      })
    );

    results.push(...batchResults);
  }

  return results;
}

/**
 * Check if Ollama server is running
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if EmbeddingGemma model is available
 */
export async function checkModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) return false;

    const data = await response.json();
    const models = data.models || [];

    return models.some((model: any) =>
      model.name === MODEL_NAME || model.name.startsWith('embeddinggemma')
    );
  } catch {
    return false;
  }
}

/**
 * Pull EmbeddingGemma model if not available
 */
export async function ensureModelAvailable(): Promise<void> {
  const available = await checkModelAvailable();
  if (available) {
    console.log('✅ EmbeddingGemma model is available');
    return;
  }

  console.log('📦 Pulling EmbeddingGemma model...');
  console.log('   This may take a few minutes (622MB download)\n');

  const proc = Bun.spawn(['ollama', 'pull', MODEL_NAME], {
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error('Failed to pull EmbeddingGemma model');
  }

  console.log('✅ Model ready\n');
}

/**
 * Get embedding dimension for EmbeddingGemma (768)
 */
export function getEmbeddingDimension(): number {
  return 768;
}
