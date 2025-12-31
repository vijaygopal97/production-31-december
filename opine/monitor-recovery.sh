#!/bin/bash
# Monitor Recovery Progress - Real-time Status
# Run this to watch recovery progress

LOG_DIR="/var/www/opine/recovery-logs"
RECOVERY_DIR="/var/www/opine/recovered-audio-live"

echo "📊 RECOVERY MONITOR"
echo "==================="
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""

# Function to show status
show_status() {
    clear
    echo "📊 RECOVERY STATUS - $(date '+%H:%M:%S')"
    echo "========================================"
    echo ""
    
    # Check if recovery is running
    if [ -f "/tmp/recovery.pid" ] && ps -p $(cat /tmp/recovery.pid) > /dev/null 2>&1; then
        echo "✅ Recovery is RUNNING (PID: $(cat /tmp/recovery.pid))"
    else
        echo "❌ Recovery is NOT running"
    fi
    
    echo ""
    echo "📝 Latest Log Entries:"
    echo "----------------------"
    tail -10 "$LOG_DIR/recovery.log" 2>/dev/null || echo "No log file yet"
    
    echo ""
    echo "📁 Files Recovered So Far:"
    echo "-------------------------"
    TOTAL=$(find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" -o -name "*.mp3" \) 2>/dev/null | wc -l)
    echo "Total audio files: $TOTAL"
    
    echo ""
    echo "📊 Method Progress:"
    echo "-------------------"
    
    # extundelete progress
    if [ -f "$LOG_DIR/extundelete.log" ]; then
        EXT_COUNT=$(grep -c "extundelete" "$LOG_DIR/extundelete.log" 2>/dev/null || echo "0")
        echo "extundelete: Processing..."
    fi
    
    # scalpel progress
    if [ -f "$LOG_DIR/scalpel.log" ]; then
        SCALPEL_FOUND=$(find "$RECOVERY_DIR/scalpel" -type f 2>/dev/null | wc -l)
        echo "scalpel: Found $SCALPEL_FOUND files"
    fi
    
    # foremost progress
    if [ -f "$LOG_DIR/foremost.log" ]; then
        FOREmost_FOUND=$(find "$RECOVERY_DIR/foremost" -type f 2>/dev/null | wc -l)
        echo "foremost: Found $FOREmost_FOUND files"
    fi
    
    echo ""
    echo "Press Ctrl+C to stop monitoring"
    sleep 2
}

# Monitor loop
while true; do
    show_status
done




