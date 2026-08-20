/**
 * Centralized Camera Controller
 * Single authoritative manager for Cesium camera operations, viewpoint history,
 * dynamic radius framing calculations, and interruption-safe geographic transitions.
 *
 * Ensures camera POV is always properly positioned and angled to frame the exact radius
 * of clicked objects (flights, crises, isoseismals, and exposed assets).
 */

import * as Cesium from 'cesium';

export const GLOBAL_CAMERA_VIEW = {
  lon: 20,
  lat: 20,
  alt: 22000000,
  heading: 0,
  pitch: -90,
  roll: 0,
};

export class CentralizedCameraController {
  constructor(viewer = null) {
    this.viewer = viewer;
    this.history = {
      world: { ...GLOBAL_CAMERA_VIEW },
      country: null,
      incident: null,
    };
    this.activeFlightId = 0;
  }

  /**
   * Bind active Cesium Viewer instance
   */
  setViewer(viewer) {
    this.viewer = viewer;
  }

  /**
   * Cancel any in-progress camera flight safely
   */
  cancelActiveFlight() {
    if (!this.viewer || this.viewer.isDestroyed?.()) return;
    try {
      this.viewer.camera.cancelFlight();
      this.viewer.trackedEntity = undefined;
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    } catch (_e) {}
  }

  /**
   * Capture current camera state into history
   * @param {'world' | 'country' | 'incident'} slot
   */
  saveSnapshot(slot = 'world') {
    if (!this.viewer || this.viewer.isDestroyed?.()) return;
    try {
      const c = this.viewer.camera.positionCartographic;
      if (c) {
        this.history[slot] = {
          lat: Cesium.Math.toDegrees(c.latitude),
          lon: Cesium.Math.toDegrees(c.longitude),
          alt: c.height,
          heading: Cesium.Math.toDegrees(this.viewer.camera.heading),
          pitch: Cesium.Math.toDegrees(this.viewer.camera.pitch),
          roll: 0,
        };
      }
    } catch (_e) {}
  }

