import { haversineDistanceKm } from '../fusion/geoUtils.js';
import {
  GLOBAL_POPULATION_CENTERS,
  GLOBAL_HOSPITALS,
  GLOBAL_AIRPORTS,
  GLOBAL_PORTS,
  GLOBAL_ROAD_CORRIDORS,
  ASSET_PROVENANCE,
} from './datasets/geospatialAssets.js';

export class EarthquakeImpactEngine {
  /**
   * Instance helper for evaluate
   */
  evaluate(params) {
    return EarthquakeImpactEngine.evaluate(params);
  }

  /**
   * Instance helper for calculateShakingRadii
   */
  calculateShakingRadii(magnitude, depthKm) {
    return EarthquakeImpactEngine.calculateShakingRadii(magnitude, depthKm);
  }

  /**
   * Calculates deterministic earthquake impact radii, exposed assets, secondary hazards, and response options.
   *
   * @param {object} params
   * @param {number} params.magnitude - Richter / Moment Magnitude (Mw)
   * @param {number} [params.depthKm=10] - Focal depth in km
   * @param {number} params.lat - Epicenter latitude
   * @param {number} params.lon - Epicenter longitude
   * @param {string} [params.place='Epicentral Zone'] - Location name
   * @param {boolean} [params.tsunamiFlag=false] - Provider automated tsunami flag
   * @returns {object} Detailed structured impact assessment
   */
  static evaluate({ magnitude = 5.0, depthKm = 10, lat, lon, place = 'Epicentral Zone', tsunamiFlag = false }) {
    const mag = Math.max(1.0, Math.min(10.0, Number(magnitude) || 5.0));
    const depth = Math.max(1.0, Math.min(700.0, Number(depthKm) || 10.0));

    // 1. Calculate Estimated Isoseismal Shaking Radii using attenuation model
    const zones = this.calculateShakingRadii(mag, depth);

    // 2. Intersect with Static Infrastructure & Population Reference Datasets
    const exposedCities = [];
    let estimatedPopulation = 0;

    for (const city of GLOBAL_POPULATION_CENTERS) {
      const distKm = Number(haversineDistanceKm(lat, lon, city.lat, city.lon).toFixed(1));
      if (distKm <= zones.lightRadiusKm) {
        let intensityBand = 'LIGHT';
        let exposureFactor = 0.25;

        if (distKm <= zones.severeRadiusKm) {
          intensityBand = 'SEVERE';
          exposureFactor = 1.0;
        } else if (distKm <= zones.moderateRadiusKm) {
          intensityBand = 'MODERATE';
          exposureFactor = 0.6;
        }

        const cityPop = typeof city.population === 'number' && city.population > 0 ? city.population : 0;
        const exposedPop = Math.max(0, Math.round(cityPop * exposureFactor));
        estimatedPopulation += exposedPop;

        exposedCities.push({
          ...city,
          distanceKm: distKm,
          intensityBand,
          estimatedExposedPopulation: exposedPop,
          exposureStatus: 'POTENTIAL_EXPOSURE',
          damageConfirmed: false,
        });
      }
    }

    // Baseline minimum area population estimation if no static city is in immediate radius
    if (estimatedPopulation === 0 && zones.moderateRadiusKm > 0) {
      const areaSqKm = Math.PI * Math.pow(zones.moderateRadiusKm, 2);
      // Assume modest rural baseline (18 people/km^2)
      estimatedPopulation = Math.max(0, Math.round(areaSqKm * 18));
    }
    estimatedPopulation = Math.max(0, estimatedPopulation);

    // 3. Exposed Healthcare Facilities (Hospitals)
    const exposedHospitals = [];
    for (const hosp of GLOBAL_HOSPITALS) {
      const distKm = Number(haversineDistanceKm(lat, lon, hosp.lat, hosp.lon).toFixed(1));
      if (distKm <= zones.lightRadiusKm) {
        const band = distKm <= zones.severeRadiusKm ? 'SEVERE' : (distKm <= zones.moderateRadiusKm ? 'MODERATE' : 'LIGHT');
        exposedHospitals.push({
          ...hosp,
          distanceKm: distKm,
          intensityBand: band,
          exposureStatus: 'POTENTIAL_EXPOSURE',
          damageConfirmed: false,
          operatingStatus: hosp.status || 'OPERATIONAL',
        });
      }
    }

    // 4. Exposed Aviation Runways (Airports)
    const exposedAirports = [];
    for (const apt of GLOBAL_AIRPORTS) {
      const distKm = Number(haversineDistanceKm(lat, lon, apt.lat, apt.lon).toFixed(1));
      if (distKm <= zones.lightRadiusKm) {
        const band = distKm <= zones.severeRadiusKm ? 'SEVERE' : (distKm <= zones.moderateRadiusKm ? 'MODERATE' : 'LIGHT');
        exposedAirports.push({
          ...apt,
          distanceKm: distKm,
          intensityBand: band,
          exposureStatus: 'POTENTIAL_EXPOSURE',
          runwayStatus: 'ASSESSMENT_PENDING',
          damageConfirmed: false,
        });
      }
    }

    // 5. Exposed Maritime Ports
    const exposedPorts = [];
    for (const prt of GLOBAL_PORTS) {
      const distKm = Number(haversineDistanceKm(lat, lon, prt.lat, prt.lon).toFixed(1));
      if (distKm <= zones.lightRadiusKm) {
        const band = distKm <= zones.severeRadiusKm ? 'SEVERE' : (distKm <= zones.moderateRadiusKm ? 'MODERATE' : 'LIGHT');
        exposedPorts.push({
          ...prt,
          distanceKm: distKm,
          intensityBand: band,
          exposureStatus: 'POTENTIAL_EXPOSURE',
          damageConfirmed: false,
        });
      }
    }

    // 6. Exposed Arterial Transit Corridors (Roads)
    const exposedRoads = [];
    for (const road of GLOBAL_ROAD_CORRIDORS) {
      const distKm = Number(haversineDistanceKm(lat, lon, road.lat, road.lon).toFixed(1));
      if (distKm <= zones.lightRadiusKm) {
        const band = distKm <= zones.severeRadiusKm ? 'SEVERE' : (distKm <= zones.moderateRadiusKm ? 'MODERATE' : 'LIGHT');
        exposedRoads.push({
          ...road,
          distanceKm: distKm,
          intensityBand: band,
          exposureStatus: 'POTENTIAL_EXPOSURE',
          passableStatus: 'ASSESSMENT_PENDING',
          damageConfirmed: false,
        });
      }
    }

    // 7. Secondary Hazards Evaluation
    const secondaryHazards = this.evaluateSecondaryHazards({
      magnitude: mag,
      depthKm: depth,
      lat,
      lon,
      tsunamiFlag,
      exposedPortsCount: exposedPorts.length,
      severeRadiusKm: zones.severeRadiusKm,
    });

    // 8. Generate Decision-Support Response Options
    const responseOptions = this.generateResponseOptions({
      magnitude: mag,
      depthKm: depth,
      exposedPopulation: estimatedPopulation,
      hospitals: exposedHospitals,
      airports: exposedAirports,
      ports: exposedPorts,
      roads: exposedRoads,
      secondaryHazards,
    });

    // Calculate aggregated Infrastructure Exposure Score (0 - 100)
    let exposureScore = 20;
    if (estimatedPopulation > 500000) exposureScore += 35;
    else if (estimatedPopulation > 100000) exposureScore += 25;
    else if (estimatedPopulation > 20000) exposureScore += 15;

    if (exposedHospitals.length > 0) exposureScore += Math.min(25, exposedHospitals.length * 8);
    if (exposedAirports.length > 0) exposureScore += Math.min(15, exposedAirports.length * 6);
    if (exposedRoads.length > 0) exposureScore += Math.min(15, exposedRoads.length * 5);
    exposureScore = Math.min(100, Math.max(10, exposureScore));

    return {
      hazardType: 'EARTHQUAKE',
      place,
      magnitude: mag,
      depthKm: depth,
      epicenter: { lat, lon },
      shakingZones: zones,
      exposureMetrics: {
        populationExposed: estimatedPopulation,
        populationTotal: estimatedPopulation,
        exposureStatus: 'AVAILABLE',
        hospitalsCount: exposedHospitals.length,
        airportsCount: exposedAirports.length,
        portsCount: exposedPorts.length,
        roadsCount: exposedRoads.length,
        exposureScore,
      },
      exposedAssets: {
        cities: exposedCities,
        hospitals: exposedHospitals,
        airports: exposedAirports,
        ports: exposedPorts,
        roads: exposedRoads,
      },
      secondaryHazards,
      responseOptions,
      provenance: ASSET_PROVENANCE,
      disclaimer: 'ESTIMATED IMPACT ZONE based on empirical ground-motion attenuation. All asset exposures denote POTENTIAL EXPOSURE, not confirmed physical damage.',
    };
  }

