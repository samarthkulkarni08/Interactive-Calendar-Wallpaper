import React, { useEffect, useState } from "react";

function formatTime(d: Date) {
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export default function TimeWidget() {
  const [now, setNow] = useState(() => new Date());

  function openClock() {
    const api = (window as any).api as any | undefined;
    api?.openClockApp?.();
  }

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div
      className="timeWidget"
      data-wallpaper-interactive
      role="button"
      tabIndex={0}
      onClick={openClock}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openClock();
      }}
      aria-label="Open Clock app"
    >
      <div className="timeWidgetTime">{formatTime(now)}</div>
      <div className="timeWidgetLabel">Clock</div>
    </div>
  );
}

