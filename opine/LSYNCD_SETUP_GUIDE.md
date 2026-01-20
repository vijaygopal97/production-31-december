# 🔄 Automatic Code Sync with lsyncd - Setup Guide

## 📋 Overview

This setup enables **automatic, one-way code sync** from PRIMARY server to SECONDARY server, similar to how MongoDB replica sets work.

**Key Features:**
- ✅ **Real-time sync**: Files sync automatically within seconds of changes
- ✅ **One-way only**: PRIMARY → SECONDARY (SECONDARY cannot overwrite PRIMARY)
- ✅ **Lightweight**: Uses Linux kernel inotify (event-driven, not polling)
- ✅ **Smart exclusions**: Automatically excludes `.env`, `node_modules`, logs, etc.
- ✅ **Auto-restart**: PM2 automatically restarts on SECONDARY after sync

---

## 🤔 Your Questions Answered

### Q1: Will custom changes be synced correctly?
**A: YES** ✅
- lsyncd watches the **filesystem** using Linux kernel `inotify`
- ANY file change triggers sync:
  - Manual edits (vim, nano, etc.)
  - IDE changes (VS Code, etc.)
  - Git operations (pull, merge, etc.)
  - Scripts creating/modifying files
  - File copies, moves, deletions
- **100% reliable** - it's the same mechanism used by file managers and IDEs

### Q2: Will this cause processing overhead or memory leaks?
**A: NO** ✅
- **Minimal overhead**: Uses kernel events (inotify), not polling
- **Event-driven**: Only activates when files actually change
- **Lightweight**: Typically uses < 10MB RAM and < 1% CPU
- **No memory leaks**: lsyncd is production-tested, used by many large deployments
- **Batching**: Groups multiple file changes together (3-second delay by default)

### Q3: Will code be backed up like GitHub?
**A: NO** ❌ - lsyncd is **NOT a backup solution**
- lsyncd = **File replication** (real-time copy)
- GitHub = **Version control & backup** (history, branches, rollback)

**Recommendation:** Use **BOTH**:
1. **Git/GitHub** for version control, history, and backups
2. **lsyncd** for live sync between servers

**Best Practice:**
- Commit changes to Git first
- Push to GitHub/remote repository
- lsyncd will automatically sync the committed code to SECONDARY

### Q4: Will backends restart after sync?
**A: YES** ✅
- PM2 automatically restarts on **SECONDARY** server after code sync
- Restart is **debounced** (waits 5 seconds to batch multiple changes)
- **PRIMARY** backend is NOT restarted automatically (you can add this if needed)

---

## 🚀 Quick Setup (Run This Now)

```bash
cd /var/www/opine/backend/scripts
sudo ./setup-lsyncd.sh
```

This script will:
1. ✅ Install lsyncd if needed
2. ✅ Configure one-way sync (PRIMARY → SECONDARY)
3. ✅ Test SSH connection
4. ✅ Perform initial code sync (optional)
5. ✅ Start lsyncd service

---

## 📁 What Gets Synced

### ✅ Synced (Automatically):
- All JavaScript files (`.js`)
- All configuration files (except `.env`)
- Models, controllers, routes
- Scripts and utilities
- Package.json and package-lock.json

### ❌ Excluded (NOT Synced):
- `.env` files (each server has its own)
- `node_modules/` (reinstall on SECONDARY if needed)
- `logs/` (each server has its own logs)
- `uploads/` (user-generated content)
- `generated-csvs/` (generated files)
- Database backups
- Temporary files

**See `/etc/lsyncd/lsyncd.conf.lua` for full exclusion list**

---

## 🔧 How It Works

1. **You make changes** on PRIMARY server (edit file, git pull, etc.)
2. **lsyncd detects change** via Linux inotify (within milliseconds)
3. **Waits 3 seconds** to batch multiple file changes
4. **rsync transfers** only changed files to SECONDARY
5. **Post-sync script runs** on PRIMARY
6. **PM2 restarts** on SECONDARY server automatically
7. **Code is live** on SECONDARY within seconds

