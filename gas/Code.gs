/**
 * UrbanAR — Google Apps Script Web App
 * ======================================
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 * Paste the deployment URL into config.js as APP_CONFIG.webhookUrl.
 *
 * Sheets in the bound Spreadsheet:
 *   1. "Shelters"  — master proposal list
 *   2. "Ratings"   — one row per user submission
 *   3. "Stats"     — auto-maintained aggregates (avg, count) per shelter
 *
 * GET  ?action=getShelters                → returns shelter list + current stats
 * GET  ?action=getStats&shelterId=XXX     → returns avg/count/comments for one shelter
 * POST { action:"submitRating", ... }     → appends to Ratings, updates Stats
 */

const SHEET_SHELTERS = 'Shelters';
const SHEET_RATINGS  = 'Ratings';
const SHEET_STATS    = 'Stats';

// ── Entry points ────────────────────────────────────────────────────

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action;

  try {
    if (action === 'getShelters') return jsonResponse(handleGetShelters());
    if (action === 'getStats')    return jsonResponse(handleGetStats(params.shelterId));
    return jsonResponse({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    if (action === 'submitRating') return jsonResponse(handleSubmitRating(payload));
    return jsonResponse({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ── Handlers ────────────────────────────────────────────────────────

function handleGetShelters() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getSheetByName(SHEET_SHELTERS);
  if (!sheet) return { ok: true, shelters: [] };

  const rows   = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const shelters = rows.slice(1).map(row => {
    const s = {};
    headers.forEach((h, i) => s[h] = row[i]);
    // Parse routes JSON array if stored as string
    if (typeof s.routes === 'string') {
      try { s.routes = JSON.parse(s.routes); } catch(_) { s.routes = [s.routes]; }
    }
    return s;
  }).filter(s => s.id);

  // Attach live stats
  const statsMap = getStatsMap();
  shelters.forEach(s => {
    const st = statsMap[s.id];
    s.avg   = st ? st.avg   : null;
    s.count = st ? st.count : 0;
  });

  return { ok: true, shelters };
}

function handleGetStats(shelterId) {
  if (!shelterId) return { ok: false, error: 'missing shelterId' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RATINGS);
  if (!sheet) return { ok: true, count: 0, avg: 0, comments: [] };

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const idIdx   = headers.indexOf('shelterid');
  const ratIdx  = headers.indexOf('rating');
  const cmtIdx  = headers.indexOf('comment');
  const tsIdx   = headers.indexOf('timestamp');

  const matching = rows.slice(1).filter(r => r[idIdx] === shelterId && r[ratIdx]);
  const count    = matching.length;
  const avg      = count ? matching.reduce((s, r) => s + Number(r[ratIdx]), 0) / count : 0;
  const comments = matching
    .filter(r => r[cmtIdx] && r[cmtIdx].toString().trim())
    .slice(-10)
    .map(r => ({ comment: r[cmtIdx], timestamp: r[tsIdx] }))
    .reverse();

  return { ok: true, shelterId, count, avg: Math.round(avg * 10) / 10, comments };
}

function handleSubmitRating(payload) {
  const { shelterId, stopId, stopName, rating, comment, lat, lng, timestamp, userAgent } = payload;

  if (!shelterId || !rating) return { ok: false, error: 'missing fields' };
  if (rating < 1 || rating > 5) return { ok: false, error: 'invalid rating' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(SHEET_RATINGS);

  // Create sheet + headers if needed
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RATINGS);
    sheet.appendRow(['shelterId','stopId','stopName','rating','comment','lat','lng','timestamp','userAgent']);
  }

  sheet.appendRow([
    shelterId, stopId || '', stopName || '', rating,
    comment || '', lat || '', lng || '',
    timestamp || new Date().toISOString(),
    userAgent || ''
  ]);

  // Recompute Stats sheet
  rebuildStats(ss);

  return { ok: true, message: 'Rating recorded' };
}

// ── Stats helpers ───────────────────────────────────────────────────

function getStatsMap() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_STATS);
  if (!sheet) return {};

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const idIdx   = headers.indexOf('shelterid');
  const avgIdx  = headers.indexOf('avg');
  const cntIdx  = headers.indexOf('count');

  const map = {};
  rows.slice(1).forEach(r => {
    if (r[idIdx]) map[r[idIdx]] = { avg: r[avgIdx], count: r[cntIdx] };
  });
  return map;
}

function rebuildStats(ss) {
  const ratSheet = ss.getSheetByName(SHEET_RATINGS);
  if (!ratSheet) return;

  const rows    = ratSheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const idIdx   = headers.indexOf('shelterid');
  const ratIdx  = headers.indexOf('rating');

  // Aggregate
  const agg = {};
  rows.slice(1).forEach(r => {
    const id  = r[idIdx];
    const rat = Number(r[ratIdx]);
    if (!id || !rat) return;
    if (!agg[id]) agg[id] = { sum: 0, count: 0 };
    agg[id].sum   += rat;
    agg[id].count += 1;
  });

  // Write Stats sheet
  let statsSheet = ss.getSheetByName(SHEET_STATS);
  if (!statsSheet) {
    statsSheet = ss.insertSheet(SHEET_STATS);
  }
  statsSheet.clearContents();
  statsSheet.appendRow(['shelterId', 'avg', 'count', 'lastUpdated']);
  Object.entries(agg).forEach(([id, v]) => {
    statsSheet.appendRow([id, Math.round((v.sum / v.count) * 10) / 10, v.count, new Date().toISOString()]);
  });
}

// ── Utility ─────────────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── One-time setup: seed Shelters sheet ─────────────────────────────
// Run manually once after deploying: Tools → Run → seedSheltersSheet

function seedSheltersSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(SHEET_SHELTERS);
  if (!sheet) sheet = ss.insertSheet(SHEET_SHELTERS);
  else sheet.clearContents();

  sheet.appendRow(['id','stop_id','name','lat','lng','routes','design','description','priority']);

  const shelters = [
    ['shelter-001','15552','Mission St & 16th St',37.76454,-122.41964,'["14","14R","49"]','solar','High-ridership corner with no existing shelter. Solar-powered design with real-time arrival display and USB charging.',1],
    ['shelter-002','15734','Valencia St & 24th St',37.75223,-122.42071,'["14","49","67"]','green-roof','Dense residential node. Proposed green-roof shelter with climbing plants, integrated seating, and bike parking.',2],
    ['shelter-003','14008','Market St & Castro St',37.76204,-122.43497,'["F","24","37"]','ada-enhanced','ADA-enhanced shelter with widened boarding zone, tactile paving, and audio announcements.',1],
    ['shelter-004','13228','Geary Blvd & Divisadero St',37.78381,-122.43803,'["38","38R","24"]','standard','High-frequency BRT corridor. Standard-plus shelter with extended roof and digital arrival board.',1],
    ['shelter-005','16995','Taraval St & 19th Ave',37.74449,-122.47624,'["L","28"]','solar','Outer Sunset underserved stop. Solar shelter would provide first weather protection on this corridor.',2],
  ];

  shelters.forEach(row => sheet.appendRow(row));
  Logger.log('Shelters sheet seeded with ' + shelters.length + ' rows.');
}
