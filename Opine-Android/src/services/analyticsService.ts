/**
 * Analytics Service using Google Analytics 4 (GA4) Measurement Protocol
 * 
 * This service provides comprehensive analytics tracking for the app.
 * All data is sent to Google Analytics cloud (separate from backend).
 * Uses Measurement Protocol API for React Native compatibility (no Firebase SDK needed).
 * 
 * Setup Instructions:
 * 1. Go to https://analytics.google.com
 * 2. Create a new GA4 property (or use existing)
 * 3. Go to Admin > Data Streams > Web (or create new stream)
 * 4. Get your Measurement ID (looks like: G-XXXXXXXXXX)
 * 5. Get your API Secret: Admin > Data Streams > [Your Stream] > Measurement Protocol API secrets > Create
 * 6. Replace GA4_MEASUREMENT_ID and GA4_API_SECRET below with your values
 * 
 * Free Tier: Unlimited events (Google Analytics is free)
 * 
 * Why Google Analytics?
 * - ✅ Free and unlimited
 * - ✅ Industry standard (used by millions of apps)
 * - ✅ Reliable and professional
 * - ✅ Easy to set up (you already have account)
 * - ✅ Powerful dashboard and reporting
 */

import Constants from 'expo-constants';

// Get Google Analytics 4 credentials from environment variables
// Set these in app.json > extra or .env file (see GOOGLE_ANALYTICS_SETUP.md)
// Priority: .env > app.json extra
const GA4_MEASUREMENT_ID = process.env.EXPO_PUBLIC_GA4_MEASUREMENT_ID || Constants.expoConfig?.extra?.ga4MeasurementId || 'YOUR_GA4_MEASUREMENT_ID_HERE';
const GA4_API_SECRET = process.env.EXPO_PUBLIC_GA4_API_SECRET || Constants.expoConfig?.extra?.ga4ApiSecret || 'YOUR_GA4_API_SECRET_HERE';

// Generate unique device ID (persistent across app sessions)
// Simple UUID v4 generator (no external dependencies needed)
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const getDeviceId = async (): Promise<string> => {
  try {
    const { AsyncStorage } = await import('@react-native-async-storage/async-storage');
    let deviceId = await AsyncStorage.getItem('analytics_device_id');
    if (!deviceId) {
      deviceId = generateUUID();
      await AsyncStorage.setItem('analytics_device_id', deviceId);
    }
    return deviceId;
  } catch (error) {
    // Fallback to random UUID if AsyncStorage fails
    return generateUUID();
  }
};

class AnalyticsService {
  private isInitialized: boolean = false;
  private userId: string | null = null;
  private deviceId: string | null = null;
  private eventQueue: Array<{ name: string; params: any }> = [];
  private flushInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize Google Analytics 4
   * Call this once when app starts (in App.tsx)
   */
  async initialize(): Promise<void> {
    try {
      // Check if credentials are configured (from app.json extra or .env)
      const measurementId = GA4_MEASUREMENT_ID;
      const apiSecret = GA4_API_SECRET;
      
      if (!measurementId || !apiSecret || 
          measurementId === 'YOUR_GA4_MEASUREMENT_ID_HERE' || 
          apiSecret === 'YOUR_GA4_API_SECRET_HERE') {
        console.warn('⚠️ Google Analytics credentials not configured. Analytics disabled.');
        console.warn('⚠️ Set EXPO_PUBLIC_GA4_MEASUREMENT_ID and EXPO_PUBLIC_GA4_API_SECRET in .env or app.json extra');
        return;
      }

      this.deviceId = await getDeviceId();
      this.isInitialized = true;
      
      // Start periodic flush (send events every 60 seconds)
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 60000);
      
      console.log('✅ Analytics (Google Analytics 4) initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Analytics:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Identify a user (call after login)
   */
  async identify(userId: string, userProperties?: Record<string, any>): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.userId = userId;

      // Send user properties to GA4
      if (userProperties) {
        await this.sendEvent('user_properties', {
          user_id: userId,
          ...userProperties,
        });
      }

      console.log(`📊 Analytics: User identified - ${userId}`);
    } catch (error) {
      console.error('❌ Analytics identify error:', error);
    }
  }

