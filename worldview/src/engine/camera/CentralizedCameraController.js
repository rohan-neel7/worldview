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
    if (!this.viewer || this.viewer.isDestroyed?.()) return;
    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;
    const dest = this.history.world || GLOBAL_CAMERA_VIEW;

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
    if (!this.viewer || this.viewer.isDestroyed?.() || !country?.center) return;
    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;
    const { lat, lon } = country.center;
    const alt = country.defaultAlt || 4500000;

    this.history.country = { lat, lon, alt, heading: 0, pitch: -80, roll: 0 };

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
    if (!this.viewer || this.viewer.isDestroyed?.() || !flight) return;
    const lat = flight.lat || flight.latitude;
    const lon = flight.lon || flight.longitude;
    if (lat == null || lon == null) return;

    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;

    // Determine altitude based on flight cruising level + operational radius buffer
    const flightAlt = Number(flight.altitude || flight.alt) || 10000;
    const targetAlt = options.altitude || Math.max(22000, Math.min(65000, flightAlt * 2.2 + 15000));
    const headingDeg = flight.heading != null ? Number(flight.heading) : 0;
    const pitch = options.pitch != null ? options.pitch : -50;
    const duration = options.duration || 2.0;

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
   * Calculates altitude and tactical POV to fully frame the isoseismal / crisis circle perimeter.
   *
   * @param {object|number} crisisOrLat - Crisis object or latitude number
   * @param {number} [lonOrRadius] - Longitude number or radius in meters
   * @param {object} [options={}]
   */
  flyToCrisisRadius(crisisOrLat, lonOrRadius, options = {}) {
    if (!this.viewer || this.viewer.isDestroyed?.()) return;
    this.cancelActiveFlight();
    const flightId = ++this.activeFlightId;

    let lat = 0;
    let lon = 0;
    let radiusMeters = 50000;
    let mag = 5.5;

    if (typeof crisisOrLat === 'object' && crisisOrLat !== null) {
      const c = crisisOrLat;
      lat = c.location?.lat != null ? c.location.lat : c.lat;
      lon = c.location?.lon != null ? c.location.lon : c.lon;
      mag = c.magnitude || c.metrics?.magnitude || 5.5;

      // Extract effective radius from impact shaking zones or severity
      if (c.impactData?.shakingZones?.moderateRadiusKm) {
        radiusMeters = c.impactData.shakingZones.moderateRadiusKm * 1000 * 1.35;
      } else if (c.impactData?.shakingZones?.lightRadiusKm) {
        radiusMeters = c.impactData.shakingZones.lightRadiusKm * 1000 * 0.9;
      } else if (c.severity === 'CRITICAL') {
        radiusMeters = 70000 * 1.3;
      } else if (c.severity === 'HIGH') {
        radiusMeters = 45000 * 1.3;
      } else if (c.severity === 'MODERATE') {
        radiusMeters = 30000 * 1.3;
      } else {
        radiusMeters = 18000 * 1.3;
      }
    } else {
      lat = Number(crisisOrLat);
      lon = Number(lonOrRadius);
      radiusMeters = options.radiusMeters || 50000;
    }

    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

    // Field-of-view based altitude calculation: frames the entire radius in viewport
    // Altitude = radius / tan(FOV/2) * margin ≈ radius * 2.2
    const targetAlt = options.altitude || Math.max(140000, Math.min(1200000, radiusMeters * 2.25));
    const duration = options.duration || (targetAlt > 600000 ? 2.4 : 1.9);
    const pitch = options.pitch != null ? options.pitch : -55;

    this.history.incident = { lat, lon, alt: targetAlt, heading: 0, pitch, roll: 0 };

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
