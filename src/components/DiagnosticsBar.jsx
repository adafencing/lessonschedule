// src/components/DiagnosticsBar.jsx
import React, { useMemo } from "react";
import { getRuntimeConfig, clearFirestoreCache } from "../firebase";
import { addLesson } from "../lib/storage";

export default function DiagnosticsBar({ user, lessons }) {
  const cfg = getRuntimeConfig();
  const uid = user?.uid || "—";
  const email = user?.email || "—";
  const origin = (typeof window !== "undefined" && window.location.origin) || "—";

  const latest = useMemo(() => {
    if (!lessons?.length) return "none";
    const sorted = [...lessons].sort((a,b) => (b.date + (b.start||"")).localeCompare(a.date + (a.start||"")));
    const top = sorted[0];
    return `${top.date} ${top.start || ""} | ${top.student || ""}`;
  }, [lessons]);

  const doTestWrite = async () => {
    if (!user) { alert("Sign in first to test cloud write."); return; }
    const now = new Date();
    const iso = now.toISOString().slice(0,10);
    const hh = now.getHours().toString().padStart(2,"0");
    const mm = now.getMinutes().toString().padStart(2,"0");
    try {
      await addLesson(user.uid, {
        date: iso,
        start: `${hh}:${mm}`,
        end: `${hh}:${mm}`,
        student: "⚙︎ DIAG TEST",
        status: "scheduled",
        notes: `origin=${origin}, email=${email}`,
      });
      alert("Test lesson written. If you don't see it, check Firestore at users/"+user.uid+"/lessons.");
    } catch (e) {
      console.error(e);
      alert("Test write failed:\n\n" + (e?.message || e));
    }
  };

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="small">Project: <strong>{cfg.projectId || "?"}</strong></div>
        <div className="small">Auth domain: <strong>{cfg.authDomain || "?"}</strong></div>
        <div className="small">Origin: <strong>{origin}</strong></div>
        <div className="small">UID: <strong>{uid}</strong></div>
        <div className="small">Email: <strong>{email}</strong></div>
        <div className="small">Lessons (count): <strong>{lessons?.length ?? 0}</strong></div>
        <div className="small">Latest: <strong>{latest}</strong></div>

        <div className="row" style={{ marginLeft: "auto", gap: 8 }}>
          <button type="button" className="btn" onClick={doTestWrite}>Write test lesson</button>
          <button type="button" className="btn ghost" onClick={clearFirestoreCache}>Clear cache</button>
        </div>
      </div>
    </div>
  );
}
