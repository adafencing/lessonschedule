const K  = "lessons_v1";
const KS = "students_v1";
const KT = "lesson_templates_v1";
const KR = "student_rates_v1";
const KC = "currency_pref_v1"; // NEW: per-student rates map

export function loadLessons(){ return JSON.parse(localStorage.getItem(K)  || "[]"); }
export function saveLessons(list){ localStorage.setItem(K, JSON.stringify(list)); }

export function loadStudents(){ return JSON.parse(localStorage.getItem(KS) || "[]"); }
export function saveStudents(list){ localStorage.setItem(KS, JSON.stringify(list)); }

export function loadTemplates(){ return JSON.parse(localStorage.getItem(KT) || "[]"); }
export function saveTemplates(list){ localStorage.setItem(KT, JSON.stringify(list)); }

export function loadCurrency(){   // NEW
  const v = localStorage.getItem(KC);
  return v == null ? "€" : v;
}
export function saveCurrency(v){  // NEW
  localStorage.setItem(KC, v || "€");
}

export function loadRates(){
  const raw = localStorage.getItem(KR);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export function saveRates(map){
  localStorage.setItem(KR, JSON.stringify(map || {}));
}

export function uid(){ return Math.random().toString(36).slice(2,10); }


