#!/bin/bash
# Complete cleanup of all recovery folders - Run with sudo

RECOVERY_OUTPUT="/var/www/opine/recovery-output"
PROJECT_DIR="/var/www/opine"

echo "🧹 Complete Recovery Cleanup"
echo "============================"
echo ""

# Create recovery output directory
mkdir -p "$RECOVERY_OUTPUT"

# Move all photorec folders
echo "Moving photorec recovery folders..."
find "$PROJECT_DIR" -maxdepth 1 -type d -name "recovered-audio-photorec.*" -exec mv {} "$RECOVERY_OUTPUT/" \; 2>/dev/null
PHOTOREC_COUNT=$(find "$RECOVERY_OUTPUT" -maxdepth 1 -type d -name "recovered-audio-photorec.*" 2>/dev/null | wc -l)
echo "   ✅ Moved $PHOTOREC_COUNT photorec folders"

# Move all recup_dir folders
echo "Moving recup_dir folders..."
find "$PROJECT_DIR" -maxdepth 1 -type d -name "recup_dir.*" -exec mv {} "$RECOVERY_OUTPUT/" \; 2>/dev/null
RECUP_COUNT=$(find "$RECOVERY_OUTPUT" -maxdepth 1 -type d -name "recup_dir.*" 2>/dev/null | wc -l)
echo "   ✅ Moved $RECUP_COUNT recup_dir folders"

# Move other recovery folders
echo "Moving other recovery folders..."
for folder in recovered-audio recovered-audio-deep recovered-audio-live recovered-audio-photorec; do
    if [ -d "$PROJECT_DIR/$folder" ]; then
        mv "$PROJECT_DIR/$folder" "$RECOVERY_OUTPUT/" 2>/dev/null && echo "   ✅ Moved $folder"
    fi
done

# Move stray recovery files
echo "Moving stray recovery files..."
find "$PROJECT_DIR" -maxdepth 1 -type f -name "f*.txt" -exec mv {} "$RECOVERY_OUTPUT/" \; 2>/dev/null

# Fix permissions
echo "Fixing permissions..."
chown -R azureuser:azureuser "$RECOVERY_OUTPUT" 2>/dev/null

# Summary
TOTAL=$(find "$RECOVERY_OUTPUT" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)
REMAINING=$(find "$PROJECT_DIR" -maxdepth 1 -type d \( -name "recovered-*" -o -name "recup_dir.*" \) 2>/dev/null | wc -l)

echo ""
echo "✅ Cleanup completed!"
echo "📁 All recovery folders moved to: $RECOVERY_OUTPUT"
echo "📊 Total items in recovery-output: $TOTAL"
echo "📊 Remaining recovery folders in project: $REMAINING"
echo ""
echo "To delete all recovery data:"
echo "   sudo rm -rf $RECOVERY_OUTPUT/*"




