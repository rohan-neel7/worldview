import { useWorldView } from '../WorldViewContext';

export default function StylePresetsPanel() {
  const { PRESETS, activePreset, setActivePreset } = useWorldView();

  return (
    <div className="pill-grid">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          className={`pill-btn ${activePreset === preset ? 'active' : ''}`}
          onClick={() => setActivePreset(preset)}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
