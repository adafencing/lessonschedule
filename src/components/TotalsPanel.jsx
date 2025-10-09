// src/components/TotalsPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { monthRange, startOfWeek, addDays, inRange } from "../lib/date";
import {
  // Local (fallback)
  loadStudents, loadRates, saveRates, loadCurrency, saveCurrency,
  // Cloud (when signed in)
  cloudLoadStudents, cloudLoadRates, cloudSaveRates,
  cloudLoadSettings, cloudSaveSettings,
} from "../lib/storage";

function groupCounts(lessons){
  const map = new Map();
  for (const l of lessons){
    const key = l.student || "—";
    map.set(key, (map.get(key) || 0) + 1);
  }
  const rows = Array.from(map.entries()).map(([student, count]) => ({ student, count }));
  rows.sort((a,b)=> a.student.localeCompare(b.student));
  const total = rows.reduce((s,r)=> s+r.count, 0);
  return { rows, total };
}

export default function TotalsPanel({ user, anchorDate, lessons }){
  const [countOnlyDone, setCountOnlyDone] = useState(true);
  const [currency, setCurrency] = useState("€");
  const [students, setStudents] = useState([]);
  const [rates, setRates] = useState({}); // { [student]: number }

  // Load currency + students + rates depending on auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (user) {
        const [settings, sList, rMap] = await Promise.all([
          cloudLoadSettings(user.uid),
          cloudLoadStudents(user.uid),
          cloudLoadRates(user.uid),
        ]);
        if (!mounted) return;
        setCurrency(settings?.currency ?? "€");
        setStudents(sList || []);
        setRates(rMap || {});
      } else {
        if (!mounted) return;
        setCurrency(loadCurrency());
        setStudents(loadStudents());
        setRates(loadRates());
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  // Persist currency on change
  useEffect(() => {
    if (!currency) return;
    if (user) cloudSaveSettings(user.uid, { currency });
    else saveCurrency(currency);
  }, [currency, user]);

  const weekStart = startOfWeek(anchorDate);
  const weekEnd = addDays(weekStart, 6);
  const { start: monthStart, end: monthEnd } = monthRange(anchorDate);

  const byStatus = (l) => (countOnlyDone ? l.status === "done" : l.status !== "canceled");

  const weekLessons = useMemo(
    ()=> lessons.filter(l => inRange(l.date, weekStart, weekEnd)).filter(byStatus),
    [lessons, weekStart, weekEnd, countOnlyDone]
  );
  const monthLessons = useMemo(
    ()=> lessons.filter(l => inRange(l.date, monthStart, monthEnd)).filter(byStatus),
    [lessons, monthStart, monthEnd, countOnlyDone]
  );

  const W = groupCounts(weekLessons);
  const M = groupCounts(monthLessons);

  // Ensure rates map has an entry for every known student (do not overwrite filled values)
  useEffect(() => {
    if (!students?.length) return;
    setRates(prev => {
      const next = { ...prev };
      for (const s of students) if (!(s in next)) next[s] = Number(next[s]) || 0;
      return next;
    });
  }, [students]);

  const weeklyRows = useMemo(() => W.rows.map(r => {
    const rate = Number(rates[r.student] || 0);
    return { ...r, rate, bill: rate * r.count };
  }), [W.rows, rates]);

  const monthlyRows = useMemo(() => M.rows.map(r => {
    const rate = Number(rates[r.student] || 0);
    return { ...r, rate, bill: rate * r.count };
  }), [M.rows, rates]);

  const weeklyBillTotal = weeklyRows.reduce((s, r) => s + r.bill, 0);
  const monthlyBillTotal = monthlyRows.reduce((s, r) => s + r.bill, 0);

  const saveAllRates = async () => {
    const cleaned = {};
    for (const [k, v] of Object.entries(rates || {})) {
      if (!k) continue;
      const n = Number(v);
      cleaned[k] = Number.isFinite(n) ? Math.max(0, n) : 0;
    }
    setRates(cleaned);
    if (user) await cloudSaveRates(user.uid, cleaned);
    else saveRates(cleaned);
    alert("Rates saved.");
  };

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
        <h2>Totals</h2>
        <div className="row" style={{ gap: 12 }}>
          <label className="small" style={{display:"flex", alignItems:"center", gap:6}}>
            <input type="checkbox" checked={countOnlyDone} onChange={e=>setCountOnlyDone(e.target.checked)} />
            Count only <strong>Done</strong>
          </label>
          <label className="small" style={{display:"flex", alignItems:"center", gap:6}}>
            Currency
            <input
              className="input"
              style={{ width: 80 }}
              value={currency}
              onChange={(e)=>setCurrency(e.target.value)}
              title="Currency symbol or code"
              placeholder="€ / USD / RSD"
            />
          </label>
        </div>
      </div>

      {/* Rates editor */}
      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ marginTop: 0 }}>Rates per Student</h3>
        <div className="small" style={{ marginBottom: 6 }}>
          Set each student’s <strong>rate per lesson</strong>. Billable = rate × count.
        </div>
        <table className="table">
          <thead>
            <tr><th>Student</th><th style={{width:180}}>Rate / lesson</th></tr>
          </thead>
          <tbody>
            {(students?.length ? students : Object.keys(rates || {})).map(s => (
              <tr key={s}>
                <td>{s || "—"}</td>
                <td>
                  <div className="row" style={{ alignItems:"center", gap:6 }}>
                    <span className="small">{currency}</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={rates[s] ?? 0}
                      onChange={e => setRates(prev => ({ ...prev, [s]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {(!students || students.length === 0) && (
              <tr><td colSpan="2" className="small">No students yet — add a lesson first to create students.</td></tr>
            )}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent:"flex-end", marginTop: 8 }}>
          <button className="btn primary" onClick={saveAllRates}>Save rates</button>
        </div>
      </div>

      {/* Weekly & Monthly */}
      <div className="grid cols-2" style={{marginTop:12}}>
        <div className="card">
          <h3>Week ({weekStart} → {weekEnd})</h3>
          <div className="kpis">
            <div className="kpi">
              <div className="small">Lessons</div>
              <div className="num">{W.total}</div>
            </div>
            <div className="kpi">
              <div className="small">Billable</div>
              <div className="num">{currency} {Math.round(weeklyBillTotal)}</div>
            </div>
          </div>

          <table className="table" style={{marginTop:8}}>
            <thead><tr><th>Student</th><th>Count</th><th>Rate</th><th>Billable</th></tr></thead>
            <tbody>
              {weeklyRows.map(r=> (
                <tr key={r.student}>
                  <td>{r.student}</td>
                  <td>{r.count}</td>
                  <td>{currency} {Number(r.rate || 0).toFixed(0)}</td>
                  <td>{currency} {Number(r.bill || 0).toFixed(0)}</td>
                </tr>
              ))}
              {weeklyRows.length===0 && <tr><td colSpan="4" className="small">No lessons.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Month</h3>
          <div className="kpis">
            <div className="kpi">
              <div className="small">Lessons</div>
              <div className="num">{M.total}</div>
            </div>
            <div className="kpi">
              <div className="small">Billable</div>
              <div className="num">{currency} {Math.round(monthlyBillTotal)}</div>
            </div>
          </div>

          <table className="table" style={{marginTop:8}}>
            <thead><tr><th>Student</th><th>Count</th><th>Rate</th><th>Billable</th></tr></thead>
            <tbody>
              {monthlyRows.map(r=> (
                <tr key={r.student}>
                  <td>{r.student}</td>
                  <td>{r.count}</td>
                  <td>{currency} {Number(r.rate || 0).toFixed(0)}</td>
                  <td>{currency} {Number(r.bill || 0).toFixed(0)}</td>
                </tr>
              ))}
              {monthlyRows.length===0 && <tr><td colSpan="4" className="small">No lessons.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


