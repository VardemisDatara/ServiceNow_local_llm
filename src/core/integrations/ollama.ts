import { logger, PerformanceLogger } from '../../utils/logger';
import { OllamaError, ErrorCode } from '../../utils/errors';

/**
 * Ollama API Client
 * Provides interface to local Ollama instance for LLM inference
 */

// ============================================================================
// Types
// ============================================================================

export interface OllamaConfig {
  endpoint: string; // e.g., "http://localhost:11434"
  timeout?: number; // milliseconds, default 30000
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 encoded images
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaHealthResponse {
  status: 'ok' | 'error';
  version?: string;
}

// ============================================================================
// Ollama Client
// ============================================================================

export class OllamaClient {
  private config: Required<OllamaConfig>;

  constructor(config: OllamaConfig) {
    this.config = {
      endpoint: config.endpoint,
      timeout: config.timeout ?? 30000,
    };

    logger.info('Ollama client initialized', {
      endpoint: this.config.endpoint,
    });
  }

  /**
   * Test connection to Ollama instance
   */
  async healthCheck(): Promise<OllamaHealthResponse> {
    const perf = new PerformanceLogger(logger, 'Ollama health check');

    try {
      const response = await this.fetch('/api/version', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new OllamaError(
          ErrorCode.OLLAMA_CONNECTION_FAILED,
          `Health check failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      perf.end({ status: 'ok' });

      return {
        status: 'ok',
        version: data.version,
      };
    } catch (error) {
      perf.endWithError(error as Error);

      if (error instanceof OllamaError) {
        throw error;
      }

      throw new OllamaError(
        ErrorCode.OLLAMA_CONNECTION_FAILED,
        'Failed to connect to Ollama',
        undefined,
        error as Error
      );
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    const perf = new PerformanceLogger(logger, 'Ollama list models');

    try {
      const response = await this.fetch('/api/tags', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new OllamaError(
          ErrorCode.OLLAMA_CONNECTION_FAILED,
          `Failed to list models: ${response.status}`
        );
      }

      const data = await response.json();
      const models = data.models || [];

      perf.end({ modelCount: models.length });
      return models;
    } catch (error) {
      perf.endWithError(error as Error);

      if (error instanceof OllamaError) {
        throw error;
      }

      throw new OllamaError(
        ErrorCode.OLLAMA_CONNECTION_FAILED,
        'Failed to list models',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Check if a specific model is available
   */
  async hasModel(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some((m) => m.name === modelName);
    } catch (error) {
      logger.warn('Failed to check model availability', { modelName }, error as Error);
      return false;
    }
  }

  /**
   * Generate completion (non-streaming)
   */
  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const perf = new PerformanceLogger(logger, 'Ollama generate');

    try {
      const response = await this.fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
      });

      if (!response.ok) {
        throw new OllamaError(
          ErrorCode.OLLAMA_INFERENCE_FAILED,
          `Generation failed: ${response.status}`,
          { model: request.model }
        );
      }

      const data = await response.json();
      perf.end({
        model: request.model,
        responseLength: data.response?.length,
        evalCount: data.eval_count,
      });

      return data;
    } catch (error) {
      perf.endWithError(error as Error, { model: request.model });

      if (error instanceof OllamaError) {
        throw error;
      }

      throw new OllamaError(
        ErrorCode.OLLAMA_INFERENCE_FAILED,
        'Failed to generate completion',
        { model: request.model },
        error as Error
      );
    }
  }

  /**
   * Chat completion (non-streaming)
   */
  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const perf = new PerformanceLogger(logger, 'Ollama chat');

    try {
      const response = await this.fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, stream: false }),
      });

      if (!response.ok) {
        throw new OllamaError(
          ErrorCode.OLLAMA_INFERENCE_FAILED,
          `Chat failed: ${response.status}`,
          { model: request.model }
        );
      }

      const data = await response.json();
      perf.end({
        model: request.model,
        messageCount: request.messages.length,
        evalCount: data.eval_count,
      });

      return data;
    } catch (error) {
      perf.endWithError(error as Error, { model: request.model });

      if (error instanceof OllamaError) {
        throw error;
      }

      throw new OllamaError(
        ErrorCode.OLLAMA_INFERENCE_FAILED,
        'Failed to complete chat',
        { model: request.model },
        error as Error
      );
    }
  }

  /**
   * Pull a model from Ollama library
   */
  async pullModel(modelName: string): Promise<void> {
    logger.info('Pulling model', { modelName });

    try {
      const response = await this.fetch('/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false }),
      });

      if (!response.ok) {
        throw new OllamaError(
          ErrorCode.OLLAMA_MODEL_NOT_FOUND,
          `Failed to pull model: ${response.status}`,
          { modelName }
        );
      }

      logger.info('Model pulled successfully', { modelName });
    } catch (error) {
      logger.error('Failed to pull model', { modelName }, error as Error);

      if (error instanceof OllamaError) {
        throw error;
      }

      throw new OllamaError(
        ErrorCode.OLLAMA_MODEL_NOT_FOUND,
        'Failed to pull model',
        { modelName },
        error as Error
      );
    }
  }

  /**
   * Internal fetch wrapper with timeout
   */
  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.config.endpoint}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new OllamaError(
          ErrorCode.OLLAMA_TIMEOUT,
          `Request timed out after ${this.config.timeout}ms`,
          { url, timeout: this.config.timeout }
        );
      }

      throw error;
    }
  }

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<OllamaConfig>): void {
    if (config.endpoint) {
      this.config.endpoint = config.endpoint;
    }
    if (config.timeout !== undefined) {
      this.config.timeout = config.timeout;
    }

    logger.info('Ollama client config updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): OllamaConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Ollama client instance
 */
export function createOllamaClient(config: OllamaConfig): OllamaClient {
  return new OllamaClient(config);
}

// Export singleton instance (can be reconfigured)
export let ollamaClient: OllamaClient | null = null;

/**
 * Initialize the global Ollama client
 */
export function initializeOllamaClient(config: OllamaConfig): OllamaClient {
  ollamaClient = new OllamaClient(config);
  return ollamaClient;
}

/**
 * Get the global Ollama client
 */
export function getOllamaClient(): OllamaClient {
  if (!ollamaClient) {
    throw new OllamaError(
      ErrorCode.OLLAMA_CONNECTION_FAILED,
      'Ollama client not initialized. Call initializeOllamaClient() first.'
    );
  }
  return ollamaClient;
}
