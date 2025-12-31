#!/bin/bash
# Advanced Audio Recovery Script
# This script attempts to recover deleted audio files using multiple methods

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUDIO_DIR="/var/www/opine/uploads/audio"
RECOVERY_DIR="/var/www/opine/recovered-audio"
MISSING_FILES_JSON="/var/www/opine/missing-audio-files.json"
DEVICE="/dev/sda1"  # Root partition where uploads are stored

echo -e "${BLUE}🔧 Advanced Audio Recovery Script${NC}"
echo -e "${BLUE}================================${NC}\n"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Create recovery directory
mkdir -p "$RECOVERY_DIR"
echo -e "${GREEN}✅ Created recovery directory: $RECOVERY_DIR${NC}\n"

# Method 1: Check for filesystem snapshots
echo -e "${YELLOW}1️⃣ Checking for filesystem snapshots...${NC}"
if command -v lvdisplay &> /dev/null; then
    echo "   Checking LVM snapshots..."
    lvdisplay | grep -i snapshot || echo "   No LVM snapshots found"
fi

# Check for btrfs snapshots
if [ -d "/.snapshots" ]; then
    echo "   Found btrfs snapshots directory"
    ls -la /.snapshots/ | head -10
else
    echo "   No btrfs snapshots found"
fi

# Check for Azure snapshots (if on Azure)
if [ -d "/mnt" ] && mountpoint -q /mnt; then
    echo "   Checking /mnt for potential snapshots..."
    ls -la /mnt/ | head -10 || true
fi

echo ""

# Method 2: Use testdisk/photorec for file carving
echo -e "${YELLOW}2️⃣ Attempting recovery with photorec (file carving)...${NC}"

if ! command -v photorec &> /dev/null; then
    echo -e "${YELLOW}   Installing testdisk (includes photorec)...${NC}"
    apt-get update -qq
    apt-get install -y testdisk > /dev/null 2>&1
fi

if command -v photorec &> /dev/null; then
    echo -e "${GREEN}   ✅ photorec is available${NC}"
    
    # Create photorec output directory
    PHOTOREC_OUTPUT="$RECOVERY_DIR/photorec"
    mkdir -p "$PHOTOREC_OUTPUT"
    
    echo "   ⚠️  WARNING: photorec will scan the entire partition"
    echo "   This may take a long time and could recover many files"
    echo "   Recovered files will be in: $PHOTOREC_OUTPUT"
    echo ""
    read -p "   Do you want to proceed with photorec recovery? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   Starting photorec recovery..."
        echo "   Note: This is an interactive process"
        echo "   Instructions:"
        echo "   1. Select 'Proceed'"
        echo "   2. Select 'File Opt'"
        echo "   3. Select 'Audio' -> 'mp3, m4a, wav, webm'"
        echo "   4. Select 'Free' (for unallocated space)"
        echo "   5. Set output directory to: $PHOTOREC_OUTPUT"
        echo ""
        read -p "   Press Enter to start photorec..."
        
        # Run photorec in non-interactive mode if possible
        # Note: photorec doesn't have great CLI support, so we'll use foremost instead
        echo "   Using foremost instead (better for automated recovery)..."
    else
        echo "   Skipping photorec recovery"
    fi
else
    echo -e "${RED}   ❌ photorec not available${NC}"
fi

echo ""

# Method 3: Use foremost for file carving
echo -e "${YELLOW}3️⃣ Attempting recovery with foremost (file carving)...${NC}"

if ! command -v foremost &> /dev/null; then
    echo -e "${YELLOW}   Installing foremost...${NC}"
    apt-get install -y foremost > /dev/null 2>&1
fi

if command -v foremost &> /dev/null; then
    echo -e "${GREEN}   ✅ foremost is available${NC}"
    
    FOREmost_OUTPUT="$RECOVERY_DIR/foremost"
    mkdir -p "$FOREmost_OUTPUT"
    
    # Create foremost config for audio files
    FOREmost_CONFIG="/tmp/foremost-audio.conf"
    cat > "$FOREmost_CONFIG" << 'EOF'
