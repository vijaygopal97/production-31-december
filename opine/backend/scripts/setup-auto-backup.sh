#!/bin/bash
# Setup Auto-Backup Git Repository
# Creates Convergent-AutoBackup repository and sets up auto-commit

set -e

REPO_PATH="/var/www/opine"
GIT_REPO_NAME="Convergent-AutoBackup"
SERVICE_NAME="auto-git-watcher"
WATCHER_SCRIPT="/var/www/opine/backend/scripts/auto-git-watcher.sh"
COMMIT_SCRIPT="/var/www/opine/backend/scripts/auto-git-commit.sh"
SYSTEMD_SERVICE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 SETTING UP AUTO-BACKUP GIT REPOSITORY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Install inotify-tools if not installed
echo "📦 Step 1: Installing dependencies..."
if ! command -v inotifywait &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y inotify-tools
    echo "✅ inotify-tools installed"
else
    echo "✅ inotify-tools already installed"
fi
echo ""

# Initialize git repository
echo "📦 Step 2: Initializing Git repository..."
cd "$REPO_PATH"

if [ ! -d ".git" ]; then
    git init
    git config user.name "Auto Backup System"
    git config user.email "autobackup@convergent.local"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Environment files (sensitive - don't commit)
.env
.env.*
*.env

# Logs
*.log
logs/
npm-debug.log*

# Uploads and user-generated content
uploads/
temp/
tmp/

# Generated files
generated-csvs/
dist/
build/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Database backups
database_backups/
temp_prod_dump/

# PM2
.pm2/
EOF
    echo "✅ .gitignore created"
else
    echo "✅ .gitignore already exists"
fi

# Make scripts executable
chmod +x "$WATCHER_SCRIPT"
chmod +x "$COMMIT_SCRIPT"
echo "✅ Scripts are executable"
echo ""

# Create initial commit
echo "💾 Step 3: Creating initial commit..."
git add -A
if ! git diff --cached --quiet || [ -z "$(git log --oneline -1 2>/dev/null)" ]; then
    git commit -m "Initial auto-backup commit: $(date '+%Y-%m-%d %H:%M:%S')" || true
    echo "✅ Initial commit created"
else
    echo "✅ Repository already has commits"
fi
echo ""

# Create systemd service
echo "⚙️  Step 4: Creating systemd service..."
sudo tee "$SYSTEMD_SERVICE" > /dev/null << EOF
[Unit]
Description=Auto Git Backup Watcher - Automatically commits code changes
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$REPO_PATH
ExecStart=$WATCHER_SCRIPT
Restart=always
RestartSec=10
StandardOutput=append:/var/log/auto-git-watcher.log
StandardError=append:/var/log/auto-git-watcher.log

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Systemd service created"
echo ""

# Enable and start service
echo "🚀 Step 5: Starting auto-backup service..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

sleep 2

# Check if service is running
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Auto-backup service is running"
else
    echo "⚠️  Service may not be running, check logs: sudo journalctl -u $SERVICE_NAME"
fi
echo ""

# Display status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AUTO-BACKUP SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Status:"
sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -10
echo ""
echo "📝 Logs:"
echo "   Watcher: sudo journalctl -u $SERVICE_NAME -f"
echo "   Commits: tail -f /var/log/auto-git-commit.log"
echo ""
echo "🎯 What happens now:"
echo "   - Any file changes in $REPO_PATH will be auto-committed"
echo "   - Changes are batched (30-second delay) to reduce commits"
echo "   - All commits are logged to /var/log/auto-git-commit.log"
echo ""
echo "🔧 Management:"
echo "   Start:   sudo systemctl start $SERVICE_NAME"
echo "   Stop:    sudo systemctl stop $SERVICE_NAME"
echo "   Restart: sudo systemctl restart $SERVICE_NAME"
echo "   Status:  sudo systemctl status $SERVICE_NAME"
echo ""
echo "🔗 GitHub Setup (Optional):"
echo "   1. Create repository '$GIT_REPO_NAME' on GitHub"
echo "   2. Run: cd $REPO_PATH && git remote add origin https://github.com/YOUR-ORG/$GIT_REPO_NAME.git"
echo "   3. Run: git push -u origin main"
echo "   4. Update auto-git-commit.sh with your GitHub URL"
echo ""






