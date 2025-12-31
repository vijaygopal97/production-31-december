#!/bin/bash
# Live Recovery with Real-time Progress Monitoring
# Runs recovery in background with live log viewing

AUDIO_DIR="/var/www/opine/uploads/audio"
RECOVERY_DIR="/var/www/opine/recovered-audio-live"
LOG_DIR="/var/www/opine/recovery-logs"
DEVICE="/dev/sda1"
PID_FILE="/tmp/recovery.pid"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$RECOVERY_DIR" "$LOG_DIR"

echo -e "${BLUE}🔍 LIVE RECOVERY SYSTEM${NC}"
echo "=========================="
echo ""

# Check if already running
if [ -f "$PID_FILE" ] && ps -p $(cat "$PID_FILE") > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Recovery already running (PID: $(cat $PID_FILE))${NC}"
    echo "View logs: tail -f $LOG_DIR/recovery.log"
    exit 1
fi

# Start recovery in background
{
    echo $$ > "$PID_FILE"
    
    log() {
        echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_DIR/recovery.log"
    }
    
    log "🚀 Starting comprehensive recovery..."
    log "Device: $DEVICE"
    log "Output: $RECOVERY_DIR"
    log ""
    
    # Method 1: extundelete
    log "1️⃣ Method 1: extundelete (ext4 file recovery)..."
    (
        cd "$RECOVERY_DIR"
        mkdir -p extundelete
        cd extundelete
        extundelete --restore-all "$DEVICE" >> "$LOG_DIR/extundelete.log" 2>&1
        COUNT=$(find . -type f 2>/dev/null | wc -l)
        log "   ✅ extundelete found $COUNT files"
    ) &
    PID1=$!
    
    # Method 2: Scalpel deep scan
    log "2️⃣ Method 2: Scalpel (file carving)..."
    (
        SCALPEL_OUTPUT="$RECOVERY_DIR/scalpel"
        mkdir -p "$SCALPEL_OUTPUT"
        SCALPEL_CONFIG="/tmp/scalpel-live.conf"
        cat > "$SCALPEL_CONFIG" << 'EOF'
m4a     y   100000000  \\.m4a
wav     y   100000000  \\.wav
webm    y   100000000  \\.webm
mp3     y   100000000  \\.mp3
aac     y   100000000  \\.aac
EOF
        scalpel -c "$SCALPEL_CONFIG" -o "$SCALPEL_OUTPUT" "$DEVICE" >> "$LOG_DIR/scalpel.log" 2>&1
        COUNT=$(find "$SCALPEL_OUTPUT" -type f 2>/dev/null | wc -l)
        log "   ✅ Scalpel found $COUNT files"
    ) &
    PID2=$!
    
    # Method 3: Foremost with aggressive settings
    log "3️⃣ Method 3: Foremost (file carving)..."
    (
        FOREmost_OUTPUT="$RECOVERY_DIR/foremost"
        mkdir -p "$FOREmost_OUTPUT"
        FOREmost_CONFIG="/tmp/foremost-live.conf"
        cat > "$FOREmost_CONFIG" << 'EOF'
m4a     y   100000000  \\.m4a
wav     y   100000000  \\.wav
webm    y   100000000  \\.webm
mp3     y   100000000  \\.mp3
EOF
        foremost -t m4a,wav,webm,mp3 -i "$DEVICE" -o "$FOREmost_OUTPUT" -c "$FOREmost_CONFIG" >> "$LOG_DIR/foremost.log" 2>&1
        COUNT=$(find "$FOREmost_OUTPUT" -type f 2>/dev/null | wc -l)
        log "   ✅ Foremost found $COUNT files"
    ) &
    PID3=$!
    
    # Wait for all methods
    log ""
    log "⏳ Waiting for recovery methods to complete..."
    log "   (This may take a long time - check logs for progress)"
    
    wait $PID1
    wait $PID2
    wait $PID3
    
    # Summary
    log ""
    log "📊 RECOVERY SUMMARY"
    log "==================="
    
    TOTAL=$(find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" -o -name "*.mp3" \) 2>/dev/null | wc -l)
    log "Total audio files recovered: $TOTAL"
    
    # Match with missing files
    if [ -f "$MISSING_FILES_JSON" ] && [ $TOTAL -gt 0 ]; then
        log ""
        log "🔍 Matching recovered files with missing files..."
        MATCHED=0
        find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" \) 2>/dev/null | while read file; do
            filename=$(basename "$file")
            if [[ $filename =~ interview_([a-f0-9-]+)_ ]]; then
                session_id="${BASH_REMATCH[1]}"
                if grep -q "\"sessionId\": \"$session_id\"" "$MISSING_FILES_JSON" 2>/dev/null; then
                    expected_filename=$(grep -A 2 "\"sessionId\": \"$session_id\"" "$MISSING_FILES_JSON" | grep "\"filename\"" | cut -d'"' -f4)
                    if [ -n "$expected_filename" ]; then
                        dest="$AUDIO_DIR/$expected_filename"
                        if [ ! -f "$dest" ]; then
                            cp "$file" "$dest" 2>/dev/null && {
                                log "   ✅ Matched and copied: $expected_filename"
                                ((MATCHED++))
                            }
                        fi
                    fi
                fi
            fi
        done
        log "Matched files: $MATCHED"
    fi
    
    log ""
    log "✅ Recovery process completed!"
    log "📁 Check recovered files in: $RECOVERY_DIR"
    log "📝 View detailed logs in: $LOG_DIR"
    
    rm -f "$PID_FILE"
    
} > "$LOG_DIR/recovery.log" 2>&1 &

RECOVERY_PID=$!
echo $RECOVERY_PID > "$PID_FILE"

echo -e "${GREEN}✅ Recovery started in background (PID: $RECOVERY_PID)${NC}"
echo ""
echo "📊 Monitor progress:"
echo "   tail -f $LOG_DIR/recovery.log"
echo ""
echo "📝 View individual method logs:"
echo "   tail -f $LOG_DIR/extundelete.log"
echo "   tail -f $LOG_DIR/scalpel.log"
echo "   tail -f $LOG_DIR/foremost.log"
echo ""
echo "🛑 Stop recovery:"
echo "   kill $RECOVERY_PID"
echo ""
echo -e "${YELLOW}💡 TIP: Run 'tail -f $LOG_DIR/recovery.log' in another terminal to watch progress${NC}"




