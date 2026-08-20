/**
 * Worldview Data Fabric — Provider Lifecycle Contract
 *
 * Standardized lifecycle CONTRACT/INTERFACE used BY ProviderManager.
 * This is NOT a competing lifecycle controller.
 *
 * Authority chain:
 *   Component → ProviderManager → ProviderLifecycleContract → Adapter
 *
 * ProviderManager (existing, sole runtime authority) decides WHEN to start/stop.
 * ProviderLifecycleContract defines HOW those operations are performed.
 *
 * State machine:
 *   UNINITIALIZED → INITIALIZED → RUNNING ⇄ PAUSED → STOPPED
 *
 * Ownership tracking prevents duplicate subscriptions.
 * A provider must not be started by two components simultaneously.
 */

import { LifecycleState, ProviderOwnership } from './providerTypes.js';

// Valid state transitions
const VALID_TRANSITIONS = Object.freeze({
  [LifecycleState.UNINITIALIZED]: [LifecycleState.INITIALIZED],
  [LifecycleState.INITIALIZED]: [LifecycleState.RUNNING, LifecycleState.STOPPED],
  [LifecycleState.RUNNING]: [LifecycleState.PAUSED, LifecycleState.STOPPED],
  [LifecycleState.PAUSED]: [LifecycleState.RUNNING, LifecycleState.STOPPED],
  [LifecycleState.STOPPED]: [LifecycleState.INITIALIZED],
});

export class ProviderLifecycleContract {
  /**
   * @param {string} providerId
   */
  constructor(providerId) {
    if (!providerId) throw new Error('ProviderLifecycleContract requires a providerId');
    this.providerId = providerId;
    this.state = LifecycleState.UNINITIALIZED;
    this.currentOwner = null;
  }

  /**
   * Validates and performs a state transition.
   * @param {string} targetState
   * @throws {Error} if transition is invalid
   */
  _transition(targetState) {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(targetState)) {
      throw new Error(
        `Invalid lifecycle transition for "${this.providerId}": ${this.state} → ${targetState}. ` +
        `Allowed from ${this.state}: ${(allowed || []).join(', ') || 'none'}`
      );
    }
    this.state = targetState;
  }

  /**
   * Initialize the provider. Must be called before start().
   * Default implementation is a no-op — override for custom init logic.
   */
  initialize() {
    this._transition(LifecycleState.INITIALIZED);
  }

  /**
   * Start the provider. Requires INITIALIZED or re-entry from PAUSED.
   * Records ownership to prevent duplicate starts.
   *
   * @param {string} [owner=ProviderOwnership.SHARED] - Who is starting this provider
   * @throws {Error} if already running under a different owner
   */
  start(owner = ProviderOwnership.SHARED) {
    if (this.state === LifecycleState.RUNNING) {
      if (this.currentOwner && this.currentOwner !== owner) {
        throw new Error(
          `Provider "${this.providerId}" is already running under owner "${this.currentOwner}". ` +
          `Cannot start again under "${owner}". Prevent duplicate subscriptions.`
        );
      }
      // Already running under same owner — no-op
      return;
    }
    this._transition(LifecycleState.RUNNING);
    this.currentOwner = owner;
  }

  /**
   * Pause the provider. Can be resumed later.
   */
  pause() {
    this._transition(LifecycleState.PAUSED);
  }

  /**
   * Resume the provider from PAUSED state.
   *
   * @param {string} [owner] - Optionally re-assign owner
   */
  resume(owner) {
    this._transition(LifecycleState.RUNNING);
    if (owner) this.currentOwner = owner;
  }

  /**
   * Stop the provider. Clears ownership.
   */
  stop() {
    this._transition(LifecycleState.STOPPED);
    this.currentOwner = null;
  }

  /**
   * Health check. Default returns the current state.
   * Override for providers that need active health probing.
   *
   * @returns {{ providerId: string, state: string, owner: string|null }}
   */
  healthCheck() {
    return {
      providerId: this.providerId,
      state: this.state,
      owner: this.currentOwner,
    };
  }

  /**
   * Get current lifecycle state.
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Get current owner.
   * @returns {string|null}
   */
  getOwner() {
    return this.currentOwner;
  }

  /**
   * Check if provider is currently running.
   * @returns {boolean}
   */
  isRunning() {
    return this.state === LifecycleState.RUNNING;
  }
}

/**
 * Registry of lifecycle instances, queried by ProviderManager.
 * Each provider gets at most one lifecycle contract.
 */
export class ProviderLifecycleManager {
  constructor() {
    /** @type {Map<string, ProviderLifecycleContract>} */
    this.lifecycles = new Map();
  }

  /**
   * Register a lifecycle contract for a provider.
   * If none is provided, creates a default contract.
   *
   * @param {string} providerId
   * @param {ProviderLifecycleContract} [lifecycle]
   * @returns {ProviderLifecycleContract}
   */
  registerLifecycle(providerId, lifecycle = null) {
    if (this.lifecycles.has(providerId)) {
      return this.lifecycles.get(providerId);
    }
    const lc = lifecycle || new ProviderLifecycleContract(providerId);
    this.lifecycles.set(providerId, lc);
    return lc;
  }

  /**
   * Get the lifecycle contract for a provider.
   *
   * @param {string} providerId
   * @returns {ProviderLifecycleContract|null}
   */
  getLifecycle(providerId) {
    return this.lifecycles.get(providerId) || null;
  }

  /**
   * Remove a lifecycle contract.
   *
   * @param {string} providerId
   * @returns {boolean}
   */
  removeLifecycle(providerId) {
    return this.lifecycles.delete(providerId);
  }

  /**
   * Get all lifecycle states as a snapshot.
   *
   * @returns {object}
   */
  getSnapshot() {
    const snapshot = {};
    for (const [id, lc] of this.lifecycles) {
      snapshot[id] = lc.healthCheck();
    }
    return snapshot;
  }

  /**
   * Get all currently running providers.
   *
   * @returns {Array<string>} Provider IDs
   */
  getRunning() {
    const running = [];
    for (const [id, lc] of this.lifecycles) {
      if (lc.isRunning()) running.push(id);
    }
    return running;
  }
}
