/**
 * T097: Real-time workflow progress display component
 * Shows step-by-step progress for security analysis workflows
 */

export type WorkflowStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
};

interface WorkflowProgressProps {
  title: string;
  steps: WorkflowStep[];
  onCancel?: () => void;
}

const STATUS_ICON: Record<WorkflowStep['status'], string> = {
  pending: '○',
  running: '◎',
  done: '✓',
  error: '✗',
};

const STATUS_COLOR: Record<WorkflowStep['status'], string> = {
  pending: '#9ca3af',
  running: '#3b82f6',
  done: '#10b981',
  error: '#ef4444',
};

export function WorkflowProgress({ title, steps, onCancel }: WorkflowProgressProps) {
  const running = steps.some((s) => s.status === 'running');
  const allDone = steps.every((s) => s.status === 'done');
  const hasError = steps.some((s) => s.status === 'error');

  const completedCount = steps.filter((s) => s.status === 'done').length;
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div
      role="region"
      aria-label={`${title} workflow progress`}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        maxWidth: '480px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827' }}>{title}</span>
        <span style={{ fontSize: '0.8rem', color: '#6b7280' }} aria-live="polite">
          {allDone ? 'Complete' : hasError ? 'Failed' : running ? 'Running…' : 'Pending'}
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} progress: ${progressPct}%`}
        style={{
          height: '4px',
          backgroundColor: '#e5e7eb',
          borderRadius: '2px',
          marginBottom: '14px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPct}%`,
            backgroundColor: hasError ? '#ef4444' : allDone ? '#10b981' : '#3b82f6',
            borderRadius: '2px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Steps */}
      <ol aria-label={`${title} steps`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((step) => (
          <li
            key={step.id}
            aria-label={`${step.label}: ${step.status}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '4px 0',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: STATUS_COLOR[step.status],
                minWidth: '14px',
                animation: step.status === 'running' ? 'pulse 1.2s infinite' : 'none',
              }}
            >
              {STATUS_ICON[step.status]}
            </span>
            <div>
              <span
                style={{
                  fontSize: '0.85rem',
                  color: step.status === 'pending' ? '#9ca3af' : '#111827',
                }}
              >
                {step.label}
              </span>
              {step.detail && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '1px' }}>
                  {step.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {onCancel && running && (
        <button
          type="button"
          onClick={onCancel}
          aria-label={`Cancel ${title} workflow`}
          style={{
            marginTop: '12px',
            padding: '4px 12px',
            fontSize: '0.8rem',
            color: '#6b7280',
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default WorkflowProgress;
