import { state } from './state.js';

const devParams = new URLSearchParams(location.search);
const DEV_LAT   = parseFloat(devParams.get('lat')) || null;
const DEV_LNG   = parseFloat(devParams.get('lng')) || null;

export function getCoords() {
  if (DEV_LAT && DEV_LNG) return Promise.resolve({ lat: DEV_LAT, lng: DEV_LNG });

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 10000 },
    );
  });
}

export async function fetchWind(lat, lng) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability` +
    `&wind_speed_unit=kmh&forecast_hours=8&timezone=auto`;

  const res  = await fetch(url);
  const data = await res.json();

  const fromDeg  = data.current.wind_direction_10m;
  state.wind = {
    fromDeg,
    goingDeg: (fromDeg + 180) % 360,
    speedKmh: Math.round(data.current.wind_speed_10m),
    gustKmh:  Math.round(data.current.wind_gusts_10m),
  };
  state.weather = {
    temp:           Math.round(data.current.temperature_2m),
    hourlyForecast: data.hourly,
    lastFetch:      new Date(),
  };
}
