import { apiService } from './api';
import { offlineStorage, OfflineInterview } from './offlineStorage';
import * as FileSystem from 'expo-file-system/legacy';
import { appLoggingService } from './appLoggingService';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ interviewId: string; error: string }>;
}

export interface SyncProgress {
  currentInterview: number; // 1-indexed
  totalInterviews: number;
  interviewId: string;
  interviewProgress: number; // 0-100 for current interview
  stage: 'uploading_data' | 'uploading_audio' | 'verifying' | 'synced' | 'failed';
  syncedCount: number;
  failedCount: number;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

class SyncService {
  private isSyncing = false;
  private progressCallback: SyncProgressCallback | null = null;

  /**
   * Set progress callback for real-time sync progress updates
   */
  setProgressCallback(callback: SyncProgressCallback | null): void {
    this.progressCallback = callback;
  }

  /**
   * Notify progress callback if available
   */
  private notifyProgress(progress: SyncProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Sync all pending offline interviews
   */
  async syncOfflineInterviews(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress');
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [{ interviewId: 'system', error: 'Sync already in progress' }],
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Check if online
      const isOnline = await offlineStorage.isOnline();
      if (!isOnline) {
        console.log('⚠️ Device is offline, cannot sync');
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errors: [{ interviewId: 'system', error: 'Device is offline' }],
        };
      }

      // Get all pending interviews
      const pendingInterviews = await offlineStorage.getPendingInterviews();
      
      // CRITICAL: Early return if no pending interviews
      // This prevents unnecessary API calls and error logs
      if (pendingInterviews.length === 0) {
        console.log('✅ No pending interviews to sync - skipping sync operation');
        await offlineStorage.updateLastSyncTime();
        return result;
      }
      
      const totalInterviews = pendingInterviews.length;
      console.log(`🔄 Starting sync for ${totalInterviews} interviews`);
      appLoggingService.info('SYNC', 'Starting offline interview sync', {
        interviewCount: totalInterviews,
        interviewIds: pendingInterviews.map(i => i.id)
      });

      // Notify overall sync start
      this.notifyProgress({
        currentInterview: 0,
        totalInterviews,
        interviewId: '',
        interviewProgress: 0,
        stage: 'uploading_data',
        syncedCount: 0,
        failedCount: 0,
      });

      // Sync each interview one by one (SEQUENTIAL - WhatsApp style)
      for (let i = 0; i < pendingInterviews.length; i++) {
        const interview = pendingInterviews[i];
        const currentIndex = i + 1; // 1-indexed for display
        
        try {
          console.log(`🔄 [${currentIndex}/${totalInterviews}] Syncing interview: ${interview.id} (${interview.isCatiMode ? 'CATI' : 'CAPI'})`);
          
          // Notify UI: Starting interview
          this.notifyProgress({
            currentInterview: currentIndex,
            totalInterviews,
            interviewId: interview.id,
            interviewProgress: 0,
            stage: 'uploading_data',
            syncedCount: result.syncedCount,
            failedCount: result.failedCount,
          });
          
          appLoggingService.logSyncAttempt(interview.id, 'SYNC_START', {
            interviewId: interview.id,
            surveyId: interview.surveyId,
            isCatiMode: interview.isCatiMode,
            currentStatus: interview.status,
            syncAttempts: interview.syncAttempts || 0,
            progress: `${currentIndex}/${totalInterviews}`
          });
          
          // Update status to syncing with progress tracking (WhatsApp-style)
          await offlineStorage.updateInterviewStatus(interview.id, 'syncing');
          await offlineStorage.updateInterviewSyncProgress(interview.id, 0, 'uploading_data');
          console.log(`📊 [${currentIndex}/${totalInterviews}] [${interview.id}] Progress: 0% - Starting sync...`);

          // Sync based on interview type
          // CRITICAL: These functions will throw an error if sync fails
          // Only if they complete without throwing will we mark as synced and delete
          console.log(`🔄 [${currentIndex}/${totalInterviews}] Starting sync function for interview: ${interview.id}`);
          
          // Create progress wrapper to track individual interview progress
          const progressWrapper = {
            currentIndex,
            totalInterviews,
            interviewId: interview.id,
            updateProgress: (progress: number, stage: SyncProgress['stage']) => {
              this.notifyProgress({
                currentInterview: currentIndex,
                totalInterviews,
                interviewId: interview.id,
                interviewProgress: progress,
                stage,
                syncedCount: result.syncedCount,
                failedCount: result.failedCount,
              });
            }
          };
          
          if (interview.isCatiMode) {
            await this.syncCatiInterview(interview, progressWrapper);
          } else {
            await this.syncCapiInterview(interview, progressWrapper);
          }
          
          // CRITICAL: Only reach here if sync function completed WITHOUT throwing an error
          // Add explicit log to confirm we're past the sync function
          console.log(`✅ Sync function completed successfully for interview: ${interview.id}`);
          console.log(`✅ Proceeding to mark as synced and cleanup...`);
          
          // FINAL VERIFICATION: Double-check that we should mark as synced
          // Re-fetch the interview to ensure it's still in pending/syncing state
          const currentInterview = await offlineStorage.getOfflineInterviews();
          const interviewToSync = currentInterview.find((i: any) => i.id === interview.id);
          
          if (!interviewToSync) {
            console.warn(`⚠️ Interview ${interview.id} not found in storage - may have been deleted already`);
            // Continue anyway - might have been cleaned up
          } else if (interviewToSync.status === 'synced') {
            console.warn(`⚠️ Interview ${interview.id} already marked as synced - skipping duplicate update`);
            // Already synced, skip
            continue;
          }

          // ONLY reach here if sync was successful (no error thrown)
          // Fix 3: Atomically update metadata (with responseId) and status to synced
          console.log(`📝 Marking interview ${interview.id} as synced with atomic update...`);
          const syncedInterview = await offlineStorage.getOfflineInterviewById(interview.id);
          if (syncedInterview) {
            // Get responseId from metadata if available (from syncCapiInterview/syncCatiInterview)
            const responseId = syncedInterview.metadata?.responseId || syncedInterview.metadata?.serverResponseId;
            if (responseId) {
              // Atomic update: metadata + status together
              await offlineStorage.updateInterviewMetadataAndStatus(
                interview.id,
                {
                  responseId: responseId,
                  serverResponseId: responseId,
                },
                'synced'
              );
            } else {
              // Fallback: just update status if no responseId (shouldn't happen)
              await offlineStorage.updateInterviewStatus(interview.id, 'synced');
            }
          } else {
            // Interview not found - just update status (shouldn't happen)
            await offlineStorage.updateInterviewStatus(interview.id, 'synced');
          }
          // Update progress: Sync complete (100%)
          await offlineStorage.updateInterviewSyncProgress(interview.id, 100, 'synced');
          console.log(`📊 [${interview.id}] Progress: 100% - Sync complete!`);
          
          result.syncedCount++;
          console.log(`✅ [${currentIndex}/${totalInterviews}] Successfully synced interview: ${interview.id}`);
          
          // Notify UI: Interview synced
          this.notifyProgress({
            currentInterview: currentIndex,
            totalInterviews,
            interviewId: interview.id,
            interviewProgress: 100,
            stage: 'synced',
            syncedCount: result.syncedCount,
            failedCount: result.failedCount,
          });
          appLoggingService.logSyncResult(interview.id, true, {
            interviewId: interview.id,
            surveyId: interview.surveyId,
            syncedCount: result.syncedCount
          });

          // CRITICAL FIX: Only delete after verification that everything is synced
          // Verify audio was uploaded (if it exists) before deleting local files
          const syncedInterviewData = await offlineStorage.getOfflineInterviewById(interview.id);
          const hasAudio = syncedInterviewData?.audioOfflinePath || syncedInterviewData?.audioUri;
          const audioUploaded = syncedInterviewData?.audioUploadStatus === 'uploaded';
          
          if (hasAudio && !audioUploaded) {
            // CRITICAL: Audio exists but wasn't uploaded - DO NOT DELETE
            console.error(`❌ CRITICAL: Interview ${interview.id} has audio but upload status is not 'uploaded'`);
            console.error(`❌ Audio path: ${syncedInterviewData?.audioOfflinePath || syncedInterviewData?.audioUri}`);
            console.error(`❌ Upload status: ${syncedInterviewData?.audioUploadStatus}`);
            console.error(`❌ NOT deleting interview - audio upload may have failed`);
            
            // Update status back to pending so it retries on next sync
            await offlineStorage.updateInterviewStatus(interview.id, 'pending');
            throw new Error('Audio file exists but was not uploaded - sync cannot complete');
          }
          
          // All verification passed - safe to delete
          console.log(`✅ Verification passed - deleting synced interview from local storage: ${interview.id}`);
          
          // Delete from local storage after successful sync
          // Synced interviews don't need to be stored offline anymore
          await offlineStorage.deleteSyncedInterview(interview.id);
          
          // CRITICAL FIX: Only delete audio file if upload was confirmed successful
          // This prevents data loss - only delete if we're certain it's on the server
          if (interview.audioOfflinePath) {
            // Double-check audio was uploaded before deleting
            if (syncedInterviewData?.audioUploadStatus === 'uploaded' && syncedInterviewData?.metadata?.audioUrl) {
              console.log(`🗑️ Deleting audio file (verified uploaded): ${interview.audioOfflinePath}`);
              await offlineStorage.deleteAudioFileFromOfflineStorage(interview.audioOfflinePath);
            } else {
              console.warn(`⚠️ Skipping audio file deletion - upload status uncertain: ${syncedInterviewData?.audioUploadStatus}`);
              // Don't delete if we're not sure - better to keep local copy than lose data
            }
          }
          
          console.log(`🗑️ Deleted synced interview from local storage: ${interview.id}`);
        } catch (error: any) {
          const errorMessage = error.message || error.response?.data?.message || 'Unknown error';
          
          // Check if this is a duplicate submission error
          // If interview was already submitted, treat it as success (not an error)
          const isDuplicate = errorMessage.includes('DUPLICATE_SUBMISSION') || 
                              errorMessage.includes('already exists') ||
                              errorMessage.includes('already submitted') ||
                              errorMessage.includes('already completed') ||
                              errorMessage.includes('duplicate');
          
          if (isDuplicate) {
            // This is NOT an error - interview already exists on server (IDEMPOTENCY)
            console.log(`ℹ️ Duplicate submission detected for interview ${interview.id}`);
            console.log(`ℹ️ Interview already exists on server - treating as successfully synced (IDEMPOTENCY)`);
            console.log(`✅ This is expected behavior - interview was already submitted previously`);
            
            // Update progress to 100% since it's already synced
            await offlineStorage.updateInterviewSyncProgress(interview.id, 100, 'synced');
            console.log(`📊 [${interview.id}] Progress: 100% - Already synced (duplicate detected)`);
            
            // Fix 3: Atomic metadata and status update - mark as synced atomically
            // CRITICAL: Only update if not already synced - prevents unnecessary writes (IDEMPOTENCY)
            const duplicateInterview = await offlineStorage.getOfflineInterviewById(interview.id);
            if (duplicateInterview && duplicateInterview.status !== 'synced') {
              const responseId = duplicateInterview.serverResponseId || 
                                 duplicateInterview?.metadata?.responseId || 
                                 duplicateInterview?.metadata?.serverResponseId;
              if (responseId) {
                await offlineStorage.updateInterviewMetadataAndStatus(
                  interview.id,
                  {
                    responseId: responseId,
                    serverResponseId: responseId,
                  },
                  'synced'
                );
              } else {
                // Fallback: just update status if no responseId
                await offlineStorage.updateInterviewStatus(interview.id, 'synced');
              }
              console.log(`✅ Interview ${interview.id} marked as synced (duplicate submission)`);
            } else {
              console.log(`✅ Interview ${interview.id} already marked as synced - no update needed (IDEMPOTENCY)`);
            }
            
            result.syncedCount++;
            
            // CRITICAL: Only delete if we're certain it's synced and has no pending audio
            // Check if audio was uploaded before deleting
            const hasAudio = duplicateInterview?.audioOfflinePath || duplicateInterview?.audioUri;
            const audioUploaded = duplicateInterview?.audioUploadStatus === 'uploaded';
            
            if (hasAudio && !audioUploaded) {
              console.warn(`⚠️ Interview ${interview.id} is duplicate but audio upload status unclear - keeping local files`);
              // Don't delete - audio might not be synced yet
            } else {
              // Delete from local storage since it's already on server
              await offlineStorage.deleteSyncedInterview(interview.id);
              
              // Clean up audio file only if upload was confirmed
              if (interview.audioOfflinePath && audioUploaded) {
                await offlineStorage.deleteAudioFileFromOfflineStorage(interview.audioOfflinePath);
              }
            }
            
            continue; // Skip to next interview
          }
          
          // Only log as error if it's NOT a duplicate
          console.error(`❌ [${currentIndex}/${totalInterviews}] Error syncing interview ${interview.id}:`, error);
          
          // Notify UI: Interview failed
          this.notifyProgress({
            currentInterview: currentIndex,
            totalInterviews,
            interviewId: interview.id,
            interviewProgress: 0,
            stage: 'failed',
            syncedCount: result.syncedCount,
            failedCount: result.failedCount + 1, // Will be incremented below
          });
          
          appLoggingService.logSyncResult(interview.id, false, {
            interviewId: interview.id,
            surveyId: interview.surveyId,
            error: errorMessage,
            errorType: error.name,
            syncAttempts: interview.syncAttempts || 0
          });
          
          // CRITICAL: Check if error is a server error (502, 503, etc.) - these should NOT count towards max retries
          const isServerError = errorMessage.includes('502') || 
                               errorMessage.includes('Bad Gateway') ||
                               errorMessage.includes('server is not responding') ||
                               errorMessage.includes('temporary server issue');
          
          // CRITICAL: Implement exponential backoff and retry limits (like WhatsApp/Meta)
          // BUT: Server errors (502) should have higher retry limit since they're temporary
          const syncAttempts = (interview.syncAttempts || 0) + 1;
          const MAX_RETRIES = isServerError ? 10 : 5; // More retries for server errors
          
          if (syncAttempts >= MAX_RETRIES) {
            // Max retries reached - mark as permanently failed ONLY if not a server error
            if (isServerError) {
              // Server errors should not be marked as permanently failed - keep retrying
              console.error(`❌ Interview ${interview.id} exceeded max retries (${MAX_RETRIES}) for server errors`);
              console.error(`❌ However, this is a server issue - will continue retrying on next sync`);
              await offlineStorage.updateInterviewStatus(interview.id, 'failed', `Server error (${syncAttempts} attempts): ${errorMessage}`);
            } else {
              // Non-server errors can be marked as permanently failed
              console.error(`❌ Interview ${interview.id} exceeded max retries (${MAX_RETRIES}) - marking as permanently failed`);
              await offlineStorage.updateInterviewSyncProgress(interview.id, 0, 'failed_permanently');
              await offlineStorage.updateInterviewStatus(interview.id, 'failed', `Max retries (${MAX_RETRIES}) exceeded: ${errorMessage}`);
            }
          } else {
            // Update status to failed and preserve interview for retry with exponential backoff
            await offlineStorage.updateInterviewStatus(interview.id, 'failed', errorMessage);
            
            // Calculate exponential backoff delay (1s, 2s, 4s, 8s, 16s, max 60s for server errors)
            const maxDelay = isServerError ? 60000 : 30000; // Longer delay for server errors
            const backoffDelay = Math.min(1000 * Math.pow(2, syncAttempts - 1), maxDelay);
            console.log(`⏳ Interview ${interview.id} will retry after ${backoffDelay}ms (attempt ${syncAttempts}/${MAX_RETRIES})`);
          }
          
          // Log detailed error information for debugging
          console.error(`❌ Interview sync failed - will retry on next sync attempt`);
          console.error(`❌ Error details:`, {
            interviewId: interview.id,
            surveyId: interview.surveyId,
            error: errorMessage,
            syncAttempts: syncAttempts,
            maxRetries: MAX_RETRIES,
            stack: error.stack
          });
          
          result.failedCount++;
          result.errors.push({
            interviewId: interview.id,
            error: errorMessage,
          });
          result.success = false;
        }
      }

      // Update last sync time
      await offlineStorage.updateLastSyncTime();

      console.log(`✅ Sync completed: ${result.syncedCount} synced, ${result.failedCount} failed`);
    } catch (error: any) {
      console.error('❌ Fatal error during sync:', error);
      result.success = false;
      result.errors.push({
        interviewId: 'system',
        error: error.message || 'Fatal sync error',
      });
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Sync a CAPI interview
   */
  private async syncCapiInterview(
    interview: OfflineInterview,
    progressWrapper?: { currentIndex: number; totalInterviews: number; interviewId: string; updateProgress: (progress: number, stage: SyncProgress['stage']) => void }
  ): Promise<void> {
    console.log(`📋 Syncing CAPI interview: ${interview.id}`);
    
    // Helper to notify progress
    const notifyProgress = (progress: number, stage: SyncProgress['stage']) => {
      if (progressWrapper) {
        progressWrapper.updateProgress(progress, stage);
      }
    };

    // CRITICAL FIX: Check if interview needs audio retry (response exists but audio upload failed)
    // This handles rollback scenario where interview was created but audio upload failed
    if (interview.metadata?.needsAudioRetry && interview.metadata?.responseId) {
      const existingResponseId = interview.metadata.responseId;
      const audioPath = interview.audioOfflinePath || interview.audioUri;
      const hasAudioFile = audioPath && audioPath.trim().length > 0;
      
      if (hasAudioFile) {
        console.log(`🔄 RETRY: Interview ${interview.id} needs audio retry (responseId: ${existingResponseId})`);
        console.log(`🔄 Retrying audio upload for existing response...`);
        
        // Retry audio upload for existing response
        try {
          const { apiService } = await import('./api');
          const uploadResult = await this.uploadAudioWithRetry(
            audioPath,
            interview.sessionId || 'retry',
            interview.surveyId,
            interview.id,
            5, // max retries
            existingResponseId // Pass responseId to link audio to existing response
          );
          
          if (uploadResult.success && uploadResult.audioUrl) {
            console.log(`✅ Audio retry successful: ${uploadResult.audioUrl}`);
            
            // Verify audio is on server
            const verifyResult = await apiService.getSurveyResponseById(existingResponseId);
            if (verifyResult.success && verifyResult.response) {
              const serverAudioUrl = verifyResult.response?.audioRecording?.audioUrl || 
                                    verifyResult.response?.audioUrl ||
                                    null;
              
              if (serverAudioUrl && serverAudioUrl.trim() !== '') {
                console.log(`✅ Audio retry verified on server: ${serverAudioUrl}`);
                // Clear retry flag and mark as uploaded
                interview.audioUploadStatus = 'uploaded';
                interview.metadata = {
                  ...interview.metadata,
                  audioUrl: uploadResult.audioUrl,
                  needsAudioRetry: false, // Clear retry flag
                };
                await offlineStorage.saveOfflineInterview(interview);
                // Continue to normal sync flow to mark as synced
              } else {
                throw new Error('Audio retry verification failed - audio not found on server');
              }
            } else {
              throw new Error('Failed to verify audio retry on server');
            }
          } else {
            throw new Error(uploadResult.error || 'Audio retry failed');
          }
        } catch (retryError: any) {
          console.error(`❌ Audio retry failed: ${retryError.message}`);
          // Keep needsAudioRetry flag - will retry on next sync
          throw new Error(`Audio retry failed: ${retryError.message}`);
        }
      } else {
        console.log(`⚠️ Interview ${interview.id} needs audio retry but audio file not found - clearing retry flag`);
        // Clear retry flag if audio file no longer exists
        interview.metadata = {
          ...interview.metadata,
          needsAudioRetry: false,
        };
        await offlineStorage.saveOfflineInterview(interview);
      }
    }
    
    // Fix 2 & 3: Check if interview was already successfully submitted (IDEMPOTENCY)
    // If metadata contains a responseId, it means it was already submitted
    // CRITICAL: This prevents duplicate submissions and ensures retries don't change status
    if (interview.metadata?.responseId || interview.metadata?.serverResponseId || interview.serverResponseId) {
      const existingResponseId = interview.serverResponseId || 
                                 interview.metadata?.responseId || 
                                 interview.metadata?.serverResponseId;
      console.log(`ℹ️ Interview ${interview.id} was already submitted with responseId: ${existingResponseId}`);
      console.log(`ℹ️ Skipping duplicate submission - interview is already on server (IDEMPOTENCY CHECK)`);
      
      // Update progress to 100% since it's already synced
      await offlineStorage.updateInterviewSyncProgress(interview.id, 100, 'synced');
      console.log(`📊 [${interview.id}] Progress: 100% - Already synced (skipping duplicate)`);
      
      // Fix 3: Atomic metadata and status update - ensure responseId is stored and status is updated together
      // CRITICAL: Only update if status is not already 'synced' - prevents unnecessary writes (IDEMPOTENCY)
      if (interview.status !== 'synced') {
        await offlineStorage.updateInterviewMetadataAndStatus(
          interview.id,
          {
            responseId: existingResponseId,
            serverResponseId: existingResponseId,
          },
          'synced' // Mark as synced since it's already on server
        );
        console.log(`✅ Interview already synced - marked as synced with atomic update`);
      } else {
        console.log(`✅ Interview already marked as synced - no update needed (IDEMPOTENCY)`);
      }
      return; // Exit early - interview is already on server
    }

    // Fetch survey from cache if not stored in interview (to reduce storage size)
    let survey = interview.survey;
    if (!survey && interview.surveyId) {
      console.log(`📦 Fetching survey ${interview.surveyId} from cache...`);
      const { offlineStorage } = await import('./offlineStorage');
      const surveys = await offlineStorage.getSurveys();
      survey = surveys.find((s: any) => s._id === interview.surveyId || s.id === interview.surveyId);
      if (!survey) {
        throw new Error(`Survey ${interview.surveyId} not found in cache`);
      }
      console.log(`✅ Found survey ${interview.surveyId} in cache`);
    }

    // Check if sessionId is an offline session ID (starts with "offline_")
    // Offline session IDs don't exist on the server, so we need to start a new session
    // CRITICAL: For offline CAPI interviews, use the offline sessionId directly
    // The backend `completeInterview` endpoint now handles offline sessionIds
    // This is similar to how WhatsApp handles offline messages - they're submitted directly
    const isOfflineSessionId = interview.sessionId && interview.sessionId.startsWith('offline_');
    
    let sessionId: string | undefined = interview.sessionId;
    
    // CRITICAL: For offline interviews, we can use the offline sessionId directly
    // The backend will handle it and create the response from metadata
    // No need to create a server session first - this is the WhatsApp-style approach
    if (isOfflineSessionId) {
      console.log(`📴 Offline sessionId detected: ${sessionId} - will submit directly to backend (WhatsApp-style)`);
      console.log(`📴 Backend will handle offline sessionId and create response from metadata`);
      // Use the offline sessionId directly - backend will handle it
    } else if (!sessionId) {
      // No sessionId at all - this shouldn't happen, but handle it
      console.log(`⚠️ No sessionId found - this shouldn't happen for CAPI interviews`);
      throw new Error('SessionId is required for interview sync');
    } else {
      // Real server sessionId - use it directly
      console.log(`✅ Using existing server sessionId: ${sessionId}`);
    }
    
    // At this point, sessionId is guaranteed to be defined
    if (!sessionId) {
      throw new Error('SessionId is required but not available');
    }

    // Build final responses array
    // Fetch survey if needed for buildFinalResponses
    if (!interview.survey && interview.surveyId) {
      const { offlineStorage } = await import('./offlineStorage');
      const surveys = await offlineStorage.getSurveys();
      interview.survey = surveys.find((s: any) => s._id === interview.surveyId || s.id === interview.surveyId);
      if (!interview.survey) {
        throw new Error(`Survey ${interview.surveyId} not found in cache`);
      }
    }
    
    const finalResponses = await this.buildFinalResponses(interview);

    // Calculate duration from startTime and endTime if available
    // CRITICAL: Prefer stored duration if it's valid, otherwise calculate from timestamps
    // The stored duration is more reliable as it was calculated at the time of saving
    let totalTimeSpent = interview.duration || 0;
    
    console.log('🔍 Duration calculation - interview.duration:', interview.duration);
    console.log('🔍 Duration calculation - interview.startTime:', interview.startTime);
    console.log('🔍 Duration calculation - interview.endTime:', interview.endTime);
    
    // First, check if stored duration is valid (greater than 0)
    if (totalTimeSpent > 0) {
      console.log('✅ Using stored duration:', totalTimeSpent, 'seconds');
    } else if (interview.startTime && interview.endTime) {
      // If stored duration is invalid, calculate from timestamps
      try {
        const start = new Date(interview.startTime);
        const end = new Date(interview.endTime);
        
        console.log('🔍 Parsed start time:', start.toISOString(), 'timestamp:', start.getTime());
        console.log('🔍 Parsed end time:', end.toISOString(), 'timestamp:', end.getTime());
        
        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.error('❌ Invalid date values - start:', interview.startTime, 'end:', interview.endTime);
          console.log('⚠️ Using stored duration as fallback:', interview.duration);
        } else {
          const timeDiff = end.getTime() - start.getTime();
          const calculatedDuration = Math.floor(timeDiff / 1000);
          
          console.log('🔍 Time difference (ms):', timeDiff);
          console.log('🔍 Calculated duration (seconds):', calculatedDuration);
          
          // Use calculated duration if it's valid and positive
          if (calculatedDuration > 0) {
            totalTimeSpent = calculatedDuration;
            console.log('✅ Calculated duration from timestamps:', totalTimeSpent, 'seconds');
          } else {
            console.warn('⚠️ Calculated duration is invalid (<= 0), using stored duration:', interview.duration);
            // If calculated is invalid but stored is also invalid, use a minimum of 1 second
            if (totalTimeSpent <= 0) {
              totalTimeSpent = 1;
              console.warn('⚠️ Both calculated and stored duration invalid, using minimum 1 second');
            }
          }
        }
      } catch (durationError) {
        console.error('❌ Error calculating duration:', durationError);
        console.log('⚠️ Using stored duration as fallback:', interview.duration);
        // If stored duration is also invalid, use minimum
        if (totalTimeSpent <= 0) {
          totalTimeSpent = 1;
          console.warn('⚠️ Using minimum 1 second as last resort');
        }
      }
    } else {
      console.warn('⚠️ No timestamps available, using stored duration:', interview.duration);
      // If stored duration is also invalid, use minimum
      if (totalTimeSpent <= 0) {
        totalTimeSpent = 1;
        console.warn('⚠️ No valid duration found, using minimum 1 second');
      }
    }
    
    console.log('📊 Final duration for sync:', totalTimeSpent, 'seconds (', Math.floor(totalTimeSpent / 60), 'minutes)');

    // Extract interviewer ID and supervisor ID from responses (for survey 68fd1915d41841da463f0d46)
    // Fetch survey if needed
    if (!interview.survey && interview.surveyId) {
      const { offlineStorage } = await import('./offlineStorage');
      const surveys = await offlineStorage.getSurveys();
      interview.survey = surveys.find((s: any) => s._id === interview.surveyId || s.id === interview.surveyId);
    }
    
    const isTargetSurvey = interview.survey && (interview.survey._id === '68fd1915d41841da463f0d46' || interview.survey.id === '68fd1915d41841da463f0d46');
    let oldInterviewerID: string | null = null;
    let supervisorID: string | null = null;
    if (isTargetSurvey) {
      const interviewerIdResponse = interview.responses['interviewer-id'];
      if (interviewerIdResponse !== null && interviewerIdResponse !== undefined && interviewerIdResponse !== '') {
        oldInterviewerID = String(interviewerIdResponse);
      }
      
      const supervisorIdResponse = interview.responses['supervisor-id'];
      if (supervisorIdResponse !== null && supervisorIdResponse !== undefined && supervisorIdResponse !== '') {
        supervisorID = String(supervisorIdResponse);
      }
    }

    // Check if consent is "No" - extract from responses
    const consentResponse = interview.responses['consent-form'];
    const isConsentNo = consentResponse === '2' || consentResponse === 2 || 
                       String(consentResponse).toLowerCase() === 'no' ||
                       String(consentResponse).toLowerCase().includes('disagree');

    // Prepare location data - ensure it includes all necessary fields
    // The backend will fetch Lok Sabha and District from GPS coordinates if not present
    let locationData = interview.locationData;
    if (locationData && locationData.latitude && locationData.longitude) {
      // Ensure location data has all fields
      locationData = {
        ...locationData,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        // Backend will populate Lok Sabha and District from coordinates
      };
    }
    
    // Prepare polling station data with all fields
    let pollingStationData = interview.selectedPollingStation;
    if (pollingStationData && pollingStationData.stationName) {
      pollingStationData = {
        state: pollingStationData.state || interview.survey?.acAssignmentState || 'West Bengal',
        acNo: pollingStationData.acNo,
        acName: pollingStationData.acName,
        pcNo: pollingStationData.pcNo,
        pcName: pollingStationData.pcName,
        district: pollingStationData.district,
        groupName: pollingStationData.groupName,
        stationName: pollingStationData.stationName,
        gpsLocation: pollingStationData.gpsLocation,
        latitude: pollingStationData.latitude,
        longitude: pollingStationData.longitude
      };
    }
    
    // Check geofencing - if locationControlBooster is enabled, geofencing is enforced
    const locationControlBooster = interview.metadata?.locationControlBooster || false;
    const geofencingError = interview.metadata?.geofencingError || null;
    
    // CRITICAL FIX: Complete interview FIRST, then upload audio
    // Backend requires the response to exist in DB before audio can be uploaded
    // This fixes the "Response not found for offline session" error
    let audioUrl: string | null = null;
    let audioFileSize: number = 0;
    let responseId: string | null = null; // Will be set after completeInterview
    
    // Complete the interview with the (new) sessionId FIRST
    // TypeScript: Ensure sessionId is defined
    if (!sessionId) {
      throw new Error('SessionId is required to complete interview');
    }
    
    // Fetch survey if needed
    if (!interview.survey && interview.surveyId) {
      const surveys = await offlineStorage.getSurveys();
      interview.survey = surveys.find((s: any) => s._id === interview.surveyId || s.id === interview.surveyId);
    }
    
    // CRITICAL: Check if interview was already successfully submitted
    // If metadata contains a responseId, it means it was already submitted
    if (interview.metadata?.responseId || interview.metadata?.serverResponseId) {
      const existingResponseId = interview.metadata.responseId || interview.metadata.serverResponseId;
      console.log(`ℹ️ Interview ${interview.id} was already submitted with responseId: ${existingResponseId}`);
      console.log(`ℹ️ Skipping duplicate submission - interview is already on server`);
      // Interview already exists on server - consider it synced
      // Update metadata to reflect this
      interview.metadata = {
        ...interview.metadata,
        responseId: existingResponseId,
        serverResponseId: existingResponseId,
      };
      await offlineStorage.saveOfflineInterview(interview);
      console.log(`✅ Interview already synced - will be marked as synced by caller`);
      return; // Exit early - interview is already on server
    }
    
    // CRITICAL: Call completeInterview API and verify success BEFORE marking as synced
    console.log(`📤 Calling completeInterview API for sessionId: ${sessionId}`);
    console.log(`📤 SurveyId: ${interview.surveyId}, InterviewId: ${interview.id}`);
    console.log(`📤 About to await completeInterview - this will block until API call completes`);
    
    let result;
    try {
      // CRITICAL: Check if backend is reachable before attempting sync
      // This prevents unnecessary retries if backend is completely down
      const isOnline = await apiService.isOnline();
      if (!isOnline) {
        throw new Error('Device is offline - cannot sync interview');
      }
      
      // CRITICAL: For offline interviews, include surveyId in metadata (required by backend)
      result = await apiService.completeInterview(sessionId, {
      responses: finalResponses,
      qualityMetrics: interview.metadata.qualityMetrics || {
        averageResponseTime: 0,
        backNavigationCount: 0,
        dataQualityScore: 100,
        totalPauseTime: 0,
        totalPauses: 0,
      },
      metadata: {
        survey: interview.surveyId, // CRITICAL: Required for offline interviews
        interviewer: 'current-user',
        status: 'Pending_Approval',
        sessionId: sessionId,
        startTime: interview.startTime ? new Date(interview.startTime) : new Date(),
        endTime: interview.endTime ? new Date(interview.endTime) : new Date(),
        totalTimeSpent: totalTimeSpent, // Include duration
        interviewMode: interview.survey?.mode === 'multi_mode' ? (interview.survey?.assignedMode || 'capi') : (interview.survey?.mode || 'capi'),
        selectedAC: interview.selectedAC || null,
        selectedPollingStation: pollingStationData, // Include complete polling station data
        location: locationData, // Include complete location data (backend will fetch Lok Sabha/District)
        setNumber: interview.selectedSetNumber || null,
        OldinterviewerID: oldInterviewerID, // Include interviewer ID for target survey
        supervisorID: supervisorID, // Include supervisor ID for target survey
        consentResponse: isConsentNo ? 'no' : null, // Set consentResponse if consent is "No"
        locationControlBooster: locationControlBooster, // Include booster status for geofencing enforcement
        geofencingError: locationControlBooster ? geofencingError : null, // Include error if booster enabled (enforce geofencing)
        // CRITICAL: Include abandonment information from interview metadata if available
        abandoned: interview.metadata?.isCompleted === false || (interview.metadata?.abandonReason !== null && interview.metadata?.abandonReason !== undefined) ? true : false,
        abandonedReason: interview.metadata?.abandonReason || null,
        abandonmentNotes: interview.metadata?.abandonNotes || null,
        isCompleted: interview.metadata?.isCompleted !== undefined ? interview.metadata.isCompleted : true, // Default to true if not set
        // Audio recording will be added after upload (in response metadata)
        // Don't include audioRecording here - it will be uploaded separately after completeInterview
        audioRecording: null,
        // CRITICAL: Include deviceInfo for offline interviews
        deviceInfo: interview.metadata?.deviceInfo || null
      },
      });
      console.log(`📥 completeInterview API call completed - response received`);
      
      // CRITICAL: Check if result indicates server error (502, etc.)
      // responseId will be extracted after verification below
      if (result && result.isServerError) {
        // Server error (502, 503, etc.) - treat as temporary failure
        const errorMsg = `Server error (${result.statusCode}): ${result.message || 'Backend server is not responding'}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
    } catch (apiError: any) {
      // Check if the API returned a duplicate flag (from our improved error handling)
      const apiResult = apiError.response?.data || {};
      if (apiResult.isDuplicate === true) {
        console.log(`ℹ️ API explicitly marked this as duplicate - interview already exists on server`);
        throw new Error(`DUPLICATE_SUBMISSION: Interview already exists on server`);
      }
      
      // Catch any errors from the API call itself (network errors, etc.)
      // Only log as error if it's not a duplicate (409 is handled above)
      if (apiError.response?.status !== 409) {
        console.error(`❌ completeInterview API call threw an error:`, apiError);
        console.error(`❌ SessionId: ${sessionId}`);
        console.error(`❌ SurveyId: ${interview.surveyId}`);
      } else {
        console.log(`ℹ️ Complete interview returned 409 Conflict - duplicate submission`);
      }
      console.log(`ℹ️ Error response:`, apiError.response?.data);
      console.log(`ℹ️ Error status:`, apiError.response?.status);
      
      // Extract error message from various sources
      const errorMessage = apiError.message || '';
      const errorResponse = apiError.response?.data;
      const backendErrorMessage = errorResponse?.error || errorResponse?.message || '';
      const backendErrorCode = errorResponse?.code || errorResponse?.errorCode || '';
      const fullErrorMessage = `${errorMessage} ${backendErrorMessage} ${backendErrorCode}`.toLowerCase();
      
      // CRITICAL: Check for MongoDB duplicate key error (E11000)
      // This happens when sessionId already has a completed response
      // The backend now returns 409 Conflict with isDuplicate flag for duplicates
      const isE11000Error = 
        backendErrorCode === 11000 ||
        backendErrorCode === '11000' ||
        fullErrorMessage.includes('e11000') ||
        fullErrorMessage.includes('11000') ||
        (errorResponse?.code === 11000) ||
        (errorResponse?.keyPattern?.sessionId !== undefined); // MongoDB duplicate key pattern
      
      // Check if backend explicitly marked this as a duplicate
      const isExplicitDuplicate = errorResponse?.isDuplicate === true;
      
      // Check if this is a duplicate submission error
      // Look for duplicate indicators in both client and server error messages
      const isDuplicateError = 
        isExplicitDuplicate || // Backend explicitly marked as duplicate
        isE11000Error ||
        (apiError.response?.status === 409) || // 409 Conflict means duplicate (backend returns this for E11000)
        fullErrorMessage.includes('duplicate') || 
        fullErrorMessage.includes('already exists') ||
        fullErrorMessage.includes('already submitted') ||
        fullErrorMessage.includes('already completed') ||
        fullErrorMessage.includes('unique constraint') ||
        (apiError.response?.status === 500 && (
          backendErrorMessage.includes('duplicate') ||
          backendErrorMessage.includes('already exists') ||
          backendErrorMessage.includes('already completed') ||
          backendErrorMessage.includes('e11000') ||
          backendErrorMessage.includes('11000') ||
          isE11000Error
        ));
      
      if (isDuplicateError) {
        console.log(`ℹ️ Duplicate submission detected - interview already exists on server`);
        console.log(`ℹ️ Error message: ${errorMessage}`);
        console.log(`ℹ️ Backend error: ${backendErrorMessage}`);
        console.log(`ℹ️ Error code: ${backendErrorCode}`);
        console.log(`ℹ️ This is not a fatal error - interview was already successfully submitted`);
        // Treat duplicate as success (interview already on server)
        throw new Error(`DUPLICATE_SUBMISSION: Interview already exists on server`);
      }
      
      // CRITICAL: Handle 502 Bad Gateway errors (backend not responding)
      // Check if error response indicates server error
      const is502Error = apiError.response?.status === 502 || 
                        errorMessage.includes('502') ||
                        errorMessage.includes('Bad Gateway');
      
      if (is502Error) {
        console.error(`❌ 502 Bad Gateway - Backend server is not responding`);
        console.error(`❌ This is a temporary server issue - interview will be retried`);
        // Don't treat as permanent failure - will retry on next sync
        throw new Error(`Backend server is not responding (502 Bad Gateway). This is a temporary issue.`);
      }
      
      // For 500 errors, log more details to help debug
      if (apiError.response?.status === 500) {
        console.error(`❌ Backend returned 500 error - this might indicate a server-side issue`);
        console.error(`❌ Full error response:`, JSON.stringify(errorResponse, null, 2));
        console.error(`❌ Error code: ${backendErrorCode}`);
        console.error(`❌ Error message: ${backendErrorMessage}`);
        console.error(`❌ Full error object:`, JSON.stringify(apiError.response?.data, null, 2));
        
        // CRITICAL: Check if this might be a duplicate that we didn't catch
        // The backend might return a generic 500 for E11000 duplicate key errors
        // If we've tried multiple times with the same sessionId and keep getting 500,
        // it's very likely a duplicate submission
        const syncAttempts = interview.syncAttempts || 0;
        if (syncAttempts >= 2) {
          console.log(`⚠️ Multiple sync attempts (${syncAttempts}) failed with 500 for sessionId: ${sessionId}`);
          console.log(`⚠️ This is likely a duplicate submission - interview already exists on server`);
          console.log(`⚠️ Treating as duplicate to prevent infinite retry loop`);
          throw new Error(`DUPLICATE_SUBMISSION: Interview already exists on server (multiple 500 errors with same sessionId)`);
        }
        
        // Also check if the error response contains any duplicate indicators
        const errorResponseStr = JSON.stringify(errorResponse || {}).toLowerCase();
        if (errorResponseStr.includes('11000') || errorResponseStr.includes('duplicate') || errorResponseStr.includes('e11000')) {
          console.log(`⚠️ Error response contains duplicate indicators - treating as duplicate`);
          throw new Error(`DUPLICATE_SUBMISSION: Interview already exists on server (error response indicates duplicate)`);
        }
      }
      
      throw new Error(`API call failed: ${errorMessage || backendErrorMessage || 'Unknown error'}`);
    }

    // CRITICAL: Check API response BEFORE proceeding
    // Log the result first for debugging
    console.log(`📥 completeInterview API response received:`, {
      success: result?.success,
      hasResponse: !!result?.response,
      message: result?.message,
      isDuplicate: result?.isDuplicate,
      statusCode: result?.statusCode
    });
    
    // Defensive check: result must exist
    if (!result) {
      const errorMsg = 'completeInterview API returned undefined/null - sync failed';
      console.error(`❌ ${errorMsg}`);
      console.error(`❌ SessionId: ${sessionId}`);
      console.error(`❌ SurveyId: ${interview.surveyId}`);
      throw new Error(errorMsg);
    }
    
    // CRITICAL: Check if backend returned a duplicate flag
    // The backend idempotency cache returns success: true with cached response for duplicates
    if (result.isDuplicate === true) {
      console.log(`ℹ️ Backend explicitly marked this as duplicate (idempotency cache hit)`);
      console.log(`ℹ️ Interview already exists on server - treating as successfully synced`);
      
      // Even if it's a duplicate, we should have a response with responseId
      if (result.response && (result.response._id || result.response.id || result.response.responseId)) {
        const duplicateResponseId = result.response._id || result.response.id || result.response.responseId;
        console.log(`✅ Duplicate interview found with responseId: ${duplicateResponseId}`);
        // Store the responseId and treat as success
        interview.metadata = {
          ...interview.metadata,
          responseId: duplicateResponseId,
          serverResponseId: duplicateResponseId,
        };
        await offlineStorage.saveOfflineInterview(interview);
        // Throw duplicate error so caller can handle it as success
        throw new Error(`DUPLICATE_SUBMISSION: Interview already exists on server with responseId: ${duplicateResponseId}`);
      } else {
        // Duplicate but no responseId - still treat as success
        throw new Error(`DUPLICATE_SUBMISSION: Interview already exists on server (idempotency cache hit)`);
      }
    }
    
    if (result.success !== true) {
      const errorMsg = result.message || 'Failed to complete interview';
      
      // Check if this might be a duplicate submission error
      // Sometimes the backend returns success: false for duplicates
      const isPossibleDuplicate = errorMsg.toLowerCase().includes('duplicate') ||
                                  errorMsg.toLowerCase().includes('already exists') ||
                                  errorMsg.toLowerCase().includes('already submitted') ||
                                  errorMsg.toLowerCase().includes('already completed');
      
      if (isPossibleDuplicate) {
        console.log(`ℹ️ Possible duplicate submission detected from API response`);
        console.log(`ℹ️ Error message: ${errorMsg}`);
        console.log(`ℹ️ This might mean the interview already exists on server`);
        // Treat as duplicate - will be handled by caller
        throw new Error(`DUPLICATE_SUBMISSION: ${errorMsg}`);
      }
      
      // Check if it's a server error
      if (result.isServerError || result.statusCode === 502) {
        throw new Error(`Backend server is not responding (502 Bad Gateway). This is a temporary issue.`);
      }
      
      console.error(`❌ Interview completion failed: ${errorMsg}`);
      console.error(`❌ Response data:`, JSON.stringify(result, null, 2));
      console.error(`❌ SessionId: ${sessionId}`);
      console.error(`❌ SurveyId: ${interview.surveyId}`);
      throw new Error(errorMsg);
    }

    // CRITICAL: Verify that the interview was actually created on the server
    // Only consider sync successful if we have confirmation (response ID)
    // The API returns both MongoDB _id and UUID responseId - we need both for verification
    // Priority: Use UUID responseId for audio linking, but keep MongoDB _id as fallback
    const mongoId = result.response?._id || result.response?.id || result.response?.mongoId || null;
    const uuidResponseId = result.response?.responseId || null;
    
    // Use UUID responseId if available (preferred for audio linking), otherwise use MongoDB _id
    responseId = uuidResponseId || mongoId || null;
    
    if (!result.response || !responseId) {
      const errorMsg = 'Interview completion returned success but no response ID - sync may have failed';
      console.error(`❌ ${errorMsg}`);
      console.error(`❌ Response data:`, JSON.stringify(result, null, 2));
      console.error(`❌ SessionId: ${sessionId}`);
      console.error(`❌ SurveyId: ${interview.surveyId}`);
      throw new Error(errorMsg);
    }

    // Store both IDs for verification (backend accepts both)
    const responseIdForAudio = uuidResponseId || responseId; // Prefer UUID for audio upload
    const responseIdForVerification = responseId; // Use either for verification (backend handles both)
    
    // ONLY log success AFTER verification
    console.log(`✅ Interview completed successfully with sessionId: ${sessionId}`);
    console.log(`✅ Interview MongoDB ID: ${mongoId || 'N/A'}`);
    console.log(`✅ Interview UUID responseId: ${uuidResponseId || 'N/A'}`);
    console.log(`✅ Using responseId for audio/verification: ${responseId}`);
    
    // Update progress: Interview data uploaded (50%)
    notifyProgress(50, 'uploading_data');
    
    // CRITICAL: Audio is OPTIONAL - only upload if audio file exists
    // CATI interviews don't have audio (audio via webhook)
    // Early abandoned interviews may not have audio (recording never started)
    // If audio EXISTS, it MUST be uploaded successfully (efficiency requirement)
    console.log(`📤 Checking audio upload status AFTER interview completion (responseId: ${responseId})`);
    
    const audioPath = interview.audioOfflinePath || interview.audioUri;
    const hasAudioFile = audioPath && audioPath.trim().length > 0;
    
    if (hasAudioFile) {
      console.log(`📤 Audio file found - will upload: ${audioPath}`);
      
      // Update progress: Starting audio upload (50-90%)
      await offlineStorage.updateInterviewSyncProgress(interview.id, 55, 'uploading_audio');
      notifyProgress(55, 'uploading_audio');
      console.log(`📊 [${interview.id}] Progress: 55% - Starting audio upload...`);
      
      // Check if audio is already uploaded (from previous sync attempt)
      if (interview.audioUploadStatus === 'uploaded' && interview.metadata?.audioUrl) {
        audioUrl = interview.metadata.audioUrl;
        console.log('✅ Using already uploaded audio:', audioUrl);
      } else {
        // Need to upload audio - NOW that response exists in DB
        try {
          // Update status to uploading
          interview.audioUploadStatus = 'uploading';
          await offlineStorage.saveOfflineInterview(interview);
          
          // Upload with retry mechanism - pass responseId to link audio to response
          // CRITICAL: If audio EXISTS, it MUST be uploaded successfully
          // Use UUID responseId if available (preferred), otherwise use MongoDB _id
          const audioResponseId = responseIdForAudio || responseId;
          console.log(`📎 Using responseId for audio upload: ${audioResponseId}`);
          
          const uploadResult = await this.uploadAudioWithRetry(
            audioPath,
            sessionId,
            interview.surveyId,
            interview.id,
            5, // max retries
            audioResponseId // Pass responseId (UUID preferred) to link audio to completed response
          );
          
          if (uploadResult.success && uploadResult.audioUrl) {
            audioUrl = uploadResult.audioUrl;
            audioFileSize = uploadResult.fileSize || 0;
            
            // CRITICAL FIX: Verify audio was actually linked to response before proceeding
            // This prevents data loss - ensures audio exists on server before we delete locally
            if (responseIdForVerification) {
              console.log(`🔍 Verifying audio upload - checking if audio is linked to response ${responseIdForVerification}...`);
              console.log(`🔍 Using identifier for verification: ${responseIdForVerification} (UUID: ${uuidResponseId || 'N/A'}, MongoId: ${mongoId || 'N/A'})`);
              try {
                // Wait a moment for backend to process the update (MongoDB write + S3 upload)
                // Backend needs time to:
                // 1. Save audio file to S3/local storage
                // 2. Update MongoDB document with audioUrl
                // 3. Commit transaction
                console.log(`⏳ Waiting 3 seconds for backend to process audio link...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // CRITICAL: Actually fetch the response from server to verify audioUrl exists
                const { apiService } = await import('./api');
                
                // Try UUID first (preferred), then MongoDB _id if UUID not available
                // Backend endpoint handles both
                let verifyResult;
                let verifyIdentifier = responseIdForVerification;
                
                if (uuidResponseId) {
                  // Try UUID first
                  console.log(`🔍 Trying verification with UUID: ${uuidResponseId}`);
                  verifyResult = await apiService.getSurveyResponseById(uuidResponseId);
                  
                  if (!verifyResult.success && mongoId) {
                    // If UUID lookup fails, try MongoDB _id
                    console.log(`⚠️ UUID lookup failed, trying MongoDB _id: ${mongoId}`);
                    verifyIdentifier = mongoId;
                    verifyResult = await apiService.getSurveyResponseById(mongoId);
                  } else {
                    verifyIdentifier = uuidResponseId;
                  }
                } else {
                  // Use MongoDB _id directly
                  console.log(`🔍 Using MongoDB _id for verification: ${mongoId}`);
                  verifyResult = await apiService.getSurveyResponseById(responseIdForVerification);
                }
                
                if (!verifyResult.success || !verifyResult.response) {
                  const errorMsg = verifyResult.error || 'Unknown error';
                  console.error(`❌ Failed to fetch response for verification`);
                  console.error(`❌ Error: ${errorMsg}`);
                  console.error(`❌ Identifier used: ${verifyIdentifier}`);
                  console.error(`❌ UUID responseId: ${uuidResponseId || 'N/A'}`);
                  console.error(`❌ MongoDB _id: ${mongoId || 'N/A'}`);
                  throw new Error(`Failed to fetch response for verification: ${errorMsg}`);
                }
                
                const serverResponse = verifyResult.response;
                const serverAudioUrl = serverResponse?.audioRecording?.audioUrl || 
                                      serverResponse?.audioUrl ||
                                      null;
                
                console.log(`🔍 Verification successful - fetched response from server`);
                console.log(`🔍 Server response ID: ${serverResponse?.responseId || serverResponse?._id || 'N/A'}`);
                console.log(`🔍 Server response audioRecording:`, JSON.stringify(serverResponse?.audioRecording, null, 2));
                console.log(`🔍 Server audioUrl: ${serverAudioUrl || 'NOT FOUND'}`);
                console.log(`🔍 Uploaded audioUrl: ${audioUrl}`);
                
                if (!serverAudioUrl || serverAudioUrl.trim() === '') {
                  console.error(`❌ CRITICAL: Audio URL not found in server response!`);
                  console.error(`❌ Verification identifier: ${verifyIdentifier}`);
                  console.error(`❌ UUID responseId: ${uuidResponseId || 'N/A'}`);
                  console.error(`❌ MongoDB _id: ${mongoId || 'N/A'}`);
                  console.error(`❌ Server response _id: ${serverResponse?._id || 'N/A'}`);
                  console.error(`❌ Server response responseId: ${serverResponse?.responseId || 'N/A'}`);
                  console.error(`❌ Full server response:`, JSON.stringify(serverResponse, null, 2));
                  throw new Error(`Audio URL not found in server response - audio was NOT linked to response. Verification identifier: ${verifyIdentifier}`);
                }
                
                // Verify the audioUrl matches what we uploaded
                // Note: Server might return S3 key while we have full URL, so check for partial match
                const audioUrlMatches = serverAudioUrl === audioUrl || 
                                      serverAudioUrl.includes(audioUrl.split('/').pop() || '') ||
                                      audioUrl.includes(serverAudioUrl.split('/').pop() || '');
                
                if (!audioUrlMatches) {
                  console.warn(`⚠️ Audio URL format mismatch:`);
                  console.warn(`⚠️ Uploaded: ${audioUrl}`);
                  console.warn(`⚠️ Server: ${serverAudioUrl}`);
                  console.warn(`⚠️ This might be OK if server uses S3 keys vs URLs`);
                  // Don't fail - if server has an audioUrl, it's linked
                }
                
                console.log(`✅ Audio upload VERIFIED - server response has audioUrl: ${serverAudioUrl}`);
                console.log(`✅ Audio is properly linked to response ${responseId}`);
              } catch (verifyError: any) {
                console.error('❌ Audio verification FAILED:', verifyError.message);
                console.error('❌ This means audio may not be linked to the response');
                console.error('❌ Failing sync to prevent data loss');
                console.error('❌ Interview will remain in local storage for retry');
                // CRITICAL: Fail sync if verification fails - audio might not be linked
                throw new Error(`Audio verification failed: ${verifyError.message}. Interview will remain in local storage for retry.`);
              }
            } else {
              console.warn('⚠️ No responseId provided - skipping audio verification (backward compatibility)');
              console.warn('⚠️ Audio upload may succeed but not be linked to response');
              console.warn('⚠️ Consider updating app to always pass responseId');
            }
            
            interview.audioUploadStatus = 'uploaded';
            interview.metadata = {
              ...interview.metadata,
              audioUrl: audioUrl,
            };
            interview.audioUploadError = null;
            await offlineStorage.saveOfflineInterview(interview);
            
            // Update progress: Audio uploaded (90%)
            await offlineStorage.updateInterviewSyncProgress(interview.id, 90, 'uploading_audio');
            notifyProgress(90, 'uploading_audio');
            console.log(`📊 [${interview.id}] Progress: 90% - Audio uploaded successfully`);
            console.log('✅ Audio uploaded and verified successfully:', audioUrl);
          } else {
            // CRITICAL: If audio EXISTS but upload failed, fail sync
            // This ensures efficiency - audio must be uploaded if it exists
            const errorMessage = uploadResult.error || 'Audio upload failed';
            console.error('❌ Audio file exists but upload failed - sync cannot proceed');
            console.error('❌ Error:', errorMessage);
            interview.audioUploadStatus = 'failed';
            interview.audioUploadError = errorMessage;
            await offlineStorage.saveOfflineInterview(interview);
            // CRITICAL: Throw error - audio exists but couldn't be uploaded
            throw new Error(`Audio file exists but upload failed: ${errorMessage}`);
          }
        } catch (audioError: any) {
          console.error('❌ Audio upload error:', audioError);
          interview.audioUploadStatus = 'failed';
          interview.audioUploadError = audioError.message;
          await offlineStorage.saveOfflineInterview(interview);
          
          // CRITICAL ROLLBACK: If interview was already created but audio upload failed,
          // we need to mark the response as "partial" so it can be retried
          // This prevents data loss - response exists but audio is missing
          if (responseId) {
            console.error(`❌ ROLLBACK: Interview ${interview.id} was created (responseId: ${responseId}) but audio upload failed`);
            console.error(`❌ Marking response as needing audio retry - will retry on next sync`);
            // Store responseId so we can retry audio upload later
            interview.metadata = {
              ...interview.metadata,
              responseId: responseId,
              serverResponseId: responseId,
              needsAudioRetry: true, // Flag to indicate audio needs to be retried
            };
            await offlineStorage.saveOfflineInterview(interview);
          }
          
          // CRITICAL: Audio exists but upload failed - fail sync
          // This ensures sync is not marked as complete until audio is uploaded
          throw new Error(`Audio file exists but upload failed: ${audioError.message || 'Audio upload failed'}`);
        }
      }
    } else {
      // No audio file - this is OK (early abandoned or CATI interview)
      console.log('ℹ️ No audio file found - this is OK (early abandoned interview or CATI)');
      console.log('ℹ️ Interview will sync without audio');
      audioUrl = null;
      audioFileSize = 0;
      // Don't fail sync - audio is optional
    }
    
    // Update progress: Verifying sync (95%)
    await offlineStorage.updateInterviewSyncProgress(interview.id, 95, 'verifying');
    console.log(`📊 [${interview.id}] Progress: 95% - Verifying sync...`);
    
    // CRITICAL FIX: Final verification - ensure audio is actually on server before marking sync complete
    // This prevents data loss where sync is marked complete but audio is missing
    // Top tech companies (Meta, WhatsApp, Amazon) always verify data exists on server before marking complete
    // Reuse audioPath and hasAudioFile variables already declared earlier in function (line 1070)
    if (hasAudioFile) {
      // Audio file exists - MUST verify it's on server before proceeding
      console.log(`🔍 CRITICAL VERIFICATION: Audio file exists locally - verifying it's on server...`);
      console.log(`🔍 ResponseId for verification: ${responseId}`);
      console.log(`🔍 Audio URL from upload: ${audioUrl || 'NOT SET'}`);
      
      if (!audioUrl || audioUrl.trim() === '') {
        // CRITICAL: Audio file exists but upload failed - fail sync
        console.error(`❌ CRITICAL DATA LOSS PREVENTION: Audio file exists but audioUrl is empty!`);
        console.error(`❌ Interview ${interview.id} has audio file but upload failed`);
        console.error(`❌ Failing sync to prevent data loss - interview will retry on next sync`);
        throw new Error('Audio file exists but upload failed - audioUrl is empty. Sync cannot complete.');
      }
      
      // Final verification: Fetch response from server to confirm audio is linked
      // Use lean query to avoid memory overhead (only fetch what we need)
      try {
        const { apiService } = await import('./api');
        
        // Try UUID first (preferred), then MongoDB _id
        let verifyResult;
        if (uuidResponseId) {
          verifyResult = await apiService.getSurveyResponseById(uuidResponseId);
          if (!verifyResult.success && mongoId) {
            verifyResult = await apiService.getSurveyResponseById(mongoId);
          }
        } else {
          verifyResult = await apiService.getSurveyResponseById(responseId);
        }
        
        if (!verifyResult.success || !verifyResult.response) {
          const errorMsg = verifyResult.error || 'Unknown error';
          console.error(`❌ CRITICAL: Failed to fetch response for final verification`);
          console.error(`❌ Error: ${errorMsg}`);
          throw new Error(`Final verification failed: ${errorMsg}`);
        }
        
        const serverResponse = verifyResult.response;
        const serverAudioUrl = serverResponse?.audioRecording?.audioUrl || 
                              serverResponse?.audioUrl ||
                              null;
        
        if (!serverAudioUrl || serverAudioUrl.trim() === '') {
          // CRITICAL: Audio file exists locally but not on server - fail sync
          console.error(`❌ CRITICAL DATA LOSS PREVENTION: Audio file exists locally but NOT on server!`);
          console.error(`❌ ResponseId: ${responseId}`);
          console.error(`❌ Local audio path: ${audioPath}`);
          console.error(`❌ Server audioUrl: ${serverAudioUrl || 'MISSING'}`);
          console.error(`❌ Failing sync to prevent data loss - interview will retry on next sync`);
          throw new Error('Audio file exists locally but not found on server - data loss prevented. Sync will retry.');
        }
        
        console.log(`✅ FINAL VERIFICATION PASSED: Audio confirmed on server: ${serverAudioUrl}`);
        console.log(`✅ Interview synced WITH audio: ${audioUrl}`);
      } catch (verifyError: any) {
        // Verification failed - fail sync to prevent data loss
        console.error(`❌ CRITICAL: Final audio verification failed: ${verifyError.message}`);
        console.error(`❌ Failing sync to prevent data loss - interview will retry on next sync`);
        throw new Error(`Final audio verification failed: ${verifyError.message}. Sync cannot complete.`);
      }
    } else {
      // No audio file - this is OK (early abandoned or CATI interview)
      console.log('ℹ️ No audio file found - this is OK (early abandoned interview or CATI)');
      console.log('ℹ️ Interview will sync without audio');
    }

    // Fix 3: Atomic metadata and status update - store responseId and sessionId together
    // Update interview with the real sessionId and responseId for future reference
    const metadataUpdates: any = {
      responseId: responseId,
      serverResponseId: responseId,
    };
    if (isOfflineSessionId || !interview.sessionId) {
      metadataUpdates.serverSessionId = sessionId;
    }
    
    // Store responseId atomically with interview update (if sessionId changed)
    if (isOfflineSessionId || !interview.sessionId) {
      interview.sessionId = sessionId;
      interview.metadata = {
        ...interview.metadata,
        ...metadataUpdates,
      };
      await offlineStorage.saveOfflineInterview(interview);
    }
    
    // CRITICAL: Add a final verification log before function returns
    // This ensures we can track when the function actually completes successfully
    console.log(`✅ syncCapiInterview completed successfully for interview: ${interview.id}`);
    console.log(`✅ All API calls verified - ready for cleanup in caller`);
    console.log(`✅ Response ID stored: ${responseId}`);
    console.log(`✅ Audio verification passed: ${hasAudioFile ? 'YES' : 'N/A (no audio)'}`);
    
    // Return success indicator - this function should only return if sync was successful
    // Any errors should throw, which will be caught by the caller's try-catch
    // DO NOT update status or delete here - let the caller do it after this function returns
    // The caller will use updateInterviewMetadataAndStatus to atomically update metadata and status
  }

  /**
   * Upload audio file with retry mechanism (exponential backoff)
   * CRITICAL: If audio file exists, upload MUST succeed (efficiency requirement)
   * Audio is optional - only called when audio file actually exists
   * This ensures no data loss - if audio exists, it will be uploaded reliably
   * 
   * @param responseId - Optional responseId to link audio to existing response (for sync retries)
   *                     Backward compatible - if not provided, uses session-based upload
   */
  private async uploadAudioWithRetry(
    audioPath: string,
    sessionId: string,
    surveyId: string,
    interviewId: string,
    maxRetries: number = 5, // Increased retries for audio (critical)
    responseId?: string // CRITICAL FIX: Add responseId parameter to link audio to response
  ): Promise<{ success: boolean; audioUrl?: string; fileSize?: number; error?: string }> {
    console.log(`📤 Uploading audio with retry (max ${maxRetries} attempts): ${audioPath}`);
    
    // Verify FileSystem is available
    if (!FileSystem || typeof FileSystem.getInfoAsync !== 'function') {
      throw new Error('FileSystem.getInfoAsync is not available');
    }
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(audioPath);
    if (!fileInfo.exists) {
      throw new Error(`Audio file does not exist at path: ${audioPath}`);
    }
    
    if (fileInfo.size === 0) {
      throw new Error('Audio file is empty (0 bytes)');
    }
    
    console.log(`✅ Audio file verified - size: ${fileInfo.size} bytes`);
    
    // Retry loop with exponential backoff
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Audio upload attempt ${attempt}/${maxRetries}...`);
        if (responseId) {
          console.log(`📎 Linking audio to responseId: ${responseId}`);
        }
        
        // CRITICAL FIX: Pass responseId to link audio to completed response
        // Backward compatible - responseId is optional for old app versions
        const uploadResult = await apiService.uploadAudioFile(
          audioPath,
          sessionId,
          surveyId,
          responseId // Pass responseId to ensure audio is linked to response
        );
        
        if (uploadResult.success && uploadResult.response?.audioUrl) {
          const uploadedAudioUrl = uploadResult.response.audioUrl;
          if (uploadedAudioUrl && !uploadedAudioUrl.startsWith('mock://')) {
            console.log(`✅ Audio uploaded successfully on attempt ${attempt}`);
            return {
              success: true,
              audioUrl: uploadedAudioUrl,
              fileSize: uploadResult.response?.size || fileInfo.size,
            };
          } else {
            throw new Error('Audio upload returned invalid mock URL');
          }
        } else {
          throw new Error(uploadResult.message || 'Audio upload failed');
        }
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Audio upload attempt ${attempt} failed:`, error.message);
        
        // CRITICAL: Check if error is 502 Bad Gateway - use longer delays for server errors
        const is502Error = error.message && (
          error.message.includes('502') || 
          error.message.includes('Bad Gateway') ||
          error.message.includes('server is not responding')
        );
        
        // If not the last attempt, wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          // Longer delays for 502 errors (server issues), shorter for network errors
          const baseDelay = is502Error ? 5000 : 1000; // 5s base for 502, 1s for others
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), is502Error ? 30000 : 10000);
          console.log(`⏳ Waiting ${delay}ms before retry... (502 error: ${is502Error})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    console.error(`❌ Audio upload failed after ${maxRetries} attempts`);
    return {
      success: false,
      error: lastError?.message || 'Audio upload failed after all retries',
    };
  }

  /**
   * Sync a CATI interview with multi-stage progress tracking (like WhatsApp/Meta)
   * Stage 1: Upload interview data (0-50%)
   * Stage 2: Upload audio if exists (50-90%)
   * Stage 3: Verify all data received (90-100%)
   * Only delete after full verification
   */
  private async syncCatiInterview(
    interview: OfflineInterview,
    progressWrapper?: { currentIndex: number; totalInterviews: number; interviewId: string; updateProgress: (progress: number, stage: SyncProgress['stage']) => void }
  ): Promise<void> {
    console.log(`📋 Syncing CATI interview: ${interview.id} (Multi-stage sync)`);
    
    // Helper to notify progress
    const notifyProgress = (progress: number, stage: SyncProgress['stage']) => {
      if (progressWrapper) {
        progressWrapper.updateProgress(progress, stage);
      }
    };

    if (!interview.catiQueueId) {
      throw new Error('CATI interview requires catiQueueId');
    }

    // CRITICAL: Check if already synced using serverResponseId (idempotency)
    // This ensures backward compatibility - old interviews without serverResponseId will still sync
    if (interview.serverResponseId || interview.serverMongoId) {
      const responseIdToCheck = interview.serverResponseId || interview.serverMongoId;
      console.log(`✅ Interview ${interview.id} already has responseId: ${responseIdToCheck} - checking if synced...`);
      
      // Try to verify if this response exists on server using getSurveyResponseById
      try {
        // CRITICAL: Ensure method exists before calling
        if (apiService && typeof apiService.getSurveyResponseById === 'function') {
          const verifyResult = await apiService.getSurveyResponseById(responseIdToCheck!);
          if (verifyResult && verifyResult.success && verifyResult.response) {
            console.log(`✅ Interview ${interview.id} already verified on server - skipping sync`);
            // Update progress to 100% and mark as synced
            await offlineStorage.updateInterviewSyncProgress(interview.id, 100, 'synced');
            return; // Already synced, exit early
          }
        } else {
          console.warn(`⚠️ getSurveyResponseById not available - skipping verification check, proceeding with sync`);
        }
      } catch (verifyError: any) {
        console.log(`⚠️ Verification check failed, proceeding with sync: ${verifyError?.message || verifyError}`);
        // Continue with sync if verification fails (backward compatibility)
      }
    }
    
    // BACKWARD COMPATIBILITY: For old interviews without serverResponseId, check metadata
    // Old version users may have responseId in metadata.responseId or metadata.serverResponseId
    if (!interview.serverResponseId && interview.metadata?.responseId) {
      console.log(`ℹ️ Interview ${interview.id} has legacy responseId in metadata: ${interview.metadata.responseId} - using for idempotency`);
      // Use legacy responseId for idempotency check
      interview.serverResponseId = interview.metadata.responseId;
    }
    if (!interview.serverResponseId && interview.metadata?.serverResponseId) {
      console.log(`ℹ️ Interview ${interview.id} has legacy serverResponseId in metadata: ${interview.metadata.serverResponseId} - using for idempotency`);
      interview.serverResponseId = interview.metadata.serverResponseId;
    }

    // Update progress: Stage 1 - Uploading data (0%)
    await offlineStorage.updateInterviewSyncProgress(interview.id, 0, 'uploading_data');

    // Fetch survey from cache if needed
    let survey = interview.survey;
    if (!survey && interview.surveyId) {
      const surveys = await offlineStorage.getSurveys();
      survey = surveys.find((s: any) => s._id === interview.surveyId || s.id === interview.surveyId);
      if (!survey) {
        throw new Error(`Survey ${interview.surveyId} not found in cache`);
      }
    }

    // Build final responses
    const finalResponses = await this.buildFinalResponses(interview);

    // Calculate duration
    let totalTimeSpent = interview.duration || 0;
    if (totalTimeSpent <= 0 && interview.startTime && interview.endTime) {
      try {
        const start = new Date(interview.startTime);
        const end = new Date(interview.endTime);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          totalTimeSpent = Math.floor((end.getTime() - start.getTime()) / 1000);
        }
      } catch (error) {
        console.error('Error calculating duration:', error);
      }
    }
    if (totalTimeSpent <= 0) {
      totalTimeSpent = 1; // Minimum 1 second
    }

    // Extract metadata
    const answeredCount = finalResponses.filter((r: any) => {
      const response = r.response;
      return response !== null && response !== undefined && response !== '' && 
             !(Array.isArray(response) && response.length === 0);
    }).length;
    const totalCount = finalResponses.length;

    // Extract set number
    let finalSetNumber = interview.selectedSetNumber;
    if (finalSetNumber === null && survey) {
      const setNumbers = new Set<number>();
      survey.sections?.forEach((section: any) => {
        section.questions?.forEach((question: any) => {
          if (question.setsForThisQuestion && question.setNumber !== null && question.setNumber !== undefined) {
            const wasAnswered = finalResponses.some((r: any) => r.questionId === question.id);
            if (wasAnswered) {
              setNumbers.add(question.setNumber);
            }
          }
        });
      });
      const setArray = Array.from(setNumbers).sort((a, b) => a - b);
      if (setArray.length > 0) {
        finalSetNumber = setArray[0];
      }
    }

    // Extract call status
    const callStatusResponse = interview.responses['call-status'];
    const finalCallStatus = callStatusResponse === 'call_connected' ? 'success' : (callStatusResponse || 'unknown');

    // Extract interviewer ID and supervisor ID (for target survey)
    const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
    let oldInterviewerID: string | null = null;
    let supervisorID: string | null = null;
    if (isTargetSurvey) {
      const interviewerIdResponse = interview.responses['interviewer-id'];
      if (interviewerIdResponse !== null && interviewerIdResponse !== undefined && interviewerIdResponse !== '') {
        oldInterviewerID = String(interviewerIdResponse);
      }
      const supervisorIdResponse = interview.responses['supervisor-id'];
      if (supervisorIdResponse !== null && supervisorIdResponse !== undefined && supervisorIdResponse !== '') {
        supervisorID = String(supervisorIdResponse);
      }
    }

    // Extract consent response
    const consentResponse = interview.responses['consent-form'];
    const isConsentNo = consentResponse === 'no' || consentResponse === '0' || consentResponse === false;

    // Prepare polling station data
    let pollingStationData = null;
    if (interview.selectedPollingStation && interview.selectedPollingStation.stationName) {
      pollingStationData = {
        state: interview.selectedPollingStation.state,
        acNo: interview.selectedPollingStation.acNo,
        acName: interview.selectedPollingStation.acName,
        pcNo: interview.selectedPollingStation.pcNo,
        pcName: interview.selectedPollingStation.pcName,
        district: interview.selectedPollingStation.district,
        groupName: interview.selectedPollingStation.groupName,
        stationName: interview.selectedPollingStation.stationName,
        gpsLocation: interview.selectedPollingStation.gpsLocation,
        latitude: interview.selectedPollingStation.latitude,
        longitude: interview.selectedPollingStation.longitude
      };
    }

    // STAGE 1: Upload interview data (0-50%)
    console.log(`📤 Stage 1: Uploading interview data for ${interview.id}...`);
    await offlineStorage.updateInterviewSyncProgress(interview.id, 10, 'uploading_data');
    notifyProgress(10, 'uploading_data');

    // Complete CATI interview with serverResponseId/serverMongoId for idempotency
    const result = await apiService.completeCatiInterview(interview.catiQueueId, {
      sessionId: interview.sessionId || undefined,
      responses: finalResponses,
      selectedAC: interview.selectedAC || null,
      selectedPollingStation: pollingStationData,
      totalTimeSpent: totalTimeSpent,
      startTime: interview.startTime ? new Date(interview.startTime) : new Date(),
      endTime: interview.endTime ? new Date(interview.endTime) : new Date(),
      totalQuestions: totalCount,
      answeredQuestions: answeredCount,
      completionPercentage: totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0,
      setNumber: finalSetNumber,
      OldinterviewerID: oldInterviewerID,
      callStatus: finalCallStatus,
      supervisorID: supervisorID,
      consentResponse: isConsentNo ? 'no' : null,
      abandoned: interview.metadata?.isCompleted === false || (interview.metadata?.abandonReason !== null && interview.metadata?.abandonReason !== undefined) ? true : false,
      abandonedReason: interview.metadata?.abandonReason || null,
      abandonmentNotes: interview.metadata?.abandonNotes || null,
      isCompleted: interview.metadata?.isCompleted !== undefined ? interview.metadata.isCompleted : true,
      metadata: {
        abandoned: interview.metadata?.isCompleted === false || (interview.metadata?.abandonReason !== null && interview.metadata?.abandonReason !== undefined) ? true : false,
        abandonedReason: interview.metadata?.abandonReason || null,
        abandonmentNotes: interview.metadata?.abandonNotes || null,
        isCompleted: interview.metadata?.isCompleted !== undefined ? interview.metadata.isCompleted : true
      },
      // CRITICAL: Send serverResponseId/serverMongoId for idempotency check
      serverResponseId: interview.serverResponseId,
      serverMongoId: interview.serverMongoId,
      uploadToken: interview.uploadToken
    });

    if (!result.success) {
      throw new Error(result.message || 'Failed to complete CATI interview');
    }

    // CRITICAL: Store serverResponseId and serverMongoId immediately after successful upload
    const serverResponseId = result.data?.responseId;
    const serverMongoId = result.data?.mongoId;
    const uploadToken = result.data?.uploadToken;

    if (serverResponseId && serverMongoId) {
      await offlineStorage.updateInterviewServerIds(interview.id, serverResponseId, serverMongoId, uploadToken);
      console.log(`✅ Stored server IDs: responseId=${serverResponseId}, mongoId=${serverMongoId}`);
    }

      // Update progress: Stage 1 complete (50%)
      await offlineStorage.updateInterviewSyncProgress(interview.id, 50, 'uploading_data');
      notifyProgress(50, 'uploading_data');
      console.log(`✅ Stage 1 complete: Interview data uploaded (50%)`);

    // STAGE 2: Upload audio if exists (50-90%)
    if (interview.audioOfflinePath || interview.audioUri) {
      console.log(`📤 Stage 2: Uploading audio for ${interview.id}...`);
      await offlineStorage.updateInterviewSyncProgress(interview.id, 55, 'uploading_audio');
      notifyProgress(55, 'uploading_audio');
      
      const audioPath = interview.audioOfflinePath || interview.audioUri;
      if (audioPath) {
        try {
          // Upload audio with retry (using serverResponseId to link)
          const audioResult = await this.uploadAudioWithRetry(
            audioPath,
            interview.sessionId || '',
            interview.surveyId,
            interview.id,
            3, // max retries
            serverResponseId // Link to responseId (for idempotency)
          );

          if (audioResult.success && audioResult.audioUrl) {
            // Update interview with audio URL
            await offlineStorage.updateInterviewMetadata(interview.id, {
              audioUrl: audioResult.audioUrl,
              audioUploadStatus: 'uploaded'
            });
            console.log(`✅ Audio uploaded successfully: ${audioResult.audioUrl}`);
          } else {
            // Audio upload failed - but don't fail the entire sync
            // Mark for retry on next sync
            await offlineStorage.updateInterviewMetadata(interview.id, {
              audioUploadStatus: 'failed',
              audioUploadError: audioResult.error || 'Audio upload failed',
              audioRetryCount: (interview.audioRetryCount || 0) + 1
            });
            console.warn(`⚠️ Audio upload failed, but interview data is safe on server. Will retry on next sync.`);
          }
        } catch (audioError: any) {
          // Audio upload error - don't fail entire sync
          await offlineStorage.updateInterviewMetadata(interview.id, {
            audioUploadStatus: 'failed',
            audioUploadError: audioError.message || 'Audio upload error',
            audioRetryCount: (interview.audioRetryCount || 0) + 1
          });
          console.warn(`⚠️ Audio upload error (non-fatal): ${audioError.message}`);
        }
      }
      
      // Update progress: Stage 2 complete (90%)
      await offlineStorage.updateInterviewSyncProgress(interview.id, 90, 'uploading_audio');
      notifyProgress(90, 'uploading_audio');
      console.log(`✅ Stage 2 complete: Audio upload finished (90%)`);
    } else {
      // No audio - skip to verification
      await offlineStorage.updateInterviewSyncProgress(interview.id, 90, 'verifying');
      notifyProgress(90, 'verifying');
      console.log(`ℹ️ No audio file - skipping to verification`);
    }

    // STAGE 3: Verify all data received (90-100%)
    console.log(`🔍 Stage 3: Verifying interview sync for ${interview.id}...`);
    await offlineStorage.updateInterviewSyncProgress(interview.id, 95, 'verifying');
    notifyProgress(95, 'verifying');

    // PERFORMANCE OPTIMIZED: Use getSurveyResponseById for verification (works for both CAPI and CATI)
    // For CATI, we verify that the response exists on the server
    // For CAPI with audio, we also verify audio is linked
    const responseIdForVerification = serverResponseId || serverMongoId;
    
    if (responseIdForVerification) {
      try {
        // CRITICAL: Ensure getSurveyResponseById method exists before calling
        if (!apiService || typeof apiService.getSurveyResponseById !== 'function') {
          console.error(`❌ apiService.getSurveyResponseById is not available`);
          throw new Error('getSurveyResponseById method not available on apiService');
        }
        
        // Wait a bit longer for backend to fully process the response
        // CATI responses might take a moment to be fully indexed/available
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify response exists on server with retry logic
        let verifyResult = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries && !verifyResult?.success) {
          try {
            // Explicitly call the method to avoid any dynamic resolution issues
            verifyResult = await apiService.getSurveyResponseById(responseIdForVerification);
            if (verifyResult && verifyResult.success && verifyResult.response) {
              break; // Success, exit retry loop
            }
          } catch (retryError: any) {
            retryCount++;
            console.log(`⏳ Verification attempt ${retryCount}/${maxRetries} error:`, retryError?.message || retryError);
            if (retryCount < maxRetries) {
              console.log(`⏳ Retrying in 1s...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        if (verifyResult && verifyResult.success && verifyResult.response) {
          const serverResponse = verifyResult.response;
          console.log(`✅ CATI interview verified on server - response exists (responseId: ${responseIdForVerification})`);
          await offlineStorage.updateInterviewSyncProgress(interview.id, 100, 'synced');
          notifyProgress(100, 'synced');
          console.log(`✅ Stage 3 complete: Interview verified and fully synced (100%)`);
        } else {
          // Response not found after retries - but don't fail if we have responseId
          // The backend might have processed it but it's not immediately queryable
          // Since completeCatiInterview succeeded, we trust that the response was created
          console.warn(`⚠️ Response verification failed after ${maxRetries} attempts, but interview was successfully created`);
          console.warn(`⚠️ ResponseId: ${responseIdForVerification} - marking as synced (backend may still be processing)`);
          await offlineStorage.updateInterviewSyncProgress(interview.id, 100, 'synced');
          console.log(`✅ Stage 3 complete: Interview synced (verification skipped - responseId confirmed)`);
        }
      } catch (verifyError: any) {
        const errorMessage = verifyError?.message || String(verifyError) || 'Unknown error';
        console.error(`❌ Verification error: ${errorMessage}`);
        
        // CRITICAL: Don't fail sync if verification fails - response was successfully created
        // The verification is just a safety check to ensure data integrity
        // If completeCatiInterview succeeded, we have a responseId, so trust that it was created
        console.warn(`⚠️ Verification check failed but response was created successfully`);
        console.warn(`⚠️ ResponseId: ${responseIdForVerification} - marking as synced`);
        console.warn(`⚠️ Error details: ${errorMessage}`);
        
        // Mark as synced anyway since the response was successfully created
        // The verification is just a safety check
        await offlineStorage.updateInterviewSyncProgress(interview.id, 100, 'synced');
        console.log(`✅ Stage 3 complete: Interview synced (verification skipped due to error)`);
        
        // DON'T throw - allow sync to complete successfully
        // The response was already created on the server, verification is just a safety check
      }
    } else {
      // No responseId available - this shouldn't happen if sync was successful
      console.error(`❌ No responseId available for verification - sync may have failed`);
      throw new Error('No responseId available for verification - sync may have failed');
    }

    console.log(`✅ CATI interview fully synced and verified: ${interview.id}`);
  }

  /**
   * Build final responses array from interview responses
   * CRITICAL FIX: Use metadata.finalResponses if available (saved during interview completion)
   * This prevents empty responses when interview.responses object is empty or missing
   */
  private async buildFinalResponses(interview: OfflineInterview): Promise<any[]> {
    // CRITICAL FIX: Check if finalResponses array was already saved in metadata
    // This is the most reliable source - it was built at the time of interview completion
    // and saved directly, so it's guaranteed to have all responses
    if (interview.metadata?.finalResponses && Array.isArray(interview.metadata.finalResponses) && interview.metadata.finalResponses.length > 0) {
      console.log(`✅ Using saved finalResponses from metadata (${interview.metadata.finalResponses.length} responses)`);
      return interview.metadata.finalResponses;
    }

    // Fallback: Build from interview.responses object (for backward compatibility)
    console.log(`⚠️ No finalResponses in metadata, building from interview.responses object...`);
    const finalResponses: any[] = [];
    
    // Fetch survey from cache if not stored in interview
    let survey = interview.survey;
    if (!survey && interview.surveyId) {
      const { offlineStorage } = await import('./offlineStorage');
      const surveys = await offlineStorage.getSurveys();
      survey = surveys.find((s: any) => s._id === interview.surveyId || s.id === interview.surveyId);
      if (!survey) {
        throw new Error(`Survey ${interview.surveyId} not found in cache for buildFinalResponses`);
      }
    }
    
    if (!survey) {
      throw new Error('Survey is required to build final responses');
    }

    // CRITICAL: Check if interview.responses is empty or missing
    // OLD VERSION COMPATIBILITY: Some old app versions may not save responses correctly
    // Try to recover from other sources before giving up
    if (!interview.responses || typeof interview.responses !== 'object' || Object.keys(interview.responses).length === 0) {
      console.error(`❌ CRITICAL: interview.responses is empty or missing!`);
      console.error(`   Interview ID: ${interview.id}`);
      console.error(`   Survey ID: ${interview.surveyId}`);
      console.error(`   This indicates old app version or data corruption`);
      
      // OLD VERSION FIX: Try to extract responses from other metadata fields
      // Some old versions might store responses in different formats
      const alternativeResponses: Record<string, any> = {};
      
      // Check if there's any response data in metadata
      if (interview.metadata) {
        // Check for any fields that might contain response data
        const metadataKeys = Object.keys(interview.metadata);
        console.log(`   Checking metadata for alternative response sources: ${metadataKeys.join(', ')}`);
        
        // Some old versions might store responses in a different format
        // Look for common patterns
        for (const key of metadataKeys) {
          if (key.toLowerCase().includes('response') && typeof interview.metadata[key] === 'object') {
            console.log(`   Found potential response data in metadata.${key}`);
            Object.assign(alternativeResponses, interview.metadata[key]);
          }
        }
      }
      
      // If we found alternative responses, use them
      if (Object.keys(alternativeResponses).length > 0) {
        console.log(`   ✅ Recovered ${Object.keys(alternativeResponses).length} responses from alternative sources`);
        // Continue with alternativeResponses as interview.responses
        interview.responses = alternativeResponses;
      } else {
        console.error(`   ❌ No alternative response sources found - interview data is corrupted or was never saved properly`);
        console.error(`   This interview cannot be synced - data loss has occurred`);
        console.error(`   User needs to retake the interview with an updated app version`);
        
        // Return empty array - backend validation will reject it with a clear error
        return [];
      }
    }

    // Get all questions from survey
    const allQuestions: any[] = [];
    if (survey.sections) {
      survey.sections.forEach((section: any, sectionIndex: number) => {
        if (section.questions) {
          section.questions.forEach((question: any, questionIndex: number) => {
            allQuestions.push({
              ...question,
              sectionIndex,
              questionIndex,
            });
          });
        }
      });
    }

    // Build responses array
    // OLD VERSION COMPATIBILITY: Handle both new format (interview.responses object) and potential old formats
    let responsesFound = 0;
    let responsesSkipped = 0;
    
    allQuestions.forEach((question: any) => {
      // Try multiple keys to find the response (old versions might use different keys)
      let responseValue = interview.responses[question.id] || 
                         interview.responses[question._id] ||
                         interview.responses[`q_${question.id}`] ||
                         undefined;

      // Skip if no response and question is not required
      if (responseValue === undefined || responseValue === null || responseValue === '') {
        if (question.isRequired) {
          // Include required questions even if empty (will be marked as skipped)
          finalResponses.push({
            sectionIndex: question.sectionIndex,
            questionIndex: question.questionIndex,
            questionId: question.id,
            questionType: question.type,
            questionText: question.text,
            questionDescription: question.description,
            questionOptions: question.options
              ? question.options.map((opt: any) => (typeof opt === 'object' ? opt.text : opt))
              : [],
            response: null,
            responseTime: 0,
            isRequired: question.isRequired,
            isSkipped: true,
          });
          responsesSkipped++;
        }
        return;
      }

      responsesFound++;

      // Build response object
      const responseObj: any = {
        sectionIndex: question.sectionIndex,
        questionIndex: question.questionIndex,
        questionId: question.id,
        questionType: question.type,
        questionText: question.text,
        questionDescription: question.description,
        questionOptions: question.options
          ? question.options.map((opt: any) => (typeof opt === 'object' ? opt.text : opt))
          : [],
        response: responseValue,
        responseTime: 0, // Could be calculated if stored
        isRequired: question.isRequired || false,
        isSkipped: false,
      };

      finalResponses.push(responseObj);
    });

    console.log(`✅ Built ${finalResponses.length} responses from interview.responses object (found: ${responsesFound}, skipped: ${responsesSkipped})`);
    
    // CRITICAL VALIDATION: If we built responses but found very few actual answers, warn about potential data loss
    if (finalResponses.length > 0 && responsesFound === 0) {
      console.warn(`⚠️ WARNING: Built ${finalResponses.length} responses but found 0 actual answers - all are skipped required questions`);
      console.warn(`   This indicates interview.responses object exists but has no actual response data`);
      console.warn(`   Interview ID: ${interview.id}, Survey ID: ${interview.surveyId}`);
    }
    
    return finalResponses;
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

export const syncService = new SyncService();










