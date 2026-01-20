# Stress Test System - Complete Summary

## 🎯 Purpose

Comprehensive stress testing system for the Opine platform to evaluate:
- **Load Balancer Performance**: How well traffic is distributed across servers
- **MongoDB Replica Set**: Connection handling and query performance
- **API Response Times**: Under high concurrent load
- **System Resources**: CPU, memory, and connection limits
- **Application Stability**: Error rates and failure handling

## 📋 Situation 1: Quality Checks

### Test Scenario
- **10,000 Quality Agents** submitting quality checks
- **50% CAPI responses** (Face-to-face interviews)
- **50% CATI responses** (Telephone interviews)
- **Concurrent Processing**: 50 agents simultaneously
- **Real-time Monitoring**: System metrics collected every second

### Test Flow
1. **Login** → Quality agent authenticates
2. **Get Assignment** → Fetches next review assignment
3. **Submit Verification** → Approves or rejects response
4. **Monitor** → Records all metrics

## 🛡️ Safety Features

### Production Data Protection
✅ All test data marked with `STRESS_TEST_1` marker  
✅ Test quality agents use unique emails/phones  
✅ Original response statuses preserved  
✅ Cleanup script restores original state  
✅ No production data modified or deleted  

### Data Isolation
- Test quality agents: `stress_test_qa_*@stresstest.com`
- Test company: `STRESS_TEST` code
- Test responses: Marked but original data intact

## 📊 Monitoring Capabilities

### System Metrics
- **CPU Usage**: Percentage and load average
- **Memory Usage**: Used, total, percentage, heap
- **MongoDB Connections**: Current active connections
- **API Response Times**: Average, max, min, P95, P99
- **Load Average**: 1min, 5min, 15min

### Data Collection
- **Frequency**: Every 1 second during test
- **Storage**: JSON (detailed) + CSV (analysis)
- **Real-time**: Metrics recorded during API calls

## 📁 File Structure

```
stress-tests/
└── situation-1-quality-checks/
    ├── scripts/
    │   ├── generate-test-data.js      # Creates test data
    │   ├── emulate-quality-checks.js  # Runs stress test
    │   ├── monitor-system.js          # System monitoring
    │   ├── cleanup-test-data.js       # Removes test data
    │   ├── generate-report.js         # Creates reports
    │   └── run-stress-test.js         # Main orchestrator
    ├── reports/                       # Generated reports
    ├── data/                          # Test data summaries
    ├── logs/                          # Execution logs
    ├── README.md                      # Detailed documentation
    └── STRESS_TEST_SUMMARY.md         # This file
```

## 🚀 Quick Start

### Run Complete Test
```bash
cd /var/www/opine/stress-tests/situation-1-quality-checks/scripts
node run-stress-test.js
```

### Run with Cleanup
```bash
node run-stress-test.js --cleanup
```

## 📈 Expected Performance

### Benchmarks
- **Success Rate**: > 95%
- **API Response Time**: < 2000ms average
- **CPU Usage**: < 80%
- **Memory Usage**: < 80%
- **MongoDB Connections**: < 500
- **Throughput**: > 10 checks/second

### What Gets Tested
1. ✅ Authentication system under load
2. ✅ Assignment queue system
3. ✅ Verification submission process
4. ✅ Database query performance
5. ✅ Load balancer distribution
6. ✅ MongoDB connection pooling
7. ✅ API response times
8. ✅ Error handling

## 📄 Reports Generated

1. **HTML Report**: Professional formatted report with charts
2. **CSV Metrics**: Time-series data for analysis
3. **JSON Results**: Raw test results and errors
4. **JSON Metrics**: Complete system metrics

## 🔧 Configuration

### Environment Variables
- `MONGODB_URI`: MongoDB connection string (from backend/.env)
- `API_BASE_URL`: API base URL (defaults to production)

### Test Parameters
- Quality Agents: 10,000
- Concurrency: 50 simultaneous requests
- Response Split: 50% CAPI, 50% CATI
- Monitoring Interval: 1 second

## 🧹 Cleanup Process

### Automatic Cleanup
- Use `--cleanup` flag when running orchestrator
- Removes all test quality agents
- Restores test responses to original status
- Deletes test companies
- Verifies cleanup completion

### Manual Cleanup
```bash
node cleanup-test-data.js
```

## ⚠️ Important Notes

1. **Production System**: Always verify cleanup completed
2. **Test Data**: Marked clearly for easy identification
3. **No Data Loss**: Original data preserved and restored
4. **Monitoring**: Real-time metrics during entire test
5. **Reports**: Professional reports for analysis

## 🔍 Monitoring During Test

### Real-time Commands
```bash
# MongoDB connections
mongosh --eval "db.serverStatus().connections.current"

# System resources
top -bn1 | head -20

# PM2 processes
pm2 monit

# Load balancer
curl http://localhost/health
```

## 📊 Analysis

### Key Metrics to Review
1. **Success Rate**: Should be > 95%
2. **Response Times**: Should remain consistent
3. **Resource Usage**: Should stabilize, not grow continuously
4. **Error Patterns**: Identify common failure points
5. **Bottlenecks**: Find slow operations

### Report Analysis
- Open HTML report in browser
- Import CSV into Excel/Sheets for charts
- Review JSON for detailed error logs
- Compare metrics across test runs

## 🎯 Next Steps

After Situation 1:
1. ✅ Analyze results and identify bottlenecks
2. ✅ Optimize slow operations
3. ✅ Test other scenarios (Situation 2, 3, etc.)
4. ✅ Compare before/after optimizations
5. ✅ Document findings and recommendations

## 📞 Support

For issues:
1. Check `logs/` directory
2. Review error messages in reports
3. Verify test data creation
4. Check MongoDB/API connectivity

---

**Status**: ✅ Ready for Testing  
**Last Updated**: ${new Date().toISOString()}  
**Version**: 1.0





