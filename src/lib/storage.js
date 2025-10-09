// src/lib/storage.js

/* ----------------------- Local (fallback) ----------------------- */
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

/* ----------------------- Cloud (Firestore) ----------------------- */
import { db } from "../firebase";
import {
  doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, writeBatch
} from "firebase/firestore";

/* ---------- Lessons (per user, live-subscribed in App.jsx) ---------- */
export function colLessons(uid){ return collection(db, "users", uid, "lessons"); }
export function docLesson(uid, id){ return doc(db, "users", uid, "lessons", id); }

/** Add a lesson and tag with ownerUid for safety */
export async function addLesson(uid, payload){
  await addDoc(colLessons(uid), { ...payload, ownerUid: uid });
}

/** Update a lesson; ensure ownerUid stays correct */
export async function updateLesson(uid, id, payload){
  await updateDoc(docLesson(uid, id), { ...payload, ownerUid: uid });
}

/** Delete a lesson */
export async function deleteLesson(uid, id){
  await deleteDoc(docLesson(uid, id));
}

/* ---------- Students (stored in a single doc as array) ---------- */
function docStudents(uid){ return doc(db, "users", uid, "meta", "students"); }
export async function cloudLoadStudents(uid){
  const snap = await getDoc(docStudents(uid));
  return snap.exists() ? (snap.data().list || []) : [];
}
export async function cloudSaveStudents(uid, list){
  await setDoc(docStudents(uid), { list: Array.from(new Set(list)).sort() }, { merge: false });
}

/* ---------- Rates (map { student: number }) ---------- */
function docRates(uid){ return doc(db, "users", uid, "meta", "rates"); }
export async function cloudLoadRates(uid){
  const snap = await getDoc(docRates(uid));
  return snap.exists() ? (snap.data().map || {}) : {};
}
export async function cloudSaveRates(uid, map){
  await setDoc(docRates(uid), { map }, { merge: false });
}

/* ---------- Settings (currency, etc.) ---------- */
function docSettings(uid){ return doc(db, "users", uid, "meta", "settings"); }
export async function cloudLoadSettings(uid){
  const snap = await getDoc(docSettings(uid));
  return snap.exists() ? snap.data() : { currency: "€" };
}
export async function cloudSaveSettings(uid, settings){
  await setDoc(docSettings(uid), settings, { merge: true });
}

/* ---------- Templates (collection under each user) ---------- */
function colTemplates(uid){ return collection(db, "users", uid, "templates"); }
export async function cloudLoadTemplates(uid){
  const qs = await getDocs(query(colTemplates(uid), orderBy("name")));
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function cloudAddTemplate(uid, tpl){
  // tpl: { name, items: [{ dow, start, duration, student, notes }] }
  await addDoc(colTemplates(uid), tpl);
}
export async function cloudDeleteTemplate(uid, id){
  await deleteDoc(doc(db, "users", uid, "templates", id));
}

/** Batch-apply a template to a week: list of lesson payloads */
export async function cloudApplyTemplateToWeek(uid, lessonsToCreate){
  const batch = writeBatch(db);
  const col = collection(db, "users", uid, "lessons");
  for (const l of lessonsToCreate){
    const ref = doc(col); // auto-id
    batch.set(ref, { ...l, ownerUid: uid });
  }
  await batch.commit();
}
