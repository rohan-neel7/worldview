/**
 * Provider & Workload Lifecycle Manager
 * Controls activation, suspension, and resumption of data providers, polling timers,
 * WebSockets, and background workers based on the active operating mode (WORLD vs CRISIS).
 *
 * Prevents CPU contention, memory leaks, and cascading UI lag.
 */

export const WorkloadCategory = {
  GLOBAL_ONLY: 'GLOBAL_ONLY',   // OpenSky, CelesTrak, AISStream, animationWorker
  CRISIS_ONLY: 'CRISIS_ONLY',   // Country discovery engine, high-res impact modeling
  SHARED: 'SHARED',             // USGS seismic stream, base Cesium engine, camera controller
};

export class ProviderManager {
  constructor(options = {}) {
    this.activeMode = options.initialMode || 'WORLD'; // 'WORLD' | 'CRISIS'
    this.subscribers = new Set();
    this.intervals = new Map();
    this.abortControllers = new Map();
    this.workers = new Map();
    this.workloadStates = {
      [WorkloadCategory.GLOBAL_ONLY]: true,
      [WorkloadCategory.CRISIS_ONLY]: false,
      [WorkloadCategory.SHARED]: true,
    };
    this.transitionCount = 0;
  }

  /**
   * Set active operating mode ('WORLD' or 'CRISIS')
   * Automatically suspends inactive workloads and resumes active workloads.
   *
   * @param {'WORLD' | 'CRISIS'} nextMode
   */
  setMode(nextMode) {
    if (this.activeMode === nextMode) return;
    const prevMode = this.activeMode;
    this.activeMode = nextMode;
    this.transitionCount++;

    if (nextMode === 'CRISIS') {
      this.suspendGlobalWorkloads();
      this.resumeCrisisWorkloads();
    } else {
      this.suspendCrisisWorkloads();
      this.resumeGlobalWorkloads();
    }

    this.notifySubscribers({
      prevMode,
      currentMode: nextMode,
      transitionId: this.transitionCount,
      workloadStates: { ...this.workloadStates },
    });
  }

  /**
   * Suspend workloads exclusive to WORLD mode (OpenSky, CelesTrak, AISStream, workers)
   */
  suspendGlobalWorkloads() {
    this.workloadStates[WorkloadCategory.GLOBAL_ONLY] = false;

    // Abort pending global network requests
    this.abortByTag('global_fetch');

    // Pause animation workers if registered
    const animWorker = this.workers.get('animationWorker');
    if (animWorker) {
      try {
        animWorker.postMessage({ type: 'STOP' });
      } catch (_e) {}
    }
  }

  /**
   * Resume workloads exclusive to WORLD mode
   */
  resumeGlobalWorkloads() {
    this.workloadStates[WorkloadCategory.GLOBAL_ONLY] = true;

    const animWorker = this.workers.get('animationWorker');
    if (animWorker) {
      try {
        animWorker.postMessage({ type: 'START' });
      } catch (_e) {}
    }
  }

  /**
   * Suspend workloads exclusive to CRISIS mode
   */
  suspendCrisisWorkloads() {
    this.workloadStates[WorkloadCategory.CRISIS_ONLY] = false;
    this.abortByTag('crisis_discovery');
  }

  /**
   * Resume workloads exclusive to CRISIS mode
   */
  resumeCrisisWorkloads() {
    this.workloadStates[WorkloadCategory.CRISIS_ONLY] = true;
  }

  /**
   * Register a background worker
   */
  registerWorker(name, workerInstance) {
    if (!name || !workerInstance) return;
    this.workers.set(name, workerInstance);
  }

  /**
   * Unregister worker
   */
  unregisterWorker(name) {
    this.workers.delete(name);
  }

  /**
   * Create a tracked AbortController associated with a tag
   */
  createAbortController(tag) {
    const controller = new AbortController();
    if (!this.abortControllers.has(tag)) {
      this.abortControllers.set(tag, new Set());
    }
    this.abortControllers.get(tag).add(controller);
    return controller;
  }

  /**
   * Abort all active requests under a given tag
   */
  abortByTag(tag) {
    const set = this.abortControllers.get(tag);
    if (set) {
      for (const ctrl of set) {
        try {
          ctrl.abort();
        } catch (_e) {}
      }
      set.clear();
    }
  }

  /**
   * Check if a workload category is currently active
   *
   * @param {string} category - WorkloadCategory
   * @returns {boolean}
   */
  isWorkloadActive(category) {
    if (category === WorkloadCategory.SHARED) return true;
    return Boolean(this.workloadStates[category]);
  }

  /**
   * Subscribe to mode and workload transitions
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(payload) {
    for (const sub of this.subscribers) {
      try {
        sub(payload);
      } catch (_e) {}
    }
  }

  /**
   * Full teardown of all managed resources
   */
  teardown() {
    this.subscribers.clear();
    for (const [tag] of this.abortControllers) {
      this.abortByTag(tag);
    }
    for (const [_key, id] of this.intervals) {
      clearInterval(id);
    }
    this.intervals.clear();
  }
}

export const globalProviderManager = new ProviderManager();
