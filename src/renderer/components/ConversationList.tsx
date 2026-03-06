import type { AISession } from '../../core/storage/schema';
import { SN_THEME } from '../theme';

/**
 * T047: Sidebar list of saved/recent conversations
 */

interface ConversationListProps {
  sessions: AISession[];
  activeSessionId?: string | undefined;
  onSelect: (session: AISession) => void;
  onNew: () => void;
  onDelete?: ((sessionId: string) => void) | undefined;
  width?: number | undefined;
}

export function ConversationList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  width = 220,
}: ConversationListProps) {
  return (
    <aside
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9fafb',
        overflow: 'hidden',
      }}
      aria-label="Conversation history"
    >
      <div style={{ padding: '12px' }}>
        <button
          type="button"
          onClick={onNew}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: SN_THEME.primaryButton,
            color: SN_THEME.primaryButtonText,
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.length === 0 ? (
          <p style={{ padding: '12px', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
            No conversations yet
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 8px' }}>
            {sessions.map((session) => (
              <li key={session.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: session.id === activeSessionId ? '#d1fae5' : 'transparent',
                    border: session.id === activeSessionId ? '1px solid #a7f3d0' : '1px solid transparent',
                    marginBottom: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(session)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                    }}
                    aria-current={session.id === activeSessionId ? 'true' : undefined}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                      {session.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                      {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                      {session.isSaved && <span style={{ marginLeft: '4px', color: SN_THEME.navActiveBackground }}>●</span>}
                    </div>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        fontSize: '0.75rem',
                        padding: '2px 4px',
                        lineHeight: 1,
                      }}
                      aria-label={`Delete conversation: ${session.title}`}
                      title="Delete"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export default ConversationList;
