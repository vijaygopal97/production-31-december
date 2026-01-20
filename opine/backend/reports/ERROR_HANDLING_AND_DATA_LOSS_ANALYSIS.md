# Error Handling & Data Loss Analysis

## Question 1: What Will The Error Do? Will User Be Notified?

### Backend Error Response:
```javascript
return res.status(400).json({
  success: false,
  message: 'Cannot complete interview: Responses array is empty. This indicates data loss.',
  error: 'EMPTY_RESPONSES_ARRAY',
  data: { queueId, sessionId, callId, ... }
});
```

### Frontend Error Handling (Expected Behavior):

**For Direct API Calls (Online Completion):**
- Error caught in try-catch block
- Error message displayed via `showSnackbar()` or `Alert.alert()`
- User sees: "Cannot complete interview: Responses array is empty..."
- Interview NOT marked as completed
- User can retry

**For Sync Service (Offline Sync):**
- Error caught in sync service try-catch
- Error logged to console
- Interview marked as "failed" in sync result
- Interview remains in offline storage (not deleted)
- User sees sync failure in dashboard
- User can retry sync later

**Current Status:**
- ✅ Backend returns error
- ❓ Frontend error handling needs verification (should work, but needs testing)
- ❓ User notification needs verification (should work, but needs testing)

### Recommendation:
**The error WILL prevent data loss** - it stops the response from being created with empty data. However, we need to verify:
1. Frontend catches and displays the error
2. User is properly notified
3. Interview remains in offline storage for retry

---

## Question 2: How Are We Losing Data Despite Offline Saving?

### Offline Save Flow:
1. **Interview conducted** → Responses stored in React state (`responses` object)
2. **Interview completed** → `saveInterviewOffline()` called
3. **Offline storage** → Interview saved to AsyncStorage with:
   - `responses: Record<string, any>` (all responses in object format)
   - `finalResponses: any[]` (formatted responses array)
   - All metadata

### Sync Flow:
1. **Sync service** reads offline interviews from AsyncStorage
2. **For CATI interviews**, calls `completeCatiInterview` API
3. **Sends data** including `responses: finalResponses`

### Where Data Loss Occurs:

#### **ROOT CAUSE IDENTIFIED:**

**The Problem:**
```javascript
// Backend code (line 1898):
const allResponses = responses || [];
```

**What Happens:**
1. **Offline interview saved correctly** with `finalResponses` array
2. **Sync service reads offline data** correctly
3. **BUT:** When sync service calls API, it might:
   - Not include `responses` field in request body
   - Send `responses: undefined`
   - Send `responses: null`
   - Send `responses: []` (empty array)

4. **Backend receives:** `responses: undefined` or `responses: []`
5. **Backend defaults to:** `allResponses = []` (empty array)
6. **Response created with empty array** ❌

#### **Specific Issue for Response ca2715b9-583f-4e13-a7ad-85326dc2afb3:**

**Timeline:**
- Session created: 2026-01-13T05:59:59.263Z
- Session updated (abandoned): 2026-01-13T06:08:31.459Z
- Response created: 2026-01-13T06:08:31.407Z (0.052 seconds BEFORE session update)

**What Happened:**
1. Interview conducted (7 minutes, responses in session.currentResponses)
2. **Session abandoned** → `currentResponses` cleared to `{}`
3. **Response created from abandoned session** → Empty responses array
4. **OR:** Sync service sent request without `responses` field
5. **Backend defaulted to empty array** → Response created with no data

### Why Offline Saving Doesn't Help:

**Scenario 1: Session Already Abandoned**
- Interview saved offline with responses ✅
- But server session was already abandoned (currentResponses = {})
- Sync service might use server session instead of offline data
- Response created from empty server session ❌

**Scenario 2: Sync Service Not Sending Responses**
- Interview saved offline with responses ✅
- Sync service reads offline data ✅
- **BUT:** Sync service doesn't include `responses` field in API call ❌
- Backend defaults to empty array ❌

**Scenario 3: Request Body Missing Responses**
- Interview saved offline with responses ✅
- Sync service includes `responses` field ✅
- **BUT:** Request body parsing issue or field name mismatch
- Backend receives `responses: undefined` ❌
- Backend defaults to empty array ❌

---

## Key Findings

### 1. Error Will Prevent Data Loss (If Frontend Handles It)
- ✅ Backend returns error
- ✅ Prevents creating response with empty data
- ❓ Frontend needs to catch and display error
- ❓ User needs to be notified

### 2. Data Loss Root Cause
- **Primary Issue:** Backend defaults to empty array if `responses` is not provided
- **Secondary Issue:** Sync service might not be sending `responses` field
- **Tertiary Issue:** Session abandoned before response creation (captures empty session)

### 3. Why Offline Saving Doesn't Prevent It
- Offline saving works correctly ✅
- But sync service might not be using offline data correctly ❌
- Or sync service might not be sending `responses` field ❌
- Or backend might be using server session instead of request body ❌

---

## Recommendations

### Immediate Actions:
1. **Verify sync service sends `responses` field** - Check sync service code
2. **Verify frontend error handling** - Check if errors are caught and displayed
3. **Add request body logging** - Log what backend receives
4. **Use offline data, not server session** - Sync service should use offline `finalResponses`

### Long-term Fixes:
1. **Backend should NOT default to empty array** - Should return error if responses not provided
2. **Sync service should validate** - Check if `finalResponses` exists before sending
3. **Use offline data as source of truth** - Don't rely on server session when syncing
4. **Add recovery mechanism** - Try to recover responses from offline storage if empty