  /**
   * Smooth flight to Global overview
   */
  flyToGlobal(duration = 2.0) {
    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;
    const dest = this.history.world || GLOBAL_CAMERA_VIEW;

    if (!this.viewer || this.viewer.isDestroyed?.()) return;

    try {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(dest.lon, dest.lat, dest.alt),
        orientation: {
          heading: Cesium.Math.toRadians(dest.heading || 0),
          pitch: Cesium.Math.toRadians(dest.pitch || -90),
          roll: 0.0,
        },
        duration,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          if (this.activeFlightId === flightId) {
            this.saveSnapshot('world');
          }
        },
      });
    } catch (_e) {}
  }

  /**
   * Smooth flight to a Country Theater
   *
   * @param {object} country - Country definition object with center and defaultAlt
   * @param {number} [duration=2.2]
   */
  flyToCountry(country, duration = 2.2) {
    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;
    if (!country?.center) return;
    const { lat, lon } = country.center;
    const alt = country.defaultAlt || 4500000;

    this.history.country = { lat, lon, alt, heading: 0, pitch: -80, roll: 0 };

    if (!this.viewer || this.viewer.isDestroyed?.()) return;

    try {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        orientation: {
          heading: 0.0,
          pitch: Cesium.Math.toRadians(-80),
          roll: 0.0,
        },
        duration,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          if (this.activeFlightId === flightId) {
            this.saveSnapshot('country');
          }
        },
      });
    } catch (_e) {}
  }

  /**
   * FLIGHTS SIDE: Fly camera to point at aircraft and its operational airspace radius
   * Positioned with tactical pitch (-45° to -55°) and heading oriented along flight trajectory.
   *
   * @param {object} flight - Flight object with { lat, lon, altitude, heading, velocity }
   * @param {object} [options={}]
   */
  flyToFlightPOV(flight, options = {}) {
    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;
    if (!flight) return;
    const lat = flight.lat || flight.latitude;
    const lon = flight.lon || flight.longitude;
    if (lat == null || lon == null) return;

    // Determine altitude based on flight cruising level + operational radius buffer
    const flightAlt = Number(flight.altitude || flight.alt) || 10000;
    const targetAlt = options.altitude || Math.max(22000, Math.min(65000, flightAlt * 2.2 + 15000));
    const headingDeg = flight.heading != null ? Number(flight.heading) : 0;
    const pitch = options.pitch != null ? options.pitch : -50;
    const duration = options.duration || 2.0;

    if (!this.viewer || this.viewer.isDestroyed?.()) return;

    try {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetAlt),
        orientation: {
          heading: Cesium.Math.toRadians(headingDeg),
          pitch: Cesium.Math.toRadians(pitch),
          roll: 0.0,
        },
        duration,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          if (this.activeFlightId === flightId) {
            options.onComplete?.();
          }
        },
      });
    } catch (_e) {}
  }

  /**
   * CRISIS SIDE: Smooth flight to point at and frame the exact radius of a Crisis event
   * Calculates adaptive altitude and tactical POV to fully frame the incident impact geometry / estimated shaking extent
   * while preserving essential country, regional, and coastal context.
   *
   * @param {object|number} crisisOrLat - Crisis object or latitude number
   * @param {number} [lonOrRadius] - Longitude number or radius in meters
   * @param {object} [options={}]
   */
  flyToCrisisRadius(crisisOrLat, lonOrRadius, options = {}) {
    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;

    let lat = 0;
    let lon = 0;
    let radiusMeters = 50000;
    let hazardType = 'EARTHQUAKE';
    let mag = 5.5;

    if (typeof crisisOrLat === 'object' && crisisOrLat !== null) {
      const c = crisisOrLat;
      lat = c.location?.lat != null ? c.location.lat : (c.lat != null ? c.lat : 0);
      lon = c.location?.lon != null ? c.location.lon : (c.lon != null ? c.lon : 0);
      hazardType = (c.type || 'EARTHQUAKE').toUpperCase();
      mag = c.magnitude || c.metrics?.magnitude || c.impactData?.magnitude || 5.5;

      // Extract effective radius from impact shaking zones or severity model
      if (c.impactData?.shakingZones?.moderateRadiusKm) {
        // Full moderate-to-severe shaking perimeter with context buffer
        radiusMeters = c.impactData.shakingZones.moderateRadiusKm * 1000 * 1.8;
      } else if (c.impactData?.shakingZones?.lightRadiusKm) {
        radiusMeters = c.impactData.shakingZones.lightRadiusKm * 1000 * 1.1;
      } else if (hazardType === 'CYCLONE' || hazardType === 'FLOOD') {
        radiusMeters = 180000 * 1.5;
      } else if (c.severity === 'CRITICAL' || mag >= 7.0) {
        radiusMeters = 95000 * 1.8;
      } else if (c.severity === 'HIGH' || mag >= 6.0) {
        radiusMeters = 65000 * 1.7;
      } else if (c.severity === 'MODERATE' || mag >= 5.0) {
        radiusMeters = 40000 * 1.6;
      } else {
        radiusMeters = 25000 * 1.5;
      }
    } else {
      lat = Number(crisisOrLat);
      lon = Number(lonOrRadius);
      radiusMeters = options.radiusMeters || 50000;
    }

    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

    // Viewport-aware field-of-view calculation:
    // Vertical FOV is ~60°. To frame radius R at pitch -52°, height ~ R / tan(30°) * contextBuffer (~3.2 - 3.8)
    const contextBuffer = options.contextBuffer || 3.4;
    const computedAltitude = radiusMeters * contextBuffer;

    // Hard safety bounds:
    // Min 180,000m (never get buried in terrain texture)
    // Max 2,600,000m (never zoom out into empty space for local incidents)
    const targetAlt = options.altitude || Math.max(180000, Math.min(2600000, computedAltitude));
    const duration = options.duration || (targetAlt > 800000 ? 2.3 : 1.85);
    const pitch = options.pitch != null ? options.pitch : -52;

    this.history.incident = { lat, lon, alt: targetAlt, heading: 0, pitch, roll: 0 };

    if (!this.viewer || this.viewer.isDestroyed?.()) return;

    try {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetAlt),
        orientation: {
          heading: 0.0,
          pitch: Cesium.Math.toRadians(pitch),
          roll: 0.0,
        },
        duration,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          if (this.activeFlightId === flightId) {
            this.saveSnapshot('incident');
            options.onComplete?.();
          }
        },
      });
    } catch (_e) {}
  }

  /**
   * Smooth flight to an Incident Epicenter / Site with dynamic altitude calculation
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} [magnitude=5.5]
   * @param {object} [options={}]
   */
  flyToIncident(lat, lon, magnitude = 5.5, options = {}) {
    const mag = Math.max(3.0, Number(magnitude) || 5.0);
    // Convert magnitude to approximate severe shaking radius
    const approxRadiusMeters = Math.max(30000, Math.min(400000, Math.pow(10, 0.43 * mag - 0.25) * 1000));
    return this.flyToCrisisRadius(
      { lat, lon, magnitude: mag },
      approxRadiusMeters,
      options
    );
  }

  /**
   * Short transition to a specific asset or point of interest
   */
  flyToAsset(assetOrLat, lon = null, alt = 35000, duration = 1.2) {
    if (!this.viewer || this.viewer.isDestroyed?.()) return;
    this.cancelActiveFlight();

    let targetLat = 0;
    let targetLon = 0;
    if (typeof assetOrLat === 'object' && assetOrLat !== null) {
      targetLat = assetOrLat.lat || assetOrLat.latitude;
      targetLon = assetOrLat.lon || assetOrLat.longitude;
    } else {
      targetLat = Number(assetOrLat);
      targetLon = Number(lon);
    }

    if (targetLat == null || targetLon == null) return;

    try {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(targetLon, targetLat, alt),
        orientation: {
          heading: 0.0,
          pitch: Cesium.Math.toRadians(-50),
          roll: 0.0,
        },
        duration,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    } catch (_e) {}
  }

  /**
   * Smoothly return to the Country Theater viewpoint from an incident
   */
  returnToCountry(country = null, duration = 1.8) {
    if (this.history.country) {
      const { lat, lon, alt } = this.history.country;
      this.flyToCountry({ center: { lat, lon }, defaultAlt: alt }, duration);
    } else if (country) {
      this.flyToCountry(country, duration);
    } else {
      this.flyToGlobal(duration);
    }
  }

  /**
   * Smoothly return to the World Mode viewpoint
   */
  returnToWorld(duration = 2.0) {
    this.flyToGlobal(duration);
  }
}

export const globalCameraController = new CentralizedCameraController();
