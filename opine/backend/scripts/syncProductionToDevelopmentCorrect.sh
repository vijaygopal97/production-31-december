#!/bin/bash

# SYNC PRODUCTION TO DEVELOPMENT DATABASE
# 
# Production: 13.202.181.167 (production server)
# Development: 74.225.250.243 (development server - user specified)

set -e

# Production database (from production server)
PROD_URI="mongodb://opine_user:OpineApp2024Secure@13.202.181.167:27017/Opine?authSource=admin"

# Development database (user specified)
DEV_URI="mongodb://opine_user:OpineApp2024Secure@74.225.250.243:27017/Opine?authSource=Opine"

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
[ "$confirm" != "yes" ] && echo "❌ Cancelled" && exit 1

# Step 1: Dump production
echo ""
echo "📥 Step 1: Dumping PRODUCTION database..."
echo "   This may take several minutes..."
mkdir -p "$DUMP_DIR"

if mongodump --uri="$PROD_URI" --out="$DUMP_DIR" 2>&1 | tee /tmp/mongodump.log; then
    DUMP_SIZE=$(du -sh "$DUMP_DIR" | cut -f1)
    echo ""
    echo "✅ Dump complete! Size: $DUMP_SIZE"
else
    echo "❌ Dump failed!"
    rm -rf "$DUMP_DIR"
    exit 1
fi

# Step 2: Restore to development
echo ""
echo "📤 Step 2: Restoring to DEVELOPMENT database..."
echo "   This will drop all existing collections and restore from production..."
echo "   This may take several minutes..."

if mongorestore --uri="$DEV_URI" --drop "$DUMP_DIR/$DB_NAME" 2>&1 | tee /tmp/mongorestore.log; then
    echo ""
    echo "✅ Restore complete!"
else
    echo "❌ Restore failed!"
    echo "⚠️  Dump files are still available at: $DUMP_DIR"
    exit 1
fi

# Step 3: Verify
echo ""
echo "🔍 Step 3: Verifying sync..."

# Use mongosh or mongo to count collections
PROD_COUNT=$(mongosh "$PROD_URI" --quiet --eval "db.surveyresponses.countDocuments()" 2>/dev/null || echo "0")
DEV_COUNT=$(mongosh "$DEV_URI" --quiet --eval "db.surveyresponses.countDocuments()" 2>/dev/null || echo "0")

echo "   Production surveyresponses: $PROD_COUNT"
echo "   Development surveyresponses: $DEV_COUNT"

if [ "$PROD_COUNT" = "$DEV_COUNT" ]; then
    echo "   ✅ Count matches!"
else
    echo "   ⚠️  Count mismatch"
fi

# Cleanup
echo ""
read -p "Delete dump files? (yes/no): " cleanup
if [ "$cleanup" = "yes" ]; then
    rm -rf "$DUMP_DIR"
    echo "✅ Dump files deleted"
else
    echo "ℹ️  Dump files kept at: $DUMP_DIR"
fi

echo ""
echo "============================================================"
echo "✅ SYNC COMPLETED!"
echo "============================================================"



