// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { today, addDays } from "./lib/date";
import CalendarWeek from "./components/CalendarWeek.jsx";
import LessonForm from "./components/LessonForm.jsx";
import TotalsPanel from "./components/TotalsPanel.jsx";
import TemplatesBar from "./components/TemplatesBar.jsx";
import ExportCSVButton from "./components/ExportCSVButton.jsx";

import {
  // local fallback storage
  uid,
  loadLessons,
  saveLessons,
  // cloud lesson helpers
  colLessons,
  addLesson,
  updateLesson,
  deleteLesson,
} from "./lib/storage";

import {
  auth,
  onAuthStateChanged,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  sendPasswordReset,
} from "./firebase";

import { onSnapshot, query, orderBy } from "firebase/firestore";

/* ---------------- Local lessons (signed OUT) ---------------- */
function useLocalLessons() {
  const [lessons, setLessons] = useState(() => loadLessons());
  const persist = (next) => {
    setLessons(next);
    saveLessons(next);
  };
  const add = (payload) => persist([{ id: uid(), ...payload }, ...lessons]);
  const addMany = (list) => {
    const withIds = list.map((p) => ({ id: uid(), ...p }));
    persist([...withIds, ...lessons]);
  };
  const update = (id, changes) =>
    persist(lessons.map((l) => (l.id === id ? { ...l, ...changes } : l)));
  const remove = (id) => persist(lessons.filter((l) => l.id !== id));
  const get = (id) => lessons.find((l) => l.id === id);
  return { lessons, add, addMany, update, remove, get };
}

/* ---------------- Cloud lessons (signed IN) with OPTIMISTIC UI ---------------- */
function useCloudLessons(user) {
  const [lessons, setLessons] = useState([]);

  // Live subscription
  useEffect(() => {
    if (!user) return;
    const q = query(colLessons(user.uid), orderBy("date"), orderBy("start"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLessons(rows);
    });
    return () => unsub && unsub();
  }, [user]);

  // temp id for optimistic rows
  const tmpId = () => "tmp_" + Math.random().toString(36).slice(2);

  const add = async (payload) => {
    if (!user) return;
    const optimistic = { id: tmpId(), ...payload };
    setLessons((prev) => [optimistic, ...prev]);
    try {
      await addLesson(user.uid, payload);
      // onSnapshot will replace with the real doc; nothing else to do
    } catch (e) {
      // revert
      setLessons((prev) => prev.filter((x) => x.id !== optimistic.id));
      throw e;
    }
  };

  const addMany = async (list) => {
    if (!user) return;
    const temps = list.map((p) => ({ id: tmpId(), ...p }));
    setLessons((prev) => [...temps, ...prev]);
    try {
      for (const p of list) await addLesson(user.uid, p);
    } catch (e) {
      setLessons((prev) => prev.filter((x) => !temps.some((t) => t.id === x.id)));
      throw e;
    }
  };

  const update = async (id, changes) => {
    if (!user) return;
    // capture "before" from current state
    const before = lessons.find((l) => l.id === id);
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...changes } : l)));
    try {
      await updateLesson(user.uid, id, changes);
    } catch (e) {
      // revert
      setLessons((prev) => prev.map((l) => (l.id === id ? before : l)));
      throw e;
    }
  };

  const remove = async (id) => {
    if (!user) return;
    const before = lessons; // snapshot for revert
    setLessons((prev) => prev.filter((l) => l.id !== id));
    try {
      await deleteLesson(user.uid, id);
    } catch (e) {
      setLessons(before);
      throw e;
    }
  };

  const get = (id) => lessons.find((l) => l.id === id);
  return { lessons, add, addMany, update, remove, get };
}

