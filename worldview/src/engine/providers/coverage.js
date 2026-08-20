/**
 * Worldview Data Fabric — Geographic Coverage Model
 *
 * Evaluates whether a provider can supply useful data for a given location.
 * Reuses existing geo utilities from the codebase — does not duplicate logic.
 */

import { CoverageType } from './providerTypes.js';

/**
 * Check if a point is within a bounding box.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{ minLat: number, maxLat: number, minLon: number, maxLon: number }} bbox
 * @returns {boolean}
 */
export function isWithinBbox(lat, lon, bbox) {
  if (!bbox || typeof bbox !== 'object') return false;
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

/**
 * Check if a point is within a threshold radius of a center point.
 * Uses Haversine approximation for distance.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {{ lat: number, lon: number }} center
 * @param {number} [radiusKm=100]
 * @returns {boolean}
 */
export function isWithinRadius(lat, lon, center, radiusKm = 100) {
  if (!center || typeof center.lat !== 'number' || typeof center.lon !== 'number') return false;

  const R = 6371; // Earth radius in km
  const dLat = ((center.lat - lat) * Math.PI) / 180;
  const dLon = ((center.lon - lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat * Math.PI) / 180) *
      Math.cos((center.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R * c;

  return distKm <= radiusKm;
}

/**
 * Simple bounding-box check for a country.
 * Uses the country bounds format from data/countries.js:
 *   { latMin, latMax, lonMin, lonMax }
 *
 * @param {number} lat
 * @param {number} lon
 * @param {object} countryBounds - { latMin, latMax, lonMin, lonMax }
 * @returns {boolean}
 */
function isWithinCountryBounds(lat, lon, countryBounds) {
  if (!countryBounds) return false;
  return (
    lat >= countryBounds.latMin &&
    lat <= countryBounds.latMax &&
    lon >= countryBounds.lonMin &&
    lon <= countryBounds.lonMax
  );
}

// Country bounding boxes for registry coverage checks.
// Only the countries referenced by planned/current providers are needed here.
// This avoids importing the full countries.js data module (which may have React dependencies).
const COUNTRY_BOUNDS = {
  IN: { latMin: 6.5, latMax: 35.5, lonMin: 68.0, lonMax: 97.5 },
  US: { latMin: 24.5, latMax: 49.5, lonMin: -125.0, lonMax: -66.5 },
  ID: { latMin: -11.0, latMax: 6.0, lonMin: 95.0, lonMax: 141.0 },
  JP: { latMin: 24.0, latMax: 46.0, lonMin: 123.0, lonMax: 146.0 },
  TR: { latMin: 36.0, latMax: 42.0, lonMin: 26.0, lonMax: 45.0 },
  PH: { latMin: 5.0, latMax: 20.0, lonMin: 117.0, lonMax: 127.0 },
};

/**
 * Evaluates whether a provider's coverage includes a given location.
 *
 * @param {object} providerDef - Provider definition with coverage section
 * @param {{ lat: number, lon: number }} location
 * @returns {boolean} True if the provider can supply data for this location
 */
export function matchesCoverage(providerDef, location) {
  if (!providerDef?.coverage || !location) return false;
  if (typeof location.lat !== 'number' || typeof location.lon !== 'number') return false;

  const { type, countries, bbox } = providerDef.coverage;
  const { lat, lon } = location;

  switch (type) {
    case CoverageType.GLOBAL:
      return true;

    case CoverageType.COUNTRY:
      if (!Array.isArray(countries) || countries.length === 0) return false;
      return countries.some((countryId) => {
        const bounds = COUNTRY_BOUNDS[countryId];
        return bounds ? isWithinCountryBounds(lat, lon, bounds) : false;
      });

    case CoverageType.BBOX:
      return isWithinBbox(lat, lon, bbox);

    case CoverageType.POINT:
      // Point coverage: check if within a reasonable radius
      if (bbox && typeof bbox.lat === 'number' && typeof bbox.lon === 'number') {
        return isWithinRadius(lat, lon, bbox, bbox.radiusKm || 50);
      }
      return false;

    case CoverageType.REGION:
      // Region: use bbox if provided, otherwise permissive
      return bbox ? isWithinBbox(lat, lon, bbox) : true;

    case CoverageType.POLYGON:
      // Polygon coverage: point-in-polygon is complex, defer to permissive default
      // A future phase can implement proper point-in-polygon if needed
      return true;

    case CoverageType.UNKNOWN:
      // Permissive default — don't exclude providers with unknown coverage
      return true;

    default:
      return true;
  }
}
