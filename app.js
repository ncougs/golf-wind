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
    statusEl.textContent = deviceHeading !== null
      ? 'Point at your target'
      : 'Waiting for compass...';
  } catch (err) {
    statusEl.textContent = 'Wind data unavailable';
  }
}

function updateWindDisplay() {
  if (windSpeedKmh === null) return;
  windSpeedEl.textContent = `${windSpeedKmh} km/h`;
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

  if (statusEl.textContent === 'Waiting for compass...') {
    statusEl.textContent = 'Point at your target';
  }
}

// ── Helpers ────────────────────────────────────────────────────────────
function toCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
