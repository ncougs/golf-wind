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
const arrowEl      = document.getElementById('arrow');
const windSpeedEl  = document.getElementById('wind-speed');
const windDirEl    = document.getElementById('wind-dir');
const statusEl     = document.getElementById('status');
const updatedEl    = document.getElementById('updated');
const effectDist    = document.getElementById('effect-dist');
const effectPlaysAs = document.getElementById('effect-plays-as');
const effectDistDir = document.getElementById('effect-dist-dir');
const modalOverlay  = document.getElementById('modal-overlay');
const modalTitle    = document.getElementById('modal-title');
const modalBody     = document.getElementById('modal-body');
const refreshBtn    = document.getElementById('refresh-btn');

// Derived from windFromDeg — cached so updateArrow and updateEffect share it
let windGoingDeg = null;

// Toggle: true = use gusts for effect calculation, false = use avg wind speed
let useGusts = localStorage.getItem('useGusts') !== 'false';

// Shot distance in meters — used for crosswind drift scaling only
let shotDistance = parseInt(localStorage.getItem('shotDistance') || '150');

// Last computed effect values — used to populate modal
let effectHeadwind = null;
let effectCrosswind = null;
let effectPct = null;
let effectDriftM = null;
let effectDriftDir = null;
let effectActiveKmh = null;

// ── Entry point ────────────────────────────────────────────────────────
function init() {
  getLocationAndWind();
  setInterval(getLocationAndWind, 5 * 60 * 1000);
  refreshBtn.addEventListener('click', getLocationAndWind);

  // Modal triggers
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.modal));
  });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

  // Swipe-to-dismiss bottom sheet
  const modal = document.getElementById('modal');
  let dragStartY = 0;
  modal.addEventListener('touchstart', e => {
    dragStartY = e.touches[0].clientY;
    modal.style.transition = 'none';
  }, { passive: true });
  modal.addEventListener('touchmove', e => {
    const dy = Math.max(0, e.touches[0].clientY - dragStartY);
    modal.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  modal.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - dragStartY;
    if (dy > 80) {
      modal.style.transition = 'transform 0.25s ease-out';
      modal.style.transform = 'translateY(100%)';
      setTimeout(() => {
        modal.style.transition = '';
        modal.style.transform = '';
        modalOverlay.classList.remove('open');
      }, 250);
    } else {
      modal.style.transition = '';
      modal.style.transform = '';
    }
  });

  // Wind/gusts toggle
  document.querySelectorAll('.toggle-opt').forEach(btn => {
    btn.addEventListener('click', () => setGustMode(btn.dataset.val === 'gusts'));
  });
  updateToggleUI();

  // iOS 13+ requires a user gesture to grant compass permission
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const compassBtn = document.getElementById('compass-btn');
    compassBtn.style.display = 'inline-block';
    statusEl.textContent = 'Tap "Enable compass" to orient the arrow';
    compassBtn.addEventListener('click', async () => {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', onOrientation, true);
          compassBtn.style.display = 'none';
          statusEl.textContent = 'Point at your target';
        } else {
          statusEl.textContent = 'Compass permission denied';
        }
      } catch (err) {
        statusEl.textContent = 'Could not enable compass';
      }
    });
  } else {
    window.addEventListener('deviceorientation', onOrientation, true);
  }
}

init();

// ── Location + Wind ────────────────────────────────────────────────────
function getLocationAndWind() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing…';

  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation not supported';
    resetRefreshBtn();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => fetchWind(pos.coords.latitude, pos.coords.longitude),
    err => {
      statusEl.textContent = 'Location error: ' + err.message;
      resetRefreshBtn();
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

function resetRefreshBtn() {
  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Refresh';
}

async function fetchWind(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
      `&wind_speed_unit=kmh`;

    const res  = await fetch(url);
    const data = await res.json();

    windFromDeg   = data.current.wind_direction_10m;
    windGoingDeg  = (windFromDeg + 180) % 360;
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
  } finally {
    resetRefreshBtn();
  }
}

