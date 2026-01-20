# Stress Test Monitoring Guide

## Real-Time Monitoring Commands

### 1. Check Test Process Status
```bash
ps aux | grep comprehensive-5min-stress-test | grep -v grep
```

### 2. Monitor Test Progress (Live)
```bash
tail -f /var/www/opine/stress-tests/situation-1-quality-checks/logs/comprehensive-5min-*.log
```

### 3. Check Latest Log File
```bash
find /var/www/opine/stress-tests/situation-1-quality-checks/logs -name "comprehensive-5min-*.log" -type f -exec ls -lt {} + | head -1 | awk '{print $NF}' | xargs tail -50
```

### 4. Monitor System Metrics (Live CSV)
```bash
tail -f /var/www/opine/stress-tests/situation-1-quality-checks/reports/metrics-comprehensive-5min-*.csv
```

### 5. Check System Performance
```bash
# CPU and Memory
top -bn1 | head -20

# Memory details
free -h

# Load average
uptime

# Network connections
ss -tn | grep ESTAB | wc -l
```

### 6. Check MongoDB Connections
```bash
cd /var/www/opine/backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const admin = mongoose.connection.db.admin(); const status = await admin.serverStatus(); console.log('MongoDB Connections:', status.connections.current); process.exit(0); });"
```

## Report Locations

### Test Reports
- **HTML Reports**: `/var/www/opine/stress-tests/situation-1-quality-checks/reports/report-*.html`
- **JSON Results**: `/var/www/opine/stress-tests/situation-1-quality-checks/reports/results-*.json`
- **Metrics JSON**: `/var/www/opine/stress-tests/situation-1-quality-checks/reports/metrics-*.json`
- **Metrics CSV**: `/var/www/opine/stress-tests/situation-1-quality-checks/reports/metrics-*.csv`

### Log Files
- **Test Logs**: `/var/www/opine/stress-tests/situation-1-quality-checks/logs/comprehensive-5min-*.log`

## What's Being Monitored

1. **CPU Usage**: Percentage, user time, system time
2. **Memory Usage**: Used, total, percentage, heap usage
3. **MongoDB Connections**: Current active connections
4. **Load Average**: 1min, 5min, 15min averages
5. **API Response Times**: From all emulated requests
6. **Network Connections**: Active TCP connections
7. **Load Balancer**: Nginx upstream status (if available)

## Test Progress Indicators

### Initialization Phase
- "👥 Initializing emulators..."
- "Quality Agents: X/500 initialized"
- "CATI Interviewers: X/500 initialized"
- "CAPI Interviewers: X/500 initialized"

### Running Phase
- "🚀 Starting 5-minute continuous stress test..."
- "⏱️ [Xs/300s] Progress Update:"
- "Quality Agents: X requests | Success: Y%"
- "CATI Interviewers: X requests | Success: Y%"
- etc.

### Completion Phase
- "✅ Stress test completed!"
- "📊 Final Statistics:"
- "📄 Results: ..."
- "📊 Metrics: ..."

## Quick Status Check Script

Create a file `check-status.sh`:
```bash
#!/bin/bash
echo "=== Test Process Status ==="
ps aux | grep comprehensive-5min-stress-test | grep -v grep || echo "Test not running"

echo ""
echo "=== Latest Log Entry ==="
find /var/www/opine/stress-tests/situation-1-quality-checks/logs -name "comprehensive-5min-*.log" -type f -exec ls -lt {} + 2>/dev/null | head -1 | awk '{print $NF}' | xargs tail -5

echo ""
echo "=== System Load ==="
uptime

echo ""
echo "=== Memory Usage ==="
free -h | grep Mem

echo ""
echo "=== Latest Metrics ==="
find /var/www/opine/stress-tests/situation-1-quality-checks/reports -name "metrics-comprehensive-5min-*.csv" -type f -exec ls -lt {} + 2>/dev/null | head -1 | awk '{print $NF}' | xargs tail -1
```

Run it with:
```bash
chmod +x check-status.sh
./check-status.sh
```





