#!/bin/bash
# Interactive Photorec Recovery - Most Powerful Method
# This guides you through photorec which has the best recovery rate

RECOVERY_DIR="/var/www/opine/recovered-audio-photorec"
DEVICE="/dev/sda1"

echo "🎯 PHOTOREC INTERACTIVE RECOVERY"
echo "================================="
echo ""
echo "Photorec is the MOST POWERFUL recovery tool available."
echo "It can recover files even after they've been deleted for a long time."
echo ""
echo "Instructions:"
echo "1. Select: [Proceed]"
echo "2. Select your disk: [Intel/PC partition]"
echo "3. Select partition: [Linux] (usually the first one)"
echo "4. Select: [File Opt] (not Partition)"
echo "5. Navigate to: [Audio] -> [mp3, m4a, wav, webm]"
echo "6. Select: [Free] (for unallocated space)"
echo "7. Select: [Search]"
echo "8. Wait for scan to complete (this takes time!)"
echo ""
echo "Output directory: $RECOVERY_DIR"
echo ""
read -p "Press Enter to start photorec..."

mkdir -p "$RECOVERY_DIR"
cd "$RECOVERY_DIR"

photorec /log /d "$RECOVERY_DIR" "$DEVICE"

echo ""
echo "✅ Photorec completed!"
echo "📁 Recovered files are in: $RECOVERY_DIR/"




