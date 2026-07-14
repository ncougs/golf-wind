import { toCardinal, effectColor, clubCount, playsAs, REFERENCE_DIST } from './helpers.js';

const windSpeedEl     = document.getElementById('wind-speed');
const windDirEl       = document.getElementById('wind-dir');
const updatedEl       = document.getElementById('updated');
const effectDistEl    = document.getElementById('effect-dist');
const effectPlaysAsEl = document.getElementById('effect-plays-as');
const effectDistDirEl = document.getElementById('effect-dist-dir');
const arrowEl         = document.getElementById('arrow');

let arrowLoaded = false;

export function renderWindDisplay(wind, weather, useGusts) {
  const activeVal  = useGusts ? wind.gustKmh : wind.speedKmh;
  const otherLabel = useGusts ? `wind ${wind.speedKmh}` : `gusts ${wind.gustKmh}`;

  if (windSpeedEl.textContent !== String(activeVal)) {
    windSpeedEl.classList.remove('changing');
    void windSpeedEl.offsetWidth; // force reflow to restart animation
    windSpeedEl.classList.add('changing');
  }
  windSpeedEl.style.color = '#fff';
  windSpeedEl.textContent = String(activeVal);
  windDirEl.textContent   = `from ${toCardinal(wind.fromDeg)} · ${otherLabel} km/h`;
  updatedEl.textContent   = `Updated ${weather.lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function renderEffectCard(effect) {
  const { pct } = effect;
  const clubs = clubCount(pct);

  if (pct === 0 || clubs === 0) {
    effectDistEl.textContent    = 'no change';
    effectDistEl.style.color    = '#888';
    effectPlaysAsEl.textContent = '';
    effectDistDirEl.textContent = '';
    return;
  }

  const label = clubs === 1 ? 'club' : 'clubs';
  effectDistEl.textContent    = `${pct > 0 ? '+' : '-'}${clubs} ${label}`;
  effectDistEl.style.color    = effectColor(pct);
  effectPlaysAsEl.textContent = `${REFERENCE_DIST}m plays as ${playsAs(REFERENCE_DIST, pct)}m`;
  effectDistDirEl.textContent = pct > 0 ? 'into wind' : 'downwind';
}

export function renderArrow(windGoingDeg, deviceHeading) {
  if (!arrowLoaded) {
    arrowEl.classList.remove('loading');
    arrowLoaded = true;
  }
  arrowEl.style.transform = windGoingDeg != null
    ? `rotate(${windGoingDeg - deviceHeading}deg)`
    : '';
}

export function renderToggle(useGusts) {
  document.querySelectorAll('.toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === (useGusts ? 'gusts' : 'wind'));
  });
}
