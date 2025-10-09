// src/components/LessonForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import { today } from "../lib/date";
import {
  loadStudents, saveStudents,
  cloudLoadStudents, cloudSaveStudents
} from "../lib/storage";

const BASE_OPTIONS = [20, 30, 40];

const EMPTY_DEFAULT = {
  date: today(),
  start: "18:00",
  // end is computed from start + duration
  student: "",
  status: "scheduled",
  notes: ""
};

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
function diffMinutes(start, end) {
  return timeToMinutes(end) - timeToMinutes(start);
}

export default function LessonForm({ user, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(EMPTY_DEFAULT);
  const [students, setStudents] = useState([]);
  const [duration, setDuration] = useState(30); // default 30 min

  // Load students (cloud if signed in, else local)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const list = user ? await cloudLoadStudents(user.uid) : loadStudents();
      if (mounted) setStudents(list || []);
    })();
    return () => { mounted = false; };
  }, [user]);

  // Merge defaults with incoming initial (prefill or edit)
  useEffect(() => {
    if (initial) {
      const merged = { ...EMPTY_DEFAULT, ...initial };
      setForm(merged);

      // If editing and we have an end time, derive duration from it
      if (merged.start && merged.end) {
        const d = Math.max(0, diffMinutes(merged.start, merged.end));
        setDuration(d || 30);
      } else {
        setDuration(30);
      }
    } else {
      setForm(EMPTY_DEFAULT);
      setDuration(30);
    }
  }, [initial]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const addStudent = async () => {
    const name = prompt("Student name:");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const next = Array.from(new Set([...(students || []), trimmed])).sort();
    setStudents(next);
    if (user) await cloudSaveStudents(user.uid, next);
    else saveStudents(next);

    set("student", trimmed);
  };

  // Build duration options; include current duration if it’s not 20/30/40
  const durationOptions = useMemo(() => {
    return BASE_OPTIONS.includes(duration)
      ? BASE_OPTIONS
      : [...BASE_OPTIONS, duration].sort((a, b) => a - b);
  }, [duration]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.student) return alert("Please select or add a student.");
    if (!form.date || !form.start) return alert("Please fill date and start time.");

    const end = addMinutesToTime(form.start, duration);
    onSubmit({ ...form, end }); // persist computed end
  };

  return (
    <form className="grid cols-3" onSubmit={submit}>
      <div className="card">
        <h2>When</h2>
        <div className="row">
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
          <input
            className="input"
            type="time"
            value={form.start}
            onChange={(e) => set("start", e.target.value)}
          />
          <select
            className="input"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10))}
            title="Lesson duration"
          >
            {durationOptions.map((min) => (
              <option key={min} value={min}>{min} min</option>
            ))}
          </select>
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          End time will be set automatically to{" "}
          <strong>{addMinutesToTime(form.start, duration)}</strong>.
        </div>
      </div>

      <div className="card">
        <h2>Student</h2>
        <div className="row" style={{ alignItems: "stretch" }}>
          <select
            className="input"
            value={form.student}
            onChange={(e) => set("student", e.target.value)}
          >
            <option value="">— Select —</option>
            {students.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="button" className="btn" onClick={addStudent}>+ Add</button>
        </div>

        <h2 style={{ marginTop: 12 }}>Status</h2>
        <select
          className="input"
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
        >
          <option value="scheduled">Scheduled</option>
          <option value="done">Done</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="card">
        <h2>Notes</h2>
        <textarea
          className="input"
          rows="5"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
        <div className="row" style={{ marginTop: 12, justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" type="submit">{initial && initial.id ? "Update" : "Add lesson"}</button>
        </div>
      </div>
    </form>
  );
}


