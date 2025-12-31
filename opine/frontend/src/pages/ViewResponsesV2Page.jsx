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
  const [filters, setFilters] = useState({
    search: '',
    status: 'approved_rejected_pending',
    dateRange: 'all',
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
  const fetchResponses = useCallback(async (page = 1) => {
    if (!surveyId) return;
    
    try {
      setLoading(true);
      
      const params = {
        page,
        limit: 20,
        status: filters.status || 'approved_rejected_pending',
        dateRange: filters.dateRange || 'all',
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
        interviewerIds: filters.interviewerIds && filters.interviewerIds.length > 0 ? filters.interviewerIds.join(',') : '',
        interviewerMode: filters.interviewerMode || 'include',
        search: filters.search || ''
      };

      const response = await surveyResponseAPI.getSurveyResponsesV2(surveyId, params);
      
      if (response.success) {
        setResponses(response.data.responses);
        setPagination(response.data.pagination);
        setFilterOptions(response.data.filterOptions);
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      showError('Failed to load responses');
    } finally {
      setLoading(false);
    }
  }, [surveyId, filters, showError]);

  // Initial load - fetch immediately without debounce
  useEffect(() => {
    if (surveyId && !initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchResponses(1);
    }
  }, [surveyId, fetchResponses]);

  // Reset initial load ref when surveyId changes
  useEffect(() => {
    initialLoadRef.current = false;
  }, [surveyId]);

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
  useEffect(() => {
    if (!surveyId || !initialLoadRef.current) return; // Don't run until initial load is done
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      fetchResponses(1);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
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
  useEffect(() => {
    if (interviewerSearchTimerRef.current) {
      clearTimeout(interviewerSearchTimerRef.current);
    }

    if (interviewerSearchTerm.trim().length >= 2) {
      interviewerSearchTimerRef.current = setTimeout(() => {
        searchInterviewers(interviewerSearchTerm);
        setShowInterviewerDropdown(true);
      }, 500);
    } else {
      setSearchedInterviewers([]);
      setShowInterviewerDropdown(false);
    }

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
  const handleInterviewerToggle = (interviewerId) => {
    setFilters(prev => {
      const currentIds = prev.interviewerIds || [];
      const idStr = interviewerId?.toString() || interviewerId;
      const isSelected = currentIds.includes(idStr);
      
      return {
        ...prev,
        interviewerIds: isSelected
          ? currentIds.filter(id => id !== idStr)
          : [...currentIds, idStr]
      };
    });
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
  const getRespondentInfo = (response) => {
    return {
      ac: response.acValue || response.selectedAC || response.selectedPollingStation?.acName || 'N/A',
      city: response.cityValue || 'N/A',
      district: response.districtValue || response.selectedPollingStation?.district || 'N/A',
      lokSabha: response.lokSabhaValue || response.selectedPollingStation?.pcName || 'N/A'
    };
  };

  // Fetch full response details when View is clicked
  const handleViewResponse = async (response) => {
    try {
      setLoadingResponseDetails(true);
      setShowResponseDetails(true);
      
      // Fetch full response details from backend
      const responseData = await surveyResponseAPI.getSurveyResponseById(response._id);
      
      if (responseData.success && responseData.interview) {
        // The backend returns { success: true, interview: {...} }
        setFullResponseDetails(responseData.interview);
        setSelectedResponse(responseData.interview);
      } else {
        // Fallback to the response from list if API fails
        setFullResponseDetails(response);
        setSelectedResponse(response);
        showError('Could not load full response details, showing partial data');
      }
    } catch (error) {
      console.error('Error fetching response details:', error);
      // Fallback to the response from list
      setFullResponseDetails(response);
      setSelectedResponse(response);
      showError('Could not load full response details, showing partial data');
    } finally {
      setLoadingResponseDetails(false);
    }
  };

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

    try {
      if (!survey) {
        showError('Survey data not available');
        setDownloadingCSV(false);
        return;
      }

      // Fetch total count first to know how many responses we need to process
      setCsvProgress({ current: 0, total: 0, stage: 'Counting responses...' });
      
      // Build params object with filters - ensure all filter fields are included
      // Format interviewerIds as comma-separated string (backend expects string)
      const countParams = {
        limit: '1',
        page: '1',
        status: filters.status || 'approved_rejected_pending',
        dateRange: filters.dateRange || 'all',
        startDate: filters.startDate || '',
        endDate: filters.endDate || '',
        interviewMode: filters.interviewMode || '',
        ac: filters.ac || '',
        interviewerIds: filters.interviewerIds && filters.interviewerIds.length > 0 ? filters.interviewerIds.join(',') : '',
        interviewerMode: filters.interviewerMode || 'include',
        search: filters.search || ''
      };
      
      console.log('CSV Download - Count params:', countParams);
      
      let countResponse;
      try {
        countResponse = await surveyResponseAPI.getSurveyResponsesV2(surveyId, countParams);
        console.log('CSV Download - Count response:', {
          success: countResponse.success,
          hasData: !!countResponse.data,
          hasPagination: !!countResponse.data?.pagination,
          paginationTotal: countResponse.data?.pagination?.totalResponses
        });
      } catch (error) {
        console.error('CSV Download - Error fetching count:', error);
        console.error('CSV Download - Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        showError(`Failed to count responses: ${error.response?.data?.message || error.message || 'Unknown error'}`);
        setDownloadingCSV(false);
        setCsvProgress({ current: 0, total: 0, stage: '' });
        return;
      }
      
      if (!countResponse || !countResponse.success) {
        console.error('CSV Download - Count response failed:', countResponse);
        showError(`Failed to count responses: ${countResponse?.message || 'Unknown error'}`);
        setDownloadingCSV(false);
        setCsvProgress({ current: 0, total: 0, stage: '' });
        return;
      }
      
      // Response structure: { success: true, data: { responses: [], pagination: { totalResponses: ... } } }
      const totalResponses = countResponse.data?.pagination?.totalResponses || countResponse.data?.totalResponses || 0;
      console.log('CSV Download - Total responses:', totalResponses);
      
      if (totalResponses === 0) {
        console.warn('CSV Download - No responses found with filters:', countParams);
        showError('No responses found matching the filters. Please adjust your filters and try again.');
        setDownloadingCSV(false);
        setCsvProgress({ current: 0, total: 0, stage: '' });
        return;
      }

      // Fetch responses in chunks to avoid timeout and memory issues
      const FETCH_CHUNK_SIZE = 500; // Reduced from 1000 to 500 for better reliability
      const MAX_RETRIES = 3; // Maximum retry attempts per chunk
      const RETRY_DELAY_BASE = 1000; // Base delay in ms (1 second)
      const CHUNK_DELAY = 300; // Delay between chunks in ms (increased from 100)
      
      const allResponses = [];
      let fetchedCount = 0;
      
      setCsvProgress({ current: 0, total: totalResponses, stage: `Fetching responses (0/${totalResponses})...` });
      
      // Helper function to fetch a chunk with retry logic
      const fetchChunkWithRetry = async (chunkParams, retryCount = 0) => {
        try {
          const chunkResponse = await surveyResponseAPI.getSurveyResponsesV2(surveyId, chunkParams);
          
          if (!chunkResponse || !chunkResponse.success) {
            throw new Error(`API error: ${chunkResponse?.message || 'Unknown error'}`);
          }
          
          return chunkResponse.data?.responses || [];
        } catch (error) {
          // Check if it's a network error that we should retry
          const isNetworkError = error.code === 'ERR_NETWORK' || 
                                  error.code === 'ERR_NETWORK_CHANGED' ||
                                  error.message?.includes('Network Error') ||
                                  error.message?.includes('timeout');
          
          if (isNetworkError && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount); // Exponential backoff
            console.warn(`CSV Download - Network error on chunk ${chunkParams.page}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchChunkWithRetry(chunkParams, retryCount + 1);
          }
          
          // If not retryable or max retries reached, throw
          throw error;
        }
      };
      
      while (fetchedCount < totalResponses) {
        const currentPage = Math.floor(fetchedCount / FETCH_CHUNK_SIZE) + 1;
        
        // Build chunk params with all filters
        // Format interviewerIds as comma-separated string (backend expects string)
        const chunkParams = {
          limit: String(FETCH_CHUNK_SIZE),
          page: String(currentPage),
          status: filters.status || 'approved_rejected_pending',
          dateRange: filters.dateRange || 'all',
          startDate: filters.startDate || '',
          endDate: filters.endDate || '',
          interviewMode: filters.interviewMode || '',
          ac: filters.ac || '',
          interviewerIds: filters.interviewerIds && filters.interviewerIds.length > 0 ? filters.interviewerIds.join(',') : '',
          interviewerMode: filters.interviewerMode || 'include',
          search: filters.search || ''
        };
        
        try {
          console.log(`CSV Download - Fetching chunk ${currentPage} (responses ${fetchedCount + 1} to ${fetchedCount + FETCH_CHUNK_SIZE})...`);
          const chunkResponses = await fetchChunkWithRetry(chunkParams);
          
          if (chunkResponses.length === 0 && fetchedCount === 0) {
            // If first chunk is empty, there might be an issue
            console.warn('CSV Download - First chunk is empty, but totalResponses was', totalResponses);
          }
          
          allResponses.push(...chunkResponses);
          fetchedCount += chunkResponses.length;
          
          console.log(`CSV Download - Chunk ${currentPage} completed: ${chunkResponses.length} responses (Total: ${fetchedCount}/${totalResponses})`);
          
          setCsvProgress({ 
            current: fetchedCount, 
            total: totalResponses, 
            stage: `Fetching responses (${fetchedCount}/${totalResponses})...` 
          });
          
          // If we got fewer responses than requested, we've reached the end
          if (chunkResponses.length < FETCH_CHUNK_SIZE) {
            console.log(`CSV Download - Reached end of data at ${fetchedCount} responses (expected ${totalResponses})`);
            if (fetchedCount < totalResponses) {
              console.warn(`CSV Download - Warning: Fetched ${fetchedCount} but expected ${totalResponses}. Missing ${totalResponses - fetchedCount} responses.`);
            }
            break;
          }
          
          // Delay between chunks to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
        } catch (error) {
          console.error(`CSV Download - Error fetching chunk ${currentPage} after retries:`, error);
          const errorMessage = error.response?.data?.message || error.message || 'Network error';
          showError(`Failed to fetch responses at chunk ${currentPage}: ${errorMessage}. Please try again or reduce the date range.`);
          setDownloadingCSV(false);
          setCsvProgress({ current: 0, total: 0, stage: '' });
          return;
        }
      }

      const filteredResponses = allResponses;
      console.log('CSV Download - Fetched responses:', filteredResponses.length, 'out of', totalResponses);
      
      // Verify that all chunks were fetched successfully
      if (fetchedCount !== totalResponses) {
        const missingCount = totalResponses - fetchedCount;
        console.error(`CSV Download - Data mismatch: Fetched ${fetchedCount}, Expected ${totalResponses}, Missing ${missingCount}`);
        
        // Ask user if they want to continue with partial data
        const continueWithPartial = window.confirm(
          `Warning: Only ${fetchedCount} of ${totalResponses} responses were fetched. ` +
          `Missing ${missingCount} responses (likely recent ones). ` +
          `Do you want to continue with partial data or cancel and try again?`
        );
        
        if (!continueWithPartial) {
          setDownloadingCSV(false);
          setCsvProgress({ current: 0, total: 0, stage: '' });
          return;
        }
        
        showError(`Warning: Only ${fetchedCount} of ${totalResponses} responses downloaded. Some recent responses may be missing.`);
      }
      
      // Sort by createdAt ascending (oldest first) to ensure correct order
      // This is critical because chunks are fetched with pagination (limit !== -1) 
      // which means each chunk is sorted newest first, so we need to sort after combining
      const sortedResponses = [...filteredResponses].sort((a, b) => {
        // Try multiple date fields in order of preference
        const getDate = (response) => {
          if (response.createdAt) return new Date(response.createdAt).getTime();
          if (response.endTime) return new Date(response.endTime).getTime();
          if (response.updatedAt) return new Date(response.updatedAt).getTime();
          // Fallback to 0 (will sort to top if no date found)
          return 0;
        };
        
        const dateA = getDate(a);
        const dateB = getDate(b);
        
        // If both dates are valid, sort ascending (oldest first)
        if (dateA > 0 && dateB > 0) {
          return dateA - dateB;
        }
        // If one has no date, put it at the end
        if (dateA === 0) return 1;
        if (dateB === 0) return -1;
        return 0;
      });
      
      console.log('CSV Download - Sorted responses by createdAt (oldest first)');
      if (sortedResponses.length > 0) {
        const getDate = (response) => {
          if (response.createdAt) return new Date(response.createdAt);
          if (response.endTime) return new Date(response.endTime);
          if (response.updatedAt) return new Date(response.updatedAt);
          return new Date(0);
        };
        const firstDate = getDate(sortedResponses[0]);
        const lastDate = getDate(sortedResponses[sortedResponses.length - 1]);
        console.log(`CSV Download - Date range: ${firstDate.toISOString()} to ${lastDate.toISOString()}`);
        console.log(`CSV Download - First response date: ${firstDate.toLocaleDateString()}, Last response date: ${lastDate.toLocaleDateString()}`);
      }
      
      if (sortedResponses.length === 0) {
        console.error('CSV Download - No responses fetched after chunked download');
        showError('No responses found matching the filters. Please check your filters and try again.');
        setDownloadingCSV(false);
        setCsvProgress({ current: 0, total: 0, stage: '' });
        return;
      }
      
      setCsvProgress({ current: 0, total: totalResponses, stage: `Processing ${sortedResponses.length} responses...` });
      
      // Process in chunks to avoid memory issues
      const CHUNK_SIZE = 500; // Process 500 responses at a time

      // Determine if we have CAPI, CATI, or mixed responses
      const hasCAPI = sortedResponses.some(r => r.interviewMode?.toUpperCase() === 'CAPI');
      const hasCATI = sortedResponses.some(r => r.interviewMode?.toUpperCase() === 'CATI');
      const isMixed = hasCAPI && hasCATI;
      const isCAPIOnly = hasCAPI && !hasCATI;
      const isCATIOnly = hasCATI && !hasCAPI;

      // Get ALL questions from the survey itself
      const allSurveyQuestions = getAllSurveyQuestions(survey);
      
      if (allSurveyQuestions.length === 0) {
        showError('No survey questions found');
        setDownloadingCSV(false);
        return;
      }

      // Filter out AC selection and polling station questions
      let regularQuestions = allSurveyQuestions
        .filter(q => !isACOrPollingStationQuestion(q))
        .sort((a, b) => {
          const orderA = a.order !== null && a.order !== undefined ? parseInt(a.order) : 9999;
          const orderB = b.order !== null && b.order !== undefined ? parseInt(b.order) : 9999;
          if (!isNaN(orderA) && !isNaN(orderB)) {
            return orderA - orderB;
          }
          return 0;
        });
      
      // For survey 68fd1915d41841da463f0d46, filter out "Professional Degree" option from Q13
      const surveyIdStr = String(surveyId || survey?._id || survey?.id || '');
      if (surveyIdStr === '68fd1915d41841da463f0d46') {
        regularQuestions = regularQuestions.map(question => {
          const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
          // Check if this is Q13 (three most pressing issues)
          if (questionText.includes('three most pressing issues') && questionText.includes('west bengal')) {
            // Filter out "Professional Degree" option
            if (question.options && Array.isArray(question.options)) {
              const filteredOptions = question.options.filter(opt => {
                const optText = typeof opt === 'object' ? getMainText(opt.text || opt.label || opt.value || '') : getMainText(String(opt));
                const optTextLower = String(optText).toLowerCase();
                return !optTextLower.includes('professional degree');
              });
              return {
                ...question,
                options: filteredOptions
              };
            }
          }
          return question;
        });
      }
      
      if (regularQuestions.length === 0) {
        showError('No regular survey questions found');
        setDownloadingCSV(false);
        return;
      }

      // Helper function to get question code from template mapping
      const getQuestionCodeFromTemplate = (question, questionNumber) => {
        if (!question) return `q${questionNumber}`;
        
        const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
        const qNum = questionNumber;
        
        if (question.id) {
          const questionId = String(question.id).toLowerCase();
          if (questionId.includes('religion') || questionId === 'resp_religion') return 'resp_religion';
          if (questionId.includes('social_cat') || questionId === 'resp_social_cat') return 'resp_social_cat';
          if (questionId.includes('caste') || questionId === 'resp_caste_jati') return 'resp_caste_jati';
          if (questionId.includes('female_edu') || questionId === 'resp_female_edu') return 'resp_female_edu';
          if (questionId.includes('male_edu') || questionId === 'resp_male_edu') return 'resp_male_edu';
          if (questionId.includes('occupation') || questionId === 'resp_occupation') return 'resp_occupation';
          if (questionId.includes('mobile') || questionId === 'resp_mobile') return 'resp_mobile';
          if (questionId.includes('name') && !questionId.includes('caste')) return 'resp_name';
        }
        
        // Map by question text keywords
        if (questionText.includes('religion') && questionText.includes('belong to')) return 'resp_religion';
        if (questionText.includes('social category') && questionText.includes('belong to')) return 'resp_social_cat';
        if (questionText.includes('caste') && (questionText.includes('tell me') || questionText.includes('jati'))) return 'resp_caste_jati';
        if (questionText.includes('female') && questionText.includes('education') && 
            (questionText.includes('most educated') || questionText.includes('highest educational'))) return 'resp_female_edu';
        if (questionText.includes('male') && questionText.includes('education') && 
            (questionText.includes('most educated') || questionText.includes('highest educational'))) return 'resp_male_edu';
        if (questionText.includes('occupation') && questionText.includes('chief wage earner')) return 'resp_occupation';
        if ((questionText.includes('mobile number') || questionText.includes('phone number')) && 
            questionText.includes('share')) return 'resp_mobile';
        if (questionText.includes('share your name') && questionText.includes('confidential')) return 'resp_name';
        if (questionText.includes('contact you in future') || 
            (questionText.includes('future') && questionText.includes('similar surveys'))) return 'thanks_future';
        
        return `q${qNum}`;
      };
      
      // Helper function to get option code for multi-select questions
      const getOptionCodeFromTemplate = (questionCode, optionIndex, option, questionNumber) => {
        const optText = typeof option === 'object' ? getMainText(option.text || '') : getMainText(String(option));
        if (isOthersOption(optText)) {
          if (questionCode.startsWith('resp_') || questionCode === 'thanks_future') {
            return `${questionCode}_oth`;
          }
          return `${questionCode}_oth`;
        }
        
        const optionNum = optionIndex + 1;
        
        if (questionCode.startsWith('resp_') || questionCode === 'thanks_future') {
          return `${questionCode}_${optionNum}`;
        }
        
        return `${questionCode}_${optionNum}`;
      };

      // Build headers with two rows: titles and codes
      const metadataTitleRow = [];
      const metadataCodeRow = [];
      
      // Metadata columns
      metadataTitleRow.push('Serial Number');
      metadataCodeRow.push('serial_no');
      metadataTitleRow.push('Response ID');
      metadataCodeRow.push('Response ID'); // Added code
      metadataTitleRow.push('Interview Mode');
      metadataCodeRow.push('MODE'); // Added code
      metadataTitleRow.push('Interviewer Name');
      metadataCodeRow.push('int_name');
      metadataTitleRow.push('Interviewer ID');
      metadataCodeRow.push('int_id');
      metadataTitleRow.push('Interviewer Email');
      metadataCodeRow.push('Email_Id'); // Added code
      metadataTitleRow.push('Supervisor Name');
      metadataCodeRow.push('sup_name');
      metadataTitleRow.push('Supervisor ID');
      metadataCodeRow.push('sup_id');
      metadataTitleRow.push('Response Date'); // Date only (IST)
      metadataCodeRow.push('survey_date');
      metadataTitleRow.push('Response Date Time'); // Date and time (IST)
      metadataCodeRow.push('survey_datetime');
      metadataTitleRow.push('Status');
      metadataCodeRow.push('Status');
      metadataTitleRow.push('Assembly Constituency code');
      metadataCodeRow.push('ac_code');
      metadataTitleRow.push('Assembly Constituency (AC)');
      metadataCodeRow.push('ac_name');
      metadataTitleRow.push('Parliamentary Constituency Code');
      metadataCodeRow.push('pc_code');
      metadataTitleRow.push('Parliamentary Constituency (PC)');
      metadataCodeRow.push('pc_name');
      metadataTitleRow.push('District Code');
      metadataCodeRow.push('district_code');
      metadataTitleRow.push('District');
      metadataCodeRow.push('district_code');
      metadataTitleRow.push('Region Code');
      metadataCodeRow.push('region_code');
      metadataTitleRow.push('Region Name');
      metadataCodeRow.push('region_name');
      metadataTitleRow.push('Polling Station Code');
      metadataCodeRow.push('rt_polling_station_no');
      metadataTitleRow.push('Polling Station Name');
      metadataCodeRow.push('rt_polling_station_name');
      metadataTitleRow.push('GPS Coordinates');
      metadataCodeRow.push('rt_gps_coordinates');
      metadataTitleRow.push('Call ID');
      metadataCodeRow.push('');

      // Build question headers with multi-select handling
      const questionTitleRow = [];
      const questionCodeRow = [];
      const questionMultiSelectMap = new Map();
      const questionOthersMap = new Map();
      
      regularQuestions.forEach((question, index) => {
        const questionText = question.text || question.questionText || `Question ${index + 1}`;
        const mainQuestionText = getMainText(questionText);
        const questionNumber = index + 1;
        const questionCode = getQuestionCodeFromTemplate(question, questionNumber);
        
        questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText}`);
        questionCodeRow.push(questionCode);
        
        const isMultiSelect = (question.type === 'multiple_choice' || question.type === 'multi_select') 
          && question.settings?.allowMultiple === true 
          && question.options 
          && question.options.length > 0;
        
        const hasOthersOption = question.options && question.options.some(opt => {
          const optText = typeof opt === 'object' ? (opt.text || opt.label || opt.value) : opt;
          const optTextStr = String(optText || '').toLowerCase().trim();
          return isOthersOption(optTextStr) || 
                 (optTextStr.includes('other') && (optTextStr.includes('specify') || optTextStr.includes('please')));
        });
        
        const hasIndependentOption = question.options && question.options.some(opt => {
          const optText = typeof opt === 'object' ? opt.text : opt;
          const optLower = String(optText).toLowerCase();
          return optLower.includes('independent') && !optLower.includes('other');
        });
        
        questionOthersMap.set(index, hasOthersOption);
        
        if (isMultiSelect) {
          const regularOptions = [];
          let othersOption = null;
          let othersOptionIndex = -1;
          
          question.options.forEach((option, optIndex) => {
            const optText = typeof option === 'object' ? option.text : option;
            const optTextStr = String(optText || '').trim();
            if (isOthersOption(optTextStr) || optTextStr.toLowerCase().includes('other') && (optTextStr.toLowerCase().includes('specify') || optTextStr.toLowerCase().includes('please'))) {
              othersOption = option;
              othersOptionIndex = optIndex;
            } else {
              regularOptions.push(option);
            }
          });
          
          questionMultiSelectMap.set(index, {
            isMultiSelect: true,
            options: regularOptions,
            othersOption: othersOption,
            othersOptionIndex: othersOptionIndex,
            questionText: mainQuestionText,
            questionNumber,
            questionCode
          });
          
          let regularOptionIndex = 0;
          regularOptions.forEach((option) => {
            const optText = typeof option === 'object' ? option.text : option;
            const optMainText = getMainText(optText);
            // Generate option code: Q{questionNumber}_{optionIndex+1}
            // Format: Q1_2, Q1_3, etc. (matching responses page format)
            const optionNum = regularOptionIndex + 1; // 1-based index
            const optCode = `Q${questionNumber}_${optionNum}`;
            regularOptionIndex++;
            
            questionTitleRow.push(`Q${questionNumber}. ${mainQuestionText} - ${optMainText}`);
            questionCodeRow.push(optCode);
          });
          
          if (hasOthersOption) {
            // Add _oth_choice column before _oth column for multi-select questions
            questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others Choice`);
            const othersChoiceCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
              ? `${questionCode}_oth_choice`
              : `${questionCode}_oth_choice`;
            questionCodeRow.push(othersChoiceCode);
            
            // Add _oth column (Others text)
            questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
            const othersCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
              ? `${questionCode}_oth`
              : `${questionCode}_oth`;
            questionCodeRow.push(othersCode);
          }
        } else {
          if (hasOthersOption) {
            // Add _oth column for Others text
            questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
            const othersCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
              ? `${questionCode}_oth`
              : `${questionCode}_oth`;
            questionCodeRow.push(othersCode);
          }
          
          if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
            questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Independent (Please specify)`);
            const indCode = `${questionCode}_ind`;
            questionCodeRow.push(indCode);
          }
        }
      });
      
      // Combine metadata and question headers
      const allTitleRow = [...metadataTitleRow, ...questionTitleRow];
      const allCodeRow = [...metadataCodeRow, ...questionCodeRow];
      
      // Add Status, QC, and Rejection columns at the end
      allTitleRow.push('Status (0= terminated, 10=valid, 20=rejected, 40=under qc)');
      allCodeRow.push('status_code');
      allTitleRow.push('Qc Completion date');
      allCodeRow.push('qc_completion_date');
      allTitleRow.push('Assigned to QC ( 1 can mean those whih are assigned to audio qc and 2 can mean those which are not yet assigned)');
      allCodeRow.push('assigned_to_qc');
      allTitleRow.push('Reason for rejection (1= short duration, 2= gps rejection, 3= duplicate phone numbers, 4= audio status, 5= gender mismatch, 6=2021 AE, 7=2024 GE, 8= Pref, 9=Interviewer performance)');
      allCodeRow.push('rejection_reason');

      // Helper function to extract AC and polling station from responses
      const getACAndPollingStationFromResponses = (responses) => {
        if (!responses || !Array.isArray(responses)) {
          return { ac: null, pollingStation: null, groupName: null };
        }
        
        let ac = null;
        let pollingStation = null;
        let groupName = null;
        
        responses.forEach((responseItem) => {
          if (responseItem.questionId === 'ac-selection') {
            ac = responseItem.response || null;
          }
          
          if (responseItem.questionText?.toLowerCase().includes('select polling station') ||
              responseItem.questionType === 'polling_station') {
            const stationResponse = responseItem.response;
            if (stationResponse) {
              if (typeof stationResponse === 'string' && stationResponse.includes(' - ')) {
                const parts = stationResponse.split(' - ');
                if (parts.length >= 3 && parts[0].toLowerCase().startsWith('group')) {
                  groupName = parts[0] || null;
                  pollingStation = parts.slice(1).join(' - ');
                } else if (parts.length === 2 && parts[0].toLowerCase().startsWith('group')) {
                  groupName = parts[0] || null;
                  pollingStation = parts[1] || stationResponse;
                } else {
                  pollingStation = stationResponse;
                }
              } else {
                pollingStation = stationResponse;
              }
            }
          }
          
          if (responseItem.questionId === 'polling-station-group' ||
              responseItem.questionText?.toLowerCase().includes('select group')) {
            groupName = responseItem.response || null;
          }
        });
        
        return { ac, pollingStation, groupName };
      };

      // Helper function to check if a value matches an option
      const optionMatches = (option, value) => {
        if (!option || value === null || value === undefined) return false;
        const optValue = typeof option === 'object' ? (option.value || option.text) : option;
        
        if (optValue === value || String(optValue) === String(value)) {
          return true;
        }
        
        const optMainText = getMainText(String(optValue));
        const valueMainText = getMainText(String(value));
        
        if (optMainText && valueMainText && optMainText === valueMainText) {
          return true;
        }
        
        if (typeof option === 'object' && option.code !== null && option.code !== undefined) {
          const optCode = String(option.code);
          const valueStr = String(value);
          if (optCode === valueStr || optCode === valueMainText) {
            return true;
          }
        }
        
        return false;
      };

      // Pre-fetch all polling station data for unique AC codes
      const uniqueACCodes = new Set();
      sortedResponses.forEach(response => {
        const acFromResponse = getACAndPollingStationFromResponses(response.responses).ac;
        const displayAC = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || 'N/A';
        if (displayAC !== 'N/A') {
          const acCode = getACCodeFromAC(displayAC);
          if (acCode !== 'N/A') {
            uniqueACCodes.add(acCode);
          }
        }
      });
      
      // Fetch all polling station data in parallel
      const pollingDataPromises = Array.from(uniqueACCodes).map(acCode => 
        getPollingStationData(acCode).then(data => ({ acCode, data }))
      );
      const pollingDataResults = await Promise.all(pollingDataPromises);
      const pollingDataMap = new Map();
      pollingDataResults.forEach(({ acCode, data }) => {
        pollingDataMap.set(acCode, data);
      });

      // Pre-fetch supervisor names by memberId (extract unique supervisor IDs from responses)
      const uniqueSupervisorIDs = new Set();
      sortedResponses.forEach(response => {
        if (response.responses && Array.isArray(response.responses)) {
          const supervisorIdResponse = response.responses.find(r => r.questionId === 'supervisor-id');
          if (supervisorIdResponse && supervisorIdResponse.response !== null && supervisorIdResponse.response !== undefined && supervisorIdResponse.response !== '') {
            const supervisorID = String(supervisorIdResponse.response).trim();
            if (supervisorID && supervisorID !== '') {
              uniqueSupervisorIDs.add(supervisorID);
            }
          }
        }
      });
      
      // Fetch supervisor names by memberId in parallel (using searchInterviewer API)
      // Note: This API searches for users by memberId, which should work for supervisors too
      const supervisorDataMap = new Map();
      if (uniqueSupervisorIDs.size > 0) {
        try {
          const supervisorPromises = Array.from(uniqueSupervisorIDs).map(async (supervisorID) => {
            try {
              // Use the searchInterviewer API with includeSupervisors flag to find supervisor by memberId
              // Supervisors are typically project managers, so we need to search for project_manager userType too
              const searchResponse = await authAPI.searchInterviewerByMemberId(supervisorID, surveyId, true);
              if (searchResponse.success && searchResponse.data) {
                const supervisor = Array.isArray(searchResponse.data) ? searchResponse.data[0] : searchResponse.data;
                if (supervisor && (supervisor.firstName || supervisor.lastName)) {
                  const supervisorName = `${supervisor.firstName || ''} ${supervisor.lastName || ''}`.trim();
                  return { memberId: supervisorID, name: supervisorName };
                }
              }
            } catch (error) {
              // Silently fail - supervisor might not exist or API might not find them
              console.warn(`Could not fetch supervisor ${supervisorID}:`, error.message);
            }
            return { memberId: supervisorID, name: '' };
          });
          
          const supervisorResults = await Promise.all(supervisorPromises);
          supervisorResults.forEach(supervisor => {
            if (supervisor.memberId) {
              supervisorDataMap.set(supervisor.memberId, supervisor.name);
            }
          });
        } catch (error) {
          console.error('Error fetching supervisor data:', error);
        }
      }

      // Create CSV data rows
      const csvData = sortedResponses.map((response, rowIndex) => {
        const { ac: acFromResponse, pollingStation: pollingStationFromResponse } = getACAndPollingStationFromResponses(response.responses);
        
        const cleanValue = (value) => {
          if (value === 'N/A' || value === null || value === undefined) return '';
          return value;
        };
        
        const displayACRaw = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || '';
        const displayAC = displayACRaw || '';
        
        let displayPC = response.selectedPollingStation?.pcName || '';
        if (!displayPC && displayAC) {
          const pcFromAC = getLokSabhaFromAC(displayAC);
          displayPC = cleanValue(pcFromAC) || '';
        }
        
        let displayDistrict = response.selectedPollingStation?.district || '';
        if (!displayDistrict && displayAC) {
          const districtFromAC = getDistrictFromAC(displayAC);
          displayDistrict = cleanValue(districtFromAC) || '';
        }
        
        const acCodeRaw = getACCodeFromAC(displayAC);
        const acCode = cleanValue(acCodeRaw) || '';
        
        const pollingStationValue = pollingStationFromResponse || response.selectedPollingStation?.stationName;
        
        let pcCode = '';
        let districtCode = '';
        let regionCode = '';
        let regionName = '';
        
        // Use JSON mapping for region_code, region_name, and district_code based on AC code
        if (acCode && acCode !== '') {
          // Look up in the JSON mapping
          const acMapping = acRegionDistrictMapping[acCode];
          if (acMapping) {
            districtCode = cleanValue(acMapping.district_code) || '';
            regionCode = cleanValue(acMapping.region_code) || '';
            regionName = cleanValue(acMapping.region_name) || '';
          }
          
          // Still use pollingDataMap for pcCode (if available)
          const pollingData = pollingDataMap.get(acCode);
          if (pollingData && pollingData.pcCode) {
            pcCode = cleanValue(pollingData.pcCode) || '';
          }
        }
        
        const { stationCode: stationCodeRaw, stationName: stationNameRaw } = extractPollingStationCodeAndName(pollingStationValue);
        const stationCode = cleanValue(stationCodeRaw) || '';
        const stationName = cleanValue(stationNameRaw) || '';
        
        // Format date in IST (Indian Standard Time, UTC+5:30)
        const responseDateUTC = new Date(response.createdAt || response.endTime || response.createdAt);
        // Convert UTC to IST: add 5 hours and 30 minutes
        const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
        const responseDateIST = new Date(responseDateUTC.getTime() + istOffset);
        
        // Format date only (YYYY-MM-DD) in IST
        const istYear = responseDateIST.getUTCFullYear();
        const istMonth = String(responseDateIST.getUTCMonth() + 1).padStart(2, '0');
        const istDay = String(responseDateIST.getUTCDate()).padStart(2, '0');
        const formattedDateOnly = `${istYear}-${istMonth}-${istDay}`;
        
        // Format date and time (YYYY-MM-DD HH:MM:SS) in IST
        const istHours = String(responseDateIST.getUTCHours()).padStart(2, '0');
        const istMinutes = String(responseDateIST.getUTCMinutes()).padStart(2, '0');
        const istSeconds = String(responseDateIST.getUTCSeconds()).padStart(2, '0');
        const formattedDateTime = `${formattedDateOnly} ${istHours}:${istMinutes}:${istSeconds}`;
        
        // Extract supervisor ID from responses array (for survey 68fd1915d41841da463f0d46)
        let supervisorID = '';
        if (response.responses && Array.isArray(response.responses)) {
          const supervisorIdResponse = response.responses.find(r => r.questionId === 'supervisor-id');
          if (supervisorIdResponse && supervisorIdResponse.response !== null && supervisorIdResponse.response !== undefined && supervisorIdResponse.response !== '') {
            supervisorID = String(supervisorIdResponse.response).trim();
          }
        }
        
        // Get supervisor name from pre-fetched data
        const supervisorName = supervisorID && supervisorDataMap.has(supervisorID) 
          ? supervisorDataMap.get(supervisorID) 
          : '';
        
        // Get interviewer data from interviewerDetails (backend aggregation result)
        // Backend returns interviewerDetails in aggregation, fallback to interviewer for compatibility
        const interviewerDetails = response.interviewerDetails || response.interviewer || {};
        const interviewerName = interviewerDetails.firstName || interviewerDetails.lastName
          ? `${interviewerDetails.firstName || ''} ${interviewerDetails.lastName || ''}`.trim()
          : '';
        const interviewerID = interviewerDetails.memberId || interviewerDetails.memberID || response.interviewer?.memberId || response.interviewer?.memberID || '';
        const interviewerEmail = interviewerDetails.email || response.interviewer?.email || '';
        
        // Build metadata row
        const metadata = [
          rowIndex + 1,
          cleanValue(response.responseId || response._id?.slice(-8)),
          cleanValue(response.interviewMode?.toUpperCase()),
          cleanValue(interviewerName || null),
          cleanValue(interviewerID),
          cleanValue(interviewerEmail),
          cleanValue(supervisorName), // Supervisor Name
          cleanValue(supervisorID), // Supervisor ID
          formattedDateOnly, // survey_date (date only, IST)
          formattedDateTime, // survey_datetime (date+time, IST)
          cleanValue(response.status),
          cleanValue(acCode),
          cleanValue(displayAC),
          cleanValue(pcCode),
          cleanValue(displayPC),
          cleanValue(districtCode),
          cleanValue(displayDistrict),
          cleanValue(regionCode),
          cleanValue(regionName),
          cleanValue(stationCode),
          cleanValue(stationName),
          // For CATI responses, leave GPS coordinates empty (no GPS available)
          response.interviewMode?.toUpperCase() === 'CATI' ? '' : (response.location ? `(${response.location.latitude?.toFixed(4)}, ${response.location.longitude?.toFixed(4)})` : ''),
          response.call_id || ''
        ];

        // Extract answers for each question
        const answers = [];
        
        regularQuestions.forEach((surveyQuestion, questionIndex) => {
          let matchingAnswer = null;
          
          if (surveyQuestion.id) {
            matchingAnswer = response.responses?.find(r => 
              r.questionId === surveyQuestion.id
            );
          }
          
          if (!matchingAnswer && surveyQuestion.text) {
            matchingAnswer = response.responses?.find(r => {
              const rText = getMainText(r.questionText || '');
              const sText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
              return rText === sText || r.questionText === surveyQuestion.text || r.questionText === surveyQuestion.questionText;
            });
          }
          
          const multiSelectInfo = questionMultiSelectMap.get(questionIndex);
          const hasOthersOption = questionOthersMap.get(questionIndex);
          // Get questionCode from multiSelectInfo if available, otherwise calculate it
          const questionCode = multiSelectInfo?.questionCode || getQuestionCodeFromTemplate(surveyQuestion, questionIndex + 1);
          
          // Check if this is Q13 (three most pressing issues) for filtering Professional Degree
          const questionText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '').toLowerCase();
          const isQ13 = surveyIdStr === '68fd1915d41841da463f0d46' && 
                        questionText.includes('three most pressing issues') && 
                        questionText.includes('west bengal');
          
          if (multiSelectInfo && multiSelectInfo.isMultiSelect) {
            // Multi-select question handling
            let selectedValues = [];
            let othersText = '';
            
            if (matchingAnswer && !matchingAnswer.isSkipped && matchingAnswer.response) {
              const responseValue = matchingAnswer.response;
              
              if (Array.isArray(responseValue)) {
                selectedValues = responseValue;
              } else if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
                selectedValues = [responseValue];
              }
            }
            
            // For Q13 (three most pressing issues) in survey 68fd1915d41841da463f0d46, filter out "Professional Degree" or "Professional_degree"
            if (isQ13) {
              selectedValues = selectedValues.filter(val => {
                const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                const valLower = valStr.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                // Filter out "professional degree" in any form (must contain both "professional" AND "degree")
                return !(valLower.includes('professional') && valLower.includes('degree'));
              });
            }
            
            let isOthersSelected = false;
            selectedValues.forEach(val => {
              const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
              const isOthers = surveyQuestion.options.some(opt => {
                const optText = typeof opt === 'object' ? opt.text : opt;
                return isOthersOption(optText) && optionMatches(opt, val);
              }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
              
              if (isOthers) {
                isOthersSelected = true;
                if (valStr.startsWith('Others: ')) {
                  othersText = valStr.substring(8).trim();
                } else {
                  const othersTextValue = extractOthersText(val);
                  if (othersTextValue) {
                    othersText = othersTextValue;
                  }
                }
              }
            });
            
            let mainResponse = '';
            if (selectedValues.length > 0) {
              if (downloadMode === 'codes') {
                mainResponse = selectedValues.map(val => {
                  const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                  const isOthers = surveyQuestion.options.some(opt => {
                    const optText = typeof opt === 'object' ? opt.text : opt;
                    return isOthersOption(optText) && optionMatches(opt, val);
                  }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
                  
                  if (isOthers) {
                    return '44';
                  }
                  
                  // For Q13, skip "Professional_degree" or "Professional Degree" values entirely
                  if (isQ13) {
                    const valStrForCheck = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                    const valLowerForCheck = valStrForCheck.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                    if (valLowerForCheck.includes('professional') && valLowerForCheck.includes('degree')) {
                      // Skip this value - don't include it in the response
                      return null; // Return null to filter it out
                    }
                  }
                  
                  let option = surveyQuestion.options.find(opt => optionMatches(opt, val));
                  
                  if (!option) {
                    const valMainText = getMainText(String(val));
                    option = surveyQuestion.options.find(opt => {
                      const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                      const optMainText = getMainText(String(optValue));
                      return optMainText === valMainText && valMainText !== '';
                    });
                  }
                  
                  if (option) {
                    if (option.code !== null && option.code !== undefined && option.code !== '') {
                      return String(option.code);
                    } else if (option.value) {
                      const mainValue = getMainText(String(option.value));
                      if (!/^\d+$/.test(mainValue)) {
                        const matchingOpt = surveyQuestion.options.find(opt => {
                          const optMainText = getMainText(String(opt.value || opt.text || ''));
                          return optMainText === mainValue;
                        });
                        if (matchingOpt && matchingOpt.code) {
                          return String(matchingOpt.code);
                        } else {
                          // Special handling for thanks_future: "yes,_you_can" or "yes, you can" should be "1"
                          if (questionCode === 'thanks_future') {
                            const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                            if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                              return '1';
                            }
                          }
                          return mainValue;
                        }
                      } else {
                        return mainValue;
                      }
                    } else {
                      const mainValue = getMainText(String(val));
                      // Special handling for thanks_future: "yes,_you_can" or "yes, you can" should be "1"
                      if (questionCode === 'thanks_future') {
                        const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                        if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                          return '1';
                        }
                      }
                      return mainValue || String(val);
                    }
                  }
                  const mainValue = getMainText(String(val));
                  // Special handling for thanks_future: "yes,_you_can" or "yes, you can" should be "1"
                  if (questionCode === 'thanks_future') {
                    const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                    if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                      return '1';
                    }
                  }
                  // For Q13, skip "Professional_degree" values
                  if (isQ13) {
                    const valLower = mainValue.toLowerCase().replace(/[_\s-]/g, ' ').trim();
                    if (valLower.includes('professional') && valLower.includes('degree')) {
                      return null; // Filter out
                    }
                  }
                  return mainValue || String(val);
                }).filter(code => code !== null).join(', ');
              } else {
                const filteredValues = selectedValues.filter(val => {
                  const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                  const isOthers = surveyQuestion.options.some(opt => {
                    const optText = typeof opt === 'object' ? opt.text : opt;
                    return isOthersOption(optText) && optionMatches(opt, val);
                  }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
                  return !isOthers;
                });
                if (isOthersSelected) {
                  mainResponse = filteredValues.length > 0 
                    ? formatResponseDisplay(filteredValues, surveyQuestion) + ', Others'
                    : 'Others';
                } else {
                  mainResponse = formatResponseDisplay(selectedValues, surveyQuestion);
                }
              }
            } else if (matchingAnswer && matchingAnswer.isSkipped) {
              mainResponse = '';
            } else {
              mainResponse = '';
            }
            
            // Add main response column first (contains codes like "44" for Others or actual codes)
            answers.push(mainResponse);
            
            // Add Yes/No columns for each REGULAR option (excluding "Others")
            // IMPORTANT: These columns must match the order of headers created above (lines 1197-1206)
            // Get questionCode from multiSelectInfo for use in option matching
            const questionCodeForMatching = multiSelectInfo.questionCode || questionCode;
            multiSelectInfo.options.forEach((option, optIndex) => {
              const optText = typeof option === 'object' ? option.text : option;
              // Skip if this is "Others" option
              if (isOthersOption(optText)) {
                return;
              }
              const optValue = typeof option === 'object' ? (option.value || option.text) : option;
              const isSelected = selectedValues.some(val => {
                const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                if (valStr.startsWith('Others: ') || isOthersOption(valStr)) {
                  return false; // Don't match "Others" values
                }
                // Improved matching: try multiple methods
                if (optionMatches(option, val)) {
                  return true;
                }
                // Also try matching by main text (handles translation variations)
                const valMainText = getMainText(String(valStr));
                const optMainText = getMainText(String(optValue));
                if (valMainText && optMainText && valMainText === optMainText) {
                  return true;
                }
                // Special handling for thanks_future: match "yes,_you_can" variations
                if (questionCodeForMatching === 'thanks_future') {
                  const valLower = valMainText.toLowerCase().replace(/[,_]/g, ' ').trim();
                  const optLower = optMainText.toLowerCase().replace(/[,_]/g, ' ').trim();
                  if (valLower.includes('yes') && optLower.includes('yes') && 
                      (valLower.includes('you') || valLower.includes('can'))) {
                    return true;
                  }
                }
                return false;
              });
              
              if (downloadMode === 'codes') {
                answers.push(isSelected ? '1' : '0');
              } else {
                answers.push(isSelected ? 'Yes' : 'No');
              }
            });
            
            if (hasOthersOption) {
              // Add _oth_choice column: 1 if mainResponse contains "44" (Others code), 0 otherwise
              const mainResponseStr = String(mainResponse || '').trim();
              // Check if mainResponse contains "44" as a separate code (not part of "144" or "440")
              // Handle formats: "44", "1, 44", "44, 2", "1, 44, 3", etc.
              let containsOthersCode = false;
              if (mainResponseStr === '44') {
                containsOthersCode = true;
              } else if (mainResponseStr.includes(',')) {
                // Comma-separated values: check if "44" appears as a separate code
                const codes = mainResponseStr.split(',').map(c => c.trim());
                containsOthersCode = codes.includes('44');
              } else {
                // Single value: use regex to match exact "44" (not "144" or "440")
                containsOthersCode = /\b44\b/.test(mainResponseStr);
              }
              const othChoiceValue = containsOthersCode ? '1' : '0';
              answers.push(othChoiceValue);
              
              // Add _oth column (Others text)
              answers.push(othersText || '');
            }
          } else {
            // Single choice or other question types
            let questionResponse = '';
            let othersText = '';
            
            if (matchingAnswer) {
              if (matchingAnswer.isSkipped) {
                questionResponse = '';
              } else {
                const responseValue = matchingAnswer.response;
                const hasResponseContent = (val) => {
                  if (!val && val !== 0) return false;
                  if (Array.isArray(val)) return val.length > 0;
                  if (typeof val === 'object') return Object.keys(val).length > 0;
                  return val !== '' && val !== null && val !== undefined;
                };
                
                if (!hasResponseContent(responseValue)) {
                  questionResponse = '';
                } else {
                  const responseStr = String(responseValue);
                  const isOthersResponse = responseStr.startsWith('Others: ') || 
                    (hasOthersOption && surveyQuestion.options && surveyQuestion.options.some(opt => {
                      const optText = typeof opt === 'object' ? opt.text : opt;
                      return isOthersOption(optText) && optionMatches(opt, responseValue);
                    }));
                  
                  if (isOthersResponse) {
                    if (responseStr.startsWith('Others: ')) {
                      othersText = responseStr.substring(8).trim();
                    } else {
                      const othersTextValue = extractOthersText(responseValue);
                      if (othersTextValue) {
                        othersText = othersTextValue;
                      }
                    }
                    
                    if (downloadMode === 'codes') {
                      questionResponse = '44';
                    } else {
                      questionResponse = 'Others';
                    }
                  } else {
                    if (downloadMode === 'codes' && surveyQuestion.options) {
                      let option = surveyQuestion.options.find(opt => optionMatches(opt, responseValue));
                      
                      if (!option) {
                        const responseMainText = getMainText(String(responseValue));
                        option = surveyQuestion.options.find(opt => {
                          const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                          const optMainText = getMainText(String(optValue));
                          return optMainText === responseMainText && responseMainText !== '';
                        });
                      }
                      
                      if (option) {
                        if (option.code !== null && option.code !== undefined && option.code !== '') {
                          questionResponse = String(option.code);
                        } else if (option.value) {
                          const mainValue = getMainText(String(option.value));
                          if (!/^\d+$/.test(mainValue)) {
                            const matchingOpt = surveyQuestion.options.find(opt => {
                              const optMainText = getMainText(String(opt.value || opt.text || ''));
                              return optMainText === mainValue;
                            });
                            if (matchingOpt && matchingOpt.code) {
                              questionResponse = String(matchingOpt.code);
                            } else {
                              // Special handling for thanks_future: "yes,_you_can" or "yes, you can" should be "1"
                              if (questionCode === 'thanks_future') {
                                const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                                if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                                  questionResponse = '1';
                                } else {
                                  questionResponse = mainValue;
                                }
                              } else {
                                questionResponse = mainValue;
                              }
                            }
                          } else {
                            questionResponse = mainValue;
                          }
                        } else {
                          const mainValue = getMainText(String(responseValue));
                          // Special handling for thanks_future: "yes,_you_can" or "yes, you can" should be "1"
                          if (questionCode === 'thanks_future') {
                            const valLower = mainValue.toLowerCase().replace(/[,_]/g, ' ').trim();
                            if (valLower.includes('yes') && (valLower.includes('you') || valLower.includes('can'))) {
                              questionResponse = '1';
                            } else {
                              questionResponse = mainValue || String(responseValue);
                            }
                          } else {
                            questionResponse = mainValue || String(responseValue);
                          }
                        }
                      } else {
                        // If no option found, use the response value directly
                        const mainValue = getMainText(String(responseValue));
                        // CRITICAL: Use the response value itself if it's a valid code/number
                        // Don't use getMainText if responseValue is already a simple code
                        if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
                          const responseStr = String(responseValue);
                          // If responseValue is a simple number/code, use it directly
                          if (/^\d+$/.test(responseStr.trim())) {
                            questionResponse = responseStr.trim();
                          } else {
                            questionResponse = mainValue || responseStr;
                          }
                        } else {
                          questionResponse = mainValue || String(responseValue);
                        }
                      }
                    } else {
                      // Not in codes mode or no options - use display formatting
                      if (surveyQuestion.options) {
                        questionResponse = formatResponseDisplay(responseValue, surveyQuestion);
                      } else {
                        questionResponse = getHardcodedOptionMapping(
                          surveyQuestion.text || surveyQuestion.questionText, 
                          responseValue
                        );
                      }
                    }
                  }
                }
              }
            }
            
            // Get question number and code (must match header generation logic)
            const questionNumber = questionIndex + 1;
            const questionCode = getQuestionCodeFromTemplate(surveyQuestion, questionNumber);
            const hasIndependentOption = surveyQuestion.options && surveyQuestion.options.some(opt => {
              const optText = typeof opt === 'object' ? opt.text : opt;
              const optLower = String(optText).toLowerCase();
              return optLower.includes('independent') && !optLower.includes('other');
            });
            
            // CRITICAL: Ensure questionResponse is always set correctly
            // If questionResponse is still empty but we have a matchingAnswer, try to extract the response
            // BUT: Only do this if questionResponse wasn't set in the main logic above
            if (!questionResponse && matchingAnswer && !matchingAnswer.isSkipped && matchingAnswer.response) {
              const responseValue = matchingAnswer.response;
              const responseStr = String(responseValue);
              
              // Check if it's Others response
              const isOthersResponse = responseStr.startsWith('Others: ') || 
                (hasOthersOption && surveyQuestion.options && surveyQuestion.options.some(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return isOthersOption(optText) && optionMatches(opt, responseValue);
                }));
              
              if (isOthersResponse) {
                if (downloadMode === 'codes') {
                  questionResponse = '44';
                } else {
                  questionResponse = 'Others';
                }
                // Only extract Others text if response starts with "Others: "
                if (responseStr.startsWith('Others: ')) {
                  othersText = responseStr.substring(8).trim();
                } else {
                  // Only call extractOthersText if it's actually an Others response
                  const othersTextValue = extractOthersText(responseValue);
                  if (othersTextValue) {
                    othersText = othersTextValue;
                  }
                }
              } else if (downloadMode === 'codes' && surveyQuestion.options) {
                // Try to find matching option and get its code
                let option = surveyQuestion.options.find(opt => optionMatches(opt, responseValue));
                if (option && option.code !== null && option.code !== undefined && option.code !== '') {
                  questionResponse = String(option.code);
                } else if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
                  questionResponse = String(responseValue);
                }
              } else if (responseValue !== null && responseValue !== undefined && responseValue !== '') {
                questionResponse = String(responseValue);
              }
            }
            
            // CRITICAL: Always push main question response first (contains code like "44" for Others or actual code)
            // This goes into the main question column (e.g., q5, q6)
            // Ensure questionResponse is always a string (never undefined/null)
            const mainQuestionResponse = questionResponse !== null && questionResponse !== undefined ? String(questionResponse) : '';
            answers.push(mainQuestionResponse);
            
            if (hasOthersOption) {
              // Add _oth column (Others text) - goes into q5_oth, q6_oth, etc.
              // CRITICAL: othersText should ONLY contain the text after "Others: ", never the response code
              // If othersText somehow contains a response code (just digits), it's a bug - clear it
              // Also check if othersText equals the mainQuestionResponse (which would be wrong)
              let othersTextValue = '';
              if (othersText && othersText.trim() !== '') {
                // If othersText is just a number (response code), ignore it
                if (!othersText.match(/^\d+$/)) {
                  // If othersText equals the main response (wrong), ignore it
                  if (othersText !== mainQuestionResponse) {
                    othersTextValue = othersText;
                  }
                }
              }
              answers.push(othersTextValue);
            }
            
            if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
              let independentText = '';
              if (matchingAnswer && matchingAnswer.response) {
                const responseValue = matchingAnswer.response;
                const responseStr = String(responseValue).toLowerCase();
                // Check if this is actually an Independent response
                const isIndependentResponse = responseStr.includes('independent') || 
                    surveyQuestion.options.some(opt => {
                      const optText = typeof opt === 'object' ? opt.text : opt;
                      return String(optText).toLowerCase().includes('independent') && optionMatches(opt, responseValue);
                    });
                
                if (isIndependentResponse) {
                  const independentOpt = surveyQuestion.options.find(opt => {
                    const optText = typeof opt === 'object' ? opt.text : opt;
                    return String(optText).toLowerCase().includes('independent');
                  });
                  if (independentOpt && typeof independentOpt === 'object' && independentOpt.text) {
                    // Only extract text if response starts with "Others: " or "Independent: "
                    if (String(responseValue).startsWith('Others: ') || String(responseValue).startsWith('Independent: ')) {
                      const independentTextValue = extractOthersText(responseValue);
                      independentText = independentTextValue || '';
                    }
                  }
                }
              }
              answers.push(independentText || '');
            }
          }
        });
        
        // Add QC and status columns
        const statusCode = getStatusCode(response.status);
        const qcCompletionDate = response.verificationData?.reviewedAt 
          ? new Date(response.verificationData.reviewedAt).toLocaleDateString('en-US')
          : '';
        
        let assignedToQC = '';
        
        if (response.status === 'Approved' || response.status === 'Rejected') {
          assignedToQC = '';
        } else if (response.status === 'Pending_Approval') {
          const qcBatch = response.qcBatch;
          const isSampleResponse = response.isSampleResponse || false;
          
          if (qcBatch) {
            let batchStatus = null;
            let remainingDecision = null;
            
            if (typeof qcBatch === 'object' && qcBatch.status) {
              batchStatus = qcBatch.status;
              remainingDecision = qcBatch.remainingDecision?.decision;
            } else if (response.qcBatchStatus) {
              batchStatus = response.qcBatchStatus;
              remainingDecision = response.qcBatchRemainingDecision;
            }
            
            if (batchStatus) {
              if (batchStatus === 'queued_for_qc' ||
                  (isSampleResponse && (batchStatus === 'qc_in_progress' || batchStatus === 'completed')) ||
                  (!isSampleResponse && remainingDecision === 'queued_for_qc')) {
                assignedToQC = '1';
              } else if (batchStatus === 'collecting' ||
                         (batchStatus === 'processing' && !isSampleResponse)) {
                assignedToQC = '2';
              } else {
                assignedToQC = '2';
              }
            } else {
              assignedToQC = '2';
            }
          } else {
            assignedToQC = '2';
          }
        }
        
        const rejectionReasonCode = getRejectionReasonCode(response);
        
        return [...metadata, ...answers, statusCode, qcCompletionDate, assignedToQC, rejectionReasonCode];
      });

      // Process CSV data in chunks to avoid memory issues
      setCsvProgress({ current: 0, total: totalResponses, stage: 'Generating CSV content...' });
      
      // Generate CSV content in chunks to avoid memory issues
      const csvChunks = [];
      
      // Add header rows (title row and code row)
      // Note: For survey 68fd1915d41841da463f0d46, only code row is used (no title row)
      // surveyIdStr is already declared above (line 858), reuse it here
      if (surveyIdStr !== '68fd1915d41841da463f0d46') {
        // Add title row for other surveys
        csvChunks.push(
          allTitleRow.map(field => {
            const fieldStr = String(field || '');
            return `"${fieldStr.replace(/"/g, '""')}"`;
          }).join(',')
        );
      }
      
      // Add code row (always present)
      csvChunks.push(
        allCodeRow.map(field => {
          const fieldStr = String(field || '');
          return `"${fieldStr.replace(/"/g, '""')}"`;
        }).join(',')
      );
      
      // Add data rows in chunks
      for (let i = 0; i < csvData.length; i += CHUNK_SIZE) {
        const chunk = csvData.slice(i, i + CHUNK_SIZE);
        const chunkContent = chunk.map(row => 
          row.map(field => {
            const fieldStr = String(field || '');
            return `"${fieldStr.replace(/"/g, '""')}"`;
          }).join(',')
        ).join('\n');
        
        csvChunks.push(chunkContent);
        
        // Update progress
        const processed = Math.min(i + CHUNK_SIZE, csvData.length);
        setCsvProgress({ 
          current: processed, 
          total: totalResponses, 
          stage: `Generating CSV ${Math.round((processed / totalResponses) * 100)}%...` 
        });
        
        // Allow browser to breathe between chunks (prevents UI freeze)
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const csvContent = csvChunks.join('\n');
      
      setCsvProgress({ current: totalResponses, total: totalResponses, stage: 'Creating download file...' });
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const modeSuffix = downloadMode === 'codes' ? '_codes' : '_responses';
      const formatSuffix = isMixed ? '_mixed' : (isCAPIOnly ? '_CAPI' : (isCATIOnly ? '_CATI' : ''));
      link.download = `${survey?.surveyName || survey?.title || 'survey'}${formatSuffix}${modeSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess(`CSV downloaded successfully (${totalResponses} responses)`);
      setDownloadingCSV(false);
      setCsvProgress({ current: 0, total: 0, stage: '' });
      
      // Only update pre-generated files if filters are "All Time" and "All Status"
      // This ensures pre-generated files always contain complete data
      const isAllTime = filters.dateRange === 'all' || !filters.dateRange;
      const isAllStatus = filters.status === 'approved_rejected_pending' || !filters.status;
      const hasNoOtherFilters = !filters.interviewMode && 
                                !filters.ac && 
                                (!filters.interviewerIds || filters.interviewerIds.length === 0) &&
                                !filters.search;
      
      if (isAllTime && isAllStatus && hasNoOtherFilters) {
        // Update pre-generated files only when downloading complete dataset
        try {
          await surveyResponseAPI.triggerCSVGeneration(surveyId);
          // Refresh CSV file info
          const csvInfoResponse = await surveyResponseAPI.getCSVFileInfo(surveyId);
          if (csvInfoResponse.success) {
            setCsvFileInfo(csvInfoResponse.data);
          }
        } catch (error) {
          console.error('Error updating pre-generated CSV:', error);
          // Don't show error to user, this is background operation
        }
      }
      
    } catch (error) {
      console.error('Error downloading CSV:', error);
      console.error('Error stack:', error.stack);
      // Use optional chaining and check if variables exist before accessing
      const sortedResponsesLength = typeof sortedResponses !== 'undefined' ? (sortedResponses?.length || 0) : 0;
      const csvDataLength = typeof csvData !== 'undefined' ? (csvData?.length || 0) : 0;
      const allCodeRowLength = typeof allCodeRow !== 'undefined' ? (allCodeRow?.length || 0) : 0;
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        surveyId: surveyId,
        totalResponses: sortedResponsesLength,
        csvDataLength: csvDataLength,
        allCodeRowLength: allCodeRowLength
      });
      showError('Failed to download CSV: ' + (error.message || 'Unknown error') + '. Check browser console for details.');
      setDownloadingCSV(false);
      setCsvProgress({ current: 0, total: 0, stage: '' });
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'approved_rejected_pending',
      dateRange: 'all',
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
                        onClick={() => {
                          handleInterviewerToggle(interviewer._id);
                          setShowInterviewerDropdown(false);
                          setInterviewerSearchTerm('');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                          filters.interviewerIds.includes(interviewer._id) ? 'bg-blue-50' : ''
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
                      const interviewer = searchedInterviewers.find(i => i._id === id);
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
                              {new Date(response.createdAt).toLocaleDateString()}
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
          onClose={() => {
            setShowResponseDetails(false);
            setSelectedResponse(null);
            setFullResponseDetails(null);
          }}
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

