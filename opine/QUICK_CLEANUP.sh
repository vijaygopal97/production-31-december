#!/bin/bash
# Quick cleanup - Delete duplicate photorec folders
# Run with: sudo bash QUICK_CLEANUP.sh

cd /var/www/opine

echo "🧹 Quick Cleanup - Deleting duplicate photorec folders..."
echo ""

# Delete folders that already exist in recovery-output
for dir in recovered-audio-photorec.*; do
    if [ -d "$dir" ] && [ -d "recovery-output/$dir" ]; then
        echo "Deleting duplicate: $dir"
        rm -rf "$dir"
    fi
done

# Move any new folders that don't exist in recovery-output
for dir in recovered-audio-photorec.*; do
    if [ -d "$dir" ] && [ ! -d "recovery-output/$dir" ]; then
        echo "Moving: $dir"
        mv "$dir" recovery-output/ 2>/dev/null || sudo mv "$dir" recovery-output/
    fi
done

# Move recup_dir folders
for dir in recup_dir.*; do
    if [ -d "$dir" ]; then
        echo "Moving: $dir"
        mv "$dir" recovery-output/ 2>/dev/null || sudo mv "$dir" recovery-output/
    fi
done

REMAINING=$(ls -d recovered-audio-photorec.* recup_dir.* 2>/dev/null | wc -l)

echo ""
if [ $REMAINING -eq 0 ]; then
    echo "✅ Cleanup completed! Project directory is clean."
else
    echo "⚠️  Warning: $REMAINING folders still remain"
fi

echo ""
echo "📁 All recovery folders are in: recovery-output/"




