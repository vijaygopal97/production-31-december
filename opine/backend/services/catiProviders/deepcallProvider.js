/**
 * DeepCall Provider Implementation
 */
const axios = require('axios');
const BaseProvider = require('./baseProvider');

// DeepCall API Configuration
const DEEPCALL_API_BASE_URL = process.env.DEEPCALL_API_BASE_URL || 'https://s-ct3.sarv.com/v2/clickToCall/para';
const DEEPCALL_USER_ID = process.env.DEEPCALL_USER_ID || '89130240';
const DEEPCALL_TOKEN = process.env.DEEPCALL_TOKEN || '6GQJuwW6lB8ZBHntzaRU';
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://opine.exypnossolutions.com';

class DeepCallProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.apiBaseUrl = config.apiBaseUrl || DEEPCALL_API_BASE_URL;
    this.userId = config.userId || config.user_id || DEEPCALL_USER_ID;
    this.token = config.token || DEEPCALL_TOKEN;
    this.webhookBaseUrl = config.webhookBaseUrl || WEBHOOK_BASE_URL;
  }

  getName() {
    return 'deepcall';
  }

  /**
   * Initiate a call via DeepCall API
   * @param {Object} callParams - Call parameters
   * @param {String} callParams.fromNumber - Agent/interviewer number
   * @param {String} callParams.toNumber - Respondent number
   * @param {String} callParams.fromType - Type of fromNumber (default: 'Number')
   * @param {String} callParams.toType - Type of toNumber (default: 'Number')
   * @param {Number} callParams.fromRingTime - Ring time for fromNumber (default: 30)
   * @param {Number} callParams.toRingTime - Ring time for toNumber (default: 30)
   * @param {String} callParams.uid - Optional unique identifier
   * @returns {Promise<{callId: String, apiResponse: Object, provider: String}>}
   */
  async makeCall(callParams) {
    const {
      fromNumber,
      toNumber,
      fromType = 'Number',
      toType = 'Number',
      fromRingTime = 30,
      toRingTime = 30,
      uid = null
    } = callParams;

    // Clean phone numbers
    const cleanFrom = fromNumber.replace(/[^0-9]/g, '');
    const cleanTo = toNumber.replace(/[^0-9]/g, '');

    // Build API parameters
    const params = {
      user_id: this.userId,
      token: this.token,
      from: cleanFrom,
      to: cleanTo,
      from_type: fromType,
      to_type: toType,
      from_ring_time: fromRingTime,
      to_ring_time: toRingTime
    };

    // Add webhook URL if provided
    const webhookUrl = `${this.webhookBaseUrl}/api/cati/webhook`;
    params.webhook_url = webhookUrl;

    // Add optional UID for call tracking
    if (uid) {
      params.uid = String(uid);
    }

    console.log(`📞 [DeepCall] Making call: ${fromNumber} -> ${toNumber}`);

    try {
      const response = await axios.get(this.apiBaseUrl, {
        params,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const apiResponse = response.data;

      // DeepCall returns call_id in response
      const callId = apiResponse?.call_id || 
                     apiResponse?.callId || 
                     apiResponse?.id || 
                     uid;

      if (!callId) {
        throw new Error('DeepCall response did not include call identifier');
      }

      return {
        callId,
        apiResponse,
        provider: 'deepcall'
      };
    } catch (error) {
      console.error(`❌ [DeepCall] Call failed: ${error.message}`);
      if (error.response) {
        console.error(`   Response: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Normalize DeepCall webhook data into a provider-agnostic format
   * @param {Object} webhookData - Raw webhook data
   * @param {String} method - HTTP method (GET/POST)
   * @param {Object} query - Query parameters (for GET)
   * @param {Object} body - Request body (for POST)
   * @returns {Object} Normalized webhook data
   */
  normalizeWebhookData(webhookData, method, query, body) {
    // DeepCall typically sends POST with JSON body
    const data = webhookData || body || query || {};

    const normalized = {
      // Call identification
      callId: data.call_id || data.callId || data.id || data.uid,
      uid: data.uid || data.call_id || data.callId,
      
      // Phone numbers
      fromNumber: data.from || data.from_number || data.fromNumber,
      toNumber: data.to || data.to_number || data.toNumber,
      answeredNumber: data.answered_number || data.answeredNumber,
      
      // Status
      status: data.status || data.call_status || 'ANSWER',
      callStatus: this.normalizeStatus(data.status || data.call_status),
      
      // Timing
      callDuration: parseInt(data.call_duration || data.callDuration || data.duration || '0', 10),
      startTime: data.start_time || data.startTime || data.created_at,
      endTime: data.end_time || data.endTime || data.ended_at,
      
      // Recording
      recordingUrl: data.recording_url || data.recordingUrl || data.recording,
      
      // Direction
      direction: data.direction || 'outbound',
      
      // Original webhook data
      rawWebhookData: data
    };

    return normalized;
  }

  /**
   * Normalize status string to standard format
   * @param {String} status - Raw status from provider
   * @returns {String} Normalized status
   */
  normalizeStatus(status) {
    if (!status) return 'completed';
    
    const statusLower = status.toString().toLowerCase();
    if (statusLower.includes('answer')) return 'answered';
    if (statusLower.includes('busy')) return 'busy';
    if (statusLower.includes('no') || statusLower.includes('unans')) return 'no-answer';
    if (statusLower.includes('cancel')) return 'cancelled';
    if (statusLower.includes('fail')) return 'failed';
    return 'completed';
  }
}

module.exports = DeepCallProvider;

