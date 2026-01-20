import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorage } from './offlineStorage';
// Note: offlineDataCache is imported dynamically in each method to avoid circular dependency

const API_BASE_URL = 'https://convo.convergentview.com';

// Network condition types for emulation
export type NetworkCondition = 
  | 'good_stable'      // Good Stable Internet (no throttling)
  | 'below_average'    // Below Average internet Speed
  | 'slow_unstable'    // Slow & Unstable internet (keeps disconnecting)
  | 'very_slow';       // Very Slow internet

class ApiService {
  private baseURL: string;
  private offlineDataCacheModule: any = null;
  private forceOfflineMode: boolean = false; // Toggle for testing offline mode
  private networkCondition: NetworkCondition = 'good_stable'; // Network condition emulation
  private requestInterceptorId: number | null = null;
  private responseInterceptorId: number | null = null;
  private interceptorsSetup: boolean = false;
  
  // PHASE 2: Request deduplication - prevent duplicate concurrent requests
  private pendingRequests: Map<string, Promise<any>> = new Map();
  
  // PHASE 2: Local cache for responses (with 410 invalidation)
  private responseCache: Map<string, { data: any; timestamp: number; isGone: boolean }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly GONE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for 410 (Gone) responses

  // PERFORMANCE: Pre-load performanceCache module to avoid blocking dynamic imports
  private performanceCacheInstance: any = null;
  private performanceCacheLoadPromise: Promise<any> | null = null;

  constructor() {
    this.baseURL = API_BASE_URL;
    // Don't setup interceptors in constructor - wait until network condition is set
    // PERFORMANCE: Pre-load performanceCache module in background (non-blocking)
    this.preloadPerformanceCache();
  }

  // PERFORMANCE: Pre-load performanceCache module to avoid blocking on first use
  private async preloadPerformanceCache(): Promise<any> {
    if (this.performanceCacheLoadPromise) {
      return this.performanceCacheLoadPromise;
    }
    this.performanceCacheLoadPromise = import('./performanceCache')
      .then((module) => {
        this.performanceCacheInstance = module.performanceCache; // Named export
        return module.performanceCache;
      })
      .catch((error) => {
        console.warn('⚠️ Failed to pre-load performanceCache:', error);
        return null;
      });
    return this.performanceCacheLoadPromise;
  }

  // PERFORMANCE: Get performanceCache instance (uses pre-loaded instance if available)
  private async getPerformanceCache(): Promise<any> {
    if (this.performanceCacheInstance) {
      return this.performanceCacheInstance;
    }
    // Fallback to dynamic import if pre-load didn't complete yet
    const module = await this.preloadPerformanceCache();
    return module;
  }

