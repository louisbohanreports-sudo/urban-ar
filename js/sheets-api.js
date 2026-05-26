/**
 * sheets-api.js
 *
 * Thin wrapper around the Google Apps Script Web App endpoint.
 * All Sheets CRUD goes through the GAS webhook deployed from gas/Code.gs.
 *
 * Set SHEETS_WEBHOOK_URL in config.js (not committed to git — see .gitignore).
 */

window.SheetsAPI = (function() {

  // ── Config ────────────────────────────────────────────────────────
  // Override in config.js:  window.APP_CONFIG = { webhookUrl: "https://..." }
  function getWebhookUrl() {
    return (window.APP_CONFIG && window.APP_CONFIG.webhookUrl) || null;
  }

  // ── Internal fetch helper ─────────────────────────────────────────
  async function apiFetch(payload) {
    const url = getWebhookUrl();
    if (!url) {
      console.warn('[SheetsAPI] No webhook URL configured. Set APP_CONFIG.webhookUrl.');
      return { ok: false, error: 'no_webhook' };
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      return json;
    } catch (err) {
      console.error('[SheetsAPI] Fetch error:', err);
      return { ok: false, error: err.message };
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Submit a rating + optional comment for a shelter stop.
   *
   * @param {Object} params
   * @param {string} params.shelterId   – e.g. "shelter-001"
   * @param {string} params.stopId      – SFMTA stop_id
   * @param {string} params.stopName    – human-readable name
   * @param {number} params.rating      – 1–5
   * @param {string} [params.comment]   – optional free-text
   * @param {number} [params.lat]       – user GPS lat at time of rating
   * @param {number} [params.lng]       – user GPS lng at time of rating
   */
  async function submitRating({ shelterId, stopId, stopName, rating, comment='', lat, lng }) {
    return apiFetch({
      action: 'submitRating',
      shelterId,
      stopId,
      stopName,
      rating,
      comment,
      lat,
      lng,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  }

  /**
   * Fetch aggregate stats for a shelter (avg rating, count, recent comments).
   * @param {string} shelterId
   */
  async function getStats(shelterId) {
    const url = getWebhookUrl();
    if (!url) return null;
    try {
      const params = new URLSearchParams({ action: 'getStats', shelterId });
      const res = await fetch(`${url}?${params}`);
      return await res.json();
    } catch (err) {
      console.error('[SheetsAPI] getStats error:', err);
      return null;
    }
  }

  /**
   * Fetch all shelter proposals (optionally with live ratings baked in).
   * Falls back to local SHELTER_DATA if unavailable.
   */
  async function getShelters() {
    const url = getWebhookUrl();
    if (!url) return window.SHELTER_DATA || [];
    try {
      const params = new URLSearchParams({ action: 'getShelters' });
      const res = await fetch(`${url}?${params}`);
      const json = await res.json();
      return json.shelters || window.SHELTER_DATA || [];
    } catch (err) {
      console.error('[SheetsAPI] getShelters error:', err);
      return window.SHELTER_DATA || [];
    }
  }

  return { submitRating, getStats, getShelters };

})();
