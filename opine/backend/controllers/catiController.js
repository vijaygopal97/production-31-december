const axios = require('axios');
const fs = require('fs');
const path = require('path');
const CatiCall = require('../models/CatiCall');
const CatiRespondentQueue = require('../models/CatiRespondentQueue');
const SurveyResponse = require('../models/SurveyResponse');
const CatiAgent = require('../models/CatiAgent');
const ProviderFactory = require('../services/catiProviders/providerFactory');
const CloudTelephonyProvider = require('../services/catiProviders/cloudtelephonyProvider');
const Company = require('../models/Company');

// DeepCall API Configuration
const DEEPCALL_API_BASE_URL = 'https://s-ct3.sarv.com/v2/clickToCall/para';
const DEEPCALL_USER_ID = process.env.DEEPCALL_USER_ID || '89130240';
const DEEPCALL_TOKEN = process.env.DEEPCALL_TOKEN || '6GQJuwW6lB8ZBHntzaRU';
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://opine.exypnossolutions.com';

// Lightweight, safe debug logger for webhooks (avoids large JSON stringify + sync disk writes)
const shouldDebugWebhook = () => process.env.WEBHOOK_DEBUG_LOG === '1';
const safePreview = (val, max = 500) => {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'string' ? val : (() => { try { return JSON.stringify(val); } catch { return String(val); } })();
  return str.length > max ? str.slice(0, max) + '…' : str;
};