  // Toggle offline mode for testing
  setForceOfflineMode(enabled: boolean) {
    this.forceOfflineMode = enabled;
    console.log(`🔧 Force offline mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  isForceOfflineMode(): boolean {
    return this.forceOfflineMode;
  }

  // Set network condition for emulation
  setNetworkCondition(condition: NetworkCondition) {
    this.networkCondition = condition;
    console.log(`🌐 Network condition set to: ${condition}`);
    // Re-setup interceptors with new condition
    this.setupNetworkInterceptors();
  }

  getNetworkCondition(): NetworkCondition {
    return this.networkCondition;
  }

  // Setup axios interceptors to simulate network conditions
  private setupNetworkInterceptors() {
    // Remove existing interceptors if any
    if (this.requestInterceptorId !== null) {
      axios.interceptors.request.eject(this.requestInterceptorId);
      this.requestInterceptorId = null;
    }
    if (this.responseInterceptorId !== null) {
      axios.interceptors.response.eject(this.responseInterceptorId);
      this.responseInterceptorId = null;
    }

    // Only add interceptors if not using good_stable (no throttling needed)
    if (this.networkCondition === 'good_stable') {
      this.interceptorsSetup = false;
      return;
    }

    // Request interceptor - add delay before request
    this.requestInterceptorId = axios.interceptors.request.use(
      async (config) => {
        // Add delay based on network condition
        const delay = this.getRequestDelay();
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // For unstable connections, randomly fail requests
        if (this.networkCondition === 'slow_unstable') {
          const shouldFail = Math.random() < 0.15; // 15% chance of failure
          if (shouldFail) {
            const cancelError: any = new Error('Network connection unstable - request cancelled');
            cancelError.code = 'ECONNABORTED';
            cancelError.isCancel = true;
            return Promise.reject(cancelError);
          }
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - add delay and simulate slow transfer
    this.responseInterceptorId = axios.interceptors.response.use(
      async (response) => {
        // Add delay to simulate slow data transfer
        const delay = this.getResponseDelay(response);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // For unstable connections, randomly fail responses
        if (this.networkCondition === 'slow_unstable') {
          const shouldFail = Math.random() < 0.1; // 10% chance of failure after response
          if (shouldFail) {
            const cancelError: any = new Error('Network connection lost during transfer');
            cancelError.code = 'ECONNABORTED';
            cancelError.isCancel = true;
            return Promise.reject(cancelError);
          }
        }

        return response;
      },
      async (error) => {
        // For unstable connections, add delay before rejecting
        if (this.networkCondition === 'slow_unstable' && !error.config?.__retryCount) {
          const delay = this.getRequestDelay();
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        return Promise.reject(error);
      }
    );

    this.interceptorsSetup = true;
  }

  // Get delay for request based on network condition
  private getRequestDelay(): number {
    switch (this.networkCondition) {
      case 'very_slow':
        return 2000 + Math.random() * 3000; // 2-5 seconds
      case 'slow_unstable':
        return 1000 + Math.random() * 2000; // 1-3 seconds
      case 'below_average':
        return 500 + Math.random() * 1000; // 0.5-1.5 seconds
      case 'good_stable':
      default:
        return 0;
    }
  }

  // Get delay for response based on network condition and response size
  private getResponseDelay(response: any): number {
    // Estimate response size (rough calculation)
    const responseSize = JSON.stringify(response.data || {}).length;
    const sizeInKB = responseSize / 1024;

    let baseDelay = 0;
    let sizeMultiplier = 1;

    switch (this.networkCondition) {
      case 'very_slow':
        baseDelay = 1000; // 1 second base
        sizeMultiplier = 50; // 50ms per KB
        break;
      case 'slow_unstable':
        baseDelay = 500; // 0.5 second base
        sizeMultiplier = 30; // 30ms per KB
        break;
      case 'below_average':
        baseDelay = 200; // 0.2 second base
        sizeMultiplier = 10; // 10ms per KB
        break;
      case 'good_stable':
      default:
        return 0;
    }

    return baseDelay + (sizeInKB * sizeMultiplier);
  }

  // Helper to safely get offline cache (lazy load with error handling)
  private async getOfflineCache() {
    if (this.offlineDataCacheModule) {
      return this.offlineDataCacheModule;
    }
    try {
      const module = await import('./offlineDataCache');
      this.offlineDataCacheModule = module.offlineDataCache;
      return this.offlineDataCacheModule;
    } catch (error) {
      console.log('⚠️ Offline cache not available:', error);
      return null;
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async getHeaders(): Promise<any> {
    const token = await this.getAuthToken();
    console.log('🔍 API Service - Auth token exists:', !!token);
    console.log('🔍 API Service - Token preview:', token ? token.substring(0, 20) + '...' : 'No token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Normalize AC name to match master data spelling
   * This handles common spelling mismatches between survey data and polling station master data
   */
  normalizeACName(acName: string): string {
    if (!acName || typeof acName !== 'string') return acName;
    
    // Common AC name mappings based on master data spelling (from polling_stations.json)
    // Master data uses: "COOCHBEHAR DAKSHIN" (all caps, no space in "COOCHBEHAR")
    const acNameMappings: Record<string, string> = {
      // Cooch Behar variations -> COOCHBEHAR (no space, all caps)
      'Cooch Behar Uttar': 'COOCHBEHAR UTTAR (SC)',
      'Cooch Behar Dakshin': 'COOCHBEHAR DAKSHIN',
      'Coochbehar Uttar': 'COOCHBEHAR UTTAR (SC)',
      'Coochbehar Dakshin': 'COOCHBEHAR DAKSHIN',
      'COOCH BEHAR UTTAR': 'COOCHBEHAR UTTAR (SC)',
      'COOCH BEHAR DAKSHIN': 'COOCHBEHAR DAKSHIN',
      'cooch behar uttar': 'COOCHBEHAR UTTAR (SC)',
      'cooch behar dakshin': 'COOCHBEHAR DAKSHIN',
      // Add more mappings as needed
    };
    
    // Check exact match first
    if (acNameMappings[acName]) {
      return acNameMappings[acName];
    }
    
    // Try case-insensitive match
    const normalized = acName.trim();
    for (const [key, value] of Object.entries(acNameMappings)) {
      if (key.toLowerCase() === normalized.toLowerCase()) {
        return value;
      }
    }
    
    // If no mapping found, return original
    return acName;
  }

  /**
   * Check if device is online
   */
  async isOnline(): Promise<boolean> {
    // If force offline mode is enabled, always return false
    if (this.forceOfflineMode) {
      return false;
    }
    
    // PERFORMANCE: Check cached online status first (avoid repeated network checks)
    try {
      const { performanceCache } = await import('./performanceCache');
      const cachedStatus = performanceCache.getOnlineStatus();
      if (cachedStatus !== null) {
        return cachedStatus;
      }
    } catch (cacheError) {
      // Cache not available, continue with network check
    }
    
    try {
      // Use a shorter timeout for faster response
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        mode: 'no-cors',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Cache the result
      try {
        const { performanceCache } = await import('./performanceCache');
        performanceCache.setOnlineStatus(true);
      } catch (cacheError) {
        // Ignore cache errors
      }
      
      return true;
    } catch (error) {
      // Cache the result
      try {
        const { performanceCache } = await import('./performanceCache');
        performanceCache.setOnlineStatus(false);
      } catch (cacheError) {
        // Ignore cache errors
      }
      return false;
    }
  }

  /**
   * Check if request should fail due to offline mode
   * Returns true if offline and operation requires internet
   */
  private async checkOfflineMode(requiresInternet: boolean = true): Promise<{ isOffline: boolean; error?: string }> {
    const isOnline = await this.isOnline();
    if (!isOnline && requiresInternet) {
      return {
        isOffline: true,
        error: 'No internet connection. Please connect to the internet and try again.',
      };
    }
    return { isOffline: false };
  }

  // Authentication
  async login(identifier: string, password: string) {
    try {
      console.log('🔐 Attempting login for:', identifier);
      const response = await axios.post(`${this.baseURL}/api/auth/login`, {
        email: identifier, // Backend expects 'email' but accepts email or memberId
        password,
      });

      console.log('Login response status:', response.status);
      console.log('Login response data:', response.data);

      if (response.data && response.data.success) {
        const { token, user } = response.data.data || {};
        
        // Validate token and user data before storing
        if (!token || !user) {
          console.error('❌ Invalid response: missing token or user data');
          return { success: false, message: 'Invalid response from server' };
        }
        
        console.log('✅ Login successful, storing credentials');
        // Store token and user data
        await AsyncStorage.setItem('authToken', token);
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        
        return { success: true, token, user };
      } else {
        const errorMessage = response.data?.message || 'Login failed';
        console.error('❌ Login failed:', errorMessage);
        return { success: false, message: errorMessage };
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error message:', error.message);
      
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please try again.';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async verifyToken() {
    try {
      const headers = await this.getHeaders();
      // Use the /api/auth/me endpoint which should exist
      const response = await axios.get(`${this.baseURL}/api/auth/me`, { 
        headers,
        timeout: 10000 // 10 second timeout
      });
      return { success: true, user: response.data.user };
    } catch (error: any) {
      console.error('Token verification error:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      const headers = await this.getHeaders();
      await axios.post(`${this.baseURL}/api/auth/logout`, {}, { headers });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      try {
        await AsyncStorage.multiRemove(['authToken', 'userData']);
      } catch (storageError) {
        console.error('Error clearing storage:', storageError);
      }
    }
  }

  // Surveys
  async getAvailableSurveys(filters?: { mode?: string; search?: string }) {
    try {
      const headers = await this.getHeaders();
      let url = `${this.baseURL}/api/surveys/available`;
      
      // Add query parameters if filters are provided
      if (filters) {
        const params = new URLSearchParams();
        if (filters.mode && filters.mode !== 'all') {
          params.append('mode', filters.mode);
        }
        if (filters.search) {
          params.append('search', filters.search);
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
      }
      
      const response = await axios.get(url, { headers });
      
      if (response.data.success) {
        return { 
          success: true, 
          surveys: response.data.data?.surveys || response.data.surveys || [] 
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to fetch surveys',
        };
      }
    } catch (error: any) {
      console.error('Get available surveys error:', error);
      console.error('Error response:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch surveys',
      };
    }
  }

  async getSurveyById(surveyId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/surveys/${surveyId}`, { headers });
      return { success: true, survey: response.data.survey };
    } catch (error: any) {
      console.error('Get survey error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch survey',
      };
    }
  }

  // Get full survey data (with sections and questions) - optimized endpoint
  async getSurveyFull(surveyId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/surveys/${surveyId}/full`, { headers });
      if (response.data.success) {
        return { success: true, survey: response.data.data?.survey || response.data.survey };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to fetch survey',
        };
      }
    } catch (error: any) {
      console.error('Get survey full error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch survey',
      };
    }
  }

  /**
   * PERFORMANCE OPTIMIZED: Fast assignment checking using cached data and Map lookups
   * Replaces O(n*m) array.find() loops with O(1) Map lookups
   */
  private async checkAssignmentOptimized(
    survey: any,
    currentUserId: string | null
  ): Promise<{ foundAssignment: boolean; requiresACSelection: boolean; assignedACs: string[] }> {
    const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
    
    // PERFORMANCE: Check cache first (O(1) lookup - instant)
    if (currentUserId) {
      try {
        // PERFORMANCE: Use pre-loaded cache instance for faster access
        const performanceCache = await this.getPerformanceCache();
        if (performanceCache) {
          const cachedAssignment = performanceCache.getAssignment(survey._id || survey.id, currentUserId);
          if (cachedAssignment) {
            console.log('⚡ Assignment loaded from memory cache (instant)');
            return {
              foundAssignment: cachedAssignment.foundAssignment,
              requiresACSelection: cachedAssignment.requiresACSelection,
              assignedACs: cachedAssignment.assignedACs,
            };
          }
        }
      } catch (cacheError) {
        // Cache not available, continue with normal check
      }
    }
    
    // Cache miss - perform assignment check
    let foundAssignment = false;
    let requiresACSelection = false;
    let assignedACs: string[] = [];
    
    // PERFORMANCE: Build Map for O(1) lookup instead of O(n) array.find()
    // Pre-process assignments into Map<userId, assignment> for instant lookup
    const assignmentMap = new Map<string, any>();
    
    // Process assignedInterviewers
    if (survey.assignedInterviewers && Array.isArray(survey.assignedInterviewers)) {
      for (const assignment of survey.assignedInterviewers) {
        if (!assignment || !assignment.interviewer) continue;
        if (assignment.status !== 'assigned' && assignment.status !== 'accepted') continue;
        
        // Extract userId from assignment
        let userId: string | null = null;
        if (assignment.interviewer._id) {
          userId = assignment.interviewer._id.toString();
        } else if (assignment.interviewer.toString) {
          userId = assignment.interviewer.toString();
        } else {
          userId = String(assignment.interviewer);
        }
        
        if (userId) {
          assignmentMap.set(userId, { ...assignment, type: 'assignedInterviewers' });
        }
        
        // Also check interviewerId field
        if (assignment.interviewerId) {
          const idStr = assignment.interviewerId.toString();
          if (!assignmentMap.has(idStr)) {
            assignmentMap.set(idStr, { ...assignment, type: 'assignedInterviewers' });
          }
        }
      }
    }
    
    // Process capiInterviewers
    if (survey.capiInterviewers && Array.isArray(survey.capiInterviewers)) {
      for (const assignment of survey.capiInterviewers) {
        if (!assignment || !assignment.interviewer) continue;
        if (assignment.status !== 'assigned' && assignment.status !== 'accepted') continue;
        
        // Extract userId from assignment
        let userId: string | null = null;
        if (assignment.interviewer._id) {
          userId = assignment.interviewer._id.toString();
        } else if (assignment.interviewer.toString) {
          userId = assignment.interviewer.toString();
        } else {
          userId = String(assignment.interviewer);
        }
        
        if (userId) {
          assignmentMap.set(userId, { ...assignment, type: 'capiInterviewers' });
        }
        
        // Also check interviewerId field
        if (assignment.interviewerId) {
          const idStr = assignment.interviewerId.toString();
          if (!assignmentMap.has(idStr)) {
            assignmentMap.set(idStr, { ...assignment, type: 'capiInterviewers' });
          }
        }
      }
    }
    
    // PERFORMANCE: O(1) lookup instead of O(n) find
    if (currentUserId && assignmentMap.has(currentUserId)) {
      const assignment = assignmentMap.get(currentUserId)!;
      foundAssignment = true;
      
      if (assignment.assignedACs && assignment.assignedACs.length > 0) {
        requiresACSelection = survey.assignACs === true;
        assignedACs = assignment.assignedACs || [];
      } else if (isTargetSurvey) {
        requiresACSelection = survey.assignACs === true;
        assignedACs = [];
      }
    } else if (!currentUserId && assignmentMap.size > 0) {
      // No user ID but assignments exist - use first assignment
      const firstAssignment = assignmentMap.values().next().value;
      foundAssignment = true;
      
      if (firstAssignment.assignedACs && firstAssignment.assignedACs.length > 0) {
        requiresACSelection = survey.assignACs === true;
        assignedACs = firstAssignment.assignedACs || [];
      } else if (isTargetSurvey) {
        requiresACSelection = survey.assignACs === true;
        assignedACs = [];
      }
    }
    
    // For target survey, allow even without explicit assignment (backward compatibility)
    if (isTargetSurvey) {
      if (survey.assignACs === true) {
        foundAssignment = true;
        requiresACSelection = true;
        if (assignedACs.length === 0) {
          assignedACs = [];
        }
      } else if (survey.assignACs === undefined) {
        console.warn('⚠️ CRITICAL: assignACs is undefined for target survey - this should not happen');
        console.warn('⚠️ Survey data may be incomplete - recommend re-syncing surveys');
        foundAssignment = true;
        requiresACSelection = true;
        assignedACs = [];
      }
    }
    
    // Cache the result for next time
    if (currentUserId && survey._id) {
      try {
        const performanceCache = await this.getPerformanceCache();
        if (performanceCache) {
          performanceCache.setAssignment(survey._id || survey.id, currentUserId, {
            foundAssignment,
            requiresACSelection,
            assignedACs,
            surveyId: survey._id || survey.id,
            userId: currentUserId,
          });
        }
      } catch (cacheError) {
        // Ignore cache errors
      }
    }
    
    return { foundAssignment, requiresACSelection, assignedACs };
  }

  // Survey Responses - Start interview session
  // CRITICAL: For CAPI, ALWAYS check assignment from synced survey data FIRST (offline-first approach)
  // Only make API call if online AND assignment found in synced data (for sync purposes)
  // If API call fails (403 or network error), fallback to offline mode
  // This ensures CAPI works completely offline without any API calls
  // PERFORMANCE OPTIMIZED: Uses in-memory cache, optimized assignment checking, batched AsyncStorage reads
  async startInterview(surveyId: string) {
    try {
      // STEP 1: Get survey from offline storage and check assignment FIRST (offline-first)
      console.log('📴 CAPI: Checking assignment from synced survey data FIRST (offline-first approach)');
      
      // PERFORMANCE: Check cache first (synchronous - instant if cached)
      // Use pre-loaded cache instance for faster access
      let survey: any = null;
      try {
        const performanceCache = await this.getPerformanceCache();
        if (performanceCache) {
          survey = performanceCache.getSurvey(surveyId);
        }
      } catch (cacheError) {
        // Cache module not available, continue with storage
      }
      
      if (!survey) {
        // Cache miss - load from storage (fast - usually <100ms)
        const surveys = await offlineStorage.getSurveys();
        survey = surveys.find((s: any) => s._id === surveyId || s.id === surveyId);
      }
      
      if (!survey) {
        console.log('⚠️ Survey not found in offline storage - will try API call (edge case)');
        const isOnline = await this.isOnline();
        if (!isOnline) {
          return {
            success: false,
            message: 'Survey not synced and device is offline. Please sync surveys first.'
          };
        }
        const headers = await this.getHeaders();
        // PERFORMANCE: Reduced timeout from 10s to 5s for faster failure detection
        const response = await axios.post(
          `${this.baseURL}/api/survey-responses/start/${surveyId}`,
          {},
          { headers, timeout: 5000 }
        );
        return { success: true, response: response.data.data };
      }
      
      // CRITICAL: Validate survey data integrity (like META/Google)
      // Ensure critical fields are present before allowing interview start
      const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
      const missingFields: string[] = [];
      
      // For target survey, assignACs is CRITICAL - must be present
      if (isTargetSurvey && survey.assignACs === undefined) {
        missingFields.push('assignACs');
      }
      
      // Check for other critical fields
      if (!survey._id && !survey.id) {
        missingFields.push('_id or id');
      }
      if (!survey.surveyName && !survey.name) {
        missingFields.push('surveyName or name');
      }
      
      if (missingFields.length > 0) {
        console.error('❌ Survey data integrity check FAILED - missing critical fields:', missingFields);
        console.error('❌ Survey data:', JSON.stringify(survey, null, 2));
        
        // PERFORMANCE: Check online status (uses cache)
        const isOnline = await this.isOnline();
        if (isOnline) {
          // Try to re-sync survey data from server
          console.log('🔄 Attempting to re-sync survey data from server...');
          try {
            const fullSurveyResult = await this.getSurveyFull(surveyId);
            if (fullSurveyResult.success && fullSurveyResult.survey) {
              // Update survey in offline storage
              const allSurveys = await offlineStorage.getSurveys();
              const updatedSurveys = allSurveys.map((s: any) => 
                (s._id === surveyId || s.id === surveyId) ? fullSurveyResult.survey : s
              );
              await offlineStorage.saveSurveys(updatedSurveys, false);
              console.log('✅ Survey data re-synced successfully');
              // Use updated survey
              const updatedSurvey = updatedSurveys.find((s: any) => s._id === surveyId || s.id === surveyId);
              if (updatedSurvey) {
                Object.assign(survey, updatedSurvey);
              }
            }
          } catch (syncError) {
            console.error('❌ Failed to re-sync survey:', syncError);
          }
        }
        
        // If still missing after re-sync attempt, fail
        if (isTargetSurvey && survey.assignACs === undefined) {
          return {
            success: false,
            message: 'Survey data is incomplete. Please sync surveys from dashboard first. Missing: assignACs field.'
          };
        }
      }
      
      console.log('✅ Survey data integrity check passed');
      
      // STEP 2: Check assignment from synced survey data (offline-first)
      console.log('✅ Survey found in offline storage - checking assignment locally');
      
      // PERFORMANCE: Get user ID from cache first (synchronous - instant)
      let currentUserId: string | null = null;
      try {
        const performanceCache = await this.getPerformanceCache();
        if (performanceCache) {
          const cachedUserData = performanceCache.getUserData();
          if (cachedUserData) {
            currentUserId = cachedUserData._id || cachedUserData.id || cachedUserData.memberId || null;
            console.log('⚡ User ID loaded from memory cache (instant)');
          } else {
            // PERFORMANCE: Read from AsyncStorage (fast - usually <50ms)
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
              const userData = JSON.parse(userDataStr);
              currentUserId = userData._id || userData.id || userData.memberId || null;
              
              // Cache for next time
              performanceCache.setUserData(userData);
            }
          }
        } else {
          // Performance cache not available - read directly from AsyncStorage
          const userDataStr = await AsyncStorage.getItem('userData');
          if (userDataStr) {
            const userData = JSON.parse(userDataStr);
            currentUserId = userData._id || userData.id || userData.memberId || null;
          }
        }
      } catch (error) {
        console.error('❌ Error getting current user ID:', error);
      }
      
      // PERFORMANCE OPTIMIZED: Use optimized assignment checking (O(1) Map lookup - instant)
      // This is fast because it uses in-memory cache and Map lookups
      const { foundAssignment, requiresACSelection, assignedACs } = await this.checkAssignmentOptimized(survey, currentUserId);
      
      // STEP 3: If assignment found, create local session (offline-first)
      if (foundAssignment) {
        console.log('✅ Assignment found in synced survey data - creating local session');
        
        // PERFORMANCE: CAPI OFFLINE-FIRST - Start interview immediately, check online status in background
        // For CAPI, we already have assignment verified locally, so we can start immediately
        // This prevents blocking on slow network checks or API calls
        console.log('🌐 CAPI offline-first: starting interview immediately, checking online status in background');
        
        // Create offline session immediately (non-blocking - interview starts instantly)
        const localSessionId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const localSessionData = {
          sessionId: localSessionId,
          survey: surveyId,
          interviewMode: 'capi',
          startTime: new Date().toISOString(),
          requiresACSelection: requiresACSelection,
          assignedACs: assignedACs,
          acAssignmentState: survey?.acAssignmentState || 'West Bengal',
          status: 'active',
          isOffline: true, // Will be updated when server sync completes
        };
        
        // PERFORMANCE: Check online status and sync to server in background (non-blocking)
        // Don't await - interview starts immediately
        this.isOnline()
          .then((isOnline) => {
            if (isOnline) {
              // Start API call in background - don't await it
              return this.getHeaders()
                .then((headers) => {
                  return axios.post(
                    `${this.baseURL}/api/survey-responses/start/${surveyId}`,
                    {},
                    { headers, timeout: 5000 }
                  );
                })
                .then((response) => {
                  if (response.data && response.data.data) {
                    console.log('✅ [BACKGROUND] Server session created - will be used for sync');
                    // Server session created successfully - it will be used during sync
                    // The local session is fine for now, server session will be linked during sync
                  }
                })
                .catch((apiError: any) => {
                  // Silently handle errors - interview is already started offline
                  const is403Error = apiError.response?.status === 403;
                  if (is403Error) {
                    console.warn('⚠️ [BACKGROUND] Server rejected assignment (403) - interview continues offline');
                  } else {
                    console.log('⚠️ [BACKGROUND] Server sync failed (non-critical) - interview continues offline:', apiError.message);
                  }
                });
            } else {
              console.log('📴 [BACKGROUND] Device is offline - interview continues in offline mode');
            }
          })
          .catch(() => {
            // Ignore isOnline errors - interview continues offline
            console.log('⚠️ [BACKGROUND] Online check failed - interview continues in offline mode');
          });
        
        // Return offline session immediately (interview starts instantly - no blocking!)
        return { 
          success: true, 
          response: localSessionData 
        };
      } else {
        // No assignment found in synced data - this shouldn't happen if surveys are synced correctly
        console.log('⚠️ No assignment found in synced survey data - will try API call (edge case)');
        
        // PERFORMANCE: Check online status (uses cache)
        const isOnline = await this.isOnline();
        if (!isOnline) {
          return {
            success: false,
            message: 'You are not assigned to this survey (checked from synced data). Please sync surveys or check your assignment.'
          };
        }
        
        // Try API call as fallback
        const headers = await this.getHeaders();
        // PERFORMANCE: Reduced timeout from 10s to 5s for faster failure detection
        const response = await axios.post(
          `${this.baseURL}/api/survey-responses/start/${surveyId}`,
          {},
          { headers, timeout: 5000 }
        );
        return { success: true, response: response.data.data };
      }
    } catch (error: any) {
      console.error('Start interview error:', error);
      console.error('🔍 Error response:', error.response?.data);
      console.error('🔍 Error status:', error.response?.status);
      
      // If network error and we're offline, create local session
      const isNetworkError = error.message?.includes('Network') || 
                            error.message?.includes('timeout') ||
                            error.code === 'NETWORK_ERROR' ||
                            !await this.isOnline();
      
      if (isNetworkError) {
        console.log('📴 Network error - creating local interview session');
        // Create a local session ID for offline interviews
        const localSessionId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // PERFORMANCE: Get survey from cache first
        const { performanceCache } = await import('./performanceCache');
        let survey = performanceCache.getSurvey(surveyId);
        
        if (!survey) {
          const surveys = await offlineStorage.getSurveys();
          survey = surveys.find((s: any) => s._id === surveyId || s.id === surveyId);
        }
        
        // PERFORMANCE: Use optimized assignment checking
        let requiresACSelection = false;
        let assignedACs: string[] = [];
        
        // Get current user ID from cache
        let currentUserId: string | null = null;
        try {
          const performanceCache = await this.getPerformanceCache();
          if (performanceCache) {
            const cachedUserData = performanceCache.getUserData();
            if (cachedUserData) {
              currentUserId = cachedUserData._id || cachedUserData.id || cachedUserData.memberId || null;
            } else {
              const userDataStr = await AsyncStorage.getItem('userData');
              if (userDataStr) {
                const userData = JSON.parse(userDataStr);
                currentUserId = userData._id || userData.id || userData.memberId || null;
                performanceCache.setUserData(userData);
              }
            }
          } else {
            // Performance cache not available - read directly from AsyncStorage
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
              const userData = JSON.parse(userDataStr);
              currentUserId = userData._id || userData.id || userData.memberId || null;
            }
          }
        } catch (error) {
          console.error('❌ Error getting current user ID:', error);
        }
        
        if (survey) {
          // PERFORMANCE OPTIMIZED: Use optimized assignment checking (O(1) Map lookup)
          const assignmentResult = await this.checkAssignmentOptimized(survey, currentUserId);
          requiresACSelection = assignmentResult.requiresACSelection;
          assignedACs = assignmentResult.assignedACs;
        }
        
        // Create local session data
        const localSessionData = {
          sessionId: localSessionId,
          survey: surveyId,
          interviewMode: 'capi',
          startTime: new Date().toISOString(),
          requiresACSelection: requiresACSelection,
          assignedACs: assignedACs,
          acAssignmentState: survey?.acAssignmentState || 'West Bengal',
          status: 'active',
          isOffline: true, // Mark as offline session
        };
        
        return { 
          success: true, 
          response: localSessionData 
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to start interview',
      };
    }
  }

  /**
   * Get survey response by responseId (UUID) or mongoId (_id) to verify audio upload
   * Used to verify that audio was actually linked to the response
   * 
   * @param identifier - Can be UUID responseId or MongoDB _id
   */
  /**
   * Verify interview sync (two-phase commit verification)
   * This endpoint verifies that an interview was successfully synced to the server
   * Works even for abandoned responses (unlike getSurveyResponseById which blocks them)
   * 
   * @param responseId - UUID responseId (preferred)
   * @param mongoId - MongoDB _id (fallback)
   */
  async verifyInterviewSync(responseId?: string, mongoId?: string): Promise<{ 
    success: boolean; 
    verified?: boolean; 
    audioVerified?: boolean; 
    responseId?: string; 
    mongoId?: string; 
    status?: string; 
    hasResponses?: boolean; 
    hasAudio?: boolean; 
    error?: string 
  }> {
    try {
      const headers = await this.getHeaders();
      
      if (!responseId && !mongoId) {
        return {
          success: false,
          error: 'responseId or mongoId is required'
        };
      }
      
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/verify-sync`,
        { responseId, mongoId },
        { headers }
      );
      
      if (response.data && response.data.success) {
        return {
          success: true,
          verified: response.data.verified,
          audioVerified: response.data.audioVerified,
          responseId: response.data.responseId,
          mongoId: response.data.mongoId,
          status: response.data.status,
          hasResponses: response.data.hasResponses,
          hasAudio: response.data.hasAudio
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Verification failed'
        };
      }
    } catch (error: any) {
      console.error('Error verifying interview sync:', error);
      
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Interview not found on server',
          verified: false
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to verify interview sync'
      };
    }
  }

  async getSurveyResponseById(identifier: string): Promise<{ success: boolean; response?: any; error?: string; isGone?: boolean }> {
    const cacheKey = `survey_response_${identifier}`;
    
    try {
      // PHASE 2: Use retry logic with deduplication and caching
      const result = await this.makeRequestWithRetry(
        cacheKey,
        async () => {
          const headers = await this.getHeaders();
          
          // Try by UUID responseId first, then by MongoDB _id if that fails
          let response;
          try {
            // First try: search by responseId (UUID)
            response = await axios.get(
              `${this.baseURL}/api/survey-responses/${identifier}`,
              { headers }
            );
          } catch (error: any) {
            // PHASE 2: Stop retrying on 410 (Gone) - permanent failure
            if (error.response?.status === 410) {
              console.log(`[ApiService] Response ${identifier} returned 410 (Gone) - no retries`);
              throw error; // Will be caught and cached as "gone"
            }
            
            // If that fails, the endpoint might not support UUID lookup directly
            // The backend endpoint accepts either UUID or MongoDB _id
            console.log(`⚠️ Direct lookup failed, trying alternative method...`);
            throw error; // Let it fall through to error handling
          }
          
          if (response.data && response.data.success && response.data.interview) {
            return {
              success: true,
              response: response.data.interview
            };
          } else {
            return {
              success: false,
              error: 'Response not found or invalid format'
            };
          }
        },
        2 // max 2 retries (less than getInterviewDetails since this is for verification)
      );

      return result;
    } catch (error: any) {
      // PHASE 2: Handle 410 (Gone) status specifically - stop all retries
      if (error.response?.status === 410) {
        console.log(`[ApiService] getSurveyResponseById - Response ${identifier} is gone (410), returning error immediately`);
        return {
          success: false,
          error: 'Interview not available or has been removed.',
          isGone: true // Flag to indicate permanent failure
        };
      }
      
      console.error('Error fetching survey response:', error);
      
      // If 404, try to provide helpful error message
      if (error.response?.status === 404) {
        return {
          success: false,
          error: `Response not found with identifier: ${identifier}`
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch response'
      };
    }
  }

  async saveResponse(responseId: string, data: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(
        `${this.baseURL}/api/survey-responses/${responseId}`,
        data,
        { headers }
      );
      return { success: true, response: response.data.response };
    } catch (error: any) {
      console.error('Save response error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save response',
      };
    }
  }

  async saveInterviewProgress(responseId: string, responses: Record<string, any>) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(
        `${this.baseURL}/api/survey-responses/${responseId}/progress`,
        { responses },
        { headers }
      );
      return { success: true, response: response.data };
    } catch (error: any) {
      console.error('Save progress error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save progress',
      };
    }
  }


  // Pause interview
  async pauseInterview(sessionId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/session/${sessionId}/pause`,
        {},
        { headers }
      );
      return { success: true, response: response.data };
    } catch (error: any) {
      console.error('Pause interview error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to pause interview',
      };
    }
  }

  // Resume interview
  async resumeInterview(sessionId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/session/${sessionId}/resume`,
        {},
        { headers }
      );
      return { success: true, response: response.data };
    } catch (error: any) {
      console.error('Resume interview error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to resume interview',
      };
    }
  }

  // Abandon interview - now accepts responses and metadata
  async abandonInterview(sessionId: string, responses?: any[], metadata?: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/session/${sessionId}/abandon`,
        {
          responses,
          metadata
        },
        { headers }
      );
      return { success: true, response: response.data };
    } catch (error: any) {
      console.error('Abandon interview error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to abandon interview',
      };
    }
  }

  // Upload audio file
  async uploadAudioFile(audioUri: string, sessionId: string, surveyId: string, responseId?: string) {
    try {
      console.log('Uploading audio file:', { audioUri, sessionId, surveyId, responseId });
      
      // Check if this is a mock URI (for testing)
      // DO NOT allow mock URIs to be uploaded or saved to database
      if (audioUri.startsWith('mock://')) {
        console.error('❌ Mock audio URI detected - cannot upload mock files');
        return { 
          success: false, 
          message: 'Mock audio files cannot be uploaded. Please record a real audio file.'
        };
      }
      
      const formData = new FormData();
      
      // Create file object from URI - match web app format exactly
      // Determine file type based on URI extension
      const uriLower = audioUri.toLowerCase();
      let mimeType = 'audio/m4a'; // Default for React Native
      let extension = '.m4a';
      
      if (uriLower.includes('.wav')) {
        mimeType = 'audio/wav';
        extension = '.wav';
      } else if (uriLower.includes('.webm')) {
        mimeType = 'audio/webm';
        extension = '.webm';
      } else if (uriLower.includes('.m4a')) {
        mimeType = 'audio/m4a';
        extension = '.m4a';
      }
      
      const file = {
        uri: audioUri,
        type: mimeType,
        name: `interview_${sessionId}_${Date.now()}${extension}`,
      } as any;
      
      formData.append('audio', file);
      formData.append('sessionId', sessionId);
      formData.append('surveyId', surveyId);
      
      // CRITICAL: Include responseId if provided (for linking audio to completed response)
      if (responseId) {
        formData.append('responseId', responseId);
        console.log('📎 Including responseId in audio upload:', responseId);
      }
      
      const headers = await this.getHeaders();
      // Remove Content-Type header to let FormData set it
      delete headers['Content-Type'];
      
      console.log('Uploading to:', `${this.baseURL}/api/survey-responses/upload-audio`);
      console.log('Headers:', headers);
      console.log('FormData file object:', file);
      
      // Use fetch with timeout and better error handling
      // CRITICAL: Increased timeout to 120 seconds for large audio files and slow connections
      // This matches backend timeout of 2 hours, but we use 2 minutes for client-side timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (2 minutes)
      
      try {
        const response = await fetch(`${this.baseURL}/api/survey-responses/upload-audio`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': headers.Authorization,
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // CRITICAL: Handle 502 Bad Gateway errors specifically
        if (response.status === 502) {
          console.error('❌ 502 Bad Gateway during audio upload - backend server not responding');
          const errorText = await response.text().catch(() => '');
          return {
            success: false,
            message: 'Backend server is not responding (502 Bad Gateway). Please try again later.',
            error: '502 Bad Gateway',
          };
        }
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('Upload failed:', response.status, errorText);
          
          // Check for 502 in error text as well (some servers return it in body)
          if (response.status === 502 || errorText.includes('502') || errorText.includes('Bad Gateway')) {
            return {
              success: false,
              message: 'Backend server is not responding (502 Bad Gateway). Please try again later.',
              error: '502 Bad Gateway',
            };
          }
          
          throw new Error(`Failed to upload audio: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Audio upload successful:', result);
        
        // CRITICAL: Check if result has success field
        if (result && result.success !== undefined) {
          if (result.success && result.data) {
            return { success: true, response: result.data, audioUrl: result.data.audioUrl };
          } else {
            return {
              success: false,
              message: result.message || 'Audio upload failed',
              error: result.message || 'Unknown error',
            };
          }
        } else if (result && result.data) {
          // Legacy format - just return data
          return { success: true, response: result.data, audioUrl: result.data.audioUrl };
        } else {
          return {
            success: false,
            message: 'Unexpected response format from server',
            error: 'Invalid response format',
          };
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Check if it's a timeout or abort
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          console.error('❌ Audio upload timeout - request took too long');
          return {
            success: false,
            message: 'Audio upload timeout - request took too long. Please check your connection.',
            error: 'Timeout',
          };
        }
        
        // Re-throw other errors to be caught by outer catch
        throw fetchError;
      }
      
    } catch (error: any) {
      console.error('Upload audio error:', error);
      
      // Check for 502 errors
      if (error.message && (error.message.includes('502') || error.message.includes('Bad Gateway'))) {
        console.error('❌ 502 Bad Gateway during audio upload');
        return {
          success: false,
          message: 'Backend server is not responding (502 Bad Gateway). Please try again later.',
          error: '502 Bad Gateway',
        };
      }
      
      // If it's a network error, return failure - DO NOT use mock URLs
      // CRITICAL: Audio is REQUIRED - do NOT proceed without audio
      if (error.message.includes('Network request failed') || error.name === 'AbortError') {
        console.error('❌ Network error during audio upload - upload failed');
        return { 
          success: false,
          message: 'Network error - audio upload failed. Audio is REQUIRED for CAPI interviews.',
          error: 'Network error',
        };
      }
      
      return {
        success: false,
        message: error.message || 'Failed to upload audio',
        error: error.message || 'Unknown error',
      };
    }
  }

  // Complete interview
  async completeInterview(sessionId: string, interviewData: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/session/${sessionId}/complete`,
        interviewData,
        { 
          headers,
          timeout: 60000 // 60 second timeout for large requests
        }
      );
      
      // CRITICAL: Check response structure
      if (response.data && response.data.success !== undefined) {
        // Backend returns { success: true, data: {...} } format
        if (response.data.success && response.data.data) {
          return { success: true, response: response.data.data };
        } else {
          // Backend returned success: false
          return {
            success: false,
            message: response.data.message || 'Failed to complete interview',
            isDuplicate: response.data.isDuplicate || false,
          };
        }
      } else if (response.data && response.data.data) {
        // Backend returns { data: {...} } format (legacy)
        return { success: true, response: response.data.data };
      } else {
        // Unexpected response format
        console.error('Unexpected response format:', response.data);
        return {
          success: false,
          message: 'Unexpected response format from server',
          isDuplicate: false,
        };
      }
    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorMessage = error.message || '';
      
      // CRITICAL: Handle 502 Bad Gateway errors separately
      // 502 means backend is not responding (down/overloaded/timeout)
      if (statusCode === 502) {
        console.error('❌ 502 Bad Gateway - Backend server is not responding');
        console.error('❌ This is a temporary server issue - interview should be retried');
        return {
          success: false,
          message: 'Backend server is not responding (502 Bad Gateway). Please try again later.',
          isDuplicate: false,
          isServerError: true, // Flag for retry logic
          statusCode: 502,
        };
      }
      
      // Check if this is a duplicate submission (409 Conflict)
      // This is not really an error - interview already exists on server
      const isDuplicate = statusCode === 409 || 
                         error.response?.data?.isDuplicate === true ||
                         (error.response?.data?.message && 
                          error.response.data.message.toLowerCase().includes('duplicate'));
      
      if (isDuplicate) {
        console.log('ℹ️ Complete interview - duplicate detected (interview already exists on server)');
        console.log('ℹ️ This is expected behavior - interview was already successfully submitted');
      } else {
        console.error('Complete interview error:', error);
        console.error('Error status:', statusCode);
        console.error('Error message:', errorMessage);
      }
      
      return {
        success: false,
        message: error.response?.data?.message || errorMessage || 'Failed to complete interview',
        isDuplicate: isDuplicate, // Include flag for duplicate detection
        statusCode: statusCode,
      };
    }
  }

  // Get interviewer statistics (lightweight endpoint)
  async getInterviewerStats() {
    try {
      // PERFORMANCE: Check cache first (offline-first approach)
      const cachedStats = await offlineStorage.getCachedInterviewerStats();
      if (cachedStats) {
        console.log('⚡ Interviewer stats loaded from cache (instant)');
      }
      
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/survey-responses/interviewer-stats`, { headers });
      
      if (response.data.success) {
        // API returns: { success: true, data: { totalCompleted, approved, rejected, pendingApproval } }
        const stats = response.data.data || {};
        
        // CRITICAL: Cache stats for offline display (like WhatsApp/Meta/Google)
        // Cache stats whenever they're successfully fetched so they're available offline
        if (stats && typeof stats.totalCompleted === 'number') {
          await offlineStorage.saveInterviewerStats({
            totalCompleted: stats.totalCompleted || 0,
            approved: stats.approved || 0,
            rejected: stats.rejected || 0,
            pendingApproval: stats.pendingApproval || 0,
          });
          console.log('✅ Interviewer stats cached for offline access');
        }
        
        return { 
          success: true, 
          stats: stats
        };
      } else {
        // API failed - return cached stats if available
        if (cachedStats) {
          console.log('⚠️ API failed, using cached stats:', cachedStats);
          return {
            success: true,
            stats: cachedStats,
            fromCache: true,
          };
        }
        
        return {
          success: false,
          message: response.data.message || 'Failed to fetch interviewer statistics',
        };
      }
    } catch (error: any) {
      console.error('Get interviewer stats error:', error);
      console.error('Error response:', error.response?.data);
      
      // CRITICAL: If API call fails, return cached stats (offline-first)
      // Like WhatsApp/Meta - show last known stats when offline
      const cachedStats = await offlineStorage.getCachedInterviewerStats();
      if (cachedStats) {
        console.log('⚠️ Network error, using cached stats for offline display:', cachedStats);
        return {
          success: true,
          stats: cachedStats,
          fromCache: true,
        };
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch interviewer statistics',
      };
    }
  }

  async getMyInterviews(params?: { page?: number; limit?: number; search?: string; status?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    try {
      const headers = await this.getHeaders();
      const queryParams = new URLSearchParams();
      
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
      
      const queryString = queryParams.toString();
      const url = `${this.baseURL}/api/survey-responses/my-interviews${queryString ? `?${queryString}` : ''}`;
      
      const response = await axios.get(url, { headers });
      
      if (response.data.success) {
        return { 
          success: true, 
          interviews: response.data.data?.interviews || response.data.interviews || [],
          total: response.data.data?.total || 0,
          page: response.data.data?.page || 1,
          limit: response.data.data?.limit || 20,
          totalPages: response.data.data?.totalPages || 1
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to fetch interviews',
        };
      }
    } catch (error: any) {
      console.error('Get my interviews error:', error);
      console.error('Error response:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch interviews',
      };
    }
  }

  // PHASE 2: Helper method for exponential backoff with jitter
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRetryDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    // Add jitter (random 0-30% of delay)
    const jitter = Math.random() * 0.3 * exponentialDelay;
    const delay = exponentialDelay + jitter;
    // Cap at maxDelay
    return Math.min(delay, maxDelay);
  }

  // PHASE 2: Check if response is cached and still valid
  private getCachedResponse(cacheKey: string): any | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const ttl = cached.isGone ? this.GONE_CACHE_TTL : this.CACHE_TTL;
    
    if (now - cached.timestamp > ttl) {
      // Cache expired
      this.responseCache.delete(cacheKey);
      return null;
    }

    // If it's marked as "gone" (410), return error immediately
    if (cached.isGone) {
      return { isGone: true, cached: true };
    }

    return cached.data;
  }

  // PHASE 2: Cache response
  private setCachedResponse(cacheKey: string, data: any, isGone: boolean = false): void {
    this.responseCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      isGone
    });
  }

  // PHASE 2: Make request with retry logic, deduplication, and caching
  private async makeRequestWithRetry<T>(
    cacheKey: string,
    requestFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    // Check cache first
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      if (cached.isGone) {
        // Return 410 error immediately for cached "gone" responses
        throw { response: { status: 410, data: { message: 'Interview not available or has been removed.' } } };
      }
      return cached;
    }

    // Check if request is already pending (deduplication)
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Create new request
    const requestPromise = this.executeRequestWithRetry(requestFn, maxRetries, cacheKey);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Remove from pending requests
      this.pendingRequests.delete(cacheKey);
    }
  }

  // PHASE 2: Execute request with exponential backoff retry
  private async executeRequestWithRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries: number,
    cacheKey: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await requestFn();
        
        // Cache successful response
        this.setCachedResponse(cacheKey, result, false);
        return result;
      } catch (error: any) {
        lastError = error;

        // PHASE 2: Stop retrying on 410 (Gone) - permanent failure
        if (error.response?.status === 410) {
          console.log(`[ApiService] Response ${cacheKey} returned 410 (Gone) - marking as gone, no retries`);
          // Cache as "gone" for 24 hours
          this.setCachedResponse(cacheKey, null, true);
          throw error;
        }

        // PHASE 2: Stop retrying on 4xx errors (except network errors) - client errors
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 408) {
          console.log(`[ApiService] Response ${cacheKey} returned ${error.response.status} - no retries`);
          throw error;
        }

        // PHASE 2: Only retry on 5xx errors, network errors, or timeout (408)
        if (attempt < maxRetries) {
          const delay = this.getRetryDelay(attempt);
          console.log(`[ApiService] Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw lastError;
  }

  async getInterviewDetails(responseId: string) {
    try {
      const cacheKey = `interview_details_${responseId}`;
      
      // PHASE 2: Use retry logic with deduplication and caching
      const result = await this.makeRequestWithRetry(
        cacheKey,
        async () => {
          const headers = await this.getHeaders();
          const response = await axios.get(`${this.baseURL}/api/survey-responses/${responseId}`, { headers });
          return { success: true, interview: response.data.interview };
        },
        3 // max 3 retries
      );

      return result;
    } catch (error: any) {
      console.error('Get interview details error:', error);
      
      // PHASE 2: Handle 410 (Gone) status specifically
      if (error.response?.status === 410) {
        return {
          success: false,
          message: 'Interview not available or has been removed.',
          isGone: true // Flag to indicate permanent failure
        };
      }

      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch interview details',
      };
    }
  }

  // File upload
  async uploadAudio(audioUri: string, responseId: string) {
    try {
      const headers = await this.getHeaders();
      const formData = new FormData();
      
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'interview_audio.m4a',
      } as any);
      
      formData.append('responseId', responseId);

      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/upload-audio`,
        formData,
        {
          headers: {
            ...headers,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return { success: true, audioUrl: response.data.audioUrl };
    } catch (error: any) {
      console.error('Upload audio error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to upload audio',
      };
    }
  }

  // Get gender response counts for quota management
  async getGenderResponseCounts(surveyId: string) {
    try {
      // Check offline cache first (lazy import to avoid circular dependency)
      const cacheForRead = await this.getOfflineCache();
      if (cacheForRead) {
        try {
          const cachedData = await cacheForRead.getGenderQuotas(surveyId);
          if (cachedData) {
            console.log('📦 Using cached gender quotas for survey:', surveyId);
            return { success: true, data: cachedData };
          }
        } catch (cacheError) {
          // Cache read failed, continue without cache
        }
      }

      // Check if online
      const isOnline = await this.isOnline();
      if (!isOnline) {
        console.log('📴 Offline - no cached gender quotas for survey:', surveyId);
        return {
          success: false,
          message: 'No internet connection and no cached data available',
          error: 'OFFLINE_NO_CACHE'
        };
      }

      // Fetch from API
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/survey-responses/survey/${surveyId}/gender-counts`, { headers });
      
      // Cache the data
      const cacheForSave = await this.getOfflineCache();
      if (cacheForSave && response.data.success && response.data.data) {
        try {
          await cacheForSave.saveGenderQuotas(surveyId, response.data.data);
        } catch (cacheError) {
          // Cache save failed, continue without caching
        }
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Get gender response counts error:', error);
      console.error('🔍 Error response:', error.response?.data);
      console.error('🔍 Error status:', error.response?.status);
      
      // Try cache as fallback
      const cacheForFallback = await this.getOfflineCache();
      if (cacheForFallback) {
        try {
          const cachedData = await cacheForFallback.getGenderQuotas(surveyId);
          if (cachedData) {
            console.log('📦 Using cached gender quotas as fallback for survey:', surveyId);
            return { success: true, data: cachedData };
          }
        } catch (cacheError) {
          // Cache not available, continue with error
        }
      }
      
      return {
        success: false,
        message: 'Failed to get gender response counts',
        error: error.message
      };
    }
  }

  // Get last CATI set number for a survey (to alternate sets)
  // CRITICAL: Always fetch from API to ensure proper set rotation - do NOT use cached data
  async getLastCatiSetNumber(surveyId: string, forceRefresh: boolean = true) {
    try {
      if (!surveyId) {
        return {
          success: false,
          message: 'Survey ID is required',
          error: 'Missing surveyId parameter'
        };
      }

      // Check if online - CATI requires internet connection
      const isOnline = await this.isOnline();
      if (!isOnline) {
        console.log('📴 Offline - CATI set number requires internet connection');
        // Return error for offline - CATI interviews require internet
        return {
          success: false,
          message: 'Internet connection required for CATI set number',
          error: 'Offline mode'
        };
      }

      // CRITICAL: Always fetch from API to ensure proper set rotation
      // Do NOT use cached data for CATI set numbers as rotation depends on latest completed interviews
      console.log('🔄 Fetching latest CATI set number from API for survey:', surveyId);
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/survey-responses/survey/${surveyId}/last-cati-set`, { headers });
      
      // Update cache with latest data (for reference, but we won't use it for CATI)
      const cacheForSave = await this.getOfflineCache();
      if (cacheForSave && response.data.success && response.data.data) {
        try {
          await cacheForSave.saveCatiSetNumber(surveyId, response.data.data);
          console.log('✅ Updated CATI set number cache:', response.data.data);
        } catch (cacheError) {
          // Cache save failed, continue
          console.warn('⚠️ Failed to update CATI set number cache:', cacheError);
        }
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching CATI set number from API:', error);
      // For CATI, we should not use cached data as fallback - set rotation is critical
      // Only use cache if it's a network error and we have no other option
      if (error.response && error.response.status === 404) {
        // 404 means no previous CATI responses - this is expected for first interview
        console.log('ℹ️ No previous CATI responses found (404) - will default to Set 1');
        return {
          success: true,
          data: { nextSetNumber: null } // Frontend will default to Set 1
        };
      }
      
      // For other errors, try cache as last resort but log warning
      const cacheForFallback = await this.getOfflineCache();
      if (cacheForFallback) {
        try {
          const cachedData = await cacheForFallback.getCatiSetNumber(surveyId);
          if (cachedData) {
            console.warn('⚠️ Using cached CATI set number as fallback (may be stale):', cachedData);
            return { success: true, data: cachedData };
          }
        } catch (cacheError) {
          // Cache not available
        }
      }
      
      // If we have an error response, return it
      if (error.response && error.response.data) {
        return error.response.data;
      }
      
      // Final fallback - return error
      return {
        success: false,
        message: 'Failed to get last CATI set number',
        error: error.message || 'Unknown error'
      };
    }
  }

  // Polling Station API methods
  async getRoundNumbersByAC(state: string, acIdentifier: string) {
    try {
      // Use bundled data (always available, no network needed)
      const { bundledDataService } = await import('./bundledDataService');
      const bundledResult = await bundledDataService.getRoundNumbersByAC(state, acIdentifier);
      if (bundledResult.success) {
        console.log('📦 Using bundled round numbers for:', state, acIdentifier);
        return bundledResult;
      }
      return {
        success: false,
        message: 'Round numbers not found in bundled data'
      };
    } catch (error: any) {
      console.error('Get round numbers by AC error:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch round numbers'
      };
    }
  }

  async getGroupsByAC(state: string, acIdentifier: string, roundNumber?: string) {
    try {
      // FIRST: Try bundled data (always available, no network needed)
      try {
        const { bundledDataService } = await import('./bundledDataService');
        const bundledResult = await bundledDataService.getGroupsByAC(state, acIdentifier, roundNumber);
        if (bundledResult.success) {
          console.log('📦 Using bundled polling groups for:', state, acIdentifier, 'Round:', roundNumber || 'All');
          
          // Also cache it for faster future lookups
          const cacheForSave = await this.getOfflineCache();
          if (cacheForSave && bundledResult.data) {
            try {
              await cacheForSave.savePollingGroups(state, acIdentifier, bundledResult.data);
              // Also save with AC code if available
              if (bundledResult.data.ac_no) {
                await cacheForSave.savePollingGroups(state, bundledResult.data.ac_no.toString(), bundledResult.data);
              }
            } catch (cacheError) {
              // Cache save failed, but that's okay - we have bundled data
            }
          }
          
          return bundledResult;
        }
      } catch (bundledError) {
        console.warn('⚠️ Error loading bundled data, trying cache/API:', bundledError);
      }
      
      // Normalize AC name to match master data spelling (define before cache check)
      const normalizedAC = this.normalizeACName(acIdentifier);
      
      // SECOND: Check offline cache (lazy import) - try multiple variations
      const cacheForRead = await this.getOfflineCache();
      let cachedData = null;
      if (cacheForRead) {
        try {
          // Try normalized name first
          cachedData = await cacheForRead.getPollingGroups(state, normalizedAC);
          if (cachedData) {
            console.log('📦 Using cached polling groups for:', state, normalizedAC, '(normalized)');
          } else {
            // If not found, try original name
            cachedData = await cacheForRead.getPollingGroups(state, acIdentifier);
            if (cachedData) {
              console.log('📦 Using cached polling groups for:', state, acIdentifier, '(original)');
            } else {
              // Try case-insensitive search in all cached groups
              console.log('🔍 Cache miss for exact match, trying case-insensitive search...');
              const allGroups = await cacheForRead.getAllPollingGroups();
              const searchKey = `${state}::`;
              const lowerAC = acIdentifier.toLowerCase();
              const lowerNormalized = normalizedAC.toLowerCase();
              
              for (const [key, value] of Object.entries(allGroups)) {
                if (key.startsWith(searchKey)) {
                  const cachedAC = key.replace(searchKey, '');
                  const lowerCached = cachedAC.toLowerCase();
                  // Check if AC matches (case-insensitive)
                  if (lowerCached === lowerAC || lowerCached === lowerNormalized) {
                    console.log('📦 Found cached polling groups with case-insensitive match:', key);
                    cachedData = value as any;
                    break;
                  }
                }
              }
            }
          }
        } catch (cacheError) {
          console.error('❌ Cache read error:', cacheError);
          // Continue to try online fetch or return error
        }
      }
      
      if (cachedData) {
        return { success: true, data: cachedData };
      }
      
      // ALWAYS use bundled data - never make API calls for groups/polling stations
      // Bundled data is always available and up-to-date
      console.log('📦 Bundled data not found, but no API call needed - data should be in bundled files');
      return {
        success: false,
        message: 'Groups not found in bundled data. Please ensure polling_stations.json is up to date.',
      };
    } catch (error: any) {
      console.error('Get groups by AC error:', error);
      console.error('Error response:', error.response?.data);
      
      // Ensure acIdentifier is a string before logging/using
      let acIdentifierStr: string;
      if (typeof acIdentifier === 'string') {
        acIdentifierStr = acIdentifier;
      } else if (acIdentifier && typeof acIdentifier === 'object') {
        const acObj = acIdentifier as any;
        acIdentifierStr = acObj.acName || acObj.acCode || acObj.name || acObj.displayText || JSON.stringify(acIdentifier);
        console.error('⚠️ AC Identifier was an object, extracted:', acIdentifierStr);
      } else {
        acIdentifierStr = String(acIdentifier || 'unknown');
      }
      console.error('AC Identifier used:', acIdentifierStr);
      
      // Try cache as fallback - more aggressive search
      const cacheForFallback = await this.getOfflineCache();
      if (cacheForFallback && typeof acIdentifierStr === 'string') {
        try {
          const normalizedAC = this.normalizeACName(acIdentifierStr);
          let cachedData = await cacheForFallback.getPollingGroups(state, normalizedAC);
          if (!cachedData) {
            cachedData = await cacheForFallback.getPollingGroups(state, acIdentifierStr);
          }
          if (!cachedData) {
            // Try case-insensitive search in all cached groups
            const allGroups = await cacheForFallback.getAllPollingGroups();
            const searchKey = `${state}::`;
            const lowerAC = acIdentifierStr.toLowerCase();
            const lowerNormalized = normalizedAC.toLowerCase();
            
            for (const [key, value] of Object.entries(allGroups)) {
              if (key.startsWith(searchKey)) {
                const cachedAC = key.replace(searchKey, '');
                const lowerCached = cachedAC.toLowerCase();
                // Check if AC matches (case-insensitive)
                if (lowerCached === lowerAC || lowerCached === lowerNormalized) {
                  console.log('📦 Found cached polling groups as fallback with case-insensitive match:', key);
                  cachedData = value as any;
                  break;
                }
              }
            }
          }
          if (cachedData) {
            console.log('📦 Using cached polling groups as fallback for:', state, normalizedAC);
            return { success: true, data: cachedData };
          }
        } catch (cacheError: any) {
          // Only log if it's not a toLowerCase error (which means acIdentifier was an object)
          if (!cacheError.message || !cacheError.message.includes('toLowerCase')) {
            console.error('❌ Cache fallback error:', cacheError);
          }
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch groups',
      };
    }
  }

  async getPollingStationsByGroup(state: string, acIdentifier: string, groupName: string, roundNumber?: string) {
    try {
      // FIRST: Try bundled data (always available, no network needed)
      try {
        const { bundledDataService } = await import('./bundledDataService');
        const bundledResult = await bundledDataService.getPollingStationsByGroup(state, acIdentifier, groupName, roundNumber);
        if (bundledResult.success) {
          console.log('📦 Using bundled polling stations for:', state, acIdentifier, groupName, 'Round:', roundNumber || 'All');
          
          // Also cache it for faster future lookups
          const cacheForSave = await this.getOfflineCache();
          if (cacheForSave && bundledResult.data) {
            try {
              await cacheForSave.savePollingStations(state, acIdentifier, groupName, bundledResult.data);
              // Also try to get AC code from cached groups
              const cachedGroups = await cacheForSave.getPollingGroups(state, acIdentifier);
              if (cachedGroups && (cachedGroups as any).ac_no) {
                await cacheForSave.savePollingStations(state, (cachedGroups as any).ac_no.toString(), groupName, bundledResult.data);
              }
            } catch (cacheError) {
              // Cache save failed, but that's okay - we have bundled data
            }
          }
          
          return bundledResult;
        }
      } catch (bundledError) {
        console.warn('⚠️ Error loading bundled data, trying cache/API:', bundledError);
      }
      
      // Normalize AC name to match master data spelling (define before cache check)
      const normalizedAC = this.normalizeACName(acIdentifier);
      
      // SECOND: Check offline cache (lazy import) - try multiple variations
      const cacheForRead = await this.getOfflineCache();
      let cachedData = null;
      if (cacheForRead) {
        try {
          // Try normalized name first
          cachedData = await cacheForRead.getPollingStations(state, normalizedAC, groupName);
          if (cachedData) {
            console.log('📦 Using cached polling stations for:', state, normalizedAC, groupName, '(normalized)');
          } else {
            // If not found, try original name
            cachedData = await cacheForRead.getPollingStations(state, acIdentifier, groupName);
            if (cachedData) {
              console.log('📦 Using cached polling stations for:', state, acIdentifier, groupName, '(original)');
            } else {
              // Try case-insensitive search in all cached stations
              console.log('🔍 Cache miss for exact match, trying case-insensitive search...');
              const allStations = await cacheForRead.getAllPollingStations();
              const searchKey = `${state}::`;
              const lowerAC = acIdentifier.toLowerCase();
              const lowerNormalized = normalizedAC.toLowerCase();
              const lowerGroup = groupName.toLowerCase();
              
              for (const [key, value] of Object.entries(allStations)) {
                if (key.startsWith(searchKey)) {
                  const parts = key.replace(searchKey, '').split('::');
                  if (parts.length >= 2) {
                    const cachedAC = parts[0];
                    const cachedGroup = parts[1];
                    const lowerCachedAC = cachedAC.toLowerCase();
                    const lowerCachedGroup = cachedGroup.toLowerCase();
                    // Check if AC and group match (case-insensitive)
                    if ((lowerCachedAC === lowerAC || lowerCachedAC === lowerNormalized) && 
                        lowerCachedGroup === lowerGroup) {
                      console.log('📦 Found cached polling stations with case-insensitive match:', key);
                      cachedData = value as any;
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (cacheError) {
          console.error('❌ Cache read error:', cacheError);
          // Continue to try online fetch or return error
        }
      }
      
      if (cachedData) {
        return { success: true, data: cachedData };
      }
      
      // ALWAYS use bundled data - never make API calls for groups/polling stations
      // Bundled data is always available and up-to-date
      console.log('📦 Bundled data not found, but no API call needed - data should be in bundled files');
      return {
        success: false,
        message: 'Polling stations not found in bundled data. Please ensure polling_stations.json is up to date.',
      };
    } catch (error: any) {
      console.error('Get polling stations by group error:', error);
      console.error('Error response:', error.response?.data);
      console.error('AC Identifier used:', acIdentifier);
      
      // Try cache as fallback - more aggressive search
      const cacheForFallback = await this.getOfflineCache();
      if (cacheForFallback) {
        try {
          const normalizedAC = this.normalizeACName(acIdentifier);
          let cachedData = await cacheForFallback.getPollingStations(state, normalizedAC, groupName);
          if (!cachedData) {
            cachedData = await cacheForFallback.getPollingStations(state, acIdentifier, groupName);
          }
          if (!cachedData) {
            // Try case-insensitive search in all cached stations
            const allStations = await cacheForFallback.getAllPollingStations();
            const searchKey = `${state}::`;
            const lowerAC = acIdentifier.toLowerCase();
            const lowerNormalized = normalizedAC.toLowerCase();
            const lowerGroup = groupName.toLowerCase();
            
            for (const [key, value] of Object.entries(allStations)) {
              if (key.startsWith(searchKey)) {
                const parts = key.replace(searchKey, '').split('::');
                if (parts.length >= 2) {
                  const cachedAC = parts[0];
                  const cachedGroup = parts[1];
                  const lowerCachedAC = cachedAC.toLowerCase();
                  const lowerCachedGroup = cachedGroup.toLowerCase();
                  // Check if AC and group match (case-insensitive)
                  if ((lowerCachedAC === lowerAC || lowerCachedAC === lowerNormalized) && 
                      lowerCachedGroup === lowerGroup) {
                    console.log('📦 Found cached polling stations as fallback with case-insensitive match:', key);
                    cachedData = value as any;
                    break;
                  }
                }
              }
            }
          }
          if (cachedData) {
            console.log('📦 Using cached polling stations as fallback for:', state, normalizedAC, groupName);
            return { success: true, data: cachedData };
          }
        } catch (cacheError) {
          console.error('❌ Cache fallback error:', cacheError);
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch polling stations',
      };
    }
  }

  // CATI Interview API methods
  async startCatiInterview(surveyId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/cati-interview/start/${surveyId}`,
        {},
        { headers }
      );
      
      // Check the backend's success field, not just HTTP status
      if (response.data.success === false) {
        return {
          success: false,
          message: response.data.message || 'Failed to start CATI interview',
          data: response.data.data || null
        };
      }
      
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ Start CATI interview error:', error);
      console.error('❌ Error response:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to start CATI interview',
        error: error.response?.data,
        data: error.response?.data?.data || null
      };
    }
  }

  async makeCallToRespondent(queueId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/cati-interview/make-call/${queueId}`,
        {},
        { headers }
      );
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Make call error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to make call',
        error: error.response?.data
      };
    }
  }

  async abandonCatiInterview(queueId: string, reason?: string, notes?: string, callLaterDate?: string, callStatus?: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/cati-interview/abandon/${queueId}`,
        {
          reason,
          notes,
          callLaterDate,
          callStatus // Pass call status for stats tracking
        },
        { headers }
      );
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Abandon CATI interview error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to abandon interview',
        error: error.response?.data
      };
    }
  }

  async completeCatiInterview(queueId: string, interviewData: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/cati-interview/complete/${queueId}`,
        interviewData,
        { headers }
      );
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ Complete CATI interview error:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error URL:', `${this.baseURL}/api/cati-interview/complete/${queueId}`);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to complete interview',
        error: error.response?.data
      };
    }
  }

  // Check if polling_stations.json has been updated on the server
  async checkPollingStationsUpdate() {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/polling-stations/check-update`, { headers });
      if (response.data.success) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, message: response.data.message || 'Failed to check update' };
      }
    } catch (error: any) {
      console.error('Check polling stations update error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to check update',
      };
    }
  }

  // Download the latest polling_stations.json file
  async downloadPollingStations(localHash?: string) {
    try {
      const headers = await this.getHeaders();
      const requestHeaders: any = { ...headers };
      
      // Add If-None-Match header if we have a local hash
      if (localHash) {
        requestHeaders['If-None-Match'] = localHash;
      }

      const response = await axios.get(`${this.baseURL}/api/polling-stations/download`, {
        headers: requestHeaders,
        responseType: 'text', // Get as text to handle JSON properly
        validateStatus: (status) => status === 200 || status === 304, // Accept 304 Not Modified
      });

      // If 304, file hasn't changed
      if (response.status === 304) {
        return { success: true, unchanged: true, message: 'File is up to date' };
      }

      // Parse JSON from response
      const fileContent = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const etag = response.headers.etag || response.headers['etag'] || localHash;

      return {
        success: true,
        data: fileContent,
        hash: etag,
        unchanged: false,
      };
    } catch (error: any) {
      console.error('Download polling stations error:', error);
      // Handle 304 status code (axios might throw for 304 in some cases)
      if (error.response?.status === 304) {
        return { success: true, unchanged: true, message: 'File is up to date' };
      }
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to download polling stations',
      };
    }
  }

  async getPollingStationGPS(state: string, acIdentifier: string, groupName: string, stationName: string) {
    try {
      // Normalize AC name to match master data spelling
      const normalizedAC = this.normalizeACName(acIdentifier);
      
      // Check offline cache first (lazy import) - try normalized name first
      const cacheForRead = await this.getOfflineCache();
      let cachedData = null;
      if (cacheForRead) {
        try {
          cachedData = await cacheForRead.getPollingGPS(state, normalizedAC, groupName, stationName);
          // If not found, try original name
          if (!cachedData) {
            cachedData = await cacheForRead.getPollingGPS(state, acIdentifier, groupName, stationName);
          }
        } catch (cacheError) {
          // Cache read failed, continue
        }
      }
      if (cachedData) {
        console.log('📦 Using cached GPS for:', state, normalizedAC, groupName, stationName);
        return { success: true, data: cachedData };
      }

      // Check if online
      const isOnline = await this.isOnline();
      if (!isOnline) {
        console.log('📴 Offline - no cached GPS for:', state, normalizedAC, groupName, stationName);
        return {
          success: false,
          message: 'No internet connection and no cached data available',
        };
      }

      // Fetch from API using normalized AC name
      const headers = await this.getHeaders();
      let response;
      try {
        response = await axios.get(
          `${this.baseURL}/api/polling-stations/gps/${encodeURIComponent(state)}/${encodeURIComponent(normalizedAC)}/${encodeURIComponent(groupName)}/${encodeURIComponent(stationName)}`,
          { headers }
        );
      } catch (firstError: any) {
        // If normalized name fails, try original name as fallback
        if (normalizedAC !== acIdentifier && firstError.response?.status === 404) {
          console.log(`⚠️ Normalized AC "${normalizedAC}" not found, trying original "${acIdentifier}"`);
          response = await axios.get(
        `${this.baseURL}/api/polling-stations/gps/${encodeURIComponent(state)}/${encodeURIComponent(acIdentifier)}/${encodeURIComponent(groupName)}/${encodeURIComponent(stationName)}`,
        { headers }
      );
        } else {
          throw firstError;
        }
      }
      
      // Cache the data using normalized name
      const cacheForSave = await this.getOfflineCache();
      if (cacheForSave && response.data.success && response.data.data) {
        try {
          await cacheForSave.savePollingGPS(state, normalizedAC, groupName, stationName, response.data.data);
        } catch (cacheError) {
          // Cache save failed, continue
        }
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Get polling station GPS error:', error);
      console.error('AC Identifier used:', acIdentifier);
      
      // Try cache as fallback
      const cacheForFallback = await this.getOfflineCache();
      if (cacheForFallback) {
        try {
          const normalizedAC = this.normalizeACName(acIdentifier);
          let cachedData = await cacheForFallback.getPollingGPS(state, normalizedAC, groupName, stationName);
          if (!cachedData) {
            cachedData = await cacheForFallback.getPollingGPS(state, acIdentifier, groupName, stationName);
          }
          if (cachedData) {
            console.log('📦 Using cached GPS as fallback for:', state, normalizedAC, groupName, stationName);
            return { success: true, data: cachedData };
          }
        } catch (cacheError) {
          // Cache not available
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch polling station GPS',
      };
    }
  }

  // Get current user profile (to check locationControlBooster)
  // @param forceRefresh - If true, always fetch from server when online, bypassing cache
  async getCurrentUser(forceRefresh: boolean = false) {
    try {
      // PERFORMANCE: Check cached online status first (non-blocking)
      // This prevents blocking on network checks during interview start
      let isOnline = false;
      try {
        const { performanceCache } = await import('./performanceCache');
        const cachedStatus = performanceCache.getOnlineStatus();
        if (cachedStatus !== null) {
          isOnline = cachedStatus;
        } else {
          // Cache miss - check online status (non-blocking, uses cache internally)
          isOnline = await this.isOnline();
        }
      } catch (cacheError) {
        // Fallback to normal check if cache not available
        isOnline = await this.isOnline();
      }
      
      // PERFORMANCE: If forceRefresh is true, return cached data immediately and refresh in background
      // This prevents blocking interview start on slow API calls
      if (forceRefresh) {
        // Get cached data from offline cache (fast - module is cached after first load)
        const cacheForRead = await this.getOfflineCache();
        let cachedData = null;
        if (cacheForRead) {
          try {
            cachedData = await cacheForRead.getUserData();
          } catch (cacheError) {
            // Cache read failed, continue
          }
        }
        
        // Return cached data immediately if available (non-blocking return)
        if (cachedData) {
          console.log('⚡ Returning cached user data immediately (forceRefresh in background)');
          
          // Refresh from server in background (non-blocking - don't await)
          if (isOnline) {
            // Start refresh in background immediately (don't await)
            this.getHeaders()
              .then((headers) => {
                return axios.get(`${this.baseURL}/api/auth/me`, { headers, timeout: 5000 });
              })
              .then((response) => {
                // Cache the fresh data
                return this.getOfflineCache().then((cacheForSave) => {
                  if (cacheForSave && (response.data.data || response.data.user)) {
                    return cacheForSave.saveUserData(response.data.data || response.data.user);
                  }
                });
              })
              .then(() => {
                console.log('✅ [BACKGROUND] Cached fresh user data');
              })
              .catch((error) => {
                console.warn('⚠️ [BACKGROUND] Failed to refresh user data (non-critical):', error.message);
              });
          }
          
          // Return immediately with cached data (interview starts instantly)
          return { success: true, user: cachedData };
        }
        
        // No cached data - must fetch (but this should be rare)
        if (isOnline) {
          console.log('🔄 Force refreshing user data from server (no cache available)...');
          const headers = await this.getHeaders();
          const response = await axios.get(`${this.baseURL}/api/auth/me`, { headers, timeout: 5000 });
          
          // Cache the fresh data
          const cacheForSave = await this.getOfflineCache();
          if (cacheForSave && (response.data.data || response.data.user)) {
            try {
              await cacheForSave.saveUserData(response.data.data || response.data.user);
              console.log('✅ Cached fresh user data');
            } catch (cacheError) {
              console.error('Error caching user data:', cacheError);
            }
          }
          
          return { success: true, user: response.data.data || response.data.user };
        }
      }
      
      // Check offline cache (fast - module is cached after first load)
      const cacheForRead = await this.getOfflineCache();
      let cachedData = null;
      if (cacheForRead) {
        try {
          cachedData = await cacheForRead.getUserData();
        } catch (cacheError) {
          // Cache read failed, continue
        }
      }
      
      // If online, always fetch fresh data to ensure locationControlBooster is up-to-date
      if (isOnline) {
        console.log('🌐 Online - fetching fresh user data from server...');
        const headers = await this.getHeaders();
        const response = await axios.get(`${this.baseURL}/api/auth/me`, { headers, timeout: 5000 });
        
        // Cache the fresh data
        const cacheForSave = await this.getOfflineCache();
        if (cacheForSave && (response.data.data || response.data.user)) {
          try {
            await cacheForSave.saveUserData(response.data.data || response.data.user);
            console.log('✅ Cached fresh user data');
          } catch (cacheError) {
            console.error('Error caching user data:', cacheError);
          }
        }
        
        return { success: true, user: response.data.data || response.data.user };
      }
      
      // Offline - use cached data if available
      if (cachedData) {
        console.log('📦 Offline - Using cached user data');
        return { success: true, user: cachedData };
      }
      
      console.log('📴 Offline - no cached user data');
      return {
        success: false,
        message: 'No internet connection and no cached data available',
      };
    } catch (error: any) {
      console.error('Get current user error:', error);
      
      // Try cache as fallback
      const cacheForFallback = await this.getOfflineCache();
      if (cacheForFallback) {
        try {
          const cachedData = await cacheForFallback.getUserData();
          if (cachedData) {
            console.log('📦 Using cached user data as fallback');
            return { success: true, user: cachedData };
          }
        } catch (cacheError) {
          // Cache not available
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get user profile',
      };
    }
  }

  // Quality Agent API methods
  async getNextReviewAssignment(params?: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/survey-responses/next-review`, {
        params,
        headers
      });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Get next review assignment error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get next assignment',
        error: error.response?.data
      };
    }
  }

  async releaseReviewAssignment(responseId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/release-review/${responseId}`,
        {},
        { headers }
      );
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Release review assignment error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to release assignment',
        error: error.response?.data
      };
    }
  }

  async skipReviewAssignment(responseId: string) {
    try {
      if (!responseId) {
        console.error('Skip review assignment error: responseId is missing');
        return {
          success: false,
          message: 'Response ID is required'
        };
      }

      const headers = await this.getHeaders();
      const url = `${this.baseURL}/api/survey-responses/skip-review/${responseId}`;
      console.log('🔍 Skip review assignment - URL:', url);
      console.log('🔍 Skip review assignment - responseId:', responseId);
      
      const response = await axios.post(
        url,
        {},
        { 
          headers,
          timeout: 30000 // 30 second timeout
        }
      );
      return {
        success: true,
        message: response.data.message || 'Response skipped successfully',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('❌ Skip review assignment error:', error);
      console.error('❌ Skip review assignment - URL attempted:', `${this.baseURL}/api/survey-responses/skip-review/${responseId}`);
      console.error('❌ Skip review assignment - Error message:', error.message);
      console.error('❌ Skip review assignment - Error code:', error.code);
      console.error('❌ Skip review assignment - Error response:', error.response?.data);
      console.error('❌ Skip review assignment - Error status:', error.response?.status);
      console.error('❌ Skip review assignment - Full error:', JSON.stringify(error, null, 2));
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to skip assignment',
        error: error.response?.data || { message: error.message, code: error.code }
      };
    }
  }

  async submitVerification(verificationData: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/verify`,
        verificationData,
        { headers }
      );
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Submit verification error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to submit verification',
        error: error.response?.data
      };
    }
  }

  // Get quality agent statistics (lightweight endpoint - optimized for dashboard loading)
  async getQualityAgentStats() {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/survey-responses/quality-agent-stats`, { headers });
      
      if (response.data.success) {
        return { 
          success: true, 
          stats: response.data.data || {}
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to fetch quality agent statistics',
        };
      }
    } catch (error: any) {
      console.error('Get quality agent stats error:', error);
      console.error('Error response:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch quality agent statistics',
        error: error.response?.data
      };
    }
  }

  // Get quality agent analytics (full analytics endpoint - use for detailed analytics only)
  async getQualityAgentAnalytics(params?: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/performance/quality-agent/analytics`, {
        params,
        headers
      });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Get quality agent analytics error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get analytics',
        error: error.response?.data
      };
    }
  }

  // Get CATI call details
  async getCatiCallById(callId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}/api/cati/calls/${callId}`, { headers });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Get CATI call error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get call details',
        error: error.response?.data
      };
    }
  }

  // Get CATI call recording
  async getCatiRecording(callId: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(
        `${this.baseURL}/api/cati/recording/${callId}`,
        {
          headers,
          responseType: 'blob'
        }
      );
      return {
        success: true,
        blob: response.data
      };
    } catch (error: any) {
      // Silently handle 404 errors (recording not available) - this is expected
      if (error.response?.status === 404 || error.status === 404) {
        return {
          success: false,
          message: 'Recording not available',
          error: null
        };
      }
      // Only log unexpected errors
      console.error('Get CATI recording error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get recording',
        error: error.response?.data
      };
    }
  }

  // Get all Assembly Constituencies for a state
  async getAllACsForState(state: string): Promise<any> {
    try {
      // FIRST: Try bundled data (always available, no network needed)
      try {
        const { bundledDataService } = await import('./bundledDataService');
        const bundledResult = await bundledDataService.getAllACsForState(state);
        if (bundledResult.success && bundledResult.data) {
          console.log(`📦 Using bundled ACs for state "${state}": ${bundledResult.data.length} ACs`);
          
          // Also cache it for faster future lookups
          const cacheForSave = await this.getOfflineCache();
          if (cacheForSave && bundledResult.data) {
            try {
              await cacheForSave.saveAllACsForState(state, bundledResult.data);
            } catch (cacheError) {
              // Cache save failed, but that's okay - we have bundled data
            }
          }
          
          return {
            success: true,
            data: {
              state: state,
              acs: bundledResult.data,
              count: bundledResult.data.length
            }
          };
        }
      } catch (bundledError) {
        console.warn('⚠️ Error loading bundled AC data, trying cache/API:', bundledError);
      }
      
      // SECOND: Check if online - if online, fetch fresh from API to ensure we have ALL ACs
      const isOnline = await this.isOnline();
      
      if (isOnline) {
        // Always fetch from API when online to ensure we have complete, up-to-date data
        console.log('🌐 Online - fetching all ACs for state from API:', state);
        const headers = await this.getHeaders();
        const url = `${this.baseURL}/api/master-data/acs/${encodeURIComponent(state)}`;
        const response = await axios.get(url, { headers });
        
        // Cache the complete data
        const cacheForSave = await this.getOfflineCache();
        if (cacheForSave && response.data.success && response.data.data) {
          try {
            const acsToCache = response.data.data.acs || [];
            await cacheForSave.saveAllACsForState(state, acsToCache);
            console.log('✅ Cached', acsToCache.length, 'ACs for state:', state, '(complete master data)');
          } catch (cacheError) {
            console.error('⚠️ Cache save failed:', cacheError);
            // Continue - cache save failure is not critical
          }
        }
        
        return response.data;
      }
      
      // Offline mode - check cache
      const cacheForRead = await this.getOfflineCache();
      if (cacheForRead) {
        try {
          // First, try to get validated cache (with completeness check)
          const cachedACs = await cacheForRead.getAllACsForState(state);
          const minExpectedACs = state === 'West Bengal' ? 200 : 50;
          
          console.log('📴 Offline mode - checking cache for state:', state);
          console.log('📴 Cached ACs count:', cachedACs?.length || 0);
          
          if (cachedACs && cachedACs.length >= minExpectedACs) {
            console.log('✅ Offline cache validated - returning', cachedACs.length, 'ACs');
            return {
              success: true,
              data: {
                state: state,
                acs: cachedACs,
                count: cachedACs.length
              }
            };
          } else if (cachedACs && cachedACs.length > 0) {
            // Cache exists but has too few ACs - likely contaminated/incomplete
            console.warn('⚠️ Cached ACs for state', state, 'has only', cachedACs.length, 'ACs (expected at least', minExpectedACs, ')');
            console.warn('⚠️ This cache appears incomplete/contaminated');
            
            // CRITICAL: Try to read raw cache data directly (bypass validation) to see what's actually stored
            try {
              const rawCacheData = await cacheForRead.getAllACsForAllStates();
              const rawStateData = rawCacheData[state];
              if (rawStateData && rawStateData.acs && rawStateData.acs.length > 0) {
                console.log('🔍 Raw cache has', rawStateData.acs.length, 'ACs for state:', state);
                console.log('🔍 Sample ACs from raw cache:', rawStateData.acs.slice(0, 5).map((ac: any) => ac.acName || ac));
                
                // If raw cache has more ACs than validated cache, there's a validation issue
                if (rawStateData.acs.length !== cachedACs.length) {
                  console.error('❌ Cache validation mismatch: raw cache has', rawStateData.acs.length, 'but validated returned', cachedACs.length);
                }
              }
            } catch (rawError) {
              console.error('❌ Error reading raw cache:', rawError);
            }
            
            // Clear the contaminated cache
            await cacheForRead.clearACsForState(state);
            return {
              success: false,
              message: `Cached AC list is incomplete (${cachedACs.length} ACs found, expected at least ${minExpectedACs}). Please sync survey details when online to cache complete data.`,
              error: 'OFFLINE_INCOMPLETE_CACHE'
            };
          } else {
            console.warn('⚠️ No cached ACs found for state:', state);
            return {
              success: false,
              message: 'No internet connection and no cached data available. Please sync survey details when online to cache all ACs.',
              error: 'OFFLINE_NO_CACHE'
            };
          }
        } catch (cacheError) {
          console.error('❌ Cache read error:', cacheError);
          return {
            success: false,
            message: 'Error reading cached AC data. Please sync survey details when online.',
            error: 'OFFLINE_CACHE_ERROR'
          };
        }
      } else {
        console.log('📴 Offline cache service not available');
        return {
          success: false,
          message: 'No internet connection and no valid cached data available. Please sync survey details when online to cache all ACs.',
          error: 'OFFLINE_NO_CACHE'
        };
      }
    } catch (error: any) {
      console.error('Error fetching all ACs for state:', error);
      throw error;
    }
  }

  // Get MP and MLA names for an AC
  async getACData(acName: string) {
    try {
      // Normalize AC name to match master data spelling
      const normalizedAC = this.normalizeACName(acName);
      
      // Check offline cache first (lazy import) - try normalized name first
      const cacheForRead = await this.getOfflineCache();
      let cachedData = null;
      if (cacheForRead) {
        try {
          cachedData = await cacheForRead.getACData(normalizedAC);
          // If not found, try original name
          if (!cachedData) {
            cachedData = await cacheForRead.getACData(acName);
          }
        } catch (cacheError) {
          // Cache read failed, continue
        }
      }
      if (cachedData) {
        console.log('📦 Using cached AC data for:', normalizedAC);
        return { success: true, data: cachedData };
      }

      // Check if online
      const isOnline = await this.isOnline();
      if (!isOnline) {
        console.log('📴 Offline - no cached AC data for:', normalizedAC);
        return {
          success: false,
          message: 'No internet connection and no cached data available',
          error: 'OFFLINE_NO_CACHE'
        };
      }

      // Fetch from API using normalized AC name
      const headers = await this.getHeaders();
      let response;
      try {
        response = await axios.get(
          `${this.baseURL}/api/master-data/ac/${encodeURIComponent(normalizedAC)}`,
          { headers }
        );
      } catch (firstError: any) {
        // If normalized name fails, try original name as fallback
        if (normalizedAC !== acName && firstError.response?.status === 404) {
          console.log(`⚠️ Normalized AC "${normalizedAC}" not found, trying original "${acName}"`);
          response = await axios.get(
        `${this.baseURL}/api/master-data/ac/${encodeURIComponent(acName)}`,
        { headers }
      );
        } else {
          throw firstError;
        }
      }
      
      // Cache the data using normalized name
      const cacheForSave = await this.getOfflineCache();
      if (cacheForSave && response.data.data) {
        try {
          await cacheForSave.saveACData(normalizedAC, response.data.data);
        } catch (cacheError) {
          // Cache save failed, continue
        }
      }
      
      return { success: true, data: response.data.data };
    } catch (error: any) {
      console.error('Get AC data error:', error);
      console.error('AC Name used:', acName);
      
      // Try cache as fallback
      const cacheForFallback = await this.getOfflineCache();
      if (cacheForFallback) {
        try {
          const normalizedAC = this.normalizeACName(acName);
          let cachedData = await cacheForFallback.getACData(normalizedAC);
          if (!cachedData) {
            cachedData = await cacheForFallback.getACData(acName);
          }
          if (cachedData) {
            console.log('📦 Using cached AC data as fallback for:', normalizedAC);
            return { success: true, data: cachedData };
          }
        } catch (cacheError) {
          // Cache not available
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get AC data',
        error: error.response?.data
      };
    }
  }

  /**
   * Send app logs to backend
   */
  async sendAppLogs(data: {
    logs: Array<{
      level: string;
      message: string;
      timestamp: string;
      category: string;
      metadata?: any;
      stackTrace?: string;
    }>;
    deviceInfo: any;
    userId?: string | null;
    appVersion: string;
  }): Promise<{ success: boolean }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/app-logs`,
        data,
        { headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error sending app logs:', error);
      throw error;
    }
  }

  /**
   * Report offline interview status to backend
   */
  async reportOfflineInterviewStatus(data: {
    interviews: Array<{
      interviewId: string;
      sessionId?: string;
      surveyId: string;
      status: string;
      syncAttempts: number;
      lastSyncAttempt?: string;
      error?: string;
      metadata: any;
    }>;
    deviceId: string;
  }): Promise<{ success: boolean; reported: number }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseURL}/api/survey-responses/offline-interviews/report`,
        data,
        { headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error reporting offline interview status:', error);
      throw error;
    }
  }

  // ============================================
  // APP UPDATE API METHODS
  // ============================================
  
  /**
   * Check for app updates from server
   * @param currentVersionCode Current app version code
   * @returns Update information
   */
  async checkAppUpdate(currentVersionCode: number): Promise<{
    success: boolean;
    hasUpdate?: boolean;
    latestVersion?: string;
    latestVersionCode?: number;
    downloadUrl?: string;
    fileSize?: number;
    fileHash?: string;
    releaseNotes?: string;
    isForceUpdate?: boolean;
    minRequiredVersion?: string;
    error?: string;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/app/check-update`, {
        params: {
          versionCode: currentVersionCode
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.success) {
        return {
          success: true,
          hasUpdate: response.data.hasUpdate || false,
          latestVersion: response.data.latestVersion,
          latestVersionCode: response.data.latestVersionCode,
          downloadUrl: response.data.downloadUrl,
          fileSize: response.data.fileSize,
          fileHash: response.data.fileHash,
          releaseNotes: response.data.releaseNotes,
          isForceUpdate: response.data.isForceUpdate || false,
          minRequiredVersion: response.data.minRequiredVersion
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Failed to check for updates'
        };
      }
    } catch (error: any) {
      console.error('❌ Error checking app update:', error);
      return {
        success: false,
        error: error.message || 'Network error while checking for updates'
      };
    }
  }
}

export const apiService = new ApiService();
