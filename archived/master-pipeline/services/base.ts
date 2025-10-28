/**
 * Base Service Class
 *
 * Abstract base for all external API services (ElevenLabs, OpenRouter, Voxstral, etc.)
 * Provides common functionality like error handling, rate limiting, retries
 */

export interface ServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export abstract class BaseService {
  protected config: ServiceConfig;
  protected serviceName: string;

  constructor(serviceName: string, config: ServiceConfig = {}) {
    this.serviceName = serviceName;
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= (this.config.maxRetries || 3); attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeout || 30000
        );

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(
            `${this.serviceName} API error: ${response.status} - ${await response.text()}`
          );
        }

        return (await response.json()) as T;
      } catch (error: any) {
        lastError = error;
        console.error(
          `[${this.serviceName}] Attempt ${attempt}/${this.config.maxRetries} failed:`,
          error.message
        );

        if (attempt < (this.config.maxRetries || 3)) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `${this.serviceName} request failed after ${this.config.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Validate API key is present
   */
  protected requireApiKey(): string {
    if (!this.config.apiKey) {
      throw new Error(
        `${this.serviceName} API key not configured. Set ${this.serviceName.toUpperCase()}_API_KEY environment variable.`
      );
    }
    return this.config.apiKey;
  }

  /**
   * Log service activity
   */
  protected log(message: string, ...args: any[]) {
    console.log(`[${this.serviceName}]`, message, ...args);
  }
}