// @desc    Make a CATI call
// @route   POST /api/cati/make-call
// @access  Private (Company Admin only)
const makeCall = async (req, res) => {
  try {
    const { fromNumber, toNumber, fromType, toType, fromRingTime, toRingTime, timeLimit } = req.body;
    const userId = req.user._id;
    const companyId = req.user.company;

    // Validate required fields
    if (!fromNumber || !toNumber) {
      return res.status(400).json({
        success: false,
        message: 'From number and To number are required'
      });
    }

    // Validate phone numbers (basic validation)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(fromNumber.replace(/[^0-9]/g, '')) || !phoneRegex.test(toNumber.replace(/[^0-9]/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Please provide 10-digit numbers.'
      });
    }

    // Clean phone numbers (remove all non-digits)
    const cleanFrom = fromNumber.replace(/[^0-9]/g, '');
    const cleanTo = toNumber.replace(/[^0-9]/g, '');

    // Provider selection (company-specific)
    const { provider, providerName } = await ProviderFactory.getProvider(companyId, {
      fromNumber: cleanFrom,
      toNumber: cleanTo,
      selectionKey: `${companyId}_${cleanFrom}_${cleanTo}`
    });

    // Ensure agent is registered for providers that require it (CloudTelephony)
    if (providerName === 'cloudtelephony') {
      const agent = await CatiAgent.getOrCreate(userId, cleanFrom);
      if (!agent.isRegistered('cloudtelephony')) {
        const agentName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || cleanFrom;
        try {
          const regResult = await provider.registerAgent(cleanFrom, agentName);
          // Mark as registered even if provider says "already exists" (idempotent behavior)
          agent.markRegistered('cloudtelephony', regResult?.response?.member_id || regResult?.response?.agentId || null);
          await agent.save();
        } catch (regErr) {
          // If registration fails, don't attempt call (provider requires it)
          return res.status(500).json({
            success: false,
            message: 'Failed to register agent for CloudTelephony',
            error: regErr.message
          });
        }
      }
    }

    const webhookUrlDeepCall = `${WEBHOOK_BASE_URL}/api/cati/webhook`;
    const webhookUrlCloudTelephony = `${WEBHOOK_BASE_URL}/api/cati/webhook/cloudtelephony`;

    console.log(`📞 Making CATI call via provider=${providerName}: ${fromNumber} -> ${toNumber}`);
    if (shouldDebugWebhook()) {
      console.log(`📡 Webhook URLs: deepcall=${webhookUrlDeepCall}, cloudtelephony=${webhookUrlCloudTelephony}`);
    }

    // Initiate provider call
    let callResult;
    try {
      callResult = await provider.makeCall({
        fromNumber: cleanFrom,
        toNumber: cleanTo,
        fromType,
        toType,
        fromRingTime,
        toRingTime,
        timeLimit,
        // CloudTelephony can return uid back in webhook; provide one for correlation (admin calls)
        uid: providerName === 'cloudtelephony'
          ? `adm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
          : undefined
      });
    } catch (error) {
      // Persist an error record for visibility (keeps existing behavior for admins)
      const callRecord = new CatiCall({
        callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        company: companyId,
        createdBy: userId,
        fromNumber: cleanFrom,
        toNumber: cleanTo,
        fromType: fromType || 'Number',
        toType: toType || 'Number',
        apiStatus: 'failed',
        apiResponse: { error: error.message, provider: providerName },
        apiErrorMessage: error.message,
        callStatus: 'failed',
        errorCode: '500',
        errorMessage: error.message,
        metadata: { provider: providerName }
      });
      await callRecord.save();

      return res.status(500).json({
        success: false,
        message: 'Failed to initiate call',
        error: error.message,
        provider: providerName,
        callId: callRecord.callId
      });
    }

    const callId = callResult?.callId;
    if (!callId) {
      return res.status(500).json({
        success: false,
        message: 'Provider response does not contain call ID',
        provider: providerName,
        apiResponse: callResult?.apiResponse
      });
    }

    // IMPORTANT: Do NOT create call record here (webhook creates the canonical record)
    res.json({
      success: true,
      message: 'Call initiated successfully. Call details will appear in history once the webhook is received.',
      provider: providerName,
      callId,
      data: {
        callId,
        fromNumber,
        toNumber,
        apiResponse: callResult?.apiResponse,
        webhookUrl: providerName === 'cloudtelephony' ? webhookUrlCloudTelephony : webhookUrlDeepCall,
        note: 'Call record will be created when webhook is received'
      }
    });

  } catch (error) {
    console.error('Error making CATI call:', error);
    res.status(500).json({
      success: false,
      message: 'Error making call',
      error: error.message
    });
  }
};

// @desc    Get current company CATI provider configuration
// @route   GET /api/cati/provider-config
// @access  Private (Company Admin only)
const getProviderConfig = async (req, res) => {
  try {
    const companyId = req.user.company;
    const company = await Company.findById(companyId).select('catiProviderConfig').lean();
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    return res.status(200).json({
      success: true,
      data: company.catiProviderConfig || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Update company CATI provider configuration
// @route   PUT /api/cati/provider-config
// @access  Private (Company Admin only)
const updateProviderConfig = async (req, res) => {
  try {
    const companyId = req.user.company;
    const config = req.body || {};

    // Minimal validation & normalization
    const enabledProviders = Array.isArray(config.enabledProviders) ? config.enabledProviders : undefined;
    const selectionMethod = config.selectionMethod;
    const activeProvider = config.activeProvider;
    const fallbackProvider = config.fallbackProvider;
    const percentages = config.percentages;
    const providersConfig = config.providersConfig;

    const update = {};
    if (enabledProviders) update['catiProviderConfig.enabledProviders'] = enabledProviders;
    if (selectionMethod) update['catiProviderConfig.selectionMethod'] = selectionMethod;
    if (activeProvider) update['catiProviderConfig.activeProvider'] = activeProvider;
    if (fallbackProvider) update['catiProviderConfig.fallbackProvider'] = fallbackProvider;
    if (percentages) update['catiProviderConfig.percentages'] = percentages;
    if (providersConfig) update['catiProviderConfig.providersConfig'] = providersConfig;

    const company = await Company.findByIdAndUpdate(companyId, { $set: update }, { new: true, runValidators: true })
      .select('catiProviderConfig')
      .lean();

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // CRITICAL: Clear provider cache when configuration changes
    // This ensures the new provider selection is used immediately
    ProviderFactory.clearCache();
    console.log(`✅ Cleared provider cache after config update for company ${companyId}`);

    return res.status(200).json({
      success: true,
      message: 'CATI provider configuration updated',
      data: company.catiProviderConfig
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// @desc    Receive webhook from CloudTelephony (GET query params)
// @route   GET /api/cati/webhook/cloudtelephony
// @access  Public
const receiveCloudTelephonyWebhook = async (req, res) => {
  // Respond immediately to avoid provider retries
  res.status(200).send('OK');

  setImmediate(async () => {
    const logDir = path.join(__dirname, '../logs');
    const logFile = path.join(logDir, 'cloudtelephony-webhook-requests.log');
    const timestamp = new Date().toISOString();
    try {
      // Ensure log directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const ip = req.ip || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Always write a minimal line (safe + small), and write detailed entry only when debug enabled.
      const minimalLine = `\n[${timestamp}] CLOUDTELEPHONY WEBHOOK ip=${safePreview(ip, 120)} ua=${safePreview(userAgent, 200)} url=${safePreview(req.url, 500)} queryPreview=${safePreview(req.query, 800)}\n`;
      fs.promises.appendFile(logFile, minimalLine, 'utf8').catch(() => {});

      if (shouldDebugWebhook()) {
        const debugEntry = {
          timestamp,
          ip,
          userAgent,
          method: req.method,
          url: req.url,
          queryKeys: req.query && typeof req.query === 'object' ? Object.keys(req.query).slice(0, 80) : [],
          query: req.query
        };
        const debugLine = `\n${'='.repeat(80)}\n[${timestamp}] CLOUDTELEPHONY WEBHOOK (DEBUG)\n${safePreview(debugEntry, 8000)}\n${'='.repeat(80)}\n`;
        fs.promises.appendFile(logFile, debugLine, 'utf8').catch(() => {});
      }

      const provider = new CloudTelephonyProvider({});
      const normalized = provider.normalizeWebhookData(null, req.method, req.query, req.body);

      const callId = normalized?.callId ? String(normalized.callId).trim() : null;
      if (!callId) {
        console.error('❌ [CloudTelephony] Webhook missing callId/CallSid. Query preview:', safePreview(req.query, 800));
        return;
      }

      // Extract/clean numbers
      const fromNum = (normalized.fromNumber || '').toString().replace(/[^0-9]/g, '');
      const toNum = (normalized.toNumber || '').toString().replace(/[^0-9]/g, '');
      const uid = normalized.uid ? String(normalized.uid) : null;

      let queueEntry = null;
      if (uid) {
        queueEntry = await CatiRespondentQueue.findOne({ lastCallProviderUid: uid }).sort({ assignedAt: -1 });
      }
      if (!queueEntry && toNum) {
        // Fallback: recent queue entry match by respondent phone (best-effort)
        queueEntry = await CatiRespondentQueue.findOne({
          'respondentContact.phone': { $regex: toNum.slice(-10) },
          status: { $in: ['assigned', 'calling'] },
          lastAttemptedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // 60 mins
        }).sort({ assignedAt: -1 });
      }

      // Resolve company from survey (for proper company-admin visibility in call lists)
      let resolvedCompanyId = null;
      if (queueEntry?.survey) {
        try {
          const Survey = require('../models/Survey');
          const survey = await Survey.findById(queueEntry.survey).select('company').lean();
          resolvedCompanyId = survey?.company || null;
        } catch (_) {
          resolvedCompanyId = null;
        }
      }

      let callRecord = await CatiCall.findOne({ callId });
      if (!callRecord) {
        callRecord = new CatiCall({
          callId,
          survey: queueEntry?.survey || null,
          queueEntry: queueEntry?._id || null,
          company: resolvedCompanyId,
          createdBy: queueEntry?.assignedTo || null,
          fromNumber: fromNum,
          toNumber: toNum,
          webhookReceived: true,
          webhookReceivedAt: new Date(),
          metadata: {
            provider: 'cloudtelephony',
            uid: uid || undefined
          }
        });
      }

      const update = {
        webhookData: req.query || {},
        webhookReceived: true,
        webhookReceivedAt: new Date(),
        updatedAt: new Date(),
        callStatus: normalized.callStatus || 'completed',
        callDuration: Number.isFinite(normalized.callDuration) ? normalized.callDuration : (parseInt(normalized.callDuration || '0', 10) || 0),
        recordingUrl: normalized.recordingUrl || null,
        // Ensure existing records created with earlier mapping get corrected
        fromNumber: fromNum || callRecord.fromNumber,
        toNumber: toNum || callRecord.toNumber,
        metadata: {
          ...(callRecord.metadata || {}),
          provider: 'cloudtelephony',
          uid: uid || (callRecord.metadata && callRecord.metadata.uid),
          deskphoneNumber: normalized.deskphoneNumber || (callRecord.metadata && callRecord.metadata.deskphoneNumber)
        }
      };

      // Parse timestamps if present
      const parseDate = (v) => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };
      const st = parseDate(normalized.startTime);
      const et = parseDate(normalized.endTime);
      if (st) update.callStartTime = st;
      if (et) update.callEndTime = et;

      // Save/update
      callRecord.set(update);
      await callRecord.save();

      // Link queue entry to call record for UI retrieval
      if (queueEntry && (!queueEntry.callRecord || queueEntry.callRecord.toString() !== callRecord._id.toString())) {
        queueEntry.callRecord = callRecord._id;
        queueEntry.lastCallProvider = 'cloudtelephony';
        queueEntry.lastCallProviderUid = uid;
        queueEntry.lastCallProviderCallId = callId;
        await queueEntry.save();
      }

      // If a response already exists for this queue entry, ensure it references the correct provider callId
      // CRITICAL FIX: Only update responses created within the last 5 hours to prevent updating old responses
      if (queueEntry?.response) {
        try {
          const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
          
          // First, check if the response exists and was created recently
          const existingResponse = await SurveyResponse.findById(queueEntry.response)
            .select('_id responseId call_id createdAt')
            .lean();
          
          if (existingResponse) {
            const responseAge = existingResponse.createdAt ? new Date(existingResponse.createdAt) : null;
            const isRecent = responseAge && responseAge >= fiveHoursAgo;
            
            // Check if response already has a different call_id (prevent overwriting)
            const hasDifferentCallId = existingResponse.call_id && 
                                      existingResponse.call_id !== callId && 
                                      existingResponse.call_id.trim() !== '';
            
            if (!isRecent) {
              console.warn(`⚠️ [CloudTelephony] Skipping call_id update for old response ${existingResponse.responseId || existingResponse._id} (created: ${responseAge ? responseAge.toISOString() : 'N/A'}, required: within last 5 hours)`);
            } else if (hasDifferentCallId) {
              console.warn(`⚠️ [CloudTelephony] Skipping call_id update - response ${existingResponse.responseId || existingResponse._id} already has call_id: ${existingResponse.call_id}`);
            } else {
              // Safe to update: response is recent and doesn't have a conflicting call_id
              await SurveyResponse.updateOne(
                { _id: queueEntry.response },
                { $set: { call_id: callId, 'metadata.callProvider': 'cloudtelephony' } }
              );
              console.log(`✅ [CloudTelephony] Updated call_id for recent response ${existingResponse.responseId || existingResponse._id}`);
            }
          } else {
            // Response doesn't exist - might have been deleted, try to find most recent response for this queue entry
            const recentResponse = await SurveyResponse.findOne({
              'metadata.respondentQueueId': queueEntry._id,
              createdAt: { $gte: fiveHoursAgo }
            })
            .select('_id responseId call_id createdAt')
            .sort({ createdAt: -1 })
            .lean();
            
            if (recentResponse) {
              const hasDifferentCallId = recentResponse.call_id && 
                                        recentResponse.call_id !== callId && 
                                        recentResponse.call_id.trim() !== '';
              
              if (!hasDifferentCallId) {
                await SurveyResponse.updateOne(
                  { _id: recentResponse._id },
                  { $set: { call_id: callId, 'metadata.callProvider': 'cloudtelephony' } }
                );
                console.log(`✅ [CloudTelephony] Updated call_id for recent response found by queue entry: ${recentResponse.responseId || recentResponse._id}`);
              } else {
                console.warn(`⚠️ [CloudTelephony] Skipping call_id update - recent response ${recentResponse.responseId || recentResponse._id} already has call_id: ${recentResponse.call_id}`);
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ [CloudTelephony] Failed to update SurveyResponse.call_id for queueEntry.response:', e.message);
        }
      }

      // Background S3 upload (non-blocking, only if URL exists)
      if (update.recordingUrl && typeof update.recordingUrl === 'string' && update.recordingUrl.startsWith('http')) {
        const callIdForUpload = callRecord.callId;
        const recordingUrlForUpload = update.recordingUrl;
        setImmediate(async () => {
          try {
            const callForUpload = await CatiCall.findOne({ callId: callIdForUpload }).select('s3AudioUrl s3AudioUploadStatus').lean();
            if (callForUpload && (!callForUpload.s3AudioUrl || callForUpload.s3AudioUploadStatus !== 'uploaded')) {
              const { downloadAndUploadCatiAudio } = require('../utils/cloudStorage');
              const uploadResult = await downloadAndUploadCatiAudio(recordingUrlForUpload, callIdForUpload, { source: 'cloudtelephony' });
              if (uploadResult?.s3Key) {
                await CatiCall.updateOne(
                  { callId: callIdForUpload },
                  { $set: { s3AudioUrl: uploadResult.s3Key, s3AudioUploadedAt: new Date(), s3AudioUploadStatus: 'uploaded' } }
                );
              }
            }
          } catch (e) {
            console.error('❌ [CloudTelephony] Background S3 upload failed:', e.message);
            await CatiCall.updateOne(
              { callId: callIdForUpload },
              { $set: { s3AudioUploadStatus: 'failed', s3AudioUploadError: e.message, s3AudioUploadedAt: new Date() } }
            ).catch(() => {});
          }
        });
      }

      if (shouldDebugWebhook()) {
        console.log(`✅ [CloudTelephony] Webhook processed. callId=${callId}, uid=${uid || 'n/a'}`);
      }
    } catch (error) {
      console.error('❌ [CloudTelephony] Webhook processing error:', error.message);
    }
  });
};

// @desc    Receive webhook from DeepCall
// @route   POST /api/cati/webhook
// @access  Public (Webhook endpoint)
const receiveWebhook = async (req, res) => {
  // CRITICAL: Respond IMMEDIATELY with 200 OK and "GODBLESSYOU" to DeepCall
  // DeepCall requires this response BEFORE any processing
  // If we don't respond quickly enough, DeepCall may mark the webhook as failed
  // and send empty data in subsequent requests
  res.status(200).send('GODBLESSYOU');
  
  // Now process the webhook data asynchronously (after response is sent)
  // This ensures DeepCall gets an immediate response
  
  const logDir = path.join(__dirname, '../logs');
  const logFile = path.join(logDir, 'webhook-requests.log');
  const timestamp = new Date().toISOString();
  
  // Process asynchronously to avoid blocking
  setImmediate(async () => {
    try {
      // Ensure log directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const ip = req.ip || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const contentType = req.headers['content-type'] || 'unknown';

      // Minimal logs by default (avoid large stringify / sync I/O)
      console.log('📥 Webhook received:', {
        ts: timestamp,
        ip,
        contentType,
        method: req.method,
        url: req.url
      });

      // Optional debug logging (truncated, async)
      if (shouldDebugWebhook()) {
        const logEntry = {
          timestamp,
          ip,
          userAgent,
          contentType,
          method: req.method,
          url: req.url,
          bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body).slice(0, 50) : [],
          queryKeys: req.query && typeof req.query === 'object' ? Object.keys(req.query).slice(0, 50) : [],
          rawBodyLength: req.rawBody ? req.rawBody.length : 0,
          rawBodyPreview: req.rawBody ? req.rawBody.substring(0, 500) : undefined
        };

        const logLine = `\n${'='.repeat(80)}\n[${timestamp}] WEBHOOK REQUEST RECEIVED\n${safePreview(logEntry, 8000)}\n${'='.repeat(80)}\n`;
        fs.promises.appendFile(logFile, logLine, 'utf8').catch(() => {});
      }

    // According to DeepCall docs: https://deepcall.com/api/push-report-webhook
    // The webhook sends data in JSON format directly in the request body
    // We need to handle both JSON and form-encoded formats
    
    let webhookData = {};
    
    // First, try to use raw body if available (captured via verify function)
    if (req.rawBody) {
      // CRITICAL: Removed full rawBody logging - causes memory leaks for large webhooks
      console.log('📋 ========== RAW BODY CAPTURED ==========');
      console.log('📋 Raw body length:', req.rawBody.length, 'bytes');
      // CRITICAL: Only log first 500 chars to prevent memory leaks
      console.log('📋 Raw body preview:', req.rawBody.substring(0, 500), req.rawBody.length > 500 ? '...' : '');
      console.log('📋 =======================================');
      
      // Try to parse as JSON first (DeepCall docs say it sends JSON)
      try {
        webhookData = JSON.parse(req.rawBody);
        console.log('✅ Successfully parsed raw body as JSON');
        console.log('📋 Parsed data keys:', Object.keys(webhookData));
        // CRITICAL: Removed JSON.stringify() - causes memory leaks for large webhook data
        console.log('📋 Parsed data keys count:', Object.keys(webhookData).length);
      } catch (e) {
        // If not JSON, try form-encoded
        console.log('⚠️  Raw body is not JSON, trying form-encoded format');
        console.log('   Error:', e.message);
        const querystring = require('querystring');
        const parsed = querystring.parse(req.rawBody);
        console.log('📋 Parsed form-encoded keys:', Object.keys(parsed));
        // CRITICAL: Removed JSON.stringify() - causes memory leaks for large parsed data
        console.log('📋 Parsed form-encoded keys count:', Object.keys(parsed).length);
        
        // Check for push_report field
        if (parsed.push_report) {
          console.log('📋 Found push_report in form-encoded data');
          console.log('📋 push_report value:', parsed.push_report);
          console.log('📋 push_report type:', typeof parsed.push_report);
          console.log('📋 push_report length:', parsed.push_report.length);
          
          // Check if push_report is empty
          if (parsed.push_report === '{}' || parsed.push_report.trim() === '{}') {
            console.error('❌ CRITICAL: push_report is EMPTY "{}"');
            console.error('   This means the webhook template in DeepCall dashboard is sending empty data.');
            console.error('   The template needs to be configured with actual field values.');
            console.error('   According to DeepCall docs, the webhook should receive JSON with all call data.');
            console.error('   Please check the webhook template configuration in DeepCall dashboard.');
            console.error('   The template should include fields like: callId, callStatus, recordings, etc.');
          }
          
          try {
            webhookData = JSON.parse(parsed.push_report);
            console.log('✅ Successfully parsed push_report as JSON');
            console.log('📋 Parsed push_report keys:', Object.keys(webhookData));
            // CRITICAL: Removed JSON.stringify() - causes memory leaks for large webhook data
            console.log('📋 Parsed push_report keys count:', Object.keys(webhookData).length);
          } catch (e2) {
            console.error('❌ Error parsing push_report as JSON:', e2.message);
            console.error('   push_report value that failed:', parsed.push_report);
            webhookData = parsed;
          }
        } else {
          console.log('⚠️  No push_report field found in form-encoded data');
          webhookData = parsed;
        }
      }
    } else {
      // Fallback to parsed body (if raw body not available)
      console.log('📋 Using parsed body (raw body not available)');
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        webhookData = req.body || {};
        console.log('📋 Received as JSON format');
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        console.log('📋 Received as form-encoded format');
        if (req.body && req.body.push_report) {
          const pushReport = req.body.push_report;
          if (typeof pushReport === 'string') {
            try {
              webhookData = JSON.parse(pushReport);
              console.log('✅ Parsed push_report from form-encoded body');
            } catch (e) {
              console.error('❌ Error parsing push_report:', e.message);
              webhookData = req.body;
            }
          } else {
            webhookData = pushReport;
          }
        } else {
          webhookData = req.body || {};
        }
      } else {
        webhookData = req.body || {};
      }
    }
    
    // Log the final webhook data
    // CRITICAL: Removed JSON.stringify() - causes memory leaks for large webhook data
    console.log('📋 Final webhookData keys:', Object.keys(webhookData));
    console.log('📋 Final webhookData keys count:', Object.keys(webhookData).length);
    // Only log sample values for key fields, not entire object
    if (webhookData.callId) console.log('📋 callId:', webhookData.callId);
    if (webhookData.callStatus) console.log('📋 callStatus:', webhookData.callStatus);
    
    // Check if we have meaningful data
    if (Object.keys(webhookData).length === 0) {
      console.error('❌ CRITICAL: Webhook received but contains NO call data!');
      console.error('   This indicates the webhook template in DeepCall is not configured properly.');
      console.error('   According to DeepCall docs, the webhook should receive JSON data directly.');
      console.error('   Please verify the webhook template configuration in DeepCall dashboard.');
    } else if (webhookData.push_report === '{}' && Object.keys(webhookData).length === 1) {
      console.error('❌ CRITICAL: push_report is EMPTY JSON object "{}"');
      console.error('   This means the webhook template in DeepCall dashboard is not configured correctly.');
      console.error('   The template should include all the required fields from the DeepCall documentation.');
      console.error('   Please configure the webhook template in DeepCall dashboard with the actual data fields.');
    } else {
      console.log('✅ Webhook data received successfully with', Object.keys(webhookData).length, 'fields');
    }
    
    // Check if we have any meaningful data after parsing
    const hasData = Object.keys(webhookData).some(key => 
      key !== 'push_report' && webhookData[key] !== null && webhookData[key] !== undefined && webhookData[key] !== ''
    );
    
    if (!hasData && webhookData.push_report === '{}') {
      console.error('❌ CRITICAL: Webhook received but contains NO call data!');
      console.error('   This indicates the webhook template in DeepCall is not configured properly.');
      console.error('   Please configure the webhook template in DeepCall dashboard with the required fields.');
    }
    
    // Extract call ID from webhook data - try all possible formats
    const callId = webhookData?.callId || 
                   webhookData?.call_id ||
                   webhookData?.id || 
                   webhookData?.call?.id ||
                   webhookData?.call?.callId ||
                   webhookData?.data?.callId ||
                   webhookData?.data?.id;

    console.log(`🔍 Extracted Call ID: ${callId}`);
    console.log(`🔍 Webhook data keys:`, Object.keys(webhookData));
    // CRITICAL: Removed JSON.stringify() - causes memory leaks
    console.log(`🔍 api_para:`, webhookData?.api_para ? `Found (keys: ${Object.keys(webhookData.api_para || {}).length})` : 'Not found');
    console.log(`🔍 From (api_para):`, webhookData?.api_para?.from);
    console.log(`🔍 To (api_para):`, webhookData?.api_para?.to);
    console.log(`🔍 cNumber:`, webhookData?.cNumber);
    console.log(`🔍 masterNumCTC:`, webhookData?.masterNumCTC);

    // Find the call record by callId first
    let callRecord = null;
    if (callId) {
      // Try exact match
      callRecord = await CatiCall.findOne({ callId: callId.trim() });
      console.log(`🔍 Found by callId (exact): ${callRecord ? 'Yes' : 'No'}`);
      
      // If not found, try without any trimming or case sensitivity
    if (!callRecord) {
        callRecord = await CatiCall.findOne({
          callId: { $regex: new RegExp(`^${callId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        console.log(`🔍 Found by callId (regex): ${callRecord ? 'Yes' : 'No'}`);
      }
      
      if (callRecord) {
        console.log(`🔍 Matched call record - DB ID: ${callRecord._id}, Call ID: ${callRecord.callId}, From: ${callRecord.fromNumber}, To: ${callRecord.toNumber}`);
      }
    }

    // CRITICAL: Only search by phone numbers if we don't have a callId
    // If we have a callId, we should ONLY match by callId to avoid updating wrong calls
    // Multiple calls can have the same phone numbers, so phone number matching is unreliable
    
    // If we have a callId, ONLY search by callId (no phone number matching)
    // This ensures each call gets its own record
    if (!callRecord && callId) {
      console.log(`🔍 Searching for callId in database: ${callId}`);
      // Try exact match first
      callRecord = await CatiCall.findOne({ callId: callId.trim() });
      if (!callRecord) {
        // Try case-insensitive match
        callRecord = await CatiCall.findOne({ 
          callId: { $regex: new RegExp(`^${callId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
      }
      console.log(`🔍 Found by callId search: ${callRecord ? 'Yes' : 'No'}`);
      if (callRecord) {
        console.log(`🔍 Matched call record - DB ID: ${callRecord._id}, Call ID: ${callRecord.callId}`);
      }
    }
    
    // Only if we DON'T have a callId, try searching by phone numbers (last resort)
    // This should rarely happen as DeepCall always provides callId
    if (!callRecord && !callId) {
      console.log(`⚠️  No callId in webhook data, trying phone number match (last resort)`);
      const fromNum = (webhookData?.api_para?.from || 
                       webhookData?.from || 
                       webhookData?.fromNumber || 
                       webhookData?.call?.from ||
                       webhookData?.masterNumCTC)?.toString().replace(/[^0-9]/g, '');
      const toNum = (webhookData?.api_para?.to || 
                     webhookData?.cNumber ||
                     webhookData?.to || 
                     webhookData?.toNumber || 
                     webhookData?.call?.to)?.toString().replace(/[^0-9]/g, '');
      
      if (fromNum && toNum) {
        console.log(`🔍 Searching by numbers (no callId available): ${fromNum} -> ${toNum}`);
        // Only search in very recent calls (last 30 minutes) to avoid false matches
      callRecord = await CatiCall.findOne({
          fromNumber: fromNum,
          toNumber: toNum,
          createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 minutes only
          webhookReceived: { $ne: true } // Only match calls that haven't received webhook yet
      }).sort({ createdAt: -1 });
        
        if (callRecord) {
          console.log(`🔍 Found by numbers (no callId): ${callRecord._id}, Call ID: ${callRecord.callId}`);
        } else {
          console.log(`🔍 No call found by numbers (no callId available)`);
        }
      }
    }

    // If call record doesn't exist, CREATE it from webhook data
    // This is the ONLY place where call records are created
    // All call history comes from webhook data only
    if (!callRecord) {
      console.log(`📝 Call record not found. Creating new record from webhook data...`);
      console.log(`📝 Webhook callId: ${callId}`);
      
      // Extract phone numbers from webhook
      const fromNum = (webhookData?.api_para?.from || 
                       webhookData?.from || 
                       webhookData?.fromNumber || 
                       webhookData?.masterNumCTC)?.toString().replace(/[^0-9]/g, '');
      const toNum = (webhookData?.api_para?.to || 
                     webhookData?.cNumber ||
                     webhookData?.to || 
                     webhookData?.toNumber)?.toString().replace(/[^0-9]/g, '');
      
      if (!callId) {
        console.error(`❌ Cannot create call record: No callId in webhook data`);
      return;
    }

      if (!fromNum || !toNum) {
        console.error(`❌ Cannot create call record: Missing phone numbers. From: ${fromNum}, To: ${toNum}`);
        return;
      }
      
      // Try to find company/user by DeepCall userId
      // The webhook has userId which is DeepCall's userId
      // We'll try to find a user with matching deepCallUserId or create without company
      const webhookUserId = webhookData?.userId;
      let companyId = null;
      let createdById = null;
      
      // Try to find user by deepCallUserId if we have that field
      // For now, we'll create without company/user association
      // This can be improved later by storing DeepCall userId mapping
      console.log(`📝 Creating call record without company/user context (webhook userId: ${webhookUserId})`);
      console.log(`📝 Note: Company/user association can be added later if needed`);
      
      // Create the call record with webhook data
      // We'll set company and createdBy to null for now
      // This ensures the record is created and can be viewed
      // Normalize fromType and toType - capitalize first letter to match enum
      const normalizeType = (type) => {
        if (!type) return 'Number';
        const typeStr = type.toString();
        return typeStr.charAt(0).toUpperCase() + typeStr.slice(1).toLowerCase();
      };
      
      // Try to find queue entry for this call (by matching phone numbers)
      let queueEntry = null;
      if (fromNum && toNum) {
        // Search for queue entry with matching respondent phone number
        queueEntry = await CatiRespondentQueue.findOne({
          'respondentContact.phone': { $regex: toNum.slice(-10) },
          status: { $in: ['assigned', 'calling'] }
        }).sort({ assignedAt: -1 });
        
        if (queueEntry) {
          console.log(`🔗 Found queue entry for this call: ${queueEntry._id}`);
        }
      }
      
      callRecord = new CatiCall({
        callId: callId,
        survey: queueEntry?.survey || null,
        queueEntry: queueEntry?._id || null,
        company: companyId, // Will be null - can be updated later
        createdBy: createdById || queueEntry?.assignedTo || null, // Try to get from queue entry
        fromNumber: fromNum,
        toNumber: toNum,
        fromType: normalizeType(webhookData?.api_para?.fromType),
        toType: normalizeType(webhookData?.api_para?.toType),
        webhookReceived: true, // Mark as received immediately since we're creating from webhook
        webhookReceivedAt: new Date(),
        metadata: {
          deepCallUserId: webhookUserId,
          note: 'Created from webhook - company/user association may be added later'
        }
      });
      
      // We'll populate all fields from webhook in the updateData below
      console.log(`📝 Created new call record structure. Will populate with webhook data...`);
    }

    const isNewRecord = !callRecord._id;
    console.log(`✅ ${isNewRecord ? 'Creating new' : 'Updating existing'} call record`);
    if (!isNewRecord) {
      console.log(`✅ Database Call ID: ${callRecord.callId}`);
      console.log(`✅ From: ${callRecord.fromNumber}, To: ${callRecord.toNumber}`);
      console.log(`✅ Current status in DB: ${callRecord.callStatus}`);
    }
    console.log(`✅ Webhook Call ID: ${callId}`);

    // Update call record with webhook data
    const updateData = {
      webhookData: webhookData,
      webhookReceived: true,
      webhookReceivedAt: new Date(),
      updatedAt: new Date()
    };

    // Extract and update call status - DeepCall uses "callStatus" (numeric codes)
    const statusValue = webhookData?.callStatus || 
                       webhookData?.status || 
                       webhookData?.call?.status ||
                       webhookData?.state ||
                       webhookData?.call?.state;
    
    if (statusValue !== null && statusValue !== undefined) {
      // Handle numeric status codes from DeepCall
      // Map according to DeepCall documentation for CTC (Click to Call) calls
      const statusNum = parseInt(statusValue);
      if (!isNaN(statusNum)) {
        // Store original status code and description
        updateData.originalStatusCode = statusNum;
        
        // Map numeric status codes according to DeepCall documentation
        // For CTC calls: From = first number, To = second number
        const statusMap = {
          3: { status: 'completed', description: 'Both Answered' },
          4: { status: 'answered', description: 'To Ans. - From Unans.' },
          5: { status: 'answered', description: 'To Ans' },
          6: { status: 'answered', description: 'To Unans - From Ans.' },
          7: { status: 'no-answer', description: 'From Unanswered' },
          8: { status: 'no-answer', description: 'To Unans.' },
          9: { status: 'no-answer', description: 'Both Unanswered' },
          10: { status: 'answered', description: 'From Ans.' },
          11: { status: 'cancelled', description: 'Rejected Call' },
          12: { status: 'cancelled', description: 'Skipped' },
          13: { status: 'failed', description: 'From Failed' },
          14: { status: 'failed', description: 'To Failed - From Ans.' },
          15: { status: 'failed', description: 'To Failed' },
          16: { status: 'failed', description: 'To Ans - From Failed' },
          17: { status: 'busy', description: 'From Busy' },
          18: { status: 'failed', description: 'To Ans. - From Not Found' },
          19: { status: 'busy', description: 'To Unans. - From Busy' },
          20: { status: 'cancelled', description: 'To Hangup in Queue' },
          21: { status: 'cancelled', description: 'To Hangup' }
        };
        
        if (statusMap[statusNum]) {
          updateData.callStatus = statusMap[statusNum].status;
          updateData.statusDescription = statusMap[statusNum].description;
          console.log(`📊 Status ${statusNum} mapped to: ${updateData.callStatus} (${updateData.statusDescription})`);
        } else if (statusNum === 1 || statusNum === 2) {
          // Status 1-2 are typically ringing/initiating
          updateData.callStatus = 'ringing';
          updateData.statusDescription = 'Ringing';
        } else {
          // Unknown status code - try to infer from nHDetail
          if (webhookData?.nHDetail && Array.isArray(webhookData.nHDetail)) {
            const hasAnswered = webhookData.nHDetail.some(n => n.status === 'answered');
            updateData.callStatus = hasAnswered ? 'answered' : 'no-answer';
            updateData.statusDescription = hasAnswered ? 'Answered' : 'No Answer';
          } else {
            updateData.callStatus = 'completed';
            updateData.statusDescription = 'Completed';
          }
          console.log(`⚠️  Unknown status code ${statusNum}, inferred: ${updateData.callStatus}`);
        }
      } else {
        // Handle string status values
      const statusLower = statusValue.toString().toLowerCase();
      if (statusLower.includes('complete') || statusLower.includes('completed') || statusLower === 'success') {
        updateData.callStatus = 'completed';
      } else if (statusLower.includes('answer') || statusLower.includes('answered')) {
        updateData.callStatus = 'answered';
      } else if (statusLower.includes('ring')) {
        updateData.callStatus = 'ringing';
      } else if (statusLower.includes('busy')) {
        updateData.callStatus = 'busy';
      } else if (statusLower.includes('fail') || statusLower.includes('error')) {
        updateData.callStatus = 'failed';
      } else if (statusLower.includes('cancel')) {
        updateData.callStatus = 'cancelled';
        } else if (statusLower.includes('no-answer') || statusLower.includes('no_answer') || statusLower.includes('missed')) {
        updateData.callStatus = 'no-answer';
        } else {
          // Final fallback: check nHDetail for actual status
          if (webhookData?.nHDetail && Array.isArray(webhookData.nHDetail)) {
            const hasAnswered = webhookData.nHDetail.some(n => n.status === 'answered');
            updateData.callStatus = hasAnswered ? 'answered' : 'no-answer';
      } else {
        updateData.callStatus = statusLower;
      }
        }
      }
      console.log(`📊 Call status updated to: ${updateData.callStatus} (from value: ${statusValue})`);
    }

    // Extract call timing information - DeepCall format
    // DeepCall uses: firstAnswerTime, lastHangupTime, ivrSTime, ivrETime (format: "2025-11-20 23:55:27")
    const parseDeepCallDate = (dateStr) => {
      if (!dateStr) return null;
      // Handle DeepCall date format: "2025-11-20 23:55:27" (assume IST timezone)
      if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // Parse as IST (UTC+5:30)
        return new Date(dateStr + '+05:30');
      }
      // Handle Unix timestamp (seconds or milliseconds)
      if (dateStr.toString().length === 10 || dateStr.toString().length === 13) {
        return new Date(parseInt(dateStr) * (dateStr.toString().length === 10 ? 1000 : 1));
      }
      // Try standard Date parsing
      return new Date(dateStr);
    };

    const startTime = webhookData?.ivrSTime || 
                      webhookData?.firstAnswerTime || 
                      webhookData?.custAnswerSTime ||
                      webhookData?.startTime || 
                      webhookData?.callStartTime || 
                      webhookData?.start_time ||
                      webhookData?.call?.startTime ||
                      webhookData?.timestamp;
    if (startTime) {
      updateData.callStartTime = parseDeepCallDate(startTime);
      console.log(`⏰ Call start time: ${updateData.callStartTime}`);
    }

    const endTime = webhookData?.ivrETime ||
                    webhookData?.lastHangupTime ||
                    webhookData?.custAnswerETime ||
                    webhookData?.endTime || 
                    webhookData?.callEndTime || 
                    webhookData?.end_time ||
                    webhookData?.call?.endTime ||
                    webhookData?.completedAt;
    if (endTime) {
      updateData.callEndTime = parseDeepCallDate(endTime);
      console.log(`⏰ Call end time: ${updateData.callEndTime}`);
    }

    // Calculate duration - prioritize lastFirstDuration (actual call duration)
    // DeepCall uses: lastFirstDuration (actual call duration), talkDuration, custAnswerDuration, ivrDuration
    const lastFirstDuration = webhookData?.lastFirstDuration;
    if (lastFirstDuration !== null && lastFirstDuration !== undefined) {
      updateData.callDuration = parseInt(lastFirstDuration) || 0;
      console.log(`⏱️  Call duration (lastFirstDuration): ${updateData.callDuration}s`);
    } else if (updateData.callStartTime && updateData.callEndTime) {
      // Calculate from start and end times
      const durationMs = updateData.callEndTime - updateData.callStartTime;
      updateData.callDuration = Math.floor(durationMs / 1000);
      console.log(`⏱️  Calculated duration from times: ${updateData.callDuration}s`);
    } else {
      // Try to get duration from webhook data
      const duration = webhookData?.talkDuration ||
                       webhookData?.custAnswerDuration ||
                       webhookData?.ivrDuration ||
                       webhookData?.duration || 
                       webhookData?.callDuration || 
                       webhookData?.call_duration ||
                       webhookData?.totalDuration ||
                       webhookData?.call?.duration;
      if (duration) {
        updateData.callDuration = parseInt(duration) || 0;
        console.log(`⏱️  Duration from webhook: ${updateData.callDuration}s`);
      }
    }

    // DeepCall specific duration fields
    const talkDuration = webhookData?.talkDuration || 
                         webhookData?.talk_duration ||
                         webhookData?.call?.talkDuration ||
                         webhookData?.billableDuration;
    if (talkDuration) {
      updateData.talkDuration = parseInt(talkDuration) || 0;
      console.log(`💬 Talk duration: ${updateData.talkDuration}s`);
    }

    const custAnswerDuration = webhookData?.custAnswerDuration;
    if (custAnswerDuration) {
      updateData.custAnswerDuration = parseInt(custAnswerDuration) || 0;
    }

    const ivrDuration = webhookData?.ivrDuration;
    if (ivrDuration) {
      updateData.ivrDuration = parseInt(ivrDuration) || 0;
    }

    const agentOnCallDuration = webhookData?.agentOnCallDuration;
    if (agentOnCallDuration) {
      updateData.agentOnCallDuration = parseInt(agentOnCallDuration) || 0;
    }

    // Extract recording information - DeepCall stores full URL in nHDetail[].recordingUrl
    // Priority: nHDetail recordingUrl (full URL) > recordings array > other fields
    let recordingUrl = null;
    
    // First, try to get from nHDetail array (has full URL with recordingUrl property)
    if (webhookData?.nHDetail && Array.isArray(webhookData.nHDetail)) {
      for (const detail of webhookData.nHDetail) {
        if (detail.recordingUrl && typeof detail.recordingUrl === 'string' && detail.recordingUrl.startsWith('http')) {
          recordingUrl = detail.recordingUrl;
          console.log(`🎵 Found recording URL in nHDetail: ${recordingUrl}`);
          break;
        }
      }
    }
    
    // If not found in nHDetail, try recordings array
    if (!recordingUrl) {
      let recordingsData = webhookData?.recordings || 
                      webhookData?.recordingUrl || 
                      webhookData?.recording_url ||
                      webhookData?.recording?.url ||
                      webhookData?.call?.recordingUrl ||
                      webhookData?.audioUrl ||
                      webhookData?.audio_url;
    
      // Handle recordings as array (DeepCall format)
      if (Array.isArray(recordingsData)) {
        if (recordingsData.length > 0) {
          const firstRecording = recordingsData[0];
          if (typeof firstRecording === 'object' && firstRecording !== null) {
            // If it has a 'file' property, it's a relative path - construct full URL
            if (firstRecording.file && firstRecording.file.startsWith('/')) {
              // Construct full URL from relative path
              recordingUrl = `https://s-ct3.sarv.com/v2/recording/direct/${webhookData?.userId || DEEPCALL_USER_ID}${firstRecording.file}`;
              console.log(`🎵 Constructed recording URL from file path: ${recordingUrl}`);
            } else {
              recordingUrl = firstRecording.url || firstRecording.file || firstRecording;
            }
          } else {
            recordingUrl = firstRecording;
          }
        }
      } else if (recordingsData && typeof recordingsData === 'string') {
        // If it's a string, check if it's a relative path or full URL
        if (recordingsData.startsWith('/')) {
          // Relative path - construct full URL
          recordingUrl = `https://s-ct3.sarv.com/v2/recording/direct/${webhookData?.userId || DEEPCALL_USER_ID}${recordingsData}`;
          console.log(`🎵 Constructed recording URL from relative path: ${recordingUrl}`);
        } else if (recordingsData.startsWith('http')) {
          // Already a full URL
          recordingUrl = recordingsData;
        }
      }
    }
    
    // Only set if we have a valid string URL
    if (recordingUrl && typeof recordingUrl === 'string' && recordingUrl !== 'null' && recordingUrl !== '' && recordingUrl !== '[]' && recordingUrl.startsWith('http')) {
      updateData.recordingUrl = recordingUrl;
      console.log(`🎵 Final recording URL: ${recordingUrl}`);
      
      // CRITICAL: Auto-upload to S3 in background (non-blocking)
      // This ensures recordings are preserved even if DeepCall deletes them
      // Use callId to find the record after it's saved (more reliable than _id for new records)
      const callIdForUpload = callId;
      const recordingUrlForUpload = recordingUrl;
      
      setImmediate(async () => {
        try {
          // Wait a bit for the record to be saved
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Find the call record (by callId, works for both new and existing)
          const callForUpload = await CatiCall.findOne({ callId: callIdForUpload });
          if (!callForUpload) {
            console.error(`❌ Could not find call record for upload: ${callIdForUpload}`);
            return;
          }
          
          // Only upload if not already uploaded
          if (!callForUpload.s3AudioUrl || callForUpload.s3AudioUploadStatus !== 'uploaded') {
            console.log(`📤 Starting background S3 upload for callId: ${callIdForUpload}`);
            const { downloadAndUploadCatiAudio } = require('../utils/cloudStorage');
            
            // Mark as pending
            await CatiCall.updateOne(
              { _id: callForUpload._id },
              { 
                $set: { 
                  s3AudioUploadStatus: 'pending',
                  s3AudioUploadError: null
                } 
              }
            );
            
            // Download and upload
            const uploadResult = await downloadAndUploadCatiAudio(
              recordingUrlForUpload,
              callIdForUpload,
              { DEEPCALL_TOKEN, DEEPCALL_USER_ID }
            );
            
            // Update with S3 key
            await CatiCall.updateOne(
              { _id: callForUpload._id },
              { 
                $set: { 
                  s3AudioUrl: uploadResult.s3Key,
                  s3AudioUploadedAt: new Date(),
                  s3AudioUploadStatus: 'uploaded',
                  s3AudioUploadError: null
                } 
              }
            );
            
            console.log(`✅ Successfully uploaded CATI recording to S3: ${uploadResult.s3Key}`);
          } else {
            console.log(`ℹ️  Recording already uploaded to S3, skipping: ${callForUpload.s3AudioUrl}`);
          }
        } catch (uploadError) {
          console.error(`❌ Failed to upload CATI recording to S3:`, uploadError);
          
          // Mark as failed (but keep DeepCall URL for fallback)
          const errorMessage = uploadError.message === 'RECORDING_DELETED' 
            ? 'Recording already deleted from DeepCall' 
            : uploadError.message;
          
          // Try to find and update the call record
          try {
            const callForUpload = await CatiCall.findOne({ callId: callIdForUpload });
            if (callForUpload) {
              await CatiCall.updateOne(
                { _id: callForUpload._id },
                { 
                  $set: { 
                    s3AudioUploadStatus: uploadError.message === 'RECORDING_DELETED' ? 'deleted' : 'failed',
                    s3AudioUploadError: errorMessage.substring(0, 500) // Limit error message length
                  } 
                }
              );
            }
          } catch (updateError) {
            console.error('❌ Failed to update upload status:', updateError);
          }
        }
      });
    } else {
      console.log(`⚠️  No valid recording URL found in webhook data`);
    }

    const recordingDuration = webhookData?.recordingDuration || 
                               webhookData?.recording_duration ||
                               webhookData?.recording?.duration ||
                               webhookData?.call?.recordingDuration ||
                               webhookData?.audioDuration;
    if (recordingDuration) {
      updateData.recordingDuration = parseInt(recordingDuration) || 0;
      console.log(`🎵 Recording duration: ${updateData.recordingDuration}s`);
    }

    const recordingFileSize = webhookData?.recordingFileSize || 
                               webhookData?.recording_file_size ||
                               webhookData?.recording?.fileSize ||
                               webhookData?.call?.recordingFileSize ||
                               webhookData?.audioFileSize;
    if (recordingFileSize) {
      updateData.recordingFileSize = parseInt(recordingFileSize) || 0;
      console.log(`🎵 Recording file size: ${updateData.recordingFileSize} bytes`);
    }

    // Extract phone numbers - DeepCall uses: api_para.from, api_para.to, masterNumCTC (from), cNumber (to)
    if (webhookData?.api_para?.from) {
      updateData.fromNumber = webhookData.api_para.from.toString().replace(/[^0-9]/g, '');
      console.log(`📞 From number (api_para): ${updateData.fromNumber}`);
    } else if (webhookData?.masterNumCTC) {
      updateData.fromNumber = webhookData.masterNumCTC.toString().replace(/[^0-9]/g, '');
      console.log(`📞 From number (masterNumCTC): ${updateData.fromNumber}`);
    }
    
    if (webhookData?.api_para?.to) {
      updateData.toNumber = webhookData.api_para.to.toString().replace(/[^0-9]/g, '');
      console.log(`📞 To number (api_para): ${updateData.toNumber}`);
    } else if (webhookData?.cNumber || webhookData?.cNumber10) {
      updateData.toNumber = (webhookData.cNumber || webhookData.cNumber10).toString().replace(/[^0-9]/g, '');
      console.log(`📞 To number (cNumber): ${updateData.toNumber}`);
    }
    
    // Normalize fromType and toType - capitalize first letter to match enum (Number, Agent, Group)
    const normalizeType = (type) => {
      if (!type) return null;
      const typeStr = type.toString();
      return typeStr.charAt(0).toUpperCase() + typeStr.slice(1).toLowerCase();
    };
    
    if (webhookData?.api_para?.fromType) {
      updateData.fromType = normalizeType(webhookData.api_para.fromType);
    }
    if (webhookData?.api_para?.toType) {
      updateData.toType = normalizeType(webhookData.api_para.toType);
    }
    
    // Extract detailed information from nHDetail array (number history details)
    if (webhookData?.nHDetail && Array.isArray(webhookData.nHDetail) && webhookData.nHDetail.length > 0) {
      updateData.numberDetails = webhookData.nHDetail;
      
      // Extract ring duration from nHDetail (sum of all ring durations)
      const totalRingDuration = webhookData.nHDetail.reduce((sum, n) => {
        return sum + (parseInt(n.totalRingDuration) || 0);
      }, 0);
      if (totalRingDuration > 0) {
        updateData.ringDuration = totalRingDuration;
        console.log(`📞 Total ring duration: ${totalRingDuration}s`);
      }
      
      // Extract talk duration from nHDetail (sum of all talk durations)
      const totalTalkDuration = webhookData.nHDetail.reduce((sum, n) => {
        return sum + (parseInt(n.talkDuration) || 0);
      }, 0);
      if (totalTalkDuration > 0 && !updateData.talkDuration) {
        updateData.talkDuration = totalTalkDuration;
        console.log(`💬 Total talk duration from nHDetail: ${totalTalkDuration}s`);
      }
      
      // Find the first answered number to get answer time
      const answeredNumber = webhookData.nHDetail.find(n => n.status === 'answered');
      if (answeredNumber) {
        if (answeredNumber.answerSTime && !updateData.callStartTime) {
          updateData.callStartTime = new Date(answeredNumber.answerSTime);
          console.log(`⏰ Answer start time from nHDetail: ${updateData.callStartTime}`);
        }
        if (answeredNumber.answerETime && !updateData.callEndTime) {
          updateData.callEndTime = new Date(answeredNumber.answerETime);
          console.log(`⏰ Answer end time from nHDetail: ${updateData.callEndTime}`);
        }
        if (answeredNumber.answerDuration && !updateData.callDuration) {
          updateData.callDuration = parseInt(answeredNumber.answerDuration) || 0;
          console.log(`⏱️  Answer duration from nHDetail: ${updateData.callDuration}s`);
        }
      }
    }

    // Extract hangup information - DeepCall uses: exitCode, HangupBySourceDetected
    if (webhookData?.exitCode) {
      updateData.hangupCause = webhookData.exitCode;
      console.log(`📴 Hangup cause: ${updateData.hangupCause}`);
    }
    if (webhookData?.HangupBySourceDetected) {
      updateData.hangupBySource = webhookData.HangupBySourceDetected;
    }
    if (webhookData?.hangupReason) {
      updateData.hangupReason = webhookData.hangupReason;
    }

    // Extract caller ID information
    if (webhookData?.callerId || webhookData?.caller_id) {
      updateData.callerId = webhookData.callerId || webhookData.caller_id;
    }
    if (webhookData?.dialedNumber || webhookData?.dialed_number) {
      updateData.dialedNumber = webhookData.dialedNumber || webhookData.dialed_number;
    }

    // Extract cost information - DeepCall uses: totalCreditsUsed
    if (webhookData?.totalCreditsUsed) {
      updateData.callCost = parseFloat(webhookData.totalCreditsUsed) || 0;
      console.log(`💰 Credits used: ${updateData.callCost}`);
    } else if (webhookData?.cost || webhookData?.callCost) {
      updateData.callCost = parseFloat(webhookData.cost || webhookData.callCost) || 0;
    }
    if (webhookData?.currency) {
      updateData.currency = webhookData.currency;
    }

    // Extract DeepCall specific fields
    if (webhookData?.CTC) {
      updateData.ctc = webhookData.CTC;
    }
    if (webhookData?.did) {
      updateData.did = webhookData.did;
    }
    if (webhookData?.cType) {
      updateData.callType = webhookData.cType;
    }
    if (webhookData?.campId) {
      updateData.campaignId = webhookData.campId;
    }
    if (webhookData?.userId) {
      updateData.deepCallUserId = webhookData.userId;
    }
    if (webhookData?.masterAgent) {
      updateData.masterAgent = webhookData.masterAgent;
    }
    if (webhookData?.masterAgentNumber) {
      updateData.masterAgentNumber = webhookData.masterAgentNumber;
    }
    if (webhookData?.callDisposition) {
      updateData.callDisposition = webhookData.callDisposition;
    }
    if (webhookData?.contactId) {
      updateData.contactId = webhookData.contactId;
    }
    // Handle DTMF - can be array or string
    if (webhookData?.DTMF) {
      if (Array.isArray(webhookData.DTMF)) {
        // Convert array to string or skip if empty
        // CRITICAL: Use String() instead of JSON.stringify() to prevent memory leaks
        if (webhookData.DTMF.length > 0) {
          updateData.dtmf = String(webhookData.DTMF);
        }
      } else if (typeof webhookData.DTMF === 'string' && webhookData.DTMF !== '[]') {
        updateData.dtmf = webhookData.DTMF;
      }
    }
    
    // Handle voiceMail - can be array or string
    if (webhookData?.voiceMail) {
      if (Array.isArray(webhookData.voiceMail)) {
        // Convert array to string or skip if empty
        if (webhookData.voiceMail.length > 0) {
          // CRITICAL: Removed JSON.stringify() - causes memory leaks
          // Store voiceMail as-is if it's already a string, or convert to string without JSON.stringify
          updateData.voiceMail = typeof webhookData.voiceMail === 'string' ? webhookData.voiceMail : String(webhookData.voiceMail);
        }
      } else if (typeof webhookData.voiceMail === 'string' && webhookData.voiceMail !== '[]') {
      updateData.voiceMail = webhookData.voiceMail;
      }
    }

    // Extract error information
    if (webhookData?.errorCode) {
      updateData.errorCode = webhookData.errorCode;
    }
    if (webhookData?.errorMessage) {
      updateData.errorMessage = webhookData.errorMessage;
    }

    // Response already sent at the beginning of the function
    // Now save/update the call record - use await to ensure it completes
    // isNewRecord was already declared above
    console.log(`🔄 ${isNewRecord ? 'Creating new' : 'Updating existing'} call record...`);
    console.log(`🔄 Call ID from webhook: ${callId}`);
    console.log(`🔄 Update data keys:`, Object.keys(updateData));
    console.log(`🔄 Call status to update: ${updateData.callStatus}`);
    
    try {
      // Merge all updateData into the callRecord
      Object.assign(callRecord, updateData);
      
      // Save the record (works for both new and existing records)
      const savedCall = await callRecord.save();
      
      console.log(`✅ Call record ${isNewRecord ? 'created' : 'updated'} successfully!`);
      console.log(`✅ Call ID: ${savedCall.callId}`);
      console.log(`📊 Call status: ${savedCall.callStatus}`);
      console.log(`⏱️  Call duration: ${savedCall.callDuration}s`);
      console.log(`📞 From: ${savedCall.fromNumber}, To: ${savedCall.toNumber}`);
      console.log(`🕐 Webhook received: ${savedCall.webhookReceived}`);
      console.log(`🕐 Webhook received at: ${savedCall.webhookReceivedAt}`);
      console.log(`🏢 Company: ${savedCall.company || 'null (webhook-created)'}`);
      
      // Update queue entry if this call is linked to a queue entry
      if (savedCall.queueEntry) {
        try {
          const queueEntry = await CatiRespondentQueue.findById(savedCall.queueEntry);
          if (queueEntry) {
            // Update queue entry with call record and status
            queueEntry.callRecord = savedCall._id;
            
            // Map call status to queue status
            const statusMap = {
              'answered': 'calling',
              'completed': 'interview_success',
              'no-answer': 'no_answer',
              'busy': 'busy',
              'failed': 'call_failed',
              'cancelled': 'rejected'
            };
            
            if (statusMap[savedCall.callStatus]) {
              queueEntry.status = statusMap[savedCall.callStatus];
            }
            
            // Update last attempt
            if (queueEntry.callAttempts.length > 0) {
              const lastAttempt = queueEntry.callAttempts[queueEntry.callAttempts.length - 1];
              lastAttempt.status = savedCall.callStatus;
              lastAttempt.callId = savedCall.callId;
            }
            
            await queueEntry.save();
            console.log(`✅ Queue entry updated for call ${savedCall.callId}`);
          }
        } catch (queueError) {
          console.error('❌ Error updating queue entry:', queueError);
          // Don't fail the webhook processing if queue update fails
        }
      }
      
    } catch (updateError) {
      console.error('❌ Error saving call record after webhook response:', updateError);
      console.error('❌ Error details:', updateError.message);
      console.error('❌ Error stack:', updateError.stack);
      if (callRecord._id) {
        console.error('❌ Call record ID:', callRecord._id);
      }
      console.error('❌ Call record data:', JSON.stringify({
        callId: callRecord.callId,
        fromNumber: callRecord.fromNumber,
        toNumber: callRecord.toNumber,
        isNew: isNewRecord
      }, null, 2));
      console.error('❌ Update data (first 500 chars):', JSON.stringify(updateData, null, 2).substring(0, 500));
    }

    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      console.error('❌ Error stack:', error.stack);
      // Response already sent, just log the error
    }
  });
};

