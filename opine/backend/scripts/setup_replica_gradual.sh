#!/bin/bash
# Gradual MongoDB Replica Set Setup (Zero Downtime)
# This script sets up MongoDB replica set using initial sync

set -e

PRIMARY_IP="172.31.43.71"
SECONDARY_IP="172.31.47.152"
REPLICA_SET_NAME="rs0"
MONGO_USER="opine_user"
MONGO_PASS="OpineApp2024Secure"

echo "🚀 Starting Gradual MongoDB Replica Set Setup (Zero Downtime)..."

# Step 1: Ensure primary is ready (with current data)
echo ""
echo "📝 Step 1: Checking primary server status..."
mongosh "mongodb://${MONGO_USER}:${MONGO_PASS}@${PRIMARY_IP}:27017/admin?authSource=admin" --eval "
  const stats = db.stats();
  print('✅ Primary MongoDB is ready');
  print('Database: Opine');
  print('Collections: ' + stats.collections);
  print('Data Size: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB');
" --quiet

echo ""
echo "✅ Step 1 Complete: Primary server verified"
echo ""
echo "📝 Step 2: Reconfiguring primary for replica set..."
echo "   - Adding replica set configuration"
echo "   - MongoDB will continue serving requests during this process"

# The replica set config file is already in place, we just need to initialize
# But we'll do this carefully to avoid downtime

echo ""
echo "⏳ Next steps will be done manually to ensure zero downtime..."
echo "   1. Initialize replica set on primary (creates PRIMARY member)"
echo "   2. Add secondary server (will perform initial sync automatically)"
echo "   3. Verify replication is working"
echo ""
echo "✅ Setup script ready. Proceeding with initialization..."






