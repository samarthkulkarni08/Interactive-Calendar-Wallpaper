import React, { useEffect, useMemo, useState } from "react";
import "./styles/global.css";
import TimeWidget from "./components/TimeWidget";
import CalendarView from "./components/CalendarView";
import DatePanel from "./components/DatePanel";
import { useWallpaperMousePassthrough } from "./hooks/useWallpaperMousePassthrough";

type EventItem = {
  id: string;
  title: string;
  time: string;
  link?: string;
};

type TodoItem = {
  id: string;
  title: string;
  attachedAppName?: string;
  completed: boolean;
};

type DateData = {
  events: EventItem[];
  todos: TodoItem[];
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthGrid(monthCursor: Date): Date[] {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const start = new Date(first);
  // Sunday-start weeks (works well for US/typical defaults).
  start.setDate(first.getDate() - first.getDay());

  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

export default function App() {
  useWallpaperMousePassthrough();

  const api = (window as any).api as
    | undefined
    | {
        storageGetByDate?: (dateKey: string) => Promise<any>;
        storageUpsertByDate?: (
          dateKey: string,
          payload: any
        ) => Promise<any>;
      };

  const now = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const gridDates = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);
  const visibleDateKeys = useMemo(() => gridDates.map(dateKey), [gridDates]);

  const [dateDataByKey, setDateDataByKey] = useState<Record<string, DateData>>(
    {}
  );

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    dateKey(new Date())
  );

  const selectedDateData: DateData = useMemo(() => {
    return (
      dateDataByKey[selectedDateKey] ?? {
        events: [],
        todos: []
      }
    );
  }, [dateDataByKey, selectedDateKey]);

  async function loadDateKey(key: string) {
    if (!api?.storageGetByDate) return;
    const res = await api.storageGetByDate(key);
    setDateDataByKey((prev) => ({
      ...prev,
      [key]: {
        events: res.events as EventItem[],
        todos: res.todos as TodoItem[]
      }
    }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!api?.storageGetByDate) return;
      // Load all 42 visible cells for dot indicators.
      await Promise.all(
        visibleDateKeys.map((k) => api.storageGetByDate?.(k))
      );
      if (cancelled) return;

      const entries = await Promise.all(
        visibleDateKeys.map(async (k) => {
          const res = await api.storageGetByDate!(k);
          return [k, { events: res.events, todos: res.todos }] as const;
        })
      );

      if (cancelled) return;
      setDateDataByKey((prev) => {
        const next = { ...prev };
        for (const [k, v] of entries) next[k] = v as DateData;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleDateKeys]);

  async function persistDate(
    key: string,
    payload: { events?: EventItem[]; todos?: TodoItem[] }
  ) {
    if (!api?.storageUpsertByDate) return;
    await api.storageUpsertByDate(key, payload);
    await loadDateKey(key);
  }

  function onDateClick(d: Date) {
    const key = dateKey(d);
    setSelectedDateKey(key);
    setPanelOpen(true);
    // If panel is open, keep calendar visible under it.
  }

  return (
    <div className="wallpaperRoot">
      <TimeWidget />
      <div className="mainLayout">
        {/*
          One interactive wrapper so the flex *gap* between calendar and panel
          stays hit-testable. With pointer-events:none on mainLayout, gap space
          used to fall through to the desktop and toggle OS passthrough mid-drag.
        */}
        <div className="wallpaperUiCluster" data-wallpaper-interactive>
          <div className="calendarWrap">
            <CalendarView
              key={`${monthCursor.getFullYear()}-${monthCursor.getMonth()}`}
              monthCursor={monthCursor}
              dateDataByKey={dateDataByKey}
              onPrev={() =>
                setMonthCursor((d) =>
                  new Date(d.getFullYear(), d.getMonth() - 1, 1)
                )
              }
              onNext={() =>
                setMonthCursor((d) =>
                  new Date(d.getFullYear(), d.getMonth() + 1, 1)
                )
              }
              onDateClick={onDateClick}
              todayKey={dateKey(new Date())}
            />
          </div>

          <DatePanel
            open={panelOpen}
            dateKey={selectedDateKey}
            initialData={selectedDateData}
            onClose={() => setPanelOpen(false)}
            onPersist={persistDate}
          />
        </div>
      </div>
    </div>
  );
}