// @desc    Get all CATI calls for a company
// @route   GET /api/cati/calls
// @access  Private (Company Admin only)
const getCalls = async (req, res) => {
  try {
    const userId = req.user._id;
    const companyId = req.user.company;
    const { page = 1, limit = 20, status, search } = req.query;

    // Build query - IMPORTANT: Only show calls that have received webhook data
    // Call history should ONLY show calls with complete webhook information
    // Show ALL calls with webhook data (regardless of company, since webhooks are public)
    const query = { 
      webhookReceived: true  // CRITICAL: Only show calls with webhook data
    };
    
    // Company filter: show calls that belong to this company OR webhook-created calls (company: null)
    if (companyId) {
      query.$or = [
        { company: companyId },
        { company: null } // Webhook-created calls without company association
      ];
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.callStatus = status;
    }
    
    // Search filter - combine with existing conditions using $and if we have $or
    if (search) {
      const searchConditions = {
        $or: [
        { fromNumber: { $regex: search, $options: 'i' } },
        { toNumber: { $regex: search, $options: 'i' } },
        { callId: { $regex: search, $options: 'i' } }
        ]
      };
      
      // If we already have $or (from company filter), use $and to combine
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          searchConditions
        ];
        delete query.$or;
      } else {
        query.$or = searchConditions.$or;
      }
    }

    // Get calls with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const calls = await CatiCall.find(query)
      .populate('createdBy', 'name email')
      .sort({ webhookReceivedAt: -1, createdAt: -1 }) // Sort by webhook received time (most recent first)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CatiCall.countDocuments(query);

    res.json({
      success: true,
      data: calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching CATI calls:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching calls',
      error: error.message
    });
  }
};

