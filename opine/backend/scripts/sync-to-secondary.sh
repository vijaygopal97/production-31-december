#!/bin/bash
# Sync backend code to secondary server
# Usage: ./sync-to-secondary.sh

SECONDARY_SERVER="3.109.82.159"
BACKEND_PATH="/var/www/opine/backend"

echo "🔄 Syncing backend code to secondary server ($SECONDARY_SERVER)..."

# Exclude unnecessary files
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '*.log' \
  --exclude '.env' \
  --exclude 'uploads' \
  --exclude 'temp' \
  $BACKEND_PATH/ root@$SECONDARY_SERVER:$BACKEND_PATH/

if [ $? -eq 0 ]; then
  echo "✅ Sync completed successfully!"
  echo "📝 Next step: Restart the secondary server"
  echo "   ssh root@$SECONDARY_SERVER 'cd $BACKEND_PATH && pm2 restart all'"
else
  echo "❌ Sync failed. Please check the connection and try again."
  exit 1
fi







