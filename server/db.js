"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const CAPACITY = 2;
const WINDOWS = {
  am: { label: "8:00–12:00", days: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true } },
  pm: { label: "12:00–4:00", days: { 1: true, 2: true, 3: true, 4: true, 5: true } }
};
const JOBS = {
  "burst-pipe": "Burst or leaking pipe",
  "water-heater": "No hot water",
  repiping: "Galvanized repipe",
  drain: "Drain or sewer line",
  "leak-detection": "Hidden leak",
  fixture: "Fixture or shutoff valve"
};
const PREFS = { call: true, text: true, email: true };

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "ridgeback.sqlite"));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    job TEXT NOT NULL,
    job_name TEXT NOT NULL,
    answers TEXT NOT NULL,
    low INTEGER NOT NULL,
    high INTEGER NOT NULL,
    free INTEGER NOT NULL,
    range_label TEXT NOT NULL,
    lines TEXT NOT NULL,
    date TEXT NOT NULL,
    window_id TEXT NOT NULL,
    window_label TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone_digits TEXT NOT NULL,
    address TEXT NOT NULL,
    email TEXT NOT NULL,
    contact_pref TEXT NOT NULL,
    details TEXT NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS bookings_slot ON bookings (date, window_id);
  CREATE INDEX IF NOT EXISTS bookings_phone ON bookings (phone_digits);
`);

function fail(status, error) {
  const err = new Error(error);
  err.status = status;
  return err;
}

function isoDate(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
}

function phoneDigits(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length === 10) return d;
  return "";
}

function asText(value, max, label) {
  if (typeof value !== "string") throw fail(400, label + " is missing.");
  const text = value.trim();
  if (!text || text.length > max) throw fail(400, label + " is missing or too long.");
  return text;
}

function slotOk(date, windowId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return false;
  const window = WINDOWS[windowId];
  if (!window) return false;
  const parts = date.split("-").map(Number);
  const when = new Date(parts[0], parts[1] - 1, parts[2], 12);
  if (when.getFullYear() !== parts[0] || when.getMonth() !== parts[1] - 1 || when.getDate() !== parts[2]) return false;
  if (!window.days[when.getDay()]) return false;
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12);
  const latest = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 21, 12);
  if (date < isoDate(tomorrow) || date > isoDate(latest)) return false;
  return true;
}

function cleanAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw fail(400, "Job answers are missing.");
  const keys = Object.keys(value);
  if (keys.length > 12) throw fail(400, "Too many job answers.");
  const out = {};
  keys.forEach(function (key) {
    if (!/^[a-z0-9-]{1,40}$/.test(key)) throw fail(400, "Job answers are not valid.");
    const item = value[key];
    if (typeof item !== "string" || item.length > 40) throw fail(400, "Job answers are not valid.");
    out[key] = item;
  });
  return out;
}

function cleanLines(value) {
  if (!Array.isArray(value) || value.length > 12) throw fail(400, "Price lines are not valid.");
  return value.map(function (line) {
    if (!line || typeof line.label !== "string" || typeof line.text !== "string") throw fail(400, "Price lines are not valid.");
    if (line.label.length > 80 || line.text.length > 80) throw fail(400, "Price lines are not valid.");
    return { label: line.label, text: line.text };
  });
}

function readInput(body) {
  if (!body || typeof body !== "object") throw fail(400, "The booking was empty.");
  const job = body.job;
  if (!JOBS[job]) throw fail(400, "Pick a job the shop actually does.");
  const date = body.date;
  const windowId = body.windowId;
  if (!slotOk(date, windowId)) throw fail(400, "That arrival window is not on the board.");
  const digits = phoneDigits(body.phone);
  if (!digits) throw fail(400, "Enter a 10-digit phone number.");
  const pref = body.contactPref;
  if (!PREFS[pref]) throw fail(400, "Pick how we should confirm.");
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email.length > 120) throw fail(400, "That email is too long.");
  if (pref === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "Add an email address for an email confirmation.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, "That email address looks incomplete.");
  const low = Number(body.low);
  const high = Number(body.high);
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high < low || high > 100000) {
    throw fail(400, "The price range is not valid.");
  }
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (details.length > 1000) throw fail(400, "The note is too long.");
  return {
    job: job,
    jobName: JOBS[job],
    answers: cleanAnswers(body.answers),
    low: low,
    high: high,
    free: body.free === true && low === 0 && high === 0 ? 1 : 0,
    range: asText(body.range, 40, "The price range"),
    lines: cleanLines(body.lines || []),
    date: date,
    windowId: windowId,
    windowLabel: WINDOWS[windowId].label,
    name: asText(body.name, 80, "A name"),
    phone: asText(body.phone, 40, "A phone number"),
    phoneDigits: digits,
    address: asText(body.address, 200, "A service address"),
    email: email,
    contactPref: pref,
    details: details
  };
}

function rowToRecord(row) {
  return {
    id: row.id,
    job: row.job,
    jobName: row.job_name,
    answers: JSON.parse(row.answers),
    low: row.low,
    high: row.high,
    free: row.free === 1,
    range: row.range_label,
    lines: JSON.parse(row.lines),
    date: row.date,
    windowId: row.window_id,
    windowLabel: row.window_label,
    name: row.name,
    phone: row.phone,
    address: row.address,
    email: row.email,
    contactPref: row.contact_pref,
    details: row.details,
    created: row.created
  };
}

function slotCount(date, windowId, ignoreId) {
  const row = ignoreId
    ? db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE date = ? AND window_id = ? AND id != ?").get(date, windowId, ignoreId)
    : db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE date = ? AND window_id = ?").get(date, windowId);
  return row.n;
}

function newTag() {
  for (let i = 0; i < 50; i++) {
    const id = String(1000 + Math.floor(Math.random() * 9000));
    if (!db.prepare("SELECT 1 AS ok FROM bookings WHERE id = ?").get(id)) return id;
  }
  throw fail(503, "Could not issue a tag number. Try again.");
}

function writeRow(id, input, created) {
  db.prepare(`
    INSERT INTO bookings (
      id, job, job_name, answers, low, high, free, range_label, lines,
      date, window_id, window_label, name, phone, phone_digits,
      address, email, contact_pref, details, created
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.job, input.jobName, JSON.stringify(input.answers), input.low, input.high, input.free,
    input.range, JSON.stringify(input.lines), input.date, input.windowId, input.windowLabel,
    input.name, input.phone, input.phoneDigits, input.address, input.email, input.contactPref,
    input.details, created
  );
}

