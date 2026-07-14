# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Golf Wind is a vanilla JS Progressive Web App (PWA) for golfers. It shows real-time wind speed/direction and calculates shot distance adjustments based on where the golfer is pointing their phone.

There is no build system, no package manager, and no framework. The app is plain HTML/CSS/JS served directly from the root.

## Files

- `index.html` — Single-page shell with static DOM structure
- `app.js` — All application logic (state, API calls, compass, effect calculations)
- `style.css` — All styles; uses CSS custom properties defined in `:root`
- `sw.js` — Service worker: cache-first for assets, network-first for open-meteo API
- `manifest.json` — PWA manifest

## Development

Open `index.html` directly in a browser or serve the root directory with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

There are no tests, no linting config, and no CI.

## Architecture

**State** lives in module-level variables in `app.js`:
- `windFromDeg` / `windGoingDeg` — wind direction (meteorological convention: FROM, then converted to GOING by +180°)
- `windSpeedKmh` / `windGustKmh` — from open-meteo API
- `deviceHeading` — smoothed compass bearing (circular mean over last 6 samples)
- `effectHeadwind`, `effectCrosswind`, `effectPct`, `effectDriftM` — cached computed values shared between the card display and the modal

**Data flow:**
1. `getLocationAndWind()` → browser geolocation → `fetchWind(lat, lng)` → open-meteo API
2. Auto-refreshes every 5 minutes
3. `DeviceOrientationEvent` → `onOrientation()` → `circularMean()` → `updateArrow()` → `updateEffect()`
4. `updateEffect()` computes headwind/crosswind components using the angle between `windGoingDeg` and `deviceHeading`

**Wind effect math** (`updateEffect()`):
- Headwind component: `-active * cos(angleDiff)` (positive = into wind)
- Distance adjustment: 10% per 16 km/h headwind, 7% per 16 km/h tailwind
- Club change: ~15m per club at 150m reference distance
- Crosswind drift: `|crosswind| * 5/16 * (shotDistance/150)` meters

**iOS compass**: requires `DeviceOrientationEvent.requestPermission()` gesture — handled by the `#compass-btn` which is hidden on non-iOS browsers.

**Modal**: Bottom sheet triggered by tapping the Distance card. Contains a distance slider (50–300m) that recalculates `playsAs` live using the cached `effectPct`.

**LocalStorage keys**:
- `useGusts` — boolean (default `true`), whether to use gust speed for effect calculation
- `shotDistance` — integer meters (default 150), persisted shot distance preference (currently read on init but slider changes are not saved back)

**Service worker cache name** is hardcoded as `golf-wind-v1` in `sw.js` — increment this string when deploying asset changes that need cache busting.
