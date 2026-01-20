#!/bin/bash
# Monitor stress test progress and show success rates

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
    
    # Find the latest log file
    LATEST_LOG=$(ls -t "$LOG_DIR"/comprehensive-5min-*.log 2>/dev/null | head -1)
    
    if [ -z "$LATEST_LOG" ]; then
        echo "⏳ Waiting for test to start..."
        echo ""
        sleep 2
        continue
    fi
    
    # Show latest progress updates
    echo "📝 Latest Progress Updates:"
    echo "───────────────────────────────────────────────────────────────"
    grep -E "Progress Update|requests.*Success|Final Statistics" "$LATEST_LOG" | tail -20
    echo ""
    
    # Extract and show success rates
    echo "📊 Current Success Rates:"
    echo "───────────────────────────────────────────────────────────────"
    grep -E "Quality Agents:|CATI Interviewers:|CAPI Interviewers:|Project Managers:|Company Admins:|Company Admins \(QC\):" "$LATEST_LOG" | tail -6 | sed 's/^/   /'
    echo ""
    
    # Show test status
    echo "🔍 Test Status:"
    echo "───────────────────────────────────────────────────────────────"
    if pgrep -f "comprehensive-5min-stress-test-updated" > /dev/null; then
        echo "   ✅ Test is RUNNING"
        TEST_PID=$(pgrep -f "comprehensive-5min-stress-test-updated")
        echo "   PID: $TEST_PID"
        
        # Calculate elapsed time
        if grep -q "Starting 5-minute continuous stress test" "$LATEST_LOG"; then
            START_TIME=$(grep "Starting 5-minute continuous stress test" "$LATEST_LOG" | head -1 | awk '{print $1, $2}')
            if [ ! -z "$START_TIME" ]; then
                echo "   Started: $START_TIME"
            fi
        fi
    else
        echo "   ⚠️  Test process not found (may have completed or crashed)"
    fi
    echo ""
    
    # Show latest errors if any
    echo "🚨 Latest Errors (if any):"
    echo "───────────────────────────────────────────────────────────────"
    grep -i "error\|failed\|❌" "$LATEST_LOG" | tail -5 | sed 's/^/   /' || echo "   ✅ No errors found"
    echo ""
    
    # Show system resources
    echo "💻 System Resources:"
    echo "───────────────────────────────────────────────────────────────"
    echo "   CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)% user, $(top -bn1 | grep "Cpu(s)" | awk '{print $4}' | cut -d'%' -f1)% system"
    echo "   Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
    echo "   Load: $(uptime | awk -F'load average:' '{print $2}')"
    echo ""
    
    # Show report files
    echo "📄 Generated Reports:"
    echo "───────────────────────────────────────────────────────────────"
    ls -lht "$REPORT_DIR"/*.json 2>/dev/null | head -3 | awk '{print "   " $9 " (" $5 ")"}' || echo "   No reports yet"
    echo ""
    
    echo "═══════════════════════════════════════════════════════════════"
    echo "Refreshing in 5 seconds... (Ctrl+C to stop)"
    sleep 5
done







