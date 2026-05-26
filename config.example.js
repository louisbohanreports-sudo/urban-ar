/**
 * config.js — UrbanAR local configuration
 *
 * Copy this file to config.js and fill in your values.
 * config.js is listed in .gitignore — never commit it.
 *
 * Instructions:
 *   1. Deploy gas/Code.gs as a Google Apps Script Web App
 *   2. Copy the deployment URL below
 *   3. Save as config.js alongside this file
 */
window.APP_CONFIG = {
  // Paste your GAS Web App URL here:
  webhookUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',

  // Optional: override default GPS search radius (meters)
  nearbyRadiusMeters: 300,

  // Optional: default map center [lat, lng]
  mapCenter: [37.762, -122.435],
  mapZoom: 13
};
