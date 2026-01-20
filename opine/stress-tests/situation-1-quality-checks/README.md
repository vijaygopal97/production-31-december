# Stress Test - Situation 1: Quality Checks

## Overview

This stress test emulates **10,000 Quality Agents** submitting quality checks through the React Native app's quality agent dashboard. The test simulates real-world usage patterns with 50% CAPI responses and 50% CATI responses.

## Test Scenario

- **10,000 Quality Agents** logging in and submitting quality checks
- **50% CAPI responses** (Computer-Assisted Personal Interviewing)
- **50% CATI responses** (Computer-Assisted Telephone Interviewing)
- **Concurrent requests**: 50 agents processed simultaneously
- **Real-time monitoring** of CPU, memory, MongoDB connections, and API response times

## Safety Features

✅ **Production Data Protection:**
- All test data is marked with `STRESS_TEST_1` marker
- Test quality agents are created with unique emails/phones
- Test responses are marked but original data is preserved
- Cleanup script restores original state

✅ **No Data Loss:**
- Original response statuses are saved before modification
- Test data can be completely removed after testing
- Production data remains untouched

## Directory Structure

```
situation-1-quality-checks/
├── scripts/
│   ├── generate-test-data.js      # Creates test quality agents and selects test responses
│   ├── emulate-quality-checks.js   # Emulates quality agent behavior
│   ├── monitor-system.js          # Monitors system resources
│   ├── cleanup-test-data.js       # Removes all test data
│   ├── generate-report.js          # Generates HTML reports
│   └── run-stress-test.js         # Main orchestrator script
├── reports/                        # Generated reports and metrics
├── data/                           # Test data summaries
└── logs/                          # Test execution logs
```

## Prerequisites

1. **MongoDB Connection**: Ensure `.env` file has `MONGODB_URI`
2. **API Access**: Ensure `API_BASE_URL` is set (defaults to production)
3. **Node.js**: Version 16+ required
4. **Dependencies**: Install backend dependencies (`npm install` in `/var/www/opine/backend`)

## Quick Start

### Option 1: Run Complete Test (Recommended)

```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
node run-stress-test.js
```

This will:
1. Generate test data (10K quality agents, select test responses)
2. Run stress test with monitoring
3. Generate professional reports
4. **Skip cleanup** (test data remains for analysis)

### Option 2: Run with Cleanup

```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
node run-stress-test.js --cleanup
```

This will also cleanup all test data after completion.

### Option 3: Run Steps Manually

```bash
# Step 1: Generate test data
node generate-test-data.js

# Step 2: Run stress test
node emulate-quality-checks.js

# Step 3: Generate report (replace TEST_ID with actual test ID)
node generate-report.js quality-checks-1234567890

# Step 4: Cleanup (optional)
node cleanup-test-data.js
```

## Understanding the Test Flow

### 1. Test Data Generation (`generate-test-data.js`)

- Creates 10,000 test quality agents with unique emails
- Finds existing surveys with quality agents assigned
- Selects 10,000 pending responses (50% CAPI, 50% CATI)
- Marks all test data with `STRESS_TEST_1` marker
- Saves summary to `data/test-data-summary.json`

### 2. Quality Check Emulation (`emulate-quality-checks.js`)

For each quality agent:
1. **Login** → Authenticates with test credentials
2. **Get Assignment** → Fetches next review assignment via API
3. **Submit Verification** → Submits quality check (approve/reject)
4. **Monitor** → Records API response times

**Concurrency**: 50 agents processed simultaneously

### 3. System Monitoring (`monitor-system.js`)

Monitors every second:
- **CPU Usage** (%)
- **Memory Usage** (MB and %)
- **MongoDB Connections** (current)
- **Load Average** (1min, 5min, 15min)
- **API Response Times** (ms)

Saves data to:
- `metrics-{testId}.json` (detailed JSON)
- `metrics-{testId}.csv` (CSV for analysis)

### 4. Report Generation (`generate-report.js`)

Creates professional HTML report with:
- Executive summary
- System performance metrics
- Success/failure statistics
- Recommendations
- Links to detailed CSV data

## Reports

After running the test, you'll find:

1. **HTML Report**: `reports/report-{testId}.html`
   - Professional formatted report
   - Open in browser for viewing
   - Can be printed to PDF

2. **Metrics CSV**: `reports/metrics-{testId}.csv`
   - Detailed time-series data
   - Import into Excel/Google Sheets
   - Create custom charts

3. **Results JSON**: `reports/results-{testId}.json`
   - Raw test results
   - Success/failure details
   - Error logs

4. **Metrics JSON**: `reports/metrics-{testId}.json`
   - Complete system metrics
   - Summary statistics
   - All collected data points

## Cleanup

**⚠️ IMPORTANT**: Test data is NOT automatically cleaned up unless you use `--cleanup` flag.

To cleanup manually:

```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
node cleanup-test-data.js
```

This will:
- Delete all test quality agents
- Restore test responses to original status
- Remove test companies
- Verify cleanup completion

## Monitoring During Test

### Real-time Monitoring

Watch system metrics in real-time:

```bash
# Watch MongoDB connections
watch -n 1 'mongosh "your-connection-string" --eval "db.serverStatus().connections.current"'

# Watch system resources
watch -n 1 'top -bn1 | head -20'

# Watch PM2 processes
pm2 monit
```

### Load Balancer Monitoring

Check load balancer distribution:

```bash
# Check Nginx upstream status
sudo nginx -T | grep -A 20 "upstream opine_backend"

# Check server health
curl http://localhost:5000/health
curl http://13.233.231.180:5000/health
curl http://13.127.22.11:5000/health
```

## Expected Results

### Performance Benchmarks

- **Success Rate**: > 95%
- **Average API Response Time**: < 2000ms
- **CPU Usage**: < 80%
- **Memory Usage**: < 80%
- **MongoDB Connections**: < 500
- **Throughput**: > 10 checks/second

### What to Monitor

1. **API Response Times**: Should remain consistent
2. **MongoDB Connections**: Should not exceed pool size
3. **Memory Usage**: Should stabilize, not continuously grow
4. **CPU Usage**: Should handle load without throttling
5. **Error Rate**: Should be minimal (< 5%)

## Troubleshooting

### Test Data Generation Fails

**Issue**: Not enough pending responses
**Solution**: Ensure you have at least 10,000 responses with `Pending_Approval` status

### Stress Test Fails

**Issue**: API timeouts or connection errors
**Solution**: 
- Check API_BASE_URL is correct
- Verify load balancer is accessible
- Check MongoDB connection pool size

### Cleanup Fails

**Issue**: Some test data remains
**Solution**: 
- Run cleanup script again
- Manually verify and remove remaining test data
- Check MongoDB for documents with `metadata.stressTest: true`

## Test Accounts

The following accounts are available for manual testing:

- **Company Admin**: ajayadarsh@gmail.com / Vijaygopal97
- **Interviewer (CAPI)**: ajithinterviewer@gmail.com / Demopassword@123
- **Interviewer (CATI)**: vishalinterviewer@gmail.com / Demopassword@123
- **Quality Agent**: adarshquality123@gmail.com / Vijaygopal97

## Next Steps

After completing Situation 1, you can:

1. **Analyze Results**: Review reports and identify bottlenecks
2. **Optimize**: Make improvements based on findings
3. **Run More Tests**: Test other scenarios (Situation 2, 3, etc.)
4. **Compare**: Run tests again after optimizations

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review error messages in reports
3. Verify test data was created correctly
4. Check MongoDB and API connectivity

---

**⚠️ REMEMBER**: This is a production system. Always verify cleanup completed successfully before considering the test complete.