# Foremost configuration for audio files
m4a     y   20000000   \\.m4a
wav     y   20000000   \\.wav
webm    y   20000000   \\.webm
mp3     y   20000000   \\.mp3
aac     y   20000000   \\.aac
EOF
    
    echo "   Starting foremost recovery..."
    echo "   This will scan $DEVICE for audio files"
    echo "   Output directory: $FOREmost_OUTPUT"
    echo ""
    
    # Run foremost
    if foremost -t m4a,wav,webm,mp3,aac -i "$DEVICE" -o "$FOREmost_OUTPUT" -c "$FOREmost_CONFIG" 2>&1 | tee "$RECOVERY_DIR/foremost.log"; then
        echo -e "${GREEN}   ✅ Foremost recovery completed!${NC}"
        echo "   Recovered files: $(find $FOREmost_OUTPUT -type f | wc -l)"
    else
        echo -e "${RED}   ❌ Foremost recovery failed${NC}"
    fi
else
    echo -e "${RED}   ❌ foremost not available${NC}"
fi

echo ""

# Method 4: Use scalpel for file carving
echo -e "${YELLOW}4️⃣ Attempting recovery with scalpel (file carving)...${NC}"

if ! command -v scalpel &> /dev/null; then
    echo -e "${YELLOW}   Installing scalpel...${NC}"
    apt-get install -y scalpel > /dev/null 2>&1
fi

if command -v scalpel &> /dev/null; then
    echo -e "${GREEN}   ✅ scalpel is available${NC}"
    
    SCALPEL_OUTPUT="$RECOVERY_DIR/scalpel"
    mkdir -p "$SCALPEL_OUTPUT"
    
    # Create scalpel config
    SCALPEL_CONFIG="/tmp/scalpel-audio.conf"
    cat > "$SCALPEL_CONFIG" << 'EOF'
# Scalpel configuration for audio files
m4a     y   20000000   \\.m4a
wav     y   20000000   \\.wav
webm    y   20000000   \\.webm
mp3     y   20000000   \\.mp3
aac     y   20000000   \\.aac
EOF
    
    echo "   Starting scalpel recovery..."
    echo "   This will scan $DEVICE for audio files"
    echo "   Output directory: $SCALPEL_OUTPUT"
    echo ""
    
    # Run scalpel
    if scalpel -c "$SCALPEL_CONFIG" -o "$SCALPEL_OUTPUT" "$DEVICE" 2>&1 | tee "$RECOVERY_DIR/scalpel.log"; then
        echo -e "${GREEN}   ✅ Scalpel recovery completed!${NC}"
        echo "   Recovered files: $(find $SCALPEL_OUTPUT -type f 2>/dev/null | wc -l)"
    else
        echo -e "${RED}   ❌ Scalpel recovery failed${NC}"
    fi
else
    echo -e "${RED}   ❌ scalpel not available${NC}"
fi

echo ""

# Method 5: Check for files in /tmp or other temp directories
echo -e "${YELLOW}5️⃣ Checking temporary directories...${NC}"
TEMP_DIRS=("/tmp" "/var/tmp" "/root/tmp" "/home/azureuser/tmp")
FOUND_IN_TEMP=0

for temp_dir in "${TEMP_DIRS[@]}"; do
    if [ -d "$temp_dir" ]; then
        echo "   Checking $temp_dir..."
        # Look for files matching our pattern
        find "$temp_dir" -name "interview_*.m4a" -o -name "interview_*.wav" -o -name "interview_*.webm" 2>/dev/null | while read file; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                dest="$AUDIO_DIR/$filename"
                cp "$file" "$dest" 2>/dev/null && {
                    echo -e "${GREEN}   ✅ Recovered: $filename${NC}"
                    ((FOUND_IN_TEMP++))
                }
            fi
        done
    fi
done

