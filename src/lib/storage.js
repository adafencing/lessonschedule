// src/lib/storage.js
// ----- Local fallback -----
const K  = "lessons_v1";
const KS = "students_v1";
const KT = "lesson_templates_v1";
const KR = "student_rates_v1";
const KC = "currency_pref_v1";

export function loadLessons(){ return JSON.parse(localStorage.getItem(K)  || "[]"); }
export function saveLessons(list){ localStorage.setItem(K, JSON.stringify(list)); }

export function loadStudents(){ return JSON.parse(localStorage.getItem(KS) || "[]"); }
export function saveStudents(list){ localStorage.setItem(KS, JSON.stringify(list)); }

export function loadTemplates(){ return JSON.parse(localStorage.getItem(KT) || "[]"); }
export function saveTemplates(list){ localStorage.setItem(KT, JSON.stringify(list)); }

export function loadRates(){
  try { return JSON.parse(localStorage.getItem(KR) || "{}"); } catch { return {}; }
}
export function saveRates(map){ localStorage.setItem(KR, JSON.stringify(map || {})); }

export function loadCurrency(){ const v = localStorage.getItem(KC); return v == null ? "€" : v; }
export function saveCurrency(v){ localStorage.setItem(KC, v || "€"); }

export function uid(){ return Math.random().toString(36).slice(2,10); }

// ----- Cloud (Firestore) helpers -----
import { db } from "../firebase";
import {
  doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, writeBatch
} from "firebase/firestore";

// LESSONS (used via live subscription in App.jsx)
export function colLessons(uid){ return collection(db, "users", uid, "lessons"); }
export function docLesson(uid, id){ return doc(db, "users", uid, "lessons", id); }
export async function addLesson(uid, payload){ await addDoc(colLessons(uid), payload); }
export async function updateLesson(uid, id, payload){ await updateDoc(docLesson(uid, id), payload); }
export async function deleteLesson(uid, id){ await deleteDoc(docLesson(uid, id)); }

// STUDENTS (stored in a single doc as array)
function docStudents(uid){ return doc(db, "users", uid, "meta", "students"); }
export async function cloudLoadStudents(uid){
  const snap = await getDoc(docStudents(uid));
  return snap.exists() ? (snap.data().list || []) : [];
}
export async function cloudSaveStudents(uid, list){
  await setDoc(docStudents(uid), { list: Array.from(new Set(list)).sort() });
}

// RATES (map {student: number})
function docRates(uid){ return doc(db, "users", uid, "meta", "rates"); }
export async function cloudLoadRates(uid){
  const snap = await getDoc(docRates(uid));
  return snap.exists() ? (snap.data().map || {}) : {};
}
export async function cloudSaveRates(uid, map){
  await setDoc(docRates(uid), { map });
}

// SETTINGS (currency, etc.)
function docSettings(uid){ return doc(db, "users", uid, "meta", "settings"); }
export async function cloudLoadSettings(uid){
  const snap = await getDoc(docSettings(uid));
  return snap.exists() ? snap.data() : { currency: "€" };
}
export async function cloudSaveSettings(uid, settings){
  await setDoc(docSettings(uid), settings, { merge: true });
}

// TEMPLATES (collection)
function colTemplates(uid){ return collection(db, "users", uid, "templates"); }
export async function cloudLoadTemplates(uid){
  const qs = await getDocs(query(colTemplates(uid), orderBy("name")));
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function cloudAddTemplate(uid, tpl){
  await addDoc(colTemplates(uid), tpl);
}
export async function cloudDeleteTemplate(uid, id){
  await deleteDoc(doc(db, "users", uid, "templates", id));
}
// Apply: batch create lessons for speed
export async function cloudApplyTemplateToWeek(uid, lessonsToCreate){
  const batch = writeBatch(db);
  for (const l of lessonsToCreate){
    const ref = doc(collection(db, "users", uid, "lessons"));
    batch.set(ref, l);
  }
  await batch.commit();
}