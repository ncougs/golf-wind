import { REFERENCE_DIST } from './helpers.js';

export function computeEffect(windGoingDeg, deviceHeading, activeKmh, shotDistance) {
  const angleDiffRad = (windGoingDeg - deviceHeading) * Math.PI / 180;
  const headwind     = -activeKmh * Math.cos(angleDiffRad);
  const crosswind    =  activeKmh * Math.sin(angleDiffRad);

  // 10% per 16 km/h headwind, 7% per 16 km/h tailwind
  const pct = headwind >= 0
    ? Math.round(headwind / 160 * 100)
    : Math.round(headwind / 230 * 100);

  return {
    headwind,
    crosswind,
    pct,
    driftM:   Math.round(Math.abs(crosswind) * 0.3125 * (shotDistance / REFERENCE_DIST)),
    driftDir: crosswind > 0 ? 'left' : 'right',
  };
}
