#!/bin/bash
# Sudo cleanup script for photorec folders - handles duplicates
# Run with: sudo bash cleanup-photorec-sudo.sh

RECOVERY_OUTPUT="/var/www/opine/recovery-output"
PROJECT_DIR="/var/www/opine"

echo "🧹 Cleaning up photorec folders (with sudo)..."
echo ""

mkdir -p "$RECOVERY_OUTPUT"

# Move/merge all photorec folders
cd "$PROJECT_DIR"
for dir in recovered-audio-photorec.*; do
    if [ -d "$dir" ]; then
        if [ -d "$RECOVERY_OUTPUT/$dir" ]; then
            echo "Merging $dir (already exists in recovery-output)..."
            rsync -a "$dir/" "$RECOVERY_OUTPUT/$dir/" 2>/dev/null
            rm -rf "$dir"
        else
            echo "Moving $dir..."
            mv "$dir" "$RECOVERY_OUTPUT/"
        fi
    fi
done

# Move recup_dir folders
for dir in recup_dir.*; do
    if [ -d "$dir" ]; then
        echo "Moving $dir..."
        mv "$dir" "$RECOVERY_OUTPUT/" 2>/dev/null
    fi
done

# Fix permissions
chown -R azureuser:azureuser "$RECOVERY_OUTPUT" 2>/dev/null

# Verify
REMAINING=$(find "$PROJECT_DIR" -maxdepth 1 -type d \( -name "recovered-audio-photorec.*" -o -name "recup_dir.*" \) 2>/dev/null | wc -l)

echo ""
if [ $REMAINING -eq 0 ]; then
    echo "✅ Cleanup completed! Project directory is clean."
else
    echo "⚠️  Warning: $REMAINING folders still remain"
fi

echo ""
echo "📁 All recovery folders are in: $RECOVERY_OUTPUT"



