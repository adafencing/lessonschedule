import React from "react";
import { downloadCSV } from "../lib/csv";

export default function ExportCSVButton({ lessons, file = "lessons.csv" }){
  return (
    <button className="btn" onClick={() => downloadCSV(file, lessons)}>
      Export CSV
    </button>
  );
}
