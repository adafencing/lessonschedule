// src/components/TemplatesBar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { startOfWeek, addDays } from "../lib/date";
import {
  // Local (fallback)
  loadTemplates, saveTemplates, uid,
  // Cloud (when signed in)
  cloudLoadTemplates, cloudAddTemplate, cloudDeleteTemplate, cloudApplyTemplateToWeek,
} from "../lib/storage";

// ---- time helpers ----
function timeToMinutes(hhmm = "00:00") {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (h * 60) + (m || 0);
}
function minutesToTime(total) {
  const t = ((total % (24 * 60)) + (24 * 60)) % (24 * 60); // 0..1439
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
function addMinutesToTime(hhmm, minutes) {
  return minutesToTime(timeToMinutes(hhmm) + (minutes || 0));
}

// Convert JS getDay() (Sun=0..Sat=6) to Mon=0..Sun=6
const dowMon0 = (iso) => ((new Date(iso).getDay() + 6) % 7);

export default function TemplatesBar({ user, anchorDate, lessons, onCreateLessons }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  const weekStart = startOfWeek(anchorDate);
  const weekEnd = addDays(weekStart, 6);

  // Current week's lessons (sorted)
  const weekLessons = useMemo(
    () => lessons
      .filter(l => l.date >= weekStart && l.date <= weekEnd)
      .sort((a,b) => (a.date + (a.start||"")).localeCompare(b.date + (b.start||""))),
    [lessons, weekStart, weekEnd]
  );

  // Load templates (cloud if signed in, else local)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (user) {
        const list = await cloudLoadTemplates(user.uid);
        if (mounted) setTemplates(list || []);
      } else {
        setTemplates(loadTemplates());
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  // Save current week as template
  const saveWeekAsTemplate = async () => {
    if (weekLessons.length === 0) {
      alert("No lessons in this week to save.");
      return;
    }
    const name = prompt("Template name:");
    if (!name) return;

    const items = weekLessons.map(l => {
      const duration = Math.max(0, (timeToMinutes(l.end || "") - timeToMinutes(l.start || "")) || 30);
      return {
        dow: dowMon0(l.date),      // 0..6 (Mon..Sun)
        start: l.start || "18:00",
        duration,
        student: l.student || "",
        notes: l.notes || "",
      };
    });

    if (user) {
      await cloudAddTemplate(user.uid, { name: name.trim(), items });
      const fresh = await cloudLoadTemplates(user.uid);
      setTemplates(fresh || []);
      setSelectedId(fresh?.[fresh.length - 1]?.id || "");
    } else {
      const next = [...templates, { id: uid(), name: name.trim(), items }];
      setTemplates(next);
      saveTemplates(next);
      setSelectedId(next[next.length - 1].id);
    }
    alert("Template saved.");
  };

  // Apply selected template to current week
  const applyTemplateToWeek = async () => {
    if (!selectedId) { alert("Please select a template."); return; }
    const tpl = templates.find(t => t.id === selectedId);
    if (!tpl || !tpl.items?.length) { alert("Selected template is empty."); return; }

    // Build lessons for the week from template items
    const newLessons = tpl.items.map(it => {
      const date = addDays(weekStart, it.dow);
      const start = it.start || "18:00";
      const end = addMinutesToTime(start, it.duration || 30);
      return {
        date,
        start,
        end,
        student: it.student || "",
        status: "scheduled",
        notes: it.notes || "",
      };
    });

    // De-dup: skip if same date+start+student already exists
    const existsKey = new Set(lessons.map(l => `${l.date}|${l.start}|${l.student}`));
    const toCreate = newLessons.filter(l => !existsKey.has(`${l.date}|${l.start}|${l.student}`));

    if (toCreate.length === 0) {
      alert("All template lessons already exist for this week.");
      return;
    }

    if (user) {
      await cloudApplyTemplateToWeek(user.uid, toCreate);
    } else {
      onCreateLessons?.(toCreate);
    }
    alert(`Applied template. Added ${toCreate.length} lesson(s).`);
  };

  // Delete selected template
  const deleteTemplate = async () => {
    if (!selectedId) { alert("Select a template to delete."); return; }
    const tpl = templates.find(t => t.id === selectedId);
    if (!tpl) return;
    if (!confirm(`Delete template "${tpl.name}"?`)) return;

    if (user) {
      await cloudDeleteTemplate(user.uid, selectedId);
      const fresh = await cloudLoadTemplates(user.uid);
      setTemplates(fresh || []);
    } else {
      const next = templates.filter(t => t.id !== selectedId);
      setTemplates(next);
      saveTemplates(next);
    }
    setSelectedId("");
  };

  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <select
        className="input"
        style={{ maxWidth: 320 }}
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        title="Saved templates"
      >
        <option value="">— Select template —</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      <button type="button" className="btn" onClick={applyTemplateToWeek}>
        Apply to this week
      </button>
      <button type="button" className="btn" onClick={saveWeekAsTemplate}>
        Save current week as template
      </button>
      <button type="button" className="btn danger" onClick={deleteTemplate}>
        Delete template
      </button>
    </div>
  );
}
