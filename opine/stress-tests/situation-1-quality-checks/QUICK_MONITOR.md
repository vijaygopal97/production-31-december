# 🚀 Quick System Performance Monitor

## 📊 Real-Time Monitoring

### Option 1: Interactive Monitor (Recommended)
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
bash monitor-system-performance.sh
```

This will show:
- ✅ Test status and progress
- ✅ Primary server metrics (CPU, Memory, Load, Workers)
- ✅ Secondary server metrics
- ✅ MongoDB connections and replica set status
- ✅ Load balancing status
- ✅ Test data status

**Updates every 5 seconds automatically**

---

### Option 2: One-Time Status Check

```bash
# Quick status
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
bash monitor-system-performance.sh | head -50
```

---

## 📈 Individual Metrics

### Test Progress
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks
tail -f logs/comprehensive-5min-*.log | grep -E "Progress|\[.*s/300s\]"
```

### Primary Server Workers
```bash
pm2 list | grep opine-backend
pm2 monit opine-backend
```

### Secondary Server Workers
```bash
ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@3.109.82.159 "pm2 list | grep opine-backend"
```

### System Load
```bash
watch -n 2 'uptime && echo "" && top -bn1 | head -5'
```

### MongoDB Connections
```bash
watch -n 2 'cd /var/www/opine/backend && node -e "require(\"dotenv\").config(); const mongoose = require(\"mongoose\"); mongoose.connect(process.env.MONGODB_URI).then(async () => { const admin = mongoose.connection.db.admin(); const status = await admin.serverStatus(); console.log(\"Connections:\", status.connections.current, \"/\", status.connections.current + status.connections.available); process.exit(0); });"'
```

---

## 🎯 Key Metrics to Watch

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| CPU Usage | < 50% | 50-80% | > 80% |
| Memory Usage | < 60% | 60-80% | > 80% |
| Load Average | < 4 (8 cores) | 4-6 | > 6 |
| MongoDB Connections | < 200 | 200-400 | > 400 |
| Worker CPU (avg) | < 30% | 30-50% | > 50% |
| Success Rate | > 70% | 50-70% | < 50% |

---

## 🛑 Stop Monitoring

Press `Ctrl+C` to stop the interactive monitor.





