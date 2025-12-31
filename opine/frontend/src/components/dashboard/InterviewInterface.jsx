import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  X, 
  CheckCircle, 
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Menu,
  Phone
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { surveyResponseAPI, catiInterviewAPI, pollingStationAPI, authAPI, masterDataAPI } from '../../services/api';
import { getApiUrl, getApiBaseUrl } from '../../utils/config';
import { parseTranslation, renderWithTranslation, getMainText, parseMultiTranslation, getLanguageText } from '../../utils/translations';
import { isGenderQuestion, normalizeGenderResponse, isAgeQuestion } from '../../utils/genderUtils';

// Helper function to get party logo path based on option text
// Also checks if logos should be shown for the current question
const getPartyLogo = (optionText, questionText) => {
  if (!optionText) return null;
  
  // Check if this is Question 12 - "In your opinion what could be the reasons for voting for BJP"
  // Don't show logos for this question
  if (questionText) {
    const qText = String(questionText).toLowerCase();
    if (qText.includes('in your opinion what could be the reason') && qText.includes('voting') && qText.includes('bjp') ||
        qText.includes('in your opinion what could be the reasons') && qText.includes('voting') && qText.includes('bjp') ||
        qText.includes('reason for voting bjp') ||
        qText.includes('reasons for voting bjp') ||
        qText.includes('reason for voting for bjp') ||
        qText.includes('reasons for voting for bjp') ||
        (qText.includes('reason for voting') && qText.includes('bjp')) ||
        (qText.includes('reasons for voting') && qText.includes('bjp')) ||
        (qText.includes('বিজেপিকে ভোট') && qText.includes('কারণ'))) {
      return null;
    }
  }
  
  const text = String(optionText).toLowerCase();
  const mainText = getMainText(optionText).toLowerCase();
  
  // Use relative paths starting with / so it works on any domain
  // Check for AITC (Trinamool Congress) - check for "aitc", "trinamool", or "tmc"
  if (text.includes('aitc') || text.includes('trinamool') || text.includes('tmc') ||
      mainText.includes('aitc') || mainText.includes('trinamool') || mainText.includes('tmc')) {
    return `/api/party-logos/AITC_New_Logo.png`;
  }
  
  // Check for BJP
  if (text.includes('bjp') || mainText.includes('bjp')) {
    return `/api/party-logos/Logo_of_the_Bharatiya_Janata_Party.svg.webp`;
  }
  
  // Check for INC/Congress - check for "inc" or "congress" but not "princ" or other words containing "inc"
  if ((text.includes('inc') && !text.includes('princ') && !text.includes('since')) || text.includes('congress') || 
      (mainText.includes('inc') && !mainText.includes('princ') && !mainText.includes('since')) || mainText.includes('congress')) {
    return `/api/party-logos/INC_Logo.png`;
  }
  
  // Check for Left Front
  if (text.includes('left front') || text.includes('left_front') || mainText.includes('left front') || mainText.includes('left_front')) {
    return `/api/party-logos/CPIMAX_1024x1024.webp`;
  }
  
  return null;
};

