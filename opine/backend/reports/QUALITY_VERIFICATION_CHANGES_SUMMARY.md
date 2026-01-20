# Quality Verification Section Changes - Implementation Summary

## Changes Implemented

### 1. Added Option 9: "Interviewer acting as respondent"
**Location:** Q1. Audio Status in Quality Verification Section

**Text:** "9 - Interviewer acting as respondent (সাক্ষাৎকার গ্রহণকারী উত্তরদাতার ভূমিকা পালন করছেন।)"

**Behavior:**
- ✅ Rejective option (same as options 2, 3, 8)
- ✅ When selected, hides all subsequent questions (Q2-Q8)
- ✅ When submitted, response is automatically rejected
- ✅ Works in both web frontend and React Native app

### 2. Changed Option 8 Text
**Old Text:** "8 - Duplicate Audio (ডুপ্লিকেট অডিও)"
**New Text:** "8 - Fraud interview (প্রতারণামূলক সাক্ষাৎকার)"

**Behavior:**
- ✅ Still a rejective option (unchanged)
- ✅ All other functionality remains the same

## Files Modified

### Backend
1. **`backend/models/SurveyResponse.js`**
   - Added '9' to audioStatus enum (2 locations: criteria.audioStatus and top-level audioStatus)
   - Lines: 343, 399

2. **`backend/controllers/surveyResponseController.js`**
   - Updated `generateRejectionReason` to handle option '9' with specific message
   - Line: ~4360

### Web Frontend
3. **`frontend/src/components/dashboard/SurveyApprovals.jsx`**
   - Changed option 8 text from "Duplicate Audio" to "Fraud interview"
   - Added option 9: "Interviewer acting as respondent"
   - Updated rejection logic comments to mention option 9
   - Lines: ~4404, ~4415

### React Native App
4. **`Opine-Android/src/components/ResponseDetailsModal.tsx`**
   - Changed option 8 text from "Duplicate Audio" to "Fraud interview"
   - Added option 9: "Interviewer acting as respondent"
   - Updated rejection logic comments to mention option 9
   - Lines: ~3442, ~3447

## Logic Flow

### Rejection Behavior
1. **Option 9 Selected:**
   - `isRejectionOption('audioStatus', '9')` returns `true`
   - `hasRejectionOption()` returns `true`
   - `shouldShowVerificationQuestion()` hides all questions except audioStatus
   - `getApprovalStatus()` returns `'rejected'`
   - Response is rejected when submitted

2. **Option 8 Selected:**
   - Same rejection behavior as before
   - Only text changed, no logic changes

### Question Visibility
- When audioStatus is '1': All questions shown (Q2-Q8)
- When audioStatus is '4' or '7': All questions shown (Q2-Q8)
- When audioStatus is '2', '3', '8', or '9': Only Q1 (Audio Status) shown, all others hidden

## Verification

✅ Backend enum includes '9' (2 locations)
✅ Web frontend has new option 9
✅ Web frontend option 8 text changed
✅ React Native has new option 9
✅ React Native option 8 text changed
✅ Rejection logic treats '9' as rejective
✅ Question visibility logic hides subsequent questions when '9' is selected

## Testing Checklist

- [ ] Test option 9 in web frontend (Survey Approvals page)
- [ ] Test option 9 in React Native app (Start CAPI QC / Start CATI QC)
- [ ] Verify option 9 hides subsequent questions
- [ ] Verify option 9 rejects response when submitted
- [ ] Verify option 8 text change appears correctly
- [ ] Verify option 8 still works as rejective option

## Notes

- No database migration needed (enum is in application layer)
- No API changes needed (same data structure)
- Backward compatible (existing data with options 1-8 still works)
- Option 9 is automatically treated as rejective by existing logic

