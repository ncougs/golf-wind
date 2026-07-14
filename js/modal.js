import { getNextHours, precipSummary, tempAdjPct, effectColor, clubLabel, playsAs, REFERENCE_DIST } from './helpers.js';

const overlay = document.getElementById('modal-overlay');
const titleEl = document.getElementById('modal-title');
const bodyEl  = document.getElementById('modal-body');
const modal   = document.getElementById('modal');

export function openModal(type, data) {
  modal.style.transform = '';

  if (type === 'distance') {
    titleEl.textContent = 'Distance';
    bodyEl.innerHTML    = buildDistanceContent(data.effect, data.shotDistance);
    wireDistanceSlider(data.effect.pct);
  } else if (type === 'forecast') {
    titleEl.textContent = 'Forecast';
    bodyEl.innerHTML    = buildForecastContent(data.weather);
  }

  overlay.classList.add('open');
}

export function closeModal() {
  overlay.classList.remove('open');
}

export function setupModalSwipe() {
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
      modal.style.transform  = 'translateY(100%)';
      setTimeout(() => {
        modal.style.transition = '';
        modal.style.transform  = '';
        overlay.classList.remove('open');
      }, 250);
    } else {
      modal.style.transition = '';
      modal.style.transform  = '';
    }
  });
}

// ── Content builders ────────────────────────────────────────────────────

function wireDistanceSlider(pct) {
  const fromEl   = bodyEl.querySelector('#modal-calc-from');
  const toEl     = bodyEl.querySelector('#modal-calc-to');
  bodyEl.querySelector('#modal-dist-slider').addEventListener('input', e => {
    const d    = parseInt(e.target.value, 10);
    fromEl.textContent = `${d}m`;
    toEl.textContent   = `${playsAs(d, pct)}m`;
  });
}

function buildDistanceContent(effect, shotDistance) {
  const { headwind, pct } = effect;
  const direction = pct > 0 ? 'headwind' : pct < 0 ? 'tailwind' : 'neutral';
  const hw        = Math.abs(Math.round(headwind));
  const color     = effectColor(pct);
  const label     = clubLabel(pct);

  return `
    <div class="modal-stats">
      <div class="modal-stat">
        <div class="modal-stat-value" style="color:${color}">${hw} km/h</div>
        <div class="modal-stat-label">${direction}</div>
      </div>
      <div class="modal-stat-divider"></div>
      <div class="modal-stat">
        <div class="modal-stat-value" style="color:${color}">${label}</div>
        <div class="modal-stat-label">adjustment</div>
      </div>
    </div>
    <div class="modal-calc">
      <div class="modal-calc-display">
        <div class="modal-calc-col">
          <span class="modal-calc-from" id="modal-calc-from">${shotDistance}m</span>
          <span class="modal-calc-col-label">actual</span>
        </div>
        <span class="modal-calc-arrow">→</span>
        <div class="modal-calc-col">
          <span class="modal-calc-to" id="modal-calc-to" style="color:${color}">${playsAs(shotDistance, pct)}m</span>
          <span class="modal-calc-col-label">playing</span>
        </div>
      </div>
      <div class="dist-slider-wrap">
        <input type="range" id="modal-dist-slider" min="50" max="300" step="5" value="${shotDistance}">
        <div class="dist-slider-labels"><span>50m</span><span>300m</span></div>
      </div>
    </div>`;
}

function buildForecastContent(weather) {
  if (!weather?.hourlyForecast) {
    return `<p class="modal-placeholder">Fetching forecast…</p>`;
  }

  const hours  = getNextHours(weather.hourlyForecast, 6);
  const precip = precipSummary(hours);

  const hoursHTML = hours.map((h, i) => {
    const precipColor = h.precipProb >= 50 ? '#60a5fa' : h.precipProb >= 20 ? '#f59e0b' : 'var(--text-muted)';
    const precipLabel = h.precipProb < 20 ? 'Dry' : `${h.precipProb}% rain`;
    return `
      <div class="forecast-row${i === 0 ? ' forecast-row--now' : ''}">
        <span class="fr-time">${i === 0 ? 'Now' : h.label}</span>
        <span class="fr-dir">${h.windDir}</span>
        <div class="fr-wind-col">
          <span class="fr-speed">${h.windSpeed} km/h</span>
          <span class="fr-gust">gusts ${h.windGust}</span>
        </div>
        <span class="fr-temp">${h.temp}°</span>
        <span class="fr-rain" style="color:${precipColor}">${precipLabel}</span>
      </div>`;
  }).join('');

  const adjPct    = tempAdjPct(weather.temp);
  const tempColor = adjPct > 0 ? '#34d399' : adjPct < 0 ? '#60a5fa' : 'var(--text-muted)';
  const tempSign  = adjPct > 0 ? '+' : '';
  const tempNote  = adjPct === 0
    ? 'No significant distance effect'
    : `${REFERENCE_DIST}m plays as ${playsAs(REFERENCE_DIST, adjPct)}m in current air`;

  const precipHTML = precip
    ? `<div class="forecast-precip-row">
        <span class="forecast-precip-dot" style="background:${precip.color}"></span>
        <span class="forecast-precip-text">${precip.text}</span>
      </div>`
    : '<p class="modal-placeholder">Loading…</p>';

  return `
    <p class="modal-section-label">NEXT 6 HOURS</p>
    <div class="forecast-hours">${hoursHTML}</div>
    <p class="modal-section-label">TEMPERATURE</p>
    <div class="forecast-temp-row">
      <span class="forecast-temp-val">${weather.temp}°C</span>
      <div class="forecast-temp-info">
        <span class="forecast-temp-adj" style="color:${tempColor}">${tempSign}${adjPct}% carry distance</span>
        <span class="forecast-temp-note">${tempNote}</span>
      </div>
    </div>
    <p class="modal-section-label">RAIN OUTLOOK</p>
    ${precipHTML}`;
}
