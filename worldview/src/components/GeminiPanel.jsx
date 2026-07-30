import { useWorldView } from '../WorldViewContext';

export default function GeminiPanel({ onTrigger, loading }) {
  const { geminiOutput } = useWorldView();

  const getPriorityClass = (text) => {
    if (!text) return '';
    if (text.includes('[PRIORITY: HIGH]')) return 'high';
    if (text.includes('[PRIORITY: MED]')) return 'med';
    return 'low';
  };

  const getPriorityLabel = (text) => {
    if (!text) return '';
    const match = text.match(/\[PRIORITY:\s*(HIGH|MED|LOW)\]/);
    return match ? match[1] : 'LOW';
  };

  const cleanOutput = (text) => {
    if (!text) return 'Intelligence feed offline. Manual analysis required.';
    return text.replace(/\[PRIORITY:\s*(HIGH|MED|LOW)\]\s*/, '');
  };

  return (
    <div className="video-feed glass-panel">
      {/* ── Placeholder for Video Feed (The person from the screenshot) ── */}
      <div style={{
        width: '100%', 
        height: '100%', 
        background: '#0a0a0a url("https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?q=80&w=320") center/cover no-repeat',
        position: 'relative'
      }}>
        <div className="video-overlay" />
        
        {/* ── Panel Information Overlay ── */}
        <div style={{
           position: 'absolute',
           bottom: 12,
           left: 12,
           right: 12,
           zIndex: 10
        }}>
           <div className="gemini-header" style={{border: 'none', marginBottom: 6}}>
             <span className="gemini-title" style={{fontSize: 10}}>
               <span style={{marginRight: 6}}>◈</span>
               CRISIS INTELLIGENCE
             </span>
             <button
               className="gemini-trigger-btn"
               style={{background: 'rgba(77, 238, 234, 0.1)', border: '1px solid var(--color-cyan)', fontSize: 9}}
               onClick={onTrigger}
               disabled={loading}
             >
               {loading ? 'ANALYZING...' : 'ANALYZE'}
             </button>
           </div>
           
           <div className="gemini-output" style={{maxHeight: 60, overflow: 'hidden'}}>
             <span className={`priority-badge ${getPriorityClass(geminiOutput)}`} style={{fontSize: 8}}>
               {getPriorityLabel(geminiOutput)}
             </span>
             <p style={{ marginTop: '2px', fontSize: 10, lineHeight: 1.4, color: '#ccc' }}>
               {cleanOutput(geminiOutput)}
             </p>
           </div>
        </div>

        {/* ── Scanline effect on video ── */}
        <div style={{
           position: 'absolute',
           inset: 0,
           background: 'repeating-linear-gradient(rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px, rgba(0,0,0,0.25) 2px)',
           pointerEvents: 'none'
        }} />
      </div>
    </div>
  );
}
