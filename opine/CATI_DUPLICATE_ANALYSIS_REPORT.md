# CATI Respondent Queue Analysis Report
## Survey ID: 68fd1915d41841da463f0d46

**Date:** December 14, 2025  
**Issue:** Interviewers getting repeated numbers assigned even after calls are connected or numbers don't exist

---

## Question 1: What Status Values Are Allowed to Be Assigned for Calling?

### Answer:
**Only `'pending'` status is allowed to be assigned to interviewers.**

### Evidence:
Looking at the code in `/var/www/opine/backend/controllers/catiInterviewController.js` (lines 284-287), when an interviewer starts an interview, the system queries for respondents with:

```javascript
const nextRespondent = await CatiRespondentQueue.findOne({
  survey: surveyId,
  status: 'pending'  // ← Only 'pending' status is queried
}).sort({ priority: -1, createdAt: 1 });
```

### All Available Statuses in the System:
According to `/var/www/opine/backend/models/CatiRespondentQueue.js`, the following statuses exist:

1. **`pending`** - Waiting to be called (default, **ONLY THIS ONE IS ASSIGNED**)
2. `assigned` - Assigned to an interviewer
3. `calling` - Call in progress
4. `interview_success` - Interview completed successfully
5. `call_failed` - Call failed (technical issue)
6. `busy` - Number was busy
7. `not_interested` - Respondent not interested
8. `call_later` - Scheduled for later call
9. `no_answer` - No answer
10. `switched_off` - Phone switched off
11. `not_reachable` - Number not reachable
12. `does_not_exist` - Number does not exist
13. `rejected` - Call rejected by respondent

### Problem Identified:
The issue is that when a call is completed (status changes to `interview_success`) or marked as `does_not_exist`, the system should NOT assign that number again. However, **if there are duplicate entries with the same phone number**, and one entry has status `interview_success` or `does_not_exist`, but another duplicate entry still has status `pending`, the system will assign the duplicate `pending` entry again.

---

## Question 2: Duplicate Phone Numbers Analysis

### Summary Statistics:
- **Total Queue Entries:** 9,454
- **Unique Phone Numbers:** 8,689
- **Duplicate Phone Numbers Found:** 555
- **Total Duplicate Entries:** 1,320 (9,454 - 8,689 = 765 extra entries, but some phones have multiple duplicates)

### Critical Finding:
**YES, there are duplicate phone numbers in the `respondentContact.phone` field!**

### Examples of Duplicates Found:

#### Example 1: Phone `9681112845` - **42 occurrences!**
- Object ID: `692ea9cd9eee1db346987b3d` - Name: "Kavita Bagri" - Status: `interview_success`
- Object ID: `692ea9cd9eee1db346987c71` - Name: "RABI TANTI" - Status: `pending` ⚠️
- Object ID: `692ea9cd9eee1db346987c89` - Name: "RIMA" - Status: `pending` ⚠️
- ... and 39 more entries with status `pending`

#### Example 2: Phone `9883581801` - **54 occurrences!**
- Multiple entries with different names but same phone number
- Many have status `pending`, which means they can be assigned again

#### Example 3: Phone `9836533687` - 2 occurrences
- Object ID: `692ea9cd9eee1db346987b15` - Name: "REHAN" - Status: `calling`
- Object ID: `692ea9cf9eee1db3469897e8` - Name: "MD SHAHZADA" - Status: `pending` ⚠️

#### Example 4: Phone `9163986235` - 2 occurrences
- Object ID: `692ea9cd9eee1db346987b31` - Name: "SURESH" - Status: `interview_success` ✅
- Object ID: `692ea9cd9eee1db346987bee` - Name: "RITA" - Status: `pending` ⚠️ **CAN BE ASSIGNED AGAIN!**

### The Root Cause:
**The problem is clear:** When the same phone number exists multiple times in the queue:
1. One entry might be marked as `interview_success` or `does_not_exist`
2. But another duplicate entry with the same phone number still has status `pending`
3. The system will assign the `pending` duplicate entry again
4. This causes interviewers to get the same number repeatedly

---

## Complete Duplicate Report

A detailed JSON report has been generated with all 555 duplicate phone numbers and their Object IDs:
**Location:** `/var/www/opine/backend/scripts/duplicate-phones-report-68fd1915d41841da463f0d46-1765741391384.json`

### Report Structure:
The JSON file contains:
- `totalEntries`: Total number of queue entries
- `uniquePhones`: Number of unique phone numbers
- `duplicateCount`: Number of phone numbers that have duplicates
- `duplicates`: Array of duplicate phone numbers, each containing:
  - `phone`: The duplicate phone number
  - `count`: How many times this phone appears
  - `entries`: Array of all entries with this phone, including:
    - `_id`: Object ID (for manual verification)
    - `phone`: Phone number
    - `name`: Respondent name
    - `status`: Current status
    - `assignedTo`: Interviewer ID if assigned
    - `createdAt`: Creation timestamp

---

## Recommendations

1. **Immediate Action Required:**
   - Review the JSON report to identify which duplicate entries should be kept vs. deleted
   - For each duplicate phone number, keep only ONE entry (preferably the one with `interview_success` if it exists, or the oldest `pending` entry)
   - Delete all other duplicate entries

2. **Prevention:**
   - Add a unique index on `{ survey: 1, 'respondentContact.phone': 1 }` to prevent future duplicates
   - Update the queue initialization logic to check for existing phone numbers before creating new entries

3. **Status Management:**
   - When marking a number as `does_not_exist` or `interview_success`, update ALL entries with that phone number to prevent reassignment
   - Or, add a check in the assignment logic to skip phone numbers that already have a successful interview or are marked as non-existent

---

## Next Steps

1. **Manual Verification:** Review the JSON report file to confirm which duplicates are legitimate vs. data errors
2. **Cleanup Script:** Once verified, create a cleanup script to remove duplicate entries (keeping only one per phone number)
3. **Prevention:** Implement unique constraints and update assignment logic

---

**Report Generated By:** Automated Analysis Script  
**Script Location:** `/var/www/opine/backend/scripts/checkDuplicatePhones.js`


