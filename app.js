import { state }                                                          from './js/state.js';
import { getCoords, fetchWind }                                            from './js/api.js';
import { setupCompass }                                                    from './js/compass.js';
import { computeEffect }                                                   from './js/effect.js';
import { renderWindDisplay, renderEffectCard, renderArrow, renderToggle }  from './js/render.js';
import { openModal, closeModal, setupModalSwipe }                          from './js/modal.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

const statusEl   = document.getElementById('status');
const refreshBtn = document.getElementById('refresh-btn');

// ── Wind loading ────────────────────────────────────────────────────────

async function loadWind() {
  refreshBtn.disabled    = true;
  refreshBtn.textContent = 'Refreshing…';
  try {
    const { lat, lng } = await getCoords();
    await fetchWind(lat, lng);
    renderWindDisplay(state.wind, state.weather, state.settings.useGusts);
    refreshEffect();
    statusEl.textContent = state.deviceHeading !== null
      ? 'Point at your target'
      : 'Waiting for compass...';
  } catch (err) {
    // GeolocationPositionError has a numeric .code; fetch errors do not
    statusEl.textContent = err.code
      ? `Location error: ${err.message}`
      : 'Wind data unavailable';
  } finally {
    refreshBtn.disabled    = false;
    refreshBtn.textContent = 'Refresh';
  }
}

// ── Effect ──────────────────────────────────────────────────────────────

function refreshEffect() {
  if (!state.wind || state.deviceHeading === null) return;

  const activeKmh = state.settings.useGusts ? state.wind.gustKmh : state.wind.speedKmh;
  const next      = computeEffect(state.wind.goingDeg, state.deviceHeading, activeKmh, state.settings.shotDistance);
  const prev      = state.effect;

  // Always update state so modals read current headwind/crosswind values,
  // but skip re-rendering the card if the displayed values haven't changed.
  state.effect = next;
  if (prev && next.pct === prev.pct && next.driftM === prev.driftM && next.driftDir === prev.driftDir) return;
  renderEffectCard(next);
}

// ── Compass ─────────────────────────────────────────────────────────────

let compassStarted = false;

function onHeadingChange(heading) {
  state.deviceHeading = heading;
  renderArrow(state.wind?.goingDeg ?? null, heading);
  refreshEffect();
  if (!compassStarted) {
    compassStarted = true;
    if (statusEl.textContent === 'Waiting for compass...') {
      statusEl.textContent = 'Point at your target';
    }
  }
}

// ── Settings ────────────────────────────────────────────────────────────

function setGustMode(useGusts) {
  state.settings.useGusts = useGusts;
  localStorage.setItem('useGusts', useGusts);
  renderToggle(useGusts);
  if (state.wind) renderWindDisplay(state.wind, state.weather, useGusts);
  state.effect = null; // force re-render with new source
  refreshEffect();
}

// ── Init ────────────────────────────────────────────────────────────────

function init() {
  loadWind();
  setInterval(loadWind, 5 * 60 * 1000);

  refreshBtn.addEventListener('click', loadWind);

  document.getElementById('forecast-btn').addEventListener('click', () =>
    openModal('forecast', { weather: state.weather }),
  );

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.modal === 'distance' && !state.effect) {
        statusEl.textContent = 'Wind data still loading…';
        return;
      }
      openModal(card.dataset.modal, {
        effect:       state.effect,
        shotDistance: state.settings.shotDistance,
        weather:      state.weather,
      });
    });
  });

  const overlayEl = document.getElementById('modal-overlay');
  document.getElementById('modal-close').addEventListener('click', closeModal);
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) closeModal(); });
  setupModalSwipe();

  document.querySelectorAll('.toggle-opt').forEach(btn => {
    btn.addEventListener('click', () => setGustMode(btn.dataset.val === 'gusts'));
  });
  renderToggle(state.settings.useGusts);

  const compass = setupCompass(onHeadingChange);
  if (compass.needsPermission) {
    const compassBtn = document.getElementById('compass-btn');
    compassBtn.style.display = 'inline-block';
    statusEl.textContent = 'Tap "Enable compass" to orient the arrow';
    compassBtn.addEventListener('click', async () => {
      try {
        const granted = await compass.requestPermission();
        compassBtn.style.display = 'none';
        statusEl.textContent = granted ? 'Point at your target' : 'Compass permission denied';
      } catch {
        statusEl.textContent = 'Could not enable compass';
      }
    });
  }
}

init();
