#!/bin/bash
# Fixed Photorec Recovery - Outputs to dedicated folder
# This ensures all recovery output goes to recovery-output folder

RECOVERY_OUTPUT="/var/www/opine/recovery-output/photorec-output"
DEVICE="/dev/sda1"
LOG_DIR="/var/www/opine/recovery-logs"

mkdir -p "$RECOVERY_OUTPUT" "$LOG_DIR"
# Ensure recovery-output exists
mkdir -p "/var/www/opine/recovery-output"

echo "🎯 PHOTOREC RECOVERY (Fixed Output Location)"
echo "==========================================="
echo ""
echo "✅ All recovery output will go to: $RECOVERY_OUTPUT"
echo "   This keeps your project directory clean!"
echo ""
echo "Starting photorec..."
echo ""
echo "IMPORTANT: When photorec asks for output directory:"
echo "1. Press [C] to choose directory"
echo "2. Type: $RECOVERY_OUTPUT"
echo "3. Press [Enter]"
echo "4. Press [C] to confirm"
echo ""
read -p "Press Enter to start photorec..."

cd "$RECOVERY_OUTPUT"
photorec /log /d "$RECOVERY_OUTPUT" "$DEVICE" 2>&1 | tee "$LOG_DIR/photorec.log"

echo ""
echo "✅ Photorec completed!"
echo "📁 All recovered files are in: $RECOVERY_OUTPUT"
echo ""
echo "Next step: Run matching script"
echo "   node /var/www/opine/backend/scripts/match-recovered-files.js"

