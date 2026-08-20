import { BENGALURU_FLOOD_SCENARIO } from './floodScenario.js';

export class ScenarioRunner {
  /**
   * @param {object} dataPipeline - The DataPipeline instance to feed
   */
  constructor(dataPipeline) {
    this.pipeline = dataPipeline;
    this.activeScenario = null;
    this.currentFrame = 0;
    this.timer = null;
    this.listeners = new Set();
  }

  /**
   * Subscribes a listener to scenario status updates.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(state) {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[ScenarioRunner] Listener error:', e);
      }
    }
  }

  /**
   * Runs an entire scenario immediately (for automated testing or instant evaluation).
   *
   * @param {object} [scenario=BENGALURU_FLOOD_SCENARIO]
   * @returns {Array<object>} All generated incidents
   */
  runInstant(scenario = BENGALURU_FLOOD_SCENARIO) {
    this.stop();
    this.activeScenario = scenario;

    for (const frame of scenario.frames) {
      this.pipeline.ingestRaw('SIMULATION', frame.rawEvents, {
        scenarioId: scenario.scenarioId,
        frameLabel: frame.label,
      });
    }

    this.notify({
      running: false,
      completed: true,
      scenarioName: scenario.name,
      totalFrames: scenario.frames.length,
      currentFrame: scenario.frames.length,
    });

    return this.pipeline.incidentManager.getActive();
  }

  /**
   * Dispatches a single specific frame from the scenario.
   */
  dispatchFrame(frameIndex, scenario = BENGALURU_FLOOD_SCENARIO) {
    const frame = scenario.frames[frameIndex];
    if (!frame) return null;

    this.pipeline.ingestRaw('SIMULATION', frame.rawEvents, {
      scenarioId: scenario.scenarioId,
      frameLabel: frame.label,
    });

    return this.pipeline.incidentManager.getActive();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.activeScenario = null;
    this.currentFrame = 0;
    this.notify({ running: false, completed: false, currentFrame: 0 });
  }
}
