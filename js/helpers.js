export const REFERENCE_DIST = 150;

export function toCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function hourLabel(h) {
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function tempAdjPct(temp) {
  // ~1% per 5.5°C from 20°C baseline (air density effect on carry distance)
  return Math.round((temp - 20) / 5.5);
}

export const playsAs = (dist, pct) => Math.round(dist * (1 + pct / 100));

export const effectColor = pct => pct > 0 ? '#f87171' : pct < 0 ? '#34d399' : '#888';

export function clubCount(pct) {
  return Math.round(Math.abs(REFERENCE_DIST * pct / 100) / 15);
}

export function clubLabel(pct) {
  const clubs = clubCount(pct);
  if (clubs === 0) return 'no change';
  return `${pct > 0 ? '+' : '-'}${clubs} ${clubs === 1 ? 'club' : 'clubs'}`;
}

export function getNextHours(hourlyForecast, count) {
  const now     = new Date();
  const nowDay  = now.getDate();
  const nowHour = now.getHours();

  const idx = hourlyForecast.time.findIndex(t => {
    const day  = parseInt(t.slice(8, 10), 10);
    const hour = parseInt(t.slice(11, 13), 10);
    return day > nowDay || (day === nowDay && hour >= nowHour);
  });
  if (idx === -1) return [];

  return Array.from({ length: count }, (_, i) => {
    const j = idx + i;
    if (j >= hourlyForecast.time.length) return null;
    return {
      label:      hourLabel(parseInt(hourlyForecast.time[j].slice(11, 13), 10)),
      windSpeed:  Math.round(hourlyForecast.wind_speed_10m[j]),
      windDir:    toCardinal(hourlyForecast.wind_direction_10m[j]),
      windGust:   Math.round(hourlyForecast.wind_gusts_10m[j]),
      temp:       Math.round(hourlyForecast.temperature_2m[j]),
      precipProb: hourlyForecast.precipitation_probability[j],
    };
  }).filter(Boolean);
}

export function precipSummary(hours) {
  if (!hours.length) return null;
  const maxProb     = Math.max(...hours.map(h => h.precipProb));
  const firstWetIdx = hours.findIndex(h => h.precipProb >= 50);
  if (maxProb < 20)      return { text: 'Dry conditions expected',                                color: '#22c55e' };
  if (firstWetIdx === 0) return { text: `${hours[0].precipProb}% chance of rain now`,             color: '#60a5fa' };
  if (firstWetIdx > 0)   return { text: `Dry now · rain likely from ${hours[firstWetIdx].label}`, color: '#f59e0b' };
  return                        { text: `Low chance of rain (up to ${maxProb}%)`,                 color: '#f59e0b' };
}
