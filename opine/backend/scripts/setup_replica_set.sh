#!/bin/bash
# MongoDB Replica Set Setup Script
# This script sets up a MongoDB replica set with two servers

set -e  # Exit on error

PRIMARY_SERVER="13.202.181.167"
SECONDARY_SERVER="3.109.82.159"
PRIMARY_PRIVATE_IP="172.31.43.71"
SECONDARY_PRIVATE_IP="172.31.47.152"
MONGO_USER="opine_user"
MONGO_PASS="OpineApp2024Secure"
MONGO_ADMIN_DB="admin"
REPLICA_SET_NAME="rs0"

echo "🚀 Starting MongoDB Replica Set Setup..."

# Step 1: Initialize replica set on primary server
echo ""
echo "📝 Step 1: Initializing replica set on primary server..."
mongosh --eval "
  try {
    rs.status();
    print('✅ Replica set already initialized');
  } catch(e) {
    print('📝 Initializing replica set...');
    rs.initiate({
      _id: '${REPLICA_SET_NAME}',
      members: [
        { _id: 0, host: '${PRIMARY_PRIVATE_IP}:27017', priority: 2 },
        { _id: 1, host: '${SECONDARY_PRIVATE_IP}:27017', priority: 1 }
      ]
    });
    print('✅ Replica set initialized successfully');
  }
" --username ${MONGO_USER} --password ${MONGO_PASS} --authenticationDatabase ${MONGO_ADMIN_DB}

echo ""
echo "⏳ Waiting for replica set to stabilize (10 seconds)..."
sleep 10

# Step 2: Check replica set status
echo ""
echo "📊 Step 2: Checking replica set status..."
mongosh --eval "
  const status = rs.status();
  print('Replica Set Status:');
  print('Name: ' + status.set);
  print('Members:');
  status.members.forEach(function(member) {
    print('  - ' + member.name + ': ' + member.stateStr + ' (priority: ' + (member.priority || 0) + ')');
  });
" --username ${MONGO_USER} --password ${MONGO_PASS} --authenticationDatabase ${MONGO_ADMIN_DB}

echo ""
echo "✅ MongoDB Replica Set Setup Complete!"
echo ""
echo "Connection String:"
echo "mongodb://${MONGO_USER}:${MONGO_PASS}@${PRIMARY_PRIVATE_IP}:27017,${SECONDARY_PRIVATE_IP}:27017/Opine?authSource=admin&replicaSet=${REPLICA_SET_NAME}"






