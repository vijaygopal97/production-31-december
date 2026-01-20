# 🏆 Top-Tier Tech Company Solution: Audio Upload Reliability

## Problem Statement
- Temp files accumulating (53GB) - failed uploads not cleaned up
- Responses without audio being rejected by Quality Agents
- Affects interviewer earnings
- Need zero data loss, proper S3 storage, correct linking, no duplicates

## Solution Architecture (Meta/Google/Amazon Pattern)

### 1. **Idempotent Upload with Transactional Guarantees**

**Pattern:** Two-Phase Commit with Rollback
- Phase 1: Move temp file to staging area (atomic operation)
- Phase 2: Upload to S3, then update database (transactional)
- Rollback: If S3 fails, move back to temp for retry

**Benefits:**
- No orphaned files
- Guaranteed cleanup
- Retry capability

### 2. **Queue-Based Upload System (BullMQ)**

**Pattern:** Async Job Queue with Retry Logic
- Upload requests go to queue (non-blocking)
- Worker processes uploads with retry (3 attempts)
- Dead letter queue for failed uploads
- Status tracking per upload

**Benefits:**
- Handles failures gracefully
- Automatic retries
- No blocking of API

### 3. **Database-First Approach**

**Pattern:** Write-Ahead Logging
- Create database record FIRST (with status: 'uploading')
- Then upload to S3
- Update status: 'uploaded' or 'failed'
- Link audio to response atomically

**Benefits:**
- Always have record of upload attempt
- Can retry failed uploads
- No orphaned responses

### 4. **Deduplication Strategy**

**Pattern:** Content Hash + Response ID
- Generate hash of audio file (MD5/SHA256)
- Check if hash exists in database
- If exists, link existing audio (no duplicate upload)
- Store hash in database for deduplication

**Benefits:**
- No duplicate uploads
- Storage savings
- Faster linking

### 5. **Comprehensive Error Handling**

**Pattern:** Try-Catch-Finally with Cleanup
- Always clean up temp files (finally block)
- Log all errors with context
- Alert on repeated failures
- Manual recovery queue

**Benefits:**
- No orphaned files
- Full audit trail
- Recovery capability

## Implementation Plan

### Phase 1: Immediate Fix (Current Bug)
1. Add finally block to always clean temp files
2. Move file to staging before S3 attempt
3. Add retry logic for S3 failures

### Phase 2: Queue System
1. Create BullMQ queue for audio uploads
2. Move upload logic to worker
3. Add status tracking

### Phase 3: Recovery System
1. Script to match temp files to responses
2. Upload matched files to S3
3. Link to responses

### Phase 4: Deduplication
1. Add content hash to upload
2. Check for duplicates before upload
3. Link existing audio if duplicate

## Code Structure

```
backend/
  queues/
    audioUploadQueue.js      # BullMQ queue definition
    audioUploadWorker.js     # Worker that processes uploads
  controllers/
    surveyResponseController.js  # Updated with queue
  scripts/
    recover-orphaned-audio.js   # Recovery script
    match-temp-to-responses.js  # Matching script
```

## Key Features

1. **Zero Data Loss:**
   - Database record created first
   - File moved to staging (not deleted)
   - Only deleted after successful S3 upload

2. **Proper S3 Storage:**
   - All files in S3 (no local fallback)
   - Organized folder structure
   - Metadata stored

3. **Correct Linking:**
   - Atomic database update
   - Response ID in filename
   - Content hash for deduplication

4. **No Duplicates:**
   - Hash check before upload
   - Link existing if duplicate
   - Database constraint on hash

5. **Recovery:**
   - Manual recovery queue
   - Script to match orphaned files
   - Retry failed uploads

## Monitoring & Alerts

1. **Metrics:**
   - Upload success rate
   - Upload duration
   - Queue depth
   - Failed uploads count

2. **Alerts:**
   - High failure rate (>5%)
   - Queue backup (>1000 jobs)
   - Disk space low

3. **Logging:**
   - All upload attempts
   - All failures with context
   - Recovery actions

## Testing Strategy

1. **Unit Tests:**
   - Upload success
   - Upload failure
   - Deduplication
   - Cleanup

2. **Integration Tests:**
   - End-to-end upload flow
   - Queue processing
   - Recovery script

3. **Load Tests:**
   - Concurrent uploads
   - Queue performance
   - S3 rate limits

## Migration Plan

1. **Week 1:** Implement immediate fix
2. **Week 2:** Deploy queue system
3. **Week 3:** Run recovery script
4. **Week 4:** Add deduplication
5. **Week 5:** Monitor and optimize

## Success Metrics

- Upload success rate: >99.9%
- Zero orphaned files
- Zero data loss
- Average upload time: <30s
- Queue processing: <5min delay




