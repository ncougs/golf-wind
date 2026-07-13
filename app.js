// ── State ──────────────────────────────────────────────────────────────
let windFromDeg = null;   // degrees wind is coming FROM (met convention)
let windSpeedKmh = null;
let windGustKmh = null;
let deviceHeading = null; // compass degrees device is pointing
let lastFetch = null;

// Smooth compass readings with a circular mean over last N samples
const headingBuffer = [];
const BUFFER_SIZE = 6;

// ── DOM ────────────────────────────────────────────────────────────────
const startScreen = document.getElementById('start-screen');
const mainScreen  = document.getElementById('main-screen');
const arrowEl     = document.getElementById('arrow');
const windSpeedEl = document.getElementById('wind-speed');
const windDirEl   = document.getElementById('wind-dir');
const statusEl    = document.getElementById('status');
const updatedEl   = document.getElementById('updated');
const effectClub  = document.getElementById('effect-club');
const effectCross = document.getElementById('effect-cross');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle   = document.getElementById('modal-title');
const modalBody    = document.getElementById('modal-body');

// Last computed effect values — used to populate modal
let lastEffect = null;

// ── Entry point ────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', start);

async function start() {
  // iOS 13+ requires explicit permission for DeviceOrientationEvent
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        alert('Compass permission is required. Please allow it and try again.');
        return;
      }
    } catch (err) {
      alert('Could not request compass permission: ' + err.message);
      return;
    }
  }

  startScreen.style.display = 'none';
  mainScreen.classList.add('active');

  getLocationAndWind();
  window.addEventListener('deviceorientation', onOrientation, true);

  // Refresh wind data every 5 minutes
  setInterval(getLocationAndWind, 5 * 60 * 1000);
  document.getElementById('refresh-btn').addEventListener('click', getLocationAndWind);

  // Modal triggers
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.modal));
  });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
}

