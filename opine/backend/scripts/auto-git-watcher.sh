#!/bin/bash
# Auto Git Watcher - Lightweight file change monitor
# Uses inotify to watch for file changes and trigger auto-commit
# No polling = zero CPU overhead when idle

REPO_PATH="/var/www/opine"
COMMIT_SCRIPT="/var/www/opine/backend/scripts/auto-git-commit.sh"
LOG_FILE="/var/log/auto-git-watcher.log"
COMMIT_DELAY=30  # Wait 30 seconds before committing (batch changes)
PID_FILE="/var/run/auto-git-watcher.pid"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if inotifywait is installed
if ! command -v inotifywait &> /dev/null; then
    log "❌ inotifywait not found. Installing inotify-tools..."
    sudo apt-get update && sudo apt-get install -y inotify-tools
fi

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        log "⚠️  Auto-git watcher already running (PID: $OLD_PID)"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# Save PID
echo $$ > "$PID_FILE"

# Trap to clean up on exit
trap "rm -f $PID_FILE; log 'Stopped auto-git watcher'; exit" INT TERM EXIT

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Starting Auto-Git Watcher"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Repository: $REPO_PATH"
log "Commit delay: ${COMMIT_DELAY}s (batches multiple changes)"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Variables for debouncing
LAST_COMMIT_TIME=0
PENDING_COMMIT=0

# Function to trigger commit with debouncing
trigger_commit() {
    CURRENT_TIME=$(date +%s)
    TIME_SINCE_LAST=$((CURRENT_TIME - LAST_COMMIT_TIME))
    
    if [ $TIME_SINCE_LAST -ge $COMMIT_DELAY ]; then
        # Enough time has passed, commit now
        log "📝 File change detected, committing in ${COMMIT_DELAY}s..."
        sleep $COMMIT_DELAY
        
        # Check if more changes occurred during sleep
        CURRENT_TIME_AFTER=$(date +%s)
        if [ $((CURRENT_TIME_AFTER - LAST_COMMIT_TIME)) -ge $COMMIT_DELAY ]; then
            "$COMMIT_SCRIPT" &
            LAST_COMMIT_TIME=$(date +%s)
            PENDING_COMMIT=0
        fi
    else
        # Not enough time passed, schedule for later
        REMAINING=$((COMMIT_DELAY - TIME_SINCE_LAST))
        log "📝 File change detected, will commit in ${REMAINING}s (debouncing)..."
        PENDING_COMMIT=1
        
        # Background job to commit after delay
        (
            sleep $REMAINING
            if [ $PENDING_COMMIT -eq 1 ]; then
                "$COMMIT_SCRIPT" &
                LAST_COMMIT_TIME=$(date +%s)
                PENDING_COMMIT=0
            fi
        ) &
    fi
}

# Watch for file changes in the repository
# Exclude .git directory, node_modules, logs, etc.
inotifywait -m -r --format '%w%f %e' \
    --exclude '\.git|node_modules|logs|\.env|uploads|generated-csvs|\.cache|dist|build|\.next' \
    -e modify,create,delete,move \
    "$REPO_PATH" 2>/dev/null | while read FILE EVENT; do
    
    # Skip certain file types
    if [[ "$FILE" =~ \.(log|tmp|swp|swo|DS_Store)$ ]] || [[ "$FILE" =~ node_modules ]] || [[ "$FILE" =~ \.git ]]; then
        continue
    fi
    
    log "📁 Detected change: $EVENT - $(basename "$FILE")"
    trigger_commit
done