  /**
   * Deterministic Shaking Radii Calculation (Isoseismals)
   *
   * Based on empirical ground-motion attenuation formulas factoring
   * Moment Magnitude and Focal Depth.
   */
  static calculateShakingRadii(mag, depthKm) {
    // Attenuation depth damping factor
    const depthDamping = Math.min(1.0, 30.0 / Math.max(10.0, depthKm));

    // Severe Shaking (MMI VII+ / Heavy structural stress): only emerges for M >= 5.5
    let severeRadiusKm = 0;
    if (mag >= 5.5) {
      const raw = Math.pow(10, 0.48 * mag - 1.8) * depthDamping;
      severeRadiusKm = Math.round(Math.max(5, raw));
    }

    // Moderate Shaking (MMI V-VI / Non-structural damage, felt strongly): M >= 4.5
    let moderateRadiusKm = 0;
    if (mag >= 4.5) {
      const raw = Math.pow(10, 0.52 * mag - 1.35) * depthDamping;
      moderateRadiusKm = Math.round(Math.max(15, raw));
    }

    // Light / Perceptible Shaking (MMI III-IV / Broad awareness perimeter): M >= 3.5
    const lightRaw = Math.pow(10, 0.58 * mag - 1.05) * Math.max(0.6, depthDamping);
    const lightRadiusKm = Math.round(Math.max(30, lightRaw));

    // Epicentral Intensity estimation on Modified Mercalli Intensity (MMI) scale
    const epicentralIntensityMMI = Number(Math.max(1.0, Math.min(10.5, (1.5 * mag - 1.8 * Math.log10(Math.max(10, depthKm)) + 1.2))).toFixed(1));

    return {
      severeRadiusKm,
      moderateRadiusKm,
      lightRadiusKm,
      epicentralIntensityMMI,
      modelName: 'Worldview Seismo-Attenuation Model (v1.2)',
      depthDamping: Number(depthDamping.toFixed(2)),
    };
  }

