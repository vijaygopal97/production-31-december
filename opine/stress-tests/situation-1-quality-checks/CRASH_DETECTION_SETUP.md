# Crash Detection System - Setup Complete ✅

## 🛡️ Crash Detection Features Added

The stress test system now includes **automatic crash detection** that will stop the test if the server shows signs of crashing.

### Crash Detection Thresholds

The system monitors and will **STOP THE TEST** if:

1. **CPU Usage > 95%** - Critical CPU overload
2. **Memory Usage > 95%** - Critical memory exhaustion  
3. **MongoDB Connections > 800** - Database connection pool exhaustion
4. **CPU > 90% for 5 consecutive samples** - Sustained high CPU (indicates system stress)
5. **Memory > 90% for 5 consecutive samples** - Sustained high memory (indicates memory leak)

### What Happens When Crash is Detected

1. ✅ **Test Stops Immediately** - No more requests sent
2. ✅ **Crash Log Created** - Detailed crash information saved
3. ✅ **Metrics Preserved** - All metrics up to crash point saved
4. ✅ **Report Generated** - Report includes crash details
5. ✅ **Safe Shutdown** - Clean exit with all data saved

### Crash Log Location

When a crash is detected, a detailed log is saved to:
```
reports/crash-log-{testId}.json
```

This file contains:
- Crash type and reason
- System metrics at crash point
- Timestamp and elapsed time
- All threshold values

## 📊 Current Status

**Crash Detection**: ✅ ENABLED  
**Monitoring Interval**: 1 second  
**Test Status**: Ready to run (MongoDB connection needs verification)

## 🚀 Running the Test

Once MongoDB connectivity is confirmed, run:

```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
node run-stress-test.js
```

### Monitor Progress

In another terminal, watch the test progress:

```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
./monitor-test-progress.sh
```

## ⚠️ Important Notes

1. **MongoDB Connection**: The test requires MongoDB to be accessible. Current connection timeout suggests network or MongoDB server issues.

2. **Test Will Stop Safely**: If crash is detected, the test stops immediately and saves all data.

3. **No Data Loss**: All metrics and results are saved even if test stops early.

4. **Review Crash Logs**: After test completes (or stops), review `crash-log-*.json` for details.

## 🔍 Troubleshooting MongoDB Connection

If you see MongoDB connection timeouts:

1. **Check MongoDB Status**:
   ```bash
   mongosh "your-connection-string" --eval "db.adminCommand('ping')"
   ```

2. **Verify Network Access**:
   ```bash
   telnet <mongodb-host> 27017
   ```

3. **Check Firewall Rules**:
   - Ensure MongoDB port is accessible
   - Check security groups (if AWS)

4. **Test Connection from Backend**:
   ```bash
   cd /var/www/opine/backend
   node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { console.log('Connected'); process.exit(0); });"
   ```

## 📈 Expected Behavior

- **Normal Operation**: Test runs, metrics collected, no crashes
- **High Load**: CPU/Memory may spike but should stabilize
- **Crash Detected**: Test stops, crash log created, all data saved
- **After Crash**: Review crash log to understand what caused it

## 🎯 Next Steps

1. ✅ Verify MongoDB connectivity
2. ✅ Run test: `node run-stress-test.js`
3. ✅ Monitor progress: `./monitor-test-progress.sh`
4. ✅ Review reports after completion
5. ✅ Check crash logs if test stopped early

---

**Status**: Crash detection system ready ✅  
**Last Updated**: $(date)





