#!/bin/bash
# Quick cleanup script for photorec folders
# Run this whenever photorec creates folders in the project directory

RECOVERY_OUTPUT="/var/www/opine/recovery-output"
PROJECT_DIR="/var/www/opine"

echo "🧹 Cleaning up photorec folders..."
echo ""

# Create recovery output directory if it doesn't exist
mkdir -p "$RECOVERY_OUTPUT"

# Move all photorec folders
echo "Moving photorec recovery folders..."
PHOTOREC_COUNT=$(find "$PROJECT_DIR" -maxdepth 1 -type d -name "recovered-audio-photorec.*" 2>/dev/null | wc -l)
if [ $PHOTOREC_COUNT -gt 0 ]; then
    find "$PROJECT_DIR" -maxdepth 1 -type d -name "recovered-audio-photorec.*" -exec mv {} "$RECOVERY_OUTPUT/" \;
    echo "   ✅ Moved $PHOTOREC_COUNT photorec folders"
else
    echo "   ℹ️  No photorec folders found"
fi

# Move all recup_dir folders
echo "Moving recup_dir folders..."
RECUP_COUNT=$(find "$PROJECT_DIR" -maxdepth 1 -type d -name "recup_dir.*" 2>/dev/null | wc -l)
if [ $RECUP_COUNT -gt 0 ]; then
    find "$PROJECT_DIR" -maxdepth 1 -type d -name "recup_dir.*" -exec mv {} "$RECOVERY_OUTPUT/" \;
    echo "   ✅ Moved $RECUP_COUNT recup_dir folders"
else
    echo "   ℹ️  No recup_dir folders found"
fi

# Fix permissions
chown -R azureuser:azureuser "$RECOVERY_OUTPUT" 2>/dev/null

# Verify cleanup
REMAINING=$(find "$PROJECT_DIR" -maxdepth 1 -type d \( -name "recovered-audio-photorec.*" -o -name "recup_dir.*" \) 2>/dev/null | wc -l)

echo ""
if [ $REMAINING -eq 0 ]; then
    echo "✅ Cleanup completed! Project directory is clean."
else
    echo "⚠️  Warning: $REMAINING folders still remain (may need sudo)"
fi

echo ""
echo "📁 All recovery folders are in: $RECOVERY_OUTPUT"




