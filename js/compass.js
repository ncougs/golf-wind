const BUFFER_SIZE   = 6;
const headingBuffer = [];

function circularMean(angles) {
  const rad = Math.PI / 180;
  let sinSum = 0, cosSum = 0;
  for (const a of angles) {
    sinSum += Math.sin(a * rad);
    cosSum += Math.cos(a * rad);
  }
  return (Math.atan2(sinSum, cosSum) / rad + 360) % 360;
}

export function setupCompass(onHeadingChange) {
  function handleOrientation(event) {
    // webkitCompassHeading = iOS true compass bearing (preferred)
    // alpha = standard, but 0 is arbitrary on many Android devices
    const raw = event.webkitCompassHeading != null
      ? event.webkitCompassHeading
      : (360 - (event.alpha || 0)) % 360;

    headingBuffer.push(raw);
    if (headingBuffer.length > BUFFER_SIZE) headingBuffer.shift();
    onHeadingChange(circularMean(headingBuffer));
  }

  const needsPermission =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  if (!needsPermission) {
    window.addEventListener('deviceorientation', handleOrientation, true);
  }

  return {
    needsPermission,
    requestPermission: async () => {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === 'granted') {
        window.addEventListener('deviceorientation', handleOrientation, true);
        return true;
      }
      return false;
    },
  };
}
