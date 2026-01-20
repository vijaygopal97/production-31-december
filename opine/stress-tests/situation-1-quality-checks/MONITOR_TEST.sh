#!/bin/bash

# Quick Test Monitor Script
# Usage: bash MONITOR_TEST.sh

cd /var/www/opine/stress-tests/situation-1-quality-checks

echo "═══════════════════════════════════════════════════════════════"
echo "           STRESS TEST MONITOR"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if test is running
TEST_PID=$(ps aux | grep comprehensive-5min-stress-test.js | grep -v grep | awk '{print $2}')
if [ -z "$TEST_PID" ]; then
    echo "❌ TEST STATUS: NOT RUNNING"
    echo ""
    echo "Latest log entries:"
    LATEST_LOG=$(ls -t logs/comprehensive-5min-*.log 2>/dev/null | head -1)
    if [ -n "$LATEST_LOG" ]; then
        tail -20 "$LATEST_LOG" 2>/dev/null
    fi
    exit 0
fi

echo "✅ TEST STATUS: RUNNING (PID: $TEST_PID)"
echo ""

# Get latest log
LATEST_LOG=$(ls -t logs/comprehensive-5min-*.log 2>/dev/null | head -1)
if [ -z "$LATEST_LOG" ]; then
    echo "⚠️  No log file found"
    exit 1
fi

echo "📄 Log File: $(basename $LATEST_LOG)"
echo ""

# Get latest progress
PROGRESS=$(tail -300 "$LATEST_LOG" 2>/dev/null | grep -oE "\[[0-9]+s/300s\]" | tail -1)
if [ -n "$PROGRESS" ]; then
    echo "📊 PROGRESS: $PROGRESS"
    echo ""
fi

# Get latest metrics
echo "📈 LATEST METRICS:"
tail -300 "$LATEST_LOG" 2>/dev/null | grep -A 6 "Progress Update:" | tail -7
echo ""

# System performance
echo "🖥️  SYSTEM PERFORMANCE:"
echo "  Primary Server:"
echo "    Load: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}')"
echo "    CPU: $(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//')%"
echo "    Memory: $(free | grep Mem | awk '{printf "%.1f%%", $3/$2*100}')"
echo "    Workers: $(pm2 list | grep opine-backend | wc -l)"
echo ""
echo "  Secondary Server:"
SEC_LOAD=$(ssh -i /var/www/MyLogos/Convergent-New.pem -o StrictHostKeyChecking=no -o ConnectTimeout=3 ubuntu@3.109.82.159 "uptime | awk -F'load average:' '{print \$2}' | awk '{print \$1}'" 2>/dev/null)
SEC_CPU=$(ssh -i /var/www/MyLogos/Convergent-New.pem -o StrictHostKeyChecking=no -o ConnectTimeout=3 ubuntu@3.109.82.159 "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | sed 's/%us,//'" 2>/dev/null)
if [ -n "$SEC_LOAD" ]; then
    echo "    Load: $SEC_LOAD"
    echo "    CPU: ${SEC_CPU}%"
else
    echo "    ⚠️  Cannot connect"
fi
echo ""
echo "  MongoDB:"
cd /var/www/opine/backend
MONGO_CONN=$(node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(async () => { const admin = mongoose.connection.db.admin(); const status = await admin.serverStatus(); console.log(status.connections.current); process.exit(0); });" 2>/dev/null)
echo "    Connections: $MONGO_CONN"
echo ""
echo "═══════════════════════════════════════════════════════════════"