// @desc    Get single CATI call by ID (MongoDB _id) or callId (DeepCall callId)
// @route   GET /api/cati/calls/:id
// @access  Private (Company Admin, Project Manager, Quality Agent, or Interviewer with ownership)
const getCallById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;
    const userId = req.user._id;
    const userRole = req.user.userType;

    // Check if id is a valid MongoDB ObjectId (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let call = null;

    // For quality agents, we need to check if the call is linked to a response they can review
    // So we search more broadly first, then verify access
    if (userRole === 'quality_agent') {
      // Try to find by MongoDB _id first only if it's a valid ObjectId
      if (isValidObjectId) {
        try {
          call = await CatiCall.findOne({ _id: id })
      .populate('createdBy', 'name email');
        } catch (objectIdError) {
          console.log('⚠️ Not a valid ObjectId, trying by callId:', objectIdError.message);
        }
      }

      // If not found by _id, try by callId (DeepCall callId)
      if (!call) {
        call = await CatiCall.findOne({ callId: id })
          .populate('createdBy', 'name email');
      }
    } else {
      // For company admins and interviewers, use company filter
      // Try to find by MongoDB _id first only if it's a valid ObjectId
      if (isValidObjectId) {
        try {
          call = await CatiCall.findOne({
            _id: id,
            $or: [
              { company: companyId },
              { company: null } // Webhook-created calls
            ]
          })
          .populate('createdBy', 'name email');
        } catch (objectIdError) {
          // If ObjectId conversion fails, continue to try by callId
          console.log('⚠️ Not a valid ObjectId, trying by callId:', objectIdError.message);
        }
      }

      // If not found by _id, try by callId (DeepCall callId)
      if (!call) {
        call = await CatiCall.findOne({
          callId: id,
          $or: [
            { company: companyId },
            { company: null } // Webhook-created calls
          ]
        })
          .populate('createdBy', 'name email');
      }
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // If user is an interviewer (not company_admin, project_manager, or quality_agent), verify they own a response linked to this call
    if (userRole !== 'company_admin' && userRole !== 'project_manager' && userRole !== 'quality_agent') {
      // Check if this call is linked to one of the interviewer's survey responses
      const callIdToCheck = call.callId || call._id.toString();
      const responseWithCall = await SurveyResponse.findOne({
        interviewer: userId,
        call_id: callIdToCheck
      });

      if (!responseWithCall) {
        // Also try to find by MongoDB _id if callId didn't match
        const responseWithCallId = await SurveyResponse.findOne({
          interviewer: userId,
          call_id: call._id.toString()
        });

        if (!responseWithCallId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only view calls associated with your own interviews.'
          });
        }
      }
    } else if (userRole === 'quality_agent') {
      // For quality agents, verify the call is linked to a response they can review
      const callIdToCheck = call.callId || call._id.toString();
      
      console.log('🔍 Quality Agent - Checking call access. callIdToCheck:', callIdToCheck);
      console.log('🔍 Quality Agent - Call details:', { callId: call.callId, _id: call._id, company: call.company });
      
      // First try to find by callId (DeepCall callId)
      let responseWithCall = await SurveyResponse.findOne({
        call_id: callIdToCheck
      });

      console.log('🔍 Quality Agent - Response found by callId:', responseWithCall ? 'Yes' : 'No');

      // If not found, try by MongoDB _id
      if (!responseWithCall) {
        responseWithCall = await SurveyResponse.findOne({
          call_id: call._id.toString()
        });
        console.log('🔍 Quality Agent - Response found by _id:', responseWithCall ? 'Yes' : 'No');
      }

      if (!responseWithCall) {
        console.log('❌ Quality Agent - No response found for call. Denying access.');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view calls associated with responses you can review.'
        });
      }

      console.log('✅ Quality Agent - Response found. responseId:', responseWithCall.responseId);
      console.log('✅ Quality Agent - Allowing access to call details.');
      
      // For quality agents, if the call is linked to a response, allow access
      // The frontend ensures they can only see responses they're assigned to review
    }

    res.json({
      success: true,
      data: call
    });

  } catch (error) {
    console.error('Error fetching CATI call:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching call',
      error: error.message
    });
  }
};

