#!/bin/bash
# Automated Audio Recovery Script
# This script automatically attempts to recover deleted audio files

set -e

# Configuration
AUDIO_DIR="/var/www/opine/uploads/audio"
RECOVERY_DIR="/var/www/opine/recovered-audio"
MISSING_FILES_JSON="/var/www/opine/missing-audio-files.json"
DEVICE="/dev/sda1"

echo "🔧 Starting Automated Audio Recovery..."
echo "======================================"
echo ""

# Create recovery directory
mkdir -p "$RECOVERY_DIR"

# Install recovery tools if needed
echo "📦 Installing recovery tools..."
apt-get update -qq > /dev/null 2>&1
apt-get install -y foremost scalpel testdisk > /dev/null 2>&1 || true

# Method 1: Use foremost for file carving
echo ""
echo "1️⃣ Running foremost recovery (this may take a while)..."
FOREmost_OUTPUT="$RECOVERY_DIR/foremost"
mkdir -p "$FOREmost_OUTPUT"

# Create foremost config
FOREmost_CONFIG="/tmp/foremost-audio.conf"
cat > "$FOREmost_CONFIG" << 'EOF'
m4a     y   20000000   \\.m4a
wav     y   20000000   \\.wav
webm    y   20000000   \\.webm
mp3     y   20000000   \\.mp3
aac     y   20000000   \\.aac
EOF

# Run foremost on the partition
if command -v foremost &> /dev/null; then
    echo "   Scanning $DEVICE for audio files..."
    foremost -t m4a,wav,webm,mp3,aac -i "$DEVICE" -o "$FOREmost_OUTPUT" -c "$FOREmost_CONFIG" > "$RECOVERY_DIR/foremost.log" 2>&1 || true
    
    RECOVERED_COUNT=$(find "$FOREmost_OUTPUT" -type f 2>/dev/null | wc -l)
    echo "   ✅ Foremost completed. Found $RECOVERED_COUNT files"
else
    echo "   ❌ foremost not available"
fi

# Method 2: Check for files in common temp locations
echo ""
echo "2️⃣ Checking temporary directories..."
TEMP_DIRS=("/tmp" "/var/tmp")
FOUND_COUNT=0

for temp_dir in "${TEMP_DIRS[@]}"; do
    if [ -d "$temp_dir" ]; then
        find "$temp_dir" -type f \( -name "interview_*.m4a" -o -name "interview_*.wav" -o -name "interview_*.webm" \) 2>/dev/null | while read file; do
            filename=$(basename "$file")
            dest="$AUDIO_DIR/$filename"
            if [ ! -f "$dest" ] && [ -f "$file" ]; then
                cp "$file" "$dest" 2>/dev/null && {
                    echo "   ✅ Recovered from $temp_dir: $filename"
                    ((FOUND_COUNT++))
                }
            fi
        done
    fi
done

# Method 3: Match recovered files with missing files
echo ""
echo "3️⃣ Matching recovered files with missing files list..."

if [ -f "$MISSING_FILES_JSON" ]; then
    MATCHED_COUNT=0
    
    # Find all recovered files
    find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" -o -name "*.mp3" \) 2>/dev/null | while read recovered_file; do
        filename=$(basename "$recovered_file")
        
        # Extract session ID from filename (format: interview_{sessionId}_{timestamp}.ext)
        if [[ $filename =~ interview_([a-f0-9-]+)_[0-9]+\.(m4a|wav|webm|mp3) ]]; then
            session_id="${BASH_REMATCH[1]}"
            
            # Check if this session ID is in missing files
            if grep -q "\"sessionId\": \"$session_id\"" "$MISSING_FILES_JSON"; then
                # Get the expected filename from JSON
                expected_filename=$(grep -A 2 "\"sessionId\": \"$session_id\"" "$MISSING_FILES_JSON" | grep "\"filename\"" | cut -d'"' -f4)
                
                if [ -n "$expected_filename" ]; then
                    dest="$AUDIO_DIR/$expected_filename"
                    if [ ! -f "$dest" ]; then
                        cp "$recovered_file" "$dest" 2>/dev/null && {
                            echo "   ✅ Matched and copied: $expected_filename"
                            ((MATCHED_COUNT++))
                        }
                    fi
                fi
            fi
        fi
    done
    
    echo "   Matched and copied $MATCHED_COUNT files"
fi

# Summary
echo ""
echo "======================================"
echo "📊 RECOVERY SUMMARY"
echo "======================================"
echo "Recovery output: $RECOVERY_DIR"
echo "Total recovered files: $(find "$RECOVERY_DIR" -type f 2>/dev/null | wc -l)"
echo "Files in audio directory: $(find "$AUDIO_DIR" -type f 2>/dev/null | wc -l)"
echo ""
echo "✅ Recovery process completed!"
echo ""
echo "Next steps:"
echo "1. Review files in: $RECOVERY_DIR"
echo "2. Manually match any unmatched files using session IDs"
echo "3. Check the missing files list: $MISSING_FILES_JSON"





