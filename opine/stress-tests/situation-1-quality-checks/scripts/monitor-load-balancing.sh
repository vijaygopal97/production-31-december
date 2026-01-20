#!/bin/bash
# Monitor Load Balancing During Stress Test
# This script tracks which server handles requests during the test

LOG_FILE="/tmp/load_balancer_monitor.log"
PRIMARY_SERVER="13.202.181.167"
SECONDARY_SERVER="3.109.82.159"

echo "🔍 Starting Load Balancer Monitor..."
echo "Press Ctrl+C to stop"
echo ""

# Clear log file
> "$LOG_FILE"

# Function to check which server handled the request
check_server() {
    local response=$(curl -s http://localhost/health 2>/dev/null)
    local server=$(echo "$response" | grep -o '"server":"[^"]*"' | cut -d'"' -f4)
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $server" >> "$LOG_FILE"
    echo "$server"
}

# Monitor loop
while true; do
    clear
    echo "═══════════════════════════════════════════════════════════════"
    echo "📊 LOAD BALANCER MONITOR - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # Check current request
    CURRENT_SERVER=$(check_server)
    echo "📍 Current Request: $CURRENT_SERVER"
    echo ""
    
    # Statistics from log
    if [ -f "$LOG_FILE" ]; then
        TOTAL=$(wc -l < "$LOG_FILE" | tr -d ' ')
        PRIMARY_COUNT=$(grep -c "$PRIMARY_SERVER" "$LOG_FILE" 2>/dev/null || echo "0")
        SECONDARY_COUNT=$(grep -c "$SECONDARY_SERVER" "$LOG_FILE" 2>/dev/null || echo "0")
        
        if [ "$TOTAL" -gt 0 ]; then
            PRIMARY_PCT=$(awk "BEGIN {printf \"%.1f\", ($PRIMARY_COUNT/$TOTAL)*100}")
            SECONDARY_PCT=$(awk "BEGIN {printf \"%.1f\", ($SECONDARY_COUNT/$TOTAL)*100}")
            
            echo "📊 Statistics (Last $TOTAL requests):"
            echo "   Primary ($PRIMARY_SERVER):   $PRIMARY_COUNT requests ($PRIMARY_PCT%)"
            echo "   Secondary ($SECONDARY_SERVER): $SECONDARY_COUNT requests ($SECONDARY_PCT%)"
            echo ""
            
            if [ "$SECONDARY_COUNT" -eq 0 ] && [ "$TOTAL" -gt 10 ]; then
                echo "⚠️  WARNING: Load balancing NOT working!"
                echo "   All requests going to primary server only"
            elif [ "$SECONDARY_PCT" -lt 20 ] && [ "$TOTAL" -gt 10 ]; then
                echo "⚠️  WARNING: Load balancing may not be optimal"
                echo "   Secondary server receiving < 20% of traffic"
            else
                echo "✅ Load balancing appears to be working"
            fi
        fi
    fi
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "Refreshing in 2 seconds... (Ctrl+C to stop)"
    sleep 2
done