  /**
   * Evaluates secondary hazards (Aftershocks, Tsunami, Landslide, Infrastructure Disruption)
   */
  static evaluateSecondaryHazards({ magnitude, depthKm, tsunamiFlag, exposedPortsCount, severeRadiusKm }) {
    // 1. Aftershock Risk (Bath's Law & Omori-Utsu decay rate)
    const expectedMaxAftershock = Number((magnitude - 1.15).toFixed(1));
    let aftershockStatus = 'LOW';
    let aftershockConfidence = 0.70;
    let aftershockProbPct = 35;

    if (magnitude >= 7.0) {
      aftershockStatus = 'CRITICAL';
      aftershockConfidence = 0.95;
      aftershockProbPct = 96;
    } else if (magnitude >= 6.0) {
      aftershockStatus = 'ELEVATED';
      aftershockConfidence = 0.88;
      aftershockProbPct = 82;
    } else if (magnitude >= 5.0) {
      aftershockStatus = 'MODERATE';
      aftershockConfidence = 0.80;
      aftershockProbPct = 60;
    }

    // 2. Tsunami Hazard Potential
    let tsunamiStatus = 'NONE';
    let tsunamiConfidence = 0.90;
    let tsunamiEvidence = 'Hypocenter or magnitude insufficient for oceanic water displacement';
    let tsunamiGaps = [];

    const isShallow = depthKm <= 70;
    const isHighMag = magnitude >= 6.5;

    if (isHighMag && isShallow) {
      if (tsunamiFlag) {
        tsunamiStatus = 'POTENTIAL TSUNAMI HAZARD';
        tsunamiConfidence = 0.85;
        tsunamiEvidence = `M${magnitude} shallow event (${depthKm}km) with automated upstream advisory flag`;
        tsunamiGaps = ['DEEP_OCEAN_BUOY_CONFIRMATION', 'COASTAL_TIDE_GAUGE_TELEMETRY'];
      } else if (exposedPortsCount > 0 || magnitude >= 7.2) {
        tsunamiStatus = 'POTENTIAL TSUNAMI HAZARD';
        tsunamiConfidence = 0.65;
        tsunamiEvidence = `M${magnitude} shallow coastal/oceanic event (${depthKm}km). Meets evaluation criteria.`;
        tsunamiGaps = ['NATIONAL_TSUNAMI_WARNING', 'DART_BUOY_TELEMETRY'];
      } else {
        tsunamiStatus = 'LOW_PROBABILITY';
        tsunamiConfidence = 0.75;
        tsunamiEvidence = 'Inland epicentral distance indicates minimal coastal displacement risk';
      }
    }

    // 3. Landslide & Ground Failure Potential
    let landslideStatus = 'LOW';
    let landslideConfidence = 0.72;
    let landslideEvidence = 'Ground motion below typical slope instability thresholds';

    if (magnitude >= 6.5 && severeRadiusKm > 0) {
      landslideStatus = 'ELEVATED';
      landslideConfidence = 0.84;
      landslideEvidence = `Peak shaking in ${severeRadiusKm}km severe zone exceeds slope failure thresholds in hilly terrain`;
    } else if (magnitude >= 5.5) {
      landslideStatus = 'MODERATE';
      landslideConfidence = 0.75;
      landslideEvidence = 'Localized slope failure possible in steep road cuttings and riverbanks';
    }

    // 4. Critical Infrastructure Disruption
    let infraStatus = 'NOMINAL';
    let infraConfidence = 0.80;
    if (magnitude >= 7.0) {
      infraStatus = 'HIGH_RISK';
      infraConfidence = 0.90;
    } else if (magnitude >= 5.8) {
      infraStatus = 'MODERATE_RISK';
      infraConfidence = 0.82;
    }

    return {
      aftershock: {
        status: aftershockStatus,
        confidence: aftershockConfidence,
        probability24hPct: aftershockProbPct,
        expectedMaxMagnitude: expectedMaxAftershock,
        evidence: `M${magnitude} mainshock implies probability of aftershocks up to ~M${expectedMaxAftershock}`,
        evidenceGaps: ['LOCAL_SEISMOGRAPH_ARRAY_DENSE_STREAM'],
      },
      tsunami: {
        status: tsunamiStatus,
        confidence: tsunamiConfidence,
        evidence: tsunamiEvidence,
        evidenceGaps: tsunamiGaps,
      },
      landslide: {
        status: landslideStatus,
        confidence: landslideConfidence,
        evidence: landslideEvidence,
        evidenceGaps: ['HIGH_RESOLUTION_DIGITAL_ELEVATION_SLOPE_MODEL'],
      },
      infrastructureDisruption: {
        status: infraStatus,
        confidence: infraConfidence,
        evidence: `Estimated ground motion across populated infrastructure nodes within ${severeRadiusKm}km severe zone`,
        evidenceGaps: ['REAL_TIME_GRID_SCADA_TELEMETRY'],
      },
    };
  }

