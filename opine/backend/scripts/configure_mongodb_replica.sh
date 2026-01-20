#!/bin/bash
# Configure MongoDB for Replica Set on both servers

set -e

PRIMARY_IP="172.31.43.71"
SECONDARY_IP="172.31.47.152"
REPLICA_SET_NAME="rs0"

echo "🔧 Configuring MongoDB for replica set..."

# Create MongoDB config file
sudo tee /etc/mongod.conf > /dev/null <<EOF
# mongod.conf
storage:
  dbPath: /var/lib/mongodb

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 0.0.0.0

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

replication:
  replSetName: ${REPLICA_SET_NAME}

security:
  keyFile: /etc/mongodb-keyfile
  authorization: enabled
EOF

echo "✅ MongoDB configuration updated"
echo "🔄 Restarting MongoDB..."
sudo systemctl restart mongod
sleep 5

# Check MongoDB status
if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB failed to start"
    exit 1
fi

echo "✅ MongoDB replica set configuration complete!"






