import { useState, useEffect, useRef } from 'react';
import { aiSessionRepository } from '../../core/storage/repositories/session';
import { conversationMessageRepository } from '../../core/storage/repositories/message';
import type { AISession, ConversationMessage } from '../../core/storage/schema';
import { Message } from '../components/Message';
import { logger } from '../../utils/logger';

/**
 * T057: Conversation history review page — browse and manage saved conversations
 */

export function History() {
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [selectedSession, setSelectedSession] = useState<AISession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.min(Math.max(e.clientX, 160), 500));
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    void loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const saved = await aiSessionRepository.findSaved();
      setSessions(saved);
    } catch (err) {
      logger.error('Failed to load history', {}, err as Error);
    } finally {
      setLoading(false);
    }
  }

  async function selectSession(session: AISession) {
    setSelectedSession(session);
    try {
      const msgs = await conversationMessageRepository.findBySessionId(session.id);
      setMessages(msgs);
    } catch (err) {
      logger.error('Failed to load messages', { sessionId: session.id }, err as Error);
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      await aiSessionRepository.delete(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setMessages([]);
      }
      setDeleteConfirm(null);
    } catch (err) {
      logger.error('Failed to delete session', { sessionId }, err as Error);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Session list */}
      <aside
        style={{
          width: `${sidebarWidth}px`,
          minWidth: `${sidebarWidth}px`,
          overflowY: 'auto',
          padding: '16px',
          flexShrink: 0,
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginTop: 0, marginBottom: '16px' }}>
          Saved Conversations
        </h2>

        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading…</p>
        ) : sessions.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No saved conversations yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sessions.map((session) => (
              <li key={session.id} style={{ marginBottom: '8px' }}>
                <div
                  style={{
                    padding: '10px',
                    border: `1px solid ${selectedSession?.id === session.id ? '#a7f3d0' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    backgroundColor: selectedSession?.id === session.id ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void selectSession(session)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', padding: 0 }}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>
                      {session.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {session.messageCount} messages ·{' '}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </div>
                  </button>

                  {deleteConfirm === session.id ? (
                    <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => void handleDelete(session.id)}
                        style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(session.id); }}
                      style={{ marginTop: '4px', fontSize: '0.7rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Drag-to-resize divider */}
      <div
        onMouseDown={(e) => {
          isResizing.current = true;
          e.preventDefault();
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        style={{
          width: '5px',
          flexShrink: 0,
          cursor: 'col-resize',
          backgroundColor: '#e5e7eb',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; }}
        onMouseLeave={(e) => { if (!isResizing.current) e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
        title="Drag to resize"
      />

      {/* Message viewer */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }} role="main">
        {!selectedSession ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            <p>Select a conversation to view its messages</p>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginTop: 0, marginBottom: '16px' }}>
              {selectedSession.title}
            </h3>
            {messages.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No messages in this conversation.</p>
            ) : (
              messages.map((msg) => <Message key={msg.id} message={msg} />)
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default History;
