import React, { useMemo, useState } from "react";
import { weekdayShort } from "../lib/date";

export default function AgendaList({ lessons, onEdit, onDelete }){
  const [studentFilter, setStudentFilter] = useState("");
  const students = useMemo(
    () => Array.from(new Set(lessons.map(l => l.student))).sort(),
    [lessons]
  );
  const filtered = useMemo(
    () => lessons
      .filter(l => !studentFilter || l.student === studentFilter)
      .sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start)),
    [lessons, studentFilter]
  );

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <h2>Agenda</h2>
        <select className="input" style={{maxWidth:240}}
          value={studentFilter} onChange={e=>setStudentFilter(e.target.value)}>
          <option value="">All students</option>
          {students.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <table className="table" style={{marginTop:8}}>
        <thead>
          <tr>
            <th>Date</th><th>Time</th><th>Student</th><th>Status</th><th>Notes</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(l => (
            <tr key={l.id}>
              <td>{weekdayShort(l.date)} {l.date}</td>
              <td>{l.start}–{l.end}</td>
              <td>{l.student}</td>
              <td>
                <span className={"badge "+(l.status==="done"?"done": l.status==="canceled"?"canceled":"")}>
                  {l.status}
                </span>
              </td>
              <td className="small">{l.notes}</td>
              <td style={{textAlign:"right"}}>
                <button className="btn small" onClick={()=>onEdit(l.id)}>Edit</button>{" "}
                <button className="btn danger small" onClick={()=>onDelete(l.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {filtered.length===0 && (
            <tr><td colSpan="6" className="small">No lessons.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
