# Duplicate Detection and Cleanup Script

## Overview

This script finds and marks duplicate SurveyResponses in the database based on specific criteria for CAPI and CATI interviews.

## Duplicate Detection Criteria

### CAPI (Computer-Assisted Personal Interviewing) Duplicates

**ALL conditions must match (AND condition):**
1. ✅ All responses match exactly
2. ✅ Audio recording is the same (duration, fileSize, format, codec, bitrate)
3. ✅ Same interviewer
4. ✅ Same interview timing (startTime within 1 second)
5. ✅ Same GPS coordinates (latitude, longitude within 0.0001 degree tolerance)

### CATI (Computer-Assisted Telephone Interviewing) Duplicates

**ALL conditions must match (AND condition):**
1. ✅ Same interviewer
2. ✅ All responses match exactly
3. ✅ Same interview time (startTime within 1 second)
4. ✅ Same call_id

## How It Works

1. **Batch Processing**: Processes responses in batches of 100 to avoid memory issues
2. **Efficient Grouping**: Groups responses by interviewer+survey (CAPI) or interviewer+call_id (CATI) for faster comparison
3. **Original Detection**: The first response found (by createdAt) in each duplicate group is kept as original
4. **Duplicate Marking**: All other responses in the group are marked as "abandoned"

## Usage

```bash
cd /var/www/Report-Generation/ImprovedDuplicateRemove
node findAndMarkDuplicates.js
```

Or make it executable and run directly:
```bash
chmod +x findAndMarkDuplicates.js
./findAndMarkDuplicates.js
```

## Output Files

The script generates the following files in the same directory:

1. **duplicate_detection_report_[TIMESTAMP].json**
   - Comprehensive JSON report with all duplicate groups
   - Includes original and duplicate response details
   - Full statistics and metadata

2. **duplicate_detection_report_[TIMESTAMP].csv**
   - CSV format for easy analysis in Excel/Google Sheets
   - Includes all original and duplicate responses
   - Easy to filter and sort

3. **duplicate_cleanup_log_[TIMESTAMP].json**
   - Log of the cleanup operation
   - Includes update results and statistics
   - Error tracking if any

4. **duplicate_detection_error_[TIMESTAMP].json** (if errors occur)
   - Error log with stack traces
   - Statistics at time of error

## Report Structure

### JSON Report
```json
{
  "timestamp": "2025-01-XX...",
  "summary": {
    "totalDuplicateGroups": 10,
    "capiDuplicateGroups": 7,
    "catiDuplicateGroups": 3,
    "totalDuplicatesToMark": 15,
    "totalOriginals": 10
  },
  "groups": [
    {
      "groupNumber": 1,
      "mode": "CAPI",
      "original": { ... },
      "duplicates": [ ... ]
    }
  ]
}
```

### CSV Report
Columns:
- Group Number
- Mode (CAPI/CATI)
- Type (ORIGINAL/DUPLICATE)
- Response ID
- Mongo ID
- Session ID
- Interviewer Name
- Interviewer Member ID
- Survey Name
- Start Time
- End Time
- Duration (seconds)
- Status
- Call ID (for CATI)
- Audio URL
- Audio Duration
- Audio File Size
- Latitude
- Longitude
- Response Count
- Created At
- Time Difference (ms)

## Safety Features

1. **Read-Only Analysis First**: The script first analyzes and generates reports before making any changes
2. **Batch Processing**: Processes in small batches to avoid server crashes
3. **Status Preservation**: Only marks duplicates as "abandoned", doesn't delete them
4. **Original Protection**: Original responses are never modified
5. **Comprehensive Logging**: All operations are logged for audit trail

## Performance

- **Batch Size**: 100 responses per batch
- **Comparison Batch**: 50 responses for comparison
- **Memory Efficient**: Uses lean() queries to minimize memory usage
- **Indexed Queries**: Leverages MongoDB indexes for fast lookups

## Important Notes

⚠️ **Before Running:**
- Review the generated report before marking duplicates
- Ensure you have database backups
- Test on a development environment first

⚠️ **After Running:**
- Review the CSV report to verify duplicates were correctly identified
- Check the update log to confirm all duplicates were marked
- Original responses remain unchanged

## Example Output

```
================================================================================
DUPLICATE DETECTION AND CLEANUP SCRIPT
================================================================================
Timestamp: 2025-01-XX...
Report Directory: /var/www/Report-Generation/ImprovedDuplicateRemove

🔌 Connecting to database...
✅ Connected to database

📊 Database Statistics:
   Total Responses: 50000
   CAPI Responses: 35000
   CATI Responses: 15000

📱 Processing CAPI responses...
   Found 35000 CAPI responses to analyze
   Processed 35000/35000 CAPI responses... (Found 25 duplicate groups)
   ✅ CAPI processing complete: Found 25 duplicate groups

📞 Processing CATI responses...
   Found 15000 CATI responses to analyze
   Processed 15000/15000 CATI responses... (Found 10 duplicate groups)
   ✅ CATI processing complete: Found 10 duplicate groups

================================================================================
SUMMARY
================================================================================
Total Duplicate Groups Found: 35
  - CAPI Groups: 25
  - CATI Groups: 10
Total Duplicates to Mark: 45
  - CAPI Duplicates: 30
  - CATI Duplicates: 15
================================================================================

📊 Generating report...
   ✅ JSON report saved: duplicate_detection_report_2025-01-XX.json
   ✅ CSV report saved: duplicate_detection_report_2025-01-XX.csv

🏷️  Marking duplicates as abandoned...
   Found 45 duplicate responses to mark as abandoned
   Updated 45/45 duplicates...
   ✅ Marked 45 duplicates as abandoned

================================================================================
FINAL SUMMARY
================================================================================
Total Duplicate Groups: 35
Total Duplicates Marked: 45
Errors: 0
Reports Generated:
  - JSON: duplicate_detection_report_2025-01-XX.json
  - CSV: duplicate_detection_report_2025-01-XX.csv
================================================================================

✅ Update log saved: duplicate_cleanup_log_2025-01-XX.json

✅ Script completed successfully!
```

## Troubleshooting

### Script runs slowly
- Reduce BATCH_SIZE if memory is limited
- Ensure MongoDB indexes are present on interviewer, survey, call_id fields

### Too many duplicates found
- Review the CSV report to verify duplicate detection logic
- Check if tolerance values need adjustment (GPS, timing)

### Errors during update
- Check MongoDB connection
- Verify database permissions
- Review error log for details

## Support

For issues or questions:
1. Check the error log file
2. Review the CSV report for patterns
3. Verify database connectivity and permissions






