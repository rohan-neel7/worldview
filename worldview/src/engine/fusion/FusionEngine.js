import { EarthquakeIncidentRule } from './rules/EarthquakeIncidentRule.js';
import { FloodPotentialRule } from './rules/FloodPotentialRule.js';
import { TsunamiHazardRule } from './rules/TsunamiHazardRule.js';
import { WildfireRule } from './rules/WildfireRule.js';

export class FusionEngine {
  constructor() {
    this.rules = new Map();
    this.registerRule(new EarthquakeIncidentRule());
    this.registerRule(new FloodPotentialRule());
    this.registerRule(new TsunamiHazardRule());
    this.registerRule(new WildfireRule());
  }

  /**
   * Registers a fusion rule instance.
   *
   * @param {object} rule - Rule instance with name, hazardType, and evaluate(events, context)
   */
  registerRule(rule) {
    if (!rule || !rule.name || typeof rule.evaluate !== 'function') {
      throw new Error('Fusion rule must implement name and evaluate() method');
    }
    this.rules.set(rule.name, rule);
  }

  /**
   * Unregisters a rule by name.
   */
  unregisterRule(ruleName) {
    this.rules.delete(ruleName);
  }

  /**
   * Evaluates all registered fusion rules against normalized canonical events.
   *
   * @param {Array<object>} events - Normalized CanonicalEvent objects
   * @param {object} [context={}]
   * @returns {Array<object>} Array of generated hypotheses
   */
  evaluate(events, context = {}) {
    if (!Array.isArray(events) || events.length === 0) {
      return [];
    }

    const allHypotheses = [];

    for (const [name, rule] of this.rules.entries()) {
      try {
        const hypotheses = rule.evaluate(events, context);
        if (Array.isArray(hypotheses)) {
          allHypotheses.push(...hypotheses);
        }
      } catch (err) {
        console.error(`[FusionEngine] Error executing rule "${name}":`, err.message);
      }
    }

    return allHypotheses;
  }
}

export const defaultFusionEngine = new FusionEngine();