  /**
   * Generates actionable Decision-Support Response Options
   */
  static generateResponseOptions({
    magnitude,
    depthKm,
    exposedPopulation,
    hospitals,
    airports,
    ports,
    roads,
    secondaryHazards,
  }) {
    const options = [];

    // Option 1: Coastal Exposure & Tsunami Verification
    if (secondaryHazards.tsunami.status.includes('POTENTIAL')) {
      options.push({
        id: 'opt-coastal-tsunami',
        title: 'ASSESS COASTAL EXPOSURE & TIDE GAUGES',
        category: 'MARITIME_COASTAL',
        priority: 'CRITICAL',
        objective: 'Verify littoral water-level anomalies and alert coastal infrastructure in propagation path',
        relevantEvidence: secondaryHazards.tsunami.evidence,
        confidence: secondaryHazards.tsunami.confidence,
        rationale: `M${magnitude} shallow hypocenter (${depthKm}km) creates potential for littoral surge. Immediate buoy verification advised.`,
      });
    }

    // Option 2: Regional Healthcare Accessibility
    if (hospitals.length > 0) {
      const hospNames = hospitals.slice(0, 2).map((h) => h.name).join(', ');
      options.push({
        id: 'opt-hospital-access',
        title: 'VERIFY REGIONAL HOSPITAL ACCESSIBILITY',
        category: 'HEALTHCARE',
        priority: magnitude >= 6.0 ? 'HIGH' : 'MEDIUM',
        objective: `Establish operational status for ${hospitals.length} healthcare facilities within shaking perimeter`,
        relevantEvidence: `${hospitals.length} hospital(s) within estimated impact zone: ${hospNames}`,
        confidence: 0.88,
        rationale: 'Healthcare facilities inside estimated isoseismal zones require rapid operational & structural triage.',
      });
    }

    // Option 3: Transport & Arterial Route Reconnaissance
    // Option 4: Arterial Road Corridors
    if (roads.length > 0) {
      options.push({
        id: 'opt-road-clearance',
        title: 'PRIORITIZE HIGH-EXPOSURE ARTERIAL ROADS',
        category: 'TRANSPORTATION',
        priority: 'HIGH',
        objective: `Deploy ground inspection teams to ${roads.length} intersecting arterial transport corridor(s)`,
        relevantEvidence: `${roads.length} major transport artery(ies) in shaking perimeter: ${roads.map((r) => r.name).join(', ')}`,
        confidence: 0.85,
        rationale: 'Estimated shaking exposure and slope gradient indicate potential risk of localized roadway blockage.',
      });
    }

    // Option 5: Maritime Port & Channel Assessment
    if (ports && ports.length > 0) {
      options.push({
        id: 'opt-maritime-ports',
        title: 'INSPECT HARBOR DRAFT & MARITIME BERTHS',
        category: 'MARITIME_INFRASTRUCTURE',
        priority: 'MEDIUM',
        objective: `Conduct structural and navigation inspection across ${ports.length} port facility(ies)`,
        relevantEvidence: `${ports.length} port(s) located within shaking zone: ${ports.map((p) => p.name).join(', ')}`,
        confidence: 0.88,
        rationale: 'Estimated shaking exposure indicates potential for littoral quayside disruption and berth misalignment.',
      });
    }

    // Option 4: Aftershock Cluster Monitoring
    options.push({
      id: 'opt-aftershock-monitoring',
      title: 'MONITOR AFTERSHOCK ARRAY & TECTONIC CLUSTERS',
      category: 'SEISMIC_SURVEILLANCE',
      priority: secondaryHazards.aftershock.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
      objective: `Track secondary seismic ruptures up to M${secondaryHazards.aftershock.expectedMaxMagnitude} across 24h window`,
      relevantEvidence: `24h aftershock probability estimated at ${secondaryHazards.aftershock.probability24hPct}%`,
      confidence: secondaryHazards.aftershock.confidence,
      rationale: 'Secondary ruptures can destabilize already stressed buildings and trigger secondary rockfalls.',
    });

    // Option 5: Satellite Tasking & Aerial Reconnaissance
    if (magnitude >= 6.0 || exposedPopulation > 50000) {
      options.push({
        id: 'opt-satellite-pass',
        title: 'TASK LOW-EARTH SATELLITE PASS FOR DAMAGE RECON',
        category: 'ORBITAL_RECON',
        priority: 'MEDIUM',
        objective: 'Align upcoming LEO optical/SAR orbital passes over epicenter for change detection',
        relevantEvidence: `Significant event with estimated ~${(exposedPopulation / 1000).toFixed(0)}k population exposure`,
        confidence: 0.90,
        rationale: 'SAR interferometry and optical imagery provide verified surface rupture and structural damage validation.',
      });
    }

    return options;
  }
}
