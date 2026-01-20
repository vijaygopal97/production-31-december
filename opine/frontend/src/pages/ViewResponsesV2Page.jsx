import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  ArrowLeft,
  Filter, 
  Download, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Calendar,
  User,
  MapPin,
  BarChart3,
  X,
  CheckCircle,
  AlertCircle,
  Database,
  FileText,
  Activity,
  ListChecks,
  Clock
} from 'lucide-react';
import { surveyResponseAPI, surveyAPI, authAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import ResponseDetailsModal from '../components/dashboard/ResponseDetailsModal';
import { getMainText } from '../utils/translations';
import assemblyConstituenciesData from '../data/assemblyConstituencies.json';
import acRegionDistrictMapping from '../data/ac_region_district_mapping.json';

const ViewResponsesV2Page = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Determine if we're in project manager route
  const isProjectManagerRoute = location.pathname.includes('/project-manager/');
  const backPath = isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys';
  
  // Check if user is company admin (for CSV download)
  const isCompanyAdmin = user?.userType === 'company_admin';
  
  // Get qualityAgentId from URL params (for filtering by quality agent)
  const searchParams = new URLSearchParams(location.search);
  const qualityAgentIdFromUrl = searchParams.get('qualityAgentId');
  
  const [survey, setSurvey] = useState(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showPreGeneratedDownloadModal, setShowPreGeneratedDownloadModal] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ current: 0, total: 0, stage: '' });
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalResponses: 0,
    hasNext: false,
    hasPrev: false
  });
  const [filterOptions, setFilterOptions] = useState({
    gender: [],
    age: [],
    ac: [],
    city: [],
    district: [],
    lokSabha: []
  });
  
  // Filter states
  // OPTIMIZED: Default to 'today' instead of 'all' to prevent memory leaks and improve performance
  // Top tech companies (Meta, Twitter, Google) show recent/relevant data first, not all-time
  // EXCEPTION: When filtering by quality agent, default to 'all' to show all their reviews
  const [filters, setFilters] = useState({
    search: '',
    status: qualityAgentIdFromUrl ? 'approved_rejected' : 'approved_rejected_pending', // Default to approved_rejected when filtering by QA
    dateRange: qualityAgentIdFromUrl ? 'all' : 'today', // Show 'all' when filtering by QA, 'today' otherwise
    startDate: '',
    endDate: '',
    gender: '',
    ageMin: '',
    ageMax: '',
    ac: '',
    city: '',
    district: '',
    lokSabha: '',
    interviewMode: '',
    interviewerIds: [],
    interviewerMode: 'include',
    qualityAgentId: qualityAgentIdFromUrl || '' // Filter by quality agent who reviewed
  });
  
  const [showFilters, setShowFilters] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [fullResponseDetails, setFullResponseDetails] = useState(null);
  const [loadingResponseDetails, setLoadingResponseDetails] = useState(false);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [csvFileInfo, setCsvFileInfo] = useState(null);
  const [loadingCSVInfo, setLoadingCSVInfo] = useState(true);
  const { showError, showSuccess } = useToast();

  // Interviewer filter states (search-first)
  const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('');
  const [searchedInterviewers, setSearchedInterviewers] = useState([]);
  const [selectedInterviewers, setSelectedInterviewers] = useState([]); // Persist selected interviewers even after search clears
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);
  const interviewerDropdownRef = useRef(null);
  const [searchingInterviewers, setSearchingInterviewers] = useState(false);
  const interviewerSearchTimerRef = useRef(null);

  // AC filter states (search-first)
  const [acSearchTerm, setAcSearchTerm] = useState('');
  const [showACDropdown, setShowACDropdown] = useState(false);
  const acDropdownRef = useRef(null);

  // Debounce timer for API calls
  const debounceTimerRef = useRef(null);
  const initialLoadRef = useRef(false);
  
  // AbortController for request cancellation (CRITICAL: Prevents memory leaks)
  const abortControllerRef = useRef(null);
  
  // AbortController for modal data fetching (prevents stacking requests when clicking multiple responses)
  const modalAbortControllerRef = useRef(null);
  
  // Track if component is mounted (prevent state updates after unmount)
  const isMountedRef = useRef(true);

  // Fetch survey details
  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const surveyResponse = await surveyAPI.getSurvey(surveyId);
        if (surveyResponse.success) {
          setSurvey(surveyResponse.data);
        }
      } catch (error) {
        console.error('Error fetching survey:', error);
      }
    };
    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);

  // Format date for API (YYYY-MM-DD)
  const formatDateForAPI = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fetch responses with server-side filtering and pagination
  // OPTIMIZED: Uses AbortController to cancel previous requests, prevents memory leaks
  // Returns a Promise for better async handling
  const fetchResponses = useCallback(async (page = 1, skipFilterOptions = false) => {
    if (!surveyId || !isMountedRef.current) return Promise.resolve();
    
    // CRITICAL: Cancel previous request to prevent memory leaks and duplicate updates
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      if (isMountedRef.current) {
      setLoading(true);
      }
      
      const interviewerIdsParam = filters.interviewerIds && filters.interviewerIds.length > 0 
        ? filters.interviewerIds.map(id => id?.toString?.() || String(id || '')).join(',') 
        : '';
      
      const params = {
        page,
        limit: 20,
        status: filters.status || 'approved_rejected_pending',
        dateRange: filters.dateRange || 'today', // Default to 'today' if not set
        startDate: filters.startDate || '',
        endDate: filters.endDate || '',
        gender: filters.gender || '',
        ageMin: filters.ageMin || '',
        ageMax: filters.ageMax || '',
        ac: filters.ac || '',
        city: filters.city || '',
        district: filters.district || '',
        lokSabha: filters.lokSabha || '',
        interviewMode: filters.interviewMode || '',
        interviewerIds: interviewerIdsParam,
        interviewerMode: filters.interviewerMode || 'include',
        search: filters.search || '',
        qualityAgentId: filters.qualityAgentId || '', // Filter by quality agent who reviewed
        includeFilterOptions: skipFilterOptions ? 'false' : 'true' // Make filterOptions optional
      };

      const response = await surveyResponseAPI.getSurveyResponsesV2(surveyId, params, signal);
      
      // CRITICAL: Check if request was aborted or component unmounted
      if (signal.aborted || !isMountedRef.current) {
        return Promise.resolve();
      }
      
      if (response.success) {
        if (isMountedRef.current) {
        setResponses(response.data.responses);
        setPagination(response.data.pagination);
          // Only update filterOptions if provided (not skipped)
          if (response.data.filterOptions) {
        setFilterOptions(response.data.filterOptions);
      }
        }
      }
      
      return Promise.resolve();
    } catch (error) {
      // Ignore aborted requests (not an error)
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return Promise.resolve();
      }
      
      // Only show error if component is still mounted
      if (isMountedRef.current) {
      console.error('Error fetching responses:', error);
      showError('Failed to load responses');
      }
      
      return Promise.reject(error);
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
      setLoading(false);
      }
    }
  }, [surveyId, filters, showError]);

  // Initial load - fetch immediately without debounce
  // OPTIMIZED: Load responses first (fast), then filterOptions separately (slower)
  useEffect(() => {
    if (surveyId && !initialLoadRef.current) {
      initialLoadRef.current = true;
      
      // Load responses first without filterOptions for faster initial display
      fetchResponses(1, true).then(() => {
        // After responses load, fetch filterOptions separately in background (non-blocking)
        // Small delay to ensure responses are displayed first
        setTimeout(() => {
          if (isMountedRef.current && surveyId) {
            // Use a separate AbortController for filterOptions to avoid conflicts
            const filterOptionsController = new AbortController();
            
            surveyResponseAPI.getSurveyResponseCounts(surveyId, {
              includeFilterOptions: 'true'
            }, filterOptionsController.signal).then(response => {
              if (response.success && response.data.filterOptions && isMountedRef.current) {
                setFilterOptions(response.data.filterOptions);
              }
            }).catch(error => {
              if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED' && isMountedRef.current) {
                console.error('Error fetching filter options:', error);
              }
            });
          }
        }, 500); // 500ms delay to let responses render first
      }).catch(error => {
        if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
          console.error('Error in initial load:', error);
        }
      });
    }
    
    // Cleanup: Cancel any pending requests when surveyId changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [surveyId, fetchResponses]);

  // Reset initial load ref when surveyId changes
  useEffect(() => {
    initialLoadRef.current = false;
  }, [surveyId]);
  
  // CRITICAL: Cleanup on component unmount (prevents memory leaks)
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Cancel any pending modal requests
      if (modalAbortControllerRef.current) {
        modalAbortControllerRef.current.abort();
        modalAbortControllerRef.current = null;
      }
      
      // Clear all timers
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      
      if (interviewerSearchTimerRef.current) {
        clearTimeout(interviewerSearchTimerRef.current);
        interviewerSearchTimerRef.current = null;
      }
    };
  }, []);

  // Fetch CSV file info on component mount
  useEffect(() => {
    const fetchCSVInfo = async () => {
      if (!surveyId) return;
      try {
        setLoadingCSVInfo(true);
        const response = await surveyResponseAPI.getCSVFileInfo(surveyId);
        if (response.success) {
          setCsvFileInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching CSV file info:', error);
        setCsvFileInfo(null);
      } finally {
        setLoadingCSVInfo(false);
      }
    };
    
    fetchCSVInfo();
  }, [surveyId]);

  // Debounced fetch responses when filters change (skip initial load)
  // OPTIMIZED: Proper cleanup prevents memory leaks
  useEffect(() => {
    if (!surveyId || !initialLoadRef.current || !isMountedRef.current) return; // Don't run until initial load is done
    
    // CRITICAL: Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // CRITICAL: Cancel any pending requests before starting new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    debounceTimerRef.current = setTimeout(() => {
      // Double-check component is still mounted before fetching
      if (isMountedRef.current && surveyId) {
        fetchResponses(1, false); // Fetch with filterOptions on filter change
      }
      debounceTimerRef.current = null;
    }, 500);

    // CRITICAL: Cleanup function - clear timer and cancel requests
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      
      // Cancel pending request if filters change again
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [filters, surveyId, fetchResponses]);

  // Search interviewers (search-first approach)
  const searchInterviewers = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchedInterviewers([]);
      return;
    }

    try {
      setSearchingInterviewers(true);
      const response = await authAPI.searchInterviewerByMemberId(searchTerm, surveyId);
      if (response.success) {
        setSearchedInterviewers(Array.isArray(response.data) ? response.data : [response.data].filter(Boolean));
      }
    } catch (error) {
      console.error('Error searching interviewers:', error);
      setSearchedInterviewers([]);
    } finally {
      setSearchingInterviewers(false);
    }
  }, [surveyId]);

  // Debounced interviewer search
  // OPTIMIZED: Proper cleanup prevents memory leaks
  useEffect(() => {
    // CRITICAL: Clear previous timer
    if (interviewerSearchTimerRef.current) {
      clearTimeout(interviewerSearchTimerRef.current);
      interviewerSearchTimerRef.current = null;
    }

    if (interviewerSearchTerm.trim().length >= 2 && isMountedRef.current) {
      interviewerSearchTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
        searchInterviewers(interviewerSearchTerm);
        setShowInterviewerDropdown(true);
        }
        interviewerSearchTimerRef.current = null;
      }, 500);
    } else {
      if (isMountedRef.current) {
      setSearchedInterviewers([]);
      setShowInterviewerDropdown(false);
      }
    }
    
    // CRITICAL: Cleanup function
    return () => {
      if (interviewerSearchTimerRef.current) {
        clearTimeout(interviewerSearchTimerRef.current);
        interviewerSearchTimerRef.current = null;
      }
    };

    return () => {
      if (interviewerSearchTimerRef.current) {
        clearTimeout(interviewerSearchTimerRef.current);
      }
    };
  }, [interviewerSearchTerm, searchInterviewers]);

  // Filter ACs locally - flatten all states' ACs into a single array
  const filteredACs = useMemo(() => {
    if (!acSearchTerm.trim()) return [];
    
    const searchLower = acSearchTerm.toLowerCase();
    const allACs = [];
    
    // Flatten all ACs from all states
    if (assemblyConstituenciesData?.states) {
      Object.values(assemblyConstituenciesData.states).forEach(state => {
        if (state.assemblyConstituencies && Array.isArray(state.assemblyConstituencies)) {
          allACs.push(...state.assemblyConstituencies);
        }
      });
    }
    
    return allACs
      .filter(ac => {
        const acName = (ac.acName || '').toLowerCase();
        const acCode = (ac.acCode || '').toLowerCase();
        return acName.includes(searchLower) || acCode.includes(searchLower);
      })
      .slice(0, 20);
  }, [acSearchTerm]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    // Reset to page 1 when filters change
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  // Handle date range change
  const handleDateRangeChange = (range) => {
    setFilters(prev => ({
      ...prev,
      dateRange: range,
      startDate: '',
      endDate: ''
    }));
  };

  // Handle custom date change
  const handleStartDateChange = (date) => {
    setFilters(prev => ({
      ...prev,
      startDate: formatDateForAPI(date),
      dateRange: 'custom'
    }));
  };

  const handleEndDateChange = (date) => {
    setFilters(prev => ({
      ...prev,
      endDate: formatDateForAPI(date),
      dateRange: 'custom'
    }));
  };

  // Handle interviewer toggle
  const handleInterviewerToggle = (interviewerId, interviewerData = null) => {
    console.log('🔍 handleInterviewerToggle CALLED with:', {
      interviewerId,
      interviewerIdType: typeof interviewerId,
      interviewerIdValue: interviewerId,
      interviewerData,
      currentFilters: filters,
      currentSelectedInterviewers: selectedInterviewers
    });
    
    // Convert to string for consistent comparison
    const idStr = interviewerId?.toString?.() || String(interviewerId || '');
    
    setFilters(prev => {
      console.log('🔍 setFilters callback - PREV STATE:', {
        prev,
        prevInterviewerIds: prev.interviewerIds,
        prevInterviewerIdsLength: prev.interviewerIds?.length
      });
      
      const currentIds = prev.interviewerIds || [];
      // Convert all current IDs to strings for comparison
      const currentIdsStr = currentIds.map(id => id?.toString?.() || String(id || ''));
      const isSelected = currentIdsStr.includes(idStr);
      
      const newIds = isSelected
        ? currentIds.filter(id => {
            const currentIdStr = id?.toString?.() || String(id || '');
            return currentIdStr !== idStr;
          })
        : [...currentIds, idStr];
      
      console.log('🔍 setFilters callback - CALCULATED NEW IDs:', {
        interviewerId,
        idStr,
        currentIds,
        currentIdsStr,
        isSelected,
        newIds,
        newIdsLength: newIds.length
      });
      
      const newState = {
        ...prev,
        interviewerIds: newIds
      };
      
      console.log('🔍 setFilters callback - RETURNING NEW STATE:', {
        newState,
        interviewerIds: newState.interviewerIds,
        interviewerIdsLength: newState.interviewerIds.length
      });
      
      return newState;
    });
    
    // Also update selectedInterviewers to persist the interviewer data
    if (interviewerData) {
      setSelectedInterviewers(prev => {
        const currentSelected = prev || [];
        const isAlreadySelected = currentSelected.some(i => {
          const currentIdStr = i._id?.toString?.() || String(i._id || '');
          return currentIdStr === idStr;
        });
        
        if (isAlreadySelected) {
          return currentSelected.filter(i => {
            const currentIdStr = i._id?.toString?.() || String(i._id || '');
            return currentIdStr !== idStr;
          });
        } else {
          return [...currentSelected, interviewerData];
        }
      });
    }
    
    // Force a re-render check after state update
    setTimeout(() => {
      console.log('🔍 handleInterviewerToggle - AFTER STATE UPDATE (500ms later):', {
        currentFilters: filters,
        interviewerIds: filters.interviewerIds
      });
    }, 500);
  };

  // Handle AC toggle
  const handleACToggle = (acName) => {
    setFilters(prev => ({
      ...prev,
      ac: prev.ac === acName ? '' : acName
    }));
    setShowACDropdown(false);
    setAcSearchTerm('');
  };

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    fetchResponses(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchResponses]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (interviewerDropdownRef.current && !interviewerDropdownRef.current.contains(event.target)) {
        setShowInterviewerDropdown(false);
      }
      if (acDropdownRef.current && !acDropdownRef.current.contains(event.target)) {
        setShowACDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get respondent info from response
  // Memoized helper function to extract respondent info (optimized for performance)
  const getRespondentInfo = useCallback((response) => {
    return {
      ac: response.acValue || response.selectedAC || response.selectedPollingStation?.acName || 'N/A',
      city: response.cityValue || 'N/A',
      district: response.districtValue || response.selectedPollingStation?.district || 'N/A',
      lokSabha: response.lokSabhaValue || response.selectedPollingStation?.pcName || 'N/A'
    };
  }, []);

  // Fetch full response details when View is clicked
  // OPTIMIZED: Uses AbortController to prevent stacking requests
  const handleViewResponse = useCallback(async (response) => {
    // CRITICAL: Cancel previous modal request if any
    if (modalAbortControllerRef.current) {
      modalAbortControllerRef.current.abort();
    }
    
    // Create new AbortController for this modal request
    modalAbortControllerRef.current = new AbortController();
    const signal = modalAbortControllerRef.current.signal;
    
    try {
      setLoadingResponseDetails(true);
      setShowResponseDetails(true);
      
      // Use the response from list immediately (show modal fast)
      setFullResponseDetails(response);
      setSelectedResponse(response);
      
      // Fetch full response details from backend in background
      const responseData = await surveyResponseAPI.getSurveyResponseById(response._id);
      
      // Check if request was aborted
      if (signal.aborted || !isMountedRef.current) {
        return;
      }
      
      if (responseData.success && responseData.interview) {
        // The backend returns { success: true, interview: {...} }
        if (isMountedRef.current) {
        setFullResponseDetails(responseData.interview);
        setSelectedResponse(responseData.interview);
        }
      }
    } catch (error) {
      // Ignore aborted requests
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      
      console.error('Error fetching response details:', error);
      // Keep the response from list (already set above)
      if (isMountedRef.current) {
      showError('Could not load full response details, showing partial data');
      }
    } finally {
      if (isMountedRef.current) {
      setLoadingResponseDetails(false);
    }
    }
  }, [showError]);
  
  // Handle modal close with proper cleanup
  const handleCloseModal = useCallback(() => {
    // Cancel any pending modal requests
    if (modalAbortControllerRef.current) {
      modalAbortControllerRef.current.abort();
      modalAbortControllerRef.current = null;
    }
    
    // Clear modal state
    setShowResponseDetails(false);
    setSelectedResponse(null);
    setFullResponseDetails(null);
    setLoadingResponseDetails(false);
  }, []);

  // ========== CSV GENERATION HELPER FUNCTIONS ==========
  
  // Helper function to get all survey questions
  const getAllSurveyQuestions = (survey) => {
    if (!survey) return [];
    const actualSurvey = survey.survey || survey;
    let allQuestions = [];
    
    // Get questions from sections
    if (actualSurvey?.sections && Array.isArray(actualSurvey.sections)) {
      actualSurvey.sections.forEach(section => {
        if (section.questions && Array.isArray(section.questions)) {
          allQuestions.push(...section.questions);
        }
      });
    }
    
    // Get direct questions if they exist
    if (actualSurvey?.questions && Array.isArray(actualSurvey.questions)) {
      allQuestions.push(...actualSurvey.questions);
    }
    
    // Sort by order if available
    allQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    return allQuestions;
  };

  // Helper function to check if question is AC or polling station selection
  const isACOrPollingStationQuestion = (question) => {
    // Check by questionId
    if (question.id === 'ac-selection') return true;
    // Check by question type
    if (question.type === 'polling_station') return true;
    // Check by question text (fallback)
    const questionText = question.text || question.questionText || '';
    if (questionText.toLowerCase().includes('select assembly constituency') || 
        questionText.toLowerCase().includes('select polling station')) {
      return true;
    }
    return false;
  };

  // Helper function to get district from AC using assemblyConstituencies.json
  const getDistrictFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
    
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituenciesData.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => {
          if (!ac || !ac.acName) return false;
          const acNameLower = String(ac.acName).toLowerCase();
          const searchNameLower = acNameStr.toLowerCase();
          return ac.acName === acName || acNameLower === searchNameLower;
        });
        if (constituency && constituency.district) {
          return constituency.district;
        }
      }
    }
    return 'N/A';
  };

  // Helper function to get Lok Sabha from AC
  const getLokSabhaFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
    
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituenciesData.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => {
          if (!ac || !ac.acName) return false;
          const acNameLower = String(ac.acName).toLowerCase();
          const searchNameLower = acNameStr.toLowerCase();
          return ac.acName === acName || acNameLower === searchNameLower;
        });
        if (constituency && constituency.lokSabha) {
          return constituency.lokSabha;
        }
      }
    }
    return 'N/A';
  };

  // Helper function to extract numeric AC code (remove alphabets and leading zeros)
  const extractNumericACCode = (acCode) => {
    if (!acCode || acCode === 'N/A') return 'N/A';
    const acCodeStr = String(acCode).trim();
    // Remove all non-numeric characters from the start
    const numericPart = acCodeStr.replace(/^[^0-9]+/, '');
    // Remove leading zeros
    const finalCode = numericPart.replace(/^0+/, '') || '0';
    return finalCode;
  };

  // Helper function to get AC code from AC name (returns numeric code only)
  const getACCodeFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituenciesData.states) return 'N/A';
    
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituenciesData.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => {
          if (!ac || !ac.acName) return false;
          const acNameLower = String(ac.acName).toLowerCase();
          const searchNameLower = acNameStr.toLowerCase();
          return ac.acName === acName || acNameLower === searchNameLower;
        });
        if (constituency) {
          // Try acCode first, then numericCode
          if (constituency.acCode) {
            return extractNumericACCode(constituency.acCode);
          }
          if (constituency.numericCode) {
            return extractNumericACCode(constituency.numericCode);
          }
        }
      }
    }
    return 'N/A';
  };

  // Cache for polling station data to avoid multiple API calls
  const pollingStationDataCache = useRef(new Map());

  // Helper function to get PC code, district code, and region from polling_stations.json via API
  const getPollingStationData = async (acCode) => {
    if (!acCode || acCode === 'N/A') return { pcCode: 'N/A', districtCode: 'N/A', regionCode: 'N/A', regionName: 'N/A' };
    
    // Check cache first
    if (pollingStationDataCache.current.has(acCode)) {
      return pollingStationDataCache.current.get(acCode);
    }
    
    try {
      // Fetch polling station data from backend using axios
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/polling-stations/ac/${acCode}`, {
        method: 'GET',
        headers: headers
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const data = {
            pcCode: result.data.pc_no ? String(result.data.pc_no) : 'N/A',
            districtCode: result.data.district_code ? String(result.data.district_code) : 'N/A',
            regionCode: result.data.region_code ? String(result.data.region_code) : 'N/A',
            regionName: result.data.region_name || 'N/A'
          };
          // Cache the result
          pollingStationDataCache.current.set(acCode, data);
          return data;
        }
      }
    } catch (error) {
      console.error('Error fetching polling station data:', error);
    }
    
    const defaultData = { pcCode: 'N/A', districtCode: 'N/A', regionCode: 'N/A', regionName: 'N/A' };
    pollingStationDataCache.current.set(acCode, defaultData);
    return defaultData;
  };

  // Helper function to extract polling station code and name from format "59 - Kandaya Prathamik Bidyalay"
  const extractPollingStationCodeAndName = (stationValue) => {
    let stationCode = 'N/A';
    let stationName = 'N/A';
    
    if (!stationValue || stationValue === 'N/A') {
      return { stationCode, stationName };
    }
    
    const stationStr = String(stationValue).trim();
    
    // Check if it's in format "Code - Name" or "Group - Code - Name"
    if (stationStr.includes(' - ')) {
      const parts = stationStr.split(' - ');
      
      // If first part is "Group X", skip it
      if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
        // Format: "Group X - Code - Name"
        stationCode = parts[1].trim();
        stationName = parts.slice(2).join(' - ').trim();
      } else if (parts.length >= 2) {
        // Format: "Code - Name"
        stationCode = parts[0].trim();
        stationName = parts.slice(1).join(' - ').trim();
      } else {
        stationCode = stationStr;
        stationName = stationStr;
      }
    } else {
      // If no " - " separator, treat entire string as code
      stationCode = stationStr;
      stationName = stationStr;
    }
    
    return { stationCode, stationName };
  };

  // Helper function to get status code (0=terminated, 10=valid, 20=rejected, 40=under qc)
  const getStatusCode = (status) => {
    if (!status) return '';
    const statusUpper = String(status).toUpperCase();
    if (statusUpper === 'APPROVED' || statusUpper === 'VALID') return '10';
    if (statusUpper === 'REJECTED') return '20';
    if (statusUpper === 'PENDING_APPROVAL' || statusUpper === 'UNDER_QC' || statusUpper === 'UNDER QC') return '40';
    if (statusUpper === 'ABANDONED' || statusUpper === 'TERMINATED') return '0';
    return '';
  };

  // Helper function to get rejection reason code
  const getRejectionReasonCode = (response) => {
    if (!response || response.status !== 'Rejected') {
      return '';
    }
    
    const verificationData = response.verificationData || {};
    const autoRejectionReasons = verificationData.autoRejectionReasons || [];
    const criteria = verificationData.criteria || verificationData.verificationCriteria || {};
    const feedback = verificationData.feedback || '';
    const feedbackLower = feedback.toLowerCase();
    
    // Priority 1: Check auto-rejection reasons
    if (autoRejectionReasons.length > 0) {
      if (autoRejectionReasons.includes('duration')) return '1';
      if (autoRejectionReasons.includes('gps_distance')) return '2';
      if (autoRejectionReasons.includes('duplicate_phone')) return '3';
    }
    
    // Priority 2: Check manual rejection criteria
    if (criteria.audioStatus !== null && criteria.audioStatus !== undefined && criteria.audioStatus !== '') {
      const audioStatus = String(criteria.audioStatus);
      if (!['1', '4', '7'].includes(audioStatus)) return '4';
    }
    
    if (criteria.genderMatching !== null && criteria.genderMatching !== undefined && criteria.genderMatching !== '') {
      const genderMatching = String(criteria.genderMatching);
      if (genderMatching !== '1') return '5';
    }
    
    if (criteria.previousElectionsMatching !== null && 
        criteria.previousElectionsMatching !== undefined && 
        criteria.previousElectionsMatching !== '') {
      const previousElectionsMatching = String(criteria.previousElectionsMatching);
      if (!['1', '3'].includes(previousElectionsMatching)) return '6';
    }
    
    if (criteria.previousLoksabhaElectionsMatching !== null && 
        criteria.previousLoksabhaElectionsMatching !== undefined && 
        criteria.previousLoksabhaElectionsMatching !== '') {
      const previousLoksabhaElectionsMatching = String(criteria.previousLoksabhaElectionsMatching);
      if (!['1', '3'].includes(previousLoksabhaElectionsMatching)) return '7';
    }
    
    if (criteria.upcomingElectionsMatching !== null && 
        criteria.upcomingElectionsMatching !== undefined && 
        criteria.upcomingElectionsMatching !== '') {
      const upcomingElectionsMatching = String(criteria.upcomingElectionsMatching);
      if (!['1', '3'].includes(upcomingElectionsMatching)) return '8';
    }
    
    // Priority 3: Check feedback text
    if (feedback) {
      if (feedbackLower.includes('interview too short') || 
          feedbackLower.includes('too short') ||
          feedbackLower.includes('short duration')) return '1';
      if (feedbackLower.includes('gps location too far') ||
          feedbackLower.includes('gps') && feedbackLower.includes('far') ||
          feedbackLower.includes('location too far') ||
          feedbackLower.includes('gps distance')) return '2';
      if (feedbackLower.includes('duplicate phone') ||
          feedbackLower.includes('duplicate phone number')) return '3';
      if (feedbackLower.includes('audio') && 
          (feedbackLower.includes('not') || feedbackLower.includes('cannot') || feedbackLower.includes('fail'))) return '4';
      if (feedbackLower.includes('gender') && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '5';
      if ((feedbackLower.includes('2021') || feedbackLower.includes('assembly')) && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '6';
      if ((feedbackLower.includes('2024') || feedbackLower.includes('lok sabha') || feedbackLower.includes('general election')) && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '7';
      if ((feedbackLower.includes('2025') || feedbackLower.includes('preference') || feedbackLower.includes('pref')) && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match'))) return '8';
      if (feedbackLower.includes('interviewer performance') || 
          feedbackLower.includes('performance') ||
          feedbackLower.includes('quality') ||
          feedbackLower.includes('incomplete') ||
          feedbackLower.includes('poor quality') ||
          feedbackLower.includes('poor performance')) return '9';
    }
    
    return '';
  };

  // Helper function to check if an option is "Others"
  const isOthersOption = (optText) => {
    if (!optText) return false;
    const normalized = String(optText).toLowerCase().trim();
    return normalized === 'other' || 
           normalized === 'others' || 
           normalized.includes('other') && (normalized.includes('specify') || normalized.includes('please') || normalized.includes('(specify)'));
  };

  // Helper function to extract "Others" text from response
  const extractOthersText = (responseValue) => {
    if (!responseValue) return null;
    const responseStr = String(responseValue);
    if (responseStr.startsWith('Others: ')) {
      return responseStr.substring(8);
    }
    return null;
  };

  // Helper function to format response display text
  const formatResponseDisplay = (response, surveyQuestion) => {
    if (!response || response === null || response === undefined) {
      return 'No response';
    }

    if (Array.isArray(response)) {
      if (response.length === 0) return 'No selections';
      
      const displayTexts = response.map(value => {
        if (surveyQuestion && surveyQuestion.options) {
          const option = surveyQuestion.options.find(opt => opt.value === value);
          return option ? getMainText(option.text || option.value || value) : value;
        }
        return value;
      });
      
      return displayTexts.join(', ');
    }

    if (typeof response === 'string' || typeof response === 'number') {
      if (surveyQuestion && surveyQuestion.options) {
        const option = surveyQuestion.options.find(opt => opt.value === response);
        return option ? getMainText(option.text || option.value || response.toString()) : response.toString();
      }
      return response.toString();
    }

    return JSON.stringify(response);
  };

  // Helper function to get hardcoded option mappings
  const getHardcodedOptionMapping = (questionText, responseValue) => {
    // This is a simplified version - full version would have more mappings
    if (!questionText || !responseValue) return responseValue;
    return String(responseValue);
  };

  // Handle CSV download - Show modal first
  const handleCSVDownload = () => {
    if (pagination.totalResponses === 0) {
      showError('No responses to download');
      return;
    }

    if (!survey) {
      showError('Survey data not available');
      return;
    }

    setShowDownloadModal(true);
  };

  // Generate CSV with selected mode - Full implementation
  const generateCSV = async (downloadMode) => {
    setShowDownloadModal(false);
    setDownloadingCSV(true);
    setCsvProgress({ current: 0, total: 0, stage: 'Creating CSV generation job...' });

    let pollInterval = null;
    let jobId = null;
    let downloadInProgress = false; // Flag to prevent multiple downloads
    let downloadCompleted = false; // Flag to prevent re-downloading
    const storageKey = `csv-job-${surveyId}-${downloadMode}`;

    try {
      if (!survey) {
        showError('Survey data not available');
        setDownloadingCSV(false);
        return;
      }

      // Check localStorage for existing recent job (Approach 3: Frontend state management)
      const existingJobData = localStorage.getItem(storageKey);
      if (existingJobData) {
        try {
          const parsed = JSON.parse(existingJobData);
          const jobAge = Date.now() - parsed.timestamp;
          const maxAge = 30 * 60 * 1000; // 30 minutes
          
          if (jobAge < maxAge) {
            // Check if job is still valid
            const progressCheck = await surveyResponseAPI.getCSVJobProgress(parsed.jobId);
            if (progressCheck.success) {
              const { state } = progressCheck;
              if (state === 'waiting' || state === 'active') {
                console.log('🔄 Resuming existing job from localStorage:', parsed.jobId);
                jobId = parsed.jobId;
                setCsvProgress({ 
                  current: 0, 
                  total: 0, 
                  stage: progressCheck.isLinked ? 'Linked to existing job...' : 'Resuming job...' 
                });
                // Continue to polling below
              } else if (state === 'completed') {
                // Job already completed, download immediately
                console.log('✅ Job already completed, downloading...');
                await surveyResponseAPI.downloadCSVFromJob(parsed.jobId);
                showSuccess('CSV downloaded successfully!');
        setDownloadingCSV(false);
        setCsvProgress({ current: 0, total: 0, stage: '' });
                localStorage.removeItem(storageKey);
        return;
              } else {
                // Job failed or not found, create new one
                localStorage.removeItem(storageKey);
              }
            }
          } else {
            // Job too old, remove it
            localStorage.removeItem(storageKey);
          }
        } catch (error) {
          console.warn('Error checking existing job:', error);
          localStorage.removeItem(storageKey);
        }
      }

      // Step 1: Create CSV generation job (returns immediately with job ID)
      if (!jobId) {
        setCsvProgress({ current: 0, total: 0, stage: 'Creating job...' });
        
        const jobResponse = await surveyResponseAPI.createCSVJob(surveyId, filters, downloadMode);
        
        if (!jobResponse.success || !jobResponse.jobId) {
          throw new Error(jobResponse.message || 'Failed to create CSV generation job');
        }

        jobId = jobResponse.jobId;
        
        // Store job ID in localStorage (Approach 3)
        localStorage.setItem(storageKey, JSON.stringify({
          jobId: jobId,
          timestamp: Date.now(),
          surveyId: surveyId,
          mode: downloadMode
        }));
        
        if (jobResponse.isLinked) {
          console.log('🔗 Linked to existing job:', jobId);
          setCsvProgress({ current: 0, total: 0, stage: 'Linked to existing job, checking progress...' });
        } else {
          console.log('✅ CSV Job created:', jobId);
        }
      }

      // Step 2: Start polling for progress
      setCsvProgress({ current: 0, total: 0, stage: 'Job created, starting generation...' });

      let pollErrorCount = 0;
      const maxPollErrors = 5;

      const pollProgress = async () => {
        // CRITICAL: Stop polling immediately if download already completed or in progress
        if (downloadCompleted || downloadInProgress) {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        return;
      }
      
        try {
          const progressResponse = await surveyResponseAPI.getCSVJobProgress(jobId);
          
          // Reset error count on success
          pollErrorCount = 0;
          
          if (!progressResponse.success) {
            throw new Error(progressResponse.message || 'Failed to get job progress');
          }

          const { state, progress, result } = progressResponse;
          
          console.log('📊 Progress update:', { state, progress, jobId, hasResult: !!result });

          // Check if job is completed - check multiple indicators
          const isCompleted = state === 'completed' || 
                             (progress && typeof progress === 'object' && progress.stage === 'completed') ||
                             (progress && typeof progress === 'object' && progress.message && progress.message.includes('completed')) ||
                             !!result;

          // Update progress based on job state and progress
          if (progress && typeof progress === 'object') {
            const { percentage, current, total, stage, message } = progress;
            
            // If we detect completion from message/stage, treat as completed
            if (isCompleted && !(state === 'completed')) {
              console.log('✅ Detected completion from progress message/stage, treating as completed');
            }
            
            setCsvProgress({
              current: current || Math.round((percentage || 0) * (total || 100) / 100) || 0,
              total: total || 100,
              stage: message || stage || 'Processing...'
            });
          } else if (typeof progress === 'number') {
            setCsvProgress({
              current: Math.round(progress),
              total: 100,
              stage: `Generating CSV... ${Math.round(progress)}%`
            });
            } else {
            // Estimate progress based on state
            let estimatedProgress = 0;
            let stageMessage = 'Processing...';
            
            if (state === 'waiting') {
              estimatedProgress = 0;
              stageMessage = 'Job queued, waiting to start...';
            } else if (state === 'active') {
              estimatedProgress = 10;
              stageMessage = 'CSV generation in progress...';
            } else if (state === 'completed' || isCompleted) {
              estimatedProgress = 100;
              stageMessage = 'CSV generation completed!';
            } else if (state === 'failed') {
              throw new Error(progressResponse.error || 'CSV generation failed');
            }
            
            setCsvProgress({
              current: estimatedProgress,
              total: 100,
              stage: stageMessage
            });
          }

          // Check if job is completed - use multiple indicators
          if (isCompleted) {
            // CRITICAL: Stop polling FIRST, before any download logic
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }

            // CRITICAL: Check if download already started/completed (prevent duplicates)
            if (downloadInProgress || downloadCompleted) {
              console.log('⚠️ Download already in progress or completed, skipping duplicate download');
              return;
            }

            // Mark download as in progress to prevent duplicates
            downloadInProgress = true;
            
            setCsvProgress({ current: 100, total: 100, stage: 'Preparing download...' });
            
            // Retry download up to 3 times
            let downloadAttempts = 0;
            const maxDownloadAttempts = 3;
            let downloadSuccess = false;
            
            try {
              while (downloadAttempts < maxDownloadAttempts && !downloadSuccess && !downloadCompleted) {
                downloadAttempts++;
                console.log(`📥 Download attempt ${downloadAttempts}/${maxDownloadAttempts} for job:`, jobId);
                
                // Wait a bit longer on retries
                if (downloadAttempts > 1) {
                  setCsvProgress({ current: 100, total: 100, stage: `Retrying download (${downloadAttempts}/${maxDownloadAttempts})...` });
                  await new Promise(resolve => setTimeout(resolve, 2000 * downloadAttempts));
                } else {
                  // Small delay to ensure file is fully written and job state is updated
                  setCsvProgress({ current: 100, total: 100, stage: 'Finalizing...' });
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                await surveyResponseAPI.downloadCSVFromJob(jobId);
                
                console.log('✅ CSV download triggered successfully');
                downloadSuccess = true;
                downloadCompleted = true; // Mark as completed
                
                // Clear localStorage on successful download
                localStorage.removeItem(storageKey);
                
                showSuccess('CSV downloaded successfully!');
                setDownloadingCSV(false);
                setCsvProgress({ current: 0, total: 0, stage: '' });
                
                // Exit immediately after successful download
                return;
              }
              
              if (!downloadSuccess) {
                // All attempts failed
                downloadInProgress = false; // Reset flag on failure
                localStorage.removeItem(storageKey);
                showError(`Download failed after ${maxDownloadAttempts} attempts. You can try downloading again manually.`);
                setDownloadingCSV(false);
                setCsvProgress({ current: 0, total: 0, stage: '' });
              }
            } catch (downloadError) {
              console.error(`❌ Download error:`, downloadError);
              downloadInProgress = false; // Reset flag on error
              
              if (downloadAttempts >= maxDownloadAttempts) {
                localStorage.removeItem(storageKey);
                const errorMsg = downloadError.response?.data?.message || downloadError.message || 'Unknown error';
                showError(`Download failed after ${maxDownloadAttempts} attempts: ${errorMsg}. You can try downloading again manually.`);
                setDownloadingCSV(false);
                setCsvProgress({ current: 0, total: 0, stage: '' });
              }
            }
            
            return; // Exit polling function - IMPORTANT: prevent restart
          } else if (state === 'failed') {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            throw new Error(progressResponse.error || 'CSV generation failed');
          }
          // If still processing, continue polling

        } catch (error) {
          pollErrorCount++;
          console.error(`❌ Poll error (${pollErrorCount}/${maxPollErrors}):`, error);
          
          // If too many errors, stop polling
          if (pollErrorCount >= maxPollErrors) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            localStorage.removeItem(storageKey);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to get job progress';
            showError(`CSV generation error: ${errorMsg}. Please try again.`);
            setDownloadingCSV(false);
            setCsvProgress({ current: 0, total: 0, stage: '' });
                return;
              }
          
          // Continue polling despite error (might be temporary)
          setCsvProgress({ 
            current: 0, 
            total: 100, 
            stage: `Connection issue (${pollErrorCount}/${maxPollErrors}), retrying...` 
          });
        }
      };

      // Poll immediately, then every 2 seconds
      // Only start polling if download hasn't completed
      if (!downloadCompleted && !downloadInProgress) {
        await pollProgress();
        // Only set interval if download hasn't started during initial poll
        if (!downloadCompleted && !downloadInProgress) {
          pollInterval = setInterval(() => {
            // Double-check before each poll
            if (downloadCompleted || downloadInProgress) {
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              return;
            }
            pollProgress();
          }, 2000); // Poll every 2 seconds
        }
      }

      // Set maximum polling time (30 minutes)
      setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
          if (setDownloadingCSV) {
            setDownloadingCSV(false);
            showError('CSV generation timed out. Please try again.');
            setCsvProgress({ current: 0, total: 0, stage: '' });
          }
        }
      }, 30 * 60 * 1000); // 30 minutes

    } catch (error) {
      console.error('Error in CSV generation:', error);
      
      // Clean up polling interval
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      
      // Clear localStorage on error
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      showError(`Failed to generate CSV: ${errorMessage}`);
      setDownloadingCSV(false);
      setCsvProgress({ current: 0, total: 0, stage: '' });
    }
  };

  // Clear all filters

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'approved_rejected_pending',
      dateRange: 'today', // Reset to 'today' instead of 'all' for better performance
      startDate: '',
      endDate: '',
      gender: '',
      ageMin: '',
      ageMax: '',
      ac: '',
      city: '',
      district: '',
      lokSabha: '',
      interviewMode: '',
      interviewerIds: [],
      interviewerMode: 'include'
    });
    setInterviewerSearchTerm('');
    setAcSearchTerm('');
  };

  // Add CSS for full-width responsive layout
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .survey-responses-v2-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .survey-responses-v2-page * {
        max-width: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  return (
    <div className="survey-responses-v2-page min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(backPath)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {survey?.surveyName || 'Survey Responses'}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isCompanyAdmin && (
                <>
                  {/* Pre-generated CSV Download Button */}
                  {!loadingCSVInfo && csvFileInfo && (csvFileInfo.codes || csvFileInfo.responses) && (
                    <div className="flex flex-col items-end">
                      <button
                        onClick={() => setShowPreGeneratedDownloadModal(true)}
                        className="flex flex-col items-center space-y-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        title="Download Pre-generated CSV"
                      >
                        <div className="flex items-center space-x-2">
                          <Download className="w-4 h-4" />
                          <span className="text-sm font-medium">Download Data</span>
                        </div>
                        {(csvFileInfo.codes || csvFileInfo.responses) && (
                          <span className="text-xs opacity-90">
                            Last Updated: {(csvFileInfo.codes || csvFileInfo.responses).lastUpdatedIST || new Date((csvFileInfo.codes || csvFileInfo.responses).lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* Current CSV Download Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDownloadModal(true)}
                      disabled={downloadingCSV || pagination.totalResponses === 0}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Download CSV (Company Admin Only)"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {downloadingCSV 
                          ? (csvProgress.total > 0 
                              ? `Downloading... ${csvProgress.current}/${csvProgress.total} (${Math.round((csvProgress.current / csvProgress.total) * 100)}%)`
                              : 'Downloading...')
                          : 'Download CSV'}
                      </span>
                    </button>
                    {downloadingCSV && csvProgress.stage && (
                      <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50">
                        {csvProgress.stage}
                      </div>
                    )}
                  </div>
                </>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search by Response ID, Interviewer, AC, City..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="approved_rejected_pending">All (Approved, Rejected, Pending)</option>
                  <option value="approved_pending">Approved & Pending</option>
                  <option value="pending">Pending Only</option>
                  <option value="Approved">Approved Only</option>
                  <option value="Rejected">Rejected Only</option>
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Range */}
              {filters.dateRange === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <DatePicker
                      selected={filters.startDate ? new Date(filters.startDate) : null}
                      onChange={handleStartDateChange}
                      dateFormat="yyyy-MM-dd"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholderText="Select start date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <DatePicker
                      selected={filters.endDate ? new Date(filters.endDate) : null}
                      onChange={handleEndDateChange}
                      dateFormat="yyyy-MM-dd"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholderText="Select end date"
                    />
                  </div>
                </>
              )}

              {/* Interview Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interview Mode</label>
                <select
                  value={filters.interviewMode}
                  onChange={(e) => handleFilterChange('interviewMode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Modes</option>
                  <option value="CAPI">CAPI</option>
                  <option value="CATI">CATI</option>
                </select>
              </div>

              {/* AC Filter (Search-first) */}
              <div className="relative" ref={acDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assembly Constituency</label>
                <div className="relative">
                  <input
                    type="text"
                    value={acSearchTerm}
                    onChange={(e) => {
                      setAcSearchTerm(e.target.value);
                      setShowACDropdown(true);
                    }}
                    onFocus={() => setShowACDropdown(true)}
                    placeholder="Search AC code or name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {filters.ac && (
                    <button
                      onClick={() => handleFilterChange('ac', '')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showACDropdown && filteredACs.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredACs.map((ac) => (
                      <button
                        key={ac.acCode}
                        onClick={() => handleACToggle(ac.acName)}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                          filters.ac === ac.acName ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="font-medium">{ac.acName}</div>
                        <div className="text-sm text-gray-500">{ac.acCode}</div>
                      </button>
                    ))}
                  </div>
                )}
                {filters.ac && (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                      {filters.ac}
                      <button
                        onClick={() => handleFilterChange('ac', '')}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {/* Interviewer Filter (Search-first) */}
              <div className="relative" ref={interviewerDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer</label>
                <div className="relative">
                  <input
                    type="text"
                    value={interviewerSearchTerm}
                    onChange={(e) => setInterviewerSearchTerm(e.target.value)}
                    onFocus={() => {
                      if (interviewerSearchTerm.trim().length >= 2) {
                        setShowInterviewerDropdown(true);
                      }
                    }}
                    placeholder="Search by member ID..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchingInterviewers && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
                {showInterviewerDropdown && searchedInterviewers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchedInterviewers.map((interviewer) => (
                      <button
                        key={interviewer._id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🔍 CLICKED INTERVIEWER BUTTON:', {
                            interviewer,
                            interviewerId: interviewer._id,
                            interviewerIdType: typeof interviewer._id,
                            currentFilters: filters
                          });
                          handleInterviewerToggle(interviewer._id, interviewer);
                          setShowInterviewerDropdown(false);
                          setInterviewerSearchTerm('');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                          filters.interviewerIds.some(id => {
                            const idStr = id?.toString?.() || String(id || '');
                            const interviewerIdStr = interviewer._id?.toString?.() || String(interviewer._id || '');
                            return idStr === interviewerIdStr;
                          }) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="font-medium">{interviewer.memberId}</div>
                        <div className="text-sm text-gray-500">
                          {interviewer.firstName} {interviewer.lastName}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {filters.interviewerIds.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {filters.interviewerIds.map((id) => {
                      // Find interviewer from selectedInterviewers first, then searchedInterviewers
                      const idStr = id?.toString?.() || String(id || '');
                      let interviewer = selectedInterviewers.find(i => {
                        const interviewerIdStr = i._id?.toString?.() || String(i._id || '');
                        return idStr === interviewerIdStr;
                      });
                      if (!interviewer) {
                        interviewer = searchedInterviewers.find(i => {
                          const interviewerIdStr = i._id?.toString?.() || String(i._id || '');
                          return idStr === interviewerIdStr;
                        });
                      }
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                        >
                          {interviewer?.memberId || id}
                          <button
                            onClick={() => handleInterviewerToggle(id)}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="mb-6">
              <div className="bg-white p-4 rounded-lg shadow inline-block max-w-xs">
                <div className="text-sm text-gray-600">Total Responses</div>
                <div className="text-2xl font-bold text-gray-900">{pagination.totalResponses.toLocaleString()}</div>
              </div>
            </div>

            {/* Responses Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response ID</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interviewer</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AC</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {responses.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 sm:px-6 py-8 text-center text-gray-500">
                          No responses found matching the filters
                        </td>
                      </tr>
                    ) : (
                      responses.map((response, index) => {
                        const respondentInfo = getRespondentInfo(response);
                        const serialNumber = (pagination.currentPage - 1) * 20 + index + 1;
                        
                        return (
                          <tr key={response._id} className="hover:bg-gray-50">
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{serialNumber}</td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                              {response.responseId || response._id?.toString().slice(-8) || 'N/A'}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {response.interviewerDetails?.memberId || 'N/A'}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                response.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                response.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {response.status}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                              {response.interviewMode ? (
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                  response.interviewMode.toLowerCase() === 'capi' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {response.interviewMode.toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-gray-900">N/A</span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {respondentInfo.ac}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(response.startTime || response.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => handleViewResponse(response)}
                                disabled={loadingResponseDetails}
                                className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="View Response Details"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={!pagination.hasNext}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(pagination.currentPage - 1) * 20 + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.currentPage * 20, pagination.totalResponses)}
                        </span>{' '}
                        of <span className="font-medium">{pagination.totalResponses.toLocaleString()}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => handlePageChange(pagination.currentPage - 1)}
                          disabled={!pagination.hasPrev}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNum === pagination.currentPage
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => handlePageChange(pagination.currentPage + 1)}
                          disabled={!pagination.hasNext}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Response Details Modal */}
      {showResponseDetails && (fullResponseDetails || selectedResponse) && (
        <ResponseDetailsModal
          response={fullResponseDetails || selectedResponse}
          survey={survey}
          onClose={handleCloseModal}
          onStatusChange={(updatedResponse) => {
            // Update the response in the list
            setResponses(prev => 
              prev.map(r => 
                (r._id === updatedResponse._id) 
                  ? updatedResponse 
                  : r
              )
            );
            setSelectedResponse(updatedResponse);
            setFullResponseDetails(updatedResponse);
          }}
        />
      )}

      {/* Pre-generated CSV Download Modal */}
      {showPreGeneratedDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Choose Download Format</h3>
            <p className="text-sm text-gray-600 mb-6">
              Select how you want to download the pre-generated CSV:
            </p>
            
            <div className="space-y-3">
              {csvFileInfo?.responses && (
                <button
                  onClick={async () => {
                    try {
                      setShowPreGeneratedDownloadModal(false);
                      const blob = await surveyResponseAPI.downloadPreGeneratedCSV(surveyId, 'responses');
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'responses_responses.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                      showSuccess('CSV downloaded successfully');
                    } catch (error) {
                      showError('Failed to download pre-generated CSV: ' + error.message);
                    }
                  }}
                  className="w-full px-4 py-3 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
                >
                  <div className="font-medium">Download Responses</div>
                  <div className="text-sm text-blue-100 mt-1">
                    Download with full response text (e.g., "Male", "Female", "Others")
                  </div>
                </button>
              )}
              
              {csvFileInfo?.codes && (
                <button
                  onClick={async () => {
                    try {
                      setShowPreGeneratedDownloadModal(false);
                      const blob = await surveyResponseAPI.downloadPreGeneratedCSV(surveyId, 'codes');
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'responses_codes.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                      showSuccess('CSV downloaded successfully');
                    } catch (error) {
                      showError('Failed to download pre-generated CSV: ' + error.message);
                    }
                  }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-left"
                >
                  <div className="font-medium">Download Response Codes</div>
                  <div className="text-sm text-green-100 mt-1">
                    Download with option codes for MCQ questions (e.g., "1", "2", "3")
                  </div>
                </button>
              )}
            </div>
            
            <button
              onClick={() => setShowPreGeneratedDownloadModal(false)}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Download Mode Selection Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Choose Download Format</h3>
            <p className="text-sm text-gray-600 mb-6">
              Select how you want to download the responses:
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => generateCSV('responses')}
                className="w-full px-4 py-3 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
              >
                <div className="font-medium">Download Responses</div>
                <div className="text-sm text-blue-100 mt-1">
                  Download with full response text (e.g., "Male", "Female", "Others")
                </div>
              </button>
              
              <button
                onClick={() => generateCSV('codes')}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-left"
              >
                <div className="font-medium">Download Response Codes</div>
                <div className="text-sm text-green-100 mt-1">
                  Download with option codes for MCQ questions (e.g., "1", "2", "3")
                </div>
              </button>
            </div>
            
            <button
              onClick={() => setShowDownloadModal(false)}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewResponsesV2Page;

