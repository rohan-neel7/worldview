/**
 * Worldview Disaster Intelligence — Hazard Hypothesis Model
 *
 * Canonical intermediate object representing the intelligence layer's assessment
 * before incident promotion.
 *
 * Adheres to Phase 6C Architectural Rules:
 *   - Strictly separates:
 *       • observationConfidence (source observation quality)
 *       • corroborationStrength (multi-source agreement level)
 *       • assessmentConfidence (overall confidence factoring in evidence gaps)
 *   - Keeps population exposure, infrastructure exposure, and terrain context distinct
 *   - Preserves source conflicts with zero silent averaging
 *   - Records provenance, dataState, freshness, and explicit evidence gaps
 */

import {
  IncidentStatus,
  SeverityLevel,
  CorroborationLevel,
  SourceMode,
} from '../event/types.js';
import { DataState } from '../providers/providerTypes.js';

export class HazardHypothesis {
  /**
   * @param {object} params
   */
  constructor({
    id,
    hazardType,
    title,
    description = '',
    status = IncidentStatus.DETECTED,
    severity = SeverityLevel.MODERATE,
    crisisPriority = 50,
    observationConfidence = 0.8,
    corroborationStrength = CorroborationLevel.SINGLE_SOURCE,
    assessmentConfidence = 0.6,
    confidence = null,
    dataState = DataState.INFERRED,
    sourceMode = SourceMode.LIVE,
    location = { lat: 0, lon: 0 },
    geometry = null,
    evidence = [],
    evidenceGaps = [],
    anomalies = [],
    exposure = null,
    secondaryRisks = null,
    corroboration = null,
    conflicts = [],
    temporal = null,
    explanation = '',
    shouldPromote = false,
    impactData = null,
  }) {
    if (!id || typeof id !== 'string') {
      throw new Error('HazardHypothesis requires a valid string "id"');
    }
    if (!hazardType || typeof hazardType !== 'string') {
      throw new Error('HazardHypothesis requires a valid string "hazardType"');
    }

    this.id = id;
    this.hazardType = hazardType.toUpperCase();
    this.title = title || `${this.hazardType} Hypothesis`;
    this.description = description;
    this.status = status;
    this.severity = severity;
    this.crisisPriority = Math.max(0, Math.min(100, Math.round(crisisPriority)));

    // Distinct confidence separation (Correction #8)
    this.observationConfidence = Number(Math.max(0.0, Math.min(1.0, observationConfidence)).toFixed(2));
    this.corroborationStrength = corroborationStrength || CorroborationLevel.SINGLE_SOURCE;
    this.assessmentConfidence = Number(Math.max(0.0, Math.min(1.0, assessmentConfidence)).toFixed(2));
    // Backwards compatibility
    this.confidence = confidence !== null ? confidence : this.assessmentConfidence;

    this.dataState = dataState;
    this.sourceMode = sourceMode;

    this.location = {
      lat: Number(location.lat) || 0,
      lon: Number(location.lon) || 0,
      name: location.name || 'Regional Hazard Sector',
      depthKm: location.depthKm !== undefined ? Number(location.depthKm) : undefined,
      radiusKm: location.radiusKm !== undefined ? Number(location.radiusKm) : 50,
    };

    // Geometry with explicit labeling (Correction #4 & #18: ESTIMATED vs OFFICIAL vs MODELED)
    this.geometry = geometry || {
      type: 'Point',
      geometryType: 'POINT',
      label: 'ESTIMATED',
      coordinates: [this.location.lon, this.location.lat],
    };

    this.evidence = Array.isArray(evidence) ? evidence : [];
    this.evidenceGaps = Array.isArray(evidenceGaps) ? evidenceGaps : [];
    this.anomalies = Array.isArray(anomalies) ? anomalies : [];

    // Distinct exposure factors (Correction #9)
    this.exposure = exposure || {
      population: null,
      infrastructure: null,
      terrain: null,
      dataState: DataState.STATIC,
    };

    // Structured secondary risks (Correction #5 & #6)
    this.secondaryRisks = secondaryRisks || {
      aftershocks: null,
      tsunami: null,
      landslides: null,
      stormSurge: null,
      isolation: null,
    };

    this.corroboration = corroboration || {
      level: this.corroborationStrength,
      sourceCount: 1,
      sources: [],
      notes: '',
    };

    // Preserved conflicts (Correction #6: No silent averaging)
    this.conflicts = Array.isArray(conflicts) ? conflicts : [];

    this.temporal = temporal || {
      startAt: new Date().toISOString(),
      lastObservedAt: new Date().toISOString(),
      ageMinutes: 0,
      changeRate: null,
      forecastHorizon: null,
      evidenceExpiresAt: null,
    };

    this.explanation = explanation || '';
    this.shouldPromote = Boolean(shouldPromote);
    this.impactData = impactData;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
  }

  /**
   * Serializes the hypothesis for operator dossier or incident ingestion.
   */
  toJSON() {
    return {
      id: this.id,
      hazardType: this.hazardType,
      title: this.title,
      description: this.description,
      status: this.status,
      severity: this.severity,
      crisisPriority: this.crisisPriority,
      observationConfidence: this.observationConfidence,
      corroborationStrength: this.corroborationStrength,
      assessmentConfidence: this.assessmentConfidence,
      confidence: this.confidence,
      dataState: this.dataState,
      sourceMode: this.sourceMode,
      location: this.location,
      geometry: this.geometry,
      evidence: this.evidence,
      evidenceGaps: this.evidenceGaps,
      anomalies: this.anomalies,
      exposure: this.exposure,
      secondaryRisks: this.secondaryRisks,
      corroboration: this.corroboration,
      conflicts: this.conflicts,
      temporal: this.temporal,
      explanation: this.explanation,
      shouldPromote: this.shouldPromote,
      impactData: this.impactData,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
