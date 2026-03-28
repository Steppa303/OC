import { useEffect, useState, useRef } from 'react';

const FPSCounter = ({ fps }) => {
  const [prevFps, setPrevFps] = useState(60);
  const fpsRef = useRef(fps);
  
  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  return (
    <div id="fps-counter" style={{ display: 'block' }}>
      FPS: <span id="fps-value" style={{ color: fps >= 55 ? '#10b981' : fps >= 30 ? '#f59e0b' : '#ef4444' }}>
        {fps}
      </span>
    </div>
  );
};

export default FPSCounter;
