import React, { useMemo } from "react";
import { startOfWeek, addDays, weekdayShort, hhmm } from "../lib/date";

// Helper: split header into top line = weekday, bottom line = "Mon 07"
function headerParts(iso) {
  const d = new Date(iso);
  const month = d.toLocaleString("default", { month: "short" }); // Jan, Feb, ...
  const dayNum = d.getDate();
  return {
    weekday: weekdayShort(iso),
    sub: `${month} ${dayNum}`,
  };
}

export default function CalendarWeek({ anchorDate, lessons, onQuickAdd, onEdit, onDelete }) {
  const start = startOfWeek(anchorDate); // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const d of days) map[d] = [];
    for (const l of lessons) {
      if (map[l.date]) map[l.date].push(l);
    }
    // sort each day by start time (string HH:MM works for lexicographic sort)
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.start || "").localeCompare(b.start || ""))
    );
    return map;
  }, [days, lessons]);

  return (
    <div className="card">
      <h2>Week</h2>

      <div className="calendar-wrap" style={{ marginTop: 8 }}>
        {/* Override grid to 7 equal columns (no time column) */}
        <div
          className="calendar"
          style={{ gridTemplateColumns: `repeat(7, minmax(var(--cal-day-col), 1fr))` }}
        >
          {/* Header row: weekday on top, month+day below (same size) */}
          {days.map((d) => {
            const { weekday, sub } = headerParts(d);
            return (
              <div key={d} className="head" style={{ textAlign: "center" }}>
                <div>{weekday}</div>
                <div>{sub}</div>
              </div>
            );
          })}

          {/* One column per day; coach sets time inside the form */}
          {days.map((d) => (
            <div
              key={d}
              className="cell"
              onDoubleClick={() => onQuickAdd?.(d)}
              title="Double-click to add a lesson"
              style={{ minHeight: "220px" }}
            >
              <div className="row" style={{ justifyContent: "flex-end", marginBottom: 6 }}>
                <button type="button" className="btn small" onClick={() => onQuickAdd?.(d)}>
  + Add
</button>

              </div>

              {(eventsByDay[d] || []).map((e) => (
                <div
                  key={e.id}
                  className={
                    "event " +
                    (e.status === "done"
                      ? "done"
                      : e.status === "canceled"
                      ? "canceled"
                      : "")
                  }
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
  <span className="evt-time">
    {hhmm(e.start)}–{hhmm(e.end)}
  </span>
  <strong className="evt-student">{e.student}</strong>
</div>

                  <div
                    className="small"
                    title={e.notes}
                    style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {e.notes}
                  </div>
                   <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
  <button className="btn small" onClick={() => onEdit?.(e.id)}>Edit</button>
  <button className="btn danger small" onClick={() => onDelete?.(e.id)}>Delete</button>
</div>

                </div>
              ))}

              {(eventsByDay[d] || []).length === 0 && (
                <div className="small" style={{ color: "var(--muted)" }}>
                  No lessons
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="small" style={{ marginTop: 6 }}>
        Tip: double-click any day to add a lesson. You can set any start/end time in the form.
      </p>
    </div>
  );
}