function withWrite(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch (ignore) { /* already closed */ }
    throw err;
  }
}

function countsFrom(start, days) {
  const span = Math.min(Math.max(Number(days) || 21, 1), 28);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "")) throw fail(400, "Start date is missing.");
  const parts = start.split("-").map(Number);
  const from = new Date(parts[0], parts[1] - 1, parts[2], 12);
  const until = new Date(from.getFullYear(), from.getMonth(), from.getDate() + span - 1, 12);
  const rows = db.prepare(
    "SELECT date, window_id, COUNT(*) AS n FROM bookings WHERE date >= ? AND date <= ? GROUP BY date, window_id"
  ).all(isoDate(from), isoDate(until));
  const counts = {};
  rows.forEach(function (row) {
    counts[row.date + "|" + row.window_id] = row.n;
  });
  return { capacity: CAPACITY, counts: counts };
}

function createBooking(body) {
  const input = readInput(body);
  return withWrite(function () {
    if (slotCount(input.date, input.windowId) >= CAPACITY) throw fail(409, "That window just filled.");
    const id = newTag();
    writeRow(id, input, new Date().toISOString());
    return rowToRecord(db.prepare("SELECT * FROM bookings WHERE id = ?").get(id));
  });
}

function updateBooking(id, body) {
  if (!/^\d{4}$/.test(id || "")) throw fail(404, "No hold with that tag.");
  const input = readInput(body);
  const confirm = phoneDigits(body.confirmPhone || body.phone);
  return withWrite(function () {
    const existing = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
    if (!existing) throw fail(404, "No hold with that tag.");
    if (existing.phone_digits !== confirm) throw fail(403, "That phone number does not match this tag.");
    if (slotCount(input.date, input.windowId, id) >= CAPACITY) throw fail(409, "That window just filled.");
    db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
    writeRow(id, input, existing.created);
    return rowToRecord(db.prepare("SELECT * FROM bookings WHERE id = ?").get(id));
  });
}

function deleteBooking(id, phone) {
  if (!/^\d{4}$/.test(id || "")) throw fail(404, "No hold with that tag.");
  const digits = phoneDigits(phone);
  if (!digits) throw fail(400, "The phone number on the hold is required to cancel it.");
  return withWrite(function () {
    const existing = db.prepare("SELECT phone_digits FROM bookings WHERE id = ?").get(id);
    if (!existing) throw fail(404, "No hold with that tag.");
    if (existing.phone_digits !== digits) throw fail(403, "That phone number does not match this tag.");
    db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
    return { id: id, cancelled: true };
  });
}

function lookup(q) {
  const query = String(q || "").trim();
  const digits = phoneDigits(query);
  let rows = [];
  if (/^\d{4}$/.test(query)) {
    rows = db.prepare("SELECT * FROM bookings WHERE id = ?").all(query);
  }
  if (!rows.length && digits) {
    rows = db.prepare("SELECT * FROM bookings WHERE phone_digits = ? ORDER BY date, window_id").all(digits);
  }
  return rows.map(rowToRecord);
}

module.exports = {
  CAPACITY: CAPACITY,
  countsFrom: countsFrom,
  createBooking: createBooking,
  updateBooking: updateBooking,
  deleteBooking: deleteBooking,
  lookup: lookup
};
