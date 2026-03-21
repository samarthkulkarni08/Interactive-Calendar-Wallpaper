import React, { useMemo } from "react";

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

type Props = {
  monthCursor: Date;
  dateDataByKey: Record<string, DateData>;
  onPrev: () => void;
  onNext: () => void;
  onDateClick: (d: Date) => void;
  todayKey: string;
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthGrid(monthCursor: Date): Date[] {
  const first = new Date(
    monthCursor.getFullYear(),
    monthCursor.getMonth(),
    1
  );
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d);
  }
  return out;
}

export default function CalendarView({
  monthCursor,
  dateDataByKey,
  onPrev,
  onNext,
  onDateClick,
  todayKey
}: Props) {
  const gridDates = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric"
    }).format(monthCursor);
  }, [monthCursor]);

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="calendarCard" aria-label="Calendar">
      <div className="calendarHeader">
        <button className="calendarNavBtn" onClick={onPrev} aria-label="Previous month">
          ‹
        </button>
        <div className="calendarHeaderTitle">{monthLabel}</div>
        <button className="calendarNavBtn" onClick={onNext} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="calendarWeekdays">
        {weekdayLabels.map((w) => (
          <div key={w} className="calendarWeekday">
            {w}
          </div>
        ))}
      </div>

      <div className="calendarGrid">
        {gridDates.map((d) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === monthCursor.getMonth();
          const data = dateDataByKey[key];
          const eventCount = data?.events?.length ?? 0;
          const todoCount = data?.todos?.length ?? 0;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              className={[
                "calendarCell",
                inMonth ? "calendarCellInMonth" : "calendarCellOutMonth",
                isToday ? "calendarCellToday" : ""
              ].join(" ")}
              onClick={() => inMonth && onDateClick(d)}
              disabled={!inMonth}
              aria-label={`Date ${key}`}
            >
              <div className="calendarCellDay">{d.getDate()}</div>
              <div className="calendarBadges">
                {todoCount > 0 && (
                  <div className="calendarBadge calendarBadgeTodo">
                    {todoCount}
                  </div>
                )}
                {eventCount > 0 && (
                  <div className="calendarBadge calendarBadgeEvent">
                    {eventCount}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="calendarLegend" aria-label="Calendar color key">
        <div className="calendarLegendItem">
          <span className="calendarLegendSwatch calendarLegendSwatchTodo" />
          <span>Tasks</span>
        </div>
        <div className="calendarLegendItem">
          <span className="calendarLegendSwatch calendarLegendSwatchEvent" />
          <span>Events</span>
        </div>
      </div>
    </div>
  );
}

