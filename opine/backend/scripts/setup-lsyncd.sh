#!/bin/bash
# Setup script for lsyncd automatic code sync
# This configures one-way sync from PRIMARY to SECONDARY

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 SETTING UP LSYNCD AUTOMATIC CODE SYNC"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running on PRIMARY server
PRIMARY_IP="172.31.43.71"
CURRENT_IP=$(hostname -I | awk '{print $1}')

if [ "$CURRENT_IP" != "$PRIMARY_IP" ]; then
    echo "⚠️  WARNING: This script should run on PRIMARY server only!"
    echo "   Current IP: $CURRENT_IP"
    echo "   Expected IP: $PRIMARY_IP"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Running on PRIMARY server"
echo ""

# Install lsyncd if not installed
echo "📦 Step 1: Installing lsyncd..."
if ! command -v lsyncd &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y lsyncd
    echo "✅ lsyncd installed"
else
    echo "✅ lsyncd already installed"
fi
echo ""

# Create log directory
echo "📁 Step 2: Creating log directory..."
sudo mkdir -p /var/log/lsyncd
sudo chown ubuntu:ubuntu /var/log/lsyncd
echo "✅ Log directory created"
echo ""

# Create lsyncd config directory if it doesn't exist
echo "⚙️  Step 3: Configuring lsyncd..."
sudo mkdir -p /etc/lsyncd

# Backup existing config if present
if [ -f /etc/lsyncd/lsyncd.conf.lua ]; then
    sudo cp /etc/lsyncd/lsyncd.conf.lua /etc/lsyncd/lsyncd.conf.lua.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Existing config backed up"
fi

# Copy config file
sudo cp /var/www/opine/backend/scripts/lsyncd.conf.lua /etc/lsyncd/lsyncd.conf.lua
echo "✅ lsyncd config installed"
echo ""

# Setup SSH key permissions
echo "🔐 Step 4: Verifying SSH access..."
SSH_KEY="/var/www/MyLogos/Convergent-New.pem"
SECONDARY_SSH="3.109.82.159"

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ ERROR: SSH key not found at $SSH_KEY"
    exit 1
fi

chmod 600 "$SSH_KEY"
echo "✅ SSH key permissions set"

# Test SSH connection
echo "🔍 Testing SSH connection to secondary server..."
if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@"$SECONDARY_SSH" "echo 'SSH connection successful'" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ ERROR: Cannot connect to secondary server via SSH"
    echo "   Please verify:"
    echo "   - SSH key exists: $SSH_KEY"
    echo "   - Secondary server is accessible: $SECONDARY_SSH"
    echo "   - SSH key is added to authorized_keys on secondary server"
    exit 1
fi
echo ""

# Perform initial sync (one-time full sync)
echo "🔄 Step 5: Performing initial code sync..."
echo "   This will sync all code from PRIMARY to SECONDARY (one-time)..."
read -p "Continue with initial sync? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rsync -avz --delete \
        --exclude='.env*' \
        --exclude='node_modules/' \
        --exclude='logs/' \
        --exclude='uploads/' \
        --exclude='*.log' \
        --exclude='.git/' \
        --exclude='generated-csvs/' \
        -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
        /var/www/opine/backend/ \
        ubuntu@"$SECONDARY_SSH":/var/www/opine/backend/
    echo "✅ Initial sync completed"
else
    echo "⏭️  Initial sync skipped"
fi
echo ""

# Enable and start lsyncd service
echo "🚀 Step 6: Starting lsyncd service..."
sudo systemctl enable lsyncd
sudo systemctl restart lsyncd

sleep 2

# Check if lsyncd is running
if sudo systemctl is-active --quiet lsyncd; then
    echo "✅ lsyncd service is running"
else
    echo "❌ ERROR: lsyncd service failed to start"
    echo "   Check logs: sudo journalctl -u lsyncd -n 50"
    exit 1
fi
echo ""

# Display status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ LSYNCD SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Status:"
sudo systemctl status lsyncd --no-pager -l | head -10
echo ""
echo "📝 Logs:"
echo "   Real-time: sudo tail -f /var/log/lsyncd/lsyncd.log"
echo "   Status: sudo cat /var/log/lsyncd/lsyncd.status"
echo ""
echo "🎯 Usage:"
echo "   - Any file changes in /var/www/opine/backend/ will auto-sync to SECONDARY"
echo "   - PM2 will auto-restart on SECONDARY after sync"
echo "   - Check logs to monitor sync activity"
echo ""
echo "🔧 Management:"
echo "   Start:   sudo systemctl start lsyncd"
echo "   Stop:    sudo systemctl stop lsyncd"
echo "   Restart: sudo systemctl restart lsyncd"
echo "   Status:  sudo systemctl status lsyncd"
echo ""






