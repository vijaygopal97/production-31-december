#!/bin/bash
# Cleanup script to move all recovery folders to a dedicated location

RECOVERY_OUTPUT="/var/www/opine/recovery-output"
PROJECT_DIR="/var/www/opine"

echo "🧹 Cleaning up recovery folders..."
echo ""

# Create recovery output directory
mkdir -p "$RECOVERY_OUTPUT"

# Move all photorec recovery folders
echo "Moving photorec recovery folders..."
find "$PROJECT_DIR" -maxdepth 1 -type d -name "recovered-audio-photorec.*" -exec mv {} "$RECOVERY_OUTPUT/" \; 2>/dev/null
PHOTOREC_COUNT=$(find "$RECOVERY_OUTPUT" -maxdepth 1 -type d -name "recovered-audio-photorec.*" 2>/dev/null | wc -l)
echo "   Moved $PHOTOREC_COUNT photorec folders"

# Move all recup_dir folders (photorec output)
echo "Moving recup_dir folders..."
find "$PROJECT_DIR" -maxdepth 1 -type d -name "recup_dir.*" -exec mv {} "$RECOVERY_OUTPUT/" \; 2>/dev/null
RECUP_COUNT=$(find "$RECOVERY_OUTPUT" -maxdepth 1 -type d -name "recup_dir.*" 2>/dev/null | wc -l)
echo "   Moved $RECUP_COUNT recup_dir folders"

# Move any other recovery-related folders
echo "Moving other recovery folders..."
find "$PROJECT_DIR" -maxdepth 1 -type d \( -name "recovered-audio*" -o -name "recovery-*" \) ! -name "recovery-output" -exec mv {} "$RECOVERY_OUTPUT/" \; 2>/dev/null

# Clean up any stray recovery files in root
echo "Cleaning up stray recovery files..."
find "$PROJECT_DIR" -maxdepth 1 -type f -name "*.txt" -path "*/f*.txt" -exec mv {} "$RECOVERY_OUTPUT/" \; 2>/dev/null

# Summary
TOTAL=$(find "$RECOVERY_OUTPUT" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)
echo ""
echo "✅ Cleanup completed!"
echo "📁 All recovery folders moved to: $RECOVERY_OUTPUT"
echo "📊 Total items moved: $TOTAL"
echo ""
echo "To delete all recovery data later:"
echo "   rm -rf $RECOVERY_OUTPUT/*"




