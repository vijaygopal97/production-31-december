#!/bin/bash
# Monitor stress test progress in real-time

LOG_DIR="/var/www/opine/stress-tests/situation-1-quality-checks/logs"
REPORT_DIR="/var/www/opine/stress-tests/situation-1-quality-checks/reports"

echo "🔍 Monitoring Stress Test Progress..."
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
    clear
    echo "═══════════════════════════════════════════════════════════════"
    echo "📊 STRESS TEST MONITOR - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # Show latest log entries
    echo "📝 Latest Log Entries:"
    echo "───────────────────────────────────────────────────────────────"
    if [ -f "$LOG_DIR"/*.log ]; then
        tail -15 "$LOG_DIR"/*.log 2>/dev/null | tail -15
    else
        echo "No log file found yet..."
    fi
    echo ""
    
    # Check for crash logs
    echo "🚨 Crash Detection:"
    echo "───────────────────────────────────────────────────────────────"
    if [ -f "$REPORT_DIR"/crash-log-*.json ]; then
        echo "⚠️  CRASH DETECTED!"
        cat "$REPORT_DIR"/crash-log-*.json | grep -E '"type"|"reason"|"timestamp"' | head -10
    else
        echo "✅ No crashes detected"
    fi
    echo ""
    
    # Show system resources
    echo "💻 System Resources:"
    echo "───────────────────────────────────────────────────────────────"
    echo "CPU Usage:"
    top -bn1 | grep "Cpu(s)" | awk '{print "  " $2 " user, " $4 " system, " $8 " idle"}'
    echo ""
    echo "Memory Usage:"
    free -h | grep Mem | awk '{print "  Used: " $3 " / " $2 " (" $3/$2*100 "%)"}'
    echo ""
    echo "Load Average:"
    uptime | awk -F'load average:' '{print "  " $2}'
    echo ""
    
    # Check MongoDB connections
    echo "🗄️  MongoDB Status:"
    echo "───────────────────────────────────────────────────────────────"
    if command -v mongosh &> /dev/null; then
        # Try to get MongoDB connections (if accessible)
        echo "  Checking MongoDB connections..."
    else
        echo "  mongosh not available"
    fi
    echo ""
    
    # Show report files
    echo "📄 Generated Reports:"
    echo "───────────────────────────────────────────────────────────────"
    ls -lh "$REPORT_DIR"/*.{json,csv,html} 2>/dev/null | tail -5 | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
    
    echo "═══════════════════════════════════════════════════════════════"
    echo "Refreshing in 5 seconds... (Ctrl+C to stop)"
    sleep 5
done