function updateWindDisplay() {
  if (windSpeedKmh === null) return;
  const activeVal  = useGusts ? windGustKmh : windSpeedKmh;
  const otherLabel = useGusts ? `wind ${windSpeedKmh}` : `gusts ${windGustKmh}`;

  // Animate the number if it changed
  if (windSpeedEl.textContent !== String(activeVal)) {
    windSpeedEl.classList.remove('changing');
    void windSpeedEl.offsetWidth; // force reflow to restart animation
    windSpeedEl.classList.add('changing');
  }

  windSpeedEl.style.color = '#fff';
  windSpeedEl.textContent = `${activeVal}`;
  windDirEl.textContent   = `from ${toCardinal(windFromDeg)} · ${otherLabel} km/h`;
  updatedEl.textContent   = `Updated ${lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Compass ────────────────────────────────────────────────────────────
function onOrientation(event) {
  arrowEl.classList.remove('loading');
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

  const angleDiffRad = (windGoingDeg - deviceHeading) * Math.PI / 180;

  const active    = useGusts ? windGustKmh : windSpeedKmh;
  const headwind  = -active * Math.cos(angleDiffRad);
  const crosswind =  active * Math.sin(angleDiffRad);

  // Distance: percentage rule — 10% per 16 km/h headwind, 7% per 16 km/h tailwind
  const pct = headwind >= 0
    ? Math.round(headwind / 160 * 100)
    : Math.round(headwind / 230 * 100);

  // Crosswind drift scaled by actual shot distance (calibrated at 150m)
  const driftM   = Math.round(Math.abs(crosswind) * 5 / 16 * (shotDistance / 150));
  const driftDir = crosswind > 0 ? 'left' : 'right';

  if (pct === effectPct && driftM === effectDriftM && driftDir === effectDriftDir) return;

  effectHeadwind  = headwind;
  effectCrosswind = crosswind;
  effectPct       = pct;
  effectDriftM    = driftM;
  effectDriftDir  = driftDir;
  effectActiveKmh = active;

  // Distance card
  const clubs      = Math.round(Math.abs(150 * pct / 100) / 15);
  const playsAs150 = Math.round(150 * (1 + pct / 100));
  if (pct === 0 || clubs === 0) {
    effectDist.textContent    = 'no change';
    effectDist.style.color    = '#888';
    effectPlaysAs.textContent = '';
    effectDistDir.textContent = '';
  } else {
    const label = clubs === 1 ? 'club' : 'clubs';
    effectDist.textContent    = `${pct > 0 ? '+' : '-'}${clubs} ${label}`;
    effectDist.style.color    = pct > 0 ? '#f87171' : '#34d399';
    effectPlaysAs.textContent = `150m plays as ${playsAs150}m`;
    effectDistDir.textContent = pct > 0 ? 'into wind' : 'downwind';
  }
}

// ── Modal ───────────────────────────────────────────────────────────────
function openModal(type) {
  if (effectPct === null) {
    statusEl.textContent = 'Wind data still loading…';
    return;
  }

  // Clear any leftover swipe transform from a previous open
  document.getElementById('modal').style.transform = '';

  if (type === 'distance') {
    const direction = effectPct > 0 ? 'headwind' : effectPct < 0 ? 'tailwind' : 'neutral';
    const hw        = Math.abs(Math.round(effectHeadwind));
    const color     = effectPct > 0 ? '#f87171' : effectPct < 0 ? '#34d399' : '#888';
    const initDist  = shotDistance;

    const formatPlaysAs = (dist) => {
      const pa = Math.round(dist * (1 + effectPct / 100));
      return effectPct === 0
        ? `${dist}m — no adjustment`
        : `${dist}m shot playing ${pa}m`;
    };

    modalTitle.textContent = 'Distance Adjustment';
    modalBody.innerHTML = `
      <div class="plays-as-display" id="plays-as-display" style="color:${color}">
        ${formatPlaysAs(initDist)}
      </div>
      <div class="dist-slider-wrap">
        <input type="range" id="modal-dist-slider" min="50" max="300" step="5" value="${initDist}">
        <div class="dist-slider-labels"><span>50m</span><span>300m</span></div>
      </div>
      <p class="explanation">
        ${useGusts ? 'Gusts' : 'Wind'} of <strong>${effectActiveKmh} km/h</strong> with <strong>${hw} km/h</strong> as the ${direction} component.
        16 km/h of headwind = +10% carry. Tailwind helps less: 16 km/h ≈ −7%.
      </p>
    `;

    document.getElementById('modal-dist-slider').addEventListener('input', e => {
      const d = parseInt(e.target.value);
      document.getElementById('plays-as-display').textContent = formatPlaysAs(d);
    });
  }

  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

function setGustMode(val) {
  useGusts = val;
  localStorage.setItem('useGusts', val);
  updateToggleUI();
  updateWindDisplay();
  effectPct = null; // force effect re-render with new source
  updateEffect();
}

function updateToggleUI() {
  document.querySelectorAll('.toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === (useGusts ? 'gusts' : 'wind'));
  });
}

// ── Helpers ────────────────────────────────────────────────────────────
function toCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
