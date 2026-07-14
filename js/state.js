export const state = {
  wind: null,     // { fromDeg, goingDeg, speedKmh, gustKmh }
  weather: null,  // { temp, hourlyForecast, lastFetch }
  deviceHeading: null,
  effect: null,   // { headwind, crosswind, pct, driftM, driftDir, activeKmh }
  settings: {
    useGusts:    localStorage.getItem('useGusts') !== 'false',
    shotDistance: parseInt(localStorage.getItem('shotDistance') || '150'),
  },
};
