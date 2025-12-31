# 🚨 Audio File Recovery Report

## Executive Summary

**Date:** December 6, 2025  
**Issue:** 39 audio files were lost after GitHub restore  
**Status:** Recovery attempted with multiple methods  
**Files Missing:** 39 CAPI interview audio recordings  
**Files Found:** 42 files are present in the filesystem

---

## Problem Analysis

### What Happened
- A GitHub restore operation deleted audio files that were created after the last commit
- All missing files are `.m4a` format audio recordings
- Files were created between December 4-5, 2025
- Files are stored in `/var/www/opine/uploads/audio/`

### Missing Files Details
- **Total CAPI interviews with audio:** 88
- **Files present in filesystem:** 42
- **Files missing:** 39
- **Files with mock URLs (test data):** 7

### File Naming Pattern
All audio files follow the pattern:
```
interview_{sessionId}_{timestamp}.m4a
```

Example: `interview_e34a7a80-f298-4480-8494-e64cf66181e8_1764812154193.m4a`

---

## Recovery Attempts

### ✅ Completed Actions

1. **Added uploads folder to .gitignore**
   - Prevents future loss from Git operations
   - Location: `/var/www/opine/.gitignore`

2. **Database Analysis**
   - Queried all CAPI interviews with audio recordings
   - Identified 39 missing files
   - Created missing files list: `/var/www/opine/missing-audio-files.json`

3. **Filesystem Recovery Tools Installed**
   - ✅ testdisk/photorec
   - ✅ foremost
   - ✅ scalpel
   - ✅ extundelete

4. **Recovery Methods Attempted**
   - ✅ Checked system trash/recycle bin
   - ✅ Checked temporary directories
   - ✅ Checked backup directories
   - ✅ Ran foremost file carving (no files found)
   - ✅ Checked AWS S3 (not configured)
   - ✅ Checked filesystem snapshots (none found)

### ⚠️ Recovery Challenges

1. **Filesystem Status**
   - Filesystem: ext4 on `/dev/sda1`
   - Status: Live filesystem (mounted read-write)
   - Issue: extundelete requires read-only mount for best results

2. **File Carving Results**
   - Foremost: 0 files recovered
   - This suggests files may have been overwritten or space reused

3. **No Cloud Backups**
   - AWS S3 is not configured
   - All files were stored locally only

4. **No System Snapshots**
   - No LVM snapshots found
   - No btrfs snapshots found
   - No Azure snapshots found

---

## Missing Files List

The complete list of missing files is saved in:
```
/var/www/opine/missing-audio-files.json
```

### Sample Missing Files:
1. `interview_e34a7a80-f298-4480-8494-e64cf66181e8_1764812154193.m4a`
   - Session ID: `e34a7a80-f298-4480-8494-e64cf66181e8`
   - Created: Dec 4, 2025 01:35:55 UTC

2. `interview_44bd89ca-5f1c-4c09-8a7b-957005d3857e_1764813143316.m4a`
   - Session ID: `44bd89ca-5f1c-4c09-8a7b-957005d3857e`
   - Created: Dec 4, 2025 01:52:24 UTC

... (37 more files)

---

## Additional Recovery Options

### 1. Hosting Provider Snapshots
**Azure VM Snapshots**
- Check Azure Portal for VM snapshots
- Look for snapshots taken before Dec 6, 2025
- Restore snapshot to a temporary VM and extract files

**Steps:**
1. Log into Azure Portal
2. Navigate to your VM
3. Check "Snapshots" or "Backup" section
4. Look for snapshots from Dec 4-5, 2025

### 2. Advanced extundelete Recovery
**⚠️ Requires System Downtime**

This method requires unmounting the filesystem or mounting it read-only:

```bash
# Option 1: Mount read-only (if possible)
sudo mount -o remount,ro /dev/sda1 /

# Option 2: Boot from recovery media
# Then run:
sudo extundelete /dev/sda1 --restore-all --output-dir /recovery
```

**⚠️ Warning:** This requires system downtime and may affect running services.

### 3. Check Application Logs
Look for any logs that might indicate where files were moved or backed up:

