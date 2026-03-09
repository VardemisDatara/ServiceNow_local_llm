import { useState, useEffect, useRef, useCallback } from 'react';
import type { AISession, ConversationMessage } from '../../core/storage/schema';
import { conversationMessageRepository } from '../../core/storage/repositories/message';
import { aiSessionRepository } from '../../core/storage/repositories/session';
import { sendMessage, saveConversation } from '../../core/services/chat';
import { classifyError } from '../../core/services/error-recovery';
import { testOllamaConnection } from '../../core/services/connection-test';
import { useActiveProfile } from '../store/index';
import { Message } from './Message';
import { ProgressIndicator } from './ProgressIndicator';
import { logger } from '../../utils/logger';

/**
 * T045 + T054: Main Chat UI component with streaming and conversation persistence
 */

interface ChatProps {
  session: AISession;
  onSessionUpdate?: ((session: AISession) => void) | undefined;
}

export function Chat({ session, onSessionUpdate }: ChatProps) {
  const activeProfile = useActiveProfile();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(activeProfile?.ollamaModel ?? '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load messages for this session
  useEffect(() => {
    setLoadingMessages(true);
    conversationMessageRepository.findBySessionId(session.id)
      .then(setMessages)
      .catch((err) => logger.error('Failed to load messages', { sessionId: session.id }, err as Error))
      .finally(() => setLoadingMessages(false));
  }, [session.id]);

  // Sync selectedModel when active profile changes
  useEffect(() => {
    setSelectedModel(activeProfile?.ollamaModel ?? '');
  }, [activeProfile?.ollamaModel]);

  // Fetch available models from Ollama on mount
  useEffect(() => {
    if (!activeProfile?.ollamaEndpoint) return;
    testOllamaConnection(activeProfile.ollamaEndpoint)
      .then((result) => {
        if (result.success && result.models && result.models.length > 0) {
          setAvailableModels(result.models);
        }
      })
      .catch(() => null);
  }, [activeProfile?.ollamaEndpoint]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;
    if (!activeProfile) {
      setError({ title: 'No Profile', message: 'Please configure a profile in Settings first.' });
      return;
    }

    setInput('');
    setError(null);
    setStreamingContent('');
    setIsStreaming(true);

    // Optimistically add user message to UI
    const optimisticUser: ConversationMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId: session.id,
      sender: 'user',
      content,
      timestamp: new Date(),
      sequenceNumber: messages.length + 1,
      metadata: null,
    };
    setMessages((prev) => [...prev, optimisticUser]);

    // Optimistic AI message placeholder — sender reflects the active LLM provider
    const activeLLMProvider = (activeProfile.llmProvider ?? 'ollama') as ConversationMessage['sender'];
    const optimisticAi: ConversationMessage = {
      id: `temp-ai-${Date.now()}`,
      sessionId: session.id,
      sender: activeLLMProvider,
      content: '',
      timestamp: new Date(),
      sequenceNumber: messages.length + 2,
      metadata: null,
    };
    setMessages((prev) => [...prev, optimisticAi]);

    let accumulatedTokens = '';

    try {
      const llmProvider = activeProfile.llmProvider ?? 'ollama';
      const cloudModel =
        activeProfile.cloudLlmModel ??
        (llmProvider === 'openai' ? 'gpt-4o-mini' : 'mistral-small-latest');

      await sendMessage({
        sessionId: session.id,
        content,
        ollamaEndpoint: activeProfile.ollamaEndpoint,
        ollamaModel: selectedModel || activeProfile.ollamaModel,
        onToken: (token) => {
          accumulatedTokens += token;
          setStreamingContent(accumulatedTokens);
          // Update the AI placeholder message in real time
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticAi.id ? { ...m, content: accumulatedTokens } : m
            )
          );
        },
        onDone: () => {
          setStreamingContent('');
          setIsStreaming(false);
        },
        onError: (msg) => {
          const classified = classifyError(new Error(msg));
          setError(classified);
          setIsStreaming(false);
          setStreamingContent('');
          // Remove the optimistic AI placeholder on error
          setMessages((prev) => prev.filter((m) => m.id !== optimisticAi.id));
        },
        persist: true,
        searchContext: { provider: activeProfile.searchProvider, profileId: activeProfile.id },
        // LLM provider context — routes to cloud API when provider is openai/mistral (T112)
        llmContext: {
          provider: llmProvider,
          profileId: activeProfile.id,
          model: cloudModel,
        },
        // Pass MCP context to enable tool calling when ServiceNow is configured
        ...(activeProfile.servicenowUrl
          ? {
              mcpContext: {
                profileId: activeProfile.id,
                servicenowUrl: activeProfile.servicenowUrl,
                ollamaEndpoint: activeProfile.ollamaEndpoint,
                ollamaModel: selectedModel || activeProfile.ollamaModel,
              },
            }
          : {}),
      });
      // Reload from DB after sendMessage fully resolves (search augmentation + write complete)
      void conversationMessageRepository.findBySessionId(session.id)
        .then(setMessages)
        .catch(() => null);
      void aiSessionRepository.findById(session.id)
        .then((s) => { if (s) onSessionUpdate?.(s); })
        .catch(() => null);
    } catch (err) {
      const classified = classifyError(err);
      setError(classified);
      setIsStreaming(false);
      setStreamingContent('');
      setMessages((prev) => prev.filter((m) => m.id === optimisticUser.id || !m.id.startsWith('temp-')));
    }
  }, [input, isStreaming, activeProfile, session.id, messages.length, onSessionUpdate, selectedModel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const saved = await saveConversation(session.id, session.title);
      onSessionUpdate?.(saved);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('idle');
      setError(classifyError(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff' }}>
      {/* Chat header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{session.title}</span>
          {activeProfile && (
            availableModels.length > 1 ? (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isStreaming}
                style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                }}
                aria-label="Select model"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {selectedModel || activeProfile.ollamaModel}
              </span>
            )
          )}
        </div>
        {!session.isSaved && (
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveStatus === 'saving' || messages.length === 0}
            style={{
              padding: '4px 10px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid #d1d5db',
              borderRadius: '5px',
              backgroundColor: saveStatus === 'saved' ? '#d1fae5' : '#f9fafb',
              color: saveStatus === 'saved' ? '#065f46' : '#374151',
              cursor: 'pointer',
            }}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : '💾 Save'}
          </button>
        )}
        {session.isSaved && (
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✓ Saved</span>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '16px' }}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {loadingMessages ? (
          <p style={{ color: '#9ca3af', textAlign: 'center' }}>Loading messages…</p>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Start a conversation</p>
            <p style={{ fontSize: '0.875rem' }}>Ask Ollama anything…</p>
          </div>
        ) : (
          messages.map((msg) => (
            <Message
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && msg.id.startsWith('temp-ai-')}
            />
          ))
        )}

        {isStreaming && streamingContent === '' && (
          <ProgressIndicator
            label={
              activeProfile?.llmProvider === 'openai' ? 'OpenAI is thinking…' :
              activeProfile?.llmProvider === 'mistral' ? 'Mistral is thinking…' :
              'Ollama is thinking…'
            }
          />
        )}

        {error && (
          <div
            role="alert"
            style={{
              margin: '8px 0',
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.875rem',
            }}
          >
            <strong>{error.title}:</strong> {error.message}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        {!activeProfile && (
          <p style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '8px' }}>
            Configure a profile in Settings to start chatting.
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Waiting for response…' : 'Type a message… (Enter to send, Shift+Enter for newline)'}
            disabled={isStreaming || !activeProfile}
            rows={3}
            style={{
              flex: 1,
              resize: 'none',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#111827',
              backgroundColor: isStreaming ? '#f9fafb' : '#ffffff',
              outline: 'none',
            }}
            aria-label="Message input"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming || !activeProfile}
            style={{
              padding: '8px 16px',
              backgroundColor: !input.trim() || isStreaming ? '#d1d5db' : '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: !input.trim() || isStreaming ? 'not-allowed' : 'pointer',
              minWidth: '70px',
            }}
            aria-label="Send message"
          >
            {isStreaming ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
