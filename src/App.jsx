import React, { useMemo, useState } from "react";
import { loadLessons, saveLessons, uid } from "./lib/storage";
import { today, addDays } from "./lib/date";
import LessonForm from "./components/LessonForm.jsx";
import CalendarWeek from "./components/CalendarWeek.jsx";
import TotalsPanel from "./components/TotalsPanel.jsx";
import ExportCSVButton from "./components/ExportCSVButton.jsx";
import TemplatesBar from "./components/TemplatesBar.jsx";

function useLessons(){
  const [lessons, setLessons] = useState(()=> loadLessons());
  const persist = (next) => { setLessons(next); saveLessons(next); };
  const add = (payload) => persist([{ id: uid(), ...payload }, ...lessons]);
  const addMany = (list) => {
    const withIds = list.map(p => ({ id: uid(), ...p }));
    persist([...withIds, ...lessons]);
  };
  const update = (id, changes) => persist(lessons.map(l => l.id===id ? {...l, ...changes} : l));
  const remove = (id) => persist(lessons.filter(l => l.id!==id));
  const get = (id) => lessons.find(l => l.id===id);
  return { lessons, add, addMany, update, remove, get, setLessons: persist };
}

export default function App(){
  const { lessons, add, addMany, update, remove, get } = useLessons();

  const [tab, setTab] = useState("schedule");
  const [anchorDate, setAnchorDate] = useState(today());
  const [editingId, setEditingId] = useState(null);

  // NEW: robust prefill for “New Lesson”
  const [newPrefill, setNewPrefill] = useState(null);
  const DEFAULT_NEW = { date: today(), start: "18:00", student: "", status: "scheduled", notes: "" };

  const sorted = useMemo(
    () => [...lessons].sort((a,b)=> (b.date+b.start).localeCompare(a.date+a.start)), [lessons]
  );

  // NEW: always merge defaults + provided date/start
  const startQuickAdd = (date, start) => {
    setEditingId(null);
    setNewPrefill({ ...DEFAULT_NEW, date, ...(start ? { start } : {}) });
    setTab("new");
  };

  const submitNew = (form) => {
    add(form);
    setNewPrefill(null);
    setTab("schedule");
  };
  const submitEdit = (form) => {
    update(editingId, form);
    setEditingId(null);
    setTab("schedule");
  };

  const editing = editingId ? get(editingId) : null;

  return (
    <div className="container">
      <h1>Fencing Lessons Scheduler</h1>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Main tabs">
          <button className={tab==="schedule"?"active":""} onClick={()=>setTab("schedule")}>Schedule</button>
          <button className={tab==="totals"?"active":""} onClick={()=>setTab("totals")}>Totals</button>
          <button className={tab==="new"?"active":""} onClick={()=>{ setEditingId(null); setNewPrefill(DEFAULT_NEW); setTab("new"); }}>+ New Lesson</button>
        </div>

        <div className="row" style={{marginLeft:"auto"}}>
          <button className="btn" onClick={()=>setAnchorDate(addDays(anchorDate,-7))}>← Prev week</button>
          <button className="btn ghost" onClick={()=>setAnchorDate(today())}>Today</button>
          <button className="btn" onClick={()=>setAnchorDate(addDays(anchorDate,7))}>Next week →</button>
          <ExportCSVButton lessons={sorted} />
        </div>
      </div>

      {tab === "schedule" && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Templates</h2>
          <TemplatesBar
            anchorDate={anchorDate}
            lessons={lessons}
            onCreateLessons={addMany}
          />
        </div>
      )}

      {tab==="schedule" && (
       <div className="grid" style={{ gridTemplateColumns: "1fr" }}>

          <CalendarWeek
            anchorDate={anchorDate}
            lessons={lessons}
            onQuickAdd={startQuickAdd}
            onEdit={(id)=>{ setEditingId(id); setTab("edit"); }}
            onDelete={(id)=>{ if (confirm("Delete this lesson?")) remove(id); }}
          />
        </div>
      )}

      {tab==="totals" && (
        <TotalsPanel
          anchorDate={anchorDate}
          lessons={lessons}
        />
      )}

      {tab==="new" && (
        <LessonForm
          initial={newPrefill}
          onSubmit={submitNew}
          onCancel={()=>{ setNewPrefill(null); setTab("schedule"); }}
        />
      )}
      {tab==="edit" && editing && (
        <LessonForm
          initial={editing}
          onSubmit={submitEdit}
          onCancel={()=>{ setEditingId(null); setTab("schedule"); }}
        />
      )}

      <p className="small" style={{marginTop:12}}>
        Data is saved locally on this device. You can create templates and apply them to future weeks. We can add cloud sync later.
      </p>
    </div>
  );
}




