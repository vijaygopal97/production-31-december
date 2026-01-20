#!/bin/bash
# Auto Git Commit Script - Lightweight File Watcher
# Automatically commits all changes to Convergent-AutoBackup repository
# Uses inotify for efficient event-driven monitoring (no polling)

REPO_PATH="/var/www/opine"
GIT_REPO_NAME="Convergent-AutoBackup"
LOG_FILE="/var/log/auto-git-commit.log"
LOCK_FILE="/tmp/auto-git-commit.lock"
COMMIT_DELAY=30  # Wait 30 seconds before committing (batch multiple changes)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if lock file exists (prevents concurrent commits)
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        log "⚠️  Commit already in progress (PID: $PID), skipping..."
        exit 0
    else
        # Stale lock file, remove it
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Trap to clean up lock file on exit
trap "rm -f $LOCK_FILE" EXIT

# Navigate to repo
cd "$REPO_PATH" || exit 1

# Initialize git repo if it doesn't exist
if [ ! -d ".git" ]; then
    log "📦 Initializing git repository..."
    git init
    git config user.name "Auto Backup System"
    git config user.email "autobackup@convergent.local"
    log "✅ Git repository initialized"
fi

# Add remote if it doesn't exist
if ! git remote get-url origin >/dev/null 2>&1; then
    log "🔗 Adding remote repository: $GIT_REPO_NAME"
    git remote add origin "https://github.com/your-org/$GIT_REPO_NAME.git" 2>/dev/null || true
    log "⚠️  Note: Update remote URL with your actual GitHub repository"
fi

# Stage all changes
log "📝 Staging all changes..."
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    log "✅ No changes to commit"
    exit 0
fi

# Get list of changed files (for commit message)
CHANGED_FILES=$(git diff --cached --name-only | head -10)
CHANGED_COUNT=$(git diff --cached --name-only | wc -l)

# Create commit message
COMMIT_MSG="Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')
Files changed: $CHANGED_COUNT
$(echo "$CHANGED_FILES" | sed 's/^/  - /' | head -5)
$([ $CHANGED_COUNT -gt 5 ] && echo "  ... and $((CHANGED_COUNT - 5)) more files")"

# Commit changes
log "💾 Committing changes..."
if git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1; then
    log "✅ Changes committed successfully ($CHANGED_COUNT files)"
    
    # Push to remote if configured
    if git remote get-url origin >/dev/null 2>&1; then
        REMOTE_URL=$(git remote get-url origin)
        if [[ "$REMOTE_URL" != *"your-org"* ]]; then
            log "🚀 Pushing to remote repository..."
            if git push -u origin main 2>> "$LOG_FILE" || git push -u origin master 2>> "$LOG_FILE"; then
                log "✅ Changes pushed to remote"
            else
                log "⚠️  Push failed (remote may not be configured yet)"
            fi
        else
            log "⚠️  Remote URL not configured, skipping push"
        fi
    fi
else
    log "❌ Commit failed"
    exit 1
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"