```bash
# Check application logs
grep -r "audio" /var/www/opine/backend/logs/
grep -r "upload" /var/log/
```

### 4. Contact Hosting Provider
- Azure Support may have filesystem-level backups
- Check if they have automated backup systems
- Request recovery from their backup systems

### 5. Check for rsync or other backup scripts
```bash
# Look for backup scripts
find /var/www/opine -name "*backup*" -o -name "*sync*"
find /home -name "*backup*" -o -name "*sync*"
crontab -l | grep -i backup
```

---

## Prevention Measures Implemented

### ✅ Immediate Actions Taken

1. **Added to .gitignore**
   ```
   uploads/
   ```
   This prevents Git from tracking the uploads directory.

2. **Recovery Scripts Created**
   - `/var/www/opine/backend/scripts/recover-audio-files.js` - Analysis script
   - `/var/www/opine/recover-audio-advanced.sh` - Advanced recovery
   - `/var/www/opine/recover-audio-automated.sh` - Automated recovery
   - `/var/www/opine/backend/scripts/check-s3-backup.js` - S3 check script

### 🔒 Recommended Future Actions

1. **Enable AWS S3 Backup**
   - Configure S3 credentials in `.env`
   - Files will be automatically backed up to S3
   - Provides redundancy and protection

2. **Set Up Automated Backups**
   ```bash
   # Example cron job for daily backups
   0 2 * * * tar -czf /backups/opine-audio-$(date +\%Y\%m\%d).tar.gz /var/www/opine/uploads/audio/
   ```

3. **Filesystem Snapshots**
   - Set up LVM snapshots (if using LVM)
   - Or use Azure VM snapshots
   - Schedule regular snapshots

4. **Monitoring**
   - Set up alerts for file count changes
   - Monitor disk space
   - Track file deletions

---

## Recovery Scripts Usage

### 1. Analyze Missing Files
```bash
cd /var/www/opine/backend
node scripts/recover-audio-files.js
```

### 2. Check S3 Backups
```bash
cd /var/www/opine/backend
node scripts/check-s3-backup.js
```

### 3. Run Advanced Recovery
```bash
cd /var/www/opine
sudo bash recover-audio-advanced.sh
```

### 4. Run Automated Recovery
```bash
cd /var/www/opine
sudo bash recover-audio-automated.sh
```

---

## Next Steps

### Immediate (Do Now)
1. ✅ Check Azure Portal for VM snapshots
2. ✅ Contact Azure Support for backup recovery
3. ✅ Review application logs for any clues
4. ✅ Check for any manual backup scripts

### Short Term (This Week)
1. Configure AWS S3 for automatic backups
2. Set up automated daily backups
3. Implement file monitoring/alerts
4. Document backup procedures

### Long Term (This Month)
1. Set up filesystem snapshots
2. Implement backup verification
3. Create disaster recovery plan
4. Train team on backup procedures

---

## Files Created

1. `/var/www/opine/missing-audio-files.json` - Complete list of missing files
2. `/var/www/opine/backend/scripts/recover-audio-files.js` - Recovery analysis script
3. `/var/www/opine/recover-audio-advanced.sh` - Advanced recovery script
4. `/var/www/opine/recover-audio-automated.sh` - Automated recovery script
5. `/var/www/opine/backend/scripts/check-s3-backup.js` - S3 backup checker
6. `/var/www/opine/.gitignore` - Updated to exclude uploads folder

---

## Conclusion

While we were unable to recover the deleted files using standard recovery tools (likely because the filesystem space was reused), we have:

1. ✅ Identified all missing files
2. ✅ Secured the uploads folder from future Git operations
3. ✅ Created recovery tools for future use
4. ✅ Documented the issue and recovery attempts

**Recommendation:** Focus on checking Azure VM snapshots and contacting Azure Support, as they may have filesystem-level backups that can recover these files.

---

**Report Generated:** December 6, 2025  
**Scripts Location:** `/var/www/opine/backend/scripts/`  
**Recovery Output:** `/var/www/opine/recovered-audio/`





