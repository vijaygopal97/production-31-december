# Data Integrity Check Scripts

## checkAbandonedStatusIntegrity.js

### Purpose
Checks for responses that have `abandonedReason` but are NOT in `abandoned` status. This is a critical data integrity issue.

### Usage
```bash
cd /var/www/opine/backend
node scripts/checkAbandonedStatusIntegrity.js
```

### What It Checks
- Responses with `abandonedReason` in `Pending_Approval` status
- Responses with `abandonedReason` in `Approved` status
- Responses with `abandonedReason` in `Rejected` status

### Output
- **Console:** Summary of issues found (if any)
- **Report File:** `reports/abandoned-status-integrity-check-{timestamp}.json`

### Exit Codes
- `0` - No issues found (all responses correctly in `abandoned` status)
- `1` - Issues found (responses with `abandonedReason` in wrong status)

### Report Contents
- Total count of issues
- Breakdown by abandonedReason
- Breakdown by survey
- Breakdown by date
- Full list of affected responses with details

### When to Run
- **Daily:** As part of monitoring
- **After batch processing:** To ensure batch processor didn't change abandoned responses
- **After any status change operations:** To verify prevention mechanisms worked
- **On-demand:** Whenever you suspect data integrity issues

### Example Output
```
🔍 Starting Abandoned Status Integrity Check...

✅ Connected to MongoDB

📊 RESULTS:
===========

Pending_Approval + abandonedReason: 0
Approved + abandonedReason: 2
Rejected + abandonedReason: 0

Total Issues: 2

📄 Report saved to: reports/abandoned-status-integrity-check-2026-01-13T12-30-00-000Z.json

⚠️  ISSUES DETECTED!

Breakdown by Abandoned Reason:
  - Call_Not_Connected: 2

Breakdown by Survey:
  - 68fd1915d41841da463f0d46: 2

❌ CRITICAL: Data integrity violation detected!
   These responses should be in "abandoned" status but are not.
```

### Automation
You can add this to a cron job for daily monitoring:
```bash
# Run daily at 2 AM
0 2 * * * cd /var/www/opine/backend && node scripts/checkAbandonedStatusIntegrity.js >> /var/log/opine/integrity-check.log 2>&1
```

