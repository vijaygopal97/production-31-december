#!/bin/bash
# Syncs backend code to the new server (65.0.72.91)
NEW_SERVER_IP="65.0.72.91"
SOURCE_DIR="/var/www/opine/backend/"
DEST_DIR="/var/www/opine/backend/"
EXCLUDE_FILE="--exclude-from=/var/www/opine/backend/scripts/rsync-exclude.txt"

echo "Syncing backend code to new server: $NEW_SERVER_IP"
rsync -avz --delete $EXCLUDE_FILE $SOURCE_DIR ubuntu@$NEW_SERVER_IP:$DEST_DIR
echo "Sync complete. Restarting PM2 processes on new server..."
ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@$NEW_SERVER_IP "cd $DEST_DIR && pm2 restart all"
echo "New server restarted."
