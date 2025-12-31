#!/bin/bash

# Script to sync backend route changes to remote server
# Syncs the skip-review route and controller changes

set -e  # Exit on error

REMOTE_SERVER="ubuntu@13.233.231.180"
REMOTE_PATH="/var/www/opine"
LOCAL_BACKEND="/var/www/opine/backend"

echo "🔄 Syncing backend route files to remote server..."
echo "📍 Remote server: $REMOTE_SERVER"
echo ""

# Files to sync
FILES=(
    "routes/surveyResponseRoutes.js"
    "controllers/surveyResponseController.js"
)

# Sync each file
for file in "${FILES[@]}"; do
    local_file="$LOCAL_BACKEND/$file"
    remote_file="$REMOTE_SERVER:$REMOTE_PATH/backend/$file"
    
    if [ -f "$local_file" ]; then
        echo "📤 Syncing $file..."
        scp "$local_file" "$remote_file"
        echo "✅ Synced $file"
    else
        echo "❌ Error: Local file not found: $local_file"
        exit 1
    fi
done

echo ""
echo "🔄 Restarting backend on remote server..."
ssh $REMOTE_SERVER "cd $REMOTE_PATH && pm2 restart opine-backend"

echo ""
echo "✅ Sync complete! Backend restarted on remote server."
echo "🔍 The skip-review route should now be available on the remote server."


