#!/bin/bash
# Background Audio Recovery with Live Logging
# This runs multiple recovery methods in parallel with live progress logs

AUDIO_DIR="/var/www/opine/uploads/audio"
RECOVERY_DIR="/var/www/opine/recovered-audio-final"
LOG_DIR="/var/www/opine/recovery-logs"
DEVICE="/dev/sda1"
MISSING_FILES_JSON="/var/www/opine/missing-audio-files.json"

mkdir -p "$RECOVERY_DIR" "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/recovery.log"
}

log "🚀 Starting comprehensive background recovery process..."

# Method 1: extundelete with correct syntax
log "1️⃣ Starting extundelete recovery..."
(
    cd "$RECOVERY_DIR"
    mkdir -p extundelete
    cd extundelete
    extundelete --restore-all "$DEVICE" >> "$LOG_DIR/extundelete.log" 2>&1
    log "✅ extundelete completed. Check: $LOG_DIR/extundelete.log"
) &

# Method 2: photorec (most powerful - requires manual interaction but we'll prepare)
log "2️⃣ Preparing photorec recovery..."
log "   Run manually: cd $RECOVERY_DIR && sudo photorec /log /d photorec-output $DEVICE"
log "   Then select: [File Opt] -> [Audio] -> [Free] -> [Search]"

# Method 3: Deep scalpel scan with better config
log "3️⃣ Starting deep scalpel scan..."
(
    SCALPEL_OUTPUT="$RECOVERY_DIR/scalpel-deep"
    mkdir -p "$SCALPEL_OUTPUT"
    SCALPEL_CONFIG="/tmp/scalpel-final.conf"
    cat > "$SCALPEL_CONFIG" << 'EOF'
m4a     y   100000000  \\.m4a
wav     y   100000000  \\.wav
webm    y   100000000  \\.webm
mp3     y   100000000  \\.mp3
EOF
    scalpel -c "$SCALPEL_CONFIG" -o "$SCALPEL_OUTPUT" "$DEVICE" >> "$LOG_DIR/scalpel.log" 2>&1
    log "✅ Scalpel completed. Found: $(find $SCALPEL_OUTPUT -type f 2>/dev/null | wc -l) files"
) &

# Method 4: Use dd + photorec on a copy (safer)
log "4️⃣ Creating disk image for safer recovery..."
(
    IMAGE_FILE="$RECOVERY_DIR/disk-image.img"
    if [ ! -f "$IMAGE_FILE" ]; then
        log "   Creating disk image (this will take time)..."
        dd if="$DEVICE" of="$IMAGE_FILE" bs=4M status=progress >> "$LOG_DIR/dd.log" 2>&1
        log "✅ Disk image created: $IMAGE_FILE"
    else
        log "   Disk image already exists, skipping..."
    fi
) &

# Wait for all background jobs
wait
log "✅ All recovery methods completed!"

# Check results
log "📊 Checking recovered files..."
find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" \) 2>/dev/null | wc -l | xargs -I {} log "   Found {} audio files"

log "✅ Background recovery process completed!"
log "📝 Check logs in: $LOG_DIR/"
log "📁 Recovered files in: $RECOVERY_DIR/"




