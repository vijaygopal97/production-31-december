#!/bin/bash
# Proper MongoDB Replica Set Setup with Initial Sync
# This uses MongoDB's built-in initial sync (safest method)

set -e

PRIMARY_IP="172.31.43.71"
SECONDARY_IP="172.31.47.152"
REPLICA_SET_NAME="rs0"
MONGO_USER="opine_user"
MONGO_PASS="OpineApp2024Secure"

echo "🚀 Setting up MongoDB Replica Set with Initial Sync..."
echo ""
echo "📋 Steps:"
echo "  1. Initialize replica set on primary (becomes PRIMARY)"
echo "  2. Add secondary server (MongoDB automatically syncs all data)"
echo "  3. Wait for initial sync to complete"
echo "  4. Verify replication is working"
echo ""

# Step 1: Add replica set config to primary
echo "📝 Step 1: Configuring primary server..."
sudo sed -i '/^#network interfaces/a replication:\n  replSetName: rs0' /etc/mongod.conf || \
sudo bash -c 'echo "replication:" >> /etc/mongod.conf && echo "  replSetName: rs0" >> /etc/mongod.conf'

# Step 2: Restart primary with replica set config
echo "🔄 Restarting primary MongoDB..."
sudo systemctl restart mongod
sleep 5

# Step 3: Initialize replica set (only PRIMARY member initially)
echo "📝 Step 2: Initializing replica set..."
mongosh "mongodb://${MONGO_USER}:${MONGO_PASS}@${PRIMARY_IP}:27017/admin?authSource=admin" --eval "
  try {
    rs.status();
    print('✅ Replica set already initialized');
  } catch(e) {
    rs.initiate({
      _id: '${REPLICA_SET_NAME}',
      members: [
        { _id: 0, host: '${PRIMARY_IP}:27017', priority: 2 }
      ]
    });
    print('✅ Replica set initialized with PRIMARY');
  }
" --quiet

# Wait for PRIMARY to be ready
echo "⏳ Waiting for PRIMARY to be ready..."
sleep 10

# Step 4: Configure secondary server
echo "📝 Step 3: Configuring secondary server..."
ssh -i /var/www/MyLogos/Convergent-New.pem -o StrictHostKeyChecking=no ubuntu@3.109.82.159 "
  sudo bash -c 'echo \"replication:\" >> /etc/mongod.conf && echo \"  replSetName: rs0\" >> /etc/mongod.conf'
  sudo systemctl restart mongod
  sleep 5
  echo '✅ Secondary MongoDB configured'
"

# Step 5: Add secondary to replica set (triggers initial sync)
echo "📝 Step 4: Adding secondary to replica set (initial sync will start automatically)..."
mongosh "mongodb://${MONGO_USER}:${MONGO_PASS}@${PRIMARY_IP}:27017/admin?authSource=admin" --eval "
  rs.add({
    host: '${SECONDARY_IP}:27017',
    priority: 1
  });
  print('✅ Secondary added - Initial sync in progress...');
" --quiet

echo ""
echo "✅ Setup initiated!"
echo "📥 MongoDB is now syncing all data from primary to secondary"
echo "⏳ This may take 10-30 minutes depending on data size (4GB)"
echo ""
echo "Monitor progress with: mongosh 'mongodb://${MONGO_USER}:${MONGO_PASS}@${PRIMARY_IP}:27017/admin?authSource=admin' --eval \"rs.status()\""






