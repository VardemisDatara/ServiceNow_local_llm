/**
 * T109: LLM Provider interface
 * Unified abstraction for local (Ollama) and cloud (OpenAI, Mistral) language models
 */

export type LLMProviderName = 'ollama' | 'openai' | 'mistral';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMStreamCallbacks {
  onToken: (token: string) => void;
  onDone: (totalMs: number) => void;
  onError: (message: string) => void;
}

/** Context for routing to the correct LLM provider in chat.ts */
export interface LLMContext {
  provider: LLMProviderName;
  profileId: string;
  /** Cloud model name (e.g. 'gpt-4o-mini', 'mistral-small-latest'). Unused for Ollama. */
  model: string;
}

/** Interface for cloud LLM streaming providers (OpenAI, Mistral) */
export interface CloudLLMProvider {
  name: LLMProviderName;
  defaultModel: string;
  availableModels: readonly string[];
  stream(
    messages: LLMMessage[],
    model: string,
    apiKey: string,
    callbacks: LLMStreamCallbacks,
  ): Promise<void>;
}