const InterviewInterface = ({ survey, onClose, onComplete }) => {
  const { showSuccess, showError } = useToast();
  
  // Core state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [validationErrors, setValidationErrors] = useState(new Set());
  const [targetAudienceErrors, setTargetAudienceErrors] = useState(new Map());
  const [genderQuotas, setGenderQuotas] = useState(null);
  const [shuffledOptions, setShuffledOptions] = useState({}); // Store shuffled options per questionId to maintain consistent order
  const [othersTextInputs, setOthersTextInputs] = useState({}); // Store "Others" text input values by questionId_optionValue
  const [selectedLanguageIndex, setSelectedLanguageIndex] = useState(0);
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [audioSupported, setAudioSupported] = useState(false);
  
  // Timer state
  const [totalTime, setTotalTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const timerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const responsesRef = useRef(responses);
  const allQuestionsRef = useRef([]);
  const lastFetchedACRef = useRef(null); // Track last AC we fetched MP/MLA for
  
  // Session state
  const [sessionData, setSessionData] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  
  // AC Selection state
  const [selectedAC, setSelectedAC] = useState('');
  const [hasByeElection, setHasByeElection] = useState(false); // Track if selected AC has bye-election
  
  // Polling Station Selection state
  const [selectedPollingStation, setSelectedPollingStation] = useState({
    state: null,
    acName: null,
    acNo: null,
    pcNo: null,
    pcName: null,
    district: null,
    roundNumber: null,
    groupName: null,
    stationName: null,
    gpsLocation: null,
    latitude: null,
    longitude: null
  });
  const [availableRoundNumbers, setAvailableRoundNumbers] = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [availablePollingStations, setAvailablePollingStations] = useState([]);
  const [loadingRoundNumbers, setLoadingRoundNumbers] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);
  
  // Location state
  const [gpsLocation, setGpsLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationError, setLocationError] = useState(null);
  
  // Geo-fencing state
  const [locationControlBooster, setLocationControlBooster] = useState(false);
  const [geofencingError, setGeofencingError] = useState(null);
  
  // Permission modal state
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionType, setPermissionType] = useState(null); // 'location' or 'audio'
  const [permissionError, setPermissionError] = useState(null);
  
  // Set number for CATI interviews (to alternate sets) - moved here to avoid initialization error

  // CATI-specific state
  const isCatiMode = survey.mode === 'cati' || survey.assignedMode === 'cati';
  const [selectedSetNumber, setSelectedSetNumber] = useState(null); // Set number for CATI interviews (to alternate sets)
  const [catiRespondent, setCatiRespondent] = useState(null);
  const [catiQueueId, setCatiQueueId] = useState(null);
  const [callStatus, setCallStatus] = useState(null); // 'idle', 'calling', 'connected', 'failed'
  const [callId, setCallId] = useState(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const [abandonNotes, setAbandonNotes] = useState('');
  const [callLaterDate, setCallLaterDate] = useState('');
  
  // Interviewer name for consent form
  const [interviewerFirstName, setInterviewerFirstName] = useState('');
  
  // MP/MLA names for survey "692fe24faf8e2f42139f5a49"
  const [mpName, setMpName] = useState(null);
  const [mlaName, setMlaName] = useState(null);
  const [isLoadingMPMLA, setIsLoadingMPMLA] = useState(false);


  // Comprehensive location detection with WiFi triangulation and multiple fallbacks
  const getCurrentLocation = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      console.log('🎯 Starting comprehensive location detection...');
      console.log('🌐 Current URL:', window.location.href);
      console.log('🔒 Is secure context:', window.isSecureContext);
      console.log('📍 Geolocation available:', !!navigator.geolocation);

      // Strategy 1: Try WiFi triangulation (most accurate for laptops)
      try {
        console.log('🎯 Strategy 1: WiFi Triangulation...');
        const wifiLocation = await getLocationFromWiFi();
        if (wifiLocation) {
          console.log('✅ WiFi location obtained:', wifiLocation);
          resolve(wifiLocation);
          return;
        }
      } catch (error) {
        console.warn('❌ WiFi triangulation failed:', error.message);
      }

      // Strategy 2: Try browser geolocation with network location
      if (navigator.geolocation) {
        try {
          console.log('🎯 Strategy 2: Browser Geolocation (Network + GPS)...');
          const browserLocation = await getLocationFromBrowser();
          if (browserLocation) {
            console.log('✅ Browser location obtained:', browserLocation);
            resolve(browserLocation);
            return;
          }
        } catch (error) {
          console.warn('❌ Browser geolocation failed:', error.message);
        }
      }

      // Strategy 3: Try Google Maps Geolocation API
      try {
        console.log('🎯 Strategy 3: Google Maps Geolocation...');
        const googleLocation = await getLocationFromGoogleMaps();
        if (googleLocation) {
          console.log('✅ Google Maps location obtained:', googleLocation);
          resolve(googleLocation);
          return;
        }
      } catch (error) {
        console.warn('❌ Google Maps geolocation failed:', error.message);
      }

      // Strategy 4: Try manual location selection as last resort
      console.log('🎯 Strategy 4: Manual Location Selection...');
      const manualLocation = await getLocationFromManualSelection();
      if (manualLocation) {
        console.log('✅ Manual location obtained:', manualLocation);
        resolve(manualLocation);
        return;
      }

      // All strategies failed
      console.error('❌ All location detection methods failed');
      const errorMessage = 'Unable to determine your location. Please try enabling location services or select your location manually.';
      
      setLocationError(errorMessage);
      setShowPermissionModal(true);
      setPermissionType('location');
      setPermissionError(`
        <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 class="font-semibold text-red-800 mb-2">🔧 Location Detection Failed</h4>
          <div class="text-sm text-red-700 space-y-2">
            <p><strong>All location detection methods failed. Please try:</strong></p>
            <ol class="ml-4 space-y-1">
              <li>1. Enable location services in your browser</li>
              <li>2. Allow location access when prompted</li>
              <li>3. Try a different browser (Safari works better on macOS)</li>
              <li>4. Ensure you're using HTTPS</li>
              <li>5. Try from a different location with better network coverage</li>
            </ol>
          </div>
        </div>
      `);
      
      reject(new Error(errorMessage));
    });
  }, []);

  // WiFi triangulation using browser's network location
  const getLocationFromWiFi = async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // Use network location (WiFi triangulation) - most accurate for laptops
      const options = {
        enableHighAccuracy: false, // Use network location instead of GPS
        timeout: 15000,
        maximumAge: 300000 // 5 minutes cache
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude, accuracy } = position.coords;
            
            // Get address from coordinates
            const address = await reverseGeocode(latitude, longitude);
            
            const locationData = {
              latitude,
              longitude,
              accuracy,
              address: address.address,
              city: address.city,
              state: address.state,
              country: address.country,
              timestamp: new Date(),
              source: 'wifi_triangulation'
            };
            
            resolve(locationData);
          } catch (error) {
            // Still resolve with coordinates even if address fails
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: new Date(),
              source: 'wifi_triangulation'
            });
          }
        },
        (error) => {
          reject(new Error(`WiFi triangulation failed: ${error.message}`));
        },
        options
      );
    });
  };

  // Browser geolocation with multiple strategies
  const getLocationFromBrowser = async () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // Try high accuracy first, then fallback to network location
      const highAccuracyOptions = {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      };

      const networkOptions = {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
      };

      const tryLocation = (options, strategyName) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude, accuracy } = position.coords;
              const address = await reverseGeocode(latitude, longitude);
              
              resolve({
                latitude,
                longitude,
                accuracy,
                address: address.address,
                city: address.city,
                state: address.state,
                country: address.country,
                timestamp: new Date(),
                source: `browser_${strategyName}`
              });
            } catch (error) {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(),
                source: `browser_${strategyName}`
              });
            }
          },
          (error) => {
            if (options.enableHighAccuracy) {
              // Try network location as fallback
              tryLocation(networkOptions, 'network');
            } else {
              reject(new Error(`Browser geolocation failed: ${error.message}`));
            }
          },
          options
        );
      };

      tryLocation(highAccuracyOptions, 'gps');
    });
  };

  // Google Maps Geolocation API
  const getLocationFromGoogleMaps = async () => {
    try {
      // Load Google Maps API
      await loadGoogleMapsAPI();
      
      return new Promise((resolve, reject) => {
        if (!window.google || !window.google.maps) {
          reject(new Error('Google Maps API not available'));
          return;
        }

        // Use Google Maps Geolocation
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude, accuracy } = position.coords;
              const address = await reverseGeocode(latitude, longitude);
              
              resolve({
                latitude,
                longitude,
                accuracy,
                address: address.address,
                city: address.city,
                state: address.state,
                country: address.country,
                timestamp: new Date(),
                source: 'google_maps'
              });
            } catch (error) {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(),
                source: 'google_maps'
              });
            }
          },
          (error) => {
            reject(new Error(`Google Maps geolocation failed: ${error.message}`));
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
          }
        );
      });
    } catch (error) {
      throw new Error(`Google Maps API failed: ${error.message}`);
    }
  };

  // Manual location selection
  const getLocationFromManualSelection = async () => {
    return new Promise((resolve) => {
      // Show manual location picker modal
      setShowPermissionModal(true);
      setPermissionType('location');
      setPermissionError(`
        <div class="mt-4 p-4 bg-[#E6F0F8] border border-blue-200 rounded-lg">
          <h4 class="font-semibold text-[#001D48] mb-2">📍 Manual Location Selection</h4>
          <div class="text-sm text-blue-700 space-y-2">
            <p>Since automatic location detection failed, please:</p>
            <ol class="ml-4 space-y-1">
              <li>1. Click "Allow Location Access" to try again</li>
              <li>2. Or manually enter your location details</li>
              <li>3. Ensure you're in a location with good network coverage</li>
            </ol>
          </div>
        </div>
      `);
      
      // For now, return null - user will need to retry
      resolve(null);
    });
  };

  // Load Google Maps API
  const loadGoogleMapsAPI = async () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve(window.google);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        if (window.google && window.google.maps) {
          resolve(window.google);
        } else {
          reject(new Error('Google Maps API failed to load'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Google Maps API'));
      };
      
      document.head.appendChild(script);
    });
  };

  // Reverse geocoding function using free Nominatim API
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ConvergentIndia-SurveyApp/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }
      
      const data = await response.json();
      
      return {
        address: data.display_name || 'Unknown Address',
        city: data.address?.city || data.address?.town || data.address?.village || 'Unknown City',
        state: data.address?.state || 'Unknown State',
        country: data.address?.country || 'Unknown Country'
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        address: 'Address not available',
        city: 'Unknown City',
        state: 'Unknown State',
        country: 'Unknown Country'
      };
    }
  };

  // Fetch gender quotas from backend
  const fetchGenderQuotas = useCallback(async () => {
    try {
      const response = await surveyResponseAPI.getGenderResponseCounts(survey._id);
      if (response.success) {
        setGenderQuotas(response.data.genderQuotas);
      }
    } catch (error) {
      console.error('Error fetching gender quotas:', error);
    }
  }, [survey._id]);

  // Check audio support when component mounts
  useEffect(() => {
    const checkAudioSupport = () => {
      const isSupported = !!(
        navigator.mediaDevices && 
        navigator.mediaDevices.getUserMedia && 
        window.MediaRecorder
      );
      
      
      setAudioSupported(isSupported);
    };
    
    checkAudioSupport();
  }, []);

  // Fetch gender quotas when component mounts
  useEffect(() => {
    if (survey._id) {
      fetchGenderQuotas();
    }
  }, [survey._id, fetchGenderQuotas]);

  // Fetch interviewer's first name for consent form
  useEffect(() => {
    const fetchInterviewerName = async () => {
      try {
        const response = await authAPI.getMe();
        const user = response.data || response.user || response;
        if (user && user.firstName) {
          setInterviewerFirstName(user.firstName);
        }
      } catch (error) {
        console.error('Error fetching interviewer name:', error);
        // Set default if fetch fails
        setInterviewerFirstName('Interviewer');
      }
    };
    
    fetchInterviewerName();
  }, []);

  // Memoize AC from sessionData to avoid unnecessary re-renders
  const acFromSessionData = useMemo(() => {
    if (!isCatiMode || !sessionData) return null;
    // Check respondentContact first (if it exists)
    if (sessionData.respondentContact) {
      const contact = sessionData.respondentContact;
      return contact.assemblyConstituency || contact.ac || contact.assemblyConstituencyName || contact.acName;
    }
    // Fallback to respondent.ac (which is how CATI response is structured)
    if (sessionData.respondent && sessionData.respondent.ac) {
      return sessionData.respondent.ac;
    }
    return null;
  }, [isCatiMode, sessionData?.respondentContact?.assemblyConstituency, sessionData?.respondentContact?.ac, sessionData?.respondentContact?.assemblyConstituencyName, sessionData?.respondentContact?.acName, sessionData?.respondent?.ac]);

  // Fetch MP/MLA names when AC is selected (for any survey with questions 16.a and 16.b)
  useEffect(() => {
    const fetchMPMLANames = async () => {
      // Get selected AC from state (selectedAC is updated when AC selection question is answered)
      let acToUse = selectedAC || acFromSessionData;
      
      if (!acToUse) {
        // Clear data if AC is removed
        if (lastFetchedACRef.current !== null) {
          setMpName(null);
          setMlaName(null);
          lastFetchedACRef.current = null;
        }
        return;
      }
      
      // Prevent duplicate fetches for the same AC
      if (lastFetchedACRef.current === acToUse) {
        return;
      }
      
      // Prevent fetching if already loading
      if (isLoadingMPMLA) {
        return;
      }
      
      lastFetchedACRef.current = acToUse; // Mark as fetching/fetched
      
      try {
        setIsLoadingMPMLA(true);
        const result = await masterDataAPI.getACData(acToUse);
        if (result.success && result.data) {
          setMpName(result.data.mpName);
          setMlaName(result.data.mlaName);
        } else {
          setMpName(null);
          setMlaName(null);
        }
      } catch (error) {
        console.error('Error fetching MP/MLA names:', error);
        setMpName(null);
        setMlaName(null);
      } finally {
        setIsLoadingMPMLA(false);
      }
    };
    
    fetchMPMLANames();
  }, [selectedAC, acFromSessionData]); // Only fetch when AC actually changes

  // Fetch bye-election status when AC is available (for both CAPI and CATI)
  useEffect(() => {
    const fetchByeElectionStatus = async () => {
      const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
      if (!isTargetSurvey) {
        setHasByeElection(false);
        return;
      }
      
      // Get AC from selectedAC or sessionData (for CATI)
      const acToCheck = selectedAC || acFromSessionData;
      if (!acToCheck) {
        setHasByeElection(false);
        return;
      }
      
      try {
        const result = await masterDataAPI.getACData(acToCheck);
        if (result.success && result.data) {
          setHasByeElection(result.data.hasByeElection || false);
        } else {
          setHasByeElection(false);
        }
      } catch (error) {
        console.error('Error fetching AC bye-election status:', error);
        setHasByeElection(false);
      }
    };
    
    fetchByeElectionStatus();
  }, [selectedAC, acFromSessionData, survey]);


  // Fetch set number for CATI interviews (to alternate sets)
  useEffect(() => {
    const fetchSetNumber = async () => {
      // Only fetch for CATI interviews
      if (!isCatiMode || !survey._id || selectedSetNumber !== null) {
        return;
      }

      try {
        if (!survey._id) {
          console.warn('No survey ID available, skipping set number fetch');
          return;
        }
        
        // Helper function to get default set (Set 1)
        const getDefaultSet = () => {
          const setNumbers = new Set();
          survey.sections?.forEach(section => {
            section.questions?.forEach(question => {
              if (question.setsForThisQuestion && question.setNumber !== null && question.setNumber !== undefined) {
                setNumbers.add(question.setNumber);
              }
            });
          });
          const setArray = Array.from(setNumbers).sort((a, b) => a - b);
          return setArray.length > 0 ? setArray[0] : null; // First set (usually Set 1)
        };
        
        const response = await surveyResponseAPI.getLastCatiSetNumber(survey._id);
        
        // Handle response - if API fails or returns no data, default to Set 1
        if (response && response.success && response.data) {
          const nextSetNumber = response.data.nextSetNumber;
          if (nextSetNumber !== null && nextSetNumber !== undefined) {
            setSelectedSetNumber(nextSetNumber);
            return; // Success, exit early
          }
        }
        
        // If response is null/undefined or nextSetNumber is null, default to Set 1
        // This handles 404 responses (first CATI response) gracefully
        const defaultSet = getDefaultSet();
        if (defaultSet !== null) {
          setSelectedSetNumber(defaultSet);
        }
      } catch (error) {
        // Silently handle 404 or other errors - just use default Set 1
        // Don't log the error to avoid console spam - it's expected for first response
        const defaultSet = getDefaultSet();
        if (defaultSet !== null) {
          setSelectedSetNumber(defaultSet);
        }
      }
    };

    fetchSetNumber();
  }, [isCatiMode, survey._id, selectedSetNumber, survey.sections]);

  // Audio recording functions
  const startAudioRecording = useCallback(async () => {
    try {
      // Check if MediaDevices API is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported. Please use a modern browser with HTTPS.');
      }

      // Check if we're on HTTPS (required for microphone access)
      // Allow development server IP for testing
      const isDevelopmentServer = window.location.hostname === '74.225.250.243' || window.location.hostname === 'localhost';
      if (window.location.protocol !== 'https:' && !isDevelopmentServer) {
        throw new Error('Microphone access requires HTTPS. Please access the site via HTTPS or use localhost for development.');
      }

            // Request microphone access with simpler constraints
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true
            });
            
      
      setAudioStream(stream);
      
      // Create MediaRecorder with fallback formats - try MP3 first
      let mimeType = 'audio/mp4'; // Try MP4 first for better compatibility
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Use default
          }
        }
      }
      
      
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000, // Increased bitrate for better mobile compatibility
        audioSampleRate: 44100 // Standard sample rate for better compatibility
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          setAudioChunks(prev => [...prev, event.data]); // Update state as well
        }
      };
      
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: mimeType || 'audio/mp4' });
        setAudioBlob(audioBlob);
        setAudioChunks(chunks);
        
        // Create URL for playback
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      };
      
            recorder.onstart = () => {
              setIsRecording(true);
              setIsAudioPaused(false);
            };
      
      recorder.onpause = () => {
        setIsAudioPaused(true);
      };
      
            recorder.onresume = () => {
              setIsAudioPaused(false);
            };
            
            recorder.onerror = (event) => {
              console.error('MediaRecorder error:', event.error);
              setIsRecording(false);
            };
      
      setMediaRecorder(recorder);
            // Use different intervals for mobile vs desktop
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const interval = isMobile ? 500 : 100; // Slower for mobile devices
            recorder.start(interval);
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to start audio recording. ';
      let troubleshooting = '';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Microphone access denied.';
        troubleshooting = `
          <div class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 class="font-semibold text-yellow-800 mb-2">🔧 Microphone Permission Required</h4>
            <div class="text-sm text-yellow-700 space-y-2">
              <p><strong>For Desktop Browsers:</strong></p>
              <ol class="ml-4 space-y-1">
                <li>1. Click the microphone icon in the address bar</li>
                <li>2. Select "Allow" for microphone access</li>
                <li>3. Refresh the page and try again</li>
              </ol>
              <p><strong>For Mobile Browsers:</strong></p>
              <ol class="ml-4 space-y-1">
                <li>1. Go to Settings → Privacy & Security → Microphone</li>
                <li>2. Enable microphone access for your browser</li>
                <li>3. Restart the browser and try again</li>
              </ol>
            </div>
          </div>
        `;
        setPermissionError(troubleshooting);
        setPermissionType('audio');
        setShowPermissionModal(true);
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found.';
        troubleshooting = `
          <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 class="font-semibold text-red-800 mb-2">🔧 No Microphone Detected</h4>
            <div class="text-sm text-red-700 space-y-2">
              <p><strong>Please check:</strong></p>
              <ul class="ml-4 space-y-1">
                <li>• Microphone is connected and working</li>
                <li>• No other applications are using the microphone</li>
                <li>• Try refreshing the page</li>
                <li>• Check browser permissions for microphone access</li>
              </ul>
            </div>
          </div>
        `;
        setPermissionError(troubleshooting);
        setPermissionType('audio');
        setShowPermissionModal(true);
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Audio recording not supported in this browser.';
        troubleshooting = `
          <div class="mt-4 p-4 bg-[#E6F0F8] border border-blue-200 rounded-lg">
            <h4 class="font-semibold text-[#001D48] mb-2">🔧 Browser Compatibility Issue</h4>
            <div class="text-sm text-blue-700 space-y-2">
              <p><strong>Try these solutions:</strong></p>
              <ul class="ml-4 space-y-1">
                <li>• Use a modern browser (Chrome, Firefox, Safari, Edge)</li>
                <li>• Ensure you're using HTTPS (not HTTP)</li>
                <li>• Update your browser to the latest version</li>
                <li>• Try a different browser</li>
              </ul>
            </div>
          </div>
        `;
        setPermissionError(troubleshooting);
        setPermissionType('audio');
        setShowPermissionModal(true);
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Microphone is being used by another application.';
        troubleshooting = `
          <div class="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 class="font-semibold text-orange-800 mb-2">🔧 Microphone Busy</h4>
            <div class="text-sm text-orange-700">
              <p><strong>Please close these applications:</strong></p>
              <ul class="ml-4 space-y-1">
                <li>• Video calling apps (Zoom, Teams, Skype)</li>
                <li>• Voice recording apps</li>
                <li>• Other browser tabs using microphone</li>
                <li>• System audio recording software</li>
              </ul>
            </div>
          </div>
        `;
        setPermissionError(troubleshooting);
        setPermissionType('audio');
        setShowPermissionModal(true);
      } else if (error.message.includes('HTTPS')) {
        errorMessage = error.message;
      } else if (error.message.includes('MediaDevices API')) {
        errorMessage = error.message;
      } else {
        errorMessage += 'Please check microphone permissions and try again.';
      }
      
      // Show error message
      if (!troubleshooting) {
        showError(errorMessage);
      }
    }
  }, [showError]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsAudioPaused(false);
    }
  }, [mediaRecorder]);

  const pauseAudioRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
    }
  }, [mediaRecorder]);

  const resumeAudioRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
    }
  }, [mediaRecorder]);

  // Upload audio to server
  const uploadAudioFile = useCallback(async (audioBlob, sessionId) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `interview_${sessionId}_${Date.now()}.webm`);
      formData.append('sessionId', sessionId);
      formData.append('surveyId', survey._id);
      
      const response = await fetch(getApiUrl('/api/survey-responses/upload-audio'), {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Failed to upload audio: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Audio upload successful:', result);
      return result.data.audioUrl;
    } catch (error) {
      console.error('Error uploading audio:', error);
      throw error;
    }
  }, [survey._id]);

  // Helper function to determine which Set to show for this interview
  // For CATI: Fetch last set number and alternate
  // For CAPI: Return null (sets don't apply)
  const determineSetNumber = async (sessionId, survey, interviewMode) => {
    // Sets only apply to CATI interviews
    if (interviewMode !== 'cati') {
      return null;
    }
    
    if (!sessionId || !survey) return null;
    
    // Find all unique set numbers in the survey
    const setNumbers = new Set();
    survey.sections?.forEach(section => {
      section.questions?.forEach(question => {
        if (question.setsForThisQuestion && question.setNumber !== null && question.setNumber !== undefined) {
          setNumbers.add(question.setNumber);
        }
      });
    });
    
    if (setNumbers.size === 0) return null;
    
    try {
      // Fetch last CATI set number for this survey
      const response = await surveyResponseAPI.getLastCatiSetNumber(survey._id);
      if (response.success && response.data) {
        const nextSetNumber = response.data.nextSetNumber;
        if (nextSetNumber !== null && nextSetNumber !== undefined) {
          return nextSetNumber;
        }
      }
    } catch (error) {
      console.error('Error fetching last CATI set number:', error);
      // Fallback: default to Set 1 if API fails
    }
    
    // Fallback: default to Set 1 (first set)
    const setArray = Array.from(setNumbers).sort((a, b) => a - b);
    return setArray[0] || null;
  };

  // Helper function to check if question should be shown based on interview mode and sets logic
  const shouldShowQuestion = (question, interviewMode, currentSetNumber) => {
    // Check CAPI/CATI visibility
    if (interviewMode === 'capi' && question.enabledForCAPI === false) {
      // Debug logging for Q17
      if (question.questionNumber === '17' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '17')) {
        console.log(`🔍 Q17 Filtered: enabledForCAPI=false for CAPI mode`);
      }
      return false;
    }
    if (interviewMode === 'cati') {
      // Hide questions explicitly disabled for CATI
      if (question.enabledForCATI === false) {
        // Debug logging for Q17
        if (question.questionNumber === '17' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '17')) {
          console.log(`🔍 Q17 Filtered: enabledForCATI=false for CATI mode`);
        }
      return false;
      }
      // Also hide questions that are CAPI-only (enabledForCAPI is true but enabledForCATI is not true)
      // This catches cases where Survey Builder sets "show only in CAPI" but doesn't explicitly set enabledForCATI to false
      if (question.enabledForCAPI === true && question.enabledForCATI !== true) {
        // Debug logging for Q17
        if (question.questionNumber === '17' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '17')) {
          console.log(`🔍 Q17 Filtered: CAPI-only question (enabledForCAPI=true, enabledForCATI=${question.enabledForCATI})`);
        }
        return false;
      }
    }
    
    // Sets logic ONLY applies to CATI interviews, NOT CAPI
    // For CAPI, show all questions regardless of sets
    if (interviewMode === 'capi') {
      // For CAPI, always show questions (sets don't apply)
      return true;
    }
    
    // For CATI, apply sets logic
    if (interviewMode === 'cati' && question.setsForThisQuestion) {
      // If question has a set number, only show if it matches the selected set
      if (question.setNumber !== null && question.setNumber !== undefined) {
        // If no set is selected yet, we'll determine it
        if (currentSetNumber === null) {
          // Debug logging for Q17
          if (question.questionNumber === '17' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '17')) {
            console.log(`🔍 Q17 Filtered: Set question but currentSetNumber is null (setNumber=${question.setNumber})`);
          }
          return false; // Don't show until set is determined
        }
        // Only show questions from the selected set
        const matchesSet = question.setNumber === currentSetNumber;
        // Debug logging for Q17
        if (question.questionNumber === '17' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '17')) {
          console.log(`🔍 Q17 Set Check: setNumber=${question.setNumber}, currentSetNumber=${currentSetNumber}, matches=${matchesSet}`);
        }
        return matchesSet;
      }
      // If setsForThisQuestion is true but no setNumber, treat as always show (backward compatibility)
      return true;
    }
    
    // Questions without Sets appear in all surveys
    return true;
  };

  // Get all questions from all sections
  const getAllQuestions = () => {
    const allQuestions = [];
    
    // Determine current interview mode
    const interviewMode = survey.mode === 'multi_mode' ? (survey.assignedMode || 'capi') : (survey.mode || 'capi');
    
    // Add Call Status question as the very first question for CATI interviews
    if (isCatiMode) {
      const callStatusQuestion = {
        id: 'call-status',
        type: 'single_choice',
        text: 'Call Status {কলের অবস্থা}',
        description: 'Please select the status of the call attempt.',
        required: true,
        order: -4, // Make it appear first (before interviewer ID and consent form)
        options: [
          {
            id: 'call-connected',
            text: 'Call Connected {কল সংযুক্ত হয়েছে}',
            value: 'call_connected',
            code: 'call_connected'
          },
          {
            id: 'busy',
            text: 'Busy {ব্যস্ত}',
            value: 'busy',
            code: 'busy'
          },
          {
            id: 'switched-off',
            text: 'Switched Off {সুইচ অফ}',
            value: 'switched_off',
            code: 'switched_off'
          },
          {
            id: 'not-reachable',
            text: 'Not Reachable {পৌঁছানো যায়নি}',
            value: 'not_reachable',
            code: 'not_reachable'
          },
          {
            id: 'did-not-pick-up',
            text: 'Did Not Pick Up {উত্তর দেননি}',
            value: 'did_not_pick_up',
            code: 'did_not_pick_up'
          },
          {
            id: 'number-does-not-exist',
            text: 'Number Does Not Exist {নম্বর বিদ্যমান নেই}',
            value: 'number_does_not_exist',
            code: 'number_does_not_exist'
          },
          {
            id: 'didnt-get-call',
            text: "Didn't Get Call {কল পাননি}",
            value: 'didnt_get_call',
            code: 'didnt_get_call'
          }
        ],
        sectionIndex: -4, // Special section for call status
        questionIndex: -4,
        sectionId: 'call-status',
        sectionTitle: 'Call Status {কলের অবস্থা}',
        isCallStatus: true // Flag to identify this special question
      };
      allQuestions.push(callStatusQuestion);
    }
    
    // Check if this is the target survey for Supervisor ID question
    const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
    
    // Add "Enter Supervisor ID" question before Consent Form (only for target survey, CAPI only)
    // SKIP Interviewer ID question for both CATI and CAPI
    // SKIP Supervisor ID question for CATI (only show for CAPI)
    if (isTargetSurvey && !isCatiMode) {
      const supervisorIdQuestion = {
        id: 'supervisor-id',
        type: 'numeric',
        text: 'Enter Supervisor ID {সুপারভাইজার আইডি লিখুন}',
        description: '',
        required: false, // Optional question
        order: -3, // Make it appear before Consent Form
        sectionIndex: -3, // Special section for supervisor ID
        questionIndex: -3,
        sectionId: 'supervisor-id',
        sectionTitle: 'Supervisor ID',
        isSupervisorId: true, // Flag to identify this special question
        validation: {
          maxValue: 99999, // Max 5 digits
          minValue: 0
        }
      };
      allQuestions.push(supervisorIdQuestion);
    }
    
    // Add Consent Form question as the very first question (before AC/Polling Station)
    const consentFormMessage = isCatiMode 
      ? `Namaste, my name is ${interviewerFirstName || 'Interviewer'}. We are calling from Convergent, an independent research organization. We are conducting a survey on social and political issues in West Bengal, interviewing thousands of people. I will ask you a few questions about government performance and your preferences. Your responses will remain strictly confidential and will only be analysed in combination with others. No personal details will ever be shared. The survey will take about 5–10 minutes, and your honest opinions will greatly help us. {নমস্কার, আমার নাম ${interviewerFirstName || 'Interviewer'}। আমরা কনভারজেন্ট থেকে বলছি, এটি একটি স্বাধীন গবেষণা সংস্থা। আমরা পশ্চিমবঙ্গে সামাজিক ও রাজনৈতিক বিষয় নিয়ে একটি সমীক্ষা করছি, যেখানে হাজার হাজার মানুষের সঙ্গে কথা বলা হচ্ছে। সরকার কতটা ভালো কাজ করছে এবং আপনার পছন্দ-অপছন্দ সম্পর্কে কিছু প্রশ্ন করব। আপনার সব উত্তর একদম গোপন রাখা হবে এবং শুধুমাত্র অন্যদের সঙ্গে মিলিয়ে বিশ্লেষণ করা হবে। কোন ব্যক্তিগত তথ্য কখনোই শেয়ার করা হবে না। এই সার্ভেটা প্রায় ৫–১০ মিনিট লাগবে, এবং আপনার সৎ মতামত আমাদের জন্য খুবই মূল্যবান।}\n\nShould I Continue? {আমি কি চালিয়ে যেতে পারি?}`
      : `Namaste, my name is ${interviewerFirstName || 'Interviewer'}. We are from Convergent, an independent research organization. We are conducting a survey on social and political issues in West Bengal, interviewing thousands of people. I will ask you a few questions about government performance and your preferences. {নমস্কার, আমার নাম ${interviewerFirstName || 'Interviewer'}। আমরা কনভার্জেন্ট থেকে কথা বলছি, এটা একটা স্বাধীন গবেষণা সংস্থা। আমরা পশ্চিমবঙ্গের সামাজিক ও রাজনৈতিক বিষয় নিয়ে একটা সার্ভে করছি, যেখানে হাজার হাজার মানুষের মতামত নেওয়া হচ্ছে। আমি আপনাকে সরকারী কাজকর্ম আর আপনার পছন্দ-অপছন্দ নিয়ে কয়েকটা প্রশ্ন করব।}\n\nYour responses will remain strictly confidential and will only be analysed in combination with others. No personal details will ever be shared. The survey will take about 5–10 minutes, and your honest opinions will greatly help us. {আপনার দেওয়া তথ্য পুরোপুরি গোপন রাখা হবে এবং শুধু অন্যদের সঙ্গে মিলিয়ে বিশ্লেষণ করা হবে—কোনো ব্যক্তিগত তথ্য কখনোই শেয়ার করা হবে না। সার্ভেটা প্রায় ৫–১০ মিনিট লাগবে, আর আপনার সৎ মতামত আমাদের জন্য খুবই গুরুত্বপূর্ণ।}\n\nShould I Continue? {আমি কি চালিয়ে যেতে পারি?}`;
    
    const consentFormQuestion = {
      id: 'consent-form',
      type: 'single_choice',
      text: 'Consent Form {সম্মতিপত্র}',
      description: consentFormMessage,
      required: true,
      order: -2, // Make it appear first (before AC selection)
      options: [
        {
          id: 'consent-agree',
          text: 'Yes {হ্যাঁ}',
          value: '1',
          code: '1'
        },
        {
          id: 'consent-disagree',
          text: 'No {না}',
          value: '2',
          code: '2'
        }
      ],
      sectionIndex: -2, // Special section for consent form
      questionIndex: -2,
      sectionId: 'consent-form',
      sectionTitle: 'Consent Form {সম্মতিপত্র}',
      isConsentForm: true // Flag to identify this special question
    };
    allQuestions.push(consentFormQuestion);
    
    // Check if AC selection is required
    // For CATI interviews, AC is auto-populated from respondent info, so we skip AC selection
    const requiresACSelection = !isCatiMode && 
                               sessionData?.requiresACSelection && 
                               sessionData?.assignedACs && 
                               sessionData.assignedACs.length > 0;

    // Debug logging (can be removed in production)
    // console.log('=== getAllQuestions AC SELECTION DEBUG ===');
    // console.log('sessionData:', sessionData);
    // console.log('requiresACSelection:', requiresACSelection);
    // console.log('assignedACs:', sessionData?.assignedACs);
    // console.log('=== END getAllQuestions AC SELECTION DEBUG ===');
    
    // Add AC selection question as first question if required (NOT for CATI)
    if (requiresACSelection) {
      const acQuestion = {
        id: 'ac-selection',
        type: 'single_choice',
        text: 'Select Assembly Constituency',
        description: 'Please select the Assembly Constituency where you are conducting this interview.',
        required: true,
        order: -1, // Make it appear first
        options: sessionData.assignedACs.map(ac => ({
          id: `ac-${ac}`,
          text: ac,
          value: ac
        })),
        sectionIndex: -1, // Special section for AC selection
        questionIndex: -1,
        sectionId: 'ac-selection',
        sectionTitle: 'Assembly Constituency Selection',
        isACSelection: true // Flag to identify this special question
      };
      allQuestions.push(acQuestion);
      
      // Add Polling Station selection question after AC selection (if AC is selected)
      if (selectedAC) {
        const pollingStationQuestion = {
          id: 'polling-station-selection',
          type: 'polling_station',
          text: 'Select Polling Station',
          description: 'Please select the Group and Polling Station where you are conducting this interview.',
          required: true,
          order: -0.5, // Make it appear after AC selection
          sectionIndex: -1,
          questionIndex: -0.5,
          sectionId: 'polling-station-selection',
          sectionTitle: 'Polling Station Selection',
          isPollingStationSelection: true,
          availableGroups: availableGroups,
          availablePollingStations: availablePollingStations,
          selectedGroup: selectedGroupName,
          selectedStation: selectedStationName
        };
        allQuestions.push(pollingStationQuestion);
      }
    }
    
    // Determine which Set to show for this interview (if sets are used)
    // Note: Sets only apply to CATI, not CAPI
    let currentSetNumber = selectedSetNumber;
    // For CAPI, always set to null (no sets - show all questions from both sets)
    if (interviewMode === 'capi') {
      currentSetNumber = null;
    }
    // For CATI, use the selectedSetNumber (fetched via useEffect)
    
    // Add regular survey questions (filtered by CAPI/CATI and sets logic)
    // SPECIAL: For target survey in CATI mode, include Q17 and Q7 even if they're conditionally hidden or in a different set
    // This ensures they can be reordered correctly even if they're not initially visible
    const TARGET_SURVEY_ID = '68fd1915d41841da463f0d46';
    const isTargetSurveyCATI = isCatiMode && survey && (survey._id === TARGET_SURVEY_ID || survey.id === TARGET_SURVEY_ID);
    
    survey.sections?.forEach((section, sectionIndex) => {
      section.questions?.forEach((question, questionIndex) => {
        // Check if question should be shown
        const shouldShow = shouldShowQuestion(question, interviewMode, currentSetNumber);
        const isQ17 = question.questionNumber === '17' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '17');
        const isQ7 = question.questionNumber === '7' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '7');
        
        // For Q17 and Q7 in target survey CATI mode, include them even if filtered out by set logic (for reordering purposes)
        // But still respect CATI visibility settings (enabledForCATI !== false)
        if (shouldShow || (isTargetSurveyCATI && (isQ17 || isQ7) && question.enabledForCATI !== false)) {
          allQuestions.push({
            ...question,
            sectionIndex,
            questionIndex,
            sectionId: section.id,
            sectionTitle: section.title
          });
          // Debug logging for Q7 when included
          if (isQ7) {
            console.log(`✅ Q7 Included in allQuestions: questionNumber=${question.questionNumber}, shouldShow=${shouldShow}, enabledForCATI=${question.enabledForCATI}, setNumber=${question.setNumber}, currentSetNumber=${currentSetNumber}`);
          }
        } else {
          // Debug logging for Q17 and Q7 to understand why they're being filtered out
          if (isQ17 || isQ7) {
            const qText = getMainText(question.text || '').substring(0, 60);
            const qNum = isQ17 ? 'Q17' : 'Q7';
            console.log(`🔍 ${qNum} Filtered Out: questionNumber=${question.questionNumber}, enabledForCAPI=${question.enabledForCAPI}, enabledForCATI=${question.enabledForCATI}, setsForThisQuestion=${question.setsForThisQuestion}, setNumber=${question.setNumber}, currentSetNumber=${currentSetNumber}, interviewMode=${interviewMode}, text="${qText}..."`);
            // If Q17/Q7 is in Set 2 but we're showing Set 1, we might need to include it anyway for reordering
            if (question.setsForThisQuestion && question.setNumber === 2 && currentSetNumber === 1) {
              console.log(`⚠️ ${qNum} is in Set 2 but currentSetNumber is 1. ${qNum} might need to be included for proper ordering.`);
            }
          }
        }
      });
    });
    
    // Special handling for survey 68fd1915d41841da463f0d46: Dynamic question reordering for CATI mode
    // TARGET_SURVEY_ID is already declared above, reuse it
    if (isCatiMode && survey && (survey._id === TARGET_SURVEY_ID || survey.id === TARGET_SURVEY_ID)) {
      // Helper function to identify questions by questionNumber ONLY (no text patterns)
      // Simple and reliable: match by questionNumber only
      const identifyQuestion = (question, targetNumber, subQuestion = null) => {
        const qNum = String(question.questionNumber || '').trim().toLowerCase();
        const targetNumLower = String(targetNumber).toLowerCase();
        
        // For sub-questions (like 16.a, 16.b), check questionNumber pattern
        if (subQuestion) {
          // Check if questionNumber matches the pattern (e.g., "16.a", "16a", "16.A")
          const patternLower = `${targetNumber}.${subQuestion.toLowerCase()}`;
          const patternLowerNoDot = `${targetNumber}${subQuestion.toLowerCase()}`;
          const patternUpper = `${targetNumber}.${subQuestion.toUpperCase()}`;
          const patternUpperNoDot = `${targetNumber}${subQuestion.toUpperCase()}`;
          
          if (qNum === patternLower || qNum === patternLowerNoDot || 
              qNum === patternUpper || qNum === patternUpperNoDot ||
              question.questionNumber === patternLower || question.questionNumber === patternUpper) {
            return true;
          }
          return false;
        }
        
        // For non-sub-questions, check by questionNumber (exact match)
        const questionNumberMatches = qNum === targetNumLower || 
                                     question.questionNumber === targetNumber || 
                                     question.questionNumber === String(targetNumber);
        
        return questionNumberMatches;
      };

      // Define the desired order with question numbers ONLY (no text patterns)
      // Format: { number: '2', subQuestion: 'A' or 'B' for sub-questions }
      // IMPORTANT: Order matters - questions will be reordered in this exact sequence
      const desiredOrder = [
        { number: '2' },
        { number: '1' },
        { number: '13' },
        { number: '14' },
        { number: '16', subQuestion: 'A' },
        { number: '16', subQuestion: 'B' },
        { number: '5' },
        { number: '6' },
        { number: '7' },
        { number: '8' },
        { number: '9' },
        { number: '10' },
        { number: '17' },
        { number: '19' },
        { number: '28' },
        { number: '20' },
        { number: '21' },
        { number: '22' },
        { number: '26' },
        { number: '27' },
        { number: '3' },
        { number: '23' },
        { number: '24' },
        { number: '25' },
      ];

      // Find where Q1 starts (questions before Q1 should remain unchanged)
      // Q1 is typically the first question after system questions (call-status, interviewer-id, consent-form, etc.)
      let q1StartIndex = -1;
      allQuestions.forEach((q, idx) => {
        if (q.questionNumber === '1' || identifyQuestion(q, '1', ['first question'])) {
          q1StartIndex = idx;
        }
      });

      // If Q1 not found, check for first question with questionNumber >= 1
      if (q1StartIndex === -1) {
        allQuestions.forEach((q, idx) => {
          const qNum = parseInt(q.questionNumber);
          if (!isNaN(qNum) && qNum >= 1 && q1StartIndex === -1) {
            q1StartIndex = idx;
          }
        });
      }

      // If still not found, assume all questions after system questions are survey questions
      // System questions typically have negative order or specific IDs
      if (q1StartIndex === -1) {
        allQuestions.forEach((q, idx) => {
          if (q.order && q.order < 0) {
            // This is a system question, Q1 should be after this
            q1StartIndex = Math.max(q1StartIndex, idx + 1);
          }
        });
      }

      // Default: if still not found, start from index 0 (reorder all)
      if (q1StartIndex === -1) {
        q1StartIndex = 0;
      }

      // Split questions: before Q1 and from Q1 onwards
      const questionsBeforeQ1 = allQuestions.slice(0, q1StartIndex);
      const questionsFromQ1 = allQuestions.slice(q1StartIndex);

      // Find and extract questions in desired order
      const reorderedQuestions = [];
      const usedIndices = new Set();

      // Log all questions before reordering to debug Q17
      console.log(`🔍 All questions before reordering (${questionsFromQ1.length}): ${questionsFromQ1.map((q, i) => `[${i}]Q${q.questionNumber || '?'}`).join(', ')}`);
      
      desiredOrder.forEach(({ number, subQuestion }, orderIndex) => {
        const foundIndex = questionsFromQ1.findIndex((q, idx) => {
          if (usedIndices.has(idx)) return false;
          const matches = identifyQuestion(q, number, subQuestion);
          if (matches) {
            const qText = getMainText(q.text || '').substring(0, 60);
            console.log(`✅ Found Q${number}${subQuestion ? '.' + subQuestion : ''} at index ${idx} (questionNumber: ${q.questionNumber}, id: ${q.id}) for order position ${orderIndex + 1}. Text: "${qText}..."`);
          }
          // Special logging for Q17 to debug positioning
          if (number === '17' && !matches) {
            const qText = getMainText(q.text || '').toLowerCase();
            if (q.questionNumber === '17' || qText.includes('second choice')) {
              console.log(`🔍 Q17 Debug: Checking Q${q.questionNumber} (id: ${q.id}) - questionNumber match: ${q.questionNumber === '17'}, text: "${getMainText(q.text || '').substring(0, 60)}..."`);
        }
          }
          return matches;
        });

        if (foundIndex !== -1) {
          reorderedQuestions.push(questionsFromQ1[foundIndex]);
          usedIndices.add(foundIndex);
          // Special logging for Q17 position
          if (number === '17') {
            console.log(`📍 Q17 placed at position ${reorderedQuestions.length} in reordered array`);
          }
        } else {
          // More detailed logging for Q17
          if (number === '17') {
            console.error(`❌ Q17 NOT FOUND! Searching for Q17 in ${questionsFromQ1.length} questions. Available: ${questionsFromQ1.map((q, i) => `[${i}]Q${q.questionNumber || '?'} (id: ${q.id})`).join(', ')}`);
            // Check if any question has "second choice" in text
            questionsFromQ1.forEach((q, i) => {
              const qText = getMainText(q.text || '').toLowerCase();
              if (qText.includes('second choice')) {
                console.log(`🔍 Found question with "second choice": [${i}]Q${q.questionNumber || '?'} (id: ${q.id}), text: "${getMainText(q.text || '').substring(0, 80)}..."`);
              }
            });
          }
          console.warn(`⚠️ Could not find Q${number}${subQuestion ? '.' + subQuestion : ''} for order position ${orderIndex + 1}. Available questions: ${questionsFromQ1.map((q, i) => `[${i}]Q${q.questionNumber || '?'}`).join(', ')}`);
        }
      });
      
      // Add remaining questions (not in desired order) at the end
      const remainingQuestions = questionsFromQ1.filter((_, idx) => !usedIndices.has(idx));

      // Combine: questions before Q1 + reordered questions + remaining questions
      const finalQuestions = [...questionsBeforeQ1, ...reorderedQuestions, ...remainingQuestions];

      // CRITICAL: Re-filter to ensure no CAPI-only questions slip through
      // This is a safety check to ensure questions with enabledForCATI === false are removed
      // BUT: Don't filter out Q7 and Q17 for target survey in CATI mode (they're needed for reordering)
      const filteredFinalQuestions = finalQuestions.filter(q => {
        const isQ7 = q.questionNumber === '7' || (q.questionNumber && String(q.questionNumber).toLowerCase() === '7');
        const isQ17 = q.questionNumber === '17' || (q.questionNumber && String(q.questionNumber).toLowerCase() === '17');
        
        // For Q7 and Q17 in target survey CATI mode, always include them (they'll be filtered by conditions later)
        if (isTargetSurveyCATI && (isQ7 || isQ17)) {
          if (isQ7) {
            console.log(`✅ Q7 Passing final filter: enabledForCATI=${q.enabledForCATI}, enabledForCAPI=${q.enabledForCAPI}`);
          }
          return true; // Always include Q7/Q17 for reordering
        }
        
        // Re-check visibility for CATI mode
        if (q.enabledForCATI === false) {
          return false; // Hide questions explicitly disabled for CATI
        }
        // Also hide questions that are CAPI-only (enabledForCAPI is true but enabledForCATI is not true)
        if (q.enabledForCAPI === true && q.enabledForCATI !== true) {
          return false;
        }
        return true;
      });

      console.log(`✅ Reordered ${reorderedQuestions.length} questions for CATI interview (Survey: ${TARGET_SURVEY_ID})`);
      console.log(`📋 Order: ${reorderedQuestions.map((q, idx) => `[${idx+1}]Q${q.questionNumber || '?'}`).join(', ')}`);
      // Check Q17 position specifically
      const q17Index = reorderedQuestions.findIndex(q => q.questionNumber === '17');
      if (q17Index !== -1) {
        console.log(`📍 Q17 found at position ${q17Index + 1} in reordered array. Expected position: 13 (after Q10)`);
        if (q17Index !== 12) {
          console.error(`❌ Q17 is at WRONG position! Expected position 13, but found at position ${q17Index + 1}`);
        }
      } else {
        console.warn(`⚠️ Q17 NOT found in reordered questions!`);
      }
      // Check Q7 position specifically
      const q7Index = reorderedQuestions.findIndex(q => q.questionNumber === '7');
      if (q7Index !== -1) {
        console.log(`📍 Q7 found at position ${q7Index + 1} in reordered array. Expected position: 9 (after Q6, before Q8)`);
        if (q7Index !== 8) {
          console.warn(`⚠️ Q7 is at position ${q7Index + 1}, expected position 9`);
        }
      } else {
        console.warn(`⚠️ Q7 NOT found in reordered questions! Available: ${questionsFromQ1.map((q, i) => `[${i}]Q${q.questionNumber || '?'}`).join(', ')}`);
      }
      if (finalQuestions.length !== filteredFinalQuestions.length) {
        console.log(`⚠️ Filtered out ${finalQuestions.length - filteredFinalQuestions.length} CAPI-only questions from CATI interview`);
      }

      // Replace allQuestions with reordered and filtered version
      allQuestions.length = 0;
      allQuestions.push(...filteredFinalQuestions);
    }
    
    return allQuestions;
  };

  // Extract only the values we need from selectedPollingStation to prevent unnecessary recalculations
  const selectedGroupName = selectedPollingStation?.groupName;
  const selectedStationName = selectedPollingStation?.stationName;
  
  const allQuestions = useMemo(() => getAllQuestions(), [
    sessionData, 
    survey, 
    selectedAC, 
    availableGroups, 
    availablePollingStations,
    selectedGroupName,
    selectedStationName,
    sessionId, // Include sessionId for sets logic
    selectedSetNumber, // Include selectedSetNumber for sets logic
    interviewerFirstName, // Include interviewer name for consent form
    isCatiMode // Include interview mode for consent form message
  ]);
  
  // Check consent form response
  const consentResponse = responses['consent-form'];
  const isConsentDisagreed = consentResponse === '2' || consentResponse === 2;
  // If consent is "No", show Abandon button (similar to call status)
  const shouldShowAbandonForConsent = isConsentDisagreed && currentQuestion?.id === 'consent-form';
  
  // Check call status for CATI interviews
  const callStatusResponse = responses['call-status'];
  const isCallConnected = callStatusResponse === 'call_connected';
  const hasCallStatusResponse = callStatusResponse !== null && callStatusResponse !== undefined && callStatusResponse !== '';
  const shouldShowSubmitForCallStatus = isCatiMode && hasCallStatusResponse && !isCallConnected;

  // Use utility functions for gender detection (imported from genderUtils)

  // Helper function to get display text based on selected language
  const getDisplayText = (text) => {
    if (!text) return '';
    return getLanguageText(text, selectedLanguageIndex);
  };

  // Helper function to render text based on selected language
  const renderDisplayText = (text, options = {}) => {
    if (!text) return null;
    
    // Handle multi-line descriptions with multiple translation blocks
    // Split by \n\n to handle paragraphs, then parse each paragraph separately
    if (text.includes('\n\n')) {
      const paragraphs = text.split('\n\n');
      return (
        <span className={options.className || ''}>
          {paragraphs.map((paragraph, index) => {
            const displayText = getLanguageText(paragraph.trim(), selectedLanguageIndex);
              return (
                <React.Fragment key={index}>
                  {index > 0 && <><br /><br /></>}
                {displayText}
              </React.Fragment>
            );
          })}
        </span>
      );
    }
    
    // Single line or no line breaks - get selected language
    const displayText = getLanguageText(text, selectedLanguageIndex);
    return <span className={options.className || ''}>{displayText}</span>;
  };

  // Helper function to check if an option is "Others"
  const isOthersOption = (optText) => {
    if (!optText) return false;
    // Strip translations before checking
    const mainText = getMainText(String(optText));
    const normalized = mainText.toLowerCase().trim();
    return normalized === 'other' || 
           normalized === 'others' || 
           normalized === 'others (specify)';
  };

  // Debug: Log when sessionData changes (can be removed in production)
  // useEffect(() => {
  //   console.log('=== sessionData CHANGED ===');
  //   console.log('sessionData:', sessionData);
  //   console.log('allQuestions length:', allQuestions.length);
  //   console.log('First question:', allQuestions[0]);
  //   console.log('=== END sessionData CHANGED ===');
  // }, [sessionData, allQuestions]);

  // Debug: Log all questions and their conditions (commented out for production)
  // useEffect(() => {
  //   console.log('=== SURVEY QUESTIONS DEBUG ===');
  //   allQuestions.forEach((question, index) => {
  //     console.log(`Question ${index}: "${question.text}"`);
  //     console.log(`  - ID: ${question.id}`);
  //     console.log(`  - Conditions:`, question.conditions);
  //     console.log(`  - Type: ${question.type}`);
  //   });
  //   console.log('=== END SURVEY QUESTIONS DEBUG ===');
  // }, [allQuestions]);

  // Timer functions
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    
    // Use a more direct approach with useRef to avoid stale closures
    let currentTime = 0;
    timerRef.current = setInterval(() => {
      currentTime += 1;
      setTotalTime(currentTime);
    }, 1000);
    
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);


  const stopQuestionTimer = useCallback(() => {
    if (questionStartTime) {
      return Math.floor((Date.now() - questionStartTime) / 1000);
    }
    return 0;
  }, [questionStartTime]);

  // Format time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if response has content
  const hasResponseContent = (response) => {
    if (response === null || response === undefined) return false;
    if (typeof response === 'string') return response.trim().length > 0;
    if (Array.isArray(response)) return response.length > 0;
    if (typeof response === 'number') return response > 0;
    if (typeof response === 'boolean') return true;
    return true;
  };

  // Validate age against target audience requirements
  const validateAge = (age) => {
    const ageRange = survey.targetAudience?.demographics?.ageRange;
    if (!ageRange || !ageRange.min || !ageRange.max) return null; // No age restrictions
    
    const ageNum = parseInt(age);
    if (isNaN(ageNum)) return null; // Invalid age format
    
    if (ageNum < ageRange.min || ageNum > ageRange.max) {
      return `Only respondents of age between ${ageRange.min} and ${ageRange.max} are allowed to participate`;
    }
    return null; // Valid age
  };

  // Validate gender against target audience requirements and quotas
  const validateGender = (gender) => {
    const genderRequirements = survey.targetAudience?.demographics?.genderRequirements;
    if (!genderRequirements) return null; // No gender restrictions
    
    // Check if the selected gender is allowed
    const allowedGenders = Object.keys(genderRequirements).filter(g => 
      genderRequirements[g] && !g.includes('Percentage')
    );
    
    if (allowedGenders.length === 0) return null; // No gender restrictions
    
    // Map the response value to the requirement key format
    const genderMapping = {
      'male': 'Male',
      'female': 'Female', 
      'non_binary': 'Non-binary'
    };
    
    const mappedGender = genderMapping[gender];
    if (!mappedGender || !allowedGenders.includes(mappedGender)) {
      const allowedList = allowedGenders.join(', ');
      return `Only ${allowedList} respondents are allowed to participate`;
    }

    // Check quota if available
    if (genderQuotas && genderQuotas[mappedGender]) {
      const quota = genderQuotas[mappedGender];
      if (quota.isFull) {
        return `Sample size for ${mappedGender} is completed. Please select a different gender.`;
      }
    }

    return null; // Valid gender
  };

  // Validate fixed questions against target audience
  const validateFixedQuestion = (questionId, response) => {
    const question = allQuestionsRef.current.find(q => q.id === questionId);
    
    // Check if it's an age question (by ID or by text, ignoring translations)
    if (questionId === 'fixed_respondent_age' || isAgeQuestion(question)) {
      return validateAge(response);
    } else if (questionId === 'fixed_respondent_gender' || isGenderQuestion(question)) {
      // Normalize gender response to handle translations
      const normalizedGender = normalizeGenderResponse(response);
      return validateGender(normalizedGender);
    }
    return null; // No validation for other questions
  };

  // Check if all required questions are answered
  const areAllRequiredQuestionsAnswered = () => {
    // For CATI interviews, if call status is not connected, skip consent form validation
    const callStatusResponse = responses['call-status'];
    const isCallConnected = callStatusResponse === 'call_connected';
    const shouldSkipConsentCheck = isCatiMode && callStatusResponse && !isCallConnected;
    
    return visibleQuestions.every(question => {
      if (!question.required) return true;
      
      // Skip consent form validation if call is not connected
      if (shouldSkipConsentCheck && question.id === 'consent-form') {
        return true;
      }

      // Special handling for polling station question:
      // consider it answered when both group and station are selected
      if (question.type === 'polling_station') {
        return !!(selectedPollingStation.groupName && selectedPollingStation.stationName);
      }

      const response = responses[question.id];
      return hasResponseContent(response);
    });
  };

  // Find first unanswered required question
  const findFirstUnansweredRequiredQuestion = () => {
    // For CATI interviews, if call status is not connected, skip consent form validation
    const callStatusResponse = responses['call-status'];
    const isCallConnected = callStatusResponse === 'call_connected';
    const shouldSkipConsentCheck = isCatiMode && callStatusResponse && !isCallConnected;
    
    return visibleQuestions.find(question => {
      if (!question.required) return false;
      
      // Skip consent form validation if call is not connected
      if (shouldSkipConsentCheck && question.id === 'consent-form') {
        return false;
      }

      if (question.type === 'polling_station') {
        return !(selectedPollingStation.groupName && selectedPollingStation.stationName);
      }

      const response = responses[question.id];
      return !hasResponseContent(response);
    });
  };

  // Check if a specific question is required and unanswered
  const isQuestionRequiredAndUnanswered = (question) => {
    if (!question.required) return false;

    if (question.type === 'polling_station') {
      return !(selectedPollingStation.groupName && selectedPollingStation.stationName);
    }

    const response = responses[question.id];
    return !hasResponseContent(response);
  };

  // Update responsesRef when responses change
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // Evaluate conditional logic for a question - using ref to break dependency cycle
  const evaluateConditions = useCallback((question) => {
    if (!question.conditions || question.conditions.length === 0) {
      return true;
    }

      const results = question.conditions.map((condition, index) => {
      // Find the target question
      let targetQuestion = allQuestionsRef.current.find(q => q.id === condition.questionId);
      
      // If target question is a gender question, also check for registered voter question (equivalent)
      let response = responsesRef.current[condition.questionId];
      let equivalentResponse = null;
      
      if (targetQuestion && isGenderQuestion(targetQuestion)) {
        // Find registered voter question as equivalent
        const registeredVoterQuestion = allQuestionsRef.current.find(q => {
          const qText = getMainText(q.text || '').toLowerCase();
          return qText.includes('are you a registered voter') || 
                 qText.includes('registered voter') ||
                 qText.includes('নিবন্ধিত ভোটার') ||
                 qText.includes('বিধানসভা কেন্দ্র');
        });
        
        if (registeredVoterQuestion) {
          equivalentResponse = responsesRef.current[registeredVoterQuestion.id];
        }
      }
      
      // Use equivalent response if main response is not available
      if ((response === undefined || response === null) && equivalentResponse !== null && equivalentResponse !== undefined) {
        response = equivalentResponse;
        targetQuestion = allQuestionsRef.current.find(q => {
          const qText = getMainText(q.text || '').toLowerCase();
          return qText.includes('are you a registered voter') || 
                 qText.includes('registered voter') ||
                 qText.includes('নিবন্ধিত ভোটার') ||
                 qText.includes('বিধানসভা কেন্দ্র');
        });
      }
      
      if (response === undefined || response === null) {
        return false;
      }
      
      // Helper function to get main text (without translation) for comparison
      const getComparisonValue = (val) => {
        if (val === null || val === undefined) return String(val || '').toLowerCase().trim();
        const strVal = String(val);
        
        // If we have the target question and it has options, try to match the value to an option
        if (targetQuestion && targetQuestion.options && Array.isArray(targetQuestion.options)) {
          // Check if val matches any option.value or option.text (after stripping translations)
          for (const option of targetQuestion.options) {
            const optionValue = typeof option === 'object' ? (option.value || option.text) : option;
            const optionText = typeof option === 'object' ? option.text : option;
            
            // Check if val matches option.value or option.text (with or without translations)
            if (strVal === String(optionValue) || strVal === String(optionText)) {
              // Return the main text of the option (without translation)
              return getMainText(String(optionText)).toLowerCase().trim();
            }
            
            // Also check if main texts match (in case translations differ)
            if (getMainText(strVal).toLowerCase().trim() === getMainText(String(optionText)).toLowerCase().trim()) {
              return getMainText(String(optionText)).toLowerCase().trim();
            }
          }
        }
        
        // Fallback: just strip translations from the value itself
        return getMainText(strVal).toLowerCase().trim();
      };

      // Get comparison values for both response and condition value
      const responseComparison = Array.isArray(response) 
        ? response.map(r => getComparisonValue(r))
        : getComparisonValue(response);
      const conditionComparison = getComparisonValue(condition.value);

      let met = false;

      switch (condition.operator) {
        case 'equals':
          if (Array.isArray(responseComparison)) {
            met = responseComparison.some(r => r === conditionComparison);
          } else {
            met = responseComparison === conditionComparison;
          }
          break;
        case 'not_equals':
          if (Array.isArray(responseComparison)) {
            met = !responseComparison.some(r => r === conditionComparison);
          } else {
            met = responseComparison !== conditionComparison;
          }
          break;
        case 'contains':
          const responseStr = Array.isArray(responseComparison) 
            ? responseComparison.join(' ') 
            : String(responseComparison);
          met = responseStr.includes(conditionComparison);
          break;
        case 'not_contains':
          const responseStr2 = Array.isArray(responseComparison) 
            ? responseComparison.join(' ') 
            : String(responseComparison);
          met = !responseStr2.includes(conditionComparison);
          break;
        case 'greater_than':
          // Convert response to string first, then parse to handle various formats
          // Handle both direct numeric values and values from options
          let responseValue = response;
          // If response is an array, take the first element
          if (Array.isArray(response)) {
            responseValue = response[0];
          }
          // If response is an object, try to extract numeric value
          if (typeof responseValue === 'object' && responseValue !== null) {
            responseValue = responseValue.value || responseValue.text || responseValue;
          }
          const responseStrNum = String(responseValue || '').trim();
          const conditionStrNum = String(condition.value || '').trim();
          const responseNum = parseFloat(responseStrNum);
          const conditionNum = parseFloat(conditionStrNum);
          met = !isNaN(responseNum) && !isNaN(conditionNum) && responseNum > conditionNum;
          if (question.questionNumber === '7') {
            console.log(`🔍 Q7 Condition Debug: questionId=${condition.questionId}, response="${response}" (extracted: "${responseValue}", as string: "${responseStrNum}", parsed: ${responseNum}), condition.value="${condition.value}" (as string: "${conditionStrNum}", parsed: ${conditionNum}), met=${met}`);
          }
          break;
        case 'less_than':
          const responseNumLess = parseFloat(response);
          const conditionNumLess = parseFloat(condition.value);
          met = !isNaN(responseNumLess) && !isNaN(conditionNumLess) && responseNumLess < conditionNumLess;
          break;
        case 'is_empty':
          met = !hasResponseContent(response);
          break;
        case 'is_not_empty':
          met = hasResponseContent(response);
          break;
        case 'is_selected':
          if (Array.isArray(responseComparison)) {
            met = responseComparison.some(r => r === conditionComparison);
          } else {
            met = responseComparison === conditionComparison;
          }
          break;
        case 'is_not_selected':
          if (Array.isArray(responseComparison)) {
            met = !responseComparison.some(r => r === conditionComparison);
          } else {
            met = responseComparison !== conditionComparison;
          }
          break;
        default:
          met = false;
      }

      return met;
    });

    // Handle AND/OR logic between conditions
    if (results.length === 1) {
      return results[0];
    }

    let finalResult = results[0];
    for (let i = 1; i < results.length; i++) {
      const logic = question.conditions[i].logic || 'AND';
      if (logic === 'AND') {
        finalResult = finalResult && results[i];
      } else if (logic === 'OR') {
        finalResult = finalResult || results[i];
      }
    }

    return finalResult;
  }, []); // Empty deps - use ref to access responses

  // Get visible questions based on conditional logic
  // Use responsesKey to trigger recalculation only when responses content changes
  // IMPORTANT: Use a stable key to prevent infinite loops - only recalculate when responses actually change
  const responsesKey = useMemo(() => {
    const keys = Object.keys(responses).sort();
    const values = keys.map(key => {
      const val = responses[key];
      // For arrays/objects, use a stable representation
      if (Array.isArray(val)) {
        return val.length;
      }
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });
    return JSON.stringify([keys.length, ...values]);
  }, [responses]);

  const visibleQuestions = useMemo(() => {
    // Update refs before evaluation to ensure latest data
    responsesRef.current = responses;
    allQuestionsRef.current = allQuestions;
    
    // Early return if no questions to avoid unnecessary processing
    if (!allQuestions || allQuestions.length === 0) {
      return [];
    }
    
    const visible = allQuestions.filter(question => {
      // Check conditional logic first
      const conditionsMet = evaluateConditions(question);
      if (!conditionsMet) {
        // Debug logging for Q7 to understand why it's being filtered
        if (question.questionNumber === '7' || (question.questionNumber && String(question.questionNumber).toLowerCase() === '7')) {
          console.log(`🔍 Q7 Filtered by conditions: questionNumber=${question.questionNumber}, id=${question.id}, conditions=${JSON.stringify(question.conditions)}, responses=${JSON.stringify(responses)}`);
          // Also log which question ID the condition is checking
          if (question.conditions && question.conditions.length > 0) {
            question.conditions.forEach((cond, idx) => {
              const condResponse = responses[cond.questionId];
              console.log(`🔍 Q7 Condition ${idx + 1}: questionId=${cond.questionId}, operator=${cond.operator}, value=${cond.value}, response=${condResponse}`);
            });
          }
        }
        return false;
      }
      
      // For survey "68fd1915d41841da463f0d46": Hide Question 7 (Bye-Election Party Choice) 
      // if selected AC does not have bye-election
      const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
      if (isTargetSurvey) {
        const questionNum = String(question.questionNumber || '').toLowerCase();
        // Q7 is the bye-election question
        const isQ7 = questionNum === '7' || questionNum === '7.0';
        
        if (isQ7) {
          // Only show Q7 if selected AC has bye-election
          // For CATI, check if AC is available from session data
          const acToCheck = selectedAC || acFromSessionData;
          if (!acToCheck || !hasByeElection) {
            console.log(`🔍 Q7 Filtered by bye-election check: acToCheck=${acToCheck}, hasByeElection=${hasByeElection}`);
            return false;
          }
        }
      }
      
      return true;
    });
    
    // CRITICAL: For CATI mode in target survey, allQuestions is already reordered in getAllQuestions()
    // We just need to maintain that order here - no need to reorder again
    // The visible array already maintains the order from allQuestions
    return visible;
  }, [allQuestions, responsesKey, selectedAC, hasByeElection, survey, acFromSessionData, isCatiMode]); // Removed evaluateConditions from dependencies to prevent infinite loops

  // Calculate maximum possible questions from current state
  // This considers all questions that could potentially be shown based on all possible conditional paths
  const maxPossibleQuestions = useMemo(() => {
    if (!allQuestions || allQuestions.length === 0) {
      return 0;
    }
    
    let maxCount = 0;
    
    for (const question of allQuestions) {
      if (!question) continue;
      
      // Check if question has conditions
      const hasConditions = question.conditions && question.conditions.length > 0;
      
      if (!hasConditions) {
        // Questions without conditions are always shown
        maxCount++;
      } else {
        // For questions with conditions, check if they could potentially be shown
        // A question could be shown if:
        // 1. Its conditions are already met (it's currently visible), OR
        // 2. It has conditions that reference questions that haven't been answered yet (could potentially be met)
        
        // Check if conditions are already met (question is currently visible)
        const isCurrentlyVisible = evaluateConditions(question);
        
        // Check if conditions reference questions that haven't been answered yet
        const hasUnansweredDependencies = question.conditions.some((cond) => {
          const response = responses[cond.questionId];
          return response === undefined || response === null || response === '';
        });
        
        // Special handling for Q7 in target survey - only count if AC has bye-election
        const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
        let shouldCountQ7 = true;
        if (isTargetSurvey) {
          const questionNum = String(question.questionNumber || '').toLowerCase();
          const isQ7 = questionNum === '7' || questionNum === '7.0';
          
          if (isQ7) {
            const acToCheck = selectedAC || acFromSessionData;
            shouldCountQ7 = acToCheck && hasByeElection;
          }
        }
        
        // Count if currently visible OR could potentially be shown (has unanswered dependencies)
        if (shouldCountQ7 && (isCurrentlyVisible || hasUnansweredDependencies)) {
          maxCount++;
        }
      }
    }
    
    return maxCount;
  }, [allQuestions, responses, evaluateConditions, selectedAC, hasByeElection, survey, acFromSessionData]);

  // EXACTLY like React Native - currentQuestionIndex is an index into visibleQuestions
  // Ensure index is within bounds (but don't update state to avoid loops)
  const safeQuestionIndex = useMemo(() => {
    if (visibleQuestions.length === 0) return 0;
    return Math.min(currentQuestionIndex, Math.max(0, visibleQuestions.length - 1));
  }, [currentQuestionIndex, visibleQuestions.length]);
  
  const currentQuestion = visibleQuestions[safeQuestionIndex];

  // Detect available languages from current question and its options
  const detectAvailableLanguages = useMemo(() => {
    if (!currentQuestion) return ['Language 1'];
    
    const languageCounts = new Set();
    
    try {
      // Check question text
      if (currentQuestion.text) {
        const languages = parseMultiTranslation(currentQuestion.text);
        if (languages && Array.isArray(languages)) {
          languages.forEach((_, index) => languageCounts.add(index));
        }
      }
      
      // Check question description
      if (currentQuestion.description) {
        const languages = parseMultiTranslation(currentQuestion.description);
        if (languages && Array.isArray(languages)) {
          languages.forEach((_, index) => languageCounts.add(index));
        }
      }
      
      // Check options
      if (currentQuestion.options && Array.isArray(currentQuestion.options)) {
        currentQuestion.options.forEach(option => {
          try {
            const optionText = typeof option === 'object' ? (option.text || option.value) : option;
            if (optionText) {
              const languages = parseMultiTranslation(String(optionText));
              if (languages && Array.isArray(languages)) {
                languages.forEach((_, index) => languageCounts.add(index));
              }
            }
          } catch (error) {
            console.warn('Error parsing option text:', error);
          }
        });
      }
    } catch (error) {
      console.warn('Error detecting languages:', error);
      return ['Language 1'];
    }
    
    const maxLanguages = Math.max(...Array.from(languageCounts), 0) + 1;
    
    // For survey "68fd1915d41841da463f0d46", use specific language labels
    const surveyId = survey?._id || survey?.id;
    if (surveyId === '68fd1915d41841da463f0d46') {
      const languageLabels = ['English', 'Bengali', 'Hindi'];
      return Array.from({ length: maxLanguages }, (_, i) => languageLabels[i] || `Language ${i + 1}`);
    }
    
    return Array.from({ length: maxLanguages }, (_, i) => `Language ${i + 1}`);
  }, [currentQuestion, survey]);

  // Also fetch MP/MLA names when reaching questions 16.a or 16.b if not already available
  useEffect(() => {
    const fetchIfNeeded = async () => {
      // Get current question from visibleQuestions
      const currentQ = visibleQuestions && visibleQuestions.length > 0 && currentQuestionIndex < visibleQuestions.length
        ? visibleQuestions[currentQuestionIndex]
        : null;
      
      if (!currentQ || (mpName && mlaName)) return;
      
      const questionText = (currentQ.text || '').toLowerCase();
      const questionNumber = currentQ.questionNumber || '';
      const isQuestion16a = questionNumber.includes('16.a') || 
                           questionNumber.includes('16a') ||
                           questionText.includes('satisfaction with mp') ||
                           (questionText.includes('mp') && questionText.includes('satisfaction'));
      const isQuestion16b = questionNumber.includes('16.b') || 
                           questionNumber.includes('16b') ||
                           questionText.includes('satisfaction with mla') ||
                           (questionText.includes('mla') && questionText.includes('satisfaction'));
      
      if (isQuestion16a || isQuestion16b) {
        // Get selected AC from state or memoized session data AC
        let acToUse = selectedAC || acFromSessionData;
        
        // Only fetch if:
        // 1. We have an AC
        // 2. We don't already have MP/MLA names
        // 3. We're not already loading
        // 4. We haven't already fetched for this AC
        if (acToUse && !mpName && !mlaName && !isLoadingMPMLA && lastFetchedACRef.current !== acToUse) {
          lastFetchedACRef.current = acToUse; // Mark as fetching
          try {
            setIsLoadingMPMLA(true);
            const result = await masterDataAPI.getACData(acToUse);
            if (result.success && result.data) {
              setMpName(result.data.mpName);
              setMlaName(result.data.mlaName);
            }
          } catch (error) {
            console.error('Error fetching MP/MLA on question display:', error);
          } finally {
            setIsLoadingMPMLA(false);
          }
        }
      }
    };
    
    fetchIfNeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, visibleQuestions, selectedAC, acFromSessionData]); // Only re-run when question changes or AC changes

  // Handle response change
  const handleResponseChange = useCallback((questionId, response) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: response
    }));
    
    // For survey "68fd1915d41841da463f0d46": When Q8 ("2025 Preference") changes, 
    // we don't clear Q9 cache - we'll filter the cached options when displaying
    // This maintains the shuffled order while removing the excluded option
    
    // Handle AC selection specially - only check questionId, not currentQuestion to avoid dependency issues
    if (questionId === 'ac-selection') {
      setSelectedAC(response);
      
      // Fetch AC data to check for bye-election status (for survey "68fd1915d41841da463f0d46")
      const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
      if (isTargetSurvey && response) {
        masterDataAPI.getACData(response).then(result => {
          if (result.success && result.data) {
            setHasByeElection(result.data.hasByeElection || false);
          } else {
            setHasByeElection(false);
          }
        }).catch(err => {
          console.error('Error fetching AC bye-election status:', err);
          setHasByeElection(false);
        });
      } else {
        setHasByeElection(false);
      }
      
      // Reset polling station selection when AC changes
      // Don't set acName here - let the useEffect handle it to prevent infinite loops
      setSelectedPollingStation({
        state: null,
        acName: null, // Will be set by useEffect
        acNo: null,
        pcNo: null,
        pcName: null,
        district: null,
        roundNumber: null,
        groupName: null,
        stationName: null,
        gpsLocation: null,
        latitude: null,
        longitude: null
      });
      setAvailableRoundNumbers([]);
      setAvailableGroups([]);
      setAvailablePollingStations([]);
    }
    
    // Handle polling station round number selection
    if (questionId === 'polling-station-round') {
      setSelectedPollingStation(prev => ({
        ...prev,
        roundNumber: response,
        groupName: null, // Reset group when round changes
        stationName: null, // Reset station when round changes
        gpsLocation: null,
        latitude: null,
        longitude: null
      }));
      setAvailableGroups([]);
      setAvailablePollingStations([]);
      // Clear polling station selection responses when round changes
      setResponses(prev => ({
        ...prev,
        'polling-station-group': null,
        'polling-station-station': null,
        'polling-station-selection': null
      }));
    }
    
    // Handle polling station group selection
    if (questionId === 'polling-station-group') {
      setSelectedPollingStation(prev => ({
        ...prev,
        groupName: response,
        stationName: null,
        gpsLocation: null,
        latitude: null,
        longitude: null
      }));
      setAvailablePollingStations([]);
      // Clear polling station selection response when group changes
      setResponses(prev => ({
        ...prev,
        'polling-station-selection': null
      }));
    }
    
    // Handle polling station selection
    if (questionId === 'polling-station-station') {
      // Use functional update so we have the latest groupName
      setSelectedPollingStation(prev => {
        const updated = {
          ...prev,
          stationName: response
        };

        // Also store a human-readable combined value in responses for use in logic/exports
        if (response && updated.groupName) {
          setResponses(prevResp => ({
            ...prevResp,
            'polling-station-selection': `${updated.groupName} - ${response}`
          }));
        }

        return updated;
      });
    }
    
    // Clear validation error for this question if it has content
    if (hasResponseContent(response)) {
      setValidationErrors(prev => {
        const newErrors = new Set(prev);
        newErrors.delete(questionId);
        return newErrors;
      });
    }

    // Real-time target audience validation for fixed questions
    if (hasResponseContent(response)) {
      const validationError = validateFixedQuestion(questionId, response);
      setTargetAudienceErrors(prev => {
        const newErrors = new Map(prev);
        if (validationError) {
          newErrors.set(questionId, validationError);
        } else {
          newErrors.delete(questionId);
        }
        return newErrors;
      });

      // Refresh gender quotas if gender question is answered
      if (questionId === 'fixed_respondent_gender' || isGenderQuestion(allQuestionsRef.current.find(q => q.id === questionId))) {
        // Small delay to allow backend to process the response
        setTimeout(() => {
          fetchGenderQuotas();
        }, 1000);
      }
    } else {
      // Clear target audience error if response is empty
      setTargetAudienceErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.delete(questionId);
        return newErrors;
      });
    }
  }, []);

  // Fetch round numbers when AC is selected
  useEffect(() => {
    const fetchRoundNumbers = async () => {
      if (!selectedAC) {
        setAvailableRoundNumbers([]);
        setSelectedPollingStation(prev => ({ ...prev, roundNumber: null }));
        return;
      }
      
      try {
        setLoadingRoundNumbers(true);
        const state = survey?.acAssignmentState || 'West Bengal';
        const response = await pollingStationAPI.getRoundNumbersByAC(state, selectedAC);
        
        if (response.success && response.data.rounds) {
          const rounds = response.data.rounds || [];
          setAvailableRoundNumbers(rounds);
          // Auto-select first round if available and none selected
          if (rounds.length > 0 && !selectedPollingStation.roundNumber) {
            setSelectedPollingStation(prev => ({ ...prev, roundNumber: rounds[0] }));
          }
        }
      } catch (error) {
        console.error('Error fetching round numbers:', error);
        setAvailableRoundNumbers([]);
      } finally {
        setLoadingRoundNumbers(false);
      }
    };
    
    fetchRoundNumbers();
  }, [selectedAC, survey?.acAssignmentState]);

  // Fetch groups when AC and Round Number are selected
  useEffect(() => {
    const fetchGroups = async () => {
      if (!selectedAC || !selectedPollingStation.roundNumber) {
        setAvailableGroups([]);
        return;
      }
      
      try {
        setLoadingGroups(true);
        // Default to West Bengal for now (polling station data is for West Bengal)
        const state = survey?.acAssignmentState || 'West Bengal';
        // CRITICAL FIX: Try to use AC code if available, otherwise use AC name
        // The backend will return acNo in the response, which we'll use for subsequent calls
        const response = await pollingStationAPI.getGroupsByAC(state, selectedAC, selectedPollingStation.roundNumber);
        
        if (response.success) {
          const newGroups = response.data.groups || [];
          // Only update if groups actually changed
          setAvailableGroups(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newGroups)) {
              return prev; // Return same reference if no change
            }
            return newGroups;
          });
          setSelectedPollingStation(prev => {
            // Only update if values have actually changed to prevent infinite loops
            if (prev.acName === selectedAC && 
                prev.state === state &&
                prev.acNo === response.data.ac_no &&
                prev.pcNo === response.data.pc_no &&
                prev.pcName === response.data.pc_name &&
                prev.district === response.data.district) {
              return prev; // No change, return same object
            }
            return {
              ...prev,
              state: state,
              acName: selectedAC,
              acNo: response.data.ac_no,
              pcNo: response.data.pc_no,
              pcName: response.data.pc_name,
              district: response.data.district
            };
          });
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
        setAvailableGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };
    
    fetchGroups();
  }, [selectedAC, selectedPollingStation.roundNumber, survey?.acAssignmentState]);

  // Fetch polling stations when group and round number are selected
  useEffect(() => {
    const fetchPollingStations = async () => {
      if (!selectedPollingStation.groupName || !selectedPollingStation.acName || !selectedPollingStation.roundNumber) {
        setAvailablePollingStations([]);
        return;
      }
      
      try {
        setLoadingStations(true);
        const state = selectedPollingStation.state || survey?.acAssignmentState || 'West Bengal';
        // CRITICAL FIX: Use AC code (acNo) instead of AC name to prevent name conflicts
        // (e.g., "Kashipur" vs "Kashipur-Belgachhia")
        const acIdentifier = selectedPollingStation.acNo || selectedPollingStation.acName;
        const response = await pollingStationAPI.getPollingStationsByGroup(
          state,
          acIdentifier,
          selectedPollingStation.groupName,
          selectedPollingStation.roundNumber
        );
        
        if (response.success) {
          const newStations = response.data.stations || [];
          // Only update if stations actually changed
          setAvailablePollingStations(prev => {
            if (JSON.stringify(prev) === JSON.stringify(newStations)) {
              return prev; // Return same reference if no change
            }
            return newStations;
          });
        }
      } catch (error) {
        console.error('Error fetching polling stations:', error);
        setAvailablePollingStations([]);
      } finally {
        setLoadingStations(false);
      }
    };
    
    fetchPollingStations();
  }, [selectedPollingStation.groupName, selectedPollingStation.acName, selectedPollingStation.roundNumber, selectedPollingStation.state, survey?.acAssignmentState]);

  // Update polling station GPS when station is selected
  useEffect(() => {
    const updateStationGPS = async () => {
      if (!selectedPollingStation.stationName || !selectedPollingStation.groupName || !selectedPollingStation.acName) {
        return;
      }
      
      try {
        const state = selectedPollingStation.state || survey?.acAssignmentState || 'West Bengal';
        // CRITICAL FIX: Use AC code (acNo) instead of AC name to prevent name conflicts
        const acIdentifier = selectedPollingStation.acNo || selectedPollingStation.acName;
        const response = await pollingStationAPI.getPollingStationGPS(
          state,
          acIdentifier,
          selectedPollingStation.groupName,
          selectedPollingStation.stationName
        );
        
        if (response.success) {
          setSelectedPollingStation(prev => {
            // Only update if values have actually changed to prevent infinite loops
            if (prev.gpsLocation === response.data.gps_location &&
                prev.latitude === response.data.latitude &&
                prev.longitude === response.data.longitude) {
              return prev; // No change, return same object
            }
            return {
              ...prev,
              gpsLocation: response.data.gps_location,
              latitude: response.data.latitude,
              longitude: response.data.longitude
            };
          });
        }
      } catch (error) {
        console.error('Error fetching polling station GPS:', error);
      }
    };
    
    updateStationGPS();
  }, [selectedPollingStation.stationName, selectedPollingStation.groupName, selectedPollingStation.acName, selectedPollingStation.state, survey?.acAssignmentState]);

  // Navigate to next question - EXACTLY like working commit
  // Phone number validation function
  const validatePhoneNumber = (phoneNumber) => {
    // Convert to string if it's not already, handle null/undefined
    const phoneStr = phoneNumber != null ? String(phoneNumber) : '';
    
    if (!phoneStr || phoneStr.trim() === '') {
      return { valid: true, message: null }; // Empty is allowed (optional field)
    }
    
    // Remove any non-digit characters
    const digitsOnly = phoneStr.replace(/\D/g, '');
    
    // Check if exactly 10 digits (required)
    if (digitsOnly.length !== 10) {
      return { valid: false, message: 'Phone number must be exactly 10 digits.' };
    }
    
    // Check for invalid patterns (repeating digits like 1111111111, 22222222, 987654321, etc.)
    // Check for all same digits
    if (/^(\d)\1{4,}$/.test(digitsOnly)) {
      return { valid: false, message: 'Please enter a valid phone number.' };
    }
    
    // Check for sequential patterns like 987654321, 123456789
    const isSequential = (str) => {
      const nums = str.split('').map(Number);
      let ascending = true;
      let descending = true;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[i-1] + 1) ascending = false;
        if (nums[i] !== nums[i-1] - 1) descending = false;
      }
      return ascending || descending;
    };
    
    if (digitsOnly.length >= 7 && isSequential(digitsOnly)) {
      return { valid: false, message: 'Please enter a valid phone number.' };
    }
    
    // Check for common invalid patterns
    const invalidPatterns = [
      /^1111111111$/,
      /^2222222222$/,
      /^3333333333$/,
      /^4444444444$/,
      /^5555555555$/,
      /^6666666666$/,
      /^7777777777$/,
      /^8888888888$/,
      /^9999999999$/,
      /^0000000000$/,
      /^9876543210$/,
      /^1234567890$/,
      /^987654321$/,
      /^123456789$/
    ];
    
    for (const pattern of invalidPatterns) {
      if (pattern.test(digitsOnly)) {
        return { valid: false, message: 'Please enter a valid phone number.' };
      }
    }
    
    return { valid: true, message: null };
  };

  const goToNextQuestion = () => {
    // For CATI interviews, check call status question
    if (isCatiMode && currentQuestion && currentQuestion.id === 'call-status') {
      const callStatusResponse = responses['call-status'];
      if (!callStatusResponse) {
        showError('Please select a call status before proceeding.');
        return;
      }
      
      // If call is not connected, don't allow moving to next question
      // User should submit instead
      if (callStatusResponse !== 'call_connected') {
        showError('Please submit the interview with the selected call status.');
        return;
      }
      
      // Call is connected, reset timer to 0 and allow proceeding
      // Timer will start automatically via useEffect after this
      setTotalTime(0);
    }
    
    // For CAPI interviews, check if polling station is selected before allowing navigation
    if (!isCatiMode && currentQuestion) {
      // Check if current question is polling station selection - check by ID, type, or flag
      const isPollingStationQuestion = currentQuestion.id === 'polling-station-selection' ||
                                      currentQuestion.type === 'polling_station' ||
                                      currentQuestion.isPollingStationSelection ||
                                      (currentQuestion.text && currentQuestion.text.toLowerCase().includes('select polling station'));
      
      if (isPollingStationQuestion) {
        if (!selectedPollingStation.groupName || !selectedPollingStation.stationName) {
          showError('Please select both Group and Polling Station before proceeding.');
          return;
        }
        
        // Check geofencing error for polling station questions (only if booster is DISABLED - geofencing enforced when booster is OFF)
        if (geofencingError && !locationControlBooster) {
          showError(geofencingError);
          return;
        }
      }
      
      // Check for phone number validation (only in CAPI mode)
      const questionText = currentQuestion.text || '';
      const isPhoneQuestion = questionText.toLowerCase().includes('share your mobile') || 
                              questionText.toLowerCase().includes('mobile number') ||
                              questionText.toLowerCase().includes('phone number');
      
      if (isPhoneQuestion) {
        const phoneResponse = responses[currentQuestion.id];
        
        // Check if "refused to share phone number" is selected (stored as 0 or '0')
        const didNotAnswer = phoneResponse === 0 || phoneResponse === '0' || phoneResponse === null || phoneResponse === undefined;
        
        // Only validate if "refused to share phone number" is NOT selected
        if (!didNotAnswer) {
          const validation = validatePhoneNumber(phoneResponse);
          if (!validation.valid) {
            showError(validation.message);
            return;
          }
        }
        // If "refused to share phone number" is selected, allow proceeding without validation
      }
    }
    
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // End of survey
      completeInterview();
    }
  };

  // Navigate to previous question - EXACTLY like React Native
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Navigate to specific question - find in visibleQuestions
  const navigateToQuestion = (questionId) => {
    const questionIndex = visibleQuestions.findIndex(q => q.id === questionId);
    if (questionIndex !== -1) {
      setCurrentQuestionIndex(questionIndex);
    }
  };

  // Start the interview process after permissions are granted
  const startInterviewProcess = useCallback(async () => {
    try {
      let response;
      
      if (isCatiMode) {
        // CATI mode - use CATI-specific endpoint
        response = await catiInterviewAPI.startCatiInterview(survey._id);
        
        if (response.success) {
          setSessionData(response.data);
          setSessionId(response.data.sessionId);
          setCatiRespondent(response.data.respondent);
          setCatiQueueId(response.data.respondent.id);
          
          // Auto-populate AC and PC from respondent info for CATI interviews
          if (response.data.respondent && response.data.respondent.ac) {
            setSelectedAC(response.data.respondent.ac);
            // Also set it in responses for consistency
            setResponses(prev => ({
              ...prev,
              'ac-selection': response.data.respondent.ac
            }));
          }
          
          setIsPaused(false);
          setIsInterviewActive(true);
          setCallStatus('idle');
          // No location or audio recording for CATI
          // Auto-make call after interface is ready (using setTimeout to avoid dependency issue)
          setTimeout(() => {
            if (response.data.respondent.id) {
              // Call the API directly to avoid dependency on makeCallToRespondent
              catiInterviewAPI.makeCallToRespondent(response.data.respondent.id)
                .then(callResponse => {
                  if (callResponse.success) {
                    setCallId(callResponse.data.callId);
                    setCallStatus('calling');
                    showSuccess('Call initiated. Waiting for connection...');
                  } else {
                    setCallStatus('failed');
                    // Extract detailed error message from API response
                    const errorMsg = callResponse.message || 
                                    callResponse.error?.message || 
                                    callResponse.error || 
                                    'Failed to initiate call';
                    showError(`Call failed: ${errorMsg}. You can abandon this interview or try again.`);
                  }
                })
                .catch(error => {
                  console.error('Error making call:', error);
                  setCallStatus('failed');
                  // Extract detailed error message from error response
                  const errorMsg = error.response?.data?.message || 
                                  error.response?.data?.error?.message || 
                                  error.response?.data?.error || 
                                  error.message || 
                                  'Failed to make call';
                  showError(`Call failed: ${errorMsg}. You can abandon this interview or try again.`);
                });
            }
          }, 1500); // Delay to ensure UI is ready
        } else {
          // Show the actual error message from backend
          const errorMessage = response.message || response.data?.message || 'Failed to start CATI interview';
          showError(errorMessage);
        }
      } else {
        // CAPI mode - use standard endpoint
        response = await surveyResponseAPI.startInterview(survey._id);
        
      if (response.success) {
        setSessionData(response.data);
        setSessionId(response.data.sessionId);
        setIsPaused(false);
        setIsInterviewActive(true);

        // Start audio recording if supported and in CAPI mode
        if (survey.mode === 'capi' && audioSupported) {
          try {
            await startAudioRecording();
          } catch (error) {
            // Audio recording failed, but continue with interview
            console.warn('Audio recording failed, continuing without audio:', error);
            showError('Audio recording unavailable. Interview will continue without audio recording.');
          }
        } else if (survey.mode === 'capi' && !audioSupported) {
          console.warn('Audio recording not supported in this browser/environment');
        }
      } else {
        showError('Failed to start interview');
        }
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      // Show backend error message if available
      const errorMessage = error.response?.data?.message || error.message || 'Failed to start interview';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
        setIsStarting(false);
    }
  }, [survey._id, survey.mode, isCatiMode, audioSupported, startAudioRecording, showError]);

  // Check audio permission separately
  const checkAudioPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      console.log('Audio permission granted');
      
      // Continue with interview start
      await startInterviewProcess();
    } catch (audioErr) {
      console.error('Audio permission error:', audioErr);
      
      // Show modern permission modal
      setPermissionType('audio');
      setPermissionError(audioErr.message);
      setShowPermissionModal(true);
        setIsLoading(false);
      setIsStarting(false);
    }
  }, [startInterviewProcess]);

  // Start the actual interview
  const startActualInterview = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsStarting(true);
      setShowWelcomeModal(false);
      
      if (isCatiMode) {
        // CATI mode - skip location and audio, start directly
        await startInterviewProcess();
        // Auto-call is handled in startInterviewProcess after queueId is set
      } else {
        // CAPI mode - check for location and audio permissions first
      setLocationPermission('checking');
      setLocationError(null);
      
      try {
        // Get location
        const locationData = await getCurrentLocation();
        setGpsLocation(locationData);
        setLocationPermission('granted');
        console.log('Location obtained:', locationData);
        
        // Location successful, now check audio
        await checkAudioPermission();
      } catch (locationErr) {
        console.error('Location error:', locationErr);
        setLocationError(locationErr.message);
        setLocationPermission('denied');
        
        // Show modern permission modal with option to continue without location
        setPermissionType('location');
        setPermissionError(locationErr.message);
        setShowPermissionModal(true);
        setIsLoading(false);
        setIsStarting(false);
        return;
        }
      }
    } catch (error) {
      console.error('Error starting interview:', error);
      showError('Failed to start interview');
      setIsLoading(false);
      setIsStarting(false);
    }
  }, [isCatiMode, startInterviewProcess, checkAudioPermission, getCurrentLocation, showError]);

  // Make call to respondent (CATI mode)
  const makeCallToRespondent = async () => {
    if (!catiQueueId) {
      showError('No respondent assigned');
      return;
    }

    try {
      setIsLoading(true);
      setCallStatus('calling');
      
      const response = await catiInterviewAPI.makeCallToRespondent(catiQueueId);
      
      if (response.success) {
        setCallId(response.data.callId);
        setCallStatus('calling');
        showSuccess('Call initiated. Waiting for connection...');
      } else {
        // Call failed - show error but don't close interface, allow abandon
        setCallStatus('failed');
        // Extract detailed error message from API response
        const errorMsg = response.message || 
                        response.error?.message || 
                        response.error || 
                        'Failed to initiate call';
        showError(`Call failed: ${errorMsg}. You can abandon this interview.`);
      }
    } catch (error) {
      console.error('Error making call:', error);
      setCallStatus('failed');
      // Extract detailed error message from error response
      const errorMsg = error.response?.data?.message || 
                      error.response?.data?.error?.message || 
                      error.response?.data?.error || 
                      error.message || 
                      'Failed to make call';
      showError(`Call failed: ${errorMsg}. You can abandon this interview.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle interview abandonment (CATI mode)
  const handleAbandonInterview = async (callStatusFromResponse = null) => {
    if (!catiQueueId) {
      showError('No respondent assigned');
      return;
    }

    // If abandoning due to call status (not connected), use that as the reason
    if (callStatusFromResponse) {
      try {
        setIsLoading(true);
        
        // Map call status to abandonment reason
        const statusToReasonMap = {
          'busy': 'busy',
          'switched_off': 'switched_off',
          'not_reachable': 'not_reachable',
          'did_not_pick_up': 'no_answer',
          'number_does_not_exist': 'does_not_exist',
          'didnt_get_call': 'technical_issue'
        };
        
        const abandonmentReason = statusToReasonMap[callStatusFromResponse] || callStatusFromResponse;
        
        // Save call status response for stats tracking
        const callStatusResponse = responses['call-status'];
        
        const response = await catiInterviewAPI.abandonInterview(
          catiQueueId,
          abandonmentReason,
          `Call status: ${callStatusFromResponse}`,
          null, // No call later date
          callStatusResponse // Pass call status for stats
        );

        if (response.success) {
          showSuccess('Interview abandoned. Call status recorded for reporting.');
          if (onClose) onClose();
          if (onComplete) onComplete({ abandoned: true, reason: abandonmentReason, callStatus: callStatusFromResponse });
        } else {
          showError(response.message || 'Failed to record abandonment');
        }
      } catch (error) {
        console.error('Error abandoning interview:', error);
        showError('Failed to abandon interview');
      } finally {
        setIsLoading(false);
        setShowAbandonModal(false);
      }
      return;
    }

    // Original abandonment logic (from modal)
    // If call failed, allow abandoning without reason
    // Otherwise, require a reason
    if (!callStatus || callStatus !== 'failed') {
      if (!abandonReason) {
        showError('Please select a reason for abandoning the interview');
        return;
      }

      if (abandonReason === 'call_later' && !callLaterDate) {
        showError('Please select a date for calling later');
        return;
      }
    }

    try {
      setIsLoading(true);
      
      // If call failed, reason is optional
      const reasonToSend = callStatus === 'failed' ? (abandonReason || null) : abandonReason;
      
      const response = await catiInterviewAPI.abandonInterview(
        catiQueueId,
        reasonToSend,
        abandonNotes,
        abandonReason === 'call_later' ? callLaterDate : null
      );

      if (response.success) {
        showSuccess('Interview abandonment recorded');
        if (onClose) onClose();
        if (onComplete) onComplete({ abandoned: true, reason: abandonReason });
      } else {
        showError(response.message || 'Failed to record abandonment');
      }
    } catch (error) {
      console.error('Error abandoning interview:', error);
      showError('Failed to abandon interview');
    } finally {
      setIsLoading(false);
      setShowAbandonModal(false);
    }
  };

  // Complete interview
  const completeInterview = async () => {
    // Log setNumber before completing
    console.log(`📊 Completing interview - selectedSetNumber: ${selectedSetNumber} (type: ${typeof selectedSetNumber})`);
    try {
      setIsLoading(true);

      // Check if all required questions are answered
      if (!areAllRequiredQuestionsAnswered()) {
        const firstUnanswered = findFirstUnansweredRequiredQuestion();
        if (firstUnanswered) {
          // Add validation error for this question
          setValidationErrors(prev => new Set([...prev, firstUnanswered.id]));
          
          // Navigate to the first unanswered required question
          const questionIndex = visibleQuestions.findIndex(q => q.id === firstUnanswered.id);
          if (questionIndex !== -1) {
            setCurrentQuestionIndex(questionIndex);
            const sectionNumber = firstUnanswered.sectionIndex + 1;
            const questionInSection = firstUnanswered.questionIndex + 1;
            showError(`Question ${sectionNumber}.${questionInSection} is required. Please answer: "${firstUnanswered.text}"`);
            return;
          }
        }
        showError('Please answer all required questions before completing the interview.');
        return;
      }

      // Check for target audience validation errors
      if (targetAudienceErrors.size > 0) {
        const firstErrorQuestionId = targetAudienceErrors.keys().next().value;
        const errorMessage = targetAudienceErrors.get(firstErrorQuestionId);
        
        // Navigate to the first question with target audience error
        const questionIndex = visibleQuestions.findIndex(q => q.id === firstErrorQuestionId);
        if (questionIndex !== -1) {
          setCurrentQuestionIndex(questionIndex);
          showError(errorMessage);
          return;
        }
      }

      // Stop audio recording and upload if available (only for CAPI, not CATI)
      let audioUrl = null;
      let audioRecordingData = {
        hasAudio: false,
        audioUrl: null,
        recordingDuration: 0,
        format: 'mp4',
        codec: 'opus',
        bitrate: 96000,
        fileSize: 0,
        uploadedAt: null
      };
      
      // Only process audio for CAPI mode, not CATI
      if (!isCatiMode && isRecording) {
        
        // Create a promise that resolves with the audio blob
        const audioBlobPromise = new Promise((resolve) => {
          // Store the original onstop handler
          const originalOnStop = mediaRecorder.onstop;
          
          // Override the onstop handler to resolve our promise
          mediaRecorder.onstop = () => {
            console.log('Promise: MediaRecorder stopped, creating blob from chunks'); // Debug log
            
            // Create blob from the collected chunks
            const blob = new Blob(audioChunks, { type: 'audio/mp4' });
            console.log('Promise: Audio blob created:', blob.size, 'bytes'); // Debug log
            
            // Set the state
            setAudioBlob(blob);
            setAudioUrl(URL.createObjectURL(blob));
            
            // Stop all tracks to release microphone
            if (audioStream) {
              audioStream.getTracks().forEach(track => track.stop());
              setAudioStream(null);
            }
            
            // Call original handler if it exists
            if (originalOnStop) {
              originalOnStop();
            }
            
            resolve(blob);
          };
        });
        
        // Stop the recording
        stopAudioRecording();
        
        // Wait for the audio blob to be created
        
        try {
          const blob = await audioBlobPromise;
          
          if (blob && blob.size > 0) {
            audioUrl = await uploadAudioFile(blob, sessionId);
            audioRecordingData = {
              hasAudio: true,
              audioUrl: audioUrl,
              recordingDuration: Math.round(totalTime), // Use totalTime as recording duration
              format: 'mp4',
              codec: 'opus',
              bitrate: 96000,
              fileSize: blob.size,
              uploadedAt: new Date().toISOString()
            };
          } else {
            showError('Failed to create audio recording. Interview will continue without audio.');
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          showError('Failed to process audio recording. Interview will continue without audio.');
        }
      } else {
      }

      // If call status is not connected (CATI), skip consent form check and proceed with submission
      // For CATI interviews, if call status is not connected, consent form doesn't matter
      const callStatusResponse = responses['call-status'];
      const isCallConnected = callStatusResponse === 'call_connected';
      const shouldSkipConsentCheck = isCatiMode && callStatusResponse && !isCallConnected;
      
      // If consent form is disagreed, abandon the interview instead of completing
      if (isConsentDisagreed && !shouldSkipConsentCheck) {
        // Abandon interview due to consent refusal
        if (isCatiMode && catiQueueId) {
          handleAbandonInterview('consent_refused');
          return;
        } else {
          // For CAPI mode, still abandon but use standard abandon endpoint
        const consentQuestion = allQuestions.find(q => q.id === 'consent-form');
        if (consentQuestion) {
            try {
          const finalResponses = [{
            sectionIndex: consentQuestion.sectionIndex,
            questionIndex: consentQuestion.questionIndex,
            questionId: consentQuestion.id,
            questionType: consentQuestion.type,
            questionText: consentQuestion.text,
            questionDescription: consentQuestion.description,
            questionOptions: consentQuestion.options.map(opt => typeof opt === 'object' ? opt.text : opt),
            response: responses['consent-form'] || '2',
            responseTime: 0,
            isRequired: true,
            isSkipped: false
          }];
          
              // Abandon interview with only consent response
              const response = await surveyResponseAPI.abandonInterview(sessionId, finalResponses, {
              selectedAC: selectedAC || null,
              selectedPollingStation: selectedPollingStation || null,
              location: gpsLocation || null,
                setNumber: selectedSetNumber || null,
                abandonedReason: 'Consent_Form_Disagree' // Map consent refusal to standardized reason
          });
          
          if (response.success) {
                showSuccess('Interview abandoned due to consent refusal');
                if (onComplete) onComplete({ abandoned: true, reason: 'consent_refused' });
            if (onClose) onClose();
          } else {
                showError(response.message || 'Failed to abandon interview');
          }
            } catch (error) {
              console.error('Error abandoning interview:', error);
              showError('Failed to abandon interview');
            } finally {
          setIsLoading(false);
            }
          return;
          }
        }
      }
      
      // Prepare final responses array
      const finalResponses = [];
      
      allQuestions.forEach((question, index) => {
        let processedResponse = responses[question.id];
        const responseTime = stopQuestionTimer();
        
        // Handle "Others" option text input for multiple_choice and single_choice questions
        if ((question.type === 'multiple_choice' || question.type === 'single_choice') && question.options) {
          // Find "Others" option
          const othersOption = question.options.find((opt) => {
            const optText = typeof opt === 'object' ? opt.text : opt;
            return isOthersOption(optText);
          });
          const othersOptionValue = othersOption ? (typeof othersOption === 'object' ? othersOption.value || othersOption.text : othersOption) : null;
          
          if (othersOptionValue) {
            if (question.type === 'multiple_choice' && Array.isArray(processedResponse)) {
              // Multiple selection - check if "Others" is in the response
              const hasOthers = processedResponse.includes(othersOptionValue);
              if (hasOthers) {
                const othersText = othersTextInputs[`${question.id}_${othersOptionValue}`] || '';
                if (othersText) {
                  // Replace "Others" value with "Others: {text input}"
                  processedResponse = processedResponse.map((val) => {
                    if (val === othersOptionValue) {
                      return `Others: ${othersText}`;
                    }
                    return val;
                  });
                }
              }
            } else if (processedResponse === othersOptionValue) {
              // Single selection - check if "Others" is selected
              const othersText = othersTextInputs[`${question.id}_${othersOptionValue}`] || '';
              if (othersText) {
                // Replace "Others" value with "Others: {text input}"
                processedResponse = `Others: ${othersText}`;
              }
            }
          }
        }
        
        // Convert options to the format expected by backend (array of strings)
        const questionOptions = question.options ? 
          question.options.map(option => {
            if (typeof option === 'object') {
              return option.text || option.value || option;
            }
            return option;
          }) : [];
        
        finalResponses.push({
          sectionIndex: question.sectionIndex,
          questionIndex: question.questionIndex,
          questionId: question.id,
          questionType: question.type,
          questionText: question.text,
          questionDescription: question.description,
          questionOptions: questionOptions,
          response: processedResponse || (question.type === 'multiple_choice' ? [] : ''),
          responseTime,
          isRequired: question.required || false,
          isSkipped: !hasResponseContent(processedResponse)
        });
      });

      // Calculate quality metrics
      const qualityMetrics = {
        averageResponseTime: finalResponses.length > 0 
          ? Math.round(finalResponses.reduce((sum, r) => sum + r.responseTime, 0) / finalResponses.length)
          : 0,
        totalPauses: 0,
        totalPauseTime: 0,
        backNavigationCount: 0,
        dataQualityScore: 100
      };

      // Extract interviewer ID and supervisor ID from responses (for survey 68fd1915d41841da463f0d46)
      const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
      let oldInterviewerID = null;
      let supervisorID = null;
      if (isTargetSurvey) {
        const interviewerIdResponse = responses['interviewer-id'];
        if (interviewerIdResponse !== null && interviewerIdResponse !== undefined && interviewerIdResponse !== '') {
          oldInterviewerID = String(interviewerIdResponse);
        }
        
        const supervisorIdResponse = responses['supervisor-id'];
        if (supervisorIdResponse !== null && supervisorIdResponse !== undefined && supervisorIdResponse !== '') {
          supervisorID = String(supervisorIdResponse);
        }
      }

      let response;
      
      if (isCatiMode && catiQueueId) {
        // CATI mode - extract call status from responses
        const callStatusResponse = responses['call-status'];
        
        // If call status is not connected, allow submission but it will be auto-rejected
        // Only block if call failed AND no call status was selected
        if ((callStatus === 'failed' || !callId) && !callStatusResponse) {
          showError('Cannot submit interview: Call was not successfully initiated. Please select a call status or abandon this interview.');
          setIsLoading(false);
          return;
        }
        
        // CATI mode - use CATI-specific completion endpoint
        const totalQuestions = allQuestions.length;
        const answeredQuestions = finalResponses.filter(r => hasResponseContent(r.response)).length;
        const completionPercentage = Math.round((answeredQuestions / totalQuestions) * 100);
        
        // Determine final call status: if call_connected was selected, use 'success', otherwise use the selected status
        const finalCallStatus = callStatusResponse === 'call_connected' ? 'success' : (callStatusResponse || 'unknown');
        
        response = await catiInterviewAPI.completeCatiInterview(
          catiQueueId,
          sessionId,
          finalResponses,
          selectedAC,
          selectedPollingStation.stationName ? {
            state: selectedPollingStation.state,
            acNo: selectedPollingStation.acNo,
            acName: selectedPollingStation.acName,
            pcNo: selectedPollingStation.pcNo,
            pcName: selectedPollingStation.pcName,
            district: selectedPollingStation.district,
            groupName: selectedPollingStation.groupName,
            stationName: selectedPollingStation.stationName,
            gpsLocation: selectedPollingStation.gpsLocation,
            latitude: selectedPollingStation.latitude,
            longitude: selectedPollingStation.longitude
          } : null,
          totalTime,
          sessionData?.startTime || new Date(),
          new Date(),
          totalQuestions,
          answeredQuestions,
          completionPercentage,
          selectedSetNumber, // Save which Set was shown in this CATI interview
          oldInterviewerID, // Save old interviewer ID
          finalCallStatus, // Send call status to backend
          supervisorID // Save supervisor ID
        );
      } else {
        // CAPI mode - use standard completion endpoint
        response = await surveyResponseAPI.completeInterview(
        sessionId, 
        finalResponses, 
        qualityMetrics, 
        {
          survey: survey._id,
          interviewer: sessionData?.interviewer || 'current-user',
            status: 'Pending_Approval',
          sessionId: sessionId,
          startTime: sessionData?.startTime || new Date(),
          endTime: new Date(),
          totalTimeSpent: totalTime,
          interviewMode: survey.mode || 'capi',
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            browser: 'Chrome',
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          audioRecording: audioRecordingData,
          selectedAC: selectedAC,
          selectedPollingStation: selectedPollingStation.stationName ? {
            state: selectedPollingStation.state,
            acNo: selectedPollingStation.acNo,
            acName: selectedPollingStation.acName,
            pcNo: selectedPollingStation.pcNo,
            pcName: selectedPollingStation.pcName,
            district: selectedPollingStation.district,
            groupName: selectedPollingStation.groupName,
            stationName: selectedPollingStation.stationName,
            gpsLocation: selectedPollingStation.gpsLocation,
            latitude: selectedPollingStation.latitude,
            longitude: selectedPollingStation.longitude
          } : null,
          location: gpsLocation, // Include location data for CAPI
          totalQuestions: allQuestions.length,
          answeredQuestions: finalResponses.filter(r => hasResponseContent(r.response)).length,
          skippedQuestions: finalResponses.filter(r => !hasResponseContent(r.response)).length,
          completionPercentage: Math.round((finalResponses.filter(r => hasResponseContent(r.response)).length / allQuestions.length) * 100),
          setNumber: selectedSetNumber, // Save which Set was shown in this interview
          OldinterviewerID: oldInterviewerID // Save old interviewer ID
        }
      );
      }
      
      if (response.success) {
        const responseId = response.data?.responseId || response.data?.responseId;
        showSuccess(`Interview completed successfully! Response ID: ${responseId}. Your response has been submitted for quality approval.`);
        onComplete && onComplete({
          survey: survey._id,
          responses: finalResponses,
          sessionId: sessionId,
          totalTime: totalTime,
          responseId: responseId,
          status: response.data?.status || 'Pending_Approval'
        });
        onClose();
      } else {
        showError('Failed to complete interview');
      }
    } catch (error) {
      console.error('Error completing interview:', error);
      showError('Failed to complete interview');
    } finally {
      setIsLoading(false);
    }
  };

  // Abandon interview
  const abandonInterview = async () => {
    if (isCatiMode) {
      // CATI mode - show abandonment modal
      setShowAbandonModal(true);
    } else {
      // CAPI mode - check if reason is provided
      if (!abandonReason) {
        showError('Please select a reason for abandoning the interview');
        return;
      }
      
      if (abandonReason === 'other' && !abandonNotes.trim()) {
        showError('Please specify the custom reason');
        return;
      }
      
      try {
        setIsLoading(true);
        if (sessionId) {
          console.log('📋 Current responses state:', Object.keys(responses).length, 'responses');
          console.log('📋 Response keys:', Object.keys(responses));
          
          // Build final responses array (similar to completeInterview)
          // Filter out AC selection and Polling Station questions (backend will also filter, but we do it here too for clarity)
          const finalResponses = [];
          
          allQuestions.forEach((question) => {
            // Skip AC selection and Polling Station questions (they're excluded from terminated responses)
            const questionId = question.id || '';
            const questionText = (question.text || '').toLowerCase();
            const isACSelection = questionId === 'ac-selection' || 
                                 questionText.includes('assembly constituency') ||
                                 questionText.includes('select assembly constituency');
            const isPollingStation = questionId === 'polling-station-selection' ||
                                    question.type === 'polling_station' ||
                                    question.isPollingStationSelection ||
                                    questionText.includes('polling station') ||
                                    questionText.includes('select polling station');
            
            if (isACSelection || isPollingStation) {
              return; // Skip these questions
            }
            
            let processedResponse = responses[question.id];
            
            // Handle "Others" option text input for multiple_choice and single_choice questions
            if ((question.type === 'multiple_choice' || question.type === 'single_choice') && question.options) {
              const othersOption = question.options.find((opt) => {
                const optText = typeof opt === 'object' ? opt.text : opt;
                return isOthersOption(optText);
              });
              const othersOptionValue = othersOption ? (typeof othersOption === 'object' ? othersOption.value || othersOption.text : othersOption) : null;
              
              if (othersOptionValue) {
                if (question.type === 'multiple_choice' && Array.isArray(processedResponse)) {
                  const hasOthers = processedResponse.includes(othersOptionValue);
                  if (hasOthers) {
                    const othersText = othersTextInputs[`${question.id}_${othersOptionValue}`] || '';
                    if (othersText) {
                      processedResponse = processedResponse.map((val) => {
                        if (val === othersOptionValue) {
                          return `Others: ${othersText}`;
                        }
                        return val;
                      });
                    }
                  }
                } else if (processedResponse === othersOptionValue) {
                  const othersText = othersTextInputs[`${question.id}_${othersOptionValue}`] || '';
                  if (othersText) {
                    processedResponse = `Others: ${othersText}`;
                  }
                }
              }
            }
            
            const questionOptions = question.options ? 
              question.options.map(option => {
                if (typeof option === 'object') {
                  return option.text || option.value || option;
                }
                return option;
              }) : [];
            
            finalResponses.push({
              sectionIndex: question.sectionIndex,
              questionIndex: question.questionIndex,
              questionId: question.id,
              questionType: question.type,
              questionText: question.text,
              questionDescription: question.description,
              questionOptions: questionOptions,
              response: processedResponse || (question.type === 'multiple_choice' ? [] : ''),
              responseTime: 0,
              isRequired: question.required || false,
              isSkipped: !hasResponseContent(processedResponse)
            });
          });
          
          // Prepare metadata with abandonment reason
          const finalAbandonReason = abandonReason === 'other' ? abandonNotes.trim() : abandonReason;
          const metadata = {
            selectedAC: selectedAC || null,
            selectedPollingStation: selectedPollingStation || null,
            location: gpsLocation || null,
            qualityMetrics: {
              averageResponseTime: 0,
              backNavigationCount: 0,
              dataQualityScore: 0,
              totalPauseTime: 0,
              totalPauses: 0
            },
            setNumber: selectedSetNumber || null,
            abandonedReason: finalAbandonReason,
            abandonmentNotes: abandonReason !== 'other' ? abandonNotes : null
          };
          
          console.log('📤 Abandoning interview with responses:', finalResponses.length, 'questions');
          console.log('📤 Responses with content:', finalResponses.filter(r => hasResponseContent(r.response)).length);
          
          const result = await surveyResponseAPI.abandonInterview(sessionId, finalResponses, metadata);
          
          if (result.success) {
            setShowAbandonConfirm(false);
            setAbandonReason('');
            setAbandonNotes('');
            if (result.data?.responseId) {
              showSuccess(`Interview abandoned. Response saved with Terminated status (ID: ${result.data.responseId})`);
            } else {
              showSuccess('Interview abandoned (no valid responses to save)');
            }
            if (onClose) onClose();
            if (onComplete) onComplete({ abandoned: true, reason: finalAbandonReason });
          } else {
            showError(result.message || 'Failed to abandon interview');
          }
        }
      } catch (error) {
        console.error('Error abandoning interview:', error);
        showError('Failed to abandon interview');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Pause/Resume interview
  const pauseInterview = () => {
    console.log('Pausing interview...'); // Debug log
    setIsPaused(true);
    // Timer will pause automatically via useEffect when isPaused becomes true
    
    // Pause audio recording if active
    if (isRecording && !isAudioPaused) {
      pauseAudioRecording();
    }
  };

  const resumeInterview = () => {
    console.log('Resuming interview...'); // Debug log
    setIsPaused(false);
    // Timer will resume automatically via useEffect when isPaused becomes false
    
    // Resume audio recording if it was paused
    if (isRecording && isAudioPaused) {
      resumeAudioRecording();
    }
  };

  // Prevent navigation during active interview
  useEffect(() => {
    if (!isInterviewActive) return;

    // Push a state to prevent back button navigation
    window.history.pushState(null, '', window.location.href);

    // Handle browser back/forward button
    const handlePopState = (event) => {
      event.preventDefault();
      // Show abandon modal
      if (isCatiMode) {
        setShowAbandonModal(true);
      } else {
        setShowAbandonConfirm(true);
      }
      // Push state again to prevent navigation
      window.history.pushState(null, '', window.location.href);
    };

    // Handle page refresh/close
    const handleBeforeUnload = (event) => {
      // Show browser's default confirmation dialog
      event.preventDefault();
      event.returnValue = 'Are you sure you want to leave? Your interview progress will be lost.';
      return event.returnValue;
    };

    // Add event listeners
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInterviewActive, isCatiMode]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      
      // Cleanup audio stream
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
      }
      
      // Cleanup audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [stopTimer, audioStream, audioUrl]);

  // Cleanup audio recording on unmount only
  useEffect(() => {
    return () => {
      // Only stop recording on component unmount, not on dependency changes
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    };
  }, []); // Empty dependency array - only runs on mount/unmount

  // Start question timer when question index changes (not question object to avoid loops)
  const lastQuestionIndexRef = useRef(-1);
  useEffect(() => {
    if (currentQuestionIndex !== lastQuestionIndexRef.current && currentQuestion) {
      lastQuestionIndexRef.current = currentQuestionIndex;
      setQuestionStartTime(Date.now());
    }
  }, [currentQuestionIndex]); // Only depend on index, not question object

  // Debug timer state changes
  useEffect(() => {
  }, [totalTime]);

  // Test timer functionality
  useEffect(() => {
    if (isInterviewActive && !isPaused) {
    }
  }, [isInterviewActive, isPaused]);

  // Alternative timer using useEffect
  // For CATI interviews, only start timer after call status question is passed (call_connected selected)
  useEffect(() => {
    let interval;
    if (isInterviewActive && !isPaused) {
      // For CATI, check if call status is connected before starting timer
      if (isCatiMode) {
        const callStatusResponse = responses['call-status'];
        const isCallConnected = callStatusResponse === 'call_connected';
        if (!isCallConnected) {
          // Don't start timer if call is not connected
          return;
        }
      }
      
      interval = setInterval(() => {
        setTotalTime(prev => {
          const newTime = prev + 1;
          return newTime;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isInterviewActive, isPaused, isCatiMode, responses]);


  // Helper function to check if an option should not be shuffled
  const isNonShufflableOption = (option) => {
    // Get option text and value, then strip translations
    const rawOptionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
    const rawOptionValue = typeof option === 'object' ? (option.value || option.text || '') : String(option);
    
    // Strip translations before checking
    const optionText = getMainText(rawOptionText).toLowerCase().trim();
    const optionValue = getMainText(rawOptionValue).toLowerCase().trim();
    
    // Check for special options that should not be shuffled
    // 1. None
    if (optionText === 'none' || optionValue === 'none') return true;
    
    // 2. Others (Specify) and variants - check for "other" or "others" (may include "specify")
    if (optionText.includes('other') || optionValue.includes('other')) {
      return true; // Matches "Other", "Others", "Others (specify)", "Others (Specify)", etc.
    }
    
    // 3. NOTA
    if (optionText === 'nota' || optionValue === 'nota') return true;
    
    // 4. Not eligible for voting / Not eligible
    if (optionText.includes('not eligible') || optionValue.includes('not eligible')) return true;
    
    // 5. No response / Refused to answer / Refused
    if (optionText.includes('no response') || optionValue.includes('no response') ||
        optionText.includes('refused') || optionValue.includes('refused')) return true;
    
    // 6. Independent
    if (optionText === 'independent' || optionValue === 'independent') return true;
    
    // 7. Did not vote / Didn't vote
    if (optionText.includes('did not vote') || optionValue.includes('did not vote') ||
        optionText.includes('didn\'t vote') || optionValue.includes('didn\'t vote') ||
        optionText.includes('didnt vote') || optionValue.includes('didnt vote')) return true;
    
    return false;
  };

  // Fisher-Yates shuffle algorithm for randomizing options (only shufflable ones)
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Get shuffled options for a question (shuffle once, then reuse)
  // ONLY for multiple_choice questions, and only if shuffleOptions is enabled
  // Special options (None, Others, NOTA, etc.) are kept in their original positions
  const getShuffledOptions = (questionId, originalOptions, question) => {
    if (!originalOptions || originalOptions.length === 0) return originalOptions;
    
    // Only check shuffleOptions flag for multiple_choice questions
    // Check if shuffling is enabled for this question (default to true if not set for backward compatibility)
    const shouldShuffle = question?.settings?.shuffleOptions !== false;
    
    // If shuffling is disabled, still move "Others" to the end
    if (!shouldShuffle) {
      // Separate "Others" options from regular options
      const othersOptions = [];
      const regularOptions = [];
      
      originalOptions.forEach((option) => {
        const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
        if (isOthersOption(optionText)) {
          othersOptions.push(option);
        } else {
          regularOptions.push(option);
        }
      });
      
      // Return with "Others" at the end
      return [...regularOptions, ...othersOptions];
    }
    
    // If already shuffled for this question, ensure "Others" is at the end and return
    if (shuffledOptions[questionId]) {
      const cached = shuffledOptions[questionId];
      // Always check and ensure "Others" is at the end
      const othersOptions = [];
      const regularOptions = [];
      cached.forEach((option) => {
        const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
        if (isOthersOption(optionText)) {
          othersOptions.push(option);
        } else {
          regularOptions.push(option);
        }
      });
      
      // If "Others" options exist and are not at the end, reorder
      if (othersOptions.length > 0) {
        const finalResult = [...regularOptions, ...othersOptions];
        // Cache the shuffled order so it doesn't shuffle again
        // Use setTimeout to defer state update to avoid render loop
        setTimeout(() => {
          setShuffledOptions(prev => {
            // Only update if not already set to avoid unnecessary updates
            if (!prev[questionId] || JSON.stringify(prev[questionId]) !== JSON.stringify(finalResult)) {
              return {
                ...prev,
                [questionId]: finalResult
              };
            }
            return prev;
          });
        }, 0);
        return finalResult;
      }
      
      // No "Others" options, return as is
      return cached;
    }
    
    // Separate options: shufflable, non-shufflable (except Others), and Others
    const nonShufflableOptions = []; // Non-shufflable options except "Others"
    const shufflableOptions = [];
    const othersOptions = []; // "Others" options - will be placed at the end
    const originalIndices = new Map(); // Track original indices for non-shufflable options (except Others)
    
    originalOptions.forEach((option, index) => {
      const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
      if (isOthersOption(optionText)) {
        // "Others" options - will be placed at the end
        othersOptions.push(option);
      } else if (isNonShufflableOption(option)) {
        // Other non-shufflable options - maintain original position
        nonShufflableOptions.push({ option, originalIndex: index });
        originalIndices.set(index, option);
      } else {
        // Shufflable options
        shufflableOptions.push(option);
      }
    });
    
    // Shuffle only the shufflable options
    const shuffledShufflable = shuffleArray(shufflableOptions);
    
    // Reconstruct the array maintaining original positions of non-shufflable options (except Others)
    const result = [];
    let shufflableIndex = 0;
    let nonShufflableIndex = 0;
    
    for (let i = 0; i < originalOptions.length; i++) {
      const option = originalOptions[i];
      const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
      
      if (isOthersOption(optionText)) {
        // Skip "Others" options - they'll be added at the end
        continue;
      } else if (originalIndices.has(i)) {
        // Place non-shufflable option in its original position
        result.push(nonShufflableOptions[nonShufflableIndex].option);
        nonShufflableIndex++;
      } else {
        // Place shuffled option
        result.push(shuffledShufflable[shufflableIndex]);
        shufflableIndex++;
      }
    }
    
    // Combine: regular options first, then "Others" options at the end
    const finalResult = [...result, ...othersOptions];
    
    // Cache the shuffled order so it doesn't shuffle again
    // Use a ref check to avoid state update during render if already cached
    if (!shuffledOptions[questionId]) {
      // Use setTimeout to defer state update to avoid render loop
      setTimeout(() => {
        setShuffledOptions(prev => {
          // Double-check to avoid race conditions
          if (!prev[questionId]) {
            return {
              ...prev,
              [questionId]: finalResult
            };
          }
          return prev;
        });
      }, 0);
    }
    
    return finalResult;
  };

  // Render question input based on type
  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    const { type, options, required } = currentQuestion;
    const currentResponse = responses[currentQuestion.id] || '';
    const questionId = currentQuestion.id;

    // Filter options for "Second Choice" question based on "2025 Preference" selection
    // ONLY for survey "68fd1915d41841da463f0d46"
    let filteredOptions = options;
    const questionText = currentQuestion.text || '';
    const isSecondChoiceQuestion = questionText.includes('Second Choice') || 
                                   questionText.includes('দ্বিতীয় পছন্দ') ||
                                   questionText.toLowerCase().includes('second choice');
    
    // Only apply this filtering logic for the specific survey
    const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
    
    // Find "2025 Preference" question - declare it outside the if block so it's accessible everywhere
    const allQuestionsList = allQuestions.length > 0 ? allQuestions : (allQuestionsRef.current.length > 0 ? allQuestionsRef.current : visibleQuestions);
    let preference2025Question = null;
    if (isTargetSurvey && isSecondChoiceQuestion) {
      preference2025Question = allQuestionsList.find(q => {
        const qText = q.text || '';
        return qText.includes('2025 Preference') || 
               qText.includes('২০২৫ পছন্দ') ||
               qText.toLowerCase().includes('2025 preference');
      });
    }
    
    if (isTargetSurvey && isSecondChoiceQuestion && options) {
      if (preference2025Question) {
        const preferenceResponse = responses[preference2025Question.id];
        console.log('🔍 Second Choice Filtering Debug:', {
          surveyId: survey?._id || survey?.id,
          preferenceQuestionId: preference2025Question.id,
          preferenceQuestionText: preference2025Question.text,
          preferenceResponse: preferenceResponse,
          currentQuestionId: currentQuestion.id,
          currentQuestionText: currentQuestion.text
        });
        
        if (preferenceResponse) {
          // Get the selected option value (handle both string and array responses)
          let selectedOptionValue = null;
          if (Array.isArray(preferenceResponse)) {
            selectedOptionValue = preferenceResponse[0]; // Take first selection
          } else {
            selectedOptionValue = preferenceResponse;
          }
          
          // Find the matched option from "2025 Preference" question
          let matchedOptionFromPreference = null;
          if (preference2025Question.options && preference2025Question.options.length > 0) {
            // Find the option that matches the response
            matchedOptionFromPreference = preference2025Question.options.find(opt => {
              const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
              const optText = typeof opt === 'object' ? opt.text : opt;
              // Try exact matches first
              return optValue === selectedOptionValue || 
                     optText === selectedOptionValue ||
                     String(optValue) === String(selectedOptionValue) ||
                     String(optText) === String(selectedOptionValue);
            });
          }
          
          // Get the main text (without translation) of the selected option for comparison
          let selectedOptionMainText = null;
          if (matchedOptionFromPreference) {
            const matchedOptionText = typeof matchedOptionFromPreference === 'object' 
              ? (matchedOptionFromPreference.text || matchedOptionFromPreference.value || '') 
              : String(matchedOptionFromPreference);
            selectedOptionMainText = getMainText(matchedOptionText);
            console.log('✅ Found matched option in 2025 Preference:', {
              matchedOption: matchedOptionFromPreference,
              selectedOptionMainText,
              selectedOptionValue
            });
          } else {
            // Fallback: use the response value and extract main text
            selectedOptionMainText = getMainText(String(selectedOptionValue));
            console.log('⚠️ No matched option found, using response value main text:', selectedOptionMainText);
          }
          
          // Filter out the selected option from "Second Choice" options using main text comparison (ignoring translations)
          if (selectedOptionMainText) {
            
            filteredOptions = options.filter(option => {
              const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
              const optionValue = typeof option === 'object' ? (option.value || option.text) : option;
              
              // Get main text (without translation) for comparison
              const optionMainText = getMainText(optionText);
              const optionValueMainText = getMainText(String(optionValue));
              
              // Compare main texts (ignoring translations)
              if (optionMainText === selectedOptionMainText || optionValueMainText === selectedOptionMainText) {
                return false; // Exclude this option
              }
              
              // Also check if the option value matches the selected value (exact match)
              if (optionValue === selectedOptionValue || String(optionValue) === String(selectedOptionValue)) {
                return false; // Exclude this option
              }
              
              return true; // Keep this option
            });
          }
        }
      }
    }

    // Get shuffled options ONLY for multiple_choice questions (if shuffleOptions is enabled)
    // For single_choice and dropdown, move "Others" to the end
    // Dropdown and other question types use original order
    // IMPORTANT: For "Second Choice" questions, use cached shuffled options but filter out the excluded option
    // This maintains the shuffled order while removing the excluded option
    let displayOptions = filteredOptions;
    if (type === 'multiple_choice') {
      // For "Second Choice" questions, use cached shuffled options but remove excluded option
      if (isTargetSurvey && isSecondChoiceQuestion) {
        // Check if we have cached shuffled options
        if (shuffledOptions[questionId] && shuffledOptions[questionId].length > 0) {
          // Use cached shuffled options, but filter out the excluded option
          const cachedShuffled = shuffledOptions[questionId];
          // Get the excluded option main text for comparison
          const allQuestionsList = allQuestions.length > 0 ? allQuestions : (allQuestionsRef.current.length > 0 ? allQuestionsRef.current : visibleQuestions);
          const preference2025Question = allQuestionsList.find(q => {
            const qText = q.text || '';
            return qText.includes('2025 Preference') || 
                   qText.includes('২০২৫ পছন্দ') ||
                   qText.toLowerCase().includes('2025 preference');
          });
          
          if (preference2025Question) {
            const preferenceResponse = responses[preference2025Question.id];
            if (preferenceResponse) {
              let selectedOptionValue = null;
              if (Array.isArray(preferenceResponse)) {
                selectedOptionValue = preferenceResponse[0];
              } else {
                selectedOptionValue = preferenceResponse;
              }
              
              // Find the matched option and get its main text
              let selectedOptionMainText = null;
              if (preference2025Question.options && preference2025Question.options.length > 0) {
                const matchedOption = preference2025Question.options.find(opt => {
                  const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return optValue === selectedOptionValue || 
                         optText === selectedOptionValue ||
                         String(optValue) === String(selectedOptionValue) ||
                         String(optText) === String(selectedOptionValue);
                });
                
                if (matchedOption) {
                  const matchedOptionText = typeof matchedOption === 'object' 
                    ? (matchedOption.text || matchedOption.value || '') 
                    : String(matchedOption);
                  selectedOptionMainText = getMainText(matchedOptionText);
                } else {
                  selectedOptionMainText = getMainText(String(selectedOptionValue));
                }
              } else {
                selectedOptionMainText = getMainText(String(selectedOptionValue));
              }
              
              // Filter out the excluded option from cached shuffled options
              if (selectedOptionMainText) {
                displayOptions = cachedShuffled.filter(option => {
                  const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
                  const optionValue = typeof option === 'object' ? (option.value || option.text) : option;
                  const optionMainText = getMainText(optionText);
                  const optionValueMainText = getMainText(String(optionValue));
                  
                  // Exclude if main text matches
                  if (optionMainText === selectedOptionMainText || optionValueMainText === selectedOptionMainText) {
                    return false;
                  }
                  // Exclude if value matches
                  if (optionValue === selectedOptionValue || String(optionValue) === String(selectedOptionValue)) {
                    return false;
                  }
                  return true;
                });
              } else {
                displayOptions = cachedShuffled;
              }
            } else {
              // No Q8 response yet, use cached shuffled options as is
              displayOptions = cachedShuffled;
            }
          } else {
            // Couldn't find Q8, use cached shuffled options as is
            displayOptions = cachedShuffled;
          }
        } else {
          // No cache yet, compute shuffled options from ORIGINAL options (not filtered) and cache them
          // We'll filter out the excluded option when displaying
          displayOptions = getShuffledOptions(questionId, options, currentQuestion);
          // After caching, filter out the excluded option for display
          if (preference2025Question) {
            const preferenceResponse = responses[preference2025Question.id];
            if (preferenceResponse) {
              let selectedOptionValue = null;
              if (Array.isArray(preferenceResponse)) {
                selectedOptionValue = preferenceResponse[0];
              } else {
                selectedOptionValue = preferenceResponse;
              }
              
              let selectedOptionMainText = null;
              if (preference2025Question.options && preference2025Question.options.length > 0) {
                const matchedOption = preference2025Question.options.find(opt => {
                  const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return optValue === selectedOptionValue || 
                         optText === selectedOptionValue ||
                         String(optValue) === String(selectedOptionValue) ||
                         String(optText) === String(selectedOptionValue);
                });
                
                if (matchedOption) {
                  const matchedOptionText = typeof matchedOption === 'object' 
                    ? (matchedOption.text || matchedOption.value || '') 
                    : String(matchedOption);
                  selectedOptionMainText = getMainText(matchedOptionText);
                } else {
                  selectedOptionMainText = getMainText(String(selectedOptionValue));
                }
              } else {
                selectedOptionMainText = getMainText(String(selectedOptionValue));
              }
              
              if (selectedOptionMainText) {
                displayOptions = displayOptions.filter(option => {
                  const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
                  const optionValue = typeof option === 'object' ? (option.value || option.text) : option;
                  const optionMainText = getMainText(optionText);
                  const optionValueMainText = getMainText(String(optionValue));
                  
                  if (optionMainText === selectedOptionMainText || optionValueMainText === selectedOptionMainText) {
                    return false;
                  }
                  if (optionValue === selectedOptionValue || String(optionValue) === String(selectedOptionValue)) {
                    return false;
                  }
                  return true;
                });
              }
            }
          }
        }
      } else {
        // For other questions, use normal shuffling with cache
        displayOptions = getShuffledOptions(questionId, filteredOptions, currentQuestion);
      }
    } else if (type === 'single_choice' || type === 'dropdown') {
      // Move "Others" to the end for single_choice and dropdown
      const othersOptions = [];
      const regularOptions = [];
      filteredOptions.forEach((option) => {
        const optionText = typeof option === 'object' ? (option.text || option.value || '') : String(option);
        if (isOthersOption(optionText)) {
          othersOptions.push(option);
        } else {
          regularOptions.push(option);
        }
      });
      displayOptions = [...regularOptions, ...othersOptions];
    }

    switch (type) {
      case 'text':
      case 'textarea':
        return (
          <textarea
            value={currentResponse}
            onChange={(e) => handleResponseChange(currentQuestion.id, e.target.value)}
            placeholder={`Enter your ${type === 'textarea' ? 'detailed ' : ''}response...`}
            className="w-full p-6 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all duration-200"
            rows={type === 'textarea' ? 6 : 3}
            required={required}
          />
        );

      case 'number':
      case 'numeric':
        // Check if this is the phone number question
        const questionText = currentQuestion.text || '';
        const isPhoneQuestion = questionText.toLowerCase().includes('share your mobile') || 
                                questionText.toLowerCase().includes('mobile number') ||
                                questionText.toLowerCase().includes('phone number');
        const isInterviewerIdQuestion = currentQuestion.id === 'interviewer-id' || currentQuestion.isInterviewerId;
        const didNotAnswer = currentResponse === 0 || currentResponse === '0';
        
        return (
          <div className="space-y-4">
            <input
              type="number"
              value={didNotAnswer ? '' : (currentResponse !== null && currentResponse !== undefined ? currentResponse.toString() : '')}
              onChange={(e) => {
                const text = e.target.value;
                // Allow empty string or valid number (including 0 and negative numbers)
                if (text === '') {
                  handleResponseChange(currentQuestion.id, '');
                } else {
                  // For interviewer ID question, limit to 5 digits
                  if (isInterviewerIdQuestion) {
                    // Remove any non-numeric characters
                    const numericText = text.replace(/[^0-9]/g, '');
                    // Limit to 5 digits
                    if (numericText.length <= 5) {
                      const numValue = parseInt(numericText, 10);
                      if (!isNaN(numValue) && isFinite(numValue)) {
                        handleResponseChange(currentQuestion.id, numValue);
                      } else if (numericText === '') {
                        handleResponseChange(currentQuestion.id, '');
                      }
                    }
                    // If longer than 5 digits, don't update (effectively blocks input)
                  } else {
                    const numValue = parseFloat(text);
                    if (!isNaN(numValue) && isFinite(numValue)) {
                      handleResponseChange(currentQuestion.id, numValue);
                    }
                  }
                }
              }}
              placeholder={isInterviewerIdQuestion ? "Enter Interviewer ID (max 5 digits)..." : "Enter a number..."}
              disabled={didNotAnswer && isPhoneQuestion}
              max={isInterviewerIdQuestion ? 99999 : undefined}
              min={isInterviewerIdQuestion ? 0 : undefined}
              maxLength={isInterviewerIdQuestion ? 5 : undefined}
              className={`w-full p-6 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${
                didNotAnswer && isPhoneQuestion ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
              }`}
              required={required && !didNotAnswer}
            />
            {isPhoneQuestion && (
              <label className="flex items-center space-x-3 cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={didNotAnswer}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleResponseChange(currentQuestion.id, 0);
                    } else {
                      handleResponseChange(currentQuestion.id, '');
                    }
                  }}
                  className="w-5 h-5 text-[#373177] border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-lg text-gray-700">
                  {renderDisplayText('refused to share phone number {নম্বর দিতে চাননি}')}
                </span>
              </label>
            )}
          </div>
        );

      case 'multiple_choice':
        const allowMultiple = currentQuestion.settings?.allowMultiple || false;
        const maxSelections = currentQuestion.settings?.maxSelections;
        const currentSelections = Array.isArray(currentResponse) ? currentResponse.length : 0;
        const isGenderQuestionCheck = isGenderQuestion(currentQuestion);
        
        // Check if "None" option exists
        const noneOption = displayOptions.find((opt) => {
          const optText = typeof opt === 'object' ? opt.text : opt;
          return optText.toLowerCase().trim() === 'none';
        });
        const noneOptionValue = noneOption ? (typeof noneOption === 'object' ? noneOption.value || noneOption.text : noneOption) : null;
        
        // Check if "Others" option exists
        const othersOption = displayOptions.find((opt) => {
          const optText = typeof opt === 'object' ? opt.text : opt;
          return isOthersOption(optText);
        });
        const othersOptionValue = othersOption ? (typeof othersOption === 'object' ? othersOption.value || othersOption.text : othersOption) : null;
        
        // Helper to normalize option values for comparison (strip translations)
        const normalizeForComparison = (val) => {
          if (!val) return val;
          return getMainText(String(val)).toLowerCase().trim();
        };
        
        // Check if "Others" is selected (normalize both values before comparing)
        const normalizedOthersValue = othersOptionValue ? normalizeForComparison(othersOptionValue) : null;
        const isOthersSelected = allowMultiple 
          ? (Array.isArray(currentResponse) && currentResponse.some(r => normalizeForComparison(r) === normalizedOthersValue))
          : (normalizeForComparison(currentResponse) === normalizedOthersValue);
        
        return (
          <div className="space-y-4">
            {allowMultiple && maxSelections && (
              <div className="bg-[#E6F0F8] border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700 font-medium">
                  Selection limit: {currentSelections} / {maxSelections}
                </p>
              </div>
            )}
            {displayOptions.map((option, index) => {
              const optionValue = typeof option === 'object' ? option.value || option.text : option;
              const optionText = typeof option === 'object' ? option.text : option;
              const optionId = typeof option === 'object' ? option.id : index;
              // Strip translations before checking for special options
              const mainText = getMainText(String(optionText));
              const isNoneOption = mainText.toLowerCase().trim() === 'none';
              const isOthers = isOthersOption(optionText);
              
              // Get quota information for gender question
              let quotaInfo = null;
              if (isGenderQuestionCheck && genderQuotas) {
                // Normalize option value to handle translations (Male {পুরুষ}, Female {মহিলা})
                const normalizedOptionValue = normalizeGenderResponse(optionValue);
                const genderMapping = {
                  'male': 'Male',
                  'female': 'Female', 
                  'non_binary': 'Non-binary'
                };
                const mappedGender = genderMapping[normalizedOptionValue];
                if (mappedGender && genderQuotas[mappedGender]) {
                  const quota = genderQuotas[mappedGender];
                  quotaInfo = quota;
                }
              }
              
              const isSelected = allowMultiple 
                ? (Array.isArray(currentResponse) && currentResponse.includes(optionValue))
                : (currentResponse === optionValue);
              
              // Get party logo if applicable
              // Get party logo if applicable (exclude for Question 12)
              const partyLogo = getPartyLogo(optionText, currentQuestion.text);
              
              // Debug logo - always log to help debug
              return (
                <div key={optionId} className="space-y-2">
                  <label className="flex items-center space-x-4 cursor-pointer group">
                  <input
                    type={allowMultiple ? "checkbox" : "radio"}
                    name={allowMultiple ? undefined : `question-${currentQuestion.id}`}
                    checked={isSelected}
                    onChange={(e) => {
                      if (allowMultiple) {
                        let currentAnswers = Array.isArray(currentResponse) ? [...currentResponse] : [];
                        
                        if (currentAnswers.includes(optionValue)) {
                          // Deselecting - remove from array
                          // TEMPORARILY COMMENTED OUT - Order preservation logic
                          currentAnswers = currentAnswers.filter((a) => a !== optionValue);
                          
                          // Clear "Others" text input if "Others" is deselected
                          if (isOthers) {
                            setOthersTextInputs(prev => {
                              const updated = { ...prev };
                              delete updated[`${questionId}_${optionValue}`];
                              return updated;
                            });
                          }
                        } else {
                          // Selecting - add to array
                          // TEMPORARILY COMMENTED OUT - Order preservation logic
                          // Handle "None" option - mutual exclusivity
                          if (isNoneOption) {
                            // If "None" is selected, clear all other selections
                            currentAnswers = [optionValue];
                            // Clear "Others" text input if it was selected
                            if (othersOptionValue && currentAnswers.includes(othersOptionValue)) {
                              setOthersTextInputs(prev => {
                                const updated = { ...prev };
                                delete updated[`${questionId}_${othersOptionValue}`];
                                return updated;
                              });
                            }
                          } else if (isOthers) {
                            // "Others" can now be combined with other options (if multi-select is allowed)
                            // Only remove "None" if it exists (keep "None" exclusive)
                            if (noneOptionValue && currentAnswers.includes(noneOptionValue)) {
                              currentAnswers = currentAnswers.filter((a) => a !== noneOptionValue);
                            }
                            // Add "Others" to existing selections (allow combination)
                            if (!currentAnswers.includes(optionValue)) {
                              // Check if we've reached the maximum selections limit
                              if (maxSelections && currentAnswers.length >= maxSelections) {
                                showError(`Maximum ${maxSelections} selection${maxSelections > 1 ? 's' : ''} allowed`);
                                return;
                              }
                              currentAnswers.push(optionValue);
                            }
                      } else {
                            // If any other option is selected, remove "None" if it exists (keep "None" exclusive)
                            // But allow "Others" to remain (can be combined with other options)
                            if (noneOptionValue && currentAnswers.includes(noneOptionValue)) {
                              currentAnswers = currentAnswers.filter((a) => a !== noneOptionValue);
                            }
                            
                            // Check if we've reached the maximum selections limit
                            if (maxSelections && currentAnswers.length >= maxSelections) {
                              showError(`Maximum ${maxSelections} selection${maxSelections > 1 ? 's' : ''} allowed`);
                              return;
                            }
                            // Add to array
                            // TEMPORARILY COMMENTED OUT - Order preservation logic
                            currentAnswers.push(optionValue);
                          }
                        }
                        // TEMPORARILY COMMENTED OUT - Order tracking comment
                        handleResponseChange(currentQuestion.id, currentAnswers);
                      } else {
                        // Single selection
                        if (isNoneOption) {
                          // "None" selected - just set it
                        handleResponseChange(currentQuestion.id, optionValue);
                          // Clear "Others" text input if it exists
                          if (othersOptionValue && currentResponse === othersOptionValue) {
                            setOthersTextInputs(prev => {
                              const updated = { ...prev };
                              delete updated[`${questionId}_${othersOptionValue}`];
                              return updated;
                            });
                          }
                        } else if (isOthers) {
                          // "Others" selected - just set it
                          handleResponseChange(currentQuestion.id, optionValue);
                        } else {
                          // Other option selected - clear "None" and "Others" if they were selected
                          if (noneOptionValue && currentResponse === noneOptionValue) {
                            handleResponseChange(currentQuestion.id, optionValue);
                          } else if (othersOptionValue && currentResponse === othersOptionValue) {
                            handleResponseChange(currentQuestion.id, optionValue);
                            // Clear "Others" text input
                            setOthersTextInputs(prev => {
                              const updated = { ...prev };
                              delete updated[`${questionId}_${othersOptionValue}`];
                              return updated;
                            });
                          } else {
                            handleResponseChange(currentQuestion.id, optionValue);
                          }
                        }
                      }
                    }}
                      className={`w-6 h-6 border-2 border-gray-300 rounded focus:ring-blue-500 group-hover:border-blue-400 transition-colors ${
                        quotaInfo?.isFull 
                          ? 'text-gray-400 cursor-not-allowed opacity-50' 
                          : 'text-[#373177]'
                      }`}
                      disabled={quotaInfo?.isFull}
                    />
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <span className={`text-lg transition-colors flex items-center gap-2 ${
                        quotaInfo?.isFull 
                          ? 'text-gray-400 line-through' 
                          : 'text-gray-700 group-hover:text-gray-900'
                      }`}>
                        {renderDisplayText(optionText, {
                          className: ''
                        })}
                        {/* Party logo after text */}
                        {partyLogo && (
                          <img 
                            src={partyLogo} 
                            alt="Party logo" 
                            className="w-7 h-7 object-contain flex-shrink-0"
                            style={{ display: 'block', marginLeft: '4px' }}
                            onError={(e) => {
                              console.error('❌ Web - Multiple Choice - Logo failed to load:', partyLogo, e);
                              // Don't hide, just log the error
                            }}
                            onLoad={() => {
                              console.log('✅ Web - Multiple Choice - Logo loaded successfully:', partyLogo);
                            }}
                          />
                        )}
                      </span>
                      {quotaInfo && (
                        <div className="text-sm text-gray-500 mt-1">
                          {quotaInfo.isFull ? (
                            <span className="text-red-500 font-medium">Quota Full ({quotaInfo.currentCount}/{quotaInfo.quota})</span>
                          ) : (
                            <span className="text-green-600">Available ({quotaInfo.remaining} remaining)</span>
                          )}
                        </div>
                      )}
                    </div>
                </label>
                </div>
              );
            })}
            {/* Show text input for "Others" option when selected */}
            {isOthersSelected && othersOptionValue && (
              <div className="mt-4">
                <input
                  type="text"
                  value={othersTextInputs[`${questionId}_${othersOptionValue}`] || ''}
                  onChange={(e) => {
                    setOthersTextInputs(prev => ({
                      ...prev,
                      [`${questionId}_${othersOptionValue}`]: e.target.value
                    }));
                  }}
                  placeholder="Please specify..."
                  className="w-full p-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                />
              </div>
            )}
          </div>
        );

      case 'single_choice':
        return (
          <div className="space-y-4">
            {displayOptions.map((option, index) => {
              const optionValue = typeof option === 'object' ? option.value || option.text : option;
              const optionText = typeof option === 'object' ? option.text : option;
              const optionId = typeof option === 'object' ? option.id : index;
              
              // Get party logo if applicable (exclude for Question 12)
              const partyLogo = getPartyLogo(optionText, currentQuestion.text);
              
              // Debug logo
              if (partyLogo) {
              }
              
              return (
                <label key={optionId} className="flex items-center space-x-4 cursor-pointer group">
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={optionValue}
                    checked={currentResponse === optionValue}
                    onChange={(e) => handleResponseChange(currentQuestion.id, e.target.value)}
                    className="w-6 h-6 text-[#373177] border-2 border-gray-300 focus:ring-blue-500 group-hover:border-blue-400 transition-colors"
                  />
                  <span className="text-lg text-gray-700 group-hover:text-gray-900 transition-colors flex items-center gap-2">
                    {renderDisplayText(optionText, {
                      className: ''
                    })}
                    {/* Party logo after text */}
                    {partyLogo && (
                      <img 
                        src={partyLogo} 
                        alt="Party logo" 
                        className="w-7 h-7 object-contain flex-shrink-0"
                        style={{ display: 'block', marginLeft: '4px' }}
                        onError={(e) => {
                          console.error('❌ Web - Single Choice - Logo failed to load:', partyLogo, e);
                          // Don't hide, just log the error
                        }}
                        onLoad={() => {
                          console.log('✅ Web - Single Choice - Logo loaded successfully:', partyLogo);
                        }}
                      />
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        );

      case 'rating':
      case 'rating_scale':
        const scale = currentQuestion.scale || { min: 1, max: 5 };
        const min = scale.min || 1;
        const max = scale.max || 5;
        const labels = scale.labels || [];
        const minLabel = scale.minLabel || '';
        const maxLabel = scale.maxLabel || '';
        const ratings = [];
        for (let i = min; i <= max; i++) {
          ratings.push(i);
        }
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 flex-wrap gap-2">
              {ratings.map((rating) => {
                const label = labels[rating - min] || '';
                return (
                  <div key={rating} className="flex flex-col items-center space-y-1">
                <button
                  onClick={() => handleResponseChange(currentQuestion.id, rating)}
                      className={`w-12 h-12 rounded-full border-2 transition-all duration-200 flex items-center justify-center font-semibold ${
                    currentResponse === rating
                      ? 'bg-yellow-400 border-yellow-500 text-yellow-900'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-yellow-400'
                  }`}
                >
                  {rating}
                </button>
                    {label && (
                      <span className="text-xs text-gray-600 text-center max-w-[60px]">
                        {renderDisplayText(label, {
                          className: ''
                        })}
                      </span>
                    )}
            </div>
                );
              })}
            </div>
            {(minLabel || maxLabel) && (
              <div className="flex justify-between text-sm text-gray-500 px-2">
                <span>
                  {renderDisplayText(minLabel, {
                    className: ''
                  })}
                </span>
                <span>
                  {renderDisplayText(maxLabel, {
                    className: ''
                  })}
                </span>
              </div>
            )}
          </div>
        );

      case 'yes_no':
        return (
          <div className="space-y-4">
            <label className="flex items-center space-x-4 cursor-pointer group">
              <input
                type="radio"
                name={`question-${currentQuestion.id}`}
                value="yes"
                checked={currentResponse === 'yes'}
                onChange={(e) => handleResponseChange(currentQuestion.id, e.target.value)}
                className="w-6 h-6 text-green-600 border-2 border-gray-300 focus:ring-green-500 group-hover:border-green-400 transition-colors"
              />
              <span className="text-lg text-gray-700 group-hover:text-gray-900 transition-colors">Yes</span>
            </label>
            <label className="flex items-center space-x-4 cursor-pointer group">
              <input
                type="radio"
                name={`question-${currentQuestion.id}`}
                value="no"
                checked={currentResponse === 'no'}
                onChange={(e) => handleResponseChange(currentQuestion.id, e.target.value)}
                className="w-6 h-6 text-red-600 border-2 border-gray-300 focus:ring-red-500 group-hover:border-red-400 transition-colors"
              />
              <span className="text-lg text-gray-700 group-hover:text-gray-900 transition-colors">No</span>
            </label>
          </div>
        );

      case 'dropdown':
        return (
          <select
            value={currentResponse}
            onChange={(e) => handleResponseChange(currentQuestion.id, e.target.value)}
            className="w-full p-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            required={required}
          >
            <option value="">Select an option...</option>
            {options.map((option, index) => {
              const optionValue = typeof option === 'object' ? option.value || option.text : option;
              const optionText = typeof option === 'object' ? option.text : option;
              return (
                <option key={index} value={optionValue}>
                  {getDisplayText(optionText)}
                </option>
              );
            })}
          </select>
        );

      case 'date':
        return (
          <input
            type="date"
            value={currentResponse}
            onChange={(e) => handleResponseChange(currentQuestion.id, e.target.value)}
            className="w-full p-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            required={required}
          />
        );

      case 'polling_station':
        return (
          <div className="space-y-4">
            {/* Round Number Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Round Number <span className="text-red-500">*</span>
              </label>
              {loadingRoundNumbers ? (
                <div className="p-4 text-center text-gray-500">Loading round numbers...</div>
              ) : availableRoundNumbers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No round numbers available. Please select an AC first.</div>
              ) : (
                <select
                  value={selectedPollingStation.roundNumber || ''}
                  onChange={(e) => {
                    const roundNumber = e.target.value;
                    setSelectedPollingStation(prev => ({
                      ...prev,
                      roundNumber: roundNumber,
                      groupName: null, // Reset group when round changes
                      stationName: null // Reset station when round changes
                    }));
                    handleResponseChange('polling-station-round', roundNumber);
                  }}
                  className="w-full p-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  required={required}
                >
                  <option value="">Select a round number...</option>
                  {availableRoundNumbers.map((round, index) => (
                    <option key={index} value={round}>
                      Round {round}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Group Selection - Only show if round number is selected */}
            {selectedPollingStation.roundNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Group <span className="text-red-500">*</span>
              </label>
              {loadingGroups ? (
                <div className="p-4 text-center text-gray-500">Loading groups...</div>
              ) : availableGroups.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No groups available for this round. Please select a different round.</div>
              ) : (
                <select
                  value={selectedPollingStation.groupName || ''}
                  onChange={(e) => {
                    handleResponseChange('polling-station-group', e.target.value);
                  }}
                  className="w-full p-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  required={required}
                >
                  <option value="">Select a group...</option>
                  {availableGroups.map((group, index) => (
                    <option key={index} value={group.name}>
                      {group.name} ({group.polling_station_count} stations)
                    </option>
                  ))}
                </select>
              )}
            </div>
            )}

            {/* Polling Station Selection - Only show if group is selected */}
            {selectedPollingStation.groupName && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Polling Station <span className="text-red-500">*</span>
                </label>
                {loadingStations ? (
                  <div className="p-4 text-center text-gray-500">Loading polling stations...</div>
                ) : availablePollingStations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No polling stations available for this group.</div>
                ) : (
                  <select
                    value={selectedPollingStation.stationName || ''}
                    onChange={(e) => {
                      handleResponseChange('polling-station-station', e.target.value);
                    }}
                    className="w-full p-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    required={required}
                  >
                    <option value="">Select a polling station...</option>
                    {availablePollingStations.map((station, index) => (
                      <option key={index} value={station.name}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                )}
                {/* Geo-fencing error display - only show if booster is disabled */}
                {geofencingError && !locationControlBooster && (
                  <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                    <p className="text-red-800 font-medium text-sm">
                      🔒 {geofencingError}
                    </p>
                    <p className="text-red-600 text-xs mt-2">
                      You must be within 5KM of the polling station to proceed. If you have Location Control Booster enabled, please contact your administrator.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="p-8 text-center text-gray-500">
            <p>Unsupported question type: {type}</p>
          </div>
        );
    }
  };

  // Welcome Modal
  if (showWelcomeModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 transform transition-all duration-500 ease-out animate-in fade-in-0 zoom-in-95">
          <div className="text-center">
            {/* Animated Icon */}
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#E6F0F8]0 to-[#373177] rounded-full mx-auto flex items-center justify-center animate-pulse">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Interview Ready
            </h2>

            {/* Survey Info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">{survey.surveyName}</h3>
              <p className="text-sm text-gray-600">
                {allQuestions.length} questions • {survey.mode || 'CAPI'} Mode
              </p>
            </div>

            {/* Instructions */}
            <div className="text-left mb-6 space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#373177] text-sm font-semibold">1</span>
                </div>
                <div className="text-sm text-gray-700">
                  <strong>Location & Audio Access Required:</strong> This interview requires location and microphone permissions to ensure data integrity
                  {isCatiMode && (
                    <div className="mt-2 text-sm text-gray-600">
                      Note: CATI interviews do not require location or audio permissions as calls are recorded via webhook.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#373177] text-sm font-semibold">2</span>
                </div>
                <p className="text-sm text-gray-700">
                  Answer each question honestly and completely
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#373177] text-sm font-semibold">3</span>
                </div>
                <p className="text-sm text-gray-700">
                  You can navigate between questions using the sidebar
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#373177] text-sm font-semibold">4</span>
                </div>
                <p className="text-sm text-gray-700">
                  Take your time - there's no rush
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#373177] text-sm font-semibold">5</span>
                </div>
                <p className="text-sm text-gray-700">
                  Your responses are automatically saved
                </p>
              </div>
            </div>

            {/* Audio Recording Information */}
            {survey.mode === 'capi' && (
              <div className={`p-4 rounded-lg mb-6 ${
                audioSupported 
                  ? 'bg-[#E6F0F8] border border-blue-200' 
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    audioSupported ? 'bg-blue-100' : 'bg-yellow-100'
                  }`}>
                    <span className={`text-sm font-semibold ${
                      audioSupported ? 'text-[#373177]' : 'text-yellow-600'
                    }`}>
                      🎙️
                    </span>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${
                      audioSupported ? 'text-[#001D48]' : 'text-yellow-800'
                    }`}>
                      Audio Recording
                    </h4>
                    <p className={`text-sm ${
                      audioSupported ? 'text-blue-700' : 'text-yellow-700'
                    }`}>
                      {audioSupported 
                        ? 'This interview will be automatically recorded for quality assurance. You will be asked for microphone permission when you start.'
                        : window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '74.225.250.243'
                        ? 'Audio recording requires HTTPS. Please access the site via HTTPS (https://your-domain.com) or use localhost for development.'
                        : 'Audio recording is not available in your current browser/environment. The interview will continue without audio recording.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={startActualInterview}
                disabled={isLoading || isStarting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#E6F0F8]0 to-[#373177] text-white rounded-xl hover:from-[#373177] hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading || isStarting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Starting...</span>
                  </div>
                ) : (
                  'Start Interview'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || isStarting) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isStarting ? 'Starting Interview...' : 'Loading...'}
            </h3>
            <p className="text-gray-600">
              {isStarting ? 'Please wait while we prepare your interview session.' : 'Please wait...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInterviewActive || !currentQuestion) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Interview Not Ready</h3>
            <p className="text-gray-600 mb-4">The interview session could not be started.</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col interview-interface" style={{ 
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      minHeight: '100dvh' // Dynamic viewport height for better mobile support
    }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{survey.surveyName}</h1>
            <p className="text-sm text-gray-600">Interview in Progress</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* CATI: Language and Call Status in vertical layout */}
          {isCatiMode ? (
            <div className="flex flex-col items-start space-y-2">
              {/* Language Selector Dropdown */}
              {detectAvailableLanguages.length > 1 && (
                <div className="flex items-center space-x-2 px-2 py-1 bg-gray-100 rounded-lg">
                  <span className="text-sm">🌐</span>
                  <select
                    value={selectedLanguageIndex}
                    onChange={(e) => setSelectedLanguageIndex(parseInt(e.target.value, 10))}
                    className="text-sm border-none bg-transparent text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
                    style={{ minWidth: '100px' }}
                  >
                    {detectAvailableLanguages.map((label, index) => (
                      <option key={index} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* CATI Call Status - Below language dropdown */}
              {(callStatus === 'idle' || callStatus === 'calling' || !callStatus) && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-800">Processing call...</span>
                </div>
              )}
              {callStatus === 'connected' && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-800">Call Started</span>
                </div>
              )}
              {callStatus === 'failed' && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-red-800">Call Failed</span>
                </div>
              )}
            </div>
          ) : (
            /* CAPI: Language Selector only (horizontal) */
            detectAvailableLanguages.length > 1 && (
              <div className="flex items-center space-x-2 px-2 py-1 bg-gray-100 rounded-lg">
                <span className="text-sm">🌐</span>
                <select
                  value={selectedLanguageIndex}
                  onChange={(e) => setSelectedLanguageIndex(parseInt(e.target.value, 10))}
                  className="text-sm border-none bg-transparent text-gray-700 focus:outline-none focus:ring-0 cursor-pointer"
                  style={{ minWidth: '100px' }}
                >
                  {detectAvailableLanguages.map((label, index) => (
                    <option key={index} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}
          
          {/* CATI Respondent Info - Name and AC only (no phone) */}
          {isCatiMode && catiRespondent && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-[#E6F0F8] rounded-lg border border-blue-200">
              <Phone className="w-4 h-4 text-[#373177]" />
              <div className="text-sm">
                <div className="font-medium text-blue-900">{catiRespondent.name}</div>
                <div className="text-xs text-blue-700">
                  {selectedAC || acFromSessionData || catiRespondent.ac || catiRespondent.assemblyConstituency || catiRespondent.acName || catiRespondent.assemblyConstituencyName || 'N/A'}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{formatTime(totalTime)}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* CATI Call Management - Make Call button (only show when idle) */}
            {isCatiMode && catiQueueId && callStatus === 'idle' && (
              <button
                onClick={makeCallToRespondent}
                disabled={isLoading}
                className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm flex items-center space-x-1 disabled:opacity-50"
              >
                <Phone className="w-4 h-4" />
                <span>Make Call</span>
              </button>
            )}
            
            {/* Audio Recording Indicator - CAPI only */}
            {!isCatiMode && survey.mode === 'capi' && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  !audioSupported ? 'bg-red-500' :
                  isRecording ? (isAudioPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse') : 
                  'bg-gray-400'
                }`}></div>
                <span className="text-xs text-gray-600">
                  {!audioSupported ? 'Audio Unavailable' :
                   isRecording ? (isAudioPaused ? 'Audio Paused' : 'Recording') : 
                   'Audio Ready'}
                </span>
              </div>
            )}
            
            {!isCatiMode && (
              <>
            {isPaused ? (
              <button
                onClick={resumeInterview}
                className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm flex items-center space-x-1"
              >
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </button>
            ) : (
              <button
                onClick={pauseInterview}
                className="px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm flex items-center space-x-1"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
                )}
              </>
            )}
            <button
              onClick={isCatiMode ? () => setShowAbandonModal(true) : () => setShowAbandonConfirm(true)}
              className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm flex items-center space-x-1"
            >
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-800">Questions</h3>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {visibleQuestions.map((question, index) => {
                  const isCurrent = question.id === currentQuestion?.id;
                  const hasResponse = hasResponseContent(responses[question.id]);
                  const hasTargetAudienceError = targetAudienceErrors.has(question.id);
                  
                  return (
                    <button
                      key={question.id}
                      onClick={() => navigateToQuestion(question.id)}
                      className={`w-full text-left p-4 rounded-lg transition-all duration-200 ${
                        isCurrent
                          ? 'bg-[#E6F0F8]0 text-white shadow-lg'
                          : hasTargetAudienceError
                          ? 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-200'
                          : hasResponse
                          ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-200'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium">
                          {(() => {
                            // Use custom questionNumber if available, otherwise use position
                            if (question.questionNumber) {
                              return `Q${question.questionNumber}`;
                            }
                            return `${question.sectionIndex + 1}.${question.questionIndex + 1}`;
                          })()}
                        </span>
                        {hasResponse && !hasTargetAudienceError && <CheckCircle className="w-4 h-4" />}
                        {hasTargetAudienceError && <span className="text-red-600 text-lg">⚠️</span>}
                      </div>
                      <p className="text-sm mt-2 line-clamp-2">
                        {renderDisplayText(question.text, {
                          className: ''
                        })}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Question Content */}
          <div className="flex-1 overflow-y-auto p-12">
            <div className="max-w-4xl mx-auto">
              {/* Navigation at top of question area */}
              <div className="mb-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={goToPreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="group relative px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:border-blue-500 hover:text-[#373177] transition-all duration-200 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md disabled:shadow-none"
                      style={{ minHeight: '48px', minWidth: '140px' }}
                    >
                      <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
                      <span className="font-medium">Previous</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600 font-medium">
                      Question {currentQuestionIndex + 1} of {maxPossibleQuestions || visibleQuestions.length}
                    </span>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#E6F0F8]0 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestionIndex + 1) / (maxPossibleQuestions || visibleQuestions.length)) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {(currentQuestionIndex === visibleQuestions.length - 1 || isConsentDisagreed || shouldShowSubmitForCallStatus || shouldShowAbandonForConsent) ? (
                      <button
                        onClick={() => {
                          // If call status is not connected, abandon instead of complete
                          if (shouldShowSubmitForCallStatus && callStatusResponse) {
                            handleAbandonInterview(callStatusResponse);
                          } 
                          // If consent form is "No", abandon instead of complete
                          else if (shouldShowAbandonForConsent && isConsentDisagreed) {
                            handleAbandonInterview('consent_refused');
                          } 
                          else {
                            completeInterview();
                          }
                        }}
                        disabled={isCatiMode && (callStatus === 'failed' || !callId) && !shouldShowSubmitForCallStatus && !shouldShowAbandonForConsent}
                        className={`px-6 py-3 rounded-xl transition-all duration-200 flex items-center space-x-2 shadow-lg ${
                          isCatiMode && (callStatus === 'failed' || !callId) && !shouldShowSubmitForCallStatus && !shouldShowAbandonForConsent
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : (shouldShowSubmitForCallStatus || shouldShowAbandonForConsent)
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                        style={{ minHeight: '44px', minWidth: '180px' }}
                        title={isCatiMode && (callStatus === 'failed' || !callId) && !shouldShowSubmitForCallStatus && !shouldShowAbandonForConsent ? 'Cannot submit: Call was not successfully initiated' : (shouldShowSubmitForCallStatus || shouldShowAbandonForConsent) ? 'Abandon interview' : 'Submit interview'}
                      >
                        {(shouldShowSubmitForCallStatus || shouldShowAbandonForConsent) ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                        <CheckCircle className="w-5 h-5" />
                        )}
                        <span>{(shouldShowSubmitForCallStatus || shouldShowAbandonForConsent) ? 'Abandon' : 'Submit'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={goToNextQuestion}
                        disabled={
                          (!isCatiMode && 
                          currentQuestion && 
                          (currentQuestion.id === 'polling-station-selection' ||
                           currentQuestion.type === 'polling_station' ||
                           currentQuestion.isPollingStationSelection ||
                           (currentQuestion.text && currentQuestion.text.toLowerCase().includes('select polling station'))) &&
                          (!selectedPollingStation.groupName || !selectedPollingStation.stationName)) ||
                          (isCatiMode && currentQuestion && currentQuestion.id === 'call-status' && callStatusResponse !== 'call_connected')
                        }
                        className={`group relative px-6 py-3 rounded-xl transition-all duration-200 flex items-center space-x-2 shadow-lg ${
                          ((!isCatiMode && 
                          currentQuestion && 
                          (currentQuestion.id === 'polling-station-selection' ||
                           currentQuestion.type === 'polling_station' ||
                           currentQuestion.isPollingStationSelection ||
                           (currentQuestion.text && currentQuestion.text.toLowerCase().includes('select polling station'))) &&
                          (!selectedPollingStation.groupName || !selectedPollingStation.stationName)) ||
                          (isCatiMode && currentQuestion && currentQuestion.id === 'call-status' && callStatusResponse !== 'call_connected'))
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-[#001D48] text-white hover:bg-blue-700 hover:shadow-xl'
                        }`}
                        style={{ minHeight: '48px', minWidth: '140px' }}
                      >
                        <span className="font-medium">Next</span>
                        <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-12">
                <h2 className={`text-3xl font-semibold mb-6 leading-relaxed ${
                  validationErrors.has(currentQuestion.id) || targetAudienceErrors.has(currentQuestion.id)
                    ? 'text-red-600 border-l-4 border-red-500 pl-4' 
                    : 'text-gray-800'
                }`}>
                  {(() => {
                  // Get question number - use custom questionNumber if available, otherwise generate from position
                  let questionNumber = currentQuestion.questionNumber;
                  
                  // Special handling for call status, interviewer ID, supervisor ID, consent form and AC selection
                  if (currentQuestion.id === 'call-status') {
                    questionNumber = '0.001';
                  } else if (currentQuestion.id === 'interviewer-id') {
                    questionNumber = '0.002';
                  } else if (currentQuestion.id === 'supervisor-id') {
                    questionNumber = '0.003';
                  } else if (currentQuestion.id === 'consent-form') {
                    questionNumber = '0.0';
                  } else if (currentQuestion.id === 'ac-selection') {
                    questionNumber = '0.1';
                  } else if (!questionNumber && currentQuestion.sectionIndex !== undefined && currentQuestion.questionIndex !== undefined) {
                    questionNumber = `${currentQuestion.sectionIndex + 1}.${currentQuestion.questionIndex + 1}`;
                  } else if (!questionNumber) {
                      // Fallback: find question in allQuestions to get position
                      const questionPos = allQuestions.findIndex(q => q.id === currentQuestion.id);
                      if (questionPos !== -1) {
                        // Try to find section and question index
                        let sectionIdx = 0;
                        let qIdx = 0;
                        let count = 0;
                        if (survey && survey.sections) {
                          for (let s = 0; s < survey.sections.length; s++) {
                            for (let q = 0; q < survey.sections[s].questions.length; q++) {
                              if (count === questionPos) {
                                sectionIdx = s;
                                qIdx = q;
                                break;
                              }
                              count++;
                            }
                            if (count === questionPos) break;
                          }
                          questionNumber = `${sectionIdx + 1}.${qIdx + 1}`;
                        } else {
                          questionNumber = `Q${questionPos + 1}`;
                        }
                      }
                    }
                    return questionNumber ? <span className="text-[#373177] mr-3">Q{questionNumber}:</span> : null;
                  })()}
                  {renderDisplayText(currentQuestion.text, {
                    className: ''
                  })}
                  {/* Show MP/MLA name for Question 16.a and 16.b - check by question text/number regardless of survey */}
                  {(() => {
                    if (!currentQuestion) return null;
                    
                    const questionText = (currentQuestion.text || '').toLowerCase();
                    const questionNumber = currentQuestion.questionNumber || '';
                    const questionId = currentQuestion.id || '';
                    
                    // Also check the displayed question number format (e.g., "16.a" from "Q16.a:")
                    let displayedQuestionNumber = '';
                    if (currentQuestion.sectionIndex !== undefined && currentQuestion.questionIndex !== undefined) {
                      displayedQuestionNumber = `${currentQuestion.sectionIndex + 1}.${currentQuestion.questionIndex + 1}`;
                    }
                    
                    // Check if this is Question 16.a (MP) or 16.b (MLA) by multiple methods
                    // Prioritize question number over text to avoid conflicts
                    // Check question number first (most reliable)
                    const hasQuestionNumber16a = questionNumber === '16.a' || 
                                                 questionNumber === '16a' ||
                                                 questionNumber.includes('16.a') || 
                                                 questionNumber.includes('16a') ||
                                                 displayedQuestionNumber === '16.a' ||
                                                 displayedQuestionNumber === '16a';
                    const hasQuestionNumber16b = questionNumber === '16.b' || 
                                                 questionNumber === '16b' ||
                                                 questionNumber.includes('16.b') || 
                                                 questionNumber.includes('16b') ||
                                                 displayedQuestionNumber === '16.b' ||
                                                 displayedQuestionNumber === '16b';
                    
                    // If question number matches, use that (most reliable)
                    if (hasQuestionNumber16a) {
                      // This is definitely 16.a - show MP name
                      if (mpName) {
                        return <span className="text-[#373177] font-medium ml-2">: {mpName}</span>;
                      }
                      if (isLoadingMPMLA) {
                        return <span className="text-gray-500 ml-2">(Loading...)</span>;
                      }
                      return null;
                    }
                    
                    if (hasQuestionNumber16b) {
                      // This is definitely 16.b - show MLA name
                      if (mlaName) {
                        return <span className="text-[#373177] font-medium ml-2">: {mlaName}</span>;
                      }
                      if (isLoadingMPMLA) {
                        return <span className="text-gray-500 ml-2">(Loading...)</span>;
                      }
                      return null;
                    }
                    
                    // Fallback to text matching only if question number doesn't match
                    // Check 16.b first to avoid conflicts
                    const isQuestion16b = questionId.includes('16b') ||
                                         questionText.includes('satisfaction with mla') || 
                                         questionText.includes('16.b') ||
                                         questionText.includes('16b') ||
                                         (questionText.includes('mla') && questionText.includes('satisfaction') && !questionText.includes('mp')) ||
                                         (questionText.includes('current mla') || questionText.includes('your current mla')) ||
                                         (questionText.includes('work done by') && questionText.includes('mla') && !questionText.includes('mp'));
                    
                    // Only check for 16.a if it's not 16.b
                    const isQuestion16a = !isQuestion16b && (
                                         questionId.includes('16a') ||
                                         questionText.includes('satisfaction with mp') || 
                                         questionText.includes('16.a') ||
                                         questionText.includes('16a') ||
                                         (questionText.includes('mp') && questionText.includes('satisfaction') && !questionText.includes('mla')) ||
                                         (questionText.includes('current mp') || questionText.includes('your current mp')) ||
                                         (questionText.includes('work done by') && questionText.includes('mp') && !questionText.includes('mla')));
                    
                    
                    // Check 16.b first (text fallback), then 16.a
                    if (isQuestion16b && mlaName) {
                      return <span className="text-[#373177] font-medium ml-2">: {mlaName}</span>;
                    }
                    if (isQuestion16a && mpName) {
                      return <span className="text-[#373177] font-medium ml-2">: {mpName}</span>;
                    }
                    if ((isQuestion16a || isQuestion16b) && isLoadingMPMLA) {
                      return <span className="text-gray-500 ml-2">(Loading...)</span>;
                    }
                    // MP/MLA names will be displayed when available
                    return null;
                  })()}
                  {/* Show AC name for registered voter question - only for survey "68fd1915d41841da463f0d46" */}
                  {(() => {
                    if (!currentQuestion) return null;
                    
                    // Only for target survey
                    const isTargetSurvey = survey && (survey._id === '68fd1915d41841da463f0d46' || survey.id === '68fd1915d41841da463f0d46');
                    if (!isTargetSurvey) return null;
                    
                    const questionText = (currentQuestion.text || '').toLowerCase();
                    const questionId = currentQuestion.id || '';
                    
                    // Check if this is the registered voter question
                    const isRegisteredVoterQuestion = questionText.includes('are you a registered voter') ||
                                                      questionText.includes('registered voter') ||
                                                      questionText.includes('নিবন্ধিত ভোটার') ||
                                                      questionText.includes('বিধানসভা কেন্দ্র') ||
                                                      (questionText.includes('registered') && questionText.includes('voter') && questionText.includes('assembly'));
                    
                    if (isRegisteredVoterQuestion) {
                      // Get AC name: for CAPI use selectedAC, for CATI use acFromSessionData
                      const acName = selectedAC || acFromSessionData;
                      if (acName) {
                        return <span className="text-[#373177] font-medium ml-2">: {acName}</span>;
                      }
                      return null;
                    }
                    return null;
                  })()}
                  {currentQuestion.required && <span className="text-red-500 ml-2">*</span>}
                  {currentQuestion.type === 'multiple_choice' && currentQuestion.settings?.allowMultiple && (
                    <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-[#001D48]">
                      Multiple selections
                    </span>
                  )}
                </h2>
                {currentQuestion.description && (
                  <p className="text-xl text-gray-600 leading-relaxed">
                    {renderDisplayText(currentQuestion.description)}
                  </p>
                )}
                {validationErrors.has(currentQuestion.id) && (
                  <p className="text-red-600 text-sm mt-2 font-medium">
                    ⚠️ This question is required and must be answered before completing the interview.
                  </p>
                )}
                {targetAudienceErrors.has(currentQuestion.id) && (
                  <p className="text-red-600 text-sm mt-2 font-medium bg-red-50 p-3 rounded-lg border border-red-200">
                    🚫 {targetAudienceErrors.get(currentQuestion.id)}
                  </p>
                )}
              </div>

              <div className="mb-12">
                {isPaused ? (
                  <div className="p-8 text-center bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      <Pause className="w-8 h-8 text-yellow-600" />
                      <h3 className="text-xl font-semibold text-yellow-800">Interview Paused</h3>
              </div>
                    <p className="text-yellow-700 mb-4">
                      The interview is currently paused. Audio recording is also paused.
                    </p>
                    <p className="text-sm text-yellow-600">
                      Click "Resume" to continue the interview and audio recording.
                    </p>
                  </div>
                ) : (
                  renderQuestionInput()
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* CATI Abandonment Modal */}
      {showAbandonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Abandon Interview</h3>
            {callStatus === 'failed' && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Call Failed:</strong> You can abandon this interview without selecting a reason, or optionally provide one below.
                </p>
              </div>
            )}
            <p className="text-gray-600 mb-4">
              {callStatus === 'failed' 
                ? 'Optionally select a reason for abandoning this interview:'
                : 'Please select a reason for abandoning this interview:'}
            </p>
            
            <div className="space-y-2 mb-4">
              {[
                { value: 'call_later', label: 'Call Later' },
                { value: 'not_interested', label: 'Not Interested' },
                { value: 'busy', label: 'Busy' },
                { value: 'no_answer', label: 'No Answer' },
                { value: 'switched_off', label: 'Switched Off' },
                { value: 'not_reachable', label: 'Not Reachable' },
                { value: 'does_not_exist', label: 'Number Does Not Exist' },
                { value: 'rejected', label: 'Call Rejected' },
                { value: 'technical_issue', label: 'Technical Issue' },
                { value: 'other', label: 'Other' }
              ].map((reason) => (
                <label key={reason.value} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                  <input
                    type="radio"
                    name="abandonReason"
                    value={reason.value}
                    checked={abandonReason === reason.value}
                    onChange={(e) => setAbandonReason(e.target.value)}
                    className="w-4 h-4 text-[#373177]"
                  />
                  <span className="text-sm text-gray-700">{reason.label}</span>
                </label>
              ))}
            </div>
            
            {abandonReason === 'call_later' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Call For:
                </label>
                <input
                  type="datetime-local"
                  value={callLaterDate}
                  onChange={(e) => setCallLaterDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional):
              </label>
              <textarea
                value={abandonNotes}
                onChange={(e) => setAbandonNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Add any additional notes..."
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowAbandonModal(false);
                  setAbandonReason('');
                  setAbandonNotes('');
                  setCallLaterDate('');
                  // Restore navigation protection
                  if (isInterviewActive) {
                    window.history.pushState(null, '', window.location.href);
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAbandonInterview}
                disabled={
                  (!callStatus || callStatus !== 'failed') && 
                  (!abandonReason || (abandonReason === 'call_later' && !callLaterDate)) || 
                  isLoading
                }
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting...' : callStatus === 'failed' ? 'Abandon (No Reason Required)' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAPI Abandon Modal */}
      {showAbandonConfirm && !isCatiMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Abandon Interview</h3>
            <p className="text-gray-600 mb-4">
              Please select a reason for abandoning this interview:
            </p>
            
            <div className="space-y-2 mb-4">
              {[
                { value: 'respondent_not_available', label: 'Respondent Not Available' },
                { value: 'respondent_refused', label: 'Respondent Refused' },
                { value: 'location_issue', label: 'Location Issue' },
                { value: 'technical_issue', label: 'Technical Issue' },
                { value: 'language_barrier', label: 'Language Barrier' },
                { value: 'respondent_busy', label: 'Respondent Busy' },
                { value: 'other', label: 'Other' }
              ].map((reason) => (
                <label key={reason.value} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                  <input
                    type="radio"
                    name="capiAbandonReason"
                    value={reason.value}
                    checked={abandonReason === reason.value}
                    onChange={(e) => setAbandonReason(e.target.value)}
                    className="w-4 h-4 text-[#373177]"
                  />
                  <span className="text-sm text-gray-700">{reason.label}</span>
                </label>
              ))}
            </div>
            
            {abandonReason === 'other' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify:
                </label>
                <textarea
                  value={abandonNotes}
                  onChange={(e) => setAbandonNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter custom reason..."
                />
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional):
              </label>
              <textarea
                value={abandonReason !== 'other' ? abandonNotes : ''}
                onChange={(e) => setAbandonNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Add any additional notes..."
                disabled={abandonReason === 'other'}
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowAbandonConfirm(false);
                  setAbandonReason('');
                  setAbandonNotes('');
                  // Restore navigation protection
                  if (isInterviewActive) {
                    window.history.pushState(null, '', window.location.href);
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={abandonInterview}
                disabled={!abandonReason || (abandonReason === 'other' && !abandonNotes.trim()) || isLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Permission Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-300 ease-out">
            <div className="text-center">
              {/* Icon */}
              <div className="mb-6">
                <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
                  permissionType === 'location' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {permissionType === 'location' ? (
                    <svg className="w-10 h-10 text-[#373177]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {permissionType === 'location' ? 'Location Access Required' : 'Microphone Access Required'}
              </h2>

              {/* Description */}
              <div className="text-left mb-6 space-y-3">
                <p className="text-gray-700">
                  {permissionType === 'location' 
                    ? 'This interview requires access to your location to ensure data integrity and verify the interview location.'
                    : 'This interview requires access to your microphone to record the conversation for quality assurance.'
                  }
                </p>
                
                {permissionError && (
                  <div 
                    className="text-left"
                    dangerouslySetInnerHTML={{ __html: permissionError }}
                  />
                )}

                <div className="bg-[#E6F0F8] border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">How to enable access:</h4>
                  <ol className="text-sm text-[#001D48] space-y-1 text-left">
                    <li>1. Look for the permission prompt in your browser's address bar</li>
                    <li>2. Click "Allow" when prompted</li>
                    <li>3. If you missed it, click the {permissionType === 'location' ? 'location' : 'microphone'} icon in the address bar</li>
                    <li>4. Select "Allow" from the dropdown menu</li>
                  </ol>
                </div>
                
                {permissionType === 'location' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Important Note:</h4>
                    <p className="text-sm text-yellow-800">
                      Location tracking is required for data integrity and quality assurance. 
                      Without location data, your interview may be flagged for review or rejected.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowPermissionModal(false);
                      setShowWelcomeModal(true);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowPermissionModal(false);
                      // Retry the permission request
                      startActualInterview();
                    }}
                    className="flex-1 px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
                
                {/* Continue without location option */}
                {permissionType === 'location' && (
                  <button
                    onClick={() => {
                      setShowPermissionModal(false);
                      // Continue without location
                      setGpsLocation(null);
                      setLocationPermission('skipped');
                      // Continue with audio check
                      checkAudioPermission();
                    }}
                    className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                  >
                    Continue Without Location (Not Recommended)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewInterface;