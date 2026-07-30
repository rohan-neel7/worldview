import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';
import { useWorldView } from '../WorldViewContext';
import { 
  Plane, 
  Ship as ShipIcon, 
  Orbit, 
  Activity, 
  X, 
  Navigation,
  AlertTriangle
} from 'lucide-react';

// ── Visual Preset Shaders ──
const PRESET_SHADERS = {
  CRT: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      // Barrel distortion for CRT curvature
      vec2 uv = v_textureCoordinates;
      vec2 dc = uv - 0.5;
      uv = uv + dc * dot(dc, dc) * 0.06;

      vec4 color = texture(colorTexture, uv);

      // Warm amber-phosphor color grade
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

      // Boost contrast with S-curve
      float contrast = clamp((luma - 0.5) * 1.3 + 0.5, 0.0, 1.0);

      // CRT phosphor warmth: amber/warm tone
      vec3 graded = vec3(
        clamp(color.r * 1.12 + 0.02, 0.0, 1.0),
        clamp(color.g * 1.02, 0.0, 1.0),
        clamp(color.b * 0.78, 0.0, 1.0)
      );

      // Subtle saturation boost
      graded = mix(vec3(luma), graded, 1.25);

      // Scanlines — smooth and subtle
      float scanline = sin(uv.y * 600.0) * 0.04 + 1.0;
      graded *= scanline;

      // Vignette — darker edges like a real CRT
      float vig = 1.0 - dot(dc, dc) * 1.8;
      vig = clamp(vig, 0.0, 1.0);
      graded *= vig;

      // Slight glow on bright areas
      float highlight = max(luma - 0.6, 0.0) * 0.15;
      graded += highlight;

      out_FragColor = vec4(clamp(graded, 0.0, 1.0), color.a);
    }
  `,
  NVG: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);

      // Luminance from original image
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

      // Gamma lift — real NVGs amplify ALL light including shadows
      // This makes dark terrain/ocean visible without washing out
      float lifted = pow(luma, 0.55);

      // Contrast S-curve to keep detail separation crisp
      float detail = smoothstep(0.0, 1.0, lifted);

      // Rich phosphor green palette with subtle tint variation
      // Brighter areas get warmer (slightly yellow-green)
      // Darker areas stay cooler (blue-green)
      vec3 nvg = vec3(
        detail * 0.08 + lifted * 0.04,
        detail * 0.85 + lifted * 0.15,
        detail * 0.12 + (1.0 - lifted) * 0.06
      );

      // Circular vignette — NVG tube optics
      vec2 center = v_textureCoordinates - 0.5;
      float dist = length(center);
      float vignette = 1.0 - smoothstep(0.35, 0.7, dist);
      nvg *= vignette;

      // Film grain for authentic noise
      float grain = fract(sin(dot(v_textureCoordinates * 400.0, vec2(12.9898, 78.233))) * 43758.5453);
      nvg += (grain - 0.5) * 0.035;

      // Subtle scanlines
      float scan = sin(v_textureCoordinates.y * 900.0) * 0.02 + 1.0;
      nvg *= scan;

      // Phosphor bloom on highlights
      float glow = max(detail - 0.65, 0.0) * 0.4;
      nvg.g += glow;

      // Slight ambient green floor so nothing is pure black
      nvg = max(nvg, vec3(0.005, 0.015, 0.005));

      out_FragColor = vec4(clamp(nvg, 0.0, 1.0), color.a);
    }
  `,
  FLIR: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float contrast = clamp((lum - 0.4) * 2.2 + 0.5, 0.0, 1.0);
      out_FragColor = vec4(vec3(0.2, 1.4, 0.4) * contrast, color.a);
    }
  `,
  NOIR: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      out_FragColor = vec4(vec3(gray), color.a);
    }
  `,
  SNOW: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      vec3 blue = clamp(color.rgb * vec3(0.85, 0.9, 1.3) * 1.15, 0.0, 1.0);
      out_FragColor = vec4(blue, color.a);
    }
  `
};

// ── Canvas Helpers ──
const createPlaneCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.save(); ctx.translate(32, 32);
  
  // Base plane shape (white)
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.bezierCurveTo(5, -26, 5, -12, 5, -4);
  ctx.lineTo(26, 8);
  ctx.lineTo(26, 12);
  ctx.lineTo(5, 4);
  ctx.lineTo(3, 18);
  ctx.lineTo(14, 24);
  ctx.lineTo(14, 26);
  ctx.lineTo(2, 22);
  ctx.lineTo(-2, 22);
  ctx.lineTo(-14, 26);
  ctx.lineTo(-14, 24);
  ctx.lineTo(-3, 18);
  ctx.lineTo(-5, 4);
  ctx.lineTo(-26, 12);
  ctx.lineTo(-26, 8);
  ctx.lineTo(-5, -4);
  ctx.bezierCurveTo(-5, -12, -5, -26, 0, -26);
  ctx.fill();

  // Cockpit detail
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#00FFFF';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(2.5, -18, 2.5, -14, 1.5, -12);
  ctx.lineTo(-1.5, -12);
  ctx.bezierCurveTo(-2.5, -14, -2.5, -18, 0, -18);
  ctx.fill();

  ctx.restore();
  return canvas;
};

const PLANE_IMAGE_CANVAS = createPlaneCanvas();

const createSatCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.save(); ctx.translate(16, 16);
  ctx.strokeStyle = '#FFB000'; ctx.lineWidth = 1.5;
  
  // Tactical Crosshair
  ctx.beginPath();
  ctx.moveTo(0, -10); ctx.lineTo(0, -4);
  ctx.moveTo(0, 10); ctx.lineTo(0, 4);
  ctx.moveTo(-10, 0); ctx.lineTo(-4, 0);
  ctx.moveTo(10, 0); ctx.lineTo(4, 0);
  ctx.stroke();

  ctx.fillStyle = '#FFB000';
  ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
  
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();

  ctx.restore();
  return canvas;
};

const createShipCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 48; canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.save(); ctx.translate(24, 24);

  // Hull
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(7, -6);
  ctx.lineTo(7, 12);
  ctx.quadraticCurveTo(7, 18, 0, 18);
  ctx.quadraticCurveTo(-7, 18, -7, 12);
  ctx.lineTo(-7, -6);
  ctx.closePath();
  ctx.fill();

  // Bridge
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#4AF0FF';
  ctx.fillRect(-4, -2, 8, 5);

  // Mast
  ctx.strokeStyle = '#4AF0FF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, -14);
  ctx.stroke();

  ctx.restore();
  return canvas;
};

const SHIP_IMAGE_CANVAS = createShipCanvas();

// ── Satellite/Orbit Helpers ──
const extractNoradId = (tle1) => tle1?.substring(2, 7).trim() || 'N/A';

const computeOrbitPath = (tle1, tle2) => {
  const posProp = new Cesium.SampledPositionProperty();
  let length = 0;
  try {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    const now = new Date();
    const periodMins = satrec.no ? (2 * Math.PI) / satrec.no : 100;
    const gmst0 = satellite.gstime(now);
    
    // Draw from -10 mins to +period+10 mins
    for (let m = -10; m <= periodMins + 10; m += 0.5) {
      const t = new Date(now.getTime() + m * 60000);
      const pv = satellite.propagate(satrec, t);
      if (!pv.position) continue;
      const g = satellite.eciToGeodetic(pv.position, gmst0); 
      const time = Cesium.JulianDate.fromDate(t);
      const cartesian = Cesium.Cartesian3.fromDegrees(
        satellite.degreesLong(g.longitude), 
        satellite.degreesLat(g.latitude), 
        g.height * 1000
      );
      posProp.addSample(time, cartesian);
      length++;
    }
  } catch (e) {}
  return { posProp, length };
};

export default function GlobeViewer({
  flightData, satelliteData, earthquakeData, shipData,
  onViewerReady, onCountUpdate, onSatelliteSelect, onFlightSelect
}) {
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const isDestroyedRef = useRef(false);
  const flightEntitiesRef = useRef(new Map());
  const flightPointsRef = useRef(null);
  const trackerEntityRef = useRef(null);
  const satEntitiesRef = useRef(new Map());
  const googleTilesetRef = useRef(null);
  const satCollectionRef = useRef(null);
  const quakeCollectionRef = useRef(null);
  const shipCollectionRef = useRef(null);
  const shipEntitiesRef = useRef(new Map());
  const postProcessRef = useRef(null);
  const orbitEntitiesRef = useRef([]);
  const trackingActiveRef = useRef(false);

  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedQuake, setSelectedQuake] = useState(null);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [selectedShip, setSelectedShip] = useState(null);
  const [trackedFlightId, setTrackedFlightId] = useState(null);
  const [trackedSatId, setTrackedSatId] = useState(null);
  const [showTerrainLoading, setShowTerrainLoading] = useState(false);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  const { activePreset, setCameraPosition } = useWorldView();

  // ── Helpers ──
  const handleTrack = useCallback((id, isSat = false) => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    if (trackerEntityRef.current) viewerRef.current.trackedEntity = trackerEntityRef.current;
    if (isSat) setTrackedSatId(id);
    else setTrackedFlightId(id);
  }, []);

  const cleanupOrbits = useCallback(() => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    if (orbitEntitiesRef.current && orbitEntitiesRef.current.length > 0) {
      orbitEntitiesRef.current.forEach(e => {
        try { viewerRef.current.entities.remove(e); } catch(err) {}
      });
      orbitEntitiesRef.current = [];
    }
  }, []);

  const handleStopTracking = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Cancel any in-progress camera flight
    try { viewer.camera.cancelFlight(); } catch(e) {}

    viewer.trackedEntity = undefined;
    if (trackerEntityRef.current) {
      trackerEntityRef.current.viewFrom = undefined;
    }
    
    trackingActiveRef.current = false;
    setTrackedFlightId(null);
    setTrackedSatId(null);
    setSelectedFlight(null);
    setSelectedSatellite(null);
    setSelectedQuake(null);
    setSelectedShip(null);
    
    // Clean orbits synchronously
    cleanupOrbits();
    
    // Fly back to global view
    setTimeout(() => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(20, 20, 25000000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0
          },
          duration: 2.5,
          easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
        });
      }
    }, 100);
  }, [cleanupOrbits]);

  const flyTo = useCallback((lon, lat, alt = 500000) => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
      duration: 2.5
    });
  }, []);

  const selectFlightTarget = useCallback((p) => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !p) return;
    const flightId = p.icao24 || p.id;

    setSelectedFlight({
      id: flightId,
      callsign: p.callsign || p.icao24 || flightId,
      altitude: p.altitude || p.alt || 10000,
      velocity: p.velocity || 0,
      heading: p.heading || 0,
      icao: p.icao24 || flightId,
      lat: p.lat,
      lon: p.lon
    });

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 25000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      },
      duration: 2.0,
      complete: () => {
        trackingActiveRef.current = true;
        setTrackedFlightId(flightId);
      }
    });
  }, []);

  useEffect(() => {
    if (onFlightSelect) onFlightSelect(selectFlightTarget);
  }, [onFlightSelect, selectFlightTarget]);

  // ── Initialization ──
  useEffect(() => {
    if (viewerRef.current || !containerRef.current) return;
    isDestroyedRef.current = false;

    let terrainLoadingTimer;
    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false, baseLayerPicker: false, fullscreenButton: false,
      geocoder: false, homeButton: false, infoBox: false, sceneModePicker: false,
      selectionIndicator: false, timeline: false, navigationHelpButton: false,
      requestRenderMode: false, shouldAnimate: true, creditContainer: document.createElement('div'),
      baseLayer: false, imageryProvider: false,
    });
    viewerRef.current = viewer;

    // ═══════════════════════════════════
    // GLOBE LIGHTING AND ATMOSPHERE
    // ═══════════════════════════════════

    // Enable realistic sun-based day/night lighting
    viewer.scene.globe.enableLighting = true

    // Dynamic atmosphere lit by sun position
    viewer.scene.globe.dynamicAtmosphereLighting = true
    viewer.scene.globe.dynamicAtmosphereLightingFromSun = true

    // Show atmosphere glow on globe edge
    viewer.scene.skyAtmosphere.show = true
    viewer.scene.globe.showGroundAtmosphere = true

    // Atmosphere intensity
    viewer.scene.skyAtmosphere
      .atmosphereLightIntensity = 10.0

    // Show stars on dark side of globe
    viewer.scene.skyBox.show = true

    // Subtle fog for depth perception
    viewer.scene.fog.enabled = true
    viewer.scene.fog.density = 0.0002
    viewer.scene.fog.minimumBrightness = 0.03

    // High quality globe rendering
    viewer.scene.globe.maximumScreenSpaceError = 1
    viewer.scene.globe.tileCacheSize = 200
    viewer.scene.globe.preloadAncestors = true
    viewer.scene.globe.preloadSiblings = true
    viewer.resolutionScale = 1.0
    viewer.scene.fxaa = true
    viewer.scene.postProcessStages.fxaa.enabled = true

    // Make sure Cesium clock is set to 
    // current real time so sun position 
    // matches actual day/night:
    viewer.clock.currentTime = 
      Cesium.JulianDate.fromDate(new Date())
    viewer.clock.shouldAnimate = true

    // ═══════════════════════════════════
    // END GLOBE LIGHTING
    // ═══════════════════════════════════

    // Google Maps Imagery
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      maximumLevel: 20, credit: 'Google Maps'
    }));

    viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(20, 20, 20000000) });
    satCollectionRef.current = viewer.scene.primitives.add(new Cesium.BillboardCollection());
    quakeCollectionRef.current = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    flightPointsRef.current = viewer.scene.primitives.add(new Cesium.BillboardCollection());
    shipCollectionRef.current = viewer.scene.primitives.add(new Cesium.BillboardCollection());

    trackerEntityRef.current = viewer.entities.add({
      id: 'tracker-entity',
      position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(0, 0, 0)),
      point: { pixelSize: 0, show: false }
    });

    // ── Feature: Altitude Listeners (3D Tiles + Loading Overlay) ──
    const cameraListener = () => {
      if (!viewer || viewer.isDestroyed()) return;
      const alt = viewer.camera.positionCartographic.height;
      
      // 3D Tiles Logic
      if (alt < 150000 && !googleTilesetRef.current) {
        Cesium.createGooglePhotorealistic3DTileset({ key: import.meta.env.VITE_GOOGLE_MAPS_KEY })
          .then(ts => {
            if (!viewer.isDestroyed()) {
              ts.maximumScreenSpaceError = 4;
              ts.skipLevelOfDetail = true;
              ts.preferLeaves = true;
              ts.preloadWhenHidden = true;
              viewer.scene.primitives.add(ts);
              googleTilesetRef.current = ts;
            }
          });
      }
      if (alt > 300000 && googleTilesetRef.current) {
        viewer.scene.primitives.remove(googleTilesetRef.current);
        googleTilesetRef.current = null;
      }

      // Terrain Loader Overlay
      if (alt < 100000 && !showTerrainLoading) {
        setShowTerrainLoading(true);
        terrainLoadingTimer = setTimeout(
          () => setShowTerrainLoading(false), 1500
        );
      }
    };
    viewer.camera.changed.addEventListener(cameraListener);


    const onMoveEnd = () => {
      const c = viewer.camera.positionCartographic;
      setCameraPosition({ lat: Cesium.Math.toDegrees(c.latitude), lon: Cesium.Math.toDegrees(c.longitude), alt: c.height });
    };
    viewer.camera.moveEnd.addEventListener(onMoveEnd);

    // Expose flyTo
    containerRef.current.__flyTo = flyTo;

    // ── Unified Click Handler ──
    const clickHandler = (click) => {
      if (!viewer || viewer.isDestroyed()) return;
      const picked = viewer.scene.pick(click.position);
      
      if (!Cesium.defined(picked)) {
        setSelectedFlight(null); setSelectedQuake(null); setSelectedSatellite(null); setSelectedShip(null);
        handleStopTracking(); return;
      }

      // 1. Flight Primitive
      if (picked.primitive?._flightData) {
        const p = picked.primitive._flightData;
        const flightId = p.icao24 || p.id;

        setSelectedFlight({
          id: flightId,
          callsign: p.callsign || p.icao,
          altitude: p.altitude || p.alt,
          velocity: p.velocity || 0,
          heading: p.heading || 0,
          icao: p.icao || flightId,
          lat: p.lat,
          lon: p.lon
        });
        setPopupPos({ x: click.position.x, y: click.position.y });

        // STEP 1 — Fly camera down to aircraft (top-down 2D):
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 25000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0
          },
          duration: 2.0,
          complete: () => {
            // Don't use trackedEntity — we manually drive the camera in the interval
            trackingActiveRef.current = true;
            setTrackedFlightId(flightId);
          }
        });
        return;
      }

      // 2. Earthquake Primitive
      if (picked.primitive?._quakeData) {
        const q = picked.primitive._quakeData;
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(q.lon, q.lat, 2000000),
          duration: 2.0
        });
        setSelectedQuake(q);
        setSelectedFlight(null); setSelectedSatellite(null);
        setPopupPos({ x: click.position.x, y: click.position.y });
        return;
      }

      // 3. Satellite Primitive
      if (picked.primitive?._satName) {
        const sat = picked.primitive;
        const orbit = computeOrbitPath(sat._tle1, sat._tle2);
        orbitEntitiesRef.current.forEach(e => viewer.entities.remove(e));
        orbitEntitiesRef.current = [];
        
        if (orbit.length > 1) {
          const e = viewer.entities.add({
            position: orbit.posProp,
            path: {
              resolution: 1,
              material: Cesium.Color.CYAN.withAlpha(0.3),
              width: 1.5,
              leadTime: orbit.length * 30,
              trailTime: 600
            }
          });
          orbitEntitiesRef.current.push(e);
        }

        const satrec = satellite.twoline2satrec(sat._tle1, sat._tle2);
        const now = new Date();
        const pv = satellite.propagate(satrec, now);
        const velocity = pv.velocity ? Math.sqrt(pv.velocity.x**2 + pv.velocity.y**2 + pv.velocity.z**2).toFixed(2) : '--';
        const incl = satrec.inclo ? (satrec.inclo * 180 / Math.PI).toFixed(1) : '--';
        const period = satrec.no ? ((2 * Math.PI) / satrec.no).toFixed(0) : '--';

        setSelectedSatellite({ 
          id: sat._satName, name: sat._satName, tle1: sat._tle1, tle2: sat._tle2, 
          altitude: Math.round(sat._alt), satrec, lon: sat._lon, lat: sat._lat,
          velocity, incl, period
        });
        setSelectedFlight(null); setSelectedQuake(null);
        setPopupPos({ x: click.position.x, y: click.position.y });

        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(sat._lon, sat._lat, Math.max((sat._alt * 1000) + 1500000, 2000000)),
          orientation: { heading: Math.PI / 4, pitch: Cesium.Math.toRadians(-45), roll: 0.0 },
          duration: 2.5,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
          complete: () => {
             if (trackerEntityRef.current) {
               trackerEntityRef.current.viewFrom = undefined;
               trackerEntityRef.current.position = new Cesium.ConstantPositionProperty(
                 Cesium.Cartesian3.fromDegrees(sat._lon, sat._lat, sat._alt * 1000)
               );
             }
          }
        });
        return;
      }

      // 4. Ship Primitive
      if (picked.primitive?._shipData) {
        const s = picked.primitive._shipData;
        setSelectedShip(s);
        setSelectedFlight(null); setSelectedQuake(null); setSelectedSatellite(null);
        setPopupPos({ x: click.position.x, y: click.position.y });
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 50000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-60),
            roll: 0.0
          },
          duration: 2.0
        });
        return;
      }
    };
    viewer.screenSpaceEventHandler.setInputAction(clickHandler, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    if (onViewerReady) onViewerReady(viewer);

    return () => {
      isDestroyedRef.current = true;
      viewer.camera.changed.removeEventListener(cameraListener);

      if (!viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(onMoveEnd);
      }

      if (googleTilesetRef.current && !viewer.isDestroyed()) {
        viewer.scene.primitives.remove(googleTilesetRef.current);
        googleTilesetRef.current = null;
      }

      if (orbitEntitiesRef.current && !viewer.isDestroyed()) {
        orbitEntitiesRef.current.forEach(entity => {
          viewer.entities.remove(entity);
        });
        orbitEntitiesRef.current = [];
      }

      clearTimeout(terrainLoadingTimer);

      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      flightEntitiesRef.current.clear();
    };
  }, [onViewerReady, handleStopTracking, cleanupOrbits, setCameraPosition, flyTo]);

  // ── Flight Entity Updates (Dead Reckoning) ──
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !flightData) return;
    const activeIds = new Set(flightData.map(f => f.icao24 || f.id));

    if (!flightPointsRef.current) {
      flightPointsRef.current = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
    }

    flightData.forEach(f => {
      const id = f.icao24 || f.id;
      let entry = flightEntitiesRef.current.get(id);
      const pos = Cesium.Cartesian3.fromDegrees(f.lon, f.lat, Math.max(f.alt || f.altitude || 1000, 1000));
      if (!entry) {
        const point = flightPointsRef.current.add({
          position: pos,
          image: PLANE_IMAGE_CANVAS,
          width: 32, height: 32,
          scaleByDistance: new Cesium.NearFarScalar(500000, 1.2, 25000000, 0.6),
          rotation: Cesium.Math.toRadians(-(f.heading || 0)),
          eyeOffset: new Cesium.Cartesian3(0, 0, -100)
        });
        point.id = id;
        point._flightData = f;
        point._drLat = f.lat;
        point._drLon = f.lon;
        entry = { point };
        flightEntitiesRef.current.set(id, entry);
      } else {
        // API refresh: snap dead-reckoned position back to real data
        entry.point._drLat = f.lat;
        entry.point._drLon = f.lon;
        entry.point.position = pos;
        if (f.heading !== undefined) {
          entry.point.rotation = Cesium.Math.toRadians(-f.heading);
        }
        entry.point._flightData = f;
      }
    });

    // Don't remove the tracked flight even if it's not in the new data batch
    flightEntitiesRef.current.forEach((val, id) => {
      if (!activeIds.has(id) && id !== trackedFlightId) {
        if (flightPointsRef.current && flightPointsRef.current.contains(val.point)) {
          flightPointsRef.current.remove(val.point);
        }
        flightEntitiesRef.current.delete(id);
      }
    });
    onCountUpdate?.('flights', flightEntitiesRef.current.size);
  }, [flightData, onCountUpdate, trackedFlightId]);

  // ── Spawn Animation Worker ──
  const animWorkerRef = useRef(null);
  const flightIdsRef = useRef([]);
  const satIdsRef = useRef([]);
  const trackedRefs = useRef({ flight: null, sat: null, trackingActive: false });

  useEffect(() => {
    trackedRefs.current.flight = trackedFlightId;
    trackedRefs.current.sat = trackedSatId;
    trackedRefs.current.trackingActive = trackingActiveRef.current;
  }, [trackedFlightId, trackedSatId]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/animationWorker.js', import.meta.url), { type: 'module' });
    animWorkerRef.current = worker;
    worker.postMessage({ type: 'START' });

    worker.onmessage = (e) => {
      const { type } = e.data;
      if (type === 'SYNC_IDS') {
        flightIdsRef.current = e.data.flightIds;
        satIdsRef.current = e.data.satIds;
      } 
      else if (type === 'POSITIONS_FRAME') {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return;
        const buffer = e.data.buffer;
        let offset = 0;
        
        const fIds = flightIdsRef.current;
        for (let i = 0; i < fIds.length; i++) {
          const id = fIds[i];
          const entry = flightEntitiesRef.current.get(id);
          const x = buffer[offset++];
          const y = buffer[offset++];
          const z = buffer[offset++];
          const drLat = buffer[offset++];
          const drLon = buffer[offset++];
          
          if (entry && drLat && drLon) {
            const altMeters = Math.max(entry.point._flightData?.altitude || entry.point._flightData?.alt || 10000, 3000);
            entry.point.position = Cesium.Cartesian3.fromDegrees(drLon, drLat, altMeters);
            entry.point._drLat = drLat;
            entry.point._drLon = drLon;
            
            if (id === trackedRefs.current.flight && trackedRefs.current.trackingActive) {
              viewerRef.current.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(drLon, drLat, 25000),
                orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0.0 }
              });
              const latEl = document.getElementById('live-coord-lat');
              const lonEl = document.getElementById('live-coord-lon');
              if (latEl && lonEl) {
                latEl.innerText = drLat.toFixed(4);
                lonEl.innerText = drLon.toFixed(4);
              }
            }
          }
        }

        const sIds = satIdsRef.current;
        for (let i = 0; i < sIds.length; i++) {
          const id = sIds[i];
          const entry = satEntitiesRef.current.get(id);
          const x = buffer[offset++];
          const y = buffer[offset++];
          const z = buffer[offset++];
          const lat = buffer[offset++];
          const lon = buffer[offset++];
          
          if (entry && (x !== 0 || y !== 0 || z !== 0)) {
            entry.point.position = new Cesium.Cartesian3(x, y, z);
            
            if (id === trackedRefs.current.sat) {
              if (trackerEntityRef.current) {
                trackerEntityRef.current.position = new Cesium.ConstantPositionProperty(new Cesium.Cartesian3(x, y, z));
              }
              const latEl = document.getElementById('live-coord-lat');
              const lonEl = document.getElementById('live-coord-lon');
              if (latEl && lonEl) {
                latEl.innerText = lat.toFixed(4);
                lonEl.innerText = lon.toFixed(4);
              }
            }
          }
        }
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

  // Sync flight data to worker
  useEffect(() => {
    if (animWorkerRef.current && flightData) {
      const payload = flightData.map(f => ({ ...f, id: f.icao24 || f.id }));
      animWorkerRef.current.postMessage({ type: 'SYNC_FLIGHTS', payload });
    }
  }, [flightData]);

  // Sync satellite data to worker
  useEffect(() => {
    if (animWorkerRef.current && satelliteData) {
      animWorkerRef.current.postMessage({ type: 'SYNC_SATS', payload: satelliteData });
    }
  }, [satelliteData]);

  // STEP 4 — Visual Pulse Update Loop (Main Thread)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const onPreUpdate = (scene, time) => {
      const nowTime = Date.now();
      
      // Earthquake Pulse
      if (quakeCollectionRef.current) {
        const t = nowTime / 800.0;
        const pulse = (Math.sin(t) + 1) / 2;

        for (let i = 0; i < quakeCollectionRef.current.length; ++i) {
          const p = quakeCollectionRef.current.get(i);
          if (p._quakeData) {
            const baseSize = Math.max((p._quakeData.magnitude || 4) * 3, 6);
            p.pixelSize = baseSize + (pulse * baseSize * 0.4);
            p.color = Cesium.Color.RED.withAlpha(0.7 - (pulse * 0.5));
            p.outlineColor = Cesium.Color.WHITE.withAlpha(0.5 - (pulse * 0.3));
          }
        }
      }
    };

    viewer.scene.preUpdate.addEventListener(onPreUpdate);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.preUpdate.removeEventListener(onPreUpdate);
      }
    };
  }, []);

  // ── Satellite Primitive Updates ──
  useEffect(() => {
    const coll = satCollectionRef.current;
    if (!coll || !satelliteData) return;
    
    const activeSatNames = new Set(satelliteData.map(s => s.name));

    satelliteData.forEach(s => {
      let entry = satEntitiesRef.current.get(s.name);
      const pos = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, (s.alt || 400) * 1000);
      
      if (!entry) {
        const point = coll.add({
          position: pos,
          image: createSatCanvas(),
          width: 32, height: 32,
          scaleByDistance: new Cesium.NearFarScalar(1000000, 1.2, 20000000, 0.4)
        });
        point.id = s.name;
        point._satName = s.name; point._tle1 = s.tle1; point._tle2 = s.tle2; point._alt = s.alt; point._lon = s.lon; point._lat = s.lat;
        try { point._satrec = satellite.twoline2satrec(s.tle1, s.tle2); } catch (e) {}
        entry = { point };
        satEntitiesRef.current.set(s.name, entry);
      } else {
        entry.point.position = pos;
        entry.point._alt = s.alt; entry.point._lon = s.lon; entry.point._lat = s.lat;
      }
    });

    satEntitiesRef.current.forEach((val, name) => {
      if (!activeSatNames.has(name)) {
        if (coll.contains(val.point)) {
          coll.remove(val.point);
        }
        satEntitiesRef.current.delete(name);
      }
    });

    onCountUpdate?.('satellites', satEntitiesRef.current.size);
  }, [satelliteData, onCountUpdate]);

  // ── Earthquake Primitive Updates ──
  useEffect(() => {
    const coll = quakeCollectionRef.current;
    if (!coll || !earthquakeData) return;
    coll.removeAll();
    earthquakeData.forEach(q => {
      const p = coll.add({
        position: Cesium.Cartesian3.fromDegrees(q.lon, q.lat),
        pixelSize: Math.max((q.magnitude || 4) * 3, 6),
        color: Cesium.Color.RED.withAlpha(0.6),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.4), outlineWidth: 1
      });
      p._quakeData = q;
    });
    onCountUpdate?.('earthquakes', earthquakeData.length);
  }, [earthquakeData, onCountUpdate]);

  // ── Ship Primitive Updates ──
  useEffect(() => {
    const coll = shipCollectionRef.current;
    if (!coll || !shipData) return;
    const activeIds = new Set(shipData.map(s => s.id));

    shipData.forEach(s => {
      let entry = shipEntitiesRef.current.get(s.id);
      const pos = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 0);

      if (!entry) {
        const point = coll.add({
          position: pos,
          image: SHIP_IMAGE_CANVAS,
          width: 28, height: 28,
          scaleByDistance: new Cesium.NearFarScalar(500000, 1.2, 25000000, 0.4),
          rotation: Cesium.Math.toRadians(-(s.heading || 0)),
          eyeOffset: new Cesium.Cartesian3(0, 0, -50)
        });
        point.id = s.id;
        point._shipData = s;
        entry = { point };
        shipEntitiesRef.current.set(s.id, entry);
      } else {
        entry.point.position = pos;
        entry.point._shipData = s;
        if (s.heading !== undefined) {
          entry.point.rotation = Cesium.Math.toRadians(-s.heading);
        }
      }
    });

    shipEntitiesRef.current.forEach((val, id) => {
      if (!activeIds.has(id)) {
        if (coll.contains(val.point)) {
          coll.remove(val.point);
        }
        shipEntitiesRef.current.delete(id);
      }
    });

    onCountUpdate?.('ships', shipEntitiesRef.current.size);
  }, [shipData, onCountUpdate]);

  // ── Preset Shader Logic ──
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (postProcessRef.current) viewer.scene.postProcessStages.remove(postProcessRef.current);
    if (activePreset && PRESET_SHADERS[activePreset]) {
      postProcessRef.current = viewer.scene.postProcessStages.add(new Cesium.PostProcessStage({
        fragmentShader: PRESET_SHADERS[activePreset]
      }));
    }
  }, [activePreset]);

  return (
    <>
    <div className="globe-container">
      <div className="globe-wrapper">
        <div ref={containerRef} id="cesium-container" />
        <div className="globe-vignette" />
        {showTerrainLoading && <div className="terrain-loader">LOADING TERRAIN DATA...</div>}
      </div>
    </div>

      {selectedFlight && (
        <div className="flight-hud-card">
          {/* Header */}
          <div className="flight-hud-header">
            <div className="flight-hud-icon"><Plane size={24} /></div>
            <div className="flight-hud-title">
              <div className="flight-hud-callsign">{selectedFlight.callsign}</div>
              <div className="flight-hud-icao">ICAO: {selectedFlight.icao}</div>
            </div>
            {trackedFlightId === selectedFlight.id && (
              <div className="flight-hud-live-badge">
                <div className="flight-hud-live-dot" />
                LIVE
              </div>
            )}
          </div>

          <div className="flight-hud-divider" />

          {/* Data Grid */}
          <div className="flight-hud-grid">
            <div className="flight-hud-field">
              <span className="flight-hud-label">ALTITUDE</span>
              <span className="flight-hud-value">{Math.round(selectedFlight.altitude).toLocaleString()}<span className="flight-hud-unit">m</span></span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">SPEED</span>
              <span className="flight-hud-value">{Math.round(selectedFlight.velocity)}<span className="flight-hud-unit">kts</span></span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">HEADING</span>
              <span className="flight-hud-value">{Math.round(selectedFlight.heading || 0)}°</span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">STATUS</span>
              <span className="flight-hud-value flight-hud-status-val">
                {trackedFlightId === selectedFlight.id ? 'TRACKING' : 'SELECTED'}
              </span>
            </div>
          </div>

          {/* Coordinates */}
          {trackedFlightId === selectedFlight.id && (
            <>
              <div className="flight-hud-divider" />
              <div className="flight-hud-coords">
                <div className="flight-hud-coord-row">
                  <span className="flight-hud-label">LAT</span>
                  <span id="live-coord-lat" className="flight-hud-coord-value">--</span>
                </div>
                <div className="flight-hud-coord-row">
                  <span className="flight-hud-label">LON</span>
                  <span id="live-coord-lon" className="flight-hud-coord-value">--</span>
                </div>
              </div>
            </>
          )}

          <div className="flight-hud-divider" />

          {/* Actions */}
          <div className="flight-hud-actions">
            {trackedFlightId !== selectedFlight.id && (
              <button className="flight-hud-track-btn" onClick={(e) => { e.stopPropagation(); handleTrack(selectedFlight.id); }}>
                <Navigation size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> TRACK FLIGHT
              </button>
            )}
            <button
              className="flight-hud-exit-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleStopTracking();
              }}
            >
              <X size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> {trackedFlightId === selectedFlight.id ? 'EXIT TRACKING // BACK TO GLOBE' : 'CLOSE'}
            </button>
          </div>
        </div>
      )}

      {selectedQuake && (
        <div className="quake-hud-card">
          <div className="flight-hud-header">
            <div className="flight-hud-icon"><AlertTriangle size={24} /></div>
            <div className="flight-hud-title">
              <div className="flight-hud-callsign">SEISMIC EVENT</div>
            </div>
            <div className="flight-hud-live-badge" style={{ borderColor: 'var(--color-red)', color: 'var(--color-red)', background: 'rgba(255, 50, 50, 0.1)' }}>
              WARNING
            </div>
          </div>

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 50, 50, 0.25), transparent)' }} />

          <div className="flight-hud-grid">
            <div className="flight-hud-field" style={{ gridColumn: 'span 2' }}>
              <span className="flight-hud-label">LOCATION</span>
              <span className="flight-hud-value" style={{ fontSize: '11px', whiteSpace: 'normal', lineHeight: '1.2' }}>{selectedQuake.place}</span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">MAGNITUDE</span>
              <span className="flight-hud-value" style={{ fontSize: '24px' }}>{selectedQuake.magnitude.toFixed(1)}</span>
            </div>
          </div>

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 50, 50, 0.25), transparent)' }} />

          <div className="flight-hud-coords">
            <div className="flight-hud-coord-row">
              <span className="flight-hud-label">LAT</span>
              <span className="flight-hud-coord-value" style={{ color: 'var(--color-red)' }}>{selectedQuake.lat.toFixed(4)}</span>
            </div>
            <div className="flight-hud-coord-row">
              <span className="flight-hud-label">LON</span>
              <span className="flight-hud-coord-value" style={{ color: 'var(--color-red)' }}>{selectedQuake.lon.toFixed(4)}</span>
            </div>
          </div>

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 50, 50, 0.25), transparent)' }} />

          <div className="flight-hud-actions">
            <button
              className="flight-hud-exit-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleStopTracking();
              }}
            >
              <X size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> CLOSE
            </button>
          </div>
        </div>
      )}

      {selectedSatellite && (
        <div className="sat-hud-card">
          <div className="flight-hud-header">
            <div className="flight-hud-icon"><Orbit size={24} /></div>
            <div className="flight-hud-title">
              <div className="flight-hud-callsign" style={{ fontSize: '12px' }}>{selectedSatellite.name}</div>
              <div className="flight-hud-icao">NORAD: {extractNoradId(selectedSatellite.tle1)}</div>
            </div>
            {trackedSatId === selectedSatellite.id && (
              <div className="flight-hud-live-badge" style={{ borderColor: 'var(--color-amber)', color: 'var(--color-amber)', background: 'rgba(255, 215, 0, 0.1)' }}>
                <div className="flight-hud-live-dot" style={{ background: 'var(--color-amber)' }} />
                TRACKING
              </div>
            )}
          </div>

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.25), transparent)' }} />

          <div className="flight-hud-grid">
            <div className="flight-hud-field">
              <span className="flight-hud-label">ALTITUDE</span>
              <span className="flight-hud-value">{selectedSatellite.altitude.toLocaleString()}<span className="flight-hud-unit">km</span></span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">VELOCITY</span>
              <span className="flight-hud-value">{selectedSatellite.velocity}<span className="flight-hud-unit">km/s</span></span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">INCLINATION</span>
              <span className="flight-hud-value">{selectedSatellite.incl}°</span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">PERIOD</span>
              <span className="flight-hud-value">{selectedSatellite.period}<span className="flight-hud-unit">m</span></span>
            </div>
          </div>

          {trackedSatId === selectedSatellite.id && (
            <>
              <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.25), transparent)' }} />
              <div className="flight-hud-coords">
                <div className="flight-hud-coord-row">
                  <span className="flight-hud-label">LAT</span>
                  <span id="live-coord-lat" className="flight-hud-coord-value">--</span>
                </div>
                <div className="flight-hud-coord-row">
                  <span className="flight-hud-label">LON</span>
                  <span id="live-coord-lon" className="flight-hud-coord-value">--</span>
                </div>
              </div>
            </>
          )}

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.25), transparent)' }} />

          <div className="flight-hud-actions">
            {trackedSatId !== selectedSatellite.id && (
              <button 
                className="flight-hud-track-btn" 
                style={{ borderColor: 'var(--color-amber)', color: 'var(--color-amber)' }} 
                onClick={(e) => { e.stopPropagation(); handleTrack(selectedSatellite.id, true); }}
              >
                <Orbit size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> TRACK ORBIT
              </button>
            )}
            <button
              className="flight-hud-exit-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleStopTracking();
              }}
            >
              <X size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> EXIT
            </button>
          </div>
        </div>
      )}

      {selectedShip && (
        <div className="ship-hud-card">
          <div className="flight-hud-header">
            <div className="flight-hud-icon" style={{ color: '#4AF0FF' }}><ShipIcon size={24} /></div>
            <div className="flight-hud-title">
              <div className="flight-hud-callsign">{selectedShip.name}</div>
              <div className="flight-hud-icao">MMSI: {selectedShip.mmsi}</div>
            </div>
            <div className="ship-type-badge">{selectedShip.shipType}</div>
          </div>

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(74, 240, 255, 0.25), transparent)' }} />

          <div className="flight-hud-grid">
            <div className="flight-hud-field">
              <span className="flight-hud-label">SPEED</span>
              <span className="flight-hud-value">{selectedShip.speed?.toFixed(1) || '0'}<span className="flight-hud-unit">kts</span></span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">HEADING</span>
              <span className="flight-hud-value">{Math.round(selectedShip.heading || 0)}°</span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">CALLSIGN</span>
              <span className="flight-hud-value" style={{ fontSize: '12px' }}>{selectedShip.callsign}</span>
            </div>
            <div className="flight-hud-field">
              <span className="flight-hud-label">DESTINATION</span>
              <span className="flight-hud-value" style={{ fontSize: '10px', color: '#4AF0FF' }}>{selectedShip.destination}</span>
            </div>
          </div>

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(74, 240, 255, 0.25), transparent)' }} />

          <div className="flight-hud-coords">
            <div className="flight-hud-coord-row">
              <span className="flight-hud-label">LAT</span>
              <span className="flight-hud-coord-value" style={{ color: '#4AF0FF' }}>{selectedShip.lat?.toFixed(4)}</span>
            </div>
            <div className="flight-hud-coord-row">
              <span className="flight-hud-label">LON</span>
              <span className="flight-hud-coord-value" style={{ color: '#4AF0FF' }}>{selectedShip.lon?.toFixed(4)}</span>
            </div>
          </div>

          <div className="flight-hud-divider" style={{ background: 'linear-gradient(90deg, transparent, rgba(74, 240, 255, 0.25), transparent)' }} />

          <div className="flight-hud-actions">
            <button
              className="flight-hud-exit-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleStopTracking();
              }}
            >
              <X size={14} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}
