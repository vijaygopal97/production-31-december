# DeepCall Webhook Configuration Guide

## Current Issue
The webhook is receiving `push_report={}` (empty JSON object) instead of actual call data.

## Solution: Configure Webhook Template in DeepCall Dashboard

According to the [DeepCall Push Report Webhook Documentation](https://deepcall.com/api/push-report-webhook), the webhook should receive JSON data directly. However, DeepCall is currently sending it as form-encoded with an empty `push_report` field.

### Step 1: Access DeepCall Dashboard
1. Log in to your DeepCall/Sarv dashboard
2. Navigate to **Webhooks** or **Push Report Webhook** settings
3. Find the webhook URL: `https://opine.exypnossolutions.com/api/cati/webhook`

### Step 2: Configure Webhook Template
The webhook template needs to be configured with actual field mappings. Use the following template:

```json
{
  "callId": "{{%%callId%%}}",
  "callStatus": "{{%%callStatus%%}}",
  "firstAnswerTime": "{{%%firstAnswerTime%%}}",
  "lastHangupTime": "{{%%lastHangupTime%%}}",
  "talkDuration": "{{%%talkDuration%%}}",
  "custAnswerDuration": "{{%%custAnswerDuration%%}}",
  "ivrDuration": "{{%%ivrDuration%%}}",
  "ivrSTime": "{{%%ivrSTime%%}}",
  "ivrETime": "{{%%ivrETime%%}}",
  "custAnswerSTime": "{{%%custAnswerSTime%%}}",
  "custAnswerETime": "{{%%custAnswerETime%%}}",
  "agentOnCallDuration": "{{%%agentOnCallDuration%%}}",
  "recordings": "{{%%recordings%%}}",
  "recordingDuration": "{{%%recordingDuration%%}}",
  "recordingFileSize": "{{%%recordingFileSize%%}}",
  "masterNumCTC": "{{%%masterNumCTC%%}}",
  "cNumber": "{{%%cNumber%%}}",
  "cNumber10": "{{%%cNumber10%%}}",
  "exitCode": "{{%%exitCode%%}}",
  "HangupBySourceDetected": "{{%%HangupBySourceDetected%%}}",
  "hangupReason": "{{%%hangupReason%%}}",
  "callerId": "{{%%callerId%%}}",
  "dialedNumber": "{{%%dialedNumber%%}}",
  "totalCreditsUsed": "{{%%totalCreditsUsed%%}}",
  "currency": "{{%%currency%%}}",
  "CTC": "{{%%CTC%%}}",
  "did": "{{%%did%%}}",
  "cType": "{{%%cType%%}}",
  "campId": "{{%%campId%%}}",
  "userId": "{{%%userId%%}}",
  "masterAgent": "{{%%masterAgent%%}}",
  "masterAgentNumber": "{{%%masterAgentNumber%%}}",
  "callDisposition": "{{%%callDisposition%%}}",
  "contactId": "{{%%contactId%%}}",
  "DTMF": "{{%%DTMF%%}}",
  "voiceMail": "{{%%voiceMail%%}}",
  "errorCode": "{{%%errorCode%%}}",
  "errorMessage": "{{%%errorMessage%%}}"
}
```

### Step 3: Important Configuration Notes

1. **Webhook Format**: According to DeepCall docs, the webhook should send JSON data directly. However, if DeepCall sends it as form-encoded with `push_report`, the template above should work.

2. **Webhook Response**: The webhook endpoint MUST respond with `200 OK` and the text `GODBLESSYOU` (this is already implemented).

3. **Webhook URL**: `https://opine.exypnossolutions.com/api/cati/webhook`

4. **Verification**: After configuring the template, DeepCall will test the webhook. It should show as "Active" or "Verified" in the dashboard.

### Step 4: Testing
1. Make a test call from the CATI Test page
2. Check the webhook logs: `/var/www/opine/backend/logs/webhook-requests.log`
3. Verify that `push_report` contains actual data, not just `{}`

## Alternative: Check if Webhook URL Can Be Passed in API Call

If the webhook template configuration doesn't work, we might need to pass the webhook URL as a parameter in the Click-to-Call API request. However, this depends on DeepCall API support.

## Current Status
- ✅ Webhook endpoint is working (returns 200 OK with "GODBLESSYOU")
- ❌ Webhook template in DeepCall dashboard is sending empty data (`push_report={}`)
- ⚠️ Need to configure webhook template in DeepCall dashboard with actual field mappings


