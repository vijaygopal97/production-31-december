# 📊 Stress Test Monitoring Guide

## 🚀 Quick Status Check

### Check if test is running:
```bash
ps aux | grep comprehensive-5min-stress-test | grep -v grep
```

### View live test progress:
```bash
# Find the latest log file
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -f logs/comprehensive-5min-$(ls -t logs/comprehensive-5min-*.log | head -1 | xargs basename)
```

### View last 50 lines:
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -50 logs/comprehensive-5min-*.log | tail -50
```

---

## 📈 System Performance Monitoring

### 1. Worker Status (Primary Server)
```bash
pm2 list | grep opine-backend
pm2 monit opine-backend
```

### 2. Worker Status (Secondary Server)
```bash
ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@3.109.82.159 "pm2 list | grep opine-backend"
```

### 3. System Load & CPU
```bash
uptime
top -bn1 | head -5
```

### 4. MongoDB Connections
```bash
cd /var/www/opine/backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const admin = mongoose.connection.db.admin(); const status = await admin.serverStatus(); console.log('Current:', status.connections.current, 'Available:', status.connections.available, 'Active:', status.connections.active); process.exit(0); });"
```

### 5. Network Connections
```bash
ss -tn | grep ESTAB | wc -l
```

### 6. Memory Usage
```bash
free -h
```

---

## 🔍 Load Balancing Verification

### Check which server handles requests:
```bash
for i in {1..20}; do 
  curl -s -I http://localhost/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}' 2>&1 | grep -i "X-Backend-Server" || echo "unknown"
done | sort | uniq -c
```

### Check Nginx upstream status:
```bash
sudo nginx -T 2>&1 | grep -A 5 "upstream opine_backend"
```

---

## 📊 Test Progress Monitoring

### Real-time progress (every 30 seconds):
The test logs progress updates every 30 seconds showing:
- Quality Agents: requests | success rate
- CATI Interviewers: requests | success rate  
- CAPI Interviewers: requests | success rate
- Project Managers: requests | success rate
- Company Admins: requests | success rate

### Check test duration:
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -100 logs/comprehensive-5min-*.log | grep -E "Progress|\[.*s/300s\]" | tail -5
```

---

## 🎯 Key Metrics to Watch

1. **Success Rate**: Should be > 50% with 24 workers
2. **CPU Usage**: Should stay < 50% per worker
3. **MongoDB Connections**: Should stay < 500
4. **Response Times**: Should be < 2 seconds
5. **System Load**: Should stay < 8 (with 8 cores)

---

## 🛑 Stop Test (if needed)

```bash
pkill -f comprehensive-5min-stress-test
```

---

## 📄 View Final Report

After test completes:
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
ls -lt reports/*.html | head -1
```

Open the latest HTML report in your browser.

---

## 🔧 Troubleshooting

### Test stopped early?
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -100 logs/comprehensive-5min-*.log | grep -E "Error|error|crash|stopped"
```

### Check if cleanup ran:
```bash
cd /var/www/opine/backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const SurveyResponse = mongoose.connection.db.collection('surveyresponses'); const count = await SurveyResponse.countDocuments({ 'metadata.testMarker': 'STRESS_TEST_5MIN' }); console.log('Test responses remaining:', count); process.exit(0); });"
```

---

## 📱 Quick Monitoring Script

Save this as `monitor-test.sh`:
```bash
#!/bin/bash
echo "=== Test Status ==="
ps aux | grep comprehensive-5min-stress-test | grep -v grep && echo "✅ Test running" || echo "❌ Test not running"
echo ""
echo "=== Latest Progress ==="
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -5 logs/comprehensive-5min-*.log 2>/dev/null | grep -E "Progress|\[.*s/300s\]" | tail -1
echo ""
echo "=== System Load ==="
uptime
echo ""
echo "=== Workers (Primary) ==="
pm2 list | grep opine-backend | wc -l
echo ""
echo "=== MongoDB Connections ==="
cd /var/www/opine/backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const admin = mongoose.connection.db.admin(); const status = await admin.serverStatus(); console.log('Current:', status.connections.current); process.exit(0); });" 2>/dev/null
```

Run with: `bash monitor-test.sh`





