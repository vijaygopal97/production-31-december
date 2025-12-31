# 🚨 COMPREHENSIVE AUDIO RECOVERY GUIDE

## Current Status

- **Missing Files:** 39 audio recordings
- **Automated Recovery:** 0 files found (space likely overwritten)
- **Best Option:** Photorec (interactive - highest success rate)

## ⚠️ IMPORTANT: Why Automated Tools Failed

The automated tools (extundelete, scalpel, foremost) found 0 files because:
1. The filesystem space was likely reused after deletion
2. ext4 doesn't keep deleted file metadata for long
3. Files may have been overwritten by new data

## 🎯 YOUR BEST CHANCE: PHOTOREC

**Photorec is the MOST POWERFUL recovery tool** and can recover files even when others fail. It does deep scanning of the entire partition.

### How to Run Photorec:

```bash
cd /var/www/opine
sudo bash recover-photorec-auto.sh
```

**OR manually:**

```bash
cd /var/www/opine/recovered-audio-photorec
sudo photorec /log /d . /dev/sda1
```

### Step-by-Step Instructions:

1. **Start photorec:**
   ```bash
   sudo photorec /log /d /var/www/opine/recovered-audio-photorec /dev/sda1
   ```

2. **Select partition type:**
   - Press `[Enter]` to proceed
   - Select `[Intel/PC partition]` (usually first option)

3. **Select partition:**
   - Choose the Linux partition (usually the first one)
   - Press `[Enter]`

4. **Choose recovery mode:**
   - Select `[File Opt]` (NOT Partition Opt)
   - This recovers files from unallocated space

5. **Select file types:**
   - Navigate to `[Audio]`
   - Select: `[mp3, m4a, wav, webm]`
   - Press `[Enter]`

6. **Choose search area:**
   - Select `[Free]` (for unallocated/free space)
   - This searches the entire partition for deleted files

7. **Set output directory:**
   - Press `[C]` to choose directory
   - Navigate to: `/var/www/opine/recovered-audio-photorec`
   - Press `[C]` to confirm

8. **Start recovery:**
   - Press `[Y]` to start search
   - **This will take HOURS** - be patient!
   - Let it run overnight if needed

9. **After completion:**
   - Files will be in: `/var/www/opine/recovered-audio-photorec/recup_dir.*/`
   - Run the matching script to identify your files

## 📊 Monitor Recovery Progress

### View Live Logs:
```bash
# Main recovery log
tail -f /var/www/opine/recovery-logs/recovery.log

# Individual method logs
tail -f /var/www/opine/recovery-logs/extundelete.log
tail -f /var/www/opine/recovery-logs/scalpel.log
tail -f /var/www/opine/recovery-logs/foremost.log
```

### Monitor Status:
```bash
cd /var/www/opine
bash monitor-recovery.sh
```

## 🔍 After Recovery - Matching Files

Once photorec completes, match recovered files with missing files:

```bash
cd /var/www/opine
node backend/scripts/match-recovered-files.js
```

This script will:
1. Scan all recovered files
2. Match them by session ID
3. Copy matching files to the audio directory
4. Report how many were recovered

## 🛠️ Alternative Methods (If Photorec Fails)

### 1. Check for Disk Images/Backups
```bash
# Look for any disk images
find / -name "*.img" -o -name "*.dd" 2>/dev/null

# Check for backup directories
find /var/backups /home -name "*audio*" -o -name "*opine*" 2>/dev/null
```

### 2. Contact Azure Support
Even without snapshots, Azure may have:
- Filesystem-level backups
- Block-level storage snapshots
- Recovery services

### 3. Check Application Logs
```bash
# Look for file paths in logs
grep -r "interview_" /var/www/opine/backend/logs/ 2>/dev/null
grep -r "audio" /var/log/ 2>/dev/null
```

### 4. Check Browser Cache/Downloads
If interviews were conducted via web browser:
- Check browser download history
- Check browser cache
- Check if files were downloaded locally

## 📝 Recovery Scripts Available

1. **recover-live.sh** - Background recovery with live logs
2. **recover-photorec-auto.sh** - Photorec interactive guide
3. **recover-photorec-interactive.sh** - Photorec manual guide
4. **monitor-recovery.sh** - Monitor recovery progress

## ⏱️ Expected Recovery Time

- **Photorec:** 2-8 hours (depends on disk size)
- **Other tools:** 30 minutes - 2 hours

## 💡 Tips for Best Results

1. **Run photorec overnight** - it takes time but has best success rate
2. **Don't write to the disk** - avoid creating new files
3. **Use read-only if possible** - mount filesystem read-only for best results
4. **Be patient** - deep scanning takes time
5. **Check recovered files** - photorec recovers many files, you'll need to match them

## 🚨 If All Else Fails

If photorec also finds 0 files, it means:
- Files were completely overwritten
- Disk space was reused
- Files are truly unrecoverable

**In this case:**
- Accept the loss
- Implement better backups (S3, automated backups)
- Learn from this experience

## 📞 Support

If you need help:
1. Check logs in: `/var/www/opine/recovery-logs/`
2. Review this guide
3. Try photorec - it's your best bet

---

**Remember:** Photorec is your best chance. Run it and let it complete - it can recover files even after months if space wasn't overwritten!




