import React, { useEffect, useMemo, useState } from "react";
import { uid, loadLessons, saveLessons } from "./lib/storage";
import { today, addDays } from "./lib/date";
import LessonForm from "./components/LessonForm.jsx";
import CalendarWeek from "./components/CalendarWeek.jsx";
import TotalsPanel from "./components/TotalsPanel.jsx";
import ExportCSVButton from "./components/ExportCSVButton.jsx";
import TemplatesBar from "./components/TemplatesBar.jsx";

import { auth, signInWithEmail, signUpWithEmail, signOutUser, sendPasswordReset } from "./firebase";
import { onAuthStateChanged } from "./firebase";

import {
  colLessons, addLesson, updateLesson, deleteLesson
} from "./lib/storage";
import { onSnapshot, query, orderBy } from "firebase/firestore";

/* ---------- Local lessons (fallback) ---------- */
function useLocalLessons(){
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
  return { lessons, add, addMany, update, remove, get };
}

/* ---------- Cloud lessons (Firestore) ---------- */
function useCloudLessons(user){
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    if (!user) return; // inert until signed in
    const q = query(colLessons(user.uid), orderBy("date"), orderBy("start"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLessons(rows);
    });
    return () => unsub && unsub();
  }, [user]);

  const add = async (payload) => { if (user) await addLesson(user.uid, payload); };
  const addMany = async (list) => { if (user) for (const p of list) await addLesson(user.uid, p); };
  const update = async (id, changes) => { if (user) await updateLesson(user.uid, id, changes); };
  const remove = async (id) => { if (user) await deleteLesson(user.uid, id); };
  const get = (id) => lessons.find(l => l.id===id);
  return { lessons, add, addMany, update, remove, get };
}

export default function App(){
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub && unsub();
  }, []);

  // ✅ Always call hooks in the same order
  const localStore = useLocalLessons();
  const cloudStore = useCloudLessons(user);
  const { lessons, add, addMany, update, remove, get } = user ? cloudStore : localStore;

  const [tab, setTab] = useState("schedule");
  const [anchorDate, setAnchorDate] = useState(today());
  const [editingId, setEditingId] = useState(null);
  const [newPrefill, setNewPrefill] = useState(null);
  const DEFAULT_NEW = { date: today(), start: "18:00", student: "", status: "scheduled", notes: "" };

  const sorted = useMemo(
    () => [...lessons].sort((a,b)=> (b.date+b.start).localeCompare(a.date+a.start)), [lessons]
  );

  const startQuickAdd = (date, start) => {
    setEditingId(null);
    setNewPrefill({ ...DEFAULT_NEW, date, ...(start ? { start } : {}) });
    setTab("new");
  };

  const submitNew = async (form) => { await add(form); setNewPrefill(null); setTab("schedule"); };
  const submitEdit = async (form) => { await update(editingId, form); setEditingId(null); setTab("schedule"); };

  const editing = editingId ? get(editingId) : null;

const SignControls = () => {
  const doSignIn = async () => {
    const email = prompt("Email:");
    if (!email) return;
    const password = prompt("Password:");
    if (!password) return;
    try { await signInWithEmail(email, password); }
    catch (e) { alert(e.message || String(e)); }
  };

  const doSignUp = async () => {
    const email = prompt("New account email:");
    if (!email) return;
    const password = prompt("New account password (min 6 chars):");
    if (!password) return;
    try { await signUpWithEmail(email, password); }
    catch (e) { alert(e.message || String(e)); }
  };

  const doReset = async () => {
    const email = prompt("Send password reset to email:");
    if (!email) return;
    try { await sendPasswordReset(email); alert("Password reset email sent (if account exists)."); }
    catch (e) { alert(e.message || String(e)); }
  };

  return user ? (
    <div className="row" style={{ gap: 8 }}>
      <span className="small">Signed in: <strong>{user.email}</strong></span>
      <button className="btn" onClick={signOutUser}>Sign out</button>
    </div>
  ) : (
    <div className="row" style={{ gap: 8 }}>
      <button className="btn" onClick={doSignIn}>Sign in</button>
      <button className="btn" onClick={doSignUp}>Sign up</button>
      <button className="btn ghost" onClick={doReset}>Forgot?</button>
    </div>
  );
};


  return (
    <div className="container">
      <h1>Fencing Lessons Scheduler</h1>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Main tabs">
          <button className={tab==="schedule"?"active":""} onClick={()=>setTab("schedule")}>Schedule</button>
          <button className={tab==="totals"?"active":""} onClick={()=>setTab("totals")}>Totals</button>
          <button className={tab==="new"?"active":""} onClick={()=>{ setEditingId(null); setNewPrefill(DEFAULT_NEW); setTab("new"); }}>+ New Lesson</button>
        </div>

        <div className="row" style={{marginLeft:"auto", gap: 8}}>
          <button className="btn" onClick={()=>setAnchorDate(addDays(anchorDate,-7))}>← Prev week</button>
          <button className="btn ghost" onClick={()=>setAnchorDate(today())}>Today</button>
          <button className="btn" onClick={()=>setAnchorDate(addDays(anchorDate,7))}>Next week →</button>
          <ExportCSVButton lessons={sorted} />
          <SignControls />
        </div>
      </div>

      {tab === "schedule" && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Templates</h2>
          <TemplatesBar
            user={user}
            anchorDate={anchorDate}
            lessons={lessons}
            onCreateLessons={addMany}
          />
        </div>
      )}

      {tab==="schedule" && (
        <div className="grid" style={{ gridTemplateColumns:"1fr" }}>
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
          user={user}
          anchorDate={anchorDate}
          lessons={lessons}
        />
      )}

      {tab==="new" && (
        <LessonForm
          user={user}
          initial={newPrefill}
          onSubmit={submitNew}
          onCancel={()=>{ setNewPrefill(null); setTab("schedule"); }}
        />
      )}
      {tab==="edit" && editing && (
        <LessonForm
          user={user}
          initial={editing}
          onSubmit={submitEdit}
          onCancel={()=>{ setEditingId(null); setTab("schedule"); }}
        />
      )}

      <p className="small" style={{marginTop:12}}>
        {user
          ? "Signed in — your data syncs via Firestore and works offline."
          : "Not signed in — data is saved locally on this device. Sign in to sync across devices."}
      </p>
    </div>
  );
}




