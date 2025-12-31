#!/bin/bash
# Automated Photorec Recovery - Most Powerful Method
# This attempts to automate photorec as much as possible

RECOVERY_DIR="/var/www/opine/recovered-audio-photorec"
DEVICE="/dev/sda1"
LOG_DIR="/var/www/opine/recovery-logs"

mkdir -p "$RECOVERY_DIR" "$LOG_DIR"

echo "🎯 PHOTOREC AUTOMATED RECOVERY"
echo "=============================="
echo ""
echo "Photorec is the MOST POWERFUL recovery tool."
echo "It can recover files even after months/years if space wasn't overwritten."
echo ""
echo "Starting photorec in interactive mode..."
echo "Follow these steps:"
echo ""
echo "1. Press [Enter] to proceed"
echo "2. Select: [Intel/PC partition]"
echo "3. Select partition (usually first Linux partition)"
echo "4. Select: [File Opt] (NOT Partition Opt)"
echo "5. Navigate: [Audio] -> [mp3, m4a, wav, webm]"
echo "6. Select: [Free] (for unallocated space)"
echo "7. Press [C] to choose output directory"
echo "8. Navigate to: $RECOVERY_DIR"
echo "9. Press [C] to confirm"
echo "10. Press [Y] to start search"
echo ""
echo "This will take a LONG time but has the best recovery rate!"
echo ""
read -p "Press Enter to start photorec..."

cd "$RECOVERY_DIR"
photorec /log /d "$RECOVERY_DIR" "$DEVICE" 2>&1 | tee "$LOG_DIR/photorec.log"

echo ""
echo "✅ Photorec completed!"
echo "📁 Check recovered files in: $RECOVERY_DIR/"




