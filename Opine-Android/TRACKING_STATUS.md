# 📊 Analytics Tracking Status

## ✅ Currently Implemented & Active

### 1. App Lifecycle Events ✅
- **App Open** - ✅ Tracked in `App.tsx` (on app start)
- **User Login** - ✅ Tracked in `App.tsx` (on login)
- **User Logout** - ✅ Tracked in `App.tsx` (on logout)

### 2. Interviewer Dashboard Events ✅
- **Start CAPI Interview Button** - ✅ Tracked in `InterviewerDashboard.tsx`
- **Start CATI Interview Button** - ✅ Tracked in `InterviewerDashboard.tsx`
- **Offline Sync Completed** - ✅ Tracked in `InterviewerDashboard.tsx` (manual & background)

### 3. Quality Agent Dashboard Events ✅
- **Start CAPI QC Button** - ✅ Tracked in `QualityAgentDashboard.tsx`
- **Start CATI QC Button** - ✅ Tracked in `QualityAgentDashboard.tsx`

---

## ⚠️ Available But Not Yet Integrated

These methods exist in `analyticsService.ts` but need to be called in the relevant components:

### 4. Interview Lifecycle Events (Available, needs integration)
- **Interview Started** - Method exists: `trackInterviewStarted()`
  - **Where to add**: `InterviewInterface.tsx` when interview begins
  - **Status**: ⚠️ Not yet called in code
  
- **Interview Completed** - Method exists: `trackInterviewCompleted()`
  - **Where to add**: `InterviewInterface.tsx` when interview is completed
  - **Status**: ⚠️ Not yet called in code
  
- **Interview Abandoned** - Method exists: `trackInterviewAbandoned()`
  - **Where to add**: `InterviewInterface.tsx` when interview is abandoned
  - **Status**: ⚠️ Not yet called in code

### 5. Sync Events (Available, needs integration)
- **Sync Started** - Method exists: `trackSyncStarted()`
  - **Where to add**: `syncService.ts` when sync begins
  - **Status**: ⚠️ Not yet called in code
  
- **Sync Completed** - Method exists: `trackSyncCompleted()`
  - **Note**: We're tracking "Offline Sync Completed" in dashboard, but not using this method
  - **Status**: ⚠️ Could be enhanced

### 6. Error & Performance Events (Available, needs integration)
- **Error Occurred** - Method exists: `trackError()`
  - **Where to add**: Global error handlers, try-catch blocks
  - **Status**: ⚠️ Not yet called in code
  
- **API Call** - Method exists: `trackAPICall()`
  - **Where to add**: `apiService.ts` to wrap API calls
  - **Status**: ⚠️ Not yet called in code

---

## 📋 Summary

### ✅ Fully Tracked (Ready to View)
- App opens, logins, logouts
- All button clicks (Start Interview, Start QC)
- Offline sync completions

### ⚠️ Available But Not Integrated (Need to Add)
- Interview lifecycle (started/completed/abandoned)
- Sync started events
- Error tracking
- API performance tracking

---

## 🎯 What You Can View Right Now

Once you complete Mixpanel setup (get token), you'll immediately see:

1. **Button Click Analytics**
   - How many times "Start CAPI Interview" is clicked
   - How many times "Start CATI Interview" is clicked
   - How many times "Start CAPI QC" is clicked
   - How many times "Start CATI QC" is clicked
   - Breakdown by time, user, survey

2. **Offline Sync Analytics**
   - Total syncs completed
   - Success rate (synced vs failed)
   - Average interviews synced per sync
   - Manual vs background sync breakdown

3. **User Activity**
   - Daily active users (app opens)
   - Login frequency
   - User retention

---

## 📖 How to View Dashboard

See **ANALYTICS_DASHBOARD_GUIDE.md** for complete instructions on:
- How to login to Mixpanel
- How to view events
- How to create reports
- How to set up alerts

---

## 🔧 Next Steps (Optional Enhancements)

If you want to track interview lifecycle, errors, and API performance:

1. Add `trackInterviewStarted()` in `InterviewInterface.tsx` when interview begins
2. Add `trackInterviewCompleted()` when interview completes
3. Add `trackInterviewAbandoned()` when interview is abandoned
4. Add `trackError()` in error handlers
5. Add `trackAPICall()` in `apiService.ts`

These are optional - the current tracking (buttons and syncs) is already very valuable!