  /**
   * Send event to Google Analytics 4 (internal method)
   */
  private async sendEvent(eventName: string, params: Record<string, any>): Promise<void> {
    if (!this.isInitialized || GA4_MEASUREMENT_ID === 'YOUR_GA4_MEASUREMENT_ID_HERE') return;

    try {
      const eventData = {
        name: eventName,
        params: {
          ...params,
          // GA4 standard parameters
          engagement_time_msec: 100, // Default engagement time
        },
      };

      // Add to queue for batch sending
      this.eventQueue.push(eventData);

      // Send immediately if queue is getting large (prevent memory issues)
      if (this.eventQueue.length >= 20) {
        await this.flush();
      }
    } catch (error) {
      console.error('❌ Analytics sendEvent error:', error);
    }
  }

  /**
   * Track an event
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.isInitialized) return;

    try {
      const eventParams = {
        ...properties,
      };
      
      this.sendEvent(eventName, eventParams).catch(err => {
        console.error('❌ Analytics track error:', err);
      });
      
      if (__DEV__) {
        console.log(`📊 Analytics: Tracked event - ${eventName}`, eventParams);
      }
    } catch (error) {
      console.error('❌ Analytics track error:', error);
    }
  }

  /**
   * Track screen view
   */
  trackScreenView(screenName: string, properties?: Record<string, any>): void {
    this.track('screen_view', {
      screen_name: screenName,
      ...properties,
    });
  }

  /**
   * Track user login
   */
  trackLogin(userId: string, userType: string, properties?: Record<string, any>): void {
    this.identify(userId, {
      user_type: userType,
      last_login: new Date().toISOString(),
      ...properties,
    });
    
    this.track('login', {
      method: 'app',
      user_type: userType,
      ...properties,
    });
  }

  /**
   * Track user logout
   */
  trackLogout(): void {
    this.track('logout');
    this.userId = null;
    this.reset();
  }

  /**
   * Track app open
   */
  trackAppOpen(): void {
    this.track('app_open', {
      timestamp: new Date().toISOString(),
    });
    
    // Flush immediately for app open (important event)
    setTimeout(() => {
      this.flush().catch(err => {
        console.error('❌ Analytics flush error on app open:', err);
      });
    }, 2000); // Wait 2 seconds for initialization
  }

  /**
   * Track interview started
   */
  trackInterviewStarted(surveyId: string, interviewMode: string, properties?: Record<string, any>): void {
    this.track('interview_started', {
      survey_id: surveyId,
      interview_mode: interviewMode,
      ...properties,
    });
  }

  /**
   * Track interview completed
   */
  trackInterviewCompleted(surveyId: string, interviewMode: string, duration: number, properties?: Record<string, any>): void {
    this.track('interview_completed', {
      survey_id: surveyId,
      interview_mode: interviewMode,
      duration_seconds: duration,
      ...properties,
    });
  }

  /**
   * Track interview abandoned
   */
  trackInterviewAbandoned(surveyId: string, reason: string, properties?: Record<string, any>): void {
    this.track('interview_abandoned', {
      survey_id: surveyId,
      abandon_reason: reason,
      ...properties,
    });
  }

  /**
   * Track sync started
   */
  trackSyncStarted(interviewCount: number): void {
    this.track('sync_started', {
      interview_count: interviewCount,
    });
  }

  /**
   * Track sync completed
   */
  trackSyncCompleted(syncedCount: number, failedCount: number): void {
    this.track('sync_completed', {
      synced_count: syncedCount,
      failed_count: failedCount,
      success_rate: syncedCount / (syncedCount + failedCount) || 0,
    });
  }

  /**
   * Track error
   */
  trackError(errorType: string, errorMessage: string, properties?: Record<string, any>): void {
    this.track('error_occurred', {
      error_type: errorType,
      error_message: errorMessage,
      ...properties,
    });
  }

