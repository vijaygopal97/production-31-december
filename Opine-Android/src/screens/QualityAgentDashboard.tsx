import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  Alert,
  Image,
  Animated,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Avatar,
  Snackbar,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../services/api';
import { User } from '../types';
import ResponseDetailsModal from '../components/ResponseDetailsModal';
import { appUpdateService, UpdateInfo } from '../services/appUpdateService';
import { AppUpdateModal } from '../components/AppUpdateModal';
import NetInfo from '@react-native-community/netinfo';
import { analyticsService } from '../services/analyticsService';

// Performance monitoring
const performanceLog: { [key: string]: number[] } = {};
const logPerformance = (key: string, duration: number) => {
  if (!performanceLog[key]) performanceLog[key] = [];
  performanceLog[key].push(duration);
  console.log(`⚡ Performance [${key}]: ${duration}ms`);
};

const { width } = Dimensions.get('window');

interface QualityAgentDashboardProps {
  navigation: any;
  user: User;
  onLogout: () => void;
}

export default function QualityAgentDashboard({ navigation, user, onLogout }: QualityAgentDashboardProps) {
  const [totalReviewed, setTotalReviewed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error' | 'info'>('info');
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  
  // App Update Check
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState<any>(null);
  const [assignmentExpiresAt, setAssignmentExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isGettingNextAssignment, setIsGettingNextAssignment] = useState(false);
  
  // Loading animation states (similar to Interviewer Dashboard)
  const [loadingAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [rotationAnimation] = useState(new Animated.Value(0));
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  
  // PERFORMANCE FIX: Request cancellation and debouncing
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRequestInFlightRef = useRef(false);
  const lastRequestTimeRef = useRef(0);

  useEffect(() => {
    const startTime = performance.now();
    loadDashboardData().then(() => {
      const duration = performance.now() - startTime;
      logPerformance('dashboard_load', duration);
    });
    
    // Check for app updates on mount (non-blocking, silent check)
    checkForAppUpdate();
    
    // Cleanup: Cancel any pending requests on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isRequestInFlightRef.current = false;
    };
  }, []);

  // PERFORMANCE FIX: Animation effects with proper cleanup
  useEffect(() => {
    if (!isLoading) {
      // If not loading, ensure all animations are stopped
      return;
    }
    
    // Start pulsing animation
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Start rotation animation
    const rotateAnim = Animated.loop(
      Animated.timing(rotationAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Start loading bar animation
    const loadingBarAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(loadingAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    // Rotate loading text
    const textRotateInterval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % 4);
    }, 2000);

    pulseAnim.start();
    rotateAnim.start();
    loadingBarAnim.start();

    // PERFORMANCE FIX: Always return cleanup function, even if component unmounts
    return () => {
      try {
        pulseAnim.stop();
        rotateAnim.stop();
        loadingBarAnim.stop();
        clearInterval(textRotateInterval);
      } catch (error) {
        // Ignore errors during cleanup (component may already be unmounted)
        console.log('Animation cleanup error (safe to ignore):', error);
      }
    };
  }, [isLoading, pulseAnimation, rotationAnimation, loadingAnimation]);

  // PERFORMANCE FIX: Timer with proper cleanup and ref to prevent stale closures
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Clear any existing timer first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (!assignmentExpiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(assignmentExpiresAt);
      const diff = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
      
      if (diff === 0) {
        setTimeRemaining(null);
        setAssignmentExpiresAt(null);
        if (currentAssignment) {
          showSnackbar('Your review assignment has expired. Please start a new quality check.');
          handleReleaseAssignment();
        }
        // Clear interval when expired
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      } else {
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [assignmentExpiresAt, currentAssignment]);

  const loadDashboardData = useCallback(async (showLoading: boolean = true) => {
    // OPTIMIZED: Allow silent refresh (don't show loading screen when refreshing after submission)
    if (showLoading) {
      setIsLoading(true);
    }
    const startTime = performance.now();
    try {
      // OPTIMIZED: Use lightweight stats endpoint - only get overview stats, skip expensive aggregations
      // Pass lightweight=true to get only totalReviewed count quickly
      const allTimeResponse = await apiService.getQualityAgentAnalytics({ timeRange: 'all', lightweight: 'true' });
      if (allTimeResponse.success && allTimeResponse.data?.overview) {
        setTotalReviewed(allTimeResponse.data.overview.totalReviewed || 0);
      } else {
        setTotalReviewed(0);
      }
      const duration = performance.now() - startTime;
      logPerformance('dashboard_data_load', duration);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (showLoading) {
        showSnackbar('Failed to load dashboard data');
      }
      setTotalReviewed(0);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const showSnackbar = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  };

  // Check for app updates
  const checkForAppUpdate = async (force: boolean = false) => {
    try {
      // Only check if online
      const netState = await NetInfo.fetch();
      if (!netState.isConnected || netState.isInternetReachable === false) {
        if (force) {
          showSnackbar('Please connect to the internet to check for updates', 'error');
        }
        console.log('📱 Skipping update check - offline');
        return;
      }

      // If forced check, clear throttling and show progress
      if (force) {
        await appUpdateService.clearSkippedVersion(); // Clear any skipped version
        showSnackbar('Checking for updates...', 'info');
      }

      // Silent check (don't show progress unless forced)
      const update = await appUpdateService.checkForUpdate(force);
      
      if (update) {
        console.log(`📦 Update available: Version ${update.latestVersion}`);
        setUpdateInfo(update);
        setUpdateModalVisible(true);
      } else if (force) {
        showSnackbar('App is up to date!', 'success');
      }
    } catch (error: any) {
      console.error('❌ Error checking for app update:', error);
      if (force) {
        showSnackbar('Failed to check for updates. Please try again later.', 'error');
      }
      // Silently fail - don't interrupt user experience
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      onLogout(); // Still logout locally
    }
  };

  // PERFORMANCE FIX: Debounced and cancellable request handler
  const handleStartQualityCheck = useCallback(async (interviewMode?: 'capi' | 'cati') => {
    // Track QC button click (lightweight - no overhead)
    if (interviewMode === 'capi') {
      analyticsService.track('Button Clicked', {
        button_name: 'Start CAPI QC',
        location: 'Quality Agent Dashboard',
      });
    } else if (interviewMode === 'cati') {
      analyticsService.track('Button Clicked', {
        button_name: 'Start CATI QC',
        location: 'Quality Agent Dashboard',
      });
    }
    
    // PERFORMANCE FIX: Debounce rapid clicks (300ms)
    const now = Date.now();
    if (now - lastRequestTimeRef.current < 300) {
      console.log('⚡ Request debounced - too soon after last request');
      return;
    }
    lastRequestTimeRef.current = now;
    
    // PERFORMANCE FIX: Cancel previous request if still in flight
    if (isRequestInFlightRef.current && abortControllerRef.current) {
      console.log('⚡ Cancelling previous request');
      abortControllerRef.current.abort();
    }
    
    // PERFORMANCE FIX: Prevent multiple simultaneous requests
    if (isRequestInFlightRef.current) {
      console.log('⚡ Request already in flight, ignoring');
      return;
    }
    
    try {
      setIsGettingNextAssignment(true);
      isRequestInFlightRef.current = true;
      
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // OPTIMIZED: Clear any previous assignment state first to ensure clean start
      setCurrentAssignment(null);
      setAssignmentExpiresAt(null);
      setSelectedInterview(null);
      
      // OPTIMIZED: Open modal immediately, fetch data in background
      // This matches the web behavior - modal opens instantly, data loads async
      setShowResponseDetails(true);
      
      const startTime = performance.now();
      
      // Start API call in background with interviewMode filter
      const params = interviewMode ? { interviewMode } : {};
      const resultPromise = apiService.getNextReviewAssignment(params);
      
      // Don't await - let it fetch in background while modal is visible
      resultPromise
        .then((result) => {
          // PERFORMANCE FIX: Check if request was aborted
          if (signal.aborted) {
            console.log('⚡ Request was aborted, ignoring result');
            return;
          }
          
          const duration = performance.now() - startTime;
          logPerformance('get_next_assignment', duration);
          
          setIsGettingNextAssignment(false);
          isRequestInFlightRef.current = false;
          
          if (!result.success) {
            setShowResponseDetails(false);
            setSelectedInterview(null);
            showSnackbar(result.message || 'Failed to get next assignment');
            return;
          }

          if (!result.data || !result.data.interview) {
            setShowResponseDetails(false);
            setSelectedInterview(null);
            const modeText = interviewMode === 'capi' ? 'CAPI' : interviewMode === 'cati' ? 'CATI' : '';
            showSnackbar(result.data?.message || `No ${modeText} responses available for review`);
            return;
          }

          // Set the assigned response
          console.log('🔍 QualityAgentDashboard - Interview data received:', {
            responseId: result.data.interview?.responseId,
            interviewMode: result.data.interview?.interviewMode,
            hasInterviewer: !!result.data.interview?.interviewer,
            interviewerId: result.data.interview?.interviewer?._id?.toString(),
            interviewerName: result.data.interview?.interviewer ? `${result.data.interview.interviewer.firstName} ${result.data.interview.interviewer.lastName}` : 'null',
            interviewerMemberId: result.data.interview?.interviewer?.memberId || 'null',
            interviewerData: result.data.interview?.interviewer
          });
          setCurrentAssignment(result.data.interview);
          setAssignmentExpiresAt(result.data.expiresAt ? new Date(result.data.expiresAt) : null);
          setSelectedInterview(result.data.interview);
          
          const modeText = interviewMode === 'capi' ? 'CAPI' : interviewMode === 'cati' ? 'CATI' : '';
          showSnackbar(`${modeText} response assigned. You have 30 minutes to complete the review.`);
        })
        .catch((error: any) => {
          // PERFORMANCE FIX: Ignore abort errors
          if (signal.aborted || error.name === 'AbortError' || error.message?.includes('aborted')) {
            console.log('⚡ Request was aborted (expected)');
            return;
          }
          
          console.error('Error getting next assignment:', error);
          setIsGettingNextAssignment(false);
          isRequestInFlightRef.current = false;
          setShowResponseDetails(false);
          setSelectedInterview(null);
          showSnackbar(error.response?.data?.message || 'Failed to get next assignment. Please try again.');
        });
      
    } catch (error: any) {
      console.error('Error getting next assignment:', error);
      setIsGettingNextAssignment(false);
      isRequestInFlightRef.current = false;
      setShowResponseDetails(false);
      setSelectedInterview(null);
      showSnackbar(error.response?.data?.message || 'Failed to get next assignment. Please try again.');
    }
  }, []);

  const handleReleaseAssignment = async () => {
    if (!currentAssignment || !currentAssignment.responseId) return;

    try {
      await apiService.releaseReviewAssignment(currentAssignment.responseId);
      setCurrentAssignment(null);
      setAssignmentExpiresAt(null);
      setSelectedInterview(null);
      setShowResponseDetails(false);
    } catch (error: any) {
      // Silently ignore 403/404 errors (assignment might already be expired/released)
      if (error.response?.status !== 403 && error.response?.status !== 404) {
        console.error('Error releasing assignment:', error);
      }
    }
  };

  const handleCloseModal = async () => {
    // Release assignment if one exists (user is closing without submitting)
    if (currentAssignment && currentAssignment.responseId) {
      try {
        await handleReleaseAssignment();
      } catch (error) {
        console.log('Assignment release skipped:', error);
      }
    }
    
    setShowResponseDetails(false);
    setSelectedInterview(null);
  };

  const handleVerificationSubmit = async (verificationData: any) => {
    try {
      const result = await apiService.submitVerification(verificationData);
      
      if (result.success) {
        // OPTIMIZED: Close modal and show success message FIRST, then refresh stats in background
        setCurrentAssignment(null);
        setAssignmentExpiresAt(null);
        setSelectedInterview(null);
        setShowResponseDetails(false);
        
        // Show success message immediately
        showSnackbar('Verification submitted successfully');
        
        // Refresh stats in background (non-blocking) - don't show loading screen
        loadDashboardData(false).catch((error) => {
          console.error('Error refreshing dashboard after submission:', error);
          // Silently fail - stats will refresh on next manual refresh
        });
      } else {
        showSnackbar(result.message || 'Failed to submit verification');
      }
    } catch (error: any) {
      console.error('Error submitting verification:', error);
      showSnackbar(error.response?.data?.message || 'Failed to submit verification');
    }
  };

  const handleSkipResponse = async () => {
    if (!currentAssignment || !currentAssignment.responseId) {
      showSnackbar('Unable to skip: No active assignment');
      return;
    }

    const skippedResponseId = currentAssignment.responseId;
    // Preserve the interview mode when skipping to get same type of response
    const currentMode = currentAssignment.interviewMode as 'capi' | 'cati' | undefined;

    try {
      // Skip the current assignment (releases it and returns to queue)
      const result = await apiService.skipReviewAssignment(skippedResponseId);
      
      if (result.success) {
        // Clear current assignment
        setCurrentAssignment(null);
        setAssignmentExpiresAt(null);
        setSelectedInterview(null);
        
        // Show success message
        showSnackbar('Response skipped. Getting next assignment...');
        
        // Wait a moment to ensure database update completes
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Automatically get the next assignment, excluding the skipped one, preserving mode
        await handleStartQualityCheckWithExclusion(skippedResponseId, currentMode);
      } else {
        showSnackbar(result.message || 'Failed to skip response');
      }
    } catch (error: any) {
      console.error('Error skipping response:', error);
      showSnackbar(error.response?.data?.message || 'Failed to skip response. Please try again.');
    }
  };

  // PERFORMANCE FIX: Same optimizations for exclusion handler
  const handleStartQualityCheckWithExclusion = useCallback(async (excludeResponseId?: string, interviewMode?: 'capi' | 'cati') => {
    // PERFORMANCE FIX: Cancel previous request if still in flight
    if (isRequestInFlightRef.current && abortControllerRef.current) {
      console.log('⚡ Cancelling previous request');
      abortControllerRef.current.abort();
    }
    
    // PERFORMANCE FIX: Prevent multiple simultaneous requests
    if (isRequestInFlightRef.current) {
      console.log('⚡ Request already in flight, ignoring');
      return;
    }
    
    try {
      setIsGettingNextAssignment(true);
      isRequestInFlightRef.current = true;
      
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // OPTIMIZED: Clear any previous assignment state first to ensure clean start
      setCurrentAssignment(null);
      setAssignmentExpiresAt(null);
      setSelectedInterview(null);
      
      // OPTIMIZED: Open modal immediately, fetch data in background
      // This matches the web behavior - modal opens instantly, data loads async
      setShowResponseDetails(true);
      
      const startTime = performance.now();
      
      // Start API call in background with exclusion parameter and interviewMode
      const params: any = {};
      if (excludeResponseId) params.excludeResponseId = excludeResponseId;
      if (interviewMode) params.interviewMode = interviewMode;
      const resultPromise = apiService.getNextReviewAssignment(params);
      
      // Don't await - let it fetch in background while modal is visible
      resultPromise
        .then((result) => {
          // PERFORMANCE FIX: Check if request was aborted
          if (signal.aborted) {
            console.log('⚡ Request was aborted, ignoring result');
            return;
          }
          
          const duration = performance.now() - startTime;
          logPerformance('get_next_assignment_exclusion', duration);
          
          setIsGettingNextAssignment(false);
          isRequestInFlightRef.current = false;
          
          if (!result.success) {
            setShowResponseDetails(false);
            setSelectedInterview(null);
            showSnackbar(result.message || 'Failed to get next assignment');
            return;
          }

          if (!result.data || !result.data.interview) {
            setShowResponseDetails(false);
            setSelectedInterview(null);
            showSnackbar(result.data?.message || 'No responses available for review');
            return;
          }

          // Check if we got the same response we just skipped (shouldn't happen, but safety check)
          if (excludeResponseId && result.data.interview?.responseId === excludeResponseId) {
            console.warn('⚠️ Got the same response we just skipped, trying again...');
            // Wait a bit longer and try again
            setTimeout(async () => {
              if (signal.aborted) return; // Don't retry if aborted
              const retryResult = await apiService.getNextReviewAssignment({ excludeResponseId });
              if (retryResult.success && retryResult.data?.interview && 
                  retryResult.data.interview.responseId !== excludeResponseId) {
                setCurrentAssignment(retryResult.data.interview);
                setAssignmentExpiresAt(retryResult.data.expiresAt ? new Date(retryResult.data.expiresAt) : null);
                setSelectedInterview(retryResult.data.interview);
                showSnackbar('Response assigned. You have 30 minutes to complete the review.');
              } else {
                setShowResponseDetails(false);
                setSelectedInterview(null);
                showSnackbar('No other responses available. The skipped response may be the only one in queue.');
              }
            }, 1000);
            return;
          }

          // Set the assigned response
          console.log('🔍 QualityAgentDashboard - Interview data received:', {
            responseId: result.data.interview?.responseId,
            hasInterviewer: !!result.data.interview?.interviewer,
            interviewerId: result.data.interview?.interviewer?._id?.toString(),
            interviewerName: result.data.interview?.interviewer ? `${result.data.interview.interviewer.firstName} ${result.data.interview.interviewer.lastName}` : 'null',
            interviewerMemberId: result.data.interview?.interviewer?.memberId || 'null',
            interviewerData: result.data.interview?.interviewer
          });
          setCurrentAssignment(result.data.interview);
          setAssignmentExpiresAt(result.data.expiresAt ? new Date(result.data.expiresAt) : null);
          setSelectedInterview(result.data.interview);
          
          showSnackbar('Response assigned. You have 30 minutes to complete the review.');
        })
        .catch((error: any) => {
          // PERFORMANCE FIX: Ignore abort errors
          if (signal.aborted || error.name === 'AbortError' || error.message?.includes('aborted')) {
            console.log('⚡ Request was aborted (expected)');
            return;
          }
          
          console.error('Error getting next assignment:', error);
          setIsGettingNextAssignment(false);
          isRequestInFlightRef.current = false;
          setShowResponseDetails(false);
          setSelectedInterview(null);
          showSnackbar(error.response?.data?.message || 'Failed to get next assignment. Please try again.');
        });
      
    } catch (error: any) {
      console.error('Error getting next assignment:', error);
      setIsGettingNextAssignment(false);
      isRequestInFlightRef.current = false;
      setShowResponseDetails(false);
      setSelectedInterview(null);
      showSnackbar(error.response?.data?.message || 'Failed to get next assignment. Please try again.');
    }
  }, []);


  if (isLoading) {
    const loadingTexts = [
      'Loading your dashboard...',
      'Fetching statistics...',
      'Preparing interface...',
      'Almost ready...',
    ];

    const rotateInterpolate = rotationAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const pulseScale = pulseAnimation;

    const loadingBarWidth = loadingAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="dark" />
        <View style={styles.loadingContent}>
          {/* Animated Logo/Icon */}
          <Animated.View
            style={[
              styles.loadingLogoContainer,
              {
                transform: [
                  { scale: pulseScale },
                ],
              },
            ]}
          >
            <View style={styles.loadingLogoCircle}>
              <Animated.View
                style={[
                  styles.loadingLogoInner,
                  {
                    transform: [{ rotate: rotateInterpolate }],
                  },
                ]}
              >
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.loadingLogoIcon}
                  resizeMode="cover"
                />
              </Animated.View>
            </View>
          </Animated.View>

          {/* Loading Text */}
          <Text style={styles.loadingTitleText}>
            {loadingTexts[loadingTextIndex]}
          </Text>

          {/* Animated Dots */}
          <View style={styles.loadingDotsContainer}>
            {[0, 1, 2].map((index) => {
              const dotOpacity = pulseAnimation.interpolate({
                inputRange: [1, 1.2],
                outputRange: [0.3, 0.9],
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.loadingDot,
                    {
                      opacity: dotOpacity,
                      marginHorizontal: 4,
                      transform: [
                        {
                          scale: pulseAnimation.interpolate({
                            inputRange: [1, 1.2],
                            outputRange: [1, 1.2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Loading Progress Bar */}
          <View style={styles.loadingProgressContainer}>
            <View style={styles.loadingProgressTrack}>
              <Animated.View
                style={[
                  styles.loadingProgressBar,
                  {
                    width: loadingBarWidth,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#001D48', '#373177', '#3FADCC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.avatarLogo}
              resizeMode="cover"
            />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
              <Text style={styles.userRole}>Quality Agent</Text>
            </View>
          </View>
          <Button
            mode="outlined"
            onPress={handleLogout}
            style={styles.logoutButton}
            textColor="#ffffff"
            compact
          >
            Logout
          </Button>
        </View>
        
        {/* Check for App Updates Button */}
        <View style={styles.updateButtonContainer}>
          <Button
            mode="contained"
            onPress={() => checkForAppUpdate(true)}
            icon="cloud-download-outline"
            buttonColor="#2563eb"
            textColor="#ffffff"
            style={styles.updateButton}
          >
            Check for App Updates
          </Button>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#001D48']}
            tintColor="#001D48"
          />
        }
      >
        {/* Stats Card */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCardLarge}>
            <Card.Content style={styles.statContentLarge}>
              <Text style={styles.statNumberLarge}>{totalReviewed}</Text>
              <Text style={styles.statLabelLarge}>Total Reviewed</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Start Quality Check Section */}
        <View style={styles.section}>
          <Card style={styles.actionCard} elevation={2}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Quality Review</Text>
              <Text style={styles.sectionDescription}>
                Choose the type of interview you want to review. You'll have 30 minutes to complete each review.
              </Text>
              
              {currentAssignment && timeRemaining && (
                <View style={styles.timerContainer}>
                  <Text style={styles.timerLabel}>Time Remaining:</Text>
                  <Text style={styles.timerValue}>{timeRemaining}</Text>
                </View>
              )}

              {currentAssignment ? (
                // Show continue/release buttons when assignment is active
                <>
                  <Button
                    mode="contained"
                    onPress={() => setShowResponseDetails(true)}
                    style={styles.continueButton}
                    icon="play-circle"
                  >
                    Continue Review
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={async () => {
                      Alert.alert(
                        'Release Assignment',
                        'Are you sure you want to release this assignment?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Release',
                            style: 'destructive',
                            onPress: async () => {
                              await handleReleaseAssignment();
                              showSnackbar('Assignment released');
                            }
                          }
                        ]
                      );
                    }}
                    style={styles.releaseButton}
                    icon="close-circle"
                  >
                    Release Assignment
                  </Button>
                </>
              ) : (
                // Show CAPI/CATI buttons when no assignment
                <View style={styles.buttonColumn}>
                  <View style={styles.buttonContainer}>
                    <Button
                      mode="contained"
                      onPress={() => handleStartQualityCheck('capi')}
                      style={[styles.modeButton, styles.capiButton]}
                      contentStyle={styles.modeButtonContent}
                      labelStyle={styles.modeButtonLabel}
                      loading={isGettingNextAssignment}
                      disabled={isGettingNextAssignment}
                      icon="microphone"
                    >
                      Start CAPI QC
                    </Button>
                    <Text style={styles.modeButtonSubtext}>Computer-Assisted Personal Interview</Text>
                  </View>
                  
                  <View style={[styles.buttonContainer, { marginTop: 12 }]}>
                    <Button
                      mode="contained"
                      onPress={() => handleStartQualityCheck('cati')}
                      style={[styles.modeButton, styles.catiButton]}
                      contentStyle={styles.modeButtonContent}
                      labelStyle={styles.modeButtonLabel}
                      loading={isGettingNextAssignment}
                      disabled={isGettingNextAssignment}
                      icon="phone"
                    >
                      Start CATI QC
                    </Button>
                    <Text style={styles.modeButtonSubtext}>Computer-Assisted Telephone Interview</Text>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      {/* Response Details Modal */}
      {/* OPTIMIZED: Show modal immediately, even if interview data is still loading */}
      {showResponseDetails && (
        <ResponseDetailsModal
          visible={showResponseDetails}
          interview={selectedInterview || null} // Can be null while loading
          onClose={handleCloseModal}
          onSubmit={handleVerificationSubmit}
          onSkip={handleSkipResponse}
          assignmentExpiresAt={assignmentExpiresAt}
        />
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        style={[
          styles.snackbar,
          snackbarType === 'success' && styles.snackbarSuccess,
          snackbarType === 'error' && styles.snackbarError,
          snackbarType === 'info' && styles.snackbarInfo,
        ]}
      >
        {snackbarMessage}
      </Snackbar>

      {/* App Update Modal */}
      <AppUpdateModal
        visible={updateModalVisible}
        updateInfo={updateInfo}
        onClose={() => setUpdateModalVisible(false)}
        onSkip={() => {
          if (updateInfo) {
            appUpdateService.skipVersion(updateInfo.latestVersionCode);
          }
          setUpdateModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 400,
    flex: 1,
  },
  loadingLogoContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  loadingLogoInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  loadingLogoIcon: {
    width: '100%',
    height: '100%',
  },
  loadingTitleText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#001D48',
  },
  loadingProgressContainer: {
    width: '100%',
    maxWidth: 200,
    alignItems: 'center',
  },
  loadingProgressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 1,
    overflow: 'hidden',
  },
  loadingProgressBar: {
    height: '100%',
    backgroundColor: '#001D48',
    borderRadius: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  logoutButton: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statCardLarge: {
    elevation: 4,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  statContentLarge: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  statNumberLarge: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#001D48',
    marginBottom: 8,
  },
  statLabelLarge: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  actionCard: {
    elevation: 4,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  buttonColumn: {
    flexDirection: 'column',
    marginTop: 8,
  },
  buttonContainer: {
    width: '100%',
  },
  modeButton: {
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modeButtonContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    minHeight: 64,
  },
  modeButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modeButtonSubtext: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 14,
  },
  capiButton: {
    backgroundColor: '#2563eb',
  },
  catiButton: {
    backgroundColor: '#059669',
  },
  continueButton: {
    backgroundColor: '#001D48',
    borderRadius: 12,
    marginTop: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  timerContainer: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#92400e',
  },
  startButton: {
    marginTop: 8,
    backgroundColor: '#001D48',
  },
  releaseButton: {
    marginTop: 12,
    borderColor: '#dc2626',
  },
  snackbar: {
    backgroundColor: '#1f2937',
  },
  snackbarSuccess: {
    backgroundColor: '#059669',
  },
  snackbarError: {
    backgroundColor: '#dc2626',
  },
  snackbarInfo: {
    backgroundColor: '#2563eb',
  },
  updateButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  updateButton: {
    borderRadius: 8,
  },
});

