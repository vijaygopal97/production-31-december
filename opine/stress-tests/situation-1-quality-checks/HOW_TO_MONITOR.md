# How to Monitor the Stress Test

## Quick Status Check

Run this command anytime to see current test status:

```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
bash MONITOR_TEST.sh
```

## Real-Time Monitoring Options

### Option 1: Watch Live Progress (Recommended)
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -f logs/comprehensive-5min-*.log | grep -E 'Progress|\[.*s/300s\]|requests|Success|completed'
```

### Option 2: Check Latest Status
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -50 logs/comprehensive-5min-*.log | grep -E 'Progress|\[.*s/300s\]'
```

### Option 3: Full System Performance Monitor
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
bash monitor-system-performance.sh
```

### Option 4: Check Test Process
```bash
ps aux | grep comprehensive-5min-stress-test.js | grep -v grep
```

## What to Look For

### Test Progress
- **Progress**: Shows `[XXXs/300s]` - how many seconds elapsed out of 300 (5 minutes)
- **Requests**: Total requests made by each user type
- **Success Rate**: Percentage of successful requests

### System Health
- **Primary Server Load**: Should be < 8 (we have 8 cores)
- **Secondary Server Load**: Currently very high (122+) - this is the bottleneck
- **CPU Usage**: Should be < 80% ideally
- **Memory**: Should be < 80%
- **MongoDB Connections**: Currently ~188 (very low, not a bottleneck)

## Current Test Configuration

- **Duration**: 5 minutes (300 seconds)
- **Scale**: 
  - 50 Quality Agents
  - 50 CATI Interviewers
  - 50 CAPI Interviewers
  - 10 Project Managers
  - 2 Company Admins

## Log File Location

All logs are stored in:
```
/var/www/opine/stress-tests/situation-1-quality-checks/logs/
```

Latest log file: `comprehensive-5min-YYYYMMDD-HHMMSS.log`