  /**
   * Track API call
   */
  trackAPICall(endpoint: string, method: string, statusCode: number, duration: number): void {
    this.track('api_call', {
      endpoint,
      method,
      status_code: statusCode,
      duration_ms: duration,
      success: statusCode >= 200 && statusCode < 400,
    });
  }

  /**
   * Set user properties (update user profile)
   */
  async setUserProperties(properties: Record<string, any>): Promise<void> {
    if (!this.isInitialized || !this.userId) return;

    try {
      await this.sendEvent('user_properties', {
        user_id: this.userId,
        ...properties,
      });
    } catch (error) {
      console.error('❌ Analytics setUserProperties error:', error);
    }
  }

  /**
   * Increment a user property (e.g., total interviews completed)
   */
  async incrementUserProperty(property: string, value: number = 1): Promise<void> {
    if (!this.isInitialized || !this.userId) return;

    try {
      // GA4 doesn't have direct increment, so we track it as an event
      await this.sendEvent('user_property_increment', {
        user_id: this.userId,
        property_name: property,
        increment_value: value,
      });
    } catch (error) {
      console.error('❌ Analytics incrementUserProperty error:', error);
    }
  }

  /**
   * Reset (call on logout)
   */
  reset(): void {
    if (!this.isInitialized) return;

    try {
      this.userId = null;
      console.log('📊 Analytics: Reset user session');
    } catch (error) {
      console.error('❌ Analytics reset error:', error);
    }
  }

  /**
   * Flush events (send immediately to Google Analytics)
   */
  async flush(): Promise<void> {
    if (!this.isInitialized || this.eventQueue.length === 0) return;

    let events: Array<{ name: string; params: any }> = [];
    
    try {
      events = [...this.eventQueue];
      this.eventQueue = [];

      if (events.length === 0) return;

      // GA4 Measurement Protocol - send events one by one (GA4 doesn't support true batching)
      // But we can send them in parallel for efficiency
      const promises = events.map(event => {
        const payload = {
          client_id: this.deviceId || 'unknown',
          user_id: this.userId || undefined,
          events: [{
            name: event.name,
            params: event.params,
          }],
        };

        // Build API URL dynamically with current credentials
        const measurementId = GA4_MEASUREMENT_ID;
        const apiSecret = GA4_API_SECRET;
        
        if (!measurementId || !apiSecret || 
            measurementId === 'YOUR_GA4_MEASUREMENT_ID_HERE' || 
            apiSecret === 'YOUR_GA4_API_SECRET_HERE') {
          console.warn('⚠️ GA4 credentials not configured, skipping event');
          return Promise.reject(new Error('GA4 credentials not configured'));
        }
        
        const apiUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
        
        if (__DEV__) {
          console.log(`📤 Sending GA4 event: ${event.name}`, {
            url: apiUrl.replace(apiSecret, '***'),
            eventName: event.name,
            clientId: payload.client_id,
          });
        }
        
        return fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      });

      const results = await Promise.allSettled(promises);
      
      // Check if any failed
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
      
      if (failed.length > 0) {
        console.warn(`⚠️ Analytics flush: ${failed.length} of ${events.length} events failed`);
        
        // Log detailed error information
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`❌ Event ${index} failed:`, result.reason);
          } else if (!result.value.ok) {
            result.value.text().then(text => {
              console.error(`❌ Event ${index} HTTP error:`, result.value.status, text);
            }).catch(() => {
              console.error(`❌ Event ${index} HTTP error:`, result.value.status);
            });
          }
        });
        
        // Re-add failed events to queue for retry (simplified - re-add all if any fail)
        this.eventQueue.unshift(...events);
      } else {
        console.log(`✅ Analytics: Successfully flushed ${events.length} events to Google Analytics`);
        
        // Log success details in dev mode
        if (__DEV__) {
          events.forEach(event => {
            console.log(`  ✓ Sent: ${event.name}`);
          });
        }
      }
    } catch (error) {
      console.error('❌ Analytics flush error:', error);
      // Re-add events to queue for retry
      if (events.length > 0) {
        this.eventQueue.unshift(...events);
      }
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
