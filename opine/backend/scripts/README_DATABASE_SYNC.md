# Database Sync Script Documentation

## Overview
The `syncDatabaseFromProduction.js` script safely syncs the complete database from production to development.

## ⚠️ CRITICAL SAFETY FEATURES

1. **READ-ONLY on Production**: Uses `mongodump` which is a read-only operation
2. **NEVER Modifies Production**: Production database is never touched
3. **Automatic Backup**: Creates a timestamped backup of development database before sync
4. **Confirmation Required**: Requires typing "YES" to proceed
5. **Clear Warnings**: Multiple safety warnings before execution

## Usage

```bash
cd /var/www/opine/backend/scripts
node syncDatabaseFromProduction.js
```

## What It Does

1. **Backs up Development Database**
   - Creates a timestamped backup in `backend/database_backups/`
   - Format: `dev_backup_YYYY-MM-DDTHH-MM-SS/`

2. **Dumps Production Database (READ-ONLY)**
   - Uses `mongodump` to export all collections
   - This is a READ-ONLY operation on production
   - No data is modified on production

3. **Drops Development Database**
   - Completely deletes all data in development database
   - ⚠️ All development data will be lost (but backed up first)

4. **Restores Production Data to Development**
   - Uses `mongorestore` to import production data
   - Development database now contains production data

5. **Cleans Up**
   - Removes temporary dump files
   - Keeps development backup for safety

## Configuration

The script reads from environment variables:

- `PRODUCTION_MONGO_URI`: Production MongoDB connection string (default: hardcoded)
- `MONGODB_URI`: Development MongoDB connection string (from `.env`)

## Safety Guarantees

✅ **Production Database**: 
- Only READ operations (mongodump)
- NEVER modified, updated, or deleted
- Completely safe

✅ **Development Database**:
- Backed up before any changes
- Backup stored in `database_backups/` directory
- Can be restored if needed

## Backup Location

Development backups are stored in:
```
/var/www/opine/backend/database_backups/dev_backup_YYYY-MM-DDTHH-MM-SS/
```

## Restoring a Backup

If you need to restore a development backup:

```bash
# Find your backup
ls -la /var/www/opine/backend/database_backups/

# Restore using mongorestore
mongorestore --host=localhost:27017 --db=Opine --drop /path/to/backup/Opine
```

## Requirements

- MongoDB Database Tools installed (`mongodump`, `mongorestore`, `mongosh`)
- Access to production MongoDB server
- Development MongoDB running locally
- Proper authentication credentials

## Troubleshooting

### "mongodump not found"
Install MongoDB Database Tools:
```bash
# Ubuntu/Debian
wget https://fastdl.mongodb.org/tools/db/mongodb-database-tools-*-linux-x86_64.tgz
tar -xzf mongodb-database-tools-*-linux-x86_64.tgz
sudo cp mongodb-database-tools-*/bin/* /usr/local/bin/
```

### Connection Errors
- Check MongoDB connection strings in `.env`
- Verify network connectivity to production server
- Check authentication credentials

### Permission Errors
- Ensure MongoDB user has read permissions on production
- Ensure MongoDB user has write permissions on development

## Important Notes

⚠️ **This script will DELETE all development data**
- Always ensure you have a backup
- The script creates a backup automatically, but verify it exists before proceeding

⚠️ **Production is NEVER modified**
- The script uses read-only operations on production
- No risk to production data

⚠️ **Large Databases**
- Sync may take time for large databases
- Monitor disk space for backups and dumps