---

## 📊 Monitoring

### Check lsyncd Status:
```bash
sudo systemctl status lsyncd
```

### View Real-time Logs:
```bash
sudo tail -f /var/log/lsyncd/lsyncd.log
```

### View Sync Status:
```bash
sudo cat /var/log/lsyncd/lsyncd.status
```

### Check Post-Sync Logs:
```bash
tail -f /var/log/lsyncd-post-sync.log
```

---

## 🔧 Management Commands

```bash
# Start lsyncd
sudo systemctl start lsyncd

# Stop lsyncd
sudo systemctl stop lsyncd

# Restart lsyncd
sudo systemctl restart lsyncd

# Check status
sudo systemctl status lsyncd

# View logs
sudo journalctl -u lsyncd -n 50 -f
```

---

## ⚠️ Important Notes

### 1. **Environment Files**
- `.env` files are **NEVER synced**
- Each server must have its own `.env` file
- If you need to update environment variables:
  - Update PRIMARY's `.env`
  - Manually update SECONDARY's `.env`

### 2. **node_modules**
- `node_modules/` is excluded from sync
- If you add new npm packages:
  - Install on PRIMARY: `npm install`
  - Install on SECONDARY: `cd /var/www/opine/backend && npm install`
  - OR: Include `package.json` in sync, then install on SECONDARY

### 3. **Database Changes**
- **lsyncd syncs CODE only**, not database
- Database sync is handled by MongoDB replica set
- If you need to run migrations:
  - Run on PRIMARY first
  - MongoDB replica set will replicate data automatically

### 4. **PM2 Configuration**
- `ecosystem.config.js` is excluded by default
- Each server should have its own PM2 config
- If you need to sync PM2 config, remove it from exclusions

---

## 🐛 Troubleshooting

### lsyncd Not Starting:
```bash
# Check logs
sudo journalctl -u lsyncd -n 50

# Verify config
sudo lsyncd -nodaemon /etc/lsyncd/lsyncd.conf.lua
```

### Files Not Syncing:
1. Check SSH connection:
   ```bash
   ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@3.109.82.159
   ```

2. Check lsyncd logs:
   ```bash
   sudo tail -f /var/log/lsyncd/lsyncd.log
   ```

3. Verify file permissions:
   ```bash
   ls -la /var/www/opine/backend/
   ```

### PM2 Not Restarting:
1. Check post-sync script:
   ```bash
   tail -f /var/log/lsyncd-post-sync.log
   ```

2. Test manual restart:
   ```bash
   ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@3.109.82.159 "cd /var/www/opine/backend && pm2 restart opine-backend"
   ```

---

## ✅ Verification Test

After setup, test the sync:

1. **Create a test file on PRIMARY:**
   ```bash
   echo "test sync $(date)" > /var/www/opine/backend/test-sync.txt
   ```

2. **Wait 5-10 seconds**

3. **Check if file exists on SECONDARY:**
   ```bash
   ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@3.109.82.159 "cat /var/www/opine/backend/test-sync.txt"
   ```

4. **If file appears, sync is working!** ✅

5. **Clean up:**
   ```bash
   rm /var/www/opine/backend/test-sync.txt
   ssh -i /var/www/MyLogos/Convergent-New.pem ubuntu@3.109.82.159 "rm /var/www/opine/backend/test-sync.txt"
   ```

---

## 🎯 Best Practices

1. **Use Git for version control** (commit before sync)
2. **Test changes on PRIMARY first** before pushing to SECONDARY
3. **Monitor logs** during initial setup
4. **Keep backups** via Git/GitHub
5. **Update .env manually** on each server when needed
6. **Run npm install on SECONDARY** when adding new packages

---

## 📞 Support

If you encounter issues:
1. Check logs: `/var/log/lsyncd/lsyncd.log`
2. Check status: `sudo systemctl status lsyncd`
3. Verify SSH: Test connection manually
4. Review config: `/etc/lsyncd/lsyncd.conf.lua`