if [ $FOUND_IN_TEMP -eq 0 ]; then
    echo "   No files found in temporary directories"
fi

echo ""

# Method 6: Check for inode information (if filesystem supports it)
echo -e "${YELLOW}6️⃣ Checking filesystem for recoverable inodes...${NC}"
echo "   This requires debugfs (ext2/3/4 filesystems only)"

if command -v debugfs &> /dev/null; then
    FSTYPE=$(blkid -o value -s TYPE "$DEVICE")
    if [ "$FSTYPE" = "ext4" ] || [ "$FSTYPE" = "ext3" ] || [ "$FSTYPE" = "ext2" ]; then
        echo "   Filesystem type: $FSTYPE"
        echo "   Attempting to list deleted inodes..."
        
        # Try to list deleted files
        DEBUGFS_OUTPUT="$RECOVERY_DIR/debugfs-deleted.txt"
        echo "lsdel" | debugfs "$DEVICE" 2>/dev/null > "$DEBUGFS_OUTPUT" || true
        
        if [ -s "$DEBUGFS_OUTPUT" ]; then
            echo "   Found deleted inodes information in: $DEBUGFS_OUTPUT"
            DELETED_COUNT=$(grep -c "Deleted inode" "$DEBUGFS_OUTPUT" 2>/dev/null || echo "0")
            echo "   Deleted inodes found: $DELETED_COUNT"
        else
            echo "   No deleted inode information available"
        fi
    else
        echo "   Filesystem type ($FSTYPE) doesn't support debugfs recovery"
    fi
else
    echo "   debugfs not available"
fi

echo ""

# Summary and next steps
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}📊 RECOVERY SUMMARY${NC}"
echo -e "${BLUE}================================${NC}\n"

echo "Recovery output directories:"
echo "  - Foremost: $RECOVERY_DIR/foremost"
echo "  - Scalpel: $RECOVERY_DIR/scalpel"
echo "  - Photorec: $RECOVERY_DIR/photorec"
echo ""

echo "Next steps:"
echo "1. Review recovered files in: $RECOVERY_DIR"
echo "2. Match recovered files with missing files list: $MISSING_FILES_JSON"
echo "3. Use the matching script to identify and copy matching files"
echo ""

# Create a matching script
MATCHING_SCRIPT="$RECOVERY_DIR/match-and-copy.sh"
cat > "$MATCHING_SCRIPT" << 'MATCHSCRIPT'
#!/bin/bash
# Script to match recovered files with missing files and copy them

RECOVERY_DIR="/var/www/opine/recovered-audio"
AUDIO_DIR="/var/www/opine/uploads/audio"
MISSING_FILES_JSON="/var/www/opine/missing-audio-files.json"

echo "🔍 Matching recovered files with missing files..."

# Read missing files JSON
if [ ! -f "$MISSING_FILES_JSON" ]; then
    echo "❌ Missing files JSON not found: $MISSING_FILES_JSON"
    exit 1
fi

# Find all recovered audio files
find "$RECOVERY_DIR" -type f \( -name "*.m4a" -o -name "*.wav" -o -name "*.webm" -o -name "*.mp3" \) | while read recovered_file; do
    filename=$(basename "$recovered_file")
    
    # Check if this filename matches any missing file
    if grep -q "\"filename\": \"$filename\"" "$MISSING_FILES_JSON"; then
        dest="$AUDIO_DIR/$filename"
        if [ ! -f "$dest" ]; then
            cp "$recovered_file" "$dest"
            echo "✅ Matched and copied: $filename"
        else
            echo "⚠️  File already exists: $filename"
        fi
    fi
done

echo ""
echo "✅ Matching completed!"
MATCHSCRIPT

chmod +x "$MATCHING_SCRIPT"
echo -e "${GREEN}✅ Created matching script: $MATCHING_SCRIPT${NC}"
echo "   Run it with: bash $MATCHING_SCRIPT"
echo ""

echo -e "${GREEN}✅ Recovery script completed!${NC}"