// @desc    Manually check and update call status (for testing/debugging)
// @route   POST /api/cati/calls/:id/check-status
// @access  Private (Company Admin only)
const checkCallStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company;

    const call = await CatiCall.findOne({ _id: id, company: companyId });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // If webhook already received, return current status
    if (call.webhookReceived) {
      return res.json({
        success: true,
        message: 'Webhook already received',
        data: call,
        webhookReceived: true
      });
    }

    // Log that manual check was requested
    console.log(`🔍 Manual status check requested for call: ${call.callId}`);

    res.json({
      success: true,
      message: 'Call status check completed. Webhook will update when DeepCall sends it.',
      data: call,
      webhookReceived: call.webhookReceived,
      note: 'If webhook is not received, please verify webhook URL is correctly configured in DeepCall dashboard: https://opine.exypnossolutions.com/api/cati/webhook'
    });

  } catch (error) {
    console.error('Error checking call status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking call status',
      error: error.message
    });
  }
};

// @desc    Get CATI call statistics
// @route   GET /api/cati/stats
// @access  Private (Company Admin only)
const getCallStats = async (req, res) => {
  try {
    const companyId = req.user.company;

    // IMPORTANT: Only count calls that have received webhook data
    // Statistics should only reflect calls with complete webhook information
    const baseMatch = { 
      company: companyId,
      webhookReceived: true  // CRITICAL: Only count calls with webhook data
    };

    const stats = await CatiCall.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$callStatus',
          count: { $sum: 1 },
          totalDuration: { $sum: '$callDuration' },
          avgDuration: { $avg: '$callDuration' }
        }
      }
    ]);

    const totalCalls = await CatiCall.countDocuments(baseMatch);
    const successfulCalls = await CatiCall.countDocuments({ 
      ...baseMatch,
      callStatus: { $in: ['answered', 'completed'] }
    });
    const failedCalls = await CatiCall.countDocuments({ 
      ...baseMatch,
      callStatus: { $in: ['failed', 'no-answer', 'busy', 'cancelled'] }
    });
    const totalDuration = await CatiCall.aggregate([
      { $match: baseMatch },
      { $group: { _id: null, total: { $sum: '$callDuration' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalCalls,
        successfulCalls,
        failedCalls,
        totalDuration: totalDuration[0]?.total || 0,
        statusBreakdown: stats
      }
    });

  } catch (error) {
    console.error('Error fetching CATI call statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching call statistics',
      error: error.message
    });
  }
};

