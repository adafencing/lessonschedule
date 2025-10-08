export const toISODate = (d) => {
  if (typeof d === "string") return d.slice(0, 10);
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};
export const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
export const today = () => toISODate(new Date());

export const startOfWeek = (iso, weekStartsOn = 1) => {
  const d = new Date(iso);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  return toISODate(d);
};
export const addDays = (iso, days) => {
  const d = new Date(iso); d.setDate(d.getDate() + days); return toISODate(d);
};
export const monthRange = (iso) => {
  const d = new Date(iso);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
};
export const inRange = (iso, start, end) => iso >= start && iso <= end;
export const hhmm = (t) => t; // already HH:MM
export const weekdayShort = (iso) => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(iso).getDay()];
