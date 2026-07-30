import { useWorldView } from '../WorldViewContext';

export default function CoordinateDisplay() {
  const { cameraPosition } = useWorldView();

  const formatCoord = (val, pos, neg) => {
    const abs = Math.abs(val);
    const dir = val >= 0 ? pos : neg;
    return `${abs.toFixed(4)}° ${dir}`;
  };

  const formatAlt = (alt) => {
    if (alt > 1000000) return `${(alt / 1000000).toFixed(2)} Mm`;
    if (alt > 1000) return `${(alt / 1000).toFixed(1)} km`;
    return `${alt.toFixed(0)} m`;
  };

  return (
    <div className="coord-display">
      <div>LAT: {formatCoord(cameraPosition.lat, 'N', 'S')}</div>
      <div>LON: {formatCoord(cameraPosition.lon, 'E', 'W')}</div>
      <div>ALT: {formatAlt(cameraPosition.alt)}</div>
    </div>
  );
}
