#!/bin/bash
# Deep Scan Recovery Script - Most Aggressive Recovery Attempt
# This script tries every possible recovery method

set -e

AUDIO_DIR="/var/www/opine/uploads/audio"
RECOVERY_DIR="/var/www/opine/recovered-audio-deep"
DEVICE="/dev/sda1"
MISSING_FILES_JSON="/var/www/opine/missing-audio-files.json"

echo "🔍 DEEP SCAN RECOVERY - Most Aggressive Attempt"
echo "=============================================="
echo ""

# Create recovery directory
mkdir -p "$RECOVERY_DIR"

# Method 1: Try extundelete even on mounted filesystem
echo "1️⃣ Attempting extundelete recovery (works on mounted ext4)..."
if command -v extundelete &> /dev/null; then
    EXTUNDELETE_OUTPUT="$RECOVERY_DIR/extundelete"
    mkdir -p "$EXTUNDELETE_OUTPUT"
    
    echo "   Scanning for deleted inodes..."
    
    # First, list deleted inodes
    extundelete --restore-all "$DEVICE" --output-dir "$EXTUNDELETE_OUTPUT" 2>&1 | tee "$RECOVERY_DIR/extundelete.log" || true
    
    # Check results
    if [ -d "$EXTUNDELETE_OUTPUT/RECOVERED_FILES" ]; then
        RECOVERED_COUNT=$(find "$EXTUNDELETE_OUTPUT/RECOVERED_FILES" -type f 2>/dev/null | wc -l)
        echo "   ✅ extundelete found $RECOVERED_COUNT files"
        
        # Look for audio files specifically
        find "$EXTUNDELETE_OUTPUT/RECOVERED_FILES" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" -o -name "*.mp3" \) 2>/dev/null | while read file; do
            filename=$(basename "$file")
            # Check if it matches our pattern
            if [[ $filename =~ interview_ ]]; then
                dest="$AUDIO_DIR/$filename"
                if [ ! -f "$dest" ]; then
                    cp "$file" "$dest" 2>/dev/null && echo "   ✅ Recovered: $filename"
                fi
            fi
        done
    else
        echo "   ⚠️  No RECOVERED_FILES directory found"
    fi
else
    echo "   ❌ extundelete not available"
fi

echo ""

# Method 2: Aggressive photorec scanning
echo "2️⃣ Running aggressive photorec scan..."
if command -v photorec &> /dev/null; then
    PHOTOREC_OUTPUT="$RECOVERY_DIR/photorec-aggressive"
    mkdir -p "$PHOTOREC_OUTPUT"
    
    echo "   Creating photorec batch file for non-interactive mode..."
    
    # Photorec doesn't have great CLI support, but we can try
    # We'll use a different approach - scan specific file types
    echo "   Note: Photorec requires interactive mode, but we'll prepare the command"
    echo "   Run manually: sudo photorec /log /d $PHOTOREC_OUTPUT $DEVICE"
    echo "   Then select: File Opt -> Audio -> Free"
else
    echo "   ❌ photorec not available"
fi

echo ""

# Method 3: Deep scan with scalpel - more aggressive settings
echo "3️⃣ Running deep scalpel scan with aggressive settings..."
if command -v scalpel &> /dev/null; then
    SCALPEL_OUTPUT="$RECOVERY_DIR/scalpel-deep"
    mkdir -p "$SCALPEL_OUTPUT"
    
    # Create more aggressive scalpel config
    SCALPEL_CONFIG="/tmp/scalpel-deep.conf"
    cat > "$SCALPEL_CONFIG" << 'EOF'
# Aggressive scalpel configuration for audio files
# Larger size limits to catch fragmented files
m4a     y   50000000   \\.m4a
wav     y   50000000   \\.wav
webm    y   50000000   \\.webm
mp3     y   50000000   \\.mp3
aac     y   50000000   \\.aac
EOF
    
    echo "   Starting deep scalpel scan (this may take a very long time)..."
    scalpel -c "$SCALPEL_CONFIG" -o "$SCALPEL_OUTPUT" "$DEVICE" 2>&1 | tee "$RECOVERY_DIR/scalpel-deep.log" || true
    
    RECOVERED_COUNT=$(find "$SCALPEL_OUTPUT" -type f 2>/dev/null | wc -l)
    echo "   ✅ Scalpel deep scan found $RECOVERED_COUNT files"
else
    echo "   ❌ scalpel not available"
fi

echo ""