export default function App() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub && unsub();
  }, []);

  // Always call hooks in the same order to satisfy Rules of Hooks
  const localStore = useLocalLessons();
  const cloudStore = useCloudLessons(user);
  const { lessons, add, addMany, update, remove, get } = user ? cloudStore : localStore;

  const [tab, setTab] = useState("schedule");
  const [anchorDate, setAnchorDate] = useState(today());
  const [editingId, setEditingId] = useState(null);
  const [newPrefill, setNewPrefill] = useState(null);
  const DEFAULT_NEW = {
    date: today(),
    start: "18:00",
    student: "",
    status: "scheduled",
    notes: "",
  };

  const sorted = useMemo(
    () => [...lessons].sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)),
    [lessons]
  );

  const startQuickAdd = (date, start) => {
    setEditingId(null);
    setNewPrefill({ ...DEFAULT_NEW, date, ...(start ? { start } : {}) });
    setTab("new");
  };

  const submitNew = async (form) => {
    try {
      await add(form);
      setNewPrefill(null);
      setTab("schedule");
    } catch (e) {
      console.error("Add lesson failed:", e);
      alert("Could not add the lesson.\n\n" + (e?.message || e));
    }
  };

  const submitEdit = async (form) => {
    try {
      await update(editingId, form);
      setEditingId(null);
      setTab("schedule");
    } catch (e) {
      console.error("Update lesson failed:", e);
      alert("Could not update the lesson.\n\n" + (e?.message || e));
    }
  };

  const editing = editingId ? get(editingId) : null;

  const SignControls = () => {
    const doSignIn = async () => {
      const email = prompt("Email:");
      if (!email) return;
      const password = prompt("Password:");
      if (!password) return;
      try {
        await signInWithEmail(email, password);
      } catch (e) {
        alert(e.message || String(e));
      }
    };

    const doSignUp = async () => {
      const email = prompt("New account email:");
      if (!email) return;
      const password = prompt("New account password (min 6 chars):");
      if (!password) return;
      try {
        await signUpWithEmail(email, password);
      } catch (e) {
        alert(e.message || String(e));
      }
    };

    const doReset = async () => {
      const email = prompt("Send password reset to email:");
      if (!email) return;
      try {
        await sendPasswordReset(email);
        alert("Password reset email sent (if account exists).");
      } catch (e) {
        alert(e.message || String(e));
      }
    };

    return user ? (
      <div className="row" style={{ gap: 8 }}>
        <span className="small">
          Signed in: <strong>{user.email}</strong>
        </span>
        <button className="btn" onClick={signOutUser}>
          Sign out
        </button>
      </div>
    ) : (
      <div className="row" style={{ gap: 8 }}>
        <button className="btn" onClick={doSignIn}>
          Sign in
        </button>
        <button className="btn" onClick={doSignUp}>
          Sign up
        </button>
        <button className="btn ghost" onClick={doReset}>
          Forgot?
        </button>
      </div>
    );
  };

  return (
    <div className="container">
      <h1>Fencing Lessons Scheduler</h1>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Main tabs">
          <button className={tab === "schedule" ? "active" : ""} onClick={() => setTab("schedule")}>
            Schedule
          </button>
          <button className={tab === "totals" ? "active" : ""} onClick={() => setTab("totals")}>
            Totals
          </button>
          <button
            className={tab === "new" ? "active" : ""}
            onClick={() => {
              setEditingId(null);
              setNewPrefill(DEFAULT_NEW);
              setTab("new");
            }}
          >
            + New Lesson
          </button>
        </div>

        <div className="row" style={{ marginLeft: "auto", gap: 8 }}>
          <button className="btn" onClick={() => setAnchorDate(addDays(anchorDate, -7))}>
            ← Prev week
          </button>
          <button className="btn ghost" onClick={() => setAnchorDate(today())}>
            Today
          </button>
          <button className="btn" onClick={() => setAnchorDate(addDays(anchorDate, 7))}>
            Next week →
          </button>
          <ExportCSVButton lessons={sorted} />
          <SignControls />
        </div>
      </div>

      {tab === "schedule" && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ marginTop: 0 }}>Templates</h2>
          <TemplatesBar user={user} anchorDate={anchorDate} lessons={lessons} onCreateLessons={addMany} />
        </div>
      )}

      {tab === "schedule" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
          <CalendarWeek
            anchorDate={anchorDate}
            lessons={lessons}
            onQuickAdd={startQuickAdd}
            onEdit={(id) => {
              setEditingId(id);
              setTab("edit");
            }}
            onDelete={async (id) => {
              if (!confirm("Delete this lesson?")) return;
              try {
                await remove(id);
              } catch (e) {
                console.error("Delete lesson failed:", e);
                alert("Could not delete the lesson.\n\n" + (e?.message || e));
              }
            }}
          />
        </div>
      )}

      {tab === "totals" && <TotalsPanel user={user} anchorDate={anchorDate} lessons={lessons} />}

      {tab === "new" && (
        <LessonForm
          user={user}
          initial={newPrefill}
          onSubmit={submitNew}
          onCancel={() => {
            setNewPrefill(null);
            setTab("schedule");
          }}
        />
      )}

      {tab === "edit" && editing && (
        <LessonForm
          user={user}
          initial={editing}
          onSubmit={submitEdit}
          onCancel={() => {
            setEditingId(null);
            setTab("schedule");
          }}
        />
      )}

      <p className="small" style={{ marginTop: 12 }}>
        {user
          ? "Signed in — your data syncs via Firestore and works offline."
          : "Not signed in — data is saved locally on this device. Sign in to sync across devices."}
      </p>
    </div>
  );
}





