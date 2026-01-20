/**
 * BaseProvider
 * Minimal shared interface for CATI calling providers.
 *
 * Design goals:
 * - Zero heavy initialization (no background timers, no caches here)
 * - Small surface area: makeCall(), normalizeWebhookData(), optional registerAgent()
 */
class BaseProvider {
  constructor(config = {}) {
    this.config = config || {};
  }

  getName() {
    return 'base';
  }

  /**
   * Initiate a call. Must return:
   * { callId, apiResponse, provider }
   */
  // eslint-disable-next-line no-unused-vars
  async makeCall(callParams) {
    throw new Error('makeCall() not implemented');
  }

  /**
   * Normalize webhook data into a provider-agnostic shape.
   * Must return an object that contains at least:
   * { callId, fromNumber, toNumber, callStatus, callDuration, startTime, endTime, recordingUrl, uid? }
   */
  // eslint-disable-next-line no-unused-vars
  normalizeWebhookData(webhookData, method, query, body) {
    return webhookData || query || body || {};
  }

  /**
   * Optional: register an agent/from-number (only required by some providers).
   */
  // eslint-disable-next-line no-unused-vars
  async registerAgent(agentNumber, agentName) {
    return { success: true, skipped: true };
  }
}

module.exports = BaseProvider;


