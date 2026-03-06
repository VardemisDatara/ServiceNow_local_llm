import { useState, useEffect, useRef } from 'react';
import { Chat } from '../components/Chat';
import { ConversationList } from '../components/ConversationList';
import { createSession } from '../../core/services/chat';
import { startSessionCleanup } from '../../core/services/session-manager';
import { aiSessionRepository } from '../../core/storage/repositories/session';
import type { AISession } from '../../core/storage/schema';
import { useActiveProfile } from '../store/index';
import { logger } from '../../utils/logger';

/**
 * Chat page — orchestrates session management and the Chat UI
 */

export function ChatPage() {
  const activeProfile = useActiveProfile();
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [activeSession, setActiveSession] = useState<AISession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const isResizing = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.min(Math.max(e.clientX, 150), 450));
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

  // Start session cleanup on mount
  useEffect(() => {
    startSessionCleanup();
  }, []);

  // Load sessions when profile changes
  useEffect(() => {
    if (!activeProfile) {
      setLoading(false);
      return;
    }
    void loadSessions(activeProfile.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  async function loadSessions(configId: string) {
    setLoading(true);
    try {
      const all = await aiSessionRepository.findByConfigId(configId);
      setSessions(all);
      // Auto-select the most recent session, or create one if none exist
      if (all.length > 0) {
        setActiveSession(all[0] ?? null);
      } else {
        await handleNewChat();
      }
    } catch (err) {
      logger.error('Failed to load sessions', {}, err as Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewChat() {
    if (!activeProfile) return;
    try {
      const session = await createSession(activeProfile.id, 'New Conversation', activeProfile.sessionTimeoutHours);
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
    } catch (err) {
      logger.error('Failed to create session', {}, err as Error);
    }
  }

  function handleSelectSession(session: AISession) {
    setActiveSession(session);
  }

  function handleSessionUpdate(updated: AISession) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (activeSession?.id === updated.id) {
      setActiveSession(updated);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      await aiSessionRepository.delete(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSession(remaining[0] ?? null);
        } else if (activeProfile) {
          await handleNewChat();
        } else {
          setActiveSession(null);
        }
      }
    } catch (err) {
      logger.error('Failed to delete session', { sessionId }, err as Error);
    }
  }

  if (!activeProfile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <p style={{ fontSize: '1rem', marginBottom: '8px' }}>No active profile configured.</p>
          <p style={{ fontSize: '0.875rem' }}>Go to <strong>Settings</strong> to create a profile first.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ color: '#6b7280' }}>Loading conversations…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <ConversationList
        sessions={sessions}
        activeSessionId={activeSession?.id}
        onSelect={handleSelectSession}
        onNew={() => void handleNewChat()}
        onDelete={(id) => void handleDeleteSession(id)}
        width={sidebarWidth}
      />

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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeSession ? (
          <Chat session={activeSession} onSessionUpdate={handleSessionUpdate} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
            <p>Select or create a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
