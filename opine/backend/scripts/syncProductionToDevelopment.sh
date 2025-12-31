#!/bin/bash
set -e

PROD_URI="mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine"
# Development database - if on same server, use same host; if local, use localhost
# Option 1: Development on same server as production (different database name)
DEV_URI="${1:-mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine}"
DB_NAME="Opine"
DUMP_DIR="/tmp/mongodb_sync_$(date +%Y%m%d_%H%M%S)"

echo "============================================================"
echo "🔄 SYNCING PRODUCTION DATABASE TO DEVELOPMENT"
echo "============================================================"
echo ""
echo "Production: ${PROD_URI//:[^:@]*@/:****@}"
echo "Development: ${DEV_URI//:[^:@]*@/:****@}"
echo ""
echo "⚠️  WARNING: This will DELETE all data in development!"
echo ""
read -p "Continue? (yes/no): " confirm
[ "$confirm" != "yes" ] && echo "Cancelled" && exit 1

# Test connections
echo "🔍 Testing connections..."
if mongo "$PROD_URI" --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ Production connection OK"
else
    echo "❌ Production connection failed"
    exit 1
fi

if mongo "$DEV_URI" --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ Development connection OK"
else
    echo "❌ Development connection failed"
    echo "   Please check the development database URI"
    exit 1
fi
echo ""

mkdir -p "$DUMP_DIR"
echo "📥 Dumping PRODUCTION..."
mongodump --uri="$PROD_URI" --out="$DUMP_DIR"
echo "✅ Dump complete"
echo "📤 Restoring to DEVELOPMENT..."
mongorestore --uri="$DEV_URI" --drop "$DUMP_DIR/$DB_NAME"
echo "✅ Restore complete"
echo "🧹 Cleaning up..."
rm -rf "$DUMP_DIR"
echo "✅ Sync completed!"