// @desc    Proxy recording download (with authentication)
// @route   GET /api/cati/recording/:callId
// @access  Private (Company Admin, Project Manager, Quality Agent, or Interviewer with ownership)
const getRecording = async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user._id;
    const companyId = req.user.company;
    const userRole = req.user.userType;

    // Find the call record - for quality agents, we need to check by callId as well
    // Check if callId is a valid MongoDB ObjectId
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(callId);
    let call = null;
    
    // For quality agents, search more broadly first, then verify access
    if (userRole === 'quality_agent') {
      if (isValidObjectId) {
        call = await CatiCall.findOne({ _id: callId });
      }
      if (!call) {
        call = await CatiCall.findOne({ callId: callId });
      }
    } else {
      // For company admins and interviewers, use company filter
      if (isValidObjectId) {
        call = await CatiCall.findOne({ 
          _id: callId,
          $or: [{ company: companyId }, { company: null }]
        });
      }
      if (!call) {
        call = await CatiCall.findOne({
          callId: callId,
          $or: [{ company: companyId }, { company: null }]
        });
      }
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call record not found'
      });
    }

    // If user is an interviewer (not company_admin, project_manager, or quality_agent), verify they own a response linked to this call
    if (userRole !== 'company_admin' && userRole !== 'project_manager' && userRole !== 'quality_agent') {
      // Check if this call is linked to one of the interviewer's survey responses
      const callIdToCheck = call.callId || call._id.toString();
      const responseWithCall = await SurveyResponse.findOne({
        interviewer: userId,
        call_id: callIdToCheck
      });

      if (!responseWithCall) {
        // Also try to find by MongoDB _id if callId didn't match
        const responseWithCallId = await SurveyResponse.findOne({
          interviewer: userId,
          call_id: call._id.toString()
        });

        if (!responseWithCallId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only view recordings for calls associated with your own interviews.'
          });
        }
      }
    } else if (userRole === 'quality_agent') {
      // For quality agents, verify the call is linked to a response they can review
      const callIdToCheck = call.callId || call._id.toString();
      
      console.log('🔍 Quality Agent (Recording) - Checking call access. callIdToCheck:', callIdToCheck);
      
      // First try to find by callId (DeepCall callId)
      let responseWithCall = await SurveyResponse.findOne({
        call_id: callIdToCheck
      });

      // If not found, try by MongoDB _id
      if (!responseWithCall) {
        responseWithCall = await SurveyResponse.findOne({
          call_id: call._id.toString()
        });
      }

      if (!responseWithCall) {
        console.log('❌ Quality Agent (Recording) - No response found for call. Denying access.');
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view recordings for calls associated with responses you can review.'
        });
      }

      console.log('✅ Quality Agent (Recording) - Response found. Allowing access to recording.');
      
      // For quality agents, if the call is linked to a response, allow access
      // The frontend ensures they can only see responses they're assigned to review
    }

    // CRITICAL: Prefer S3 audio if available (migrated recordings)
    // This ensures we use our own S3 storage instead of DeepCall URLs that expire
    if (call.s3AudioUrl && call.s3AudioUploadStatus === 'uploaded') {
      console.log(`🎵 [AUDIO URL LOG] Quality Agent - Using S3 audio for callId: ${callId}`);
      console.log(`🎵 [AUDIO URL LOG] S3 Key: ${call.s3AudioUrl}`);
      console.log(`🎵 [AUDIO URL LOG] Source: S3 (migrated)`);
      console.log(`🎵 [AUDIO URL LOG] ✅ PROXIED - Streaming through server (NO cross-region charges)`);
      console.log(`🎵 [AUDIO URL LOG] Backend will download from S3 and stream to client`);
      const { streamAudioFromS3 } = require('../utils/cloudStorage');
      try {
        await streamAudioFromS3(call.s3AudioUrl, req, res);
        console.log(`🎵 [AUDIO URL LOG] ✅ Successfully streamed S3 audio to client`);
        return; // Exit early - streamAudioFromS3 handles the response
      } catch (s3Error) {
        console.error('❌ Error streaming from S3, falling back to DeepCall:', s3Error.message);
        // Fall through to DeepCall fallback
      }
    }

    // Fallback to provider recordingUrl (backward compatibility)
    if (!call.recordingUrl) {
      return res.status(404).json({
        success: false,
        message: 'No recording available for this call'
      });
    }

    const recordingUrlStr = String(call.recordingUrl);
    let recordingHost = '';
    try {
      recordingHost = new URL(recordingUrlStr).hostname || '';
    } catch (_) {
      recordingHost = '';
    }
    const providerName = call?.metadata?.provider || (recordingHost.includes('sarv.com') ? 'deepcall' : 'unknown');
    const isDeepCallRecording = providerName === 'deepcall' || recordingHost.includes('sarv.com');

    console.log(`🎵 [AUDIO URL LOG] Using provider recordingUrl fallback for callId: ${callId}`);
    console.log(`🎵 [AUDIO URL LOG] Provider: ${providerName}`);
    console.log(`🎵 [AUDIO URL LOG] URL Host: ${recordingHost || 'unknown'}`);
    console.log(`🎵 [AUDIO URL LOG] ✅ PROXIED - Backend will download from provider and stream to client (NO direct access)`);

    // Fetch the recording
    // DeepCall requires auth; CloudTelephony generally provides a direct URL.
    let recordingResponse = null;
    let lastError = null;

    if (!isDeepCallRecording) {
      // Non-DeepCall: do NOT mutate query params (could break signed URLs)
      try {
        recordingResponse = await axios.get(recordingUrlStr, {
          headers: {
            'User-Agent': 'OpineCATI/1.0',
            'Accept': 'audio/*, */*'
          },
          responseType: 'stream',
          timeout: 30000,
          maxRedirects: 5
        });
        console.log('✅ Successfully fetched provider recording (no auth)');
      } catch (e) {
        console.error('❌ Failed to fetch provider recording:', e.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch recording from provider',
          error: e.message,
          details: e.response?.status ? `HTTP ${e.response.status}` : 'Network error'
        });
      }
    } else {
      // DeepCall: try multiple authentication methods
    try {
        const urlWithToken = new URL(recordingUrlStr);
      urlWithToken.searchParams.set('token', DEEPCALL_TOKEN);
      urlWithToken.searchParams.set('user_id', DEEPCALL_USER_ID);
      
      recordingResponse = await axios.get(urlWithToken.toString(), {
        headers: {
          'User-Agent': 'SarvCT/1.0',
          'Accept': 'audio/mpeg, audio/*, */*'
        },
        responseType: 'stream',
        timeout: 30000,
        maxRedirects: 5
      });
      console.log('✅ Successfully fetched recording with token query params');
    } catch (error1) {
      console.log('⚠️  Method 1 (token query) failed:', error1.message);
      lastError = error1;
      
      // Method 2: Try with Bearer token in header
      try {
          recordingResponse = await axios.get(recordingUrlStr, {
          headers: {
            'Authorization': `Bearer ${DEEPCALL_TOKEN}`,
            'User-Agent': 'SarvCT/1.0',
            'Accept': 'audio/mpeg, audio/*, */*'
          },
          responseType: 'stream',
          timeout: 30000,
          maxRedirects: 5
        });
        console.log('✅ Successfully fetched recording with Bearer token');
      } catch (error2) {
        console.log('⚠️  Method 2 (Bearer token) failed:', error2.message);
        lastError = error2;
        
        // Method 3: Try without authentication (URL might be public)
        try {
            recordingResponse = await axios.get(recordingUrlStr, {
            headers: {
              'User-Agent': 'SarvCT/1.0',
              'Accept': 'audio/mpeg, audio/*, */*'
            },
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5
          });
          console.log('✅ Successfully fetched recording without auth');
        } catch (error3) {
          console.error('❌ All methods failed. Last error:', error3.message);
          console.error('   Response status:', error3.response?.status);
          console.error('   Response headers:', error3.response?.headers);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch recording from DeepCall',
            error: error3.message,
            details: error3.response?.status ? `HTTP ${error3.response.status}` : 'Network error'
          });
          }
        }
      }
    }

    if (recordingResponse) {
      console.log(`🎵 [AUDIO URL LOG] ✅ Successfully downloaded from DeepCall, streaming to client`);
      console.log(`🎵 [AUDIO URL LOG] Content-Type: ${recordingResponse.headers['content-type'] || 'audio/mpeg'}`);
      console.log(`🎵 [AUDIO URL LOG] Content-Length: ${recordingResponse.headers['content-length'] || 'unknown'}`);
      
      // Set appropriate headers for audio file
      const contentType = recordingResponse.headers['content-type'] || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="recording_${callId}.mp3"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Handle content-length if available
      if (recordingResponse.headers['content-length']) {
        res.setHeader('Content-Length', recordingResponse.headers['content-length']);
      }

      // Stream the audio file to the client
      recordingResponse.data.pipe(res);
      
      // Handle stream errors
      recordingResponse.data.on('error', (streamError) => {
        console.error('❌ Stream error:', streamError.message);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error streaming recording',
            error: streamError.message
          });
        }
      });
    }
  } catch (error) {
    console.error('❌ Error in getRecording:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recording',
      error: error.message
    });
  }
};

module.exports = {
  makeCall,
  receiveWebhook,
  receiveCloudTelephonyWebhook,
  getCalls,
  getCallById,
  getCallStats,
  checkCallStatus,
  getRecording,
  getProviderConfig,
  updateProviderConfig
};

