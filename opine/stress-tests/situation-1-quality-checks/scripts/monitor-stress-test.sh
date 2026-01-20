#!/bin/bash
# Monitor stress test with load balancing and replica set status

echo "🔍 Monitoring Stress Test Progress..."
echo ""

# Find the test log file (most recent)
LOG_FILE=$(ls -t /tmp/stress-test-final-*.log 2>/dev/null | head -1)

if [ -z "$LOG_FILE" ]; then
    echo "❌ No stress test log file found. Is the test running?"
    exit 1
fi

echo "📄 Log file: $LOG_FILE"
echo ""

# Monitor loop
while true; do
    clear
    echo "=========================================="
    echo "🔍 Stress Test Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
    echo ""
    
    # Show test progress
    echo "📊 Test Progress:"
    tail -50 "$LOG_FILE" 2>/dev/null | grep -E "Progress Update|Success|Quality Agents|CATI Interviewers|CAPI Interviewers" | tail -10
    echo ""
    
    # Show load balancing status
    echo "🌐 Load Balancing Status:"
    PRIMARY_COUNT=0
    SECONDARY_COUNT=0
    for i in {1..10}; do
        SERVER_IP=$(timeout 2 curl -s http://127.0.0.1:5000/health 2>/dev/null | jq -r '.server' 2>/dev/null || echo "")
        if [[ -n "$SERVER_IP" ]]; then
            if [[ "$SERVER_IP" == *"172.31.43"* ]]; then
                PRIMARY_COUNT=$((PRIMARY_COUNT + 1))
            elif [[ "$SERVER_IP" == *"172.31.47"* ]]; then
                SECONDARY_COUNT=$((SECONDARY_COUNT + 1))
            fi
        fi
        sleep 0.1
    done
    TOTAL=$((PRIMARY_COUNT + SECONDARY_COUNT))
    if [ $TOTAL -gt 0 ]; then
        PRIMARY_PCT=$((PRIMARY_COUNT * 100 / TOTAL))
        SECONDARY_PCT=$((SECONDARY_COUNT * 100 / TOTAL))
        echo "   Primary server: $PRIMARY_COUNT/$TOTAL ($PRIMARY_PCT%)"
        echo "   Secondary server: $SECONDARY_COUNT/$TOTAL ($SECONDARY_PCT%)"
    else
        echo "   ⚠️  Unable to check load balancing"
    fi
    echo ""
    
    # Show replica set query distribution (from secondary profiling)
    echo "🗄️  Replica Set Query Distribution (from secondary):"
    ssh -i /var/www/MyLogos/Convergent-New.pem -o ConnectTimeout=3 -o StrictHostKeyChecking=no ubuntu@3.109.82.159 "mongosh Opine --quiet --eval 'const recent = db.system.profile.countDocuments({ts: {\$gte: new Date(Date.now() - 60000)}}); const withReadPref = db.system.profile.countDocuments({\"command.\$readPreference\": {\$exists: true}, ts: {\$gte: new Date(Date.now() - 60000)}}); const connections = db.serverStatus().connections.current; print(\"Recent queries (60s): \" + recent); print(\"With readPreference: \" + withReadPref); print(\"Active connections: \" + connections);' 2>&1 | grep -E 'Recent|With|Active' | head -3" 2>/dev/null || echo "   ⚠️  Unable to check secondary (may be unavailable)"
    echo ""
    
    # Check if test is still running
    if ! pgrep -f "comprehensive-5min-stress-test" > /dev/null; then
        echo "✅ Test completed!"
        echo ""
        echo "📊 Final Results:"
        tail -50 "$LOG_FILE" 2>/dev/null | grep -E "Final Statistics|Quality Agents.*Success|CATI Interviewers.*Success|CAPI Interviewers.*Success" | tail -10
        echo ""
        echo "Press Ctrl+C to exit"
        sleep 5
    fi
    
    echo "Press Ctrl+C to stop monitoring"
    sleep 10
done







