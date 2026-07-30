import { useState, useEffect } from 'react';

export default function ClassificationBar({ position }) {
  const [timestamp, setTimestamp] = useState(getTimestamp());

  useEffect(() => {
    const interval = setInterval(() => setTimestamp(getTimestamp()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (position === 'top') {
    return (
      <div className="classification-bar top">
        TOP SECRET // SCI // WORLDVIEW — GLOBAL INTELLIGENCE PLATFORM
      </div>
    );
  }

  return (
    <div className="classification-bar bottom">
      SYS_TIME: {timestamp} // FANTOMCODE 2026 // OPERATIONAL FEED ACTIVE
    </div>
  );
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19) + 'Z';
}