// ── Location + Wind ────────────────────────────────────────────────────
function getLocationAndWind() {
  statusEl.textContent = 'Getting location...';

  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation not supported';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => fetchWind(pos.coords.latitude, pos.coords.longitude),
    err => { statusEl.textContent = 'Location error: ' + err.message; },
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

async function fetchWind(lat, lng) {
  statusEl.textContent = 'Fetching wind...';
  try {
    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
      `&wind_speed_unit=kmh`;

    const res  = await fetch(url);
    const data = await res.json();

    windFromDeg   = data.current.wind_direction_10m;
    windSpeedKmh  = Math.round(data.current.wind_speed_10m);
    windGustKmh   = Math.round(data.current.wind_gusts_10m);
    lastFetch     = new Date();

    updateWindDisplay();
    updateEffect();
    statusEl.textContent = deviceHeading !== null
      ? 'Point at your target'
      : 'Waiting for compass...';
  } catch (err) {
    statusEl.textContent = 'Wind data unavailable';
  }
}

function updateWindDisplay() {
  if (windSpeedKmh === null) return;
  windSpeedEl.textContent = `${windSpeedKmh}`;
  windDirEl.textContent   = `from ${toCardinal(windFromDeg)} · gusts ${windGustKmh} km/h`;
  updatedEl.textContent   = `Updated ${lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Compass ────────────────────────────────────────────────────────────
function onOrientation(event) {
  // webkitCompassHeading = iOS true compass bearing (preferred)
  // alpha = standard, but 0 is arbitrary on many Android devices
  const raw = event.webkitCompassHeading != null
    ? event.webkitCompassHeading
    : (360 - (event.alpha || 0)) % 360;

  headingBuffer.push(raw);
  if (headingBuffer.length > BUFFER_SIZE) headingBuffer.shift();

  deviceHeading = circularMean(headingBuffer);
  updateArrow();
}

// Circular mean avoids wrap-around errors (e.g. averaging 359° and 1°)
function circularMean(angles) {
  const rad = Math.PI / 180;
  const sinSum = angles.reduce((s, a) => s + Math.sin(a * rad), 0);
  const cosSum = angles.reduce((s, a) => s + Math.cos(a * rad), 0);
  return (Math.atan2(sinSum, cosSum) / rad + 360) % 360;
}

// ── Arrow ──────────────────────────────────────────────────────────────
function updateArrow() {
  if (windFromDeg === null || deviceHeading === null) return;

  // Wind is reported as where it comes FROM; convert to where it's going TO
  const windGoingDeg = (windFromDeg + 180) % 360;

  // Arrow pointing up = wind heading toward your target
  // Rotate by the difference between wind direction and where you're facing
  const rotation = windGoingDeg - deviceHeading;

  arrowEl.style.transform = `rotate(${rotation}deg)`;
  updateEffect();

  if (statusEl.textContent === 'Waiting for compass...') {
    statusEl.textContent = 'Point at your target';
  }
}

// ── Wind Effect Estimator ───────────────────────────────────────────────
function updateEffect() {
  if (windSpeedKmh === null || deviceHeading === null) return;

  const windGoingDeg = (windFromDeg + 180) % 360;
  const angleDiffRad = (windGoingDeg - deviceHeading) * Math.PI / 180;

  // Positive = headwind, negative = tailwind
  const headwind  = -windGustKmh * Math.cos(angleDiffRad);
  // Positive = wind pushing ball right, negative = pushing left
  const crosswind =  windGustKmh * Math.sin(angleDiffRad);

  // Club adjustment: 1 club per 16 km/h headwind, 1 club per 24 km/h tailwind
  const clubs = headwind >= 0
    ? Math.round(headwind / 16)
    : Math.round(headwind / 24);

  // Crosswind drift: ~5m per 16 km/h on a typical approach
  const driftM   = Math.round(Math.abs(crosswind) * 5 / 16);
  const driftDir = crosswind > 0 ? 'left' : 'right'; // ball pushed right → aim left

  // Club line
  if (clubs === 0) {
    effectClub.textContent = 'No club adjustment';
    effectClub.style.color = '#888';
  } else {
    const sign  = clubs > 0 ? '+' : '';
    const label = Math.abs(clubs) === 1 ? 'club' : 'clubs';
    effectClub.textContent = `${sign}${clubs} ${label}`;
    effectClub.style.color = clubs > 0 ? '#f87171' : '#34d399';
  }

  // Crosswind line
  if (driftM < 1) {
    effectCross.textContent = 'Straight into wind';
  } else {
    effectCross.textContent = `Aim ${driftM}m ${driftDir}`;
  }

  lastEffect = { headwind, crosswind, clubs, driftM, driftDir };
}

// ── Modal ───────────────────────────────────────────────────────────────
function openModal(type) {
  if (!lastEffect) return;
  const { headwind, crosswind, clubs, driftM, driftDir } = lastEffect;

  if (type === 'club') {
    modalTitle.textContent = 'Club Adjustment';
    const direction = clubs > 0 ? 'headwind' : clubs < 0 ? 'tailwind' : 'neutral';
    const hw = Math.abs(Math.round(headwind));
    modalBody.innerHTML = `
      <div class="summary" style="color:${clubs > 0 ? '#f87171' : clubs < 0 ? '#34d399' : '#888'}">
        ${clubs === 0 ? 'No adjustment needed' : `${clubs > 0 ? '+' : ''}${clubs} ${Math.abs(clubs) === 1 ? 'club' : 'clubs'} — ${direction}`}
      </div>
      <p class="explanation">
        Gusts of <strong>${windGustKmh} km/h</strong> with <strong>${hw} km/h</strong> as the ${direction} component into your shot line.
        The standard caddie rule: every 16 km/h of headwind = 1 extra club. Tailwind helps less —
        you only drop a club every 24 km/h downwind. These figures are based on a mid-iron approach.
      </p>
      <h3>By club type</h3>
      <div class="club-row">
        <span class="club-name">Wedges</span>
        <span class="club-note">Most affected — high ball flight and slow speed mean more time exposed to wind. Add an extra half club beyond the baseline.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Short irons (8–9)</span>
        <span class="club-note">Standard rule applies closely. Rely on the estimate.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Mid irons (5–7)</span>
        <span class="club-note">Standard rule. This is what the adjustment is calibrated for.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Long irons / Hybrids</span>
        <span class="club-note">Slightly less affected per club gap — lower trajectory. Adjust conservatively.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Driver</span>
        <span class="club-note">Can't add a club. Into wind: tee lower and flight it down. Downwind: tee higher and swing easy.</span>
      </div>
    `;
  } else {
    modalTitle.textContent = 'Crosswind Aim';
    const cw = Math.abs(Math.round(crosswind));
    modalBody.innerHTML = `
      <div class="summary" style="color:#fff">
        ${driftM < 1 ? 'No significant crosswind' : `Aim ${driftM}m ${driftDir}`}
      </div>
      <p class="explanation">
        Gusts of <strong>${windGustKmh} km/h</strong> with <strong>${cw} km/h</strong> across your shot line.
        Estimate: ~5m of drift per 16 km/h of crosswind on a 150m approach. Scale up for longer shots,
        down for shorter ones. The ball is pushed <strong>${crosswind > 0 ? 'right' : 'left'}</strong> — so aim ${driftDir}.
      </p>
      <h3>By club type</h3>
      <div class="club-row">
        <span class="club-name">Wedges</span>
        <span class="club-note">High ball flight = more drift. Add ~50% to the estimate. Aim wider than shown.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Short irons (8–9)</span>
        <span class="club-note">Close to the estimate. Reliable guide.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Mid irons (5–7)</span>
        <span class="club-note">Standard estimate. This is what the calculation is based on.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Long irons / Hybrids</span>
        <span class="club-note">Slightly less drift — faster ball speed and lower trajectory. Reduce estimate slightly.</span>
      </div>
      <div class="club-row">
        <span class="club-name">Driver</span>
        <span class="club-note">Low trajectory and high speed — much less lateral drift. The estimate will overstate it significantly.</span>
      </div>
    `;
  }

  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

// ── Helpers ────────────────────────────────────────────────────────────
function toCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
