# Test Data Cleanup Instructions

## Automatic Cleanup

All stress test scripts automatically clean up test data after completion. Test data is marked with `metadata.testMarker` to ensure safe cleanup.

## Manual Cleanup

If you need to manually clean up test data, run:

```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
node cleanup-all-test-data.js
```

This script will:
- Search for all test responses marked with test markers
- Display count of test data found
- Delete all test data
- Verify cleanup completion

## Test Markers

The following test markers are used:
- `STRESS_TEST_1`
- `STRESS_TEST_1_DIRECT`
- `STRESS_TEST_REAL_FLOW`
- `STRESS_TEST_5MIN`
- `STRESS_TEST_COMPREHENSIVE`

## Safety

- **NO production data is ever deleted** - only data with test markers
- Cleanup is verified after deletion
- Multiple cleanup attempts are made if initial cleanup fails
- Direct MongoDB operations are used as fallback

## Verification

To verify no test data remains:

```bash
cd /var/www/opine/backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const db = mongoose.connection.db; const count = await db.collection('surveyresponses').countDocuments({ 'metadata.testMarker': { \$exists: true } }); console.log('Test responses remaining:', count); process.exit(0); });"
```





