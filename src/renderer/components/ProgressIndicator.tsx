/**
 * T056: Progress indicator for long AI operations (>3s)
 */

interface ProgressIndicatorProps {
  label?: string | undefined;
  className?: string | undefined;
}

export function ProgressIndicator({ label = 'Thinking...', className = '' }: ProgressIndicatorProps) {
  return (
    <div
      className={`progress-indicator ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          animation: 'pulse 1s infinite',
        }}
      />
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          animation: 'pulse 1s infinite 0.2s',
        }}
      />
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          animation: 'pulse 1s infinite 0.4s',
        }}
      />
      <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '4px' }}>{label}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default ProgressIndicator;
