import React, { useMemo, useState } from "react";
import { startOfWeek, addDays } from "../lib/date";
import { loadTemplates, saveTemplates, uid } from "../lib/storage";

// helpers
function timeToMinutes(hhmm = "00:00") {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (h * 60) + (m || 0);
}
function minutesToTime(total) {
  const t = ((total % (24*60)) + (24*60)) % (24*60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}`;
}
function addMinutesToTime(hhmm, minutes) {
  return minutesToTime(timeToMinutes(hhmm) + (minutes || 0));
}

export default function TemplatesBar({ anchorDate, lessons, onCreateLessons }) {
  const [templates, setTemplates] = useState(() => loadTemplates());
  const [selectedId, setSelectedId] = useState("");

  const weekStart = startOfWeek(anchorDate);
  const weekEnd = addDays(weekStart, 6);

  // Compute day-of-week 0..6 with Monday=0 to match startOfWeek
  const dowMon0 = (iso) => {
    const js = new Date(iso).getDay(); // Sun=0..Sat=6
    return (js + 6) % 7; // Mon=0..Sun=6
  };

  const weekLessons = useMemo(
    () => lessons.filter(l => l.date >= weekStart && l.date <= weekEnd)
                 .sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start)),
    [lessons, weekStart, weekEnd]
  );

  const saveWeekAsTemplate = () => {
    if (weekLessons.length === 0) {
      alert("No lessons in this week to save.");
      return;
    }
    const name = prompt("Template name:");
    if (!name) return;

    const items = weekLessons.map(l => {
      const duration = timeToMinutes(l.end) - timeToMinutes(l.start);
      return {
        dow: dowMon0(l.date), // 0..6
        start: l.start,
        duration: Math.max(0, duration || 30),
        student: l.student,
        notes: l.notes || "",
        status: l.status || "scheduled"
      };
    });

    const next = [
      ...templates,
      { id: uid(), name: name.trim(), items }
    ];
    setTemplates(next);
    saveTemplates(next);
    setSelectedId(next[next.length - 1].id);
    alert("Template saved.");
  };

  const applyTemplateToWeek = () => {
    if (!selectedId) {
      alert("Please select a template to apply.");
      return;
    }
    const tpl = templates.find(t => t.id === selectedId);
    if (!tpl || !tpl.items?.length) {
      alert("Selected template is empty.");
      return;
    }

    // Build lessons for the current week
    const newLessons = tpl.items.map(it => {
      const date = addDays(weekStart, it.dow); // Mon(0) + dow
      const end = addMinutesToTime(it.start, it.duration);
      return {
        date,
        start: it.start,
        end,
        student: it.student,
        status: "scheduled", // start as scheduled when applying
        notes: it.notes || ""
      };
    });

    // Deduplicate: skip if same date+start+student already exists
    const existsKey = new Set(
      lessons.map(l => `${l.date}|${l.start}|${l.student}`)
    );
    const toCreate = newLessons.filter(l => !existsKey.has(`${l.date}|${l.start}|${l.student}`));

    if (toCreate.length === 0) {
      alert("All template lessons already exist for this week.");
      return;
    }

    onCreateLessons(toCreate);
    alert(`Applied template. Added ${toCreate.length} lesson(s).`);
  };

  const deleteTemplate = () => {
    if (!selectedId) {
      alert("Select a template to delete.");
      return;
    }
    const tpl = templates.find(t => t.id === selectedId);
    if (!tpl) return;
    if (!confirm(`Delete template "${tpl.name}"?`)) return;

    const next = templates.filter(t => t.id !== selectedId);
    setTemplates(next);
    saveTemplates(next);
    setSelectedId("");
  };

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <select
        className="input"
        style={{ maxWidth: 280 }}
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        title="Saved templates"
      >
        <option value="">— Select template —</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <button className="btn" onClick={applyTemplateToWeek}>Apply to this week</button>
      <button className="btn" onClick={saveWeekAsTemplate}>Save current week as template</button>
      <button className="btn danger" onClick={deleteTemplate}>Delete template</button>
    </div>
  );
}
