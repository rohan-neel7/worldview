import { useWorldView } from '../WorldViewContext';

export default function CrisisIntelligencePanel({ onTrigger, loading }) {
  const { geminiOutput } = useWorldView();

  const getPriorityClass = (text) => {
    if (!text) return '';
    if (text.includes('[PRIORITY: HIGH]')) return 'high';
    if (text.includes('[PRIORITY: MED]')) return 'med';
    return 'low';
  };

  const getPriorityLabel = (text) => {
    if (!text) return 'PENDING';
    const match = text.match(/\[PRIORITY:\s*(HIGH|MED|LOW)\]/);
    return match ? match[1] : 'LOW';
  };

  const cleanOutput = (text) => {
    if (!text) return 'Intelligence feed offline. Manual analysis required.';
    return text.replace(/\[PRIORITY:\s*(HIGH|MED|LOW)\]\s*/, '');
  };

  return (
    <div className="crisis-panel">
      <div className="crisis-header">
        <span>◆ CRISIS INTELLIGENCE</span>
        <button
          className="action-btn"
          onClick={onTrigger}
          disabled={loading}
        >
          {loading ? 'ANALYZING...' : 'ANALYZE'}
        </button>
      </div>
      
      <div className="crisis-output">
        <span className={`priority-badge ${getPriorityClass(geminiOutput)}`}>
          {getPriorityLabel(geminiOutput)}
        </span>
        <p className="crisis-output-text">
          {cleanOutput(geminiOutput)}
        </p>
      </div>
    </div>
  );
}
