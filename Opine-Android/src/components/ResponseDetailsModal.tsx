import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  Alert,
  TouchableOpacity,
  PanResponder,
  StatusBar,
  Platform,
  AppState,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray, fromByteArray } from 'base64-js';
import {
  Text,
  Card,
  Button,
  TextInput,
  RadioButton,
  Divider,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { apiService } from '../services/api';
import { findGenderResponse, normalizeGenderResponse } from '../utils/genderUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface ResponseDetailsModalProps {
  visible: boolean;
  interview: any;
  onClose: () => void;
  onSubmit: (verificationData: any) => void;
  onSkip?: () => void;
  assignmentExpiresAt?: Date | null;
}

export default function ResponseDetailsModal({
  visible,
  interview,
  onClose,
  onSubmit,
  onSkip,
  assignmentExpiresAt
}: ResponseDetailsModalProps) {
  const [verificationForm, setVerificationForm] = useState({
    audioStatus: '',
    genderMatching: '',
    upcomingElectionsMatching: '',
    previousElectionsMatching: '',
    previousLoksabhaElectionsMatching: '',
    nameMatching: '',
    ageMatching: '',
    phoneNumberAsked: '',
    customFeedback: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPosition, setAudioPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0); // Playback speed (1.0 = normal, 0.5 = half, 2.0 = double)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false); // OPTIMIZED: Track audio loading state
  const sliderRef = useRef<View>(null);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [catiCallDetails, setCatiCallDetails] = useState<any>(null);
  const [catiRecordingUri, setCatiRecordingUri] = useState<string | null>(null);
  const [loadingCatiRecording, setLoadingCatiRecording] = useState(false);
  const [catiAudioSound, setCatiAudioSound] = useState<Audio.Sound | null>(null);
  const [isPlayingCatiAudio, setIsPlayingCatiAudio] = useState(false);
  const [catiAudioPosition, setCatiAudioPosition] = useState(0);
  const [catiAudioDuration, setCatiAudioDuration] = useState(0);
  const [catiPlaybackRate, setCatiPlaybackRate] = useState(1.0);
  const [catiIsSeeking, setCatiIsSeeking] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [responsesSectionExpanded, setResponsesSectionExpanded] = useState(false);
  
  // Use ref to store audio sound to avoid dependency cycles
  const audioSoundRef = useRef<Audio.Sound | null>(null);
  const catiAudioSoundRef = useRef<Audio.Sound | null>(null);
  const catiSliderRef = useRef<View>(null);
  const [catiSliderWidth, setCatiSliderWidth] = useState(0);
  
  // CRITICAL FIX: Operation locks to prevent race conditions and concurrent async operations
  const audioOperationLockRef = useRef<boolean>(false);
  const catiAudioOperationLockRef = useRef<boolean>(false);
  const seekDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const catiSeekDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update ref whenever audioSound state changes
  useEffect(() => {
    audioSoundRef.current = audioSound;
  }, [audioSound]);

  // Update ref whenever catiAudioSound state changes
  useEffect(() => {
    catiAudioSoundRef.current = catiAudioSound;
  }, [catiAudioSound]);
  
  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (seekDebounceTimerRef.current) {
        clearTimeout(seekDebounceTimerRef.current);
      }
      if (catiSeekDebounceTimerRef.current) {
        clearTimeout(catiSeekDebounceTimerRef.current);
      }
    };
  }, []);

  // Function to stop and cleanup audio completely (using ref to avoid dependency cycles)
  const cleanupAudio = useCallback(async () => {
    const currentAudio = audioSoundRef.current;
    if (currentAudio) {
      try {
        const status = await currentAudio.getStatusAsync();
        if (status.isLoaded) {
          // CRITICAL FIX: Always stop before unloading to prevent audio from continuing
          try {
            await currentAudio.stopAsync(); // Stop first (even if not playing, ensures cleanup)
          } catch (stopError) {
            console.error('Error stopping audio during cleanup:', stopError);
          }
          // Unload the sound
          await currentAudio.unloadAsync();
        }
      } catch (error) {
        console.error('Error cleaning up audio:', error);
        // Force unload even if there's an error
        try {
          await currentAudio.stopAsync(); // Try to stop first
          await currentAudio.unloadAsync();
        } catch (unloadError) {
          console.error('Error force unloading audio:', unloadError);
        }
      }
      audioSoundRef.current = null;
    }
    // Reset audio playback state, but preserve capiAudioUriRef for restoration
    setAudioSound(null);
    setIsPlaying(false);
    setAudioPosition(0);
    setAudioDuration(0);
    setPlaybackRate(1.0);
    setIsLoadingAudio(false);
    // Note: We DON'T clear capiAudioUriRef or capiAudioResponseIdRef here
    // They are preserved so audio can be restored after lock/unlock
  }, []); // Empty dependency array - uses ref instead

  // Function to stop CATI audio playback only (preserves state for restoration)
  const stopCatiAudio = useCallback(async () => {
    const currentAudio = catiAudioSoundRef.current;
    if (currentAudio) {
      try {
        const status = await currentAudio.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await currentAudio.stopAsync();
          }
          await currentAudio.unloadAsync();
        }
      } catch (error) {
        console.error('Error stopping CATI audio:', error);
        try {
          await currentAudio.unloadAsync();
        } catch (unloadError) {
          console.error('Error force unloading CATI audio:', unloadError);
        }
      }
      catiAudioSoundRef.current = null;
      setCatiAudioSound(null);
    }
    // Only stop playback, don't reset position/duration/URI - preserve for restoration
    setIsPlayingCatiAudio(false);
  }, []);

  // Function to stop and cleanup CATI audio (full cleanup - used when modal closes or interview changes)
  const cleanupCatiAudio = useCallback(async () => {
    const currentAudio = catiAudioSoundRef.current;
    if (currentAudio) {
      try {
        const status = await currentAudio.getStatusAsync();
        if (status.isLoaded) {
          // CRITICAL FIX: Always stop before unloading to prevent audio from continuing
          try {
            await currentAudio.stopAsync(); // Stop first (even if not playing, ensures cleanup)
          } catch (stopError) {
            console.error('Error stopping CATI audio during cleanup:', stopError);
          }
          await currentAudio.unloadAsync();
        }
      } catch (error) {
        console.error('Error cleaning up CATI audio:', error);
        try {
          await currentAudio.stopAsync(); // Try to stop first
          await currentAudio.unloadAsync();
        } catch (unloadError) {
          console.error('Error force unloading CATI audio:', unloadError);
        }
      }
      catiAudioSoundRef.current = null;
    }
    // Always reset all CATI audio state, even if no audio was loaded
    setCatiAudioSound(null);
    setIsPlayingCatiAudio(false);
    setCatiAudioPosition(0);
    setCatiAudioDuration(0);
    setCatiPlaybackRate(1.0);
    setLoadingCatiRecording(false);
    // Note: We preserve catiRecordingUri and catiCallDetails for restoration
  }, []);

  // Store the call_id associated with the current catiRecordingUri to prevent resetting on re-render
  const catiRecordingUriCallIdRef = useRef<string | null>(null);
  // Store the responseId and audio URI for CAPI audio to prevent re-loading after lock/unlock
  const capiAudioUriRef = useRef<string | null>(null);
  const capiAudioResponseIdRef = useRef<string | null>(null);

  // OPTIMIZED: Lazy load audio and CATI details - don't block modal opening
  useEffect(() => {
    if (!visible || !interview) {
      // CRITICAL FIX: Cleanup when modal closes or interview is not available
      // Use immediate stop to prevent audio from continuing to play
      (async () => {
        // Immediately stop all audio playback (blocking)
        try {
          const capiAudio = audioSoundRef.current;
          const catiAudio = catiAudioSoundRef.current;
          
          // Stop CAPI audio immediately
          if (capiAudio) {
            try {
              const status = await capiAudio.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                await capiAudio.stopAsync(); // Stop immediately
              }
            } catch (error) {
              console.error('Error stopping CAPI audio:', error);
            }
          }
          
          // Stop CATI audio immediately
          if (catiAudio) {
            try {
              const status = await catiAudio.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                await catiAudio.stopAsync(); // Stop immediately
              }
            } catch (error) {
              console.error('Error stopping CATI audio:', error);
            }
          }
        } catch (error) {
          console.error('Error in immediate audio stop:', error);
        }
        
        // Then cleanup fully
        await Promise.all([
          cleanupAudio(),
          cleanupCatiAudio()
        ]);
        // Clear debounce timers
        if (seekDebounceTimerRef.current) {
          clearTimeout(seekDebounceTimerRef.current);
          seekDebounceTimerRef.current = null;
        }
        if (catiSeekDebounceTimerRef.current) {
          clearTimeout(catiSeekDebounceTimerRef.current);
          catiSeekDebounceTimerRef.current = null;
        }
      })();
      setCatiCallDetails(null);
      setCatiRecordingUri(null);
      catiRecordingUriCallIdRef.current = null;
      capiAudioUriRef.current = null;
      capiAudioResponseIdRef.current = null;
      return;
    }

    const currentCallId = interview.call_id;
    const currentResponseId = interview?.responseId;
    const isNewInterview = catiRecordingUriCallIdRef.current !== currentCallId;

    // Only cleanup audio state when interview actually changes (different call_id)
    // This prevents resetting state when component re-renders after unlocking screen
    if (isNewInterview) {
      console.log('🔄 Interview changed - cleaning up previous audio state');
      // CRITICAL FIX: Immediately stop and cleanup previous audio before loading new interview
      (async () => {
        // Stop audio immediately to prevent overlap
        try {
          const capiAudio = audioSoundRef.current;
          const catiAudio = catiAudioSoundRef.current;
          
          if (capiAudio) {
            try {
              const status = await capiAudio.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                await capiAudio.stopAsync();
              }
            } catch (error) {
              console.error('Error stopping previous CAPI audio:', error);
            }
          }
          
          if (catiAudio) {
            try {
              const status = await catiAudio.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                await catiAudio.stopAsync();
              }
            } catch (error) {
              console.error('Error stopping previous CATI audio:', error);
            }
          }
        } catch (error) {
          console.error('Error in immediate audio stop on interview change:', error);
        }
        
        // Then cleanup fully
        await Promise.all([
          cleanupAudio(),
          cleanupCatiAudio()
        ]);
      })();
      // Reset CATI call details when interview changes to prevent showing stale data
      setCatiCallDetails(null);
      // Only reset URI if it's for a different call
      if (catiRecordingUriCallIdRef.current && catiRecordingUriCallIdRef.current !== currentCallId) {
        setCatiRecordingUri(null);
      }
      catiRecordingUriCallIdRef.current = currentCallId;
      // Reset CAPI audio URI if responseId changed
      const currentResponseId = interview?.responseId;
      if (capiAudioResponseIdRef.current && capiAudioResponseIdRef.current !== currentResponseId) {
        capiAudioUriRef.current = null;
        capiAudioResponseIdRef.current = null;
      }
    } else {
      console.log('✅ Same interview - preserving audio state');
      console.log('💾 Preserved state:', {
        catiRecordingUri,
        storedCallId: catiRecordingUriCallIdRef.current,
        hasCallDetails: !!catiCallDetails,
        capiAudioUri: capiAudioUriRef.current,
        capiResponseId: capiAudioResponseIdRef.current
      });
      // Same interview - preserve catiRecordingUri, catiCallDetails, and CAPI audio URI
      // Only cleanup audio playback, not the state
      cleanupAudio();
      // For CATI, only stop playback if it's playing, don't reset state
      if (catiAudioSoundRef.current) {
        stopCatiAudio();
      }
      // IMPORTANT: Don't reset catiCallDetails, catiRecordingUri, or capiAudioUri for same interview
      // This ensures the UI can still show the recording section even after re-render
    }
      
    // OPTIMIZED: Don't load audio immediately - lazy load when user clicks play
    // This prevents blocking the modal opening
    // Audio will be loaded on-demand in playAudio() function
      
    // OPTIMIZED: Lazy load CATI details after modal is visible (non-blocking)
    // Use setTimeout to defer this until after modal renders
    if (interview.interviewMode === 'cati' && interview.call_id) {
      // Defer CATI details fetch to avoid blocking modal opening
      setTimeout(async () => {
        // First, check if we already have a local file for this call (from previous session)
        // This handles the case where the user locked screen and came back
        if (catiRecordingUri && catiRecordingUriCallIdRef.current === interview.call_id) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(catiRecordingUri);
            if (fileInfo.exists) {
              console.log('🔄 Found existing local CATI audio file for same call, restoring:', catiRecordingUri);
              // Restore audio from local file if not already loaded
              if (!catiAudioSound) {
                await loadCatiAudio(catiRecordingUri);
              }
              // Always fetch call details for metadata (even if we have URI) to ensure UI shows properly
              // This is important because catiCallDetails might have been reset on re-render
              if (!catiCallDetails) {
                console.log('📋 Fetching call details to restore UI state');
                fetchCatiCallDetails(interview.call_id);
              }
              return;
            } else {
              console.log('⚠️ Previous local file no longer exists, will fetch fresh');
              setCatiRecordingUri(null);
              catiRecordingUriCallIdRef.current = null;
            }
          } catch (error) {
            console.error('Error checking existing local file:', error);
            setCatiRecordingUri(null);
            catiRecordingUriCallIdRef.current = null;
          }
        }
        // Fetch call details (will trigger audio download if needed)
        // Always fetch if we don't have call details, even if we have a URI
        // This ensures the UI can display properly
        if (!catiCallDetails) {
          fetchCatiCallDetails(interview.call_id);
        }
      }, 100); // Small delay to let modal render first
    }

    // PERFORMANCE FIX: Auto-load CAPI audio when modal opens (similar to CATI)
    // This matches the behavior where CATI audio automatically downloads
    if (interview.interviewMode === 'capi') {
      // Defer CAPI audio load to avoid blocking modal opening
      setTimeout(async () => {
        // Check if we already have audio loaded for this response
        if (audioSoundRef.current && capiAudioResponseIdRef.current === interview?.responseId) {
          try {
            const status = await audioSoundRef.current.getStatusAsync();
            if (status.isLoaded) {
              console.log('✅ CAPI audio already loaded for this response');
              return; // Already loaded, no need to reload
            }
          } catch (error) {
            console.log('Audio status check failed, will reload:', error);
          }
        }

        // Check if we have a stored URI for this response
        if (capiAudioUriRef.current && capiAudioResponseIdRef.current === interview?.responseId) {
          console.log('🔄 Reloading CAPI audio from stored URI:', capiAudioUriRef.current);
          try {
            setIsLoadingAudio(true);
            await loadAudio(capiAudioUriRef.current);
            console.log('✅ CAPI audio reloaded from stored URI');
          } catch (error) {
            console.error('Error reloading CAPI audio from stored URI:', error);
            // If reload fails, try loading from original source
            capiAudioUriRef.current = null;
            capiAudioResponseIdRef.current = null;
          } finally {
            setIsLoadingAudio(false);
          }
          return;
        }

        // Auto-load CAPI audio from interview data (similar to CATI auto-download)
        // Check for signedUrl/proxyUrl first (preferred for S3), then fallback to audioUrl
        const signedUrl = interview.metadata?.audioRecording?.signedUrl || 
                         interview.audioRecording?.signedUrl ||
                         interview.signedUrl ||
                         interview.audioRecording?.proxyUrl; // Also check proxyUrl
        const audioUrl = interview.metadata?.audioRecording?.audioUrl || 
                        interview.audioUrl || 
                        interview.audioRecording?.url ||
                        interview.audioRecording?.audioUrl;
        
        // Use signedUrl/proxyUrl if available, otherwise use audioUrl
        const audioSource = signedUrl || audioUrl;
        
        if (audioSource) {
          console.log('📥 Auto-loading CAPI audio when modal opens (similar to CATI):', audioSource);
          setIsLoadingAudio(true);
          try {
            // loadAudio expects the audioUrl parameter, but it also uses interview from closure
            // Pass the audioSource which will be used to construct the full URL
            await loadAudio(audioSource);
            console.log('✅ CAPI audio auto-loaded successfully');
          } catch (error) {
            console.error('Error auto-loading CAPI audio:', error);
            // Don't show error to user - just log it
          } finally {
            setIsLoadingAudio(false);
          }
        } else {
          console.log('ℹ️ No CAPI audio URL available for auto-loading');
        }
      }, 100); // Small delay to let modal render first (same as CATI)
    }

    return () => {
      // CRITICAL: Cleanup audio on unmount or when modal closes
      if (!visible) {
        // Await cleanup to ensure audio is properly stopped
        (async () => {
          await Promise.all([
            cleanupAudio(),
            cleanupCatiAudio()
          ]);
          // Clear debounce timers
          if (seekDebounceTimerRef.current) {
            clearTimeout(seekDebounceTimerRef.current);
            seekDebounceTimerRef.current = null;
          }
          if (catiSeekDebounceTimerRef.current) {
            clearTimeout(catiSeekDebounceTimerRef.current);
            catiSeekDebounceTimerRef.current = null;
          }
        })();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, interview?.responseId, interview?.call_id]);

  // Listen to app state changes to stop audio when app goes to background and restore when coming back
  useEffect(() => {
    if (!visible) return; // Don't handle AppState changes when modal is closed
    
    let previousAppState = AppState.currentState;
    
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // CRITICAL FIX: Only handle AppState changes when modal is visible
      if (!visible) {
        previousAppState = nextAppState;
        return;
      }
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is going to background or closing - stop audio playback immediately
        console.log('🛑 App going to background/inactive - stopping audio playback immediately');
        try {
          // Stop audio immediately (blocking)
          const capiAudio = audioSoundRef.current;
          const catiAudio = catiAudioSoundRef.current;
          
          if (capiAudio) {
            try {
              const status = await capiAudio.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                await capiAudio.stopAsync();
              }
            } catch (error) {
              console.error('Error stopping CAPI audio on background:', error);
            }
          }
          
          if (catiAudio) {
            try {
              const status = await catiAudio.getStatusAsync();
              if (status.isLoaded && status.isPlaying) {
                await catiAudio.stopAsync();
              }
            } catch (error) {
              console.error('Error stopping CATI audio on background:', error);
            }
          }
        } catch (error) {
          console.error('Error stopping audio on background:', error);
        }
      } else if (nextAppState === 'active' && previousAppState === 'background') {
        // App is coming back to foreground - restore audio if it was previously loaded
        console.log('✅ App coming back to foreground - checking for audio restoration');
        
        // Restore CATI audio if we have a local file URI and modal is still visible
        // Also verify the URI is for the current call_id
        if (visible && interview?.interviewMode === 'cati' && catiRecordingUri && 
            catiRecordingUriCallIdRef.current === interview?.call_id) {
          console.log('🔍 AppState restoration check:', {
            visible,
            interviewMode: interview?.interviewMode,
            callId: interview?.call_id,
            storedCallId: catiRecordingUriCallIdRef.current,
            hasUri: !!catiRecordingUri
          });
          try {
            // Check if the local file still exists
            const fileInfo = await FileSystem.getInfoAsync(catiRecordingUri);
            if (fileInfo.exists) {
              console.log('🔄 Restoring CATI audio from local file:', catiRecordingUri);
              // Reload audio from the local file (no re-download needed)
              await loadCatiAudio(catiRecordingUri);
            } else {
              console.log('⚠️ Local CATI audio file no longer exists, will need to re-download');
              // File was deleted, clear the URI so it can be re-downloaded
              setCatiRecordingUri(null);
              catiRecordingUriCallIdRef.current = null;
            }
          } catch (error) {
            console.error('Error checking/restoring CATI audio file:', error);
            // If there's an error, clear the URI so it can be re-downloaded
            setCatiRecordingUri(null);
            catiRecordingUriCallIdRef.current = null;
          }
        }
        
        // Restore CAPI audio if we have the audio URI and modal is still visible
        // Also verify the URI is for the current responseId
        if (visible && interview?.interviewMode === 'capi' && capiAudioUriRef.current && 
            capiAudioResponseIdRef.current === interview?.responseId) {
          console.log('🔍 AppState restoration check (CAPI):', {
            visible,
            interviewMode: interview?.interviewMode,
            responseId: interview?.responseId,
            storedResponseId: capiAudioResponseIdRef.current,
            hasUri: !!capiAudioUriRef.current,
            hasAudioSound: !!audioSound
          });
          try {
            // Check if audio is still loaded
            if (audioSoundRef.current) {
              const status = await audioSoundRef.current.getStatusAsync();
              if (status.isLoaded) {
                console.log('✅ CAPI audio still loaded, no action needed');
                return;
              }
            }
            
            // Audio was unloaded, reload from the same URI (no re-download, uses cached URL)
            console.log('🔄 Reloading CAPI audio from stored URI:', capiAudioUriRef.current);
            await loadAudio(capiAudioUriRef.current);
          } catch (error) {
            console.error('Error checking/restoring CAPI audio:', error);
            // If there's an error, clear the URI so it can be re-loaded
            capiAudioUriRef.current = null;
            capiAudioResponseIdRef.current = null;
          }
        }
      }
      
      previousAppState = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [visible, interview?.interviewMode, interview?.responseId, interview?.call_id, catiRecordingUri, cleanupAudio, stopCatiAudio, loadCatiAudio, loadAudio]);

  // Helper function to format duration
  const formatDuration = (seconds: number): string => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const fetchCatiCallDetails = async (callId: string) => {
    try {
      const result = await apiService.getCatiCallById(callId);
      if (result.success && result.data) {
        const callData = result.data;
        setCatiCallDetails(callData);
        
        // LOG: Show which audio sources are available
        console.log('🎵 [AUDIO URL LOG] Quality Agent - CATI Call Details:');
        console.log('🎵 [AUDIO URL LOG] Call ID:', callId);
        console.log('🎵 [AUDIO URL LOG] S3 Audio URL:', callData.s3AudioUrl || 'NOT AVAILABLE');
        console.log('🎵 [AUDIO URL LOG] S3 Upload Status:', callData.s3AudioUploadStatus || 'NOT SET');
        console.log('🎵 [AUDIO URL LOG] DeepCall Recording URL:', callData.recordingUrl ? 'AVAILABLE' : 'NOT AVAILABLE');
        console.log('🎵 [AUDIO URL LOG] Audio Source Priority:', 
          callData.s3AudioUrl && callData.s3AudioUploadStatus === 'uploaded' 
            ? 'S3 (migrated)' 
            : callData.recordingUrl 
              ? 'DeepCall (fallback)' 
              : 'NONE');
        
        // CRITICAL: Check if we already have a local file for this call before downloading
        // This prevents re-downloading when app comes back from background
        if (catiRecordingUri && catiRecordingUriCallIdRef.current === callId) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(catiRecordingUri);
            if (fileInfo.exists) {
              console.log('✅ Already have local CATI audio file, skipping download:', catiRecordingUri);
              // Only load audio if not already loaded
              if (!catiAudioSound) {
                console.log('🔄 Loading audio from existing local file');
                await loadCatiAudio(catiRecordingUri);
              } else {
                console.log('✅ Audio already loaded, no action needed');
              }
              return; // Don't download again
            } else {
              console.log('⚠️ Local file no longer exists, will download');
              setCatiRecordingUri(null);
              catiRecordingUriCallIdRef.current = null;
            }
          } catch (error) {
            console.error('Error checking local file:', error);
            setCatiRecordingUri(null);
            catiRecordingUriCallIdRef.current = null;
          }
        }
        
        // Only fetch recording if recordingUrl is explicitly available AND we don't have local file
        // Don't fetch just based on _id to avoid unnecessary 404 errors
        if ((callData.recordingUrl || callData.s3AudioUrl) && !catiRecordingUri) {
          console.log('📥 No local file found, downloading recording...');
          await fetchCatiRecording(callData._id || callId);
        } else if (catiRecordingUri) {
          console.log('✅ Using existing local file, skipping download');
        }
      }
    } catch (error) {
      console.error('Error fetching CATI call details:', error);
    }
  };

  const fetchCatiRecording = async (callId: string) => {
    try {
      // CRITICAL: Check if we already have a local file for this call before downloading
      // This prevents re-downloading when app comes back from background or when play is clicked
      if (catiRecordingUri && catiRecordingUriCallIdRef.current === callId) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(catiRecordingUri);
          if (fileInfo.exists) {
            console.log('✅ Already have local CATI audio file, using it instead of downloading:', catiRecordingUri);
            // Only load audio if not already loaded
            if (!catiAudioSound) {
              console.log('🔄 Loading audio from existing local file');
              await loadCatiAudio(catiRecordingUri);
            } else {
              console.log('✅ Audio already loaded, no action needed');
            }
            return; // Don't download again
          } else {
            console.log('⚠️ Local file no longer exists, will download');
            setCatiRecordingUri(null);
            catiRecordingUriCallIdRef.current = null;
          }
        } catch (error) {
          console.error('Error checking local file:', error);
          setCatiRecordingUri(null);
          catiRecordingUriCallIdRef.current = null;
        }
      }
      
      setLoadingCatiRecording(true);
      
      // Use expo-file-system to download the recording directly
      // This is better for React Native than handling blobs
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('No auth token available');
        setLoadingCatiRecording(false);
        return;
      }

      const API_BASE_URL = 'https://convo.convergentview.com';
      const recordingUrl = `${API_BASE_URL}/api/cati/recording/${callId}`;
      
      // LOG: Show the API endpoint being called
      console.log('🎵 [AUDIO URL LOG] Quality Agent - Fetching CATI Recording:');
      console.log('🎵 [AUDIO URL LOG] API Endpoint:', recordingUrl);
      console.log('🎵 [AUDIO URL LOG] Note: Backend will prioritize S3 if available, fallback to DeepCall');
      
      // Download to a temporary file using legacy API
      const fileUri = `${FileSystem.cacheDirectory}cati_recording_${callId}_${Date.now()}.mp3`;
      
      try {
        const downloadResult = await FileSystem.downloadAsync(
          recordingUrl,
          fileUri,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (downloadResult.status === 200) {
          // LOG: Show successful download
          console.log('🎵 [AUDIO URL LOG] Quality Agent - Recording downloaded successfully');
          console.log('🎵 [AUDIO URL LOG] Local File URI:', downloadResult.uri);
          // Load the audio from the downloaded file
          await loadCatiAudio(downloadResult.uri);
        } else {
          console.error('Failed to download recording:', downloadResult.status);
          setLoadingCatiRecording(false);
        }
      } catch (downloadError: any) {
        // If legacy API fails, try using fetch as fallback
        console.log('Legacy downloadAsync failed, trying fetch approach...', downloadError);
        
        const response = await fetch(recordingUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setLoadingCatiRecording(false);
            return;
          }
          throw new Error(`Failed to download: ${response.status}`);
        }

        // Get the arrayBuffer and convert to base64 using base64-js (React Native compatible)
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        // Convert Uint8Array to base64 string using base64-js
        const base64 = fromByteArray(uint8Array);
        
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // LOG: Show successful download via fetch fallback
        console.log('🎵 [AUDIO URL LOG] Quality Agent - Recording downloaded via fetch fallback');
        console.log('🎵 [AUDIO URL LOG] Local File URI:', fileUri);
        
        await loadCatiAudio(fileUri);
      }
    } catch (error: any) {
      // Silently handle 404 errors (recording not available) - this is expected
      if (error?.response?.status === 404 || error?.status === 404 || error?.message?.includes('404')) {
        // Recording not available - this is normal, don't log as error
        setLoadingCatiRecording(false);
        return;
      }
      // Only log unexpected errors
      console.error('Error fetching CATI recording:', error);
      setLoadingCatiRecording(false);
    }
  };

  const loadCatiAudio = useCallback(async (audioUri: string) => {
    try {
      // Clean up existing CATI audio
      if (catiAudioSoundRef.current) {
        try {
          await catiAudioSoundRef.current.unloadAsync();
        } catch (error) {
          console.error('Error unloading existing CATI audio:', error);
        }
        catiAudioSoundRef.current = null;
        setCatiAudioSound(null);
      }

      // LOG: Show the actual URI being loaded
      console.log('🎵 [AUDIO URL LOG] Quality Agent - Loading CATI audio:');
      console.log('🎵 [AUDIO URL LOG] Audio URI:', audioUri);
      console.log('🎵 [AUDIO URL LOG] URI Type:', audioUri.startsWith('file://') ? 'Local File' : audioUri.startsWith('http') ? 'Remote URL' : 'Unknown');

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: false,
          rate: catiPlaybackRate,
        }
      );

      catiAudioSoundRef.current = sound;
      setCatiAudioSound(sound);
      setCatiRecordingUri(audioUri);
      // Store the call_id associated with this URI so we can preserve it across re-renders
      if (interview?.call_id) {
        catiRecordingUriCallIdRef.current = interview.call_id;
        console.log('💾 Stored catiRecordingUri for call_id:', interview.call_id);
      }

      // Set up status update listener
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !catiIsSeeking) {
          setCatiAudioPosition(status.positionMillis || 0);
          setCatiAudioDuration(status.durationMillis || 0);
          setIsPlayingCatiAudio(status.isPlaying || false);
          
          if (status.didJustFinish) {
            setIsPlayingCatiAudio(false);
            setCatiAudioPosition(0);
          }
        }
      });

      setLoadingCatiRecording(false);
    } catch (error) {
      console.error('Error loading CATI audio:', error);
      setLoadingCatiRecording(false);
    }
  }, [catiPlaybackRate, catiIsSeeking]);

  // PROFESSIONAL FIX: CATI play function with operation lock
  const playCatiAudio = useCallback(async () => {
    if (catiAudioOperationLockRef.current) {
      console.log('▶️ CATI play operation already in progress, ignoring');
      return;
    }
    
    catiAudioOperationLockRef.current = true;
    
    try {
      // If audio is already loaded, just play it
      if (catiAudioSoundRef.current) {
        try {
          const status = await catiAudioSoundRef.current.getStatusAsync();
          if (status.isLoaded) {
            if (!status.isPlaying) {
              await catiAudioSoundRef.current.playAsync();
              // CRITICAL: Verify play actually worked
              const verifyStatus = await catiAudioSoundRef.current.getStatusAsync();
              setIsPlayingCatiAudio(verifyStatus.isPlaying || false);
              console.log('✅ CATI audio playing successfully');
            } else {
              setIsPlayingCatiAudio(true);
            }
            return;
          }
        } catch (error) {
          console.log('CATI audio status check failed, will reload:', error);
        }
      }
      
      // If audio is not loaded but we have a local file, load it first
      if (catiRecordingUri && interview?.call_id && catiRecordingUriCallIdRef.current === interview.call_id) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(catiRecordingUri);
          if (fileInfo.exists) {
            console.log('🔄 Loading audio from local file before playing:', catiRecordingUri);
            await loadCatiAudio(catiRecordingUri);
            // After loading, play it
            if (catiAudioSoundRef.current) {
              await catiAudioSoundRef.current.playAsync();
              // CRITICAL: Verify play actually worked
              const verifyStatus = await catiAudioSoundRef.current.getStatusAsync();
              setIsPlayingCatiAudio(verifyStatus.isPlaying || false);
              console.log('✅ CATI audio loaded and playing successfully');
            }
            return;
          } else {
            console.log('⚠️ Local file no longer exists, will need to download');
            setCatiRecordingUri(null);
            catiRecordingUriCallIdRef.current = null;
          }
        } catch (error) {
          console.error('Error checking local file:', error);
          setCatiRecordingUri(null);
          catiRecordingUriCallIdRef.current = null;
        }
      }
      
      // If no local file, trigger download (this will be handled by fetchCatiRecording)
      if (interview?.call_id && !catiRecordingUri) {
        console.log('📥 No local file, triggering download...');
        await fetchCatiRecording(interview.call_id);
        // After download completes, play will be handled by loadCatiAudio callback
      }
    } catch (error) {
      console.error('❌ Error playing CATI audio:', error);
      setIsPlayingCatiAudio(false);
    } finally {
      catiAudioOperationLockRef.current = false;
    }
  }, [interview?.call_id, catiRecordingUri]);

  // PROFESSIONAL FIX: Separate CATI pause function with operation lock
  const pauseCatiAudio = useCallback(async () => {
    if (catiAudioOperationLockRef.current) {
      console.log('⏸️ CATI pause operation already in progress, ignoring');
      return;
    }
    
    catiAudioOperationLockRef.current = true;
    
    try {
      const currentAudio = catiAudioSoundRef.current;
      if (!currentAudio) {
        setIsPlayingCatiAudio(false);
        return;
      }

      try {
        const status = await currentAudio.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await currentAudio.pauseAsync();
          // CRITICAL: Verify pause actually worked
          const verifyStatus = await currentAudio.getStatusAsync();
          setIsPlayingCatiAudio(verifyStatus.isPlaying || false);
          console.log('✅ CATI audio paused successfully');
        } else {
          setIsPlayingCatiAudio(false);
        }
      } catch (error) {
        console.error('❌ Error pausing CATI audio:', error);
        setIsPlayingCatiAudio(false);
        try {
          await currentAudio.stopAsync();
        } catch (stopError) {
          console.error('❌ Error stopping CATI audio as fallback:', stopError);
        }
      }
    } finally {
      catiAudioOperationLockRef.current = false;
    }
  }, []);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // CATI Audio speed control functions
  const increaseCatiSpeed = async () => {
    if (catiPlaybackRate < 4.0) {
      const newRate = Math.min(catiPlaybackRate + 0.25, 4.0);
      setCatiPlaybackRate(newRate);
      if (catiAudioSoundRef.current) {
        try {
          await catiAudioSoundRef.current.setRateAsync(newRate, true);
        } catch (error) {
          console.error('Error setting CATI audio rate:', error);
        }
      }
    }
  };

  const decreaseCatiSpeed = async () => {
    if (catiPlaybackRate > 0.5) {
      const newRate = Math.max(catiPlaybackRate - 0.25, 0.5);
      setCatiPlaybackRate(newRate);
      if (catiAudioSoundRef.current) {
        try {
          await catiAudioSoundRef.current.setRateAsync(newRate, true);
        } catch (error) {
          console.error('Error setting CATI audio rate:', error);
        }
      }
    }
  };

  // CATI Audio seek handler
  // PROFESSIONAL FIX: Smooth CATI seeking with debouncing
  const handleCatiSeek = useCallback(async (positionMillis: number) => {
    if (!catiAudioSoundRef.current || catiAudioDuration === 0) return;
    
    // Update UI immediately for smooth feedback
    const clampedPosition = Math.max(0, Math.min(positionMillis, catiAudioDuration));
    setCatiAudioPosition(clampedPosition);
    setCatiIsSeeking(true);
    
    // Clear any pending seek operation
    if (catiSeekDebounceTimerRef.current) {
      clearTimeout(catiSeekDebounceTimerRef.current);
    }
    
    // Debounce the actual seek operation for smooth performance
    catiSeekDebounceTimerRef.current = setTimeout(async () => {
      try {
        const currentAudio = catiAudioSoundRef.current;
        if (!currentAudio) {
          setCatiIsSeeking(false);
          return;
        }
        
        await currentAudio.setPositionAsync(clampedPosition);
        console.log('✅ CATI audio seeked to:', clampedPosition);
      } catch (error) {
        console.error('❌ Error seeking CATI audio:', error);
      } finally {
        setCatiIsSeeking(false);
      }
    }, 100); // 100ms debounce for smooth seeking
  }, [catiAudioDuration]);

  // CATI Audio slider handler
  const handleCatiSliderPress = useCallback((event: any) => {
    if (!catiSliderRef.current || catiSliderWidth === 0 || catiAudioDuration === 0) return;
    
    const { locationX } = event.nativeEvent;
    const percentage = Math.max(0, Math.min(1, locationX / catiSliderWidth));
    const positionMillis = Math.floor(percentage * catiAudioDuration);
    handleCatiSeek(positionMillis);
  }, [catiSliderWidth, catiAudioDuration, handleCatiSeek]);
  
  // PROFESSIONAL FIX: 10 seconds forward/backward functions for CATI
  const skipCatiForward10s = useCallback(async () => {
    if (!catiAudioSoundRef.current || catiAudioDuration === 0) return;
    
    const newPosition = Math.min(catiAudioPosition + 10000, catiAudioDuration);
    await handleCatiSeek(newPosition);
  }, [catiAudioPosition, catiAudioDuration, handleCatiSeek]);
  
  const skipCatiBackward10s = useCallback(async () => {
    if (!catiAudioSoundRef.current || catiAudioDuration === 0) return;
    
    const newPosition = Math.max(catiAudioPosition - 10000, 0);
    await handleCatiSeek(newPosition);
  }, [catiAudioPosition, handleCatiSeek]);
  
  // Toggle CATI play/pause
  const toggleCatiPlayPause = useCallback(async () => {
    if (isPlayingCatiAudio) {
      await pauseCatiAudio();
    } else {
      await playCatiAudio();
    }
  }, [isPlayingCatiAudio, playCatiAudio, pauseCatiAudio]);

  const loadAudio = async (audioUrl: string) => {
    try {
      // Clean up existing audio using ref
      if (audioSoundRef.current) {
        try {
          await audioSoundRef.current.unloadAsync();
        } catch (error) {
          console.error('Error unloading existing audio:', error);
        }
        audioSoundRef.current = null;
        setAudioSound(null);
      }

      // Use proxy URL (from backend) or construct it from audioUrl to prevent cross-region charges
      let fullAudioUrl = audioUrl;
      const API_BASE_URL = 'https://convo.convergentview.com';
      
      // Check if interview has proxyUrl or signedUrl (which now contains proxy URL)
      const proxyUrl = interview.metadata?.audioRecording?.proxyUrl || 
                      interview.audioRecording?.proxyUrl ||
                      interview.metadata?.audioRecording?.signedUrl || 
                      interview.audioRecording?.signedUrl ||
                      interview.signedUrl;
      
      if (proxyUrl) {
        // Use proxy URL from backend (already includes full path or relative)
        fullAudioUrl = proxyUrl.startsWith('http') ? proxyUrl : `${API_BASE_URL}${proxyUrl.startsWith('/') ? proxyUrl : '/' + proxyUrl}`;
        console.log('✅ Using provided proxy URL for audio');
      } else if (audioUrl) {
        // Construct proxy URL from audioUrl
        if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
          // Already a full URL
          fullAudioUrl = audioUrl;
        } else if (audioUrl.startsWith('audio/') || audioUrl.startsWith('documents/') || audioUrl.startsWith('reports/')) {
          // S3 key - use proxy endpoint (eliminates cross-region charges)
          fullAudioUrl = `${API_BASE_URL}/api/survey-responses/audio/${encodeURIComponent(audioUrl)}`;
          console.log('✅ Using proxy endpoint for S3 audio:', fullAudioUrl);
        } else {
          // Local path - construct full URL
          fullAudioUrl = `${API_BASE_URL}${audioUrl.startsWith('/') ? audioUrl : '/' + audioUrl}`;
          console.log('Constructed audio URL from relative path:', fullAudioUrl);
        }
      }

      console.log('Loading audio from URL:', fullAudioUrl);

      const { sound } = await Audio.Sound.createAsync(
        { uri: fullAudioUrl },
        { 
          shouldPlay: false,
          rate: playbackRate, // Set initial playback rate
          shouldCorrectPitch: true // Maintain pitch when changing speed
        }
      );

      // Update both state and ref
      audioSoundRef.current = sound;
      setAudioSound(sound);
      
      // Store the audio URI and responseId for restoration after lock/unlock
      capiAudioUriRef.current = fullAudioUrl;
      if (interview?.responseId) {
        capiAudioResponseIdRef.current = interview.responseId;
        console.log('💾 Stored CAPI audio URI for responseId:', interview.responseId, 'URI:', fullAudioUrl);
      }
      
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        setAudioDuration(status.durationMillis || 0);
        // Set initial playback rate
        await sound.setRateAsync(playbackRate, true);
      }

      // Listen to playback status
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !isSeeking) {
          setIsPlaying(status.isPlaying || false);
          setAudioPosition(status.positionMillis || 0);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setAudioPosition(0);
          }
        }
      });
      
      setIsLoadingAudio(false); // OPTIMIZED: Clear loading state on success
    } catch (error) {
      console.error('Error loading audio:', error);
      // Don't show error snackbar - just mark as no recording available
      setAudioSound(null);
      setIsLoadingAudio(false); // OPTIMIZED: Clear loading state on error
    }
  };

  // PROFESSIONAL FIX: Separate play and pause functions with operation locks for reliability
  const pauseAudio = useCallback(async () => {
    // Prevent concurrent operations
    if (audioOperationLockRef.current) {
      console.log('⏸️ Pause operation already in progress, ignoring');
      return;
    }
    
    audioOperationLockRef.current = true;
    
    try {
      const currentAudio = audioSoundRef.current;
      if (!currentAudio) {
        setIsPlaying(false);
        return;
      }

      try {
        const status = await currentAudio.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await currentAudio.pauseAsync();
          // CRITICAL: Verify pause actually worked
          const verifyStatus = await currentAudio.getStatusAsync();
          setIsPlaying(verifyStatus.isPlaying || false);
          console.log('✅ Audio paused successfully');
        } else {
          setIsPlaying(false);
        }
      } catch (error) {
        console.error('❌ Error pausing audio:', error);
        // Force update state even if API call fails
        setIsPlaying(false);
        // Try to stop as fallback
        try {
          await currentAudio.stopAsync();
        } catch (stopError) {
          console.error('❌ Error stopping audio as fallback:', stopError);
        }
      }
    } finally {
      audioOperationLockRef.current = false;
    }
  }, []);

  const playAudio = useCallback(async () => {
    // Prevent concurrent operations
    if (audioOperationLockRef.current) {
      console.log('▶️ Play operation already in progress, ignoring');
      return;
    }
    
    audioOperationLockRef.current = true;
    
    try {
      // CRITICAL: Check if we already have audio loaded for this response
      if (audioSoundRef.current && capiAudioResponseIdRef.current === interview?.responseId) {
        try {
          const status = await audioSoundRef.current.getStatusAsync();
          if (status.isLoaded) {
            console.log('✅ CAPI audio already loaded, playing directly');
            // Audio is already loaded, just play it
            if (!status.isPlaying) {
              await audioSoundRef.current.setRateAsync(playbackRate, true);
              await audioSoundRef.current.playAsync();
              // CRITICAL: Verify play actually worked
              const verifyStatus = await audioSoundRef.current.getStatusAsync();
              setIsPlaying(verifyStatus.isPlaying || false);
              console.log('✅ Audio playing successfully');
            } else {
              setIsPlaying(true);
            }
            return;
          }
        } catch (error) {
          console.log('Audio status check failed, will reload:', error);
        }
      }
      
      // CRITICAL: Check if we have a stored URI for this response before loading from URL
      if (capiAudioUriRef.current && capiAudioResponseIdRef.current === interview?.responseId) {
        console.log('🔄 Reloading CAPI audio from stored URI (no re-download):', capiAudioUriRef.current);
        setIsLoadingAudio(true);
        try {
          await loadAudio(capiAudioUriRef.current);
          // After loading, play it
          const currentAudio = audioSoundRef.current;
          if (currentAudio) {
            await currentAudio.setRateAsync(playbackRate, true);
            await currentAudio.playAsync();
            // CRITICAL: Verify play actually worked
            const verifyStatus = await currentAudio.getStatusAsync();
            setIsPlaying(verifyStatus.isPlaying || false);
            setIsLoadingAudio(false);
          }
        } catch (loadError) {
          console.error('Error reloading audio from stored URI:', loadError);
          capiAudioUriRef.current = null;
          capiAudioResponseIdRef.current = null;
          setIsLoadingAudio(false);
        }
        return;
      }
      
      if (!audioSound) {
        // OPTIMIZED: Lazy load audio only when user clicks play
        const signedUrl = interview.metadata?.audioRecording?.signedUrl || 
                         interview.audioRecording?.signedUrl ||
                         interview.signedUrl;
        const audioUrl = interview.metadata?.audioRecording?.audioUrl || 
                        interview.audioUrl || 
                        interview.audioRecording?.url ||
                        interview.audioRecording?.audioUrl;
        const audioSource = signedUrl || audioUrl;
        if (audioSource) {
          setIsLoadingAudio(true);
          try {
            await loadAudio(audioSource);
            const currentAudio = audioSoundRef.current;
            if (currentAudio) {
              await currentAudio.setRateAsync(playbackRate, true);
              await currentAudio.playAsync();
              // CRITICAL: Verify play actually worked
              const verifyStatus = await currentAudio.getStatusAsync();
              setIsPlaying(verifyStatus.isPlaying || false);
              console.log('✅ Audio loaded and playing successfully');
            }
          } catch (loadError) {
            console.error('Error loading audio:', loadError);
          } finally {
            setIsLoadingAudio(false);
          }
          return;
        }
        return;
      }

      // Audio already loaded, just play it
      try {
        const status = await audioSound.getStatusAsync();
        if (status.isLoaded && !status.isPlaying) {
          await audioSound.setRateAsync(playbackRate, true);
          await audioSound.playAsync();
          // CRITICAL: Verify play actually worked
          const verifyStatus = await audioSound.getStatusAsync();
          setIsPlaying(verifyStatus.isPlaying || false);
          console.log('✅ Audio playing successfully');
        } else if (status.isPlaying) {
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      }
    } finally {
      audioOperationLockRef.current = false;
    }
  }, [interview?.responseId, playbackRate]);
  
  // Toggle play/pause (for button click)
  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      await pauseAudio();
    } else {
      await playAudio();
    }
  }, [isPlaying, playAudio, pauseAudio]);

  const stopAudio = async () => {
    if (audioSound) {
      try {
        await audioSound.stopAsync();
        await audioSound.setPositionAsync(0);
        setIsPlaying(false);
        setAudioPosition(0);
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  };

  // Increase playback speed
  const increaseSpeed = async () => {
    const newRate = Math.min(playbackRate + 0.25, 4.0); // Max 4x speed
    setPlaybackRate(newRate);
    if (audioSound) {
      try {
        const status = await audioSound.getStatusAsync();
        if (status.isLoaded) {
          const wasPlaying = status.isPlaying;
          await audioSound.setRateAsync(newRate, true);
          // If audio was playing, ensure it continues playing at new rate
          if (wasPlaying && !status.isPlaying) {
            await audioSound.playAsync();
          }
          console.log('✅ Playback speed increased to:', newRate);
        }
      } catch (error) {
        console.error('Error setting playback rate:', error);
      }
    }
  };

  // Decrease playback speed
  const decreaseSpeed = async () => {
    const newRate = Math.max(playbackRate - 0.25, 0.5); // Min 0.5x speed
    setPlaybackRate(newRate);
    if (audioSound) {
      try {
        const status = await audioSound.getStatusAsync();
        if (status.isLoaded) {
          const wasPlaying = status.isPlaying;
          await audioSound.setRateAsync(newRate, true);
          // If audio was playing, ensure it continues playing at new rate
          if (wasPlaying && !status.isPlaying) {
            await audioSound.playAsync();
          }
          console.log('✅ Playback speed decreased to:', newRate);
        }
      } catch (error) {
        console.error('Error setting playback rate:', error);
      }
    }
  };

  // PROFESSIONAL FIX: Smooth seeking with debouncing and immediate UI feedback
  const handleSeek = useCallback(async (positionMillis: number) => {
    if (!audioSoundRef.current || audioDuration === 0) return;
    
    // Update UI immediately for smooth feedback
    const clampedPosition = Math.max(0, Math.min(positionMillis, audioDuration));
    setAudioPosition(clampedPosition);
    setIsSeeking(true);
    
    // Clear any pending seek operation
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
    }
    
    // Debounce the actual seek operation for smooth performance
    seekDebounceTimerRef.current = setTimeout(async () => {
      try {
        const currentAudio = audioSoundRef.current;
        if (!currentAudio) {
          setIsSeeking(false);
          return;
        }
        
        await currentAudio.setPositionAsync(clampedPosition);
        console.log('✅ Audio seeked to:', clampedPosition);
      } catch (error) {
        console.error('❌ Error seeking audio:', error);
      } finally {
        setIsSeeking(false);
      }
    }, 100); // 100ms debounce for smooth seeking
  }, [audioDuration]);

  const handleSliderPress = useCallback((event: any) => {
    if (!sliderRef.current || sliderWidth === 0 || audioDuration === 0) return;
    
    const { locationX } = event.nativeEvent;
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const positionMillis = Math.floor(percentage * audioDuration);
    handleSeek(positionMillis);
  }, [sliderWidth, audioDuration, handleSeek]);

  // PROFESSIONAL FIX: Smooth pan responder with immediate visual feedback
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        setIsSeeking(true);
        if (sliderWidth === 0 || audioDuration === 0) return;
        const { locationX } = event.nativeEvent;
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
        const positionMillis = Math.floor(percentage * audioDuration);
        setAudioPosition(positionMillis);
      },
      onPanResponderMove: (event) => {
        if (sliderWidth === 0 || audioDuration === 0) return;
        const { locationX } = event.nativeEvent;
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
        const positionMillis = Math.floor(percentage * audioDuration);
        setAudioPosition(positionMillis);
      },
      onPanResponderRelease: (event) => {
        if (sliderWidth === 0 || audioDuration === 0) {
          setIsSeeking(false);
          return;
        }
        const { locationX } = event.nativeEvent;
        const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
        const positionMillis = Math.floor(percentage * audioDuration);
        handleSeek(positionMillis);
      },
    })
  ).current;
  
  // PROFESSIONAL FIX: 10 seconds forward/backward functions
  const skipForward10s = useCallback(async () => {
    if (!audioSoundRef.current || audioDuration === 0) return;
    
    const newPosition = Math.min(audioPosition + 10000, audioDuration);
    await handleSeek(newPosition);
  }, [audioPosition, audioDuration, handleSeek]);
  
  const skipBackward10s = useCallback(async () => {
    if (!audioSoundRef.current || audioDuration === 0) return;
    
    const newPosition = Math.max(audioPosition - 10000, 0);
    await handleSeek(newPosition);
  }, [audioPosition, handleSeek]);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleVerificationFormChange = (field: string, value: string) => {
    setVerificationForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Helper function to check if a value is a rejection option for a question type
  const isRejectionOption = (questionType: string, value: string): boolean => {
    if (!value || value === '') return false;
    
    switch (questionType) {
      case 'audioStatus':
        // Rejection options: anything that's not "1", "4", or "7"
        // Note: "9" (Interviewer acting as respondent) is also a rejection option
        return value !== '1' && value !== '4' && value !== '7';
      case 'gender':
        // Rejection options: "2" (Not Matched), "3" (Male answering on behalf of female)
        return value === '2' || value === '3';
      case 'upcomingElection':
      case 'assembly2021':
      case 'lokSabha2024':
      case 'name':
      case 'age':
        // Rejection options: "2" (Not Matched), "4" (Did not ask)
        // Note: "3" (Cannot hear) is acceptable, not a rejection
        return value === '2' || value === '4';
      default:
        return false;
    }
  };

  // Helper function to check if any rejection option has been selected
  // NOTE: Questions 6 (name), 7 (age), and 8 (phoneNumber) are excluded from rejection logic
  const hasRejectionOption = (): boolean => {
    // Check in order of questions (excluding name, age, and phoneNumber)
    const questionOrder = [
      { type: 'audioStatus', value: verificationForm.audioStatus },
      { type: 'gender', value: verificationForm.genderMatching },
      { type: 'upcomingElection', value: verificationForm.upcomingElectionsMatching },
      { type: 'assembly2021', value: verificationForm.previousElectionsMatching },
      { type: 'lokSabha2024', value: verificationForm.previousLoksabhaElectionsMatching },
      // Q6 (name), Q7 (age), and Q8 (phoneNumber) are excluded - they don't affect rejection
    ];
    
    for (const question of questionOrder) {
      if (question.value && isRejectionOption(question.type, question.value)) {
        return true;
      }
    }
    
    return false;
  };

  // Helper function to check if a verification question should be shown
  const shouldShowVerificationQuestion = (questionType: string): boolean => {
    if (!interview) return true;
    
    // Phone number question should not be shown for CATI responses
    if (questionType === 'phoneNumber' && interview.interviewMode === 'cati') {
      return false;
    }
    
    const audioStatus = verificationForm.audioStatus;
    
    // Q1-Q5: Only option '1' (first/best option) is acceptable for approval
    // If ANY of Q1-Q5 is NOT option '1', hide ALL subsequent questions
    
    // Q1: Audio Status - if NOT option '1', hide ALL subsequent questions (Q2-Q8)
    // Check this FIRST before anything else
    // Note: Options '2', '3', '4', '7', '8', '9' are all rejective and hide subsequent questions
    if (audioStatus !== '' && audioStatus !== null && audioStatus !== undefined && audioStatus !== '1') {
      // If audioStatus exists and is not '1', only show audioStatus question itself
      // Hide everything else (Q2-Q8 including Q6 name)
      return questionType === 'audioStatus';
    }
    
    // Q2: Gender Matching - if NOT option '1', hide ALL subsequent questions (Q3-Q8)
    if (verificationForm.genderMatching && verificationForm.genderMatching !== '' && verificationForm.genderMatching !== '1') {
      // If gender is not '1', only show audioStatus and gender questions
      // Hide everything else (Q3-Q8 including Q6 name)
      if (questionType !== 'audioStatus' && questionType !== 'gender') {
        return false;
      }
    }
    
    // Q3: Upcoming Elections - if NOT option '1' or '3' (cannot hear), hide ALL subsequent questions (Q4-Q8)
    // Allow both '1' (matched) and '3' (cannot hear) to proceed to next questions
    if (verificationForm.upcomingElectionsMatching && verificationForm.upcomingElectionsMatching !== '' && 
        verificationForm.upcomingElectionsMatching !== '1' && verificationForm.upcomingElectionsMatching !== '3') {
      // If Q3 is not '1' or '3', only show Q1, Q2, Q3
      // Hide everything else (Q4-Q8 including Q6 name)
      if (questionType !== 'audioStatus' && questionType !== 'gender' && questionType !== 'upcomingElection') {
        return false;
      }
    }
    
    // Q4: Previous Elections - if NOT option '1' or '3' (cannot hear), hide ALL subsequent questions (Q5-Q8)
    // Allow both '1' (matched) and '3' (cannot hear) to proceed to next questions
    if (verificationForm.previousElectionsMatching && verificationForm.previousElectionsMatching !== '' && 
        verificationForm.previousElectionsMatching !== '1' && verificationForm.previousElectionsMatching !== '3') {
      // If Q4 is not '1' or '3', only show Q1, Q2, Q3, Q4
      // Hide everything else (Q5-Q8 including Q6 name)
      if (questionType !== 'audioStatus' && questionType !== 'gender' && 
          questionType !== 'upcomingElection' && questionType !== 'assembly2021') {
        return false;
      }
    }
    
    // Q5: Previous Loksabha Elections - if NOT option '1' or '3' (cannot hear), hide Q6, Q7, Q8 (informational questions)
    // Allow both '1' (matched) and '3' (cannot hear) to proceed to next questions
    if (verificationForm.previousLoksabhaElectionsMatching && verificationForm.previousLoksabhaElectionsMatching !== '' && 
        verificationForm.previousLoksabhaElectionsMatching !== '1' && verificationForm.previousLoksabhaElectionsMatching !== '3') {
      // If Q5 is not '1' or '3', hide Q6, Q7, Q8
      if (questionType === 'name' || questionType === 'age' || questionType === 'phoneNumber') {
        return false;
      }
    }
    
    // For gender question, only show if audioStatus is '1' (best option)
    if (questionType === 'gender') {
      if (audioStatus !== '1') {
        return false;
      }
    }
    
    // Only reach here if none of the rejection conditions above were met
    // Now check if related response is skipped
    const verificationResponses = getVerificationResponses();
    
    // Check if related response is skipped
    switch (questionType) {
      case 'gender':
        return !verificationResponses.genderResponse?.isSkipped;
      case 'upcomingElection':
        return !verificationResponses.upcomingElectionResponse?.isSkipped;
      case 'assembly2021':
        return !verificationResponses.assembly2021Response?.isSkipped;
      case 'lokSabha2024':
        return !verificationResponses.lokSabha2024Response?.isSkipped;
      case 'name':
        return !verificationResponses.nameResponse?.isSkipped;
      case 'age':
        return !verificationResponses.ageResponse?.isSkipped;
      default:
        return true;
    }
  };

  const isVerificationFormValid = () => {
    if (!interview) return false;
    
    // Audio status is always required
    if (verificationForm.audioStatus === '') return false;
    
    // If a rejection option is selected, form is valid (don't require other questions)
    if (hasRejectionOption()) {
      return true;
    }
    
    // Otherwise, check each question only if it should be shown
    if (shouldShowVerificationQuestion('gender') && verificationForm.genderMatching === '') return false;
    if (shouldShowVerificationQuestion('upcomingElection') && verificationForm.upcomingElectionsMatching === '') return false;
    if (shouldShowVerificationQuestion('assembly2021') && verificationForm.previousElectionsMatching === '') return false;
    if (shouldShowVerificationQuestion('lokSabha2024') && verificationForm.previousLoksabhaElectionsMatching === '') return false;
    if (shouldShowVerificationQuestion('name') && verificationForm.nameMatching === '') return false;
    if (shouldShowVerificationQuestion('age') && verificationForm.ageMatching === '') return false;
    if (shouldShowVerificationQuestion('phoneNumber') && verificationForm.phoneNumberAsked === '') return false;
    
    return true;
  };

  const getApprovalStatus = () => {
    if (!interview) return 'rejected';
    
    // If any rejection option is selected, automatically reject
    if (hasRejectionOption()) {
      return 'rejected';
    }
    
    const audioStatus = verificationForm.audioStatus;
    if (audioStatus !== '1' && audioStatus !== '4' && audioStatus !== '7') {
      return 'rejected';
    }
    
    // Only check questions that should be shown
    if (shouldShowVerificationQuestion('gender')) {
      if (verificationForm.genderMatching !== '1') {
        return 'rejected';
      }
    }
    
    if (shouldShowVerificationQuestion('upcomingElection')) {
      if (verificationForm.upcomingElectionsMatching !== '1' && 
          verificationForm.upcomingElectionsMatching !== '3') {
        return 'rejected';
      }
    }
    
    if (shouldShowVerificationQuestion('assembly2021')) {
      if (verificationForm.previousElectionsMatching !== '1' && 
          verificationForm.previousElectionsMatching !== '3') {
        return 'rejected';
      }
    }
    
    if (shouldShowVerificationQuestion('lokSabha2024')) {
      if (verificationForm.previousLoksabhaElectionsMatching !== '1' && 
          verificationForm.previousLoksabhaElectionsMatching !== '3') {
        return 'rejected';
      }
    }
    
    // Q6: Name Matching - EXCLUDED from rejection logic (informational only)
    // Q7: Age Matching - EXCLUDED from rejection logic (informational only)
    // Q8: Phone Number Asked - EXCLUDED from rejection logic (informational only)
    // These questions are answered but do NOT affect approval/rejection status
    
    return 'approved';
  };

  const handleSubmit = async () => {
    if (!isVerificationFormValid()) {
      showSnackbar('Please answer all required questions before submitting');
      return;
    }

    // CRITICAL FIX: Stop all audio before submitting
    console.log('🛑 Submitting review - stopping all audio...');
    try {
      // Immediately stop all audio playback (blocking)
      const capiAudio = audioSoundRef.current;
      const catiAudio = catiAudioSoundRef.current;
      
      // Stop CAPI audio immediately
      if (capiAudio) {
        try {
          const status = await capiAudio.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await capiAudio.stopAsync(); // Stop immediately
          }
        } catch (error) {
          console.error('Error stopping CAPI audio on submit:', error);
        }
      }
      
      // Stop CATI audio immediately
      if (catiAudio) {
        try {
          const status = await catiAudio.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await catiAudio.stopAsync(); // Stop immediately
          }
        } catch (error) {
          console.error('Error stopping CATI audio on submit:', error);
        }
      }
      
      // Then cleanup fully
      await Promise.all([
        cleanupAudio(),
        cleanupCatiAudio()
      ]);
      
      // Clear debounce timers
      if (seekDebounceTimerRef.current) {
        clearTimeout(seekDebounceTimerRef.current);
        seekDebounceTimerRef.current = null;
      }
      if (catiSeekDebounceTimerRef.current) {
        clearTimeout(catiSeekDebounceTimerRef.current);
        catiSeekDebounceTimerRef.current = null;
      }
      
      console.log('✅ Audio cleanup complete before submit');
    } catch (error) {
      console.error('Error cleaning up audio on submit:', error);
      // Force cleanup even if there's an error
      try {
        const capiAudio = audioSoundRef.current;
        const catiAudio = catiAudioSoundRef.current;
        
        if (capiAudio) {
          try {
            await capiAudio.stopAsync();
          } catch (stopError) {
            console.error('Error force stopping CAPI audio:', stopError);
          }
        }
        
        if (catiAudio) {
          try {
            await catiAudio.stopAsync();
          } catch (stopError) {
            console.error('Error force stopping CATI audio:', stopError);
          }
        }
        
        await Promise.all([
          cleanupAudio(),
          cleanupCatiAudio()
        ]);
      } catch (cleanupError) {
        console.error('Error during force cleanup on submit:', cleanupError);
      }
    }

    try {
      setIsSubmitting(true);
      
      const approvalStatus = getApprovalStatus();
      const verificationData = {
        responseId: interview.responseId,
        status: approvalStatus,
        verificationCriteria: {
          audioStatus: verificationForm.audioStatus,
          genderMatching: verificationForm.genderMatching,
          upcomingElectionsMatching: verificationForm.upcomingElectionsMatching,
          previousElectionsMatching: verificationForm.previousElectionsMatching,
          previousLoksabhaElectionsMatching: verificationForm.previousLoksabhaElectionsMatching,
          nameMatching: verificationForm.nameMatching,
          ageMatching: verificationForm.ageMatching,
          phoneNumberAsked: verificationForm.phoneNumberAsked
        },
        feedback: verificationForm.customFeedback || ''
      };

      await onSubmit(verificationData);
    } catch (error: any) {
      console.error('Error submitting verification:', error);
      showSnackbar('Failed to submit verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // PROFESSIONAL FIX: Improved close handler with proper audio cleanup
  const handleClose = async () => {
    console.log('🛑 Closing modal - cleaning up all audio...');
    try {
      // CRITICAL FIX: Immediately stop all audio playback (blocking)
      const capiAudio = audioSoundRef.current;
      const catiAudio = catiAudioSoundRef.current;
      
      // Stop CAPI audio immediately
      if (capiAudio) {
        try {
          const status = await capiAudio.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await capiAudio.stopAsync(); // Stop immediately
          }
        } catch (error) {
          console.error('Error stopping CAPI audio on close:', error);
        }
      }
      
      // Stop CATI audio immediately
      if (catiAudio) {
        try {
          const status = await catiAudio.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await catiAudio.stopAsync(); // Stop immediately
          }
        } catch (error) {
          console.error('Error stopping CATI audio on close:', error);
        }
      }
      
      // Then cleanup fully
      await Promise.all([
        cleanupAudio(),
        cleanupCatiAudio()
      ]);
      
      // Clear debounce timers
      if (seekDebounceTimerRef.current) {
        clearTimeout(seekDebounceTimerRef.current);
        seekDebounceTimerRef.current = null;
      }
      if (catiSeekDebounceTimerRef.current) {
        clearTimeout(catiSeekDebounceTimerRef.current);
        catiSeekDebounceTimerRef.current = null;
      }
      
      console.log('✅ Audio cleanup complete, closing modal');
      onClose();
    } catch (error) {
      console.error('Error in handleClose:', error);
      // Force cleanup and close even if there's an error
      try {
        // Try to stop audio immediately
        const capiAudio = audioSoundRef.current;
        const catiAudio = catiAudioSoundRef.current;
        
        if (capiAudio) {
          try {
            await capiAudio.stopAsync();
          } catch (stopError) {
            console.error('Error force stopping CAPI audio:', stopError);
          }
        }
        
        if (catiAudio) {
          try {
            await catiAudio.stopAsync();
          } catch (stopError) {
            console.error('Error force stopping CATI audio:', stopError);
          }
        }
        
        await Promise.all([
          cleanupAudio(),
          cleanupCatiAudio()
        ]);
      } catch (cleanupError) {
        console.error('Error during force cleanup:', cleanupError);
      }
      onClose();
    }
  };

  // Handle skip response
  const handleSkip = async () => {
    if (!interview?.responseId) {
      showSnackbar('Unable to skip: Response ID not found');
      return;
    }

    // CRITICAL FIX: Fully cleanup ALL audio (CAPI and CATI) before skipping
    console.log('🛑 Skipping interview - cleaning up all audio...');
    try {
      await Promise.all([
        cleanupAudio(),
        cleanupCatiAudio()
      ]);
      // Clear debounce timers
      if (seekDebounceTimerRef.current) {
        clearTimeout(seekDebounceTimerRef.current);
        seekDebounceTimerRef.current = null;
      }
      if (catiSeekDebounceTimerRef.current) {
        clearTimeout(catiSeekDebounceTimerRef.current);
        catiSeekDebounceTimerRef.current = null;
      }
      console.log('✅ Audio cleanup complete before skip');
    } catch (error) {
      console.error('Error cleaning up audio on skip:', error);
      // Force cleanup even if there's an error
      try {
        await Promise.all([
          cleanupAudio(),
          cleanupCatiAudio()
        ]);
      } catch (cleanupError) {
        console.error('Error during force cleanup on skip:', cleanupError);
      }
    }

    // Reset form
    setVerificationForm({
      audioStatus: '',
      genderMatching: '',
      upcomingElectionsMatching: '',
      previousElectionsMatching: '',
      previousLoksabhaElectionsMatching: '',
      nameMatching: '',
      ageMatching: '',
      phoneNumberAsked: '',
      customFeedback: ''
    });

    // Call onSkip callback if provided (handles skip logic in parent)
    if (onSkip) {
      await onSkip();
    } else {
      // Fallback: just close the modal
      onClose();
    }
  };

  const getRespondentInfo = () => {
    const responses = interview.responses || [];
    const surveyId = interview.survey?._id || interview.survey?.survey?._id || null;
    
    // Helper to extract value from response (handle arrays)
    const extractValue = (response: any) => {
      if (!response || !response.response) return null;
      if (Array.isArray(response.response)) {
        return response.response.length > 0 ? response.response[0] : null;
      }
      return response.response;
    };

    // Helper to find response by question text (ignoring translations)
    const findResponseByQuestionText = (searchTexts: string[]) => {
      return responses.find((r: any) => {
        if (!r.questionText) return false;
        const mainText = getMainText(r.questionText).toLowerCase();
        return searchTexts.some(text => mainText.includes(text.toLowerCase()));
      });
    };

    // Helper to find response by questionNumber
    const findResponseByQuestionNumber = (questionNumber: string) => {
      return responses.find((r: any) => {
        if (!r.questionNumber) return false;
        const qNum = r.questionNumber || '';
        return qNum === questionNumber || qNum.includes(questionNumber) || questionNumber.includes(qNum);
      });
    };

    // Helper: detect if a value looks like a gender response (matches web logic)
    const isGenderResponseValue = (value: any) => {
      if (value === null || value === undefined) return false;
      const valueStr = String(value).toLowerCase().trim();
      if (!valueStr) return false;
      // Exact values
      if (valueStr === 'male' || valueStr === 'female' || valueStr === 'non_binary' || valueStr === 'other') return true;
      // Option codes commonly used for gender
      if (valueStr === '1' || valueStr === '2' || valueStr === '3') return true;
      // Translation format (e.g. "Male_{পুরুষ}")
      if (valueStr.includes('_{')) return true;
      // Starts with gender keyword
      if (valueStr.startsWith('male') || valueStr.startsWith('female')) return true;
      return false;
    };

    // Find name from dedicated name question for this survey, then fall back
    // to older strategies (Q28, text search) only if needed.
    let nameResponse = null;
    if (surveyId === '68fd1915d41841da463f0d46') {
      // Strategy 0: Directly by fixed questionId (most reliable)
      nameResponse =
        responses.find(
          (r: any) => r.questionId === '68fd1915d41841da463f0d46_fixed_respondent_name'
        ) || null;

      // Strategy 1: Find by questionNumber (Q28 or 28)
      if (!nameResponse) {
        nameResponse = findResponseByQuestionNumber('Q28') || findResponseByQuestionNumber('28');
      }
      
      // Strategy 2: Find by question text keywords
      if (!nameResponse) {
        nameResponse = findResponseByQuestionText([
          'would you like to share your name',
          'share your name',
          'name with us'
        ]);
      }
      
      // Strategy 3: Find by question ID if available
      if (!nameResponse && survey) {
        const actualSurvey = survey.survey || survey;
        let nameQuestion = null;
        
        // Search in sections
        if (actualSurvey.sections) {
          for (const section of actualSurvey.sections) {
            if (section.questions) {
              nameQuestion = section.questions.find((q: any) => {
                const qText = getMainText(q.text || '').toLowerCase();
                return qText.includes('would you like to share your name') ||
                       qText.includes('share your name') ||
                       (q.questionNumber && (q.questionNumber === '28' || q.questionNumber === 'Q28' || q.questionNumber.includes('28')));
              });
              if (nameQuestion) break;
            }
          }
        }
        
        // Search in direct questions
        if (!nameQuestion && actualSurvey.questions) {
          nameQuestion = actualSurvey.questions.find((q: any) => {
            const qText = getMainText(q.text || '').toLowerCase();
            return qText.includes('would you like to share your name') ||
                   qText.includes('share your name') ||
                   (q.questionNumber && (q.questionNumber === '28' || q.questionNumber === 'Q28' || q.questionNumber.includes('28')));
          });
        }
        
        if (nameQuestion && nameQuestion.id) {
          nameResponse = responses.find((r: any) => r.questionId === nameQuestion.id);
        }
      }
      
      // Fallback to general name search
      if (!nameResponse) {
        nameResponse = findResponseByQuestionText([
          'what is your full name',
          'full name',
          'name'
        ]);
      }
    } else {
      // For other surveys, use general name search
      nameResponse = findResponseByQuestionText([
        'what is your full name',
        'full name',
        'name'
      ]);
    }

    // Find gender response using genderUtils (more reliable)
    const genderResponse = findGenderResponse(responses, survey) || responses.find((r: any) => {
      const mainText = getMainText(r.questionText || '').toLowerCase();
      return mainText.includes('gender') || mainText.includes('sex');
    });
    
    // Get gender question from survey to format the response correctly
    let genderQuestion = null;
    if (genderResponse && survey) {
      const actualSurvey = survey.survey || survey;
      genderQuestion = findQuestionByText(genderResponse.questionText, actualSurvey);
    }
    
    // Format gender response using formatResponseDisplay (removes translation part)
    let genderDisplay = 'Not Available';
    if (genderResponse?.response) {
      const genderValue = extractValue(genderResponse);
      if (genderValue) {
        genderDisplay = formatResponseDisplay(genderValue, genderQuestion);
      }
    }

    // CRITICAL FIX: Ensure nameResponse is never the gender response
    // (This prevents Q6 "Name of the respondent matching?" showing gender)
    if (nameResponse) {
      // If it's literally the same response object as genderResponse, discard
      if (genderResponse && (nameResponse === genderResponse || (nameResponse._id && genderResponse._id && String(nameResponse._id) === String(genderResponse._id)))) {
        nameResponse = null;
      } else if (nameResponse.questionText) {
        const qText = getMainText(nameResponse.questionText).toLowerCase();
        if (qText.includes('gender') || qText.includes("respondent's gender")) {
          nameResponse = null;
        }
      }
      // If the value itself looks like gender (male/female/1/2/3/translated), discard
      if (nameResponse?.response) {
        const candidateValue = extractValue(nameResponse);
        if (isGenderResponseValue(candidateValue)) {
          nameResponse = null;
        }
      }
    }

    const ageResponse = responses.find((r: any) => {
      const mainText = getMainText(r.questionText || '').toLowerCase();
      return mainText.includes('age') || mainText.includes('year');
    });

    // Get name and capitalize it
    let name = 'Not Available';
    if (nameResponse?.response) {
      const nameValue = extractValue(nameResponse);
      if (nameValue && nameValue !== 'N/A' && String(nameValue).trim() !== '') {
        // Make sure it's not a gender value
        if (!isGenderResponseValue(nameValue)) {
          // Capitalize the name
          name = String(nameValue)
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
      }
    }

    return {
      name: name,
      gender: genderDisplay,
      age: extractValue(ageResponse) || 'Not Available'
    };
  };

  const formatResponseDisplay = (response: any, question: any) => {
    if (!response || response === null || response === undefined) {
      return 'No response';
    }

    if (Array.isArray(response)) {
      if (response.length === 0) return 'No selections';
      
      const displayTexts = response.map((value: any) => {
        if (typeof value === 'string' && value.startsWith('Others: ')) {
          return value;
        }
        
        if (question && question.options) {
          const option = question.options.find((opt: any) => opt.value === value);
          return option ? option.text : value;
        }
        return value;
      });
      
      return displayTexts.join(', ');
    }

    if (typeof response === 'string' || typeof response === 'number') {
      if (typeof response === 'string' && response.startsWith('Others: ')) {
        return response;
      }
      
      if (question && question.options) {
        const option = question.options.find((opt: any) => opt.value === response);
        return option ? option.text : response.toString();
      }
      return response.toString();
    }

    return JSON.stringify(response);
  };

  const findQuestionByText = (questionText: string, survey: any) => {
    if (survey?.sections) {
      for (const section of survey.sections) {
        if (section.questions) {
          for (const question of section.questions) {
            if (question.text === questionText) {
              return question;
            }
          }
        }
      }
    }
    return null;
  };

  // Helper function to find question in survey by keywords
  const findQuestionInSurveyByKeywords = (keywords: string[], survey: any, requireAll: boolean = false) => {
    if (!survey) return null;
    const actualSurvey = survey.survey || survey;
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    
    const searchInQuestions = (questions: any[]) => {
      for (const question of questions) {
        const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
        if (requireAll) {
          if (normalizedKeywords.every(keyword => questionText.includes(keyword))) {
            return question;
          }
        } else {
          if (normalizedKeywords.some(keyword => questionText.includes(keyword))) {
            return question;
          }
        }
      }
      return null;
    };
    
    // Search in sections
    if (actualSurvey.sections) {
      for (const section of actualSurvey.sections) {
        if (section.questions) {
          const found = searchInQuestions(section.questions);
          if (found) return found;
        }
      }
    }
    
    // Search in top-level questions
    if (actualSurvey.questions) {
      const found = searchInQuestions(actualSurvey.questions);
      if (found) return found;
    }
    
    return null;
  };

  // Helper function to find response by matching question text (without translations)
  const findResponseByQuestionText = (targetQuestionText: string) => {
    if (!interview) return null;
    const responses = interview.responses || [];
    const targetMainText = getMainText(targetQuestionText).toLowerCase().trim();
    
    return responses.find((r: any) => {
      const responseQuestionText = getMainText(r.questionText || '').toLowerCase().trim();
      // Exact match or contains the main text
      return responseQuestionText === targetMainText || 
             responseQuestionText.includes(targetMainText) ||
             targetMainText.includes(responseQuestionText);
    });
  };

  // Helper function to find response by matching survey question (finds question in survey, then matches response)
  const findResponseBySurveyQuestion = (keywords: string[], survey: any, requireAll: boolean = false, excludeKeywords: string[] = []) => {
    if (!interview) return null;
    // First, find the question in the survey
    const surveyQuestion = findQuestionInSurveyByKeywords(keywords, survey, requireAll);
    if (!surveyQuestion) return null;
    
    // Get the main text of the survey question (without translation)
    const surveyQuestionMainText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
    
    // If exclude keywords are provided, check if this question matches them
    if (excludeKeywords.length > 0) {
      const questionTextLower = surveyQuestionMainText.toLowerCase();
      const hasExcludeKeyword = excludeKeywords.some(keyword => questionTextLower.includes(keyword.toLowerCase()));
      if (hasExcludeKeyword) return null;
    }
    
    // Now find the response that matches this question text
    return findResponseByQuestionText(surveyQuestionMainText);
  };

  // Helper function to find response by question text keywords (fallback method)
  const findResponseByKeywords = (keywords: string[], requireAll: boolean = false, excludeKeywords: string[] = []) => {
    if (!interview) return null;
    const responses = interview.responses || [];
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    const normalizedExclude = excludeKeywords.map(k => k.toLowerCase());
    
    return responses.find((r: any) => {
      const questionText = getMainText(r.questionText || '').toLowerCase();
      
      // Check exclude keywords first
      if (normalizedExclude.length > 0) {
        const hasExcludeKeyword = normalizedExclude.some(keyword => questionText.includes(keyword));
        if (hasExcludeKeyword) return false;
      }
      
      // Check include keywords
      if (requireAll) {
        return normalizedKeywords.every(keyword => questionText.includes(keyword));
      } else {
        return normalizedKeywords.some(keyword => questionText.includes(keyword));
      }
    });
  };

  // Helper to get main text (strip translations)
  const getMainText = (text: string) => {
    if (!text || typeof text !== 'string') return text || '';
    const translationRegex = /^(.+?)\s*\{([^}]+)\}\s*$/;
    const match = text.match(translationRegex);
    return match ? match[1].trim() : text.trim();
  };

  // Helper function to find question by keywords in survey
  const findQuestionByKeywords = (keywords: string[], survey: any) => {
    if (!survey) return null;
    
    const actualSurvey = survey.survey || survey;
    const allQuestions: any[] = [];
    
    // Collect all questions
    if (actualSurvey.sections) {
      actualSurvey.sections.forEach((section: any) => {
        if (section.questions) {
          allQuestions.push(...section.questions);
        }
      });
    }
    if (actualSurvey.questions) {
      allQuestions.push(...actualSurvey.questions);
    }
    
    // Find question matching keywords
    const keywordsLower = keywords.map(k => k.toLowerCase());
    return allQuestions.find((q: any) => {
      const questionText = (q.text || q.questionText || '').toLowerCase();
      return keywordsLower.some(keyword => questionText.includes(keyword));
    });
  };

  // Helper function to get failed questions from verification criteria
  const getFailedQuestions = (verificationData: any, survey: any) => {
    if (!verificationData || !verificationData.criteria) return [];
    
    const criteria = verificationData.criteria;
    const failedQuestions: Array<{ criterion: string; questionText: string; reason: string }> = [];
    
    // Map criteria to question types and check if they failed
    // Based on getApprovalStatus logic from SurveyApprovals.jsx
    
    // Audio Status - fails if not '1', '4', or '7'
    if (criteria.audioStatus && !['1', '4', '7'].includes(criteria.audioStatus)) {
      failedQuestions.push({
        criterion: 'audioStatus',
        questionText: 'Audio Quality',
        reason: 'Audio quality did not match'
      });
    }
    
    // Gender Matching - fails if not '1'
    if (criteria.genderMatching && criteria.genderMatching !== '1') {
      const genderQuestion = findQuestionByKeywords(['gender'], survey) || 
                            findQuestionByText('What is your gender?', survey);
      failedQuestions.push({
        criterion: 'genderMatching',
        questionText: genderQuestion?.text || genderQuestion?.questionText || 'Gender question',
        reason: 'Gender response did not match'
      });
    }
    
    // Upcoming Elections Matching - fails if not '1' or '3'
    if (criteria.upcomingElectionsMatching && !['1', '3'].includes(criteria.upcomingElectionsMatching)) {
      const upcomingElectionsQuestion = findQuestionByKeywords(['upcoming', 'election', 'tomorrow', 'assembly election'], survey);
      failedQuestions.push({
        criterion: 'upcomingElectionsMatching',
        questionText: upcomingElectionsQuestion?.text || upcomingElectionsQuestion?.questionText || 'Upcoming elections question',
        reason: 'Upcoming elections response did not match'
      });
    }
    
    // Previous Elections Matching - fails if not '1' or '3'
    if (criteria.previousElectionsMatching && !['1', '3'].includes(criteria.previousElectionsMatching)) {
      const previousElectionsQuestion = findQuestionByKeywords(['previous', 'election', 'last assembly', 'voted'], survey);
      failedQuestions.push({
        criterion: 'previousElectionsMatching',
        questionText: previousElectionsQuestion?.text || previousElectionsQuestion?.questionText || 'Previous elections question',
        reason: 'Previous elections response did not match'
      });
    }
    
    // Previous Lok Sabha Elections Matching - fails if not '1' or '3'
    if (criteria.previousLoksabhaElectionsMatching && !['1', '3'].includes(criteria.previousLoksabhaElectionsMatching)) {
      const loksabhaQuestion = findQuestionByKeywords(['lok sabha', 'loksabha', 'parliamentary'], survey);
      failedQuestions.push({
        criterion: 'previousLoksabhaElectionsMatching',
        questionText: loksabhaQuestion?.text || loksabhaQuestion?.questionText || 'Previous Lok Sabha elections question',
        reason: 'Previous Lok Sabha elections response did not match'
      });
    }
    
    // Name Matching - fails if not '1' or '3'
    if (criteria.nameMatching && !['1', '3'].includes(criteria.nameMatching)) {
      const nameQuestion = findQuestionByText('What is your full name?', survey) ||
                           findQuestionByKeywords(['name', 'full name'], survey);
      failedQuestions.push({
        criterion: 'nameMatching',
        questionText: nameQuestion?.text || nameQuestion?.questionText || 'Name question',
        reason: 'Name response did not match'
      });
    }
    
    // Age Matching - fails if not '1' or '3'
    if (criteria.ageMatching && !['1', '3'].includes(criteria.ageMatching)) {
      const ageQuestion = findQuestionByText('Could you please tell me your age in complete years?', survey) ||
                          findQuestionByKeywords(['age', 'year'], survey);
      failedQuestions.push({
        criterion: 'ageMatching',
        questionText: ageQuestion?.text || ageQuestion?.questionText || 'Age question',
        reason: 'Age response did not match'
      });
    }
    
    return failedQuestions;
  };

  // Get specific responses for verification questions
  const getVerificationResponses = () => {
    const responses = interview.responses || [];
    
    // Gender response - match by finding question in survey first
    let genderResponse = findResponseBySurveyQuestion(['gender', 'sex'], survey, false);
    if (!genderResponse) {
      genderResponse = findResponseByKeywords(['gender', 'sex'], false);
    }
    const genderValue = genderResponse?.response 
      ? (Array.isArray(genderResponse.response) ? genderResponse.response[0] : genderResponse.response)
      : null;
    
    // Upcoming election response (Q9) - "2025 Preference"
    // Match by finding question in survey first
    let upcomingElectionResponse = findResponseBySurveyQuestion(['2025', 'preference'], survey, true);
    if (!upcomingElectionResponse) {
      upcomingElectionResponse = findResponseByKeywords(['2025', 'preference'], true);
    }
    const upcomingElectionValue = upcomingElectionResponse?.response 
      ? (Array.isArray(upcomingElectionResponse.response) ? upcomingElectionResponse.response[0] : upcomingElectionResponse.response)
      : null;
    
    // 2021 Assembly election response (Q5) - "Q8: 2021 AE Party Choices" (AE = Assembly Election)
    // FIXED: Search for the actual question format: "2021 AE Party Choices" or "2021 ae party choice"
    // Strategy 1: Try finding by question number Q8 first (most reliable)
    let assembly2021Response = null;
    if (survey) {
      const actualSurvey = survey.survey || survey;
      let q8Question = null;
      
      // Search in sections
      if (actualSurvey.sections) {
        for (const section of actualSurvey.sections) {
          if (section.questions) {
            q8Question = section.questions.find((q: any) => {
              const qText = getMainText(q.text || q.questionText || '').toLowerCase();
              const qNumber = String(q.questionNumber || '').toLowerCase();
              // Match Q8 with 2021 and (AE or assembly) and party
              return (qNumber === '8' || qNumber === 'q8' || qNumber.includes('q8') || qNumber.includes('question 8')) &&
                     qText.includes('2021') && 
                     (qText.includes('ae') || qText.includes('assembly')) && 
                     qText.includes('party');
            });
            if (q8Question) break;
          }
        }
      }
      
      // Search in top-level questions
      if (!q8Question && actualSurvey.questions) {
        q8Question = actualSurvey.questions.find((q: any) => {
          const qText = getMainText(q.text || q.questionText || '').toLowerCase();
          const qNumber = String(q.questionNumber || '').toLowerCase();
          return (qNumber === '8' || qNumber === 'q8' || qNumber.includes('q8') || qNumber.includes('question 8')) &&
                 qText.includes('2021') && 
                 (qText.includes('ae') || qText.includes('assembly')) && 
                 qText.includes('party');
        });
      }
      
      if (q8Question) {
        const q8QuestionText = getMainText(q8Question.text || q8Question.questionText || '');
        assembly2021Response = findResponseByQuestionText(q8QuestionText);
      }
    }
    
    // Strategy 2: Look for "2021" AND "ae" AND "party choice" (specific keyword match)
    if (!assembly2021Response) {
      assembly2021Response = findResponseBySurveyQuestion([
        '2021', 'ae', 'party choice'
      ], survey, true, ['2024', 'lok sabha', 'loksabha', 'mp', 'by-election', 'by election', 'after 2021', 'parliamentary', 'ge party choice']);
    }
    
    // Strategy 3: Try with "2021", "ae", and "party" separately
    if (!assembly2021Response) {
      assembly2021Response = findResponseBySurveyQuestion([
        '2021', 'ae', 'party'
      ], survey, true, ['2024', 'lok sabha', 'loksabha', 'mp', 'by-election', 'by election', 'after 2021', 'parliamentary', 'ge party choice']);
    }
    
    // Strategy 4: Fallback - search by keywords directly in responses with exclusions
    if (!assembly2021Response) {
      assembly2021Response = findResponseByKeywords([
        '2021', 'ae', 'party choice'
      ], true, ['2024', 'lok sabha', 'loksabha', 'mp', 'by-election', 'by election', 'after 2021', 'parliamentary', 'ge party choice']);
    }
    
    // Strategy 5: Last fallback - search for "2021" and "assembly" with exclusions
    if (!assembly2021Response) {
      assembly2021Response = findResponseByKeywords([
        '2021', 'assembly', 'party'
      ], true, ['2024', 'lok sabha', 'loksabha', 'mp', 'by-election', 'by election', 'after 2021', 'parliamentary', 'ge party choice']);
    }
    const assembly2021Value = assembly2021Response?.response 
      ? (Array.isArray(assembly2021Response.response) ? assembly2021Response.response[0] : assembly2021Response.response)
      : null;
    
    // 2024 Lok Sabha election response (Q6) - "2024 GE Party Choice"
    // Match by finding "2024 GE Party Choice" question in survey first
    // Use more specific keywords to avoid matching age or other questions
    let lokSabha2024Response = null;
    
    // Strategy 1: Look for "ge party choice" with "2024" - require both
    lokSabha2024Response = findResponseBySurveyQuestion([
      'ge party choice', '2024'
    ], survey, true, ['age', 'বয়স', 'year', 'old', 'assembly', 'ae', '2021', '2025']);
    
    // Strategy 2: Look for responses with "2024" and "ge party choice" separately
    if (!lokSabha2024Response) {
      lokSabha2024Response = findResponseByKeywords([
        '2024', 'ge party choice'
      ], true, ['age', 'বয়স', 'year', 'old', 'assembly', 'ae', '2021', '2025', 'preference']);
    }
    
    // Strategy 3: Look for "ge party choice" (case-insensitive) with "2024" anywhere
    if (!lokSabha2024Response) {
      lokSabha2024Response = responses.find((r: any) => {
        const questionText = getMainText(r.questionText || '').toLowerCase();
        const has2024 = questionText.includes('2024');
        const hasGePartyChoice = questionText.includes('ge party choice') || questionText.includes('ge party');
        const hasExclude = questionText.includes('age') || questionText.includes('বয়স') || 
                          questionText.includes('assembly') || questionText.includes('ae') ||
                          questionText.includes('2021') || questionText.includes('2025') ||
                          questionText.includes('preference');
        return has2024 && hasGePartyChoice && !hasExclude;
      });
    }
    const lokSabha2024Value = lokSabha2024Response?.response 
      ? (Array.isArray(lokSabha2024Response.response) ? lokSabha2024Response.response[0] : lokSabha2024Response.response)
      : null;
    
    // Name response - "Would You like to share your name with us?"
    let nameResponse = findResponseBySurveyQuestion(['would you like to share your name', 'share your name', 'name with us'], survey, false);
    if (!nameResponse) {
      nameResponse = findResponseByKeywords(['would you like to share your name', 'share your name', 'name with us'], false);
    }
    // Fallback to general name search
    if (!nameResponse) {
      nameResponse = findResponseBySurveyQuestion(['name', 'respondent'], survey, false);
      if (!nameResponse) {
        nameResponse = findResponseByKeywords(['name', 'respondent'], false);
      }
    }
    const nameValue = nameResponse?.response 
      ? (Array.isArray(nameResponse.response) ? nameResponse.response[0] : nameResponse.response)
      : null;
    
    // Age response - "Could you please tell me your age in complete years?"
    // Try multiple matching strategies - start with simplest first
    let ageResponse = null;
    
    // Strategy 1: Direct text match - look for exact question text or key phrases
    ageResponse = responses.find((r: any) => {
      const questionText = getMainText(r.questionText || '').toLowerCase().trim();
      return questionText.includes('could you please tell me your age') ||
             questionText.includes('tell me your age in complete years') ||
             questionText === 'could you please tell me your age in complete years?';
    });
    
    // Strategy 2: More flexible matching - look for "age" and "years" or "complete years"
    if (!ageResponse) {
      ageResponse = responses.find((r: any) => {
        const questionText = getMainText(r.questionText || '').toLowerCase();
        return (questionText.includes('age') || questionText.includes('বয়স')) && 
               (questionText.includes('complete years') || questionText.includes('year'));
      });
    }
    
    // Strategy 3: Find question in survey first, excluding election-related terms
    if (!ageResponse) {
      ageResponse = findResponseBySurveyQuestion([
        'age', 'how old', 'tell me your age', 'complete years', 'বয়স'
      ], survey, false, ['election', 'vote', 'party', 'preference', 'lok sabha', 'loksabha', 'mp', 'mla', '2025', '2024', '2021']);
    }
    
    // Strategy 4: Direct keyword matching with exclusions
    if (!ageResponse) {
      ageResponse = findResponseByKeywords([
        'age', 'how old', 'tell me your age', 'complete years', 'বয়স'
      ], false, ['election', 'vote', 'party', 'preference', 'lok sabha', 'loksabha', 'mp', 'mla', '2025', '2024', '2021']);
    }
    
    // Strategy 5: Last resort - any question with "age" that doesn't have election keywords
    if (!ageResponse) {
      ageResponse = responses.find((r: any) => {
        const questionText = getMainText(r.questionText || '').toLowerCase();
        const hasAge = questionText.includes('age') || questionText.includes('বয়স');
        const hasElection = questionText.includes('election') || questionText.includes('vote') || 
                           questionText.includes('party') || questionText.includes('preference');
        return hasAge && !hasElection;
      });
    }
    
    // Strategy 6: Absolute last resort - ANY response with "age" in question text (no exclusions)
    if (!ageResponse) {
      ageResponse = responses.find((r: any) => {
        const questionText = getMainText(r.questionText || '').toLowerCase();
        return questionText.includes('age') || questionText.includes('বয়স');
      });
    }
    
    const ageValue = ageResponse?.response 
      ? (Array.isArray(ageResponse.response) ? ageResponse.response[0] : ageResponse.response)
      : null;
    
    return {
      gender: genderValue ? formatResponseDisplay(genderValue, findQuestionByText(genderResponse?.questionText, survey)) : 'Not Available',
      upcomingElection: upcomingElectionValue ? formatResponseDisplay(upcomingElectionValue, findQuestionByText(upcomingElectionResponse?.questionText, survey)) : 'Not Available',
      assembly2021: assembly2021Value ? formatResponseDisplay(assembly2021Value, findQuestionByText(assembly2021Response?.questionText, survey)) : 'Not Available',
      lokSabha2024: lokSabha2024Value ? formatResponseDisplay(lokSabha2024Value, findQuestionByText(lokSabha2024Response?.questionText, survey)) : 'Not Available',
      name: nameValue ? formatResponseDisplay(nameValue, findQuestionByText(nameResponse?.questionText, survey)) : 'Not Available',
      age: ageValue ? formatResponseDisplay(ageValue, findQuestionByText(ageResponse?.questionText, survey)) : 'Not Available',
      // Include response objects to check if skipped
      genderResponse,
      upcomingElectionResponse,
      assembly2021Response,
      lokSabha2024Response,
      nameResponse,
      ageResponse
    };
  };

  // OPTIMIZED: Handle null interview gracefully (while loading)
  if (!interview) {
    // Show loading state if modal is visible but interview data not yet loaded
    if (visible) {
      return (
        <Modal
          visible={visible}
          animationType="slide"
          transparent={true}
          onRequestClose={onClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Loading Response Details...</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#001D48" />
                <Text style={styles.loadingText}>Fetching response details...</Text>
              </View>
            </View>
          </View>
        </Modal>
      );
    }
    return null;
  }

  const survey = interview?.survey || interview?.survey?.survey || null;
  const verificationResponses = getVerificationResponses();

  const statusBarHeight = Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header - Fixed at top */}
        <View style={[styles.header, { paddingTop: statusBarHeight + 12 }]}>
          <Text style={styles.headerTitle}>Response Details</Text>
          <Button
            mode="text"
            onPress={handleClose}
            icon="close"
            textColor="#6b7280"
            compact
          >
            Close
          </Button>
        </View>

        <Divider style={styles.divider} />

        {/* Audio Recording (CAPI) - Sticky at top */}
        {interview.interviewMode === 'capi' && (
          <View style={styles.stickyAudioSection}>
            <Card style={styles.audioCard}>
              <Card.Content style={styles.audioCardContent}>
                <Text style={styles.audioSectionTitle}>Audio Recording</Text>
                
                {(() => {
                  // Check if audio exists in interview data (similar to web app logic)
                  const signedUrl = interview.metadata?.audioRecording?.signedUrl || 
                                   interview.audioRecording?.signedUrl ||
                                   interview.signedUrl;
                  const audioUrl = interview.metadata?.audioRecording?.audioUrl || 
                                  interview.audioUrl || 
                                  interview.audioRecording?.url ||
                                  interview.audioRecording?.audioUrl;
                  const hasAudio = !!(signedUrl || audioUrl);
                  return hasAudio;
                })() ? (
                  <View style={styles.audioControls}>
                    {audioDuration > 0 ? (
                      <>
                        <View style={styles.audioTimelineContainer}>
                          {/* Play/Pause Button */}
                          <Button
                            mode="contained"
                            onPress={togglePlayPause}
                            icon={isPlaying ? "pause" : "play"}
                            style={styles.audioButtonInline}
                            disabled={!audioSound || isLoadingAudio || audioOperationLockRef.current}
                            compact
                            loading={audioOperationLockRef.current}
                          >
                            {isPlaying ? 'Pause' : 'Play'}
                          </Button>
                          
                          {/* 10 Seconds Backward Button */}
                          <TouchableOpacity
                            onPress={skipBackward10s}
                            disabled={!audioSound || audioPosition <= 0}
                            style={[
                              styles.audioSkipButton,
                              (!audioSound || audioPosition <= 0) && styles.audioSkipButtonDisabled
                            ]}
                          >
                            <View style={styles.skipButtonContainer}>
                              <Ionicons 
                                name="play-skip-back" 
                                size={24} 
                                color={(!audioSound || audioPosition <= 0) ? '#9ca3af' : '#2563eb'} 
                              />
                              <Text style={[styles.skipButtonText, (!audioSound || audioPosition <= 0) && styles.skipButtonTextDisabled]}>
                                10
                              </Text>
                            </View>
                          </TouchableOpacity>
                          
                          {/* Current Time */}
                          <Text style={styles.audioTime}>
                            {formatTime(audioPosition)}
                          </Text>
                          
                          {/* Seek Bar */}
                          <TouchableOpacity
                            activeOpacity={1}
                            style={styles.sliderContainer}
                            onLayout={(event) => {
                              const { width } = event.nativeEvent.layout;
                              setSliderWidth(width);
                            }}
                            onPress={handleSliderPress}
                            {...panResponder.panHandlers}
                          >
                            <View 
                              ref={sliderRef}
                              style={styles.sliderTrack}
                            >
                              <View 
                                style={[
                                  styles.sliderProgress,
                                  { width: `${audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0}%` }
                                ]}
                              />
                              <View
                                style={[
                                  styles.sliderThumb,
                                  { left: `${audioDuration > 0 ? (audioPosition / audioDuration) * 100 : 0}%` }
                                ]}
                              />
                            </View>
                          </TouchableOpacity>
                          
                          {/* Total Time */}
                          <Text style={styles.audioTime}>
                            {formatTime(audioDuration)}
                          </Text>
                          
                          {/* 10 Seconds Forward Button */}
                          <TouchableOpacity
                            onPress={skipForward10s}
                            disabled={!audioSound || audioPosition >= audioDuration}
                            style={[
                              styles.audioSkipButton,
                              (!audioSound || audioPosition >= audioDuration) && styles.audioSkipButtonDisabled
                            ]}
                          >
                            <View style={styles.skipButtonContainer}>
                              <Ionicons 
                                name="play-skip-forward" 
                                size={24} 
                                color={(!audioSound || audioPosition >= audioDuration) ? '#9ca3af' : '#2563eb'} 
                              />
                              <Text style={[styles.skipButtonText, (!audioSound || audioPosition >= audioDuration) && styles.skipButtonTextDisabled]}>
                                10
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                        {/* Speed Control */}
                        <View style={styles.speedControlContainer}>
                          <Text style={styles.speedLabel}>Speed</Text>
                          <TouchableOpacity
                            onPress={decreaseSpeed}
                            disabled={playbackRate <= 0.5}
                            style={[styles.speedButtonTouchable, playbackRate <= 0.5 && styles.speedButtonDisabled]}
                          >
                            <Ionicons 
                              name="remove-circle-outline" 
                              size={24} 
                              color={playbackRate <= 0.5 ? '#9ca3af' : '#2563eb'} 
                            />
                          </TouchableOpacity>
                          <Text style={styles.speedValue}>{playbackRate.toFixed(2)}x</Text>
                          <TouchableOpacity
                            onPress={increaseSpeed}
                            disabled={playbackRate >= 4.0}
                            style={[styles.speedButtonTouchable, playbackRate >= 4.0 && styles.speedButtonDisabled]}
                          >
                            <Ionicons 
                              name="add-circle-outline" 
                              size={24} 
                              color={playbackRate >= 4.0 ? '#9ca3af' : '#2563eb'} 
                            />
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Button
                        mode="contained"
                        onPress={togglePlayPause}
                        icon={isLoadingAudio ? undefined : (isPlaying ? "pause" : "play")}
                        style={styles.audioButton}
                        disabled={isLoadingAudio || audioOperationLockRef.current}
                        loading={isLoadingAudio || audioOperationLockRef.current}
                      >
                        {isLoadingAudio ? 'Loading...' : (isPlaying ? 'Pause' : 'Play')}
                      </Button>
                    )}
                  </View>
                ) : (
                  <Text style={styles.noDataText}>No Recording Found</Text>
                )}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Audio Recording (CATI) - Sticky at top (same as CAPI) */}
        {interview.interviewMode === 'cati' && (catiCallDetails?.recordingUrl || catiCallDetails?.s3AudioUrl || catiRecordingUri) && (
          <View style={styles.stickyAudioSection}>
            <Card style={styles.audioCard}>
              <Card.Content style={styles.audioCardContent}>
                <Text style={styles.audioSectionTitle}>Call Recording</Text>
                
                {loadingCatiRecording ? (
                  <View style={styles.audioControls}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.noDataText}>Loading recording...</Text>
                  </View>
                ) : catiAudioSound ? (
                  <View style={styles.audioControls}>
                    {catiAudioDuration > 0 ? (
                      <>
                        <View style={styles.audioTimelineContainer}>
                          {/* Play/Pause Button */}
                          <Button
                            mode="contained"
                            onPress={toggleCatiPlayPause}
                            icon={isPlayingCatiAudio ? "pause" : "play"}
                            style={styles.audioButtonInline}
                            disabled={!catiAudioSound || catiAudioOperationLockRef.current}
                            compact
                            loading={catiAudioOperationLockRef.current}
                          >
                            {isPlayingCatiAudio ? 'Pause' : 'Play'}
                          </Button>
                          
                          {/* 10 Seconds Backward Button */}
                          <TouchableOpacity
                            onPress={skipCatiBackward10s}
                            disabled={!catiAudioSound || catiAudioPosition <= 0}
                            style={[
                              styles.audioSkipButton,
                              (!catiAudioSound || catiAudioPosition <= 0) && styles.audioSkipButtonDisabled
                            ]}
                          >
                            <View style={styles.skipButtonContainer}>
                              <Ionicons 
                                name="play-skip-back" 
                                size={24} 
                                color={(!catiAudioSound || catiAudioPosition <= 0) ? '#9ca3af' : '#2563eb'} 
                              />
                              <Text style={[styles.skipButtonText, (!catiAudioSound || catiAudioPosition <= 0) && styles.skipButtonTextDisabled]}>
                                10
                              </Text>
                            </View>
                          </TouchableOpacity>
                          
                          {/* Current Time */}
                          <Text style={styles.audioTime}>
                            {formatTime(catiAudioPosition)}
                          </Text>
                          
                          {/* Seek Bar */}
                          <TouchableOpacity
                            activeOpacity={1}
                            style={styles.sliderContainer}
                            onLayout={(event) => {
                              const { width } = event.nativeEvent.layout;
                              setCatiSliderWidth(width);
                            }}
                            onPress={handleCatiSliderPress}
                          >
                            <View 
                              ref={catiSliderRef}
                              style={styles.sliderTrack}
                            >
                              <View 
                                style={[
                                  styles.sliderProgress,
                                  { width: `${catiAudioDuration > 0 ? (catiAudioPosition / catiAudioDuration) * 100 : 0}%` }
                                ]}
                              />
                              <View
                                style={[
                                  styles.sliderThumb,
                                  { left: `${catiAudioDuration > 0 ? (catiAudioPosition / catiAudioDuration) * 100 : 0}%` }
                                ]}
                              />
                            </View>
                          </TouchableOpacity>
                          
                          {/* Total Time */}
                          <Text style={styles.audioTime}>
                            {formatTime(catiAudioDuration)}
                          </Text>
                          
                          {/* 10 Seconds Forward Button */}
                          <TouchableOpacity
                            onPress={skipCatiForward10s}
                            disabled={!catiAudioSound || catiAudioPosition >= catiAudioDuration}
                            style={[
                              styles.audioSkipButton,
                              (!catiAudioSound || catiAudioPosition >= catiAudioDuration) && styles.audioSkipButtonDisabled
                            ]}
                          >
                            <View style={styles.skipButtonContainer}>
                              <Ionicons 
                                name="play-skip-forward" 
                                size={24} 
                                color={(!catiAudioSound || catiAudioPosition >= catiAudioDuration) ? '#9ca3af' : '#2563eb'} 
                              />
                              <Text style={[styles.skipButtonText, (!catiAudioSound || catiAudioPosition >= catiAudioDuration) && styles.skipButtonTextDisabled]}>
                                10
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                        {/* Speed Control */}
                        <View style={styles.speedControlContainer}>
                          <Text style={styles.speedLabel}>Speed:</Text>
                          <TouchableOpacity
                            onPress={decreaseCatiSpeed}
                            disabled={catiPlaybackRate <= 0.5}
                            style={[styles.speedButtonTouchable, catiPlaybackRate <= 0.5 && styles.speedButtonDisabled]}
                          >
                            <Ionicons 
                              name="remove-circle-outline" 
                              size={24} 
                              color={catiPlaybackRate <= 0.5 ? '#9ca3af' : '#2563eb'} 
                            />
                          </TouchableOpacity>
                          <Text style={styles.speedValue}>{catiPlaybackRate.toFixed(2)}x</Text>
                          <TouchableOpacity
                            onPress={increaseCatiSpeed}
                            disabled={catiPlaybackRate >= 4.0}
                            style={[styles.speedButtonTouchable, catiPlaybackRate >= 4.0 && styles.speedButtonDisabled]}
                          >
                            <Ionicons 
                              name="add-circle-outline" 
                              size={24} 
                              color={catiPlaybackRate >= 4.0 ? '#9ca3af' : '#2563eb'} 
                            />
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <Button
                        mode="contained"
                        onPress={toggleCatiPlayPause}
                        icon={isPlayingCatiAudio ? "pause" : "play"}
                        style={styles.audioButton}
                        disabled={!catiAudioSound}
                      >
                        {isPlayingCatiAudio ? 'Pause' : 'Play'}
                      </Button>
                    )}
                  </View>
                ) : (catiCallDetails?.recordingUrl || catiCallDetails?.s3AudioUrl || catiRecordingUri) ? (
                  <View style={styles.audioControls}>
                    <Text style={styles.noDataText}>
                      {catiRecordingUri ? 'Recording ready - tap to load' : 'Recording available - tap to download'}
                    </Text>
                    <Button
                      mode="contained"
                      onPress={playCatiAudio}
                      icon="play"
                      style={styles.audioButton}
                      loading={loadingCatiRecording}
                      disabled={loadingCatiRecording}
                    >
                      {loadingCatiRecording ? 'Loading...' : 'Load Recording'}
                    </Button>
                  </View>
                ) : (
                  <Text style={styles.noDataText}>No Recording Available</Text>
                )}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Scrollable Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Interview Info */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Interview Information</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Survey:</Text>
                  <Text style={styles.infoValue}>{survey?.surveyName || 'N/A'}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Response ID:</Text>
                  <Text style={styles.infoValue}>{interview.responseId || 'N/A'}</Text>
                </View>
                
                {interview.interviewer ? (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Interviewer:</Text>
                      <Text style={styles.infoValue}>
                        {interview.interviewer.firstName || ''} {interview.interviewer.lastName || ''}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Interviewer ID:</Text>
                      <Text style={styles.infoValue}>
                        {interview.interviewer?.memberId || interview.interviewer?.memberID || 'N/A'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Interviewer:</Text>
                    <Text style={styles.infoValue}>Not available</Text>
                  </View>
                )}
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mode:</Text>
                  <Text style={styles.infoValue}>{(interview.interviewMode || 'CAPI').toUpperCase()}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Duration:</Text>
                  <Text style={styles.infoValue}>
                    {interview.totalTimeSpent 
                      ? `${Math.floor(interview.totalTimeSpent / 60)}m ${interview.totalTimeSpent % 60}s`
                      : 'N/A'}
                  </Text>
                </View>
                
                {interview.selectedAC && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Assembly Constituency:</Text>
                    <Text style={styles.infoValue}>{interview.selectedAC}</Text>
                  </View>
                )}
                
                {interview.selectedPollingStation?.stationName && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Polling Station:</Text>
                    <Text style={styles.infoValue}>
                      {interview.selectedPollingStation.stationName}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* GPS Location Information - Only for CAPI interviews */}
            {interview.interviewMode === 'capi' && (interview.location || interview.locationData) && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>Interview Location</Text>
                  
                  {(() => {
                    const location = interview.location || interview.locationData;
                    if (!location) return null;
                    
                    return (
                      <>
                        {location.address && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Address:</Text>
                            <Text style={styles.infoValue}>{location.address}</Text>
                          </View>
                        )}
                        
                        {location.latitude && location.longitude && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>GPS Coordinates:</Text>
                            <Text style={[styles.infoValue, { fontFamily: 'monospace', fontSize: 12 }]}>
                              ({typeof location.latitude === 'number' ? location.latitude.toFixed(4) : parseFloat(location.latitude).toFixed(4)}, {typeof location.longitude === 'number' ? location.longitude.toFixed(4) : parseFloat(location.longitude).toFixed(4)})
                            </Text>
                          </View>
                        )}
                        
                        {location.accuracy && (
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Accuracy:</Text>
                            <Text style={styles.infoValue}>±{Math.round(typeof location.accuracy === 'number' ? location.accuracy : parseFloat(location.accuracy))} meters</Text>
                          </View>
                        )}
                        
                        {location.latitude && location.longitude && (
                          <View style={styles.infoRow}>
                            <Button
                              mode="outlined"
                              onPress={() => {
                                const lat = typeof location.latitude === 'number' ? location.latitude : parseFloat(location.latitude);
                                const lng = typeof location.longitude === 'number' ? location.longitude : parseFloat(location.longitude);
                                const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                                Linking.openURL(mapsUrl).catch((err: any) => {
                                  console.error('Error opening maps:', err);
                                });
                              }}
                              icon="map"
                              style={{ marginTop: 8 }}
                            >
                              View on Google Maps
                            </Button>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </Card.Content>
              </Card>
            )}

            {/* CATI Call Information */}
            {interview.interviewMode === 'cati' && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>Call Information</Text>
                  
                  {loadingCatiRecording ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : catiCallDetails ? (
                    <View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Call Status:</Text>
                        <Text style={[
                          styles.infoValue,
                          (catiCallDetails.callStatus === 'completed' || catiCallDetails.callStatus === 'answered') && { color: '#16a34a' },
                          (catiCallDetails.callStatus === 'failed' || catiCallDetails.callStatus === 'busy') && { color: '#dc2626' }
                        ]}>
                          {catiCallDetails.callStatusDescription || catiCallDetails.statusDescription || catiCallDetails.callStatus || 'N/A'}
                        </Text>
                      </View>
                      
                      {(catiCallDetails.callStatusCode || catiCallDetails.originalStatusCode) && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Status Code:</Text>
                          <Text style={styles.infoValue}>
                            {catiCallDetails.callStatusCode || catiCallDetails.originalStatusCode}
                          </Text>
                        </View>
                      )}
                      
                      {catiCallDetails.callId && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Call ID:</Text>
                          <Text style={[styles.infoValue, { fontFamily: 'monospace', fontSize: 11 }]}>
                            {catiCallDetails.callId}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>From Number:</Text>
                        <Text style={styles.infoValue}>{catiCallDetails.fromNumber || 'N/A'}</Text>
                      </View>
                      
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>To Number:</Text>
                        <Text style={styles.infoValue}>{catiCallDetails.toNumber || 'N/A'}</Text>
                      </View>
                      
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Call Duration:</Text>
                        <Text style={styles.infoValue}>
                          {catiCallDetails.callDuration ? formatDuration(catiCallDetails.callDuration) : 'N/A'}
                        </Text>
                      </View>
                      
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Talk Duration:</Text>
                        <Text style={styles.infoValue}>
                          {catiCallDetails.talkDuration ? formatDuration(catiCallDetails.talkDuration) : 'N/A'}
                        </Text>
                      </View>
                      
                      {(catiCallDetails.startTime || catiCallDetails.callStartTime) && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Call Start Time:</Text>
                          <Text style={styles.infoValue}>
                            {new Date(catiCallDetails.startTime || catiCallDetails.callStartTime).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      
                      {(catiCallDetails.endTime || catiCallDetails.callEndTime) && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Call End Time:</Text>
                          <Text style={styles.infoValue}>
                            {new Date(catiCallDetails.endTime || catiCallDetails.callEndTime).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      
                      {catiCallDetails.ringDuration && catiCallDetails.ringDuration > 0 && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Ring Duration:</Text>
                          <Text style={styles.infoValue}>
                            {formatDuration(catiCallDetails.ringDuration)}
                          </Text>
                        </View>
                      )}
                      
                      {catiCallDetails.hangupCause && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Hangup Cause:</Text>
                          <Text style={styles.infoValue}>{catiCallDetails.hangupCause}</Text>
                        </View>
                      )}
                      
                      {catiCallDetails.hangupBySource && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Hangup By:</Text>
                          <Text style={styles.infoValue}>{catiCallDetails.hangupBySource}</Text>
                        </View>
                      )}
                      
                      {catiCallDetails.recordingUrl && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Recording Available:</Text>
                          <Text style={[styles.infoValue, { color: '#16a34a' }]}>Yes</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoValue}>Call details not available</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* CATI Call Recording - REMOVED: Now in sticky section at top (same as CAPI) */}

            {/* Responses - Collapsible */}
            <Card style={styles.card}>
              <Card.Content>
                <TouchableOpacity
                  onPress={() => setResponsesSectionExpanded(!responsesSectionExpanded)}
                  style={styles.collapsibleHeader}
                >
                  <Text style={styles.sectionTitle}>Responses</Text>
                  <Ionicons
                    name={responsesSectionExpanded ? "chevron-up" : "chevron-down"}
                    size={24}
                    color="#6b7280"
                  />
                </TouchableOpacity>
                
                {responsesSectionExpanded && (
                  <View style={styles.responsesContent}>
                    {interview.responses && interview.responses.length > 0 ? (
                      interview.responses
                        .filter((r: any) => {
                          // Filter out AC and polling station questions
                          const questionText = r.questionText || '';
                          return !questionText.toLowerCase().includes('select assembly constituency') &&
                                 !questionText.toLowerCase().includes('select polling station');
                        })
                        .map((response: any, index: number) => {
                          const question = findQuestionByText(response.questionText, survey);
                          return (
                            <View key={index} style={styles.responseItem}>
                              <Text style={styles.questionText}>
                                Q{index + 1}: {response.questionText}
                              </Text>
                              <Text style={styles.responseText}>
                                {formatResponseDisplay(response.response, question)}
                              </Text>
                            </View>
                          );
                        })
                    ) : (
                      <Text style={styles.noDataText}>No responses available</Text>
                    )}
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Rejection Reason - Only show if status is Rejected */}
            {interview.status === 'Rejected' && interview.verificationData && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>Rejection Reason</Text>
                  <View style={[styles.infoCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, padding: 12, borderRadius: 8 }]}>
                    {interview.verificationData.feedback && (
                      <View style={styles.verificationRow}>
                        <Text style={[styles.verificationLabel, { color: '#991b1b', fontWeight: '600' }]}>Reason:</Text>
                        <Text style={[styles.verificationValue, { color: '#7f1d1d', flex: 1, marginLeft: 8 }]}>
                          {interview.verificationData.feedback}
                        </Text>
                      </View>
                    )}
                    {(() => {
                      const failedQuestions = getFailedQuestions(interview.verificationData, survey);
                      if (failedQuestions.length > 0) {
                        return (
                          <View style={{ marginTop: 12 }}>
                            <Text style={[styles.verificationLabel, { color: '#991b1b', marginBottom: 8, fontWeight: '600' }]}>
                              Questions that failed quality review:
                            </Text>
                            {failedQuestions.map((failed, index) => (
                              <View key={index} style={{ marginBottom: 8, paddingLeft: 8 }}>
                                <Text style={[styles.verificationValue, { color: '#7f1d1d', fontWeight: '500' }]}>
                                  • {failed.questionText}
                                </Text>
                                {failed.reason && (
                                  <Text style={[styles.verificationValue, { color: '#991b1b', fontSize: 12, marginTop: 2, marginLeft: 8 }]}>
                                    {failed.reason}
                                  </Text>
                                )}
                              </View>
                            ))}
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* Verification Form */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Quality Verification</Text>
                
                {/* Audio Status */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>1. Audio status (অডিও স্ট্যাটাস) *</Text>
                  <RadioButton.Group
                    onValueChange={(value) => handleVerificationFormChange('audioStatus', value)}
                    value={verificationForm.audioStatus}
                  >
                    <RadioButton.Item 
                      label="1 - Survey Conversation can be heard (জরিপের কথোপকথন শোনা যাচ্ছে)" 
                      value="1" 
                      style={styles.radioItem}
                    />
                    <RadioButton.Item 
                      label="2 - No Conversation (কোনো কথোপকথন নেই)" 
                      value="2" 
                      style={styles.radioItem}
                    />
                    <RadioButton.Item 
                      label="3 - Irrelevant Conversation (অপ্রাসঙ্গিক কথোপকথন)" 
                      value="3" 
                      style={styles.radioItem}
                    />
                    <RadioButton.Item 
                      label="4 - Can hear the interviewer more than the respondent (সাক্ষাৎকারগ্রহণকারীর কণ্ঠস্বর উত্তরদাতার তুলনায় বেশি শোনা যাচ্ছে)" 
                      value="4" 
                      style={styles.radioItem}
                    />
                    <RadioButton.Item 
                      label="7 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)" 
                      value="7" 
                      style={styles.radioItem}
                    />
                    <RadioButton.Item 
                      label="8 - Fraud interview (প্রতারণামূলক সাক্ষাৎকার)" 
                      value="8" 
                      style={styles.radioItem}
                    />
                    <RadioButton.Item 
                      label="9 - Interviewer acting as respondent (সাক্ষাৎকার গ্রহণকারী উত্তরদাতার ভূমিকা পালন করছেন।)" 
                      value="9" 
                      style={styles.radioItem}
                    />
                  </RadioButton.Group>
                </View>

                {/* Gender Matching - Only show if Audio Status is '1' or '7' */}
                {shouldShowVerificationQuestion('gender') && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>2. Gender of the Respondent Matching? (উত্তরদাতার লিঙ্গ কি মেলানো হয়েছে?) *</Text>
                    <Text style={styles.responseDisplayText}>Response: {verificationResponses.gender}</Text>
                    <RadioButton.Group
                      onValueChange={(value) => handleVerificationFormChange('genderMatching', value)}
                      value={verificationForm.genderMatching}
                    >
                      <RadioButton.Item 
                        label="1 - Matched (মিলে গেছে)" 
                        value="1" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="2 - Not Matched (মেলেনি)" 
                        value="2" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="3 - Male answering on behalf of female (মহিলার পক্ষ থেকে পুরুষ উত্তর দিচ্ছেন।)" 
                        value="3" 
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                  </View>
                )}

                {/* Upcoming Elections Matching */}
                {shouldShowVerificationQuestion('upcomingElection') && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>3. Is the Response Matching for the Upcoming Elections preference (Q8)? (উত্তরটি কি আসন্ন নির্বাচনের পছন্দ (প্রশ্ন ৮) এর সাথে মিলে যাচ্ছে?) *</Text>
                    <Text style={styles.responseDisplayText}>Response: {verificationResponses.upcomingElection}</Text>
                    <RadioButton.Group
                      onValueChange={(value) => handleVerificationFormChange('upcomingElectionsMatching', value)}
                      value={verificationForm.upcomingElectionsMatching}
                    >
                      <RadioButton.Item 
                        label="1 - Matched (মিলে গেছে)" 
                        value="1" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="2 - Not Matched (মেলেনি)" 
                        value="2" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)" 
                        value="3" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="4 - Did not ask (জিজ্ঞাসা করা হয়নি)" 
                        value="4" 
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                  </View>
                )}

                {/* Previous Elections Matching */}
                {shouldShowVerificationQuestion('assembly2021') && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>4. Is the Response Matching for the Previous 2021 Assembly Election (Q5)? (উত্তরটি কি ২০২১ সালের পূর্ববর্তী বিধানসভা নির্বাচনের (প্রশ্ন ৫) সাথে মিলে যাচ্ছে?) *</Text>
                    <Text style={styles.responseDisplayText}>Response: {verificationResponses.assembly2021}</Text>
                    <RadioButton.Group
                      onValueChange={(value) => handleVerificationFormChange('previousElectionsMatching', value)}
                      value={verificationForm.previousElectionsMatching}
                    >
                      <RadioButton.Item 
                        label="1 - Matched (মিলে গেছে)" 
                        value="1" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="2 - Not Matched (মেলেনি)" 
                        value="2" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)" 
                        value="3" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="4 - Did not ask (জিজ্ঞাসা করা হয়নি)" 
                        value="4" 
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                  </View>
                )}

                {/* Previous Loksabha Elections Matching */}
                {shouldShowVerificationQuestion('lokSabha2024') && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>5. Is the Response Matching for the Previous 2024 Loksabha Election (Q6)? (উত্তরটি কি ২০২৪ সালের পূর্ববর্তী লোকসভা নির্বাচনের (প্রশ্ন ৬) সাথে মিলে যাচ্ছে?) *</Text>
                    <Text style={styles.responseDisplayText}>Response: {verificationResponses.lokSabha2024}</Text>
                    <RadioButton.Group
                      onValueChange={(value) => handleVerificationFormChange('previousLoksabhaElectionsMatching', value)}
                      value={verificationForm.previousLoksabhaElectionsMatching}
                    >
                      <RadioButton.Item 
                        label="1 - Matched (মিলে গেছে)" 
                        value="1" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="2 - Not Matched (মেলেনি)" 
                        value="2" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)" 
                        value="3" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="4 - Did not ask (জিজ্ঞাসা করা হয়নি)" 
                        value="4" 
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                  </View>
                )}

                {/* Name Matching */}
                {shouldShowVerificationQuestion('name') && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>6. Name of the Respondent Matching? (উত্তরদাতার নাম কি মিলে গেছে?) *</Text>
                    <Text style={styles.responseDisplayText}>Response: {verificationResponses.name}</Text>
                    <RadioButton.Group
                      onValueChange={(value) => handleVerificationFormChange('nameMatching', value)}
                      value={verificationForm.nameMatching}
                    >
                      <RadioButton.Item 
                        label="1 - Matched (মিলে গেছে)" 
                        value="1" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="2 - Not Matched (মেলেনি)" 
                        value="2" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)" 
                        value="3" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="4 - Did not ask (জিজ্ঞাসা করা হয়নি)" 
                        value="4" 
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                  </View>
                )}

                {/* Age Matching */}
                {shouldShowVerificationQuestion('age') && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>7. Is the Age matching? (বয়স কি মিলে গেছে?) *</Text>
                    <Text style={styles.responseDisplayText}>Response: {verificationResponses.age}</Text>
                    <RadioButton.Group
                      onValueChange={(value) => handleVerificationFormChange('ageMatching', value)}
                      value={verificationForm.ageMatching}
                    >
                      <RadioButton.Item 
                        label="1 - Matched (মিলে গেছে)" 
                        value="1" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="2 - Not Matched (মেলেনি)" 
                        value="2" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="3 - Cannot hear the response clearly (উত্তর স্পষ্টভাবে শোনা যাচ্ছে না)" 
                        value="3" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="4 - Did not ask (জিজ্ঞাসা করা হয়নি)" 
                        value="4" 
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                  </View>
                )}

                {/* Phone Number Asked */}
                {shouldShowVerificationQuestion('phoneNumber') && (
                  <View style={styles.formSection}>
                    <Text style={styles.formLabel}>8. Did the interviewer ask the phone number of the respondent? (সাক্ষাৎকারগ্রহণকারী কি উত্তরদাতার ফোন নম্বর জিজ্ঞাসা করেছিলেন?) *</Text>
                    <RadioButton.Group
                      onValueChange={(value) => handleVerificationFormChange('phoneNumberAsked', value)}
                      value={verificationForm.phoneNumberAsked}
                    >
                      <RadioButton.Item 
                        label="1 - Asked the number and noted in the questionnaire (নম্বরটি জিজ্ঞাসা করে প্রশ্নপত্রে নোট করা হয়েছে)" 
                        value="1" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="2 - Asked the question but the respondent refused to share (প্রশ্নটি করা হয়েছে কিন্তু উত্তরদাতা শেয়ার করতে অস্বীকার করেছেন)" 
                        value="2" 
                        style={styles.radioItem}
                      />
                      <RadioButton.Item 
                        label="3 - Did not ask (জিজ্ঞাসা করা হয়নি)" 
                        value="3" 
                        style={styles.radioItem}
                      />
                    </RadioButton.Group>
                  </View>
                )}

                {/* Custom Feedback */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>9. Additional Feedback (Optional)</Text>
                  <View style={styles.feedbackInputContainer}>
                    <TextInput
                      mode="outlined"
                      multiline
                      numberOfLines={4}
                      placeholder="Enter any additional feedback..."
                      placeholderTextColor="#9ca3af"
                      value={verificationForm.customFeedback}
                      onChangeText={(text) => handleVerificationFormChange('customFeedback', text)}
                      style={styles.feedbackInput}
                      contentStyle={styles.feedbackInputContent}
                      blurOnSubmit={false}
                      returnKeyType="default"
                      outlineColor="#e5e7eb"
                      activeOutlineColor="#2563eb"
                    />
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtonsContainer}>
                  {onSkip && (
                    <Button
                      mode="outlined"
                      onPress={handleSkip}
                      style={styles.skipButton}
                      textColor="#6b7280"
                      labelStyle={styles.skipButtonText}
                      disabled={isSubmitting}
                    >
                      Skip
                    </Button>
                  )}
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    style={[styles.submitButton, !onSkip && styles.submitButtonFullWidth]}
                    textColor="#FFFFFF"
                    labelStyle={styles.submitButtonText}
                    loading={isSubmitting}
                    disabled={!isVerificationFormValid() || isSubmitting}
                  >
                    Submit Verification
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>

        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stickyAudioSection: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  audioCard: {
    marginBottom: 0,
    elevation: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  divider: {
    height: 0,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    width: 140,
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  // PERFORMANCE FIX: Compact info layout for CATI call details (reduces height)
  compactInfoContainer: {
    marginTop: 4,
  },
  compactInfoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 12,
  },
  compactInfoItem: {
    flex: 1,
    minWidth: '45%',
  },
  compactInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  compactInfoValue: {
    fontSize: 13,
    color: '#1f2937',
    flexWrap: 'wrap',
  },
  audioCardContent: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  audioSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  audioControls: {
    marginTop: 4,
  },
  audioButton: {
    minWidth: 100,
    marginBottom: 8,
    backgroundColor: '#2563eb',
  },
  audioButtonInline: {
    minWidth: 70,
    marginRight: 6,
    backgroundColor: '#2563eb',
  },
  audioTimelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 6,
    marginTop: 0,
    marginBottom: 4,
  },
  sliderContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    position: 'relative',
    width: '100%',
  },
  sliderProgress: {
    height: 4,
    backgroundColor: '#2563eb',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    position: 'absolute',
    top: -6,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  audioTime: {
    fontSize: 12,
    color: '#6b7280',
    minWidth: 50,
    textAlign: 'center',
  },
  speedControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  speedLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    marginRight: 4,
  },
  speedValue: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'center',
  },
  speedButton: {
    minWidth: 40,
    height: 36,
  },
  speedButtonTouchable: {
    padding: 4,
    borderRadius: 4,
  },
  speedButtonDisabled: {
    opacity: 0.5,
  },
  audioSkipButton: {
    padding: 4,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 36,
  },
  audioSkipButtonDisabled: {
    opacity: 0.4,
  },
  skipButtonContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  skipButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: -2,
  },
  skipButtonTextDisabled: {
    color: '#9ca3af',
  },
  responseItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  responseText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  noDataText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  audioInfoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  audioInfoText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
  responseDisplayText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '500',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  radioItem: {
    paddingVertical: 4,
    marginVertical: 0,
  },
  feedbackInputContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  feedbackInput: {
    backgroundColor: '#ffffff',
    minHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  feedbackInputContent: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    minHeight: 100,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  skipButton: {
    flex: 1,
    borderColor: '#d1d5db',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
  },
  submitButtonFullWidth: {
    flex: 1,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  snackbar: {
    backgroundColor: '#1f2937',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  responsesContent: {
    marginTop: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verificationRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  verificationLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    minWidth: 100,
  },
  verificationValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
});