# Method 4: Check filesystem journal for deleted file information
echo "4️⃣ Checking filesystem journal for deleted file metadata..."
if command -v debugfs &> /dev/null; then
    FSTYPE=$(blkid -o value -s TYPE "$DEVICE")
    if [ "$FSTYPE" = "ext4" ] || [ "$FSTYPE" = "ext3" ] || [ "$FSTYPE" = "ext2" ]; then
        echo "   Extracting deleted inode information..."
        
        DEBUGFS_OUTPUT="$RECOVERY_DIR/debugfs-info.txt"
        {
            echo "lsdel"
            echo "quit"
        } | debugfs "$DEVICE" 2>/dev/null > "$DEBUGFS_OUTPUT" || true
        
        if [ -s "$DEBUGFS_OUTPUT" ]; then
            DELETED_COUNT=$(grep -c "Deleted inode" "$DEBUGFS_OUTPUT" 2>/dev/null || echo "0")
            echo "   ✅ Found $DELETED_COUNT deleted inodes"
            echo "   Information saved to: $DEBUGFS_OUTPUT"
            
            # Try to recover specific inodes if we can identify them
            echo "   Attempting to recover deleted inodes..."
            grep "Deleted inode" "$DEBUGFS_OUTPUT" | head -100 | while read line; do
                inode=$(echo "$line" | grep -oP 'Inode \K[0-9]+' || echo "")
                if [ -n "$inode" ]; then
                    echo "   Checking inode $inode..."
                    # Try to dump the inode
                    {
                        echo "dump <$inode> $RECOVERY_DIR/inode_$inode"
                        echo "quit"
                    } | debugfs "$DEVICE" 2>/dev/null || true
                fi
            done
        else
            echo "   ⚠️  No deleted inode information available"
        fi
    else
        echo "   ⚠️  Filesystem type ($FSTYPE) doesn't support debugfs recovery"
    fi
else
    echo "   ❌ debugfs not available"
fi

echo ""

# Method 5: Scan entire partition for audio file signatures
echo "5️⃣ Scanning partition for audio file signatures (hex patterns)..."
HEXSCAN_OUTPUT="$RECOVERY_DIR/hex-scan"
mkdir -p "$HEXSCAN_OUTPUT"

# M4A file signature: ftyp (ISO Base Media file)
# WAV file signature: RIFF...WAVE
# WebM signature: 1a 45 df a3

echo "   Searching for M4A files (signature: ftyp)..."
# This is a very slow process, so we'll use strings and grep
strings -a -t x "$DEVICE" 2>/dev/null | grep -i "ftyp.*m4a\|ftyp.*mp4" | head -100 > "$HEXSCAN_OUTPUT/m4a-signatures.txt" || true

echo "   Searching for WAV files (signature: RIFF...WAVE)..."
strings -a -t x "$DEVICE" 2>/dev/null | grep -i "RIFF.*WAVE" | head -100 > "$HEXSCAN_OUTPUT/wav-signatures.txt" || true

echo "   Searching for WebM files (signature: 1a 45 df a3)..."
hexdump -C "$DEVICE" 2>/dev/null | grep -i "1a 45 df a3" | head -100 > "$HEXSCAN_OUTPUT/webm-signatures.txt" || true

echo "   ✅ Signature scan completed"

echo ""

# Method 6: Check for any files with our session ID pattern in unallocated space
echo "6️⃣ Searching for session IDs in unallocated space..."
if [ -f "$MISSING_FILES_JSON" ]; then
    # Extract session IDs from missing files
    SESSION_IDS=$(grep -oP '"sessionId": "\K[^"]+' "$MISSING_FILES_JSON" | head -10)
    
    for session_id in $SESSION_IDS; do
        echo "   Searching for session ID: $session_id"
        # Search for the session ID in the filesystem
        grep -r "$session_id" /var/www/opine/ 2>/dev/null | head -5 || true
    done
fi

echo ""

# Method 7: Try testdisk for partition recovery (might find old partition table)
echo "7️⃣ Checking for old partition information with testdisk..."
if command -v testdisk &> /dev/null; then
    echo "   Note: testdisk requires interactive mode"
    echo "   Run manually: sudo testdisk"
    echo "   Then: Analyze -> Quick Search -> Select partition -> Advanced -> Undelete"
else
    echo "   ❌ testdisk not available"
fi

echo ""

# Summary
echo "=============================================="
echo "📊 DEEP SCAN SUMMARY"
echo "=============================================="
echo "Recovery output directories:"
echo "  - extundelete: $RECOVERY_DIR/extundelete"
echo "  - scalpel: $RECOVERY_DIR/scalpel-deep"
echo "  - photorec: $RECOVERY_DIR/photorec-aggressive"
echo "  - hex scan: $HEXSCAN_OUTPUT"
echo ""

# Count recovered files
TOTAL_RECOVERED=$(find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" -o -name "*.mp3" \) 2>/dev/null | wc -l)
echo "Total audio files found: $TOTAL_RECOVERED"

# Match with missing files
if [ -f "$MISSING_FILES_JSON" ] && [ $TOTAL_RECOVERED -gt 0 ]; then
    echo ""
    echo "Matching recovered files with missing files..."
    find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" -o -name "*.mp3" \) 2>/dev/null | while read file; do
        filename=$(basename "$file")
        if [[ $filename =~ interview_([a-f0-9-]+)_ ]]; then
            session_id="${BASH_REMATCH[1]}"
            if grep -q "\"sessionId\": \"$session_id\"" "$MISSING_FILES_JSON"; then
                expected_filename=$(grep -A 2 "\"sessionId\": \"$session_id\"" "$MISSING_FILES_JSON" | grep "\"filename\"" | cut -d'"' -f4)
                if [ -n "$expected_filename" ]; then
                    dest="$AUDIO_DIR/$expected_filename"
                    if [ ! -f "$dest" ]; then
                        cp "$file" "$dest" 2>/dev/null && echo "✅ Matched and copied: $expected_filename"
                    fi
                fi
            fi
        fi
    done
fi

echo ""
echo "✅ Deep scan completed!"
echo ""
echo "Next steps:"
echo "1. Review all recovered files in: $RECOVERY_DIR"
echo "2. Manually check files that might match by size/date"
echo "3. Try photorec interactively for best results"





