/**
 * DeepInfra Embedding Service
 * Model: google/embeddinggemma-300m (768 dimensions)
 * API: https://deepinfra.com/google/embeddinggemma-300m
 */

interface EmbeddingResponse {
  embeddings: number[][];
  input_tokens: number;
  embedding_jsons?: string[];
  request_id?: string;
  inference_status?: {
    status: string;
    runtime_ms: number;
    cost: number;
    tokens_generated: number;
    tokens_input: number;
  };
}

interface EmbeddingOptions {
  normalize?: boolean;
  dimensions?: number;
  customInstruction?: string;
}

export class DeepInfraEmbeddingService {
  private apiKey: string;
  private baseUrl = 'https://api.deepinfra.com/v1/inference';
  private model = 'google/embeddinggemma-300m';
  private maxBatchSize = 100;
  private maxRetries = 3;
  private retryDelayMs = 1000;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPINFRA_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('DEEPINFRA_API_KEY is required');
    }
  }

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const result = await this.embedBatch([text], options);
    return result[0];
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (texts.length > this.maxBatchSize) {
      const chunks: string[][] = [];
      for (let i = 0; i < texts.length; i += this.maxBatchSize) {
        chunks.push(texts.slice(i, i + this.maxBatchSize));
      }
      const results: number[][][] = [];
      for (const chunk of chunks) {
        const chunkResult = await this.embedBatch(chunk, options);
        results.push(chunkResult);
      }
      return results.flat();
    }

    const body: any = { inputs: texts };
    if (options?.normalize !== undefined) body.normalize = options.normalize;
    if (options?.customInstruction) body.custom_instruction = options.customInstruction;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/${this.model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DeepInfra API error (${response.status}): ${errorText}`);
        }

        const data: EmbeddingResponse = await response.json();
        if (!data.embeddings || data.embeddings.length === 0) {
          throw new Error('No embeddings returned from API');
        }

        if (data.input_tokens) {
          console.log(`[DeepInfra] Generated ${data.embeddings.length} embeddings (${data.input_tokens} tokens)`);
        }

        return data.embeddings;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[DeepInfra] Attempt ${attempt + 1}/${this.maxRetries} failed:`, error);
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  async embedLyrics(lyrics: string): Promise<number[]> {
    const processed = this.preprocessLyrics(lyrics);
    return this.embed(processed, {
      normalize: true,
      customInstruction: 'Given song lyrics, retrieve semantically similar songs',
    });
  }

  async embedLyricsBatch(
    lyricsArray: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<number[][]> {
    const processed = lyricsArray.map((lyrics) => this.preprocessLyrics(lyrics));
    const results: number[][] = [];
    for (let i = 0; i < processed.length; i += this.maxBatchSize) {
      const batch = processed.slice(i, i + this.maxBatchSize);
      const batchResults = await this.embedBatch(batch, {
        normalize: true,
        customInstruction: 'Given song lyrics, retrieve semantically similar songs',
      });
      results.push(...batchResults);
      if (onProgress) {
        onProgress(Math.min(i + this.maxBatchSize, processed.length), processed.length);
      }
    }
    return results;
  }

  private preprocessLyrics(lyrics: string): string {
    return lyrics
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 8000);
  }

  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getDimensions(): number { return 768; }
  getModel(): string { return this.model; }
}

export const deepInfraEmbedding = new DeepInfraEmbeddingService();
