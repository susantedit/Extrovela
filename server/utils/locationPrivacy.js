/**
 * EXTROVELA — Location Privacy & Transformation Utilities
 * 
 * Protects users by fuzzing exact GPS coordinates before storing or transmitting,
 * preventing exact residential/private location leakage.
 */

/**
 * Fuzzes coordinates to ~500m radius to preserve privacy
 * @param {number} lat
 * @param {number} lng
 * @returns {{ lat: number, lng: number }}
 */
export function fuzzCoordinates(lat, lng) {
  // 0.005 degrees is approx ~500 meters
  const latOffset = (Math.random() - 0.5) * 0.005;
  const lngOffset = (Math.random() - 0.5) * 0.005;

  return {
    lat: Number((lat + latOffset).toFixed(4)),
    lng: Number((lng + lngOffset).toFixed(4)),
  };
}

/**
 * Validates if coordinates are in a safe format
 */
export function isValidCoordinate(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
}
