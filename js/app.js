/**
 * app.js — UrbanAR core application logic
 *
 * Responsibilities:
 *   1. Get GPS position
 *   2. Inject A-Frame GPS entities for nearby shelter proposals
 *   3. Handle tap → open rating panel
 *   4. Submit ratings to Google Sheets via SheetsAPI
 *   5. Demo mode: place shelter at current location
 */

(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let userLat = null;
  let userLng = null;
  let selectedShelter = null;
  let selectedRating = 0;
  const injectedShelters = new Set();

  // ── DOM refs ───────────────────────────────────────────────────────
  const gpsStatus      = document.getElementById('gps-status');
  const ratingPanel    = document.getElementById('rating-panel');
  const stopNameEl     = document.getElementById('stop-name');
  const stopRoutesEl   = document.getElementById('stop-routes');
  const stopDescEl     = document.getElementById('stop-desc');
  const avgRatingEl    = document.getElementById('avg-rating-display');
  const ratingCountEl  = document.getElementById('rating-count-display');
  const commentInput   = document.getElementById('comment-input');
  const submitBtn      = document.getElementById('submit-rating');
  const stars          = document.querySelectorAll('.star');
  const closePanel     = document.getElementById('close-panel');
  const demoBtn        = document.getElementById('demo-btn');
  const hintToast      = document.getElementById('hint-toast');
  const arScene        = document.querySelector('a-scene');

  // ── GPS ────────────────────────────────────────────────────────────
  function startGPS() {
    if (!navigator.geolocation) {
      gpsStatus.textContent = '⚠️ GPS not supported';
      return;
    }
    navigator.geolocation.watchPosition(
      onGPSSuccess,
      onGPSError,
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }

  function onGPSSuccess(pos) {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    const acc = Math.round(pos.coords.accuracy);
    gpsStatus.textContent = `📍 GPS ±${acc}m`;
    renderNearbyShelters(userLat, userLng);
  }

  function onGPSError(err) {
    console.warn('GPS error:', err);
    gpsStatus.textContent = '⚠️ GPS unavailable';
    // Fall back to SF civic center for demo purposes
    userLat = 37.7749;
    userLng = -122.4194;
    renderNearbyShelters(userLat, userLng);
  }

  // ── Shelter rendering ──────────────────────────────────────────────
  function renderNearbyShelters(lat, lng) {
    // Use a generous radius for demo; real deployment uses ~150m
    const nearby = window.getSheltersNearby(lat, lng, 500);

    if (nearby.length === 0) {
      // Always show all shelters in demo mode (no location filter)
      window.SHELTER_DATA.forEach(injectShelterEntity);
    } else {
      nearby.forEach(injectShelterEntity);
    }
  }

  function injectShelterEntity(shelter) {
    if (injectedShelters.has(shelter.id)) return;
    injectedShelters.add(shelter.id);

    const meta = window.DESIGN_META[shelter.design] || window.DESIGN_META['standard'];

    // ── Main shelter box ──────────────────────────────────────────
    const entity = document.createElement('a-entity');
    entity.setAttribute('id', `entity-${shelter.id}`);
    entity.setAttribute('gps-entity-place', `latitude: ${shelter.lat}; longitude: ${shelter.lng}`);
    entity.setAttribute('look-at', '#ar-camera');
    entity.setAttribute('data-shelter-id', shelter.id);
    entity.setAttribute('class', 'shelter-entity');

    // Shelter box representation
    const box = document.createElement('a-box');
    box.setAttribute('width', '2.5');
    box.setAttribute('height', '2.4');
    box.setAttribute('depth', '0.8');
    box.setAttribute('color', meta.color);
    box.setAttribute('opacity', '0.55');
    box.setAttribute('position', '0 1.2 0');
    box.setAttribute('material', 'transparent: true; side: double');

    // Roof
    const roof = document.createElement('a-box');
    roof.setAttribute('width', '2.8');
    roof.setAttribute('height', '0.12');
    roof.setAttribute('depth', '1.0');
    roof.setAttribute('color', '#555');
    roof.setAttribute('position', '0 2.46 0');
    roof.setAttribute('opacity', '0.85');

    // Label background
    const labelBg = document.createElement('a-plane');
    labelBg.setAttribute('width', '2.2');
    labelBg.setAttribute('height', '0.65');
    labelBg.setAttribute('color', '#111');
    labelBg.setAttribute('opacity', '0.75');
    labelBg.setAttribute('position', '0 2.85 0');

    // Stop name label
    const nameLabel = document.createElement('a-text');
    nameLabel.setAttribute('value', `${meta.emoji} ${shelter.name}`);
    nameLabel.setAttribute('align', 'center');
    nameLabel.setAttribute('color', '#ffffff');
    nameLabel.setAttribute('width', '2.0');
    nameLabel.setAttribute('position', '0 2.95 0.01');
    nameLabel.setAttribute('font', 'roboto');

    // Design type label
    const designLabel = document.createElement('a-text');
    designLabel.setAttribute('value', meta.label);
    designLabel.setAttribute('align', 'center');
    designLabel.setAttribute('color', meta.color);
    designLabel.setAttribute('width', '1.6');
    designLabel.setAttribute('position', '0 2.72 0.01');
    designLabel.setAttribute('font', 'roboto');

    // Invisible click target (larger hit area)
    const hitArea = document.createElement('a-box');
    hitArea.setAttribute('width', '3.0');
    hitArea.setAttribute('height', '3.5');
    hitArea.setAttribute('depth', '1.2');
    hitArea.setAttribute('position', '0 1.5 0');
    hitArea.setAttribute('opacity', '0');
    hitArea.setAttribute('class', 'shelter-hit');
    hitArea.addEventListener('click', () => openPanel(shelter));

    // Pulse ring (animation)
    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', '1.2');
    ring.setAttribute('radius-outer', '1.4');
    ring.setAttribute('color', meta.color);
    ring.setAttribute('opacity', '0.6');
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('position', '0 0.05 0');
    ring.setAttribute('animation', 'property: scale; from: 1 1 1; to: 1.5 1.5 1.5; dur: 1500; dir: alternate; loop: true; easing: easeInOutSine');

    entity.appendChild(box);
    entity.appendChild(roof);
    entity.appendChild(labelBg);
    entity.appendChild(nameLabel);
    entity.appendChild(designLabel);
    entity.appendChild(ring);
    entity.appendChild(hitArea);
    arScene.appendChild(entity);

    console.log(`[UrbanAR] Injected shelter: ${shelter.name} (${shelter.lat}, ${shelter.lng})`);
  }

  // ── Rating Panel ───────────────────────────────────────────────────
  async function openPanel(shelter) {
    selectedShelter = shelter;
    selectedRating = 0;
    commentInput.value = '';
    submitBtn.disabled = true;
    resetStars();

    const meta = window.DESIGN_META[shelter.design] || {};
    stopNameEl.textContent = shelter.name;
    stopRoutesEl.textContent = shelter.routes.map(r => `Muni ${r}`).join(' · ');
    stopDescEl.textContent = shelter.description;

    avgRatingEl.textContent = '—';
    ratingCountEl.textContent = 'Loading…';

    ratingPanel.classList.remove('hidden');

    // Async: fetch live stats
    const stats = await window.SheetsAPI.getStats(shelter.id);
    if (stats && stats.count > 0) {
      avgRatingEl.textContent = stats.avg.toFixed(1) + ' ★';
      ratingCountEl.textContent = `${stats.count} rating${stats.count !== 1 ? 's' : ''}`;
    } else {
      avgRatingEl.textContent = '—';
      ratingCountEl.textContent = 'No ratings yet — be first!';
    }
  }

  function closeRatingPanel() {
    ratingPanel.classList.add('hidden');
    selectedShelter = null;
    selectedRating = 0;
    resetStars();
  }

  // ── Stars ──────────────────────────────────────────────────────────
  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value, 10);
      highlightStars(selectedRating);
      submitBtn.disabled = false;
    });
    star.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') star.click();
    });
  });

  function highlightStars(value) {
    stars.forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.value, 10) <= value);
    });
  }

  function resetStars() {
    stars.forEach(s => s.classList.remove('active'));
  }

  // ── Submit Rating ──────────────────────────────────────────────────
  submitBtn.addEventListener('click', async () => {
    if (!selectedShelter || selectedRating === 0) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const result = await window.SheetsAPI.submitRating({
      shelterId: selectedShelter.id,
      stopId: selectedShelter.stop_id,
      stopName: selectedShelter.name,
      rating: selectedRating,
      comment: commentInput.value.trim(),
      lat: userLat,
      lng: userLng
    });

    if (result && result.ok !== false) {
      submitBtn.textContent = '✓ Thank you!';
      setTimeout(closeRatingPanel, 1200);
    } else if (result && result.error === 'no_webhook') {
      // Offline / unconfigured — still acknowledge
      submitBtn.textContent = '✓ Saved locally (offline)';
      cacheOffline({ shelterId: selectedShelter.id, rating: selectedRating, comment: commentInput.value });
      setTimeout(closeRatingPanel, 1500);
    } else {
      submitBtn.textContent = 'Error — tap to retry';
      submitBtn.disabled = false;
    }
  });

  // ── Offline cache ──────────────────────────────────────────────────
  function cacheOffline(data) {
    try {
      const queue = JSON.parse(localStorage.getItem('urbanar_queue') || '[]');
      queue.push({ ...data, ts: Date.now() });
      localStorage.setItem('urbanar_queue', JSON.stringify(queue));
    } catch(e) {}
  }

  async function flushOfflineQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem('urbanar_queue') || '[]');
      if (!queue.length) return;
      for (const item of queue) {
        await window.SheetsAPI.submitRating(item);
      }
      localStorage.removeItem('urbanar_queue');
      console.log(`[UrbanAR] Flushed ${queue.length} offline ratings`);
    } catch(e) {}
  }

  // ── Demo Mode ──────────────────────────────────────────────────────
  demoBtn.addEventListener('click', () => {
    const demoLat = userLat || 37.7749;
    const demoLng = userLng || -122.4194;
    const demoShelter = {
      id: 'shelter-demo-' + Date.now(),
      stop_id: 'DEMO',
      name: 'Demo Stop (Current Location)',
      lat: demoLat,
      lng: demoLng,
      routes: ['Demo'],
      design: 'solar',
      description: 'This is a demo shelter placed at your current GPS position. In a real deployment, proposals come from SFMTA data and urban planner input.',
      priority: 1
    };
    injectShelterEntity(demoShelter);
    // Flash hint
    hintToast.style.animation = 'none';
    hintToast.textContent = '✅ Demo shelter placed — look around!';
    hintToast.style.opacity = '1';
    setTimeout(() => { hintToast.style.animation = ''; }, 50);
  });

  // ── Panel close ────────────────────────────────────────────────────
  closePanel.addEventListener('click', closeRatingPanel);

  // ── Boot ───────────────────────────────────────────────────────────
  window.addEventListener('load', () => {
    startGPS();
    flushOfflineQueue();
  });

})();
