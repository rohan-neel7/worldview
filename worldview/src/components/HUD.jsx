import RecordingIndicator from './RecordingIndicator';
import CoordinateDisplay from './CoordinateDisplay';
import ClassificationBar from './ClassificationBar';

export default function HUD() {
  return (
    <div className="hud-overlay">
      <RecordingIndicator />
      <CoordinateDisplay />
      <ClassificationBar position="bottom" />
    </div>
  );
}
