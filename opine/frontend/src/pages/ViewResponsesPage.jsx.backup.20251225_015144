import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ListChecks
} from 'lucide-react';
import { surveyResponseAPI, surveyAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import ResponseDetailsModal from '../components/dashboard/ResponseDetailsModal';
import { getMainText } from '../utils/translations';
import { getACByName } from '../utils/assemblyConstituencies';
import assemblyConstituenciesData from '../data/assemblyConstituencies.json';

// Enhanced Loading Screen Component for Responses Page - Modern & Data-Driven
const ResponsesLoadingScreen = () => {
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const [particles, setParticles] = useState([]);

  const loadingTexts = [
    'Fetching survey responses...',
    'Loading response data...',
    'Processing respondent information...',
    'Organizing response records...',
    'Preparing data tables...',
    'Finalizing response view...'
  ];

  const loadingStages = [
    { icon: Database, text: 'Fetching Data', color: 'text-blue-500' },
    { icon: FileText, text: 'Loading Responses', color: 'text-emerald-500' },
    { icon: Activity, text: 'Processing', color: 'text-purple-500' },
    { icon: ListChecks, text: 'Organizing', color: 'text-orange-500' }
  ];

  useEffect(() => {
    const textInterval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingTexts.length);
    }, 2500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 90) return prev + Math.random() * 2;
        return prev;
      });
    }, 350);

    const generateDataPoints = () => {
      const points = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        height: Math.random() * 70 + 15,
        delay: i * 0.08,
        duration: 1 + Math.random() * 0.5
      }));
      setDataPoints(points);
    };

    const generateParticles = () => {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2
      }));
      setParticles(newParticles);
    };

    generateDataPoints();
    generateParticles();

    const dataInterval = setInterval(generateDataPoints, 2500);
    const particleInterval = setInterval(generateParticles, 5000);

    return () => {
      clearInterval(textInterval);
      clearInterval(progressInterval);
      clearInterval(dataInterval);
      clearInterval(particleInterval);
    };
  }, []);

  const currentStageIndex = Math.min(Math.floor(progress / 25), 3);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center p-4 z-50 overflow-hidden">

      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-gradient-to-br from-[#001D48]/20 to-[#003366]/10 blur-sm"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `float ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`
            }}
          />
        ))}
      </div>

      {/* Floating Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(#001D48 1px, transparent 1px),
            linear-gradient(90deg, #001D48 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      <div className="w-full max-w-3xl mx-auto relative">
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 lg:p-12 relative overflow-hidden">

          {/* Animated Border Glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-[#001D48]/10 via-[#003366]/10 to-[#001D48]/10 opacity-50 animate-border-flow" />

          <div className="relative space-y-8">

            {/* Circular Progress */}
            <div className="flex flex-col items-center space-y-6">

              {/* Central Circular Progress */}
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="url(#gradient-responses)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                    className="transition-all duration-500 ease-out drop-shadow-lg"
                  />
                  <defs>
                    <linearGradient id="gradient-responses" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#001D48" />
                      <stop offset="50%" stopColor="#003366" />
                      <stop offset="100%" stopColor="#001D48" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#001D48]">
                      {Math.round(Math.min(progress, 95))}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Loading</div>
                  </div>
                </div>

                {/* Rotating Ring */}
                <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
                  <div className="w-36 h-36 rounded-full border-2 border-dashed border-[#001D48]/20" />
                </div>
              </div>
            </div>

            {/* Dynamic Bar Chart Visualization */}
            <div className="w-full">
              <div className="flex items-end justify-center gap-1.5 h-24 px-4">
                {dataPoints.map((point) => (
                  <div
                    key={point.id}
                    className="flex-1 max-w-[40px] rounded-t-lg bg-gradient-to-t from-[#001D48] via-[#003366] to-[#0055AA] relative overflow-hidden group transition-all duration-700 ease-out shadow-lg"
                    style={{
                      height: `${point.height}%`,
                      animation: `pulse-bar ${point.duration}s ease-in-out infinite alternate`
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/30 to-transparent animate-shimmer-up opacity-60" />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/50 rounded-full blur-sm" />
                  </div>
                ))}
              </div>
            </div>

            {/* Loading Stage Indicators */}
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {loadingStages.map((stage, index) => {
                const Icon = stage.icon;
                const isActive = index === currentStageIndex;
                const isCompleted = index < currentStageIndex;

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 transition-all duration-500 ${
                      isActive ? 'scale-110' : isCompleted ? 'opacity-50' : 'opacity-30'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      isActive
                        ? 'bg-[#001D48] text-white shadow-lg'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-gray-100 text-gray-400'
                    } transition-all duration-500`}>
                      <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                    </div>
                    <span className={`text-sm font-medium ${
                      isActive ? 'text-[#001D48]' : 'text-gray-400'
                    } transition-all duration-500`}>
                      {stage.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Main Loading Text */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-[#001D48] animate-fade-in-up">
                {loadingTexts[loadingTextIndex]}
              </h3>
              <p className="text-sm text-gray-500">
                Please wait while we load your survey responses
              </p>
            </div>

            {/* Linear Progress Bar */}
            <div className="w-full space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-[#001D48] via-[#003366] to-[#0055AA] rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${Math.min(progress, 95)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-fast" />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Loading responses...</span>
                <span>{Math.round(Math.min(progress, 95))}%</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Custom CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.7;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 1;
          }
        }

        @keyframes pulse-bar {
          0% {
            transform: scaleY(0.9);
            opacity: 0.8;
          }
          100% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }

        @keyframes shimmer-up {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(-100%);
          }
        }

        .animate-shimmer-up {
          animation: shimmer-up 2s ease-in-out infinite;
        }

        @keyframes shimmer-fast {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-shimmer-fast {
          animation: shimmer-fast 1.5s ease-in-out infinite;
        }

        @keyframes border-flow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        .animate-border-flow {
          animation: border-flow 3s ease-in-out infinite;
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};

const ViewResponsesPage = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine if we're in project manager route
  const isProjectManagerRoute = location.pathname.includes('/project-manager/');
  const backPath = isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys';
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [originalResponses, setOriginalResponses] = useState([]); // Store original unfiltered responses
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false); // Loading state for filter changes
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
    lokSabha: [],
    interviewMode: []
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'approved_rejected_pending', // 'all', 'approved_rejected_pending', 'approved_pending', 'pending', 'Approved', 'Rejected'
    dateRange: 'all', // 'today', 'week', 'month', 'all', 'custom'
    startDate: '',
    endDate: '',
    gender: '',
    ageMin: '',
    ageMax: '',
    ac: '',
    city: '',
    district: '',
    lokSabha: '',
    state: '',
    interviewMode: '',
    interviewerIds: [], // Array of interviewer IDs
    interviewerMode: 'include' // 'include' or 'exclude'
  });
  
  const [showFilters, setShowFilters] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const { showError, showSuccess } = useToast();

  // Table pagination state
  const [tablePagination, setTablePagination] = useState({
    currentPage: 1,
    pageSize: 10
  });

  // Load assembly constituencies data (imported directly, bundled in build)
  const [assemblyConstituencies, setAssemblyConstituencies] = useState(assemblyConstituenciesData);
  
  // Interviewer filter states
  const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('');
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);
  const interviewerDropdownRef = useRef(null);

  // AC filter states
  const [acSearchTerm, setAcSearchTerm] = useState('');
  const [showACDropdown, setShowACDropdown] = useState(false);
  const acDropdownRef = useRef(null);
  
  useEffect(() => {
    // Data is already loaded via import, no need to fetch
    setAssemblyConstituencies(assemblyConstituenciesData);
  }, []);

  // Fetch survey details and responses
  const fetchSurveyAndResponses = async () => {
    try {
      setLoading(true);
      
      // First, fetch survey details
      const surveyResponse = await surveyAPI.getSurvey(surveyId);
      if (surveyResponse.success) {
        setSurvey(surveyResponse.data);
      }
      
      // Then fetch responses - fetch all statuses (Approved, Rejected, Pending_Approval) for client-side filtering
      const params = {
        page: 1,
        limit: 10000, // Get all responses for client-side filtering (increased from 1000 to handle large datasets)
        status: 'approved_rejected_pending' // Fetch all statuses (Approved, Rejected, Pending_Approval) for comprehensive filtering
      };
      
      const response = await surveyResponseAPI.getSurveyResponses(surveyId, params);
      
      if (response.success) {
        setOriginalResponses(response.data.responses); // Store original unfiltered data
        setResponses(response.data.responses); // Set current responses
        setPagination(response.data.pagination);
        setFilterOptions(response.data.filterOptions);
      }
    } catch (error) {
      console.error('Error fetching survey and responses:', error);
      showError('Failed to load survey responses', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (surveyId) {
      fetchSurveyAndResponses();
    }
  }, [surveyId]);

  // Add CSS to ensure full width and DatePicker styling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .view-responses-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .view-responses-page * {
        max-width: none !important;
      }
      
      /* React DatePicker Custom Styling */
      .react-datepicker-wrapper {
        width: 100%;
      }
      
      .react-datepicker-popper {
        z-index: 9999 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);


  // Get all ACs for the survey's target state
  const getAllACsForState = () => {
    let targetState = survey?.acAssignmentState;
    
    // If no state found, try to infer from responses
    if (!targetState && responses.length > 0) {
      const responseWithState = responses.find(r => r.state);
      if (responseWithState?.state) {
        targetState = responseWithState.state;
      }
    }
    
    // If still no state found, try to infer from AC names in responses
    if (!targetState && responses.length > 0) {
      const responseACs = responses.map(r => {
        return r.assemblyConstituency || r.assemblyConstituencyName || r.ac || r.acName || r.constituency;
      }).filter(Boolean);
      
      // Check each state to see if any of the response ACs match
      for (const [stateName, stateData] of Object.entries(assemblyConstituencies.states || {})) {
        const stateACNames = stateData.assemblyConstituencies?.map(ac => ac.acName) || [];
        const matchingACs = responseACs.filter(ac => stateACNames.includes(ac));
        
        if (matchingACs.length > 0) {
          targetState = stateName;
          break;
        }
      }
    }
    
    if (!targetState || !assemblyConstituencies.states) {
      return [];
    }
    
    const stateACs = assemblyConstituencies.states[targetState]?.assemblyConstituencies || [];
    return stateACs.map(ac => ({
      name: ac.acName,
      numericCode: ac.numericCode
    }));
  };

  // Helper function to extract numeric AC code from full AC code (same as reports page)
  const getNumericACCode = (acCode) => {
    if (!acCode || typeof acCode !== 'string') return '';
    
    // Remove state prefix (alphabets at the start) and extract numeric part
    const numericPart = acCode.replace(/^[A-Z]+/, '');
    
    // Remove leading zeros and return as string
    // If all zeros, return "0", otherwise return the number without leading zeros
    const numericValue = parseInt(numericPart, 10);
    return isNaN(numericValue) ? '' : numericValue.toString();
  };

  // Get all interviewer objects from responses
  const allInterviewerObjects = useMemo(() => {
    if (!responses || responses.length === 0) return [];

    const interviewerMap = new Map();

    responses.forEach(response => {
      if (response.interviewer && 
          (response.status === 'Approved' || 
           response.status === 'Rejected' || 
           response.status === 'Pending_Approval' ||
           response.status === 'abandoned')) {
        const interviewerName = `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim();
        
        if (!interviewerMap.has(response.interviewer._id)) {
          interviewerMap.set(response.interviewer._id, {
            _id: response.interviewer._id,
            name: interviewerName,
            firstName: response.interviewer.firstName,
            lastName: response.interviewer.lastName,
            email: response.interviewer.email || '',
            phone: response.interviewer.phone || '',
            memberID: response.interviewer.memberId || response.interviewer.memberID || ''
          });
        }
      }
    });
    
    return Array.from(interviewerMap.values());
  }, [responses]);


  // Filter interviewers based on search term
  const filteredInterviewers = useMemo(() => {
    if (!allInterviewerObjects || allInterviewerObjects.length === 0) return [];
    
    if (!interviewerSearchTerm.trim()) {
      return allInterviewerObjects;
    }

    const searchLower = interviewerSearchTerm.toLowerCase();
    return allInterviewerObjects.filter(interviewer => {
      const name = `${interviewer.firstName || ''} ${interviewer.lastName || ''}`.toLowerCase();
      const nameMatch = name.includes(searchLower);
      const emailMatch = interviewer.email?.toLowerCase().includes(searchLower);
      const phoneMatch = interviewer.phone?.toLowerCase().includes(searchLower);
      const memberIDMatch = interviewer.memberID?.toLowerCase().includes(searchLower);
      
      return nameMatch || emailMatch || phoneMatch || memberIDMatch;
    });
  }, [allInterviewerObjects, interviewerSearchTerm]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle interviewer toggle
  const handleInterviewerToggle = (interviewerId) => {
    setFilters(prev => {
      const currentIds = prev.interviewerIds || [];
      // Convert both to strings for consistent comparison
      const idStr = interviewerId?.toString() || interviewerId;
      const currentIdsStr = currentIds.map(id => id?.toString() || id);
      const isSelected = currentIdsStr.includes(idStr);
      
      return {
        ...prev,
        interviewerIds: isSelected
          ? currentIds.filter(id => (id?.toString() || id) !== idStr)
          : [...currentIds, idStr] // Store as string
      };
    });
  };

  // Handle interviewer mode toggle
  const handleInterviewerModeToggle = (mode) => {
    setFilters(prev => ({
      ...prev,
      interviewerMode: mode
    }));
  };

  // Clear interviewer filters
  const clearInterviewerFilters = () => {
    setFilters(prev => ({
      ...prev,
      interviewerIds: []
    }));
    setInterviewerSearchTerm('');
  };

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

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
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
      state: '',
      interviewMode: '',
      interviewerIds: [],
      interviewerMode: 'include'
    });
    setInterviewerSearchTerm('');
    setAcSearchTerm('');
  };

  // Helper function to get district from AC using assemblyConstituencies.json
  const getDistrictFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituencies.states)) {
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
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituencies.states)) {
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
  // e.g., "WB001" -> "1", "TN023" -> "23"
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
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    const acNameStr = String(acName);
    for (const state of Object.values(assemblyConstituencies.states)) {
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
  const pollingStationDataCache = new Map();

  // Helper function to get PC code, district code, and region from polling_stations.json via API
  // This will be called with the numeric AC code
  const getPollingStationData = async (acCode) => {
    if (!acCode || acCode === 'N/A') return { pcCode: 'N/A', districtCode: 'N/A', regionCode: 'N/A', regionName: 'N/A' };
    
    // Check cache first
    if (pollingStationDataCache.has(acCode)) {
      return pollingStationDataCache.get(acCode);
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
          pollingStationDataCache.set(acCode, data);
          return data;
        }
      }
    } catch (error) {
      console.error('Error fetching polling station data:', error);
    }
    
    const defaultData = { pcCode: 'N/A', districtCode: 'N/A', regionCode: 'N/A', regionName: 'N/A' };
    pollingStationDataCache.set(acCode, defaultData);
    return defaultData;
  };

  // Helper function to get PC code from AC code (using polling_stations.json structure)
  const getPCCodeFromACCode = async (acCode, responseData = null) => {
    // First try to get from response data if available
    if (responseData?.selectedPollingStation?.pcNo) {
      return String(responseData.selectedPollingStation.pcNo);
    }
    
    // Fetch from API
    const data = await getPollingStationData(acCode);
    return data.pcCode;
  };

  // Helper function to get District code from AC code (using polling_stations.json)
  const getDistrictCodeFromACCode = async (acCode, responseData = null) => {
    // First try to get from response data if available
    if (responseData?.selectedPollingStation?.districtCode) {
      return String(responseData.selectedPollingStation.districtCode);
    }
    
    // Fetch from API
    const data = await getPollingStationData(acCode);
    return data.districtCode;
  };

  // Helper function to get Region code and name from AC code
  const getRegionFromACCode = async (acCode, responseData = null) => {
    // First try to get from response data if available
    if (responseData?.selectedPollingStation?.regionCode) {
      return {
        regionCode: String(responseData.selectedPollingStation.regionCode),
        regionName: responseData.selectedPollingStation.regionName || 'N/A'
      };
    }
    
    // Fetch from API
    const data = await getPollingStationData(acCode);
    return { regionCode: data.regionCode, regionName: data.regionName };
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
  // 1= short duration, 2= gps rejection, 3= duplicate phone numbers, 4= audio status, 
  // 5= gender mismatch, 6=2021 AE, 7=2024 GE, 8= Pref, 9=Interviewer performance
  const getRejectionReasonCode = (response) => {
    if (!response || response.status !== 'Rejected') {
      return '';
    }
    
    const verificationData = response.verificationData || {};
    const autoRejectionReasons = verificationData.autoRejectionReasons || [];
    const criteria = verificationData.criteria || verificationData.verificationCriteria || {};
    const feedback = verificationData.feedback || '';
    const feedbackLower = feedback.toLowerCase();
    
    // Priority 1: Check auto-rejection reasons (most reliable)
    if (autoRejectionReasons.length > 0) {
      // 1 = short duration
      if (autoRejectionReasons.includes('duration')) {
        return '1';
      }
      // 2 = gps rejection
      if (autoRejectionReasons.includes('gps_distance')) {
        return '2';
      }
      // 3 = duplicate phone numbers
      if (autoRejectionReasons.includes('duplicate_phone')) {
        return '3';
      }
    }
    
    // Priority 2: Check manual rejection criteria (from QC verification)
    // These are stored in verificationData.criteria or verificationData.verificationCriteria
    
    // 4 = audio status (if audioStatus is not '1', '4', or '7')
    // Audio status rejection: if criteria has audioStatus and it's not valid
    if (criteria.audioStatus !== null && criteria.audioStatus !== undefined && criteria.audioStatus !== '') {
      const audioStatus = String(criteria.audioStatus);
      if (!['1', '4', '7'].includes(audioStatus)) {
        return '4';
      }
    }
    
    // 5 = gender mismatch (if genderMatching is not '1')
    // Gender rejection: if criteria has genderMatching and it's not '1' (matched)
    if (criteria.genderMatching !== null && criteria.genderMatching !== undefined && criteria.genderMatching !== '') {
      const genderMatching = String(criteria.genderMatching);
      if (genderMatching !== '1') {
        return '5';
      }
    }
    
    // 6 = 2021 AE (if previousElectionsMatching is not '1' or '3')
    // This checks the 2021 Assembly Election question mismatch
    if (criteria.previousElectionsMatching !== null && 
        criteria.previousElectionsMatching !== undefined && 
        criteria.previousElectionsMatching !== '') {
      const previousElectionsMatching = String(criteria.previousElectionsMatching);
      if (!['1', '3'].includes(previousElectionsMatching)) {
        return '6';
      }
    }
    
    // 7 = 2024 GE (if previousLoksabhaElectionsMatching is not '1' or '3')
    // This checks the 2024 General Election question mismatch
    if (criteria.previousLoksabhaElectionsMatching !== null && 
        criteria.previousLoksabhaElectionsMatching !== undefined && 
        criteria.previousLoksabhaElectionsMatching !== '') {
      const previousLoksabhaElectionsMatching = String(criteria.previousLoksabhaElectionsMatching);
      if (!['1', '3'].includes(previousLoksabhaElectionsMatching)) {
        return '7';
      }
    }
    
    // 8 = Pref (if upcomingElectionsMatching is not '1' or '3')
    // This checks the 2025 Preference question mismatch
    if (criteria.upcomingElectionsMatching !== null && 
        criteria.upcomingElectionsMatching !== undefined && 
        criteria.upcomingElectionsMatching !== '') {
      const upcomingElectionsMatching = String(criteria.upcomingElectionsMatching);
      if (!['1', '3'].includes(upcomingElectionsMatching)) {
        return '8';
      }
    }
    
    // Priority 3: Check feedback text for auto-rejection keywords (fallback)
    if (feedback) {
      // 1 = short duration
      if (feedbackLower.includes('interview too short') || 
          feedbackLower.includes('too short') ||
          feedbackLower.includes('short duration') ||
          (feedbackLower.includes('short') && feedbackLower.includes('duration'))) {
        return '1';
      }
      // 2 = gps rejection
      if (feedbackLower.includes('gps location too far') ||
          feedbackLower.includes('gps') && feedbackLower.includes('far') ||
          feedbackLower.includes('location too far') ||
          feedbackLower.includes('gps distance')) {
        return '2';
      }
      // 3 = duplicate phone numbers
      if (feedbackLower.includes('duplicate phone') ||
          feedbackLower.includes('duplicate phone number')) {
        return '3';
      }
      // 4 = audio status (check for audio-related rejection)
      if (feedbackLower.includes('audio') && 
          (feedbackLower.includes('not') || feedbackLower.includes('cannot') || feedbackLower.includes('fail'))) {
        return '4';
      }
      // 5 = gender mismatch
      if (feedbackLower.includes('gender') && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match') || feedbackLower.includes('not matched'))) {
        return '5';
      }
      // 6 = 2021 AE
      if ((feedbackLower.includes('2021') || feedbackLower.includes('assembly')) && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match') || feedbackLower.includes('not matched'))) {
        return '6';
      }
      // 7 = 2024 GE
      if ((feedbackLower.includes('2024') || feedbackLower.includes('lok sabha') || feedbackLower.includes('general election')) && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match') || feedbackLower.includes('not matched'))) {
        return '7';
      }
      // 8 = Pref (2025 Preference)
      if ((feedbackLower.includes('2025') || feedbackLower.includes('preference') || feedbackLower.includes('pref')) && 
          (feedbackLower.includes('mismatch') || feedbackLower.includes('not match') || feedbackLower.includes('not matched'))) {
        return '8';
      }
      // 9 = Interviewer performance (check for performance-related keywords)
      if (feedbackLower.includes('interviewer performance') || 
          feedbackLower.includes('performance') ||
          feedbackLower.includes('quality') ||
          feedbackLower.includes('incomplete') ||
          feedbackLower.includes('poor quality') ||
          feedbackLower.includes('poor performance')) {
        return '9';
      }
    }
    
    // Default: if rejected but no specific reason found, return empty
    return '';
  };

  // Helper function to check if an option is "Others" (same as InterviewInterface)
  const isOthersOption = (optText) => {
    if (!optText) return false;
    const normalized = String(optText).toLowerCase().trim();
    // Check for various "Others" patterns
    return normalized === 'other' || 
           normalized === 'others' || 
           normalized.includes('other') && (normalized.includes('specify') || normalized.includes('please') || normalized.includes('(specify)'));
  };

  // Helper function to extract "Others" text from response
  const extractOthersText = (responseValue) => {
    if (!responseValue) return null;
    const responseStr = String(responseValue);
    if (responseStr.startsWith('Others: ')) {
      return responseStr.substring(8); // Remove "Others: " prefix
    }
    return null;
  };

  // Helper function to check if response contains "Others"
  const responseContainsOthers = (responseValue) => {
    if (!responseValue) return false;
    if (Array.isArray(responseValue)) {
      return responseValue.some(val => {
        const str = String(val);
        return str.startsWith('Others: ') || isOthersOption(str);
      });
    }
    const str = String(responseValue);
    return str.startsWith('Others: ') || isOthersOption(str);
  };

  // Helper function to format response display text (same as ResponseDetailsModal)
  const formatResponseDisplay = (response, surveyQuestion) => {
    if (!response || response === null || response === undefined) {
      return 'No response';
    }

    // If it's an array (multiple selections)
    if (Array.isArray(response)) {
      if (response.length === 0) return 'No selections';
      
      // Map each value to its display text using the question options
      const displayTexts = response.map(value => {
        if (surveyQuestion && surveyQuestion.options) {
          const option = surveyQuestion.options.find(opt => opt.value === value);
          return option ? getMainText(option.text || option.value || value) : value;
        }
        return value;
      });
      
      return displayTexts.join(', ');
    }

    // If it's a string or single value
    if (typeof response === 'string' || typeof response === 'number') {
      // Map to display text using question options
      if (surveyQuestion && surveyQuestion.options) {
        const option = surveyQuestion.options.find(opt => opt.value === response);
        return option ? getMainText(option.text || option.value || response.toString()) : response.toString();
      }
      return response.toString();
    }

    return JSON.stringify(response);
  };

  // Helper function to get hardcoded option mappings for common political survey questions
  const getHardcodedOptionMapping = (questionText, responseValue) => {
    const mappings = {
      'What is your gender?': {
        'male': 'Male',
        'female': 'Female',
        'non_binary': 'Non-Binary'
      },
      'Are you a registered voter in this assembly Constituency?': {
        'yes': 'Yes',
        'no': 'No'
      },
      'How do you primarily gather information about political parties and candidates?': {
        'social_media_platforms_(facebook,_twitter,_etc.)': 'Social media platforms (Facebook, Twitter, etc.)',
        'print_media_(newspapers,_magazines)': 'Print media (Newspapers, Magazines)',
        'television_news': 'Television news',
        'radio': 'Radio',
        'word_of_mouth': 'Word of mouth',
        'political_rallies': 'Political rallies',
        'other': 'Other'
      },
      'Which party did you vote for in the last assembly elections (MLA) in 2021?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'did_not_vote': 'Did not vote'
      },
      'Which party did you vote for in the last Lok Sabha elections (MP) in 2024?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'did_not_vote': 'Did not vote'
      },
      'Which party did you vote for in the by- elections held in your assembly constituency (MLA) after 2021?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'did_not_vote': 'Did not vote'
      },
      'If assembly elections (MLA) were to be held tomorrow, then which party would you vote for?': {
        'bjp': 'BJP',
        'aitc_(trinamool_congress)': 'AITC (Trinamool Congress)',
        'inc(congress)': 'INC (Congress)',
        'cpi(m)': 'CPI(M)',
        'aap': 'AAP',
        'other': 'Other',
        'undecided': 'Undecided'
      }
    };

    const questionMapping = mappings[questionText];
    if (questionMapping && questionMapping[responseValue]) {
      return questionMapping[responseValue];
    }
    
    return responseValue; // Return original value if no mapping found
  };

  // Helper function to find question by text in survey structure
  const findQuestionByText = (questionText, survey) => {
    if (!survey || !questionText) return null;
    
    // Handle nested survey structure
    const actualSurvey = survey.survey || survey;
    
    // Try different possible structures
    let questions = [];
    
    // Structure 1: Direct questions array
    if (actualSurvey.questions && Array.isArray(actualSurvey.questions)) {
      questions = actualSurvey.questions;
    }
    // Structure 2: Questions in sections
    else if (actualSurvey.sections && Array.isArray(actualSurvey.sections)) {
      questions = actualSurvey.sections.flatMap(section => section.questions || []);
    }
    // Structure 3: Nested survey object
    else if (actualSurvey.survey && actualSurvey.survey.questions) {
      questions = actualSurvey.survey.questions;
    }
    // Structure 4: Nested survey with sections
    else if (actualSurvey.survey && actualSurvey.survey.sections) {
      questions = actualSurvey.survey.sections.flatMap(section => section.questions || []);
    }
    
    // Find the question by text (using main text for comparison)
    const questionMainText = getMainText(questionText).toLowerCase().trim();
    const foundQuestion = questions.find(q => {
      const qText = getMainText(q.text || q.questionText || '').toLowerCase().trim();
      return qText === questionMainText || 
             qText.includes(questionMainText) ||
             questionMainText.includes(qText);
    });
    
    return foundQuestion;
  };

  // Helper function to find question in survey by keywords (similar to SurveyApprovals)
  const findQuestionInSurveyByKeywords = (keywords, survey, requireAll = false, excludeKeywords = []) => {
    if (!survey || !keywords || keywords.length === 0) return null;
    
    const actualSurvey = survey.survey || survey;
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    const normalizedExclude = excludeKeywords.map(k => k.toLowerCase());
    
    const searchInQuestions = (questions) => {
      for (const question of questions) {
        const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
        
        // Check exclude keywords first
        if (normalizedExclude.length > 0) {
          const hasExcludeKeyword = normalizedExclude.some(keyword => questionText.includes(keyword));
          if (hasExcludeKeyword) continue;
        }
        
        // Check include keywords
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
  const findResponseByQuestionTextMatch = (responses, targetQuestionText) => {
    if (!responses || !Array.isArray(responses) || !targetQuestionText) return null;
    const targetMainText = getMainText(targetQuestionText).toLowerCase().trim();
    
    return responses.find(r => {
      if (!r.questionText) return false;
      const responseQuestionText = getMainText(r.questionText).toLowerCase().trim();
      // Exact match or contains the main text
      return responseQuestionText === targetMainText || 
             responseQuestionText.includes(targetMainText) ||
             targetMainText.includes(responseQuestionText);
    });
  };

  // Helper function to find response by matching survey question (finds question in survey, then matches response)
  const findResponseBySurveyQuestion = (keywords, responses, survey, requireAll = false, excludeKeywords = []) => {
    // First, find the question in the survey
    const surveyQuestion = findQuestionInSurveyByKeywords(keywords, survey, requireAll, excludeKeywords);
    if (!surveyQuestion) return null;
    
    // Get the main text of the survey question (without translation)
    const surveyQuestionMainText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
    
    // Now find the response that matches this question text
    return findResponseByQuestionTextMatch(responses, surveyQuestionMainText);
  };

  // Helper function to find response by question text keywords (fallback method)
  const findResponseByKeywords = (responses, keywords, requireAll = false, excludeKeywords = []) => {
    if (!responses || !Array.isArray(responses)) return null;
    const normalizedKeywords = keywords.map(k => k.toLowerCase());
    const normalizedExclude = excludeKeywords.map(k => k.toLowerCase());
    
    return responses.find(r => {
      if (!r.questionText) return false;
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

  // Helper function to get state from GPS location
  const getStateFromGPS = (location) => {
    if (location?.state) return location.state;
    if (location?.address?.state) return location.address.state;
    if (location?.administrative_area_level_1) return location.administrative_area_level_1;
    return 'N/A';
  };

  // Helper function to capitalize name
  const capitalizeName = (name) => {
    if (!name || name === 'N/A') return 'N/A';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to get all questions from survey (handles both sections and direct questions)
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

  // Helper function to get option text from value (removes translation part)
  const getOptionTextFromValue = (value, question) => {
    if (!question || !question.options || !value) {
      // If value is a string with translation format like "male_{পুরুষ}", extract main part
      if (typeof value === 'string' && value.includes('_{')) {
        return value.split('_{')[0];
      }
      return value;
    }
    
    // Handle array values
    if (Array.isArray(value)) {
      value = value[0];
    }
    
    // Find the option that matches the value
    const option = question.options.find(opt => 
      opt.value === value || 
      opt.value?.toString() === value?.toString() ||
      opt.code === value ||
      opt.code?.toString() === value?.toString()
    );
    
    if (option) {
      // Return main text without translation
      return getMainText(option.text || option.value || value);
    }
    
    // If not found, check if value has translation format
    if (typeof value === 'string' && value.includes('_{')) {
      return value.split('_{')[0];
    }
    
    // If not found, return the value as is
    return value;
  };

  // Helper function to find question by questionNumber
  const findQuestionByNumber = (questionNumber, survey) => {
    if (!survey || !questionNumber) return null;
    const allQuestions = getAllSurveyQuestions(survey);
    return allQuestions.find(q => {
      const qNum = q.questionNumber || '';
      return qNum === questionNumber || 
             qNum.includes(questionNumber) || 
             questionNumber.includes(qNum);
    });
  };

  // Helper function to extract respondent info from responses array
  const getRespondentInfo = (responses, responseData) => {
    if (!responses || !Array.isArray(responses)) {
      return { name: 'N/A', gender: 'N/A', age: 'N/A', city: 'N/A', district: 'N/A', ac: 'N/A', lokSabha: 'N/A', state: 'N/A' };
    }

    // Use getMainText from translations (already imported at top)
    
    // Helper to find response by question text (ignoring translations)
    const findResponseByQuestionText = (responses, searchTexts) => {
      return responses.find(r => {
        if (!r || !r.questionText) return false;
        const mainTextRaw = getMainText(r.questionText);
        if (!mainTextRaw) return false;
        const mainText = String(mainTextRaw).toLowerCase();
        return searchTexts.some(text => {
          if (!text) return false;
          return mainText.includes(String(text).toLowerCase());
        });
      });
    };

    // Helper to find response by questionNumber
    const findResponseByQuestionNumber = (responses, questionNumber) => {
      return responses.find(r => {
        if (!r.questionNumber) return false;
        return r.questionNumber === questionNumber || 
               r.questionNumber.includes(questionNumber) ||
               questionNumber.includes(r.questionNumber);
      });
    };

    // Get survey ID - check both responseData and component state
    // Convert to string to handle ObjectId objects
    const surveyIdRaw = responseData?.survey?._id || responseData?.survey?.id || survey?._id || survey?.id || null;
    const surveyId = surveyIdRaw ? String(surveyIdRaw) : null;
    // Get survey object - prefer component state, fallback to responseData
    const surveyObj = survey || responseData?.survey || null;

    // Special handling for survey "68fd1915d41841da463f0d46"
    if (surveyId === '68fd1915d41841da463f0d46') {
      // STEP 1: Find gender response FIRST and get its identifiers to exclude it
      let genderResponse = findResponseByQuestionText(responses, [
        'please note the respondent\'s gender',
        'note the respondent\'s gender',
        'respondent\'s gender',
        'respondent gender',
        'note the gender'
      ]);
      
      // If not found, try broader search
      if (!genderResponse) {
        genderResponse = findResponseByQuestionText(responses, ['gender']);
      }
      
      // If still not found, try to find by question ID
      if (!genderResponse) {
        const genderResponseById = responses.find(r => 
          r.questionId?.includes('gender') || 
          r.questionId?.includes('respondent_gender')
        );
        if (genderResponseById) {
          genderResponse = genderResponseById;
        }
      }
      
      // Get gender question ID to exclude it from name search - CRITICAL
      const genderQuestionId = genderResponse?.questionId;
      const genderResponseId = genderResponse?._id || genderResponse?.id;
      const genderQuestionText = genderResponse && genderResponse.questionText 
        ? String(getMainText(genderResponse.questionText || '') || '').toLowerCase() 
        : '';
      
      // Create a set of gender identifiers for fast lookup
      const genderIdentifiers = new Set();
      if (genderQuestionId) genderIdentifiers.add(genderQuestionId);
      if (genderResponseId) {
        genderIdentifiers.add(String(genderResponseId));
        if (genderResponse._id) genderIdentifiers.add(String(genderResponse._id));
        if (genderResponse.id) genderIdentifiers.add(String(genderResponse.id));
      }
      
      // Helper function to check if a response value is a gender value
      const isGenderResponseValue = (value) => {
        if (!value) return false;
        const valueStr = String(value).toLowerCase().trim();
        // Check for exact gender values
        if (valueStr === 'male' || valueStr === 'female' || valueStr === 'non_binary' || valueStr === 'other') return true;
        // Check for gender option codes
        if (valueStr === '1' || valueStr === '2' || valueStr === '3') return true;
        // Check for translation format (e.g., "Male_{পুরুষ}")
        if (valueStr.includes('_{')) return true;
        // Check if it starts with gender keywords
        if (valueStr.startsWith('male') || valueStr.startsWith('female')) return true;
        return false;
      };
      
      // Find name from the fixed name question
      // Based on actual data: questionId = "68fd1915d41841da463f0d46_fixed_respondent_name"
      let nameResponse = null;
      
      // Strategy 1: Find by fixed questionId (most reliable for this survey)
      // Based on actual data: questionId = "68fd1915d41841da463f0d46_fixed_respondent_name"
      const fixedNameQuestionId = `${surveyId}_fixed_respondent_name`;
      const nameResponseById = responses.find(r => r.questionId === fixedNameQuestionId);
      
      if (nameResponseById) {
        // CRITICAL: Multiple checks to ensure it's not the gender response
        const isGenderById = genderIdentifiers.has(nameResponseById.questionId) ||
                            genderIdentifiers.has(String(nameResponseById._id)) ||
                            genderIdentifiers.has(String(nameResponseById.id));
        const isGenderByValue = isGenderResponseValue(nameResponseById.response);
        const isGenderByText = nameResponseById.questionText && (() => {
          const qText1 = getMainText(nameResponseById.questionText);
          const qText2 = getMainText(nameResponseById.questionText);
          if (!qText1 && !qText2) return false;
          const lower1 = qText1 ? String(qText1).toLowerCase() : '';
          const lower2 = qText2 ? String(qText2).toLowerCase() : '';
          return lower1.includes('gender') || lower1.includes('respondent\'s gender') || 
                 lower2.includes('gender') || lower2.includes('respondent\'s gender');
        })();
        
        // Only use if it passes ALL checks
        if (!isGenderById && !isGenderByValue && !isGenderByText) {
          nameResponse = nameResponseById;
        }
      }
      
      // Strategy 2: Find Q29 question in survey by questionNumber, then match response by questionId
      if (!nameResponse && surveyObj) {
        const nameQuestion = findQuestionByNumber('Q29', surveyObj) || findQuestionByNumber('29', surveyObj);
        if (nameQuestion && nameQuestion.id) {
          // Find response that matches this questionId
          const foundResponse = responses.find(r => r.questionId === nameQuestion.id);
          if (foundResponse) {
            // CRITICAL: Check if this is the gender response using the set
            const isGenderResponse = genderIdentifiers.has(foundResponse.questionId) ||
                                    genderIdentifiers.has(String(foundResponse._id)) ||
                                    genderIdentifiers.has(String(foundResponse.id));
            
            if (!isGenderResponse && !isGenderResponseValue(foundResponse.response)) {
              // Verify question text is not about gender
              if (foundResponse.questionText) {
                const qTextRaw = getMainText(foundResponse.questionText);
                if (qTextRaw) {
                  const qText = String(qTextRaw).toLowerCase();
                  if (!qText.includes('gender') && 
                      !qText.includes('respondent\'s gender') && 
                      !qText.includes('note the gender') &&
                      !qText.includes('note the respondent')) {
                    nameResponse = foundResponse;
                  }
                } else {
                  nameResponse = foundResponse;
                }
              } else {
                nameResponse = foundResponse;
              }
            }
          }
        }
      }
      
      // Strategy 3: If not found by questionId, search by question text pattern
      if (!nameResponse) {
        for (const response of responses) {
          // CRITICAL: Skip if this is the gender response (by ID) - check first using set
          if (genderIdentifiers.has(response.questionId) ||
              genderIdentifiers.has(String(response._id)) ||
              genderIdentifiers.has(String(response.id))) {
            continue; // This is the gender response, skip it
          }
          
          // Skip if response value is a gender value
          if (isGenderResponseValue(response.response)) {
            continue;
          }
          
          // Skip if question text contains gender keywords
          if (response.questionText) {
            const qTextRaw = getMainText(response.questionText);
            if (qTextRaw) {
              const qText = String(qTextRaw).toLowerCase();
              if (qText.includes('gender') || 
                  qText.includes('respondent\'s gender') || 
                  qText.includes('note the gender') ||
                  qText.includes('note the respondent')) {
                continue;
              }
            }
          }
          
          // Check for name question text pattern - be very specific
          if (response.questionText) {
            const qTextRaw = getMainText(response.questionText);
            if (!qTextRaw) continue;
            const qText = String(qTextRaw).toLowerCase();
            // Look for name question text patterns - must have "share your name" AND ("confidential" OR "assure")
            const hasShareName = qText.includes('share your name') || 
                                qText.includes('would you like to share your name');
            const hasConfidential = qText.includes('confidential') || 
                                   qText.includes('assure') ||
                                   qText.includes('assurance');
            
            if (hasShareName && hasConfidential) {
              nameResponse = response;
              break; // Found name question, stop searching
            }
          }
        }
      }
      
      // Strategy 4: Fallback - search for any question with "share your name" (without confidential)
      if (!nameResponse) {
        for (const response of responses) {
          // Skip if this is the gender response using set
          if (genderIdentifiers.has(response.questionId) ||
              genderIdentifiers.has(String(response._id)) ||
              genderIdentifiers.has(String(response.id))) {
            continue;
          }
          
          // Skip if response value is a gender value
          if (isGenderResponseValue(response.response)) {
            continue;
          }
          
          // Skip if question text contains gender keywords
          if (response.questionText) {
            const qTextRaw = getMainText(response.questionText);
            if (qTextRaw) {
              const qText = String(qTextRaw).toLowerCase();
              if (qText.includes('gender') || 
                  qText.includes('respondent\'s gender') || 
                  qText.includes('note the gender') ||
                  qText.includes('note the respondent')) {
                continue;
              }
              
              // Check for "share your name" pattern
              if (qText.includes('would you like to share your name') ||
                  qText.includes('share your name with us') ||
                  (qText.includes('share your name') && !qText.includes('gender'))) {
                nameResponse = response;
                break;
              }
            }
          }
        }
      }
      
      // Final safety check: if we still have a nameResponse, verify it's not a gender value or gender response
      // This is CRITICAL - we must never use the gender response as the name
      if (nameResponse) {
        // Check 1: Is it the gender response by ID? (using set for fast lookup)
        if (genderIdentifiers.has(nameResponse.questionId) ||
            genderIdentifiers.has(String(nameResponse._id)) ||
            genderIdentifiers.has(String(nameResponse.id))) {
          nameResponse = null;
        }
        // Check by question text match
        else if (nameResponse.questionText && genderResponse && genderResponse.questionText) {
          const nameTextRaw = getMainText(nameResponse.questionText);
          const genderTextRaw = getMainText(genderResponse.questionText);
          if (nameTextRaw && genderTextRaw) {
            const nameText = String(nameTextRaw).toLowerCase();
            const genderText = String(genderTextRaw).toLowerCase();
            if (nameText === genderText) {
              nameResponse = null;
            }
          }
        }
        
        // Check 2: Is the response value a gender value?
        if (nameResponse && isGenderResponseValue(nameResponse.response)) {
          nameResponse = null;
        }
        
        // Check 3: Does the question text contain gender keywords?
        if (nameResponse && nameResponse.questionText) {
          const qTextRaw = getMainText(nameResponse.questionText);
          if (qTextRaw) {
            const qText = String(qTextRaw).toLowerCase();
            if (qText.includes('gender') || 
                qText.includes('respondent\'s gender') || 
                qText.includes('note the gender') ||
                qText.includes('note the respondent') ||
                (qText.includes('respondent') && qText.includes('gender'))) {
              nameResponse = null;
            }
          }
        }
      }
      
      // ABSOLUTE FINAL CHECK: If nameResponse is still set but has a gender value, clear it
      if (nameResponse && isGenderResponseValue(nameResponse.response)) {
        nameResponse = null;
      }
      
      // Get name and capitalize it
      // CRITICAL: Only use nameResponse if it exists and is NOT the gender response
      let name = 'N/A';
      
      // Final validation: Ensure nameResponse is valid and not the gender response
      if (nameResponse) {
        // Check 1: Is it the gender response? (using set for fast lookup)
        if (genderIdentifiers.has(nameResponse.questionId) ||
            genderIdentifiers.has(String(nameResponse._id)) ||
            genderIdentifiers.has(String(nameResponse.id))) {
          nameResponse = null; // Clear it - this is the gender response
        }
        // Check 2: Is the response value a gender value?
        else if (isGenderResponseValue(nameResponse.response)) {
          nameResponse = null; // Clear it - this has a gender value
        }
        // Check 3: Is the question text about gender?
        else if (nameResponse.questionText) {
          const qTextRaw = getMainText(nameResponse.questionText);
          if (qTextRaw) {
            const qText = String(qTextRaw).toLowerCase();
            if (qText.includes('gender') || 
                qText.includes('respondent\'s gender') || 
                qText.includes('note the gender') ||
                qText.includes('note the respondent')) {
              nameResponse = null; // Clear it - this is a gender question
            }
          }
        }
      }
      
      // Now extract the name only if nameResponse is still valid
      // ABSOLUTE FINAL CHECK: Make absolutely sure nameResponse is not the gender response
      if (nameResponse) {
        // Check one more time if it's the gender response
        if (genderIdentifiers.has(nameResponse.questionId) ||
            genderIdentifiers.has(String(nameResponse._id)) ||
            genderIdentifiers.has(String(nameResponse.id))) {
          nameResponse = null; // Clear it
        }
        // Check if the value is a gender value
        else if (isGenderResponseValue(nameResponse.response)) {
          nameResponse = null; // Clear it
        }
        // Check if question text is about gender
        else if (nameResponse.questionText) {
          const qTextRaw = getMainText(nameResponse.questionText);
          if (qTextRaw) {
            const qText = String(qTextRaw).toLowerCase();
            if (qText.includes('gender') || 
                qText.includes('respondent\'s gender') || 
                qText.includes('note the gender') ||
                qText.includes('note the respondent')) {
              nameResponse = null; // Clear it
            }
          }
        }
      }
      
      if (nameResponse?.response) {
        const nameValue = Array.isArray(nameResponse.response) ? nameResponse.response[0] : nameResponse.response;
        const nameStr = String(nameValue).toLowerCase().trim();
        
        // ABSOLUTE FINAL CHECK: ensure it's not a gender value
        if (!isGenderResponseValue(nameValue) && 
            nameValue && 
            nameValue !== 'N/A' && 
            nameValue !== null &&
            nameValue !== undefined &&
            nameStr !== '' &&
            nameStr.length > 1 &&
            !nameStr.includes('_{')) { // Extra check for translation format
          name = capitalizeName(String(nameValue));
        }
      }
      
      // Get gender option text (without translation)
      let gender = 'N/A';
      if (genderResponse?.response) {
        // Try to find the gender question in survey
        const genderQuestion = surveyObj ? getAllSurveyQuestions(surveyObj).find(q => {
          if (!q) return false;
          const qTextRaw = getMainText(q.text || '');
          if (!qTextRaw) return false;
          const qText = String(qTextRaw).toLowerCase();
          return qText.includes('gender') || qText.includes('respondent');
        }) : null;
        
        gender = getOptionTextFromValue(genderResponse.response, genderQuestion);
      }
      
      // Find age from age question
      const ageResponse = findResponseByQuestionText(responses, [
        'could you please tell me your age',
        'your age in complete years',
        'age in complete years',
        'age'
      ]);

      // Comprehensive AC extraction function (same as reports page)
      const extractACFromResponse = (responses, responseData) => {
        // Helper to validate if a value is a valid AC name (not yes/no/consent answers)
        const isValidACName = (value) => {
          if (!value || typeof value !== 'string') return false;
          const cleaned = getMainText(value).trim();
          if (!cleaned || cleaned === 'N/A' || cleaned === '') return false;
          
          const lower = cleaned.toLowerCase();
          // Reject common non-AC values
          const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
          if (invalidValues.includes(lower)) return false;
          if (lower.startsWith('yes') || lower.startsWith('no')) return false;
          if (lower.match(/^yes[_\s]/i) || lower.match(/^no[_\s]/i)) return false;
          
          // Must be longer than 2 characters
          if (cleaned.length <= 2) return false;
          
          // Should look like a valid name (has capital letters or multiple words)
          const hasCapitalLetters = /[A-Z]/.test(cleaned);
          const hasMultipleWords = cleaned.split(/\s+/).length > 1;
          const looksLikeName = hasCapitalLetters || hasMultipleWords;
          
          return looksLikeName;
        };

        // Priority 1: Check selectedAC field
        if (responseData?.selectedAC && isValidACName(responseData.selectedAC)) {
          return getMainText(String(responseData.selectedAC)).trim();
        }
        
        // Priority 2: Check selectedPollingStation.acName
        if (responseData?.selectedPollingStation?.acName && isValidACName(responseData.selectedPollingStation.acName)) {
          return getMainText(String(responseData.selectedPollingStation.acName)).trim();
        }
        
        // Priority 3: Check responses array for questionId === 'ac-selection'
        if (responses && Array.isArray(responses)) {
          const acSelectionResponse = responses.find(r => 
            r.questionId === 'ac-selection' && r.response
          );
          if (acSelectionResponse && isValidACName(acSelectionResponse.response)) {
            return getMainText(String(acSelectionResponse.response)).trim();
          }
          
          // Priority 4: Check for questionType that indicates AC selection
          const acTypeResponse = responses.find(r => 
            (r.questionType === 'ac_selection' || 
             r.questionType === 'assembly_constituency' ||
             r.questionType === 'ac') && 
            r.response
          );
          if (acTypeResponse && isValidACName(acTypeResponse.response)) {
            return getMainText(String(acTypeResponse.response)).trim();
          }
          
          // Priority 5: Search by question text containing "assembly" or "constituency"
          // BUT exclude questions that are consent/agreement questions
          const acTextResponses = responses.filter(r => {
            if (!r.questionText || !r.response) return false;
            const questionText = getMainText(r.questionText).toLowerCase();
            const hasAssembly = questionText.includes('assembly');
            const hasConstituency = questionText.includes('constituency');
            
            // Exclude consent/agreement questions
            const isConsentQuestion = questionText.includes('consent') || 
                                      questionText.includes('agree') ||
                                      questionText.includes('participate') ||
                                      questionText.includes('willing') ||
                                      questionText.includes('do you') ||
                                      questionText.includes('would you');
            
            return (hasAssembly || hasConstituency) && !isConsentQuestion;
      });
          
          // Try each potential AC response and validate it
          for (const acResponse of acTextResponses) {
            if (isValidACName(acResponse.response)) {
              return getMainText(String(acResponse.response)).trim();
            }
          }
        }
        
        return null;
      };

      // Extract AC using comprehensive function
      const extractedAC = extractACFromResponse(responses, responseData);
      const acName = extractedAC || 'N/A';

      // Get city from GPS location if available, otherwise from responses
      let city = 'N/A';
      if (responseData?.location?.city) {
        city = responseData.location.city;
      } else {
        const cityResponse = findResponseByQuestionText(responses, [
          'city',
          'location'
        ]);
        city = cityResponse?.response || 'N/A';
      }

      // Get district from AC using assemblyConstituencies.json
      const district = getDistrictFromAC(acName);

      // Get Lok Sabha from AC using assemblyConstituencies.json
      const lokSabha = getLokSabhaFromAC(acName);

      // Get state from GPS location
      const state = getStateFromGPS(responseData?.location);

      return {
        name: name,
        gender: gender,
        age: ageResponse?.response || 'N/A',
        city: city,
        district: district,
        ac: acName,
        lokSabha: lokSabha,
        state: state
      };
    }

    // Default behavior for other surveys
    // IMPORTANT: Exclude gender responses from name search
    const genderResponse = responses.find(r => {
      if (!r || !r.questionText) return false;
      const qText1 = getMainText(r.questionText || '');
      const qText2 = getMainText(r.questionText || '');
      if (!qText1 && !qText2) return false;
      const lower1 = qText1 ? String(qText1).toLowerCase() : '';
      const lower2 = qText2 ? String(qText2).toLowerCase() : '';
      return lower1.includes('gender') || lower1.includes('sex') || lower2.includes('gender') || lower2.includes('sex');
    });
    const genderQuestionId = genderResponse?.questionId;
    
    const nameResponse = responses.find(r => {
      // Skip if this is the gender response
      if (genderQuestionId && r.questionId === genderQuestionId) return false;
      // Skip if question text is about gender
      if (!r || !r.questionText) return false;
      const qTextRaw = getMainText(r.questionText || '');
      if (!qTextRaw) return false;
      const qText = String(qTextRaw).toLowerCase();
      if (qText.includes('gender') || qText.includes('sex')) return false;
      // Look for name-related questions
      return qText.includes('name') || 
             (qText.includes('respondent') && !qText.includes('gender')) ||
             qText.includes('full name');
    });
    
    // Get gender response (already found above if not in special survey section)
    const genderResponseForDefault = responses.find(r => {
      if (!r || !r.questionText) return false;
      const qText = getMainText(r.questionText || '');
      if (!qText) return false;
      const lower = String(qText).toLowerCase();
      return lower.includes('gender') || lower.includes('sex');
    });
    
    // Get gender option text (without translation)
    let gender = 'N/A';
    if (genderResponseForDefault?.response) {
      const genderQuestion = survey ? getAllSurveyQuestions(survey).find(q => {
        if (!q) return false;
        const qTextRaw = getMainText(q.text || '');
        if (!qTextRaw) return false;
        const qText = String(qTextRaw).toLowerCase();
        return qText.includes('gender') || qText.includes('sex');
      }) : null;
      
      gender = getOptionTextFromValue(genderResponseForDefault.response, genderQuestion);
    }
    
    const ageResponse = responses.find(r => {
      if (!r || !r.questionText) return false;
      const qText = getMainText(r.questionText || '');
      if (!qText) return false;
      const lower = String(qText).toLowerCase();
      return lower.includes('age') || lower.includes('year');
    });

    // Comprehensive AC extraction function (same as reports page)
    const extractACFromResponse = (responses, responseData) => {
      // Helper to validate if a value is a valid AC name (not yes/no/consent answers)
      const isValidACName = (value) => {
        if (!value || typeof value !== 'string') return false;
        const cleaned = getMainText(value).trim();
        if (!cleaned || cleaned === 'N/A' || cleaned === '') return false;
        
        const lower = cleaned.toLowerCase();
        // Reject common non-AC values
        const invalidValues = ['yes', 'no', 'y', 'n', 'true', 'false', 'ok', 'okay', 'sure', 'agree', 'disagree', 'consent'];
        if (invalidValues.includes(lower)) return false;
        if (lower.startsWith('yes') || lower.startsWith('no')) return false;
        if (lower.match(/^yes[_\s]/i) || lower.match(/^no[_\s]/i)) return false;
        
        // Must be longer than 2 characters
        if (cleaned.length <= 2) return false;
        
        // Should look like a valid name (has capital letters or multiple words)
        const hasCapitalLetters = /[A-Z]/.test(cleaned);
        const hasMultipleWords = cleaned.split(/\s+/).length > 1;
        const looksLikeName = hasCapitalLetters || hasMultipleWords;
        
        return looksLikeName;
      };

      // Priority 1: Check selectedAC field
      if (responseData?.selectedAC && isValidACName(responseData.selectedAC)) {
        return getMainText(String(responseData.selectedAC)).trim();
      }
      
      // Priority 2: Check selectedPollingStation.acName
      if (responseData?.selectedPollingStation?.acName && isValidACName(responseData.selectedPollingStation.acName)) {
        return getMainText(String(responseData.selectedPollingStation.acName)).trim();
      }
      
      // Priority 3: Check responses array for questionId === 'ac-selection'
      if (responses && Array.isArray(responses)) {
        const acSelectionResponse = responses.find(r => 
          r.questionId === 'ac-selection' && r.response
        );
        if (acSelectionResponse && isValidACName(acSelectionResponse.response)) {
          return getMainText(String(acSelectionResponse.response)).trim();
        }
        
        // Priority 4: Check for questionType that indicates AC selection
        const acTypeResponse = responses.find(r => 
          (r.questionType === 'ac_selection' || 
           r.questionType === 'assembly_constituency' ||
           r.questionType === 'ac') && 
          r.response
        );
        if (acTypeResponse && isValidACName(acTypeResponse.response)) {
          return getMainText(String(acTypeResponse.response)).trim();
        }
        
        // Priority 5: Search by question text containing "assembly" or "constituency"
        // BUT exclude questions that are consent/agreement questions
        const acTextResponses = responses.filter(r => {
          if (!r.questionText || !r.response) return false;
          const questionText = getMainText(r.questionText).toLowerCase();
          const hasAssembly = questionText.includes('assembly');
          const hasConstituency = questionText.includes('constituency');
          
          // Exclude consent/agreement questions
          const isConsentQuestion = questionText.includes('consent') || 
                                    questionText.includes('agree') ||
                                    questionText.includes('participate') ||
                                    questionText.includes('willing') ||
                                    questionText.includes('do you') ||
                                    questionText.includes('would you');
          
          return (hasAssembly || hasConstituency) && !isConsentQuestion;
        });
        
        // Try each potential AC response and validate it
        for (const acResponse of acTextResponses) {
          if (isValidACName(acResponse.response)) {
            return getMainText(String(acResponse.response)).trim();
          }
        }
      }
      
      return null;
    };

    // Extract AC using comprehensive function
    const extractedAC = extractACFromResponse(responses, responseData);
    const acName = extractedAC || 'N/A';

    // Get city from GPS location if available, otherwise from responses
    let city = 'N/A';
    if (responseData?.location?.city) {
      city = responseData.location.city;
    } else {
      const cityResponse = responses.find(r => 
        r.questionText && (
          r.questionText.toLowerCase().includes('city') || 
          r.questionText.toLowerCase().includes('location')
        )
      );
      city = cityResponse?.response || 'N/A';
    }

    // Get district from AC using assemblyConstituencies.json
    const district = getDistrictFromAC(acName);

    // Get Lok Sabha from AC using assemblyConstituencies.json
    const lokSabha = getLokSabhaFromAC(acName);

    // Get state from GPS location
    const state = getStateFromGPS(responseData?.location);

    // Get name and capitalize it
    // CRITICAL: Ensure nameResponse is not a gender response
    let name = 'N/A';
    if (nameResponse && nameResponse !== genderResponseForDefault) {
      const nameValue = nameResponse.response;
      // Check if it's a gender value
      const nameStr = String(nameValue).toLowerCase().trim();
      if (!nameStr.includes('_{') && // Not a translated gender value
          !nameStr.startsWith('male') && 
          !nameStr.startsWith('female') &&
          nameValue && 
          nameValue !== 'N/A' && 
          nameValue !== null &&
          nameValue !== undefined &&
          nameStr !== '' &&
          nameStr.length > 1) {
        name = capitalizeName(String(nameValue));
      }
    }

    return {
      name: name,
      gender: gender,
      age: ageResponse?.response || 'N/A',
      city: city,
      district: district,
      ac: acName,
      lokSabha: lokSabha,
      state: state
    };
  };

  // Get all AC objects for dropdown - from actual responses (like reports page)
  // Must be defined after getRespondentInfo
  const allACObjects = useMemo(() => {
    if (!responses || responses.length === 0) return [];

    const acMap = new Map(); // Map to store AC objects with name and code

    responses.forEach(response => {
      // Only include responses with Approved, Rejected, or Pending_Approval status
      if (response.status === 'Approved' || 
          response.status === 'Rejected' || 
          response.status === 'Pending_Approval') {
        const respondentInfo = getRespondentInfo(response.responses, response);
        
        if (respondentInfo.ac && respondentInfo.ac !== 'N/A') {
          const acName = respondentInfo.ac;
          
          // Get AC code from assembly constituencies data
          if (!acMap.has(acName)) {
            const acData = getACByName(acName);
            const fullCode = acData?.acCode || '';
            const numericCode = getNumericACCode(fullCode);
            
            acMap.set(acName, {
              name: acName,
              code: fullCode, // Keep full code for reference
              numericCode: numericCode // Numeric code for display and search
            });
          }
        }
      }
    });

    return Array.from(acMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [responses]);

  // Filter ACs based on search term (name or numeric code) - same as reports page
  // Must be defined after allACObjects
  const filteredACs = useMemo(() => {
    if (!allACObjects) return [];
    
    if (!acSearchTerm.trim()) {
      return allACObjects;
    }

    const searchLower = acSearchTerm.toLowerCase();
    const searchNumeric = acSearchTerm.trim(); // For numeric search, don't lowercase
    
    return allACObjects.filter(ac => {
      const nameMatch = ac.name?.toLowerCase().includes(searchLower);
      // Search by numeric code (exact match or partial match)
      const numericCodeMatch = ac.numericCode && (
        ac.numericCode === searchNumeric || 
        ac.numericCode.includes(searchNumeric) ||
        searchNumeric.includes(ac.numericCode)
      );
      
      return nameMatch || numericCodeMatch;
    });
  }, [allACObjects, acSearchTerm]);

  // Get unique filter options from original unfiltered responses
  const getFilterOptions = useMemo(() => {
    if (!originalResponses || originalResponses.length === 0) {
      return {
        gender: [],
        age: [],
        ac: [],
        city: [],
        district: [],
        lokSabha: [],
        state: [],
        interviewMode: []
      };
    }

    const options = {
      gender: new Set(),
      age: new Set(),
      ac: new Set(),
      city: new Set(),
      district: new Set(),
      lokSabha: new Set(),
      state: new Set(),
      interviewMode: new Set()
    };

    originalResponses.forEach(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const state = getStateFromGPS(response.location);
      const lokSabha = getLokSabhaFromAC(respondentInfo.ac);

      if (respondentInfo.gender && respondentInfo.gender !== 'N/A') {
        options.gender.add(respondentInfo.gender);
      }
      if (respondentInfo.age && respondentInfo.age !== 'N/A') {
        options.age.add(parseInt(respondentInfo.age));
      }
      if (respondentInfo.ac && respondentInfo.ac !== 'N/A') {
        options.ac.add(respondentInfo.ac);
      }
      if (respondentInfo.city && respondentInfo.city !== 'N/A') {
        options.city.add(respondentInfo.city);
      }
      if (respondentInfo.district && respondentInfo.district !== 'N/A') {
        options.district.add(respondentInfo.district);
      }
      if (lokSabha && lokSabha !== 'N/A') {
        options.lokSabha.add(lokSabha);
      }
      if (state && state !== 'N/A') {
        options.state.add(state);
      }
      if (response.interviewMode && response.interviewMode !== 'N/A') {
        options.interviewMode.add(response.interviewMode.toUpperCase());
      }
    });

    const result = {
      gender: Array.from(options.gender).sort(),
      age: Array.from(options.age).sort((a, b) => a - b),
      ac: Array.from(options.ac).sort(),
      city: Array.from(options.city).sort(),
      district: Array.from(options.district).sort(),
      lokSabha: Array.from(options.lokSabha).sort(),
      state: Array.from(options.state).sort(),
      interviewMode: Array.from(options.interviewMode).sort()
    };
    
    return result;
  }, [originalResponses]);

  // Filter responses based on current filters
  const filteredResponses = useMemo(() => {
    if (!originalResponses || originalResponses.length === 0) return [];

    // Debug logging for troubleshooting
    if (filters.interviewerIds && filters.interviewerIds.length > 0 && filters.status === 'Approved') {
      const matchingInterviewer = originalResponses.filter(r => {
        const id = r.interviewer?._id?.toString() || r.interviewer?._id || '';
        return filters.interviewerIds.map(i => i?.toString() || i).includes(id);
      });
      const matchingStatus = matchingInterviewer.filter(r => r.status === 'Approved');
      console.log('🔍 Filter Debug:', {
        interviewerIds: filters.interviewerIds,
        status: filters.status,
        totalResponses: originalResponses.length,
        matchingInterviewer: matchingInterviewer.length,
        matchingStatus: matchingStatus.length,
        sampleStatuses: matchingInterviewer.slice(0, 5).map(r => ({ id: r.responseId, status: r.status }))
      });
    }

    return originalResponses.filter(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const state = getStateFromGPS(response.location);
      const lokSabha = getLokSabhaFromAC(respondentInfo.ac);

      // Date Range filter
      if (filters.dateRange !== 'all') {
        const responseDate = new Date(response.createdAt);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        if (filters.dateRange === 'custom') {
          if (filters.startDate || filters.endDate) {
            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            const endDate = filters.endDate ? new Date(filters.endDate) : null;
            endDate?.setHours(23, 59, 59, 999); // Include full end date
            
            if (startDate && responseDate < startDate) return false;
            if (endDate && responseDate > endDate) return false;
          }
        } else if (filters.dateRange === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (responseDate < today || responseDate >= tomorrow) return false;
        } else if (filters.dateRange === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          const yesterdayEnd = new Date(yesterday);
          yesterdayEnd.setHours(23, 59, 59, 999);
          if (responseDate < yesterday || responseDate > yesterdayEnd) return false;
        } else if (filters.dateRange === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (responseDate < weekAgo) return false;
        } else if (filters.dateRange === 'month') {
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          if (responseDate < monthAgo) return false;
        }
      }

      // Interviewer filter
      if (filters.interviewerIds && filters.interviewerIds.length > 0) {
        // Convert interviewer ID to string for comparison (handles both ObjectId and string)
        const interviewerId = response.interviewer?._id?.toString() || response.interviewer?._id || '';
        // Convert filter IDs to strings for comparison
        const filterIds = filters.interviewerIds.map(id => id?.toString() || id);
        const isIncluded = filterIds.includes(interviewerId);
        
        if (filters.interviewerMode === 'include' && !isIncluded) {
          return false;
        }
        if (filters.interviewerMode === 'exclude' && isIncluded) {
          return false;
        }
      }

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase().trim();
        const respondentName = (respondentInfo.name || '').toLowerCase();
        const interviewerName = response.interviewer 
          ? `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.toLowerCase()
          : '';
        const responseId = (response.responseId || response._id?.toString() || '').toLowerCase();
        
        if (!respondentName.includes(searchTerm) && 
            !interviewerName.includes(searchTerm) && 
            !responseId.includes(searchTerm)) {
          return false;
        }
      }

      // Gender filter - case insensitive
      if (filters.gender && respondentInfo.gender && filters.gender) {
        if (String(respondentInfo.gender).toLowerCase() !== String(filters.gender).toLowerCase()) {
          return false;
        }
      }

      // Age filter
      if (filters.ageMin && parseInt(respondentInfo.age) < parseInt(filters.ageMin)) {
        return false;
      }
      if (filters.ageMax && parseInt(respondentInfo.age) > parseInt(filters.ageMax)) {
        return false;
      }

      // AC filter - case insensitive (same logic as reports page)
      if (filters.ac && respondentInfo.ac && respondentInfo.ac !== 'N/A') {
        if (String(respondentInfo.ac).toLowerCase() !== String(filters.ac).toLowerCase()) {
          return false;
        }
      } else if (filters.ac && (!respondentInfo.ac || respondentInfo.ac === 'N/A')) {
        // If filter is set but AC is N/A, exclude this response
        return false;
      }

      // City filter - case insensitive
      if (filters.city && respondentInfo.city && filters.city) {
        if (String(respondentInfo.city).toLowerCase() !== String(filters.city).toLowerCase()) {
          return false;
        }
      }

      // District filter - case insensitive
      if (filters.district && respondentInfo.district && filters.district) {
        if (String(respondentInfo.district).toLowerCase() !== String(filters.district).toLowerCase()) {
          return false;
        }
      }

      // Lok Sabha filter - case insensitive
      if (filters.lokSabha && lokSabha && filters.lokSabha) {
        if (String(lokSabha).toLowerCase() !== String(filters.lokSabha).toLowerCase()) {
          return false;
        }
      }

      // State filter - case insensitive
      if (filters.state && state && filters.state) {
        if (String(state).toLowerCase() !== String(filters.state).toLowerCase()) {
          return false;
        }
      }

      // Interview Mode filter
      if (filters.interviewMode && response.interviewMode?.toUpperCase() !== filters.interviewMode.toUpperCase()) {
        return false;
      }

      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'approved_rejected_pending') {
          // Show Approved, Rejected, and Pending_Approval
          if (response.status !== 'Approved' && response.status !== 'Rejected' && response.status !== 'Pending_Approval') {
            return false;
          }
        } else if (filters.status === 'approved_pending') {
          // Show Approved and Pending_Approval
          if (response.status !== 'Approved' && response.status !== 'Pending_Approval') {
            return false;
          }
        } else if (filters.status === 'pending') {
          // Show only Pending_Approval
          if (response.status !== 'Pending_Approval') {
            return false;
          }
        } else {
          // Filter by specific status (Approved, Rejected, etc.)
          // Normalize both to strings and compare (handles case sensitivity)
          const responseStatus = String(response.status || '').trim();
          const filterStatus = String(filters.status || '').trim();
          if (responseStatus !== filterStatus) {
            return false;
          }
        }
      } else {
        // Default (status === 'all'): Show both Approved and Rejected
        if (response.status !== 'Approved' && response.status !== 'Rejected') {
          return false;
        }
      }

      return true;
    });
  }, [originalResponses, filters]);

  // Reset pagination to page 1 when filters change
  // Use a serialized key to detect filter changes (handles arrays properly)
  const filtersKey = useMemo(() => {
    return JSON.stringify({
      status: filters.status,
      dateRange: filters.dateRange,
      startDate: filters.startDate,
      endDate: filters.endDate,
      search: filters.search,
      gender: filters.gender,
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      ac: filters.ac,
      city: filters.city,
      district: filters.district,
      lokSabha: filters.lokSabha,
      state: filters.state,
      interviewMode: filters.interviewMode,
      interviewerIds: filters.interviewerIds?.sort() || [], // Sort for consistent comparison
      interviewerMode: filters.interviewerMode
    });
  }, [filters]);

  useEffect(() => {
    setTablePagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  }, [filtersKey]);

  // Show loading overlay when filters change
  useEffect(() => {
    // Skip on initial load (when originalResponses is empty)
    if (!originalResponses || originalResponses.length === 0) return;
    
    // Show loading overlay when filters change
    setFilterLoading(true);
    
    // Hide loading overlay after filtering completes
    // Use a small delay to ensure smooth animation even for fast client-side filtering
    const timer = setTimeout(() => {
      setFilterLoading(false);
    }, 150); // Small delay for smooth UX
    
    return () => clearTimeout(timer);
  }, [filtersKey, originalResponses]);

  // Paginated responses for table
  const paginatedResponses = useMemo(() => {
    const startIndex = (tablePagination.currentPage - 1) * tablePagination.pageSize;
    const endIndex = startIndex + tablePagination.pageSize;
    return filteredResponses.slice(startIndex, endIndex);
  }, [filteredResponses, tablePagination]);

  // Calculate total pages for table
  const totalTablePages = Math.ceil(filteredResponses.length / tablePagination.pageSize);

  // Handle table pagination
  const handleTablePageChange = (newPage) => {
    setTablePagination(prev => ({
      ...prev,
      currentPage: newPage
    }));
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // Helper function to check if a question is AC selection or polling station
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

  // Handle CSV download with raw survey question-answer data
  const handleCSVDownload = () => {
    if (filteredResponses.length === 0) {
      showError('No responses to download');
      return;
    }

    if (!survey) {
      showError('Survey data not available');
      return;
    }

    // Show modal to choose download mode
    setShowDownloadModal(true);
  };

  // Generate CSV with selected mode - NEW FORMAT with two-row headers and all required columns
  const generateCSV = async (downloadMode) => {
    setShowDownloadModal(false);

    if (filteredResponses.length === 0) {
      showError('No responses to download');
      return;
    }

    if (!survey) {
      showError('Survey data not available');
      return;
    }

    // Determine if we have CAPI, CATI, or mixed responses
    const hasCAPI = filteredResponses.some(r => r.interviewMode?.toUpperCase() === 'CAPI');
    const hasCATI = filteredResponses.some(r => r.interviewMode?.toUpperCase() === 'CATI');
    const isMixed = hasCAPI && hasCATI;
    const isCAPIOnly = hasCAPI && !hasCATI;
    const isCATIOnly = hasCATI && !hasCAPI;

    // Get ALL questions from the survey itself (not from responses)
    const allSurveyQuestions = getAllSurveyQuestions(survey);
    
    if (allSurveyQuestions.length === 0) {
      showError('No survey questions found');
      return;
    }

    // Filter out AC selection and polling station questions
    // Keep the order from allSurveyQuestions (already sorted by order field)
    const regularQuestions = allSurveyQuestions
      .filter(q => !isACOrPollingStationQuestion(q))
      .sort((a, b) => {
        // Sort by order field if available
        const orderA = a.order !== null && a.order !== undefined ? parseInt(a.order) : 9999;
        const orderB = b.order !== null && b.order !== undefined ? parseInt(b.order) : 9999;
        if (!isNaN(orderA) && !isNaN(orderB)) {
          return orderA - orderB;
        }
        return 0; // Keep original order if no order field
      });
    
    if (regularQuestions.length === 0) {
      showError('No regular survey questions found (only AC/polling station questions)');
      return;
    }

    // Helper function to get question code from template mapping
    // Maps survey questions to exact codes from the Excel template (survey 68fd1915d41841da463f0d46)
    // Only truly special questions use resp_* codes (religion, caste, social category, education, occupation, mobile, name)
    // All other questions (including age, gender, registered_voter) use q1, q2, q3, etc. format
    const getQuestionCodeFromTemplate = (question, questionNumber) => {
      if (!question) return `q${questionNumber}`;
      
      const questionText = getMainText(question.text || question.questionText || '').toLowerCase();
      const qNum = questionNumber;
      
      // Check if question has an id that matches template codes
      if (question.id) {
        const questionId = String(question.id).toLowerCase();
        // Only check for truly special resp_ codes (religion, caste, social category, education, occupation, mobile, name)
        // NOT age, gender, registered_voter - those should use q1, q2, q3 format
        if (questionId.includes('religion') || questionId === 'resp_religion') return 'resp_religion';
        if (questionId.includes('social_cat') || questionId === 'resp_social_cat') return 'resp_social_cat';
        if (questionId.includes('caste') || questionId === 'resp_caste_jati') return 'resp_caste_jati';
        if (questionId.includes('female_edu') || questionId === 'resp_female_edu') return 'resp_female_edu';
        if (questionId.includes('male_edu') || questionId === 'resp_male_edu') return 'resp_male_edu';
        if (questionId.includes('occupation') || questionId === 'resp_occupation') return 'resp_occupation';
        if (questionId.includes('mobile') || questionId === 'resp_mobile') return 'resp_mobile';
        if (questionId.includes('name') && !questionId.includes('caste')) return 'resp_name';
      }
      
      // Map by question text keywords - ONLY for truly special questions
      // Q20: Religion (special)
      if (questionText.includes('religion') && questionText.includes('belong to')) {
        return 'resp_religion';
      }
      // Q21: Social category (special)
      if (questionText.includes('social category') && questionText.includes('belong to')) {
        return 'resp_social_cat';
      }
      // Q22: Caste (special)
      if (questionText.includes('caste') && (questionText.includes('tell me') || questionText.includes('jati'))) {
        return 'resp_caste_jati';
      }
      // Q23: Female education (special)
      if (questionText.includes('female') && questionText.includes('education') && 
          (questionText.includes('most educated') || questionText.includes('highest educational'))) {
        return 'resp_female_edu';
      }
      // Q24: Male education (special)
      if (questionText.includes('male') && questionText.includes('education') && 
          (questionText.includes('most educated') || questionText.includes('highest educational'))) {
        return 'resp_male_edu';
      }
      // Q25: Occupation (special)
      if (questionText.includes('occupation') && questionText.includes('chief wage earner')) {
        return 'resp_occupation';
      }
      // Q26: Mobile number (special)
      if ((questionText.includes('mobile number') || questionText.includes('phone number')) && 
          questionText.includes('share')) {
        return 'resp_mobile';
      }
      // Q27: Name (special)
      if (questionText.includes('share your name') && questionText.includes('confidential')) {
        return 'resp_name';
      }
      // Q28: Future contact (special)
      if (questionText.includes('contact you in future') || 
          (questionText.includes('future') && questionText.includes('similar surveys'))) {
        return 'thanks_future';
      }
      
      // For ALL other questions (including Q1-age, Q2-registered_voter, Q3-gender, Q4-Q19),
      // use q1, q2, q3, etc. format with options q1_1, q1_2, etc.
      return `q${qNum}`;
    };
    
    // Helper function to get option code for multi-select questions
    // For special questions (resp_*), use resp_*_1, resp_*_2 format
    // For normal questions (q*), use q*_1, q*_2 format
    const getOptionCodeFromTemplate = (questionCode, optionIndex, option, questionNumber) => {
      // Check for "Others" option first
      const optText = typeof option === 'object' ? getMainText(option.text || '') : getMainText(String(option));
      if (isOthersOption(optText)) {
        // Use template codes for "Others"
        // Special questions use resp_*_oth format
        if (questionCode.startsWith('resp_') || questionCode === 'thanks_future') {
          return `${questionCode}_oth`;
        }
        // Normal questions use q*_oth format
        return `${questionCode}_oth`;
      }
      
      // Generate code based on question code and option index
      // Always use questionCode_<index+1> format, never use option.code if it's just a number
      const optionNum = optionIndex + 1; // Convert 0-based to 1-based
      
      // For special questions (resp_*), use resp_*_1, resp_*_2, etc.
      if (questionCode.startsWith('resp_') || questionCode === 'thanks_future') {
        return `${questionCode}_${optionNum}`;
      }
      
      // For normal questions (q*), use q*_1, q*_2, etc.
      // This includes Q4, Q10, Q11, Q12, Q13, etc.
      return `${questionCode}_${optionNum}`;
    };

    // Build headers with two rows: titles and codes
    // Row 1: Full titles (without translations)
    // Row 2: Column codes
    
    // Start with metadata columns (common for both CAPI and CATI)
    const metadataTitleRow = [];
    const metadataCodeRow = [];
    
    // Serial Number (yellow)
    metadataTitleRow.push('Serial Number');
    metadataCodeRow.push('serial_no');
    
    // Response ID
    metadataTitleRow.push('Response ID');
    metadataCodeRow.push('');
    
    // Interview Mode
    metadataTitleRow.push('Interview Mode');
    metadataCodeRow.push('');
    
    // Interviewer Name
    metadataTitleRow.push('Interviewer Name');
    metadataCodeRow.push('int_name');
    
    // Interviewer ID (yellow)
    metadataTitleRow.push('Interviewer ID');
    metadataCodeRow.push('int_id');
    
    // Interviewer Email
    metadataTitleRow.push('Interviewer Email');
    metadataCodeRow.push('');
    
    // Supervisor Name (yellow) - can be empty
    metadataTitleRow.push('Supervisor Name');
    metadataCodeRow.push('sup_name');
    
    // Supervisor ID (yellow) - can be empty
    metadataTitleRow.push('Supervisor ID');
    metadataCodeRow.push('sup_id');
    
    // Response Date
    metadataTitleRow.push('Response Date');
    metadataCodeRow.push('survey_date');
    
    // Status
    metadataTitleRow.push('Status');
    metadataCodeRow.push('Status');
    
    // Assembly Constituency code (yellow)
    metadataTitleRow.push('Assembly Constituency code');
    metadataCodeRow.push('ac_code');
    
    // Assembly Constituency (AC)
    metadataTitleRow.push('Assembly Constituency (AC)');
    metadataCodeRow.push('ac_name');
    
    // Parliamentary Constituency Code (yellow)
    metadataTitleRow.push('Parliamentary Constituency Code');
    metadataCodeRow.push('pc_code');
    
    // Parliamentary Constituency (PC)
    metadataTitleRow.push('Parliamentary Constituency (PC)');
    metadataCodeRow.push('pc_name');
    
    // District Code (yellow)
    metadataTitleRow.push('District Code');
    metadataCodeRow.push('district_code');
    
    // District
    metadataTitleRow.push('District');
    metadataCodeRow.push('district_code');
    
    // Region Code (yellow) - can be empty if not available
    metadataTitleRow.push('Region Code');
    metadataCodeRow.push('region_code');
    
    // Region Name (yellow) - can be empty if not available
    metadataTitleRow.push('Region Name');
    metadataCodeRow.push('region_name');
    
    // Polling Station Code
    metadataTitleRow.push('Polling Station Code');
    metadataCodeRow.push('rt_polling_station_no');
    
    // Polling Station Name
    metadataTitleRow.push('Polling Station Name');
    metadataCodeRow.push('rt_polling_station_name');
    
    // GPS Coordinates
    metadataTitleRow.push('GPS Coordinates');
    metadataCodeRow.push('rt_gps_coordinates');
    
    // Call ID (for CATI)
    metadataTitleRow.push('Call ID');
    metadataCodeRow.push('');

    // Build question headers with multi-select handling
    const questionTitleRow = [];
    const questionCodeRow = [];
    const questionMultiSelectMap = new Map(); // Map question index to {isMultiSelect: bool, options: []}
    const questionOthersMap = new Map(); // Map question index to whether it has "Others"
    
    regularQuestions.forEach((question, index) => {
      const questionText = question.text || question.questionText || `Question ${index + 1}`;
      const mainQuestionText = getMainText(questionText);
      
      // Use sequential question number based on position in the sorted array
      // This ensures each question gets a unique number (Q1, Q2, Q3, etc.)
      // The array is already sorted by order, so index+1 gives us the correct sequence
      const questionNumber = index + 1;
      
      // Get question code from template mapping (uses questionNumber for normal questions)
      const questionCode = getQuestionCodeFromTemplate(question, questionNumber);
      
      // Add main question column
      questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText}`);
      questionCodeRow.push(questionCode);
      
      // Check if this is a multi-select question
      // ONLY multi-select questions should have option columns (Yes/No for each option)
      // Single-select questions should show the response/response code in the main column only
      // Must check both: question type AND settings.allowMultiple flag
      const isMultiSelect = (question.type === 'multiple_choice' || question.type === 'multi_select') 
        && question.settings?.allowMultiple === true 
        && question.options 
        && question.options.length > 0;
      // Check for "Others" option - be more thorough in detection
      const hasOthersOption = question.options && question.options.some(opt => {
        const optText = typeof opt === 'object' ? (opt.text || opt.label || opt.value) : opt;
        const optTextStr = String(optText || '').toLowerCase().trim();
        // Check for various "Others" patterns
        return isOthersOption(optTextStr) || 
               (optTextStr.includes('other') && (optTextStr.includes('specify') || optTextStr.includes('please')));
      });
      
      // Check for "Independent" option (for Q5, Q6, Q7, Q8, Q9)
      const hasIndependentOption = question.options && question.options.some(opt => {
        const optText = typeof opt === 'object' ? opt.text : opt;
        const optLower = String(optText).toLowerCase();
        return optLower.includes('independent') && !optLower.includes('other');
      });
      
      questionOthersMap.set(index, hasOthersOption);
      
      if (isMultiSelect) {
        // Separate "Others" option from regular options
        const regularOptions = [];
        let othersOption = null;
        let othersOptionIndex = -1;
        
        question.options.forEach((option, optIndex) => {
          const optText = typeof option === 'object' ? option.text : option;
          const optTextStr = String(optText || '').trim();
          // Check if this is "Others" option - be more thorough in detection
          if (isOthersOption(optTextStr) || optTextStr.toLowerCase().includes('other') && (optTextStr.toLowerCase().includes('specify') || optTextStr.toLowerCase().includes('please'))) {
            othersOption = option;
            othersOptionIndex = optIndex;
            // Don't add to regularOptions - it will be handled separately as a text column
          } else {
            // Only add to regularOptions if it's NOT "Others"
            regularOptions.push(option);
          }
        });
        
        // Store multi-select info (excluding "Others" from options array)
        questionMultiSelectMap.set(index, {
          isMultiSelect: true,
          options: regularOptions, // Exclude "Others" from regular options
          othersOption: othersOption, // Store "Others" separately
          othersOptionIndex: othersOptionIndex,
          questionText: mainQuestionText,
          questionNumber,
          questionCode
        });
        
        // For multi-select: Add columns for each REGULAR option with Yes/No (excluding "Others")
        // Need to use original index from question.options array for correct code generation
        // Track the sequential index for regular options (excluding "Others")
        let regularOptionIndex = 0;
        regularOptions.forEach((option) => {
          const optText = typeof option === 'object' ? option.text : option;
          const optMainText = getMainText(optText);
          
          // Use sequential index for regular options (0, 1, 2, ...) which will become _1, _2, _3, etc.
          // This ensures q2_1, q2_2, q2_3, etc. even if "Others" was in the middle
          const optCode = getOptionCodeFromTemplate(questionCode, regularOptionIndex, option, questionNumber);
          regularOptionIndex++; // Increment for next regular option
          
          questionTitleRow.push(`Q${questionNumber}. ${mainQuestionText} - ${optMainText}`);
          questionCodeRow.push(optCode);
        });
        
        // Add "Others" column if it exists (as a text column, not Yes/No)
        // Always add if hasOthersOption is true (don't require othersOption to be found)
        if (hasOthersOption) {
          questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
          // Use template code for "Others"
          // Special questions: resp_*_oth, Normal questions: q*_oth
          const othersCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
            ? `${questionCode}_oth`
            : `${questionCode}_oth`;
          questionCodeRow.push(othersCode);
        }
      } else {
        // Single choice question - check for "Others" and "Independent" options
        if (hasOthersOption) {
          questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Others (Specify)`);
          // Use template codes for "Others"
          // Special questions: resp_*_oth, Normal questions: q*_oth
          const othersCode = questionCode.startsWith('resp_') || questionCode === 'thanks_future'
            ? `${questionCode}_oth`
            : `${questionCode}_oth`;
          questionCodeRow.push(othersCode);
        }
        
        // Add "Independent" column for Q5, Q6, Q7, Q8, Q9 (normal questions)
        if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
          questionTitleRow.push(`Q${questionNumber}: ${mainQuestionText} - Independent (Please specify)`);
          const indCode = `${questionCode}_ind`;
          questionCodeRow.push(indCode);
        }
      }
    });
    
    // Combine metadata and question headers first (Status, QC, and Rejection columns will be added at the end)
    const allTitleRow = [...metadataTitleRow, ...questionTitleRow];
    const allCodeRow = [...metadataCodeRow, ...questionCodeRow];
    
    // Add Status, QC, and Rejection columns at the VERY END in this order:
    // 1. Status
    allTitleRow.push('Status (0= terminated, 10=valid, 20=rejected, 40=under qc)');
    allCodeRow.push('status_code');
    
    // 2. Qc Completion date
    allTitleRow.push('Qc Completion date');
    allCodeRow.push('qc_completion_date');
    
    // 3. Assigned to QC
    allTitleRow.push('Assigned to QC ( 1 can mean those whih are assigned to audio qc and 2 can mean those which are not yet assigned)');
    allCodeRow.push('assigned_to_qc');
    
    // 4. Reason for rejection (LAST column)
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

    // Use the helper function defined above for extracting polling station code and name
    // This will properly handle format "59 - Kandaya Prathamik Bidyalay"

    // Helper function to check if a value matches an option
    // Handles translation formats like "yes_{হ্যাঁ।{हाँ}}" by comparing main text
    const optionMatches = (option, value) => {
      if (!option || value === null || value === undefined) return false;
      const optValue = typeof option === 'object' ? (option.value || option.text) : option;
      
      // Direct match first (fastest)
      if (optValue === value || String(optValue) === String(value)) {
        return true;
      }
      
      // If direct match fails, try matching main text (handles translation formats)
      // Extract main text from both values to handle cases like:
      // - responseValue: "yes_{হ্যাঁ।{हाँ}}" vs option.value: "yes"
      // - responseValue: "yes" vs option.value: "yes_{হ্যাঁ।{हाँ}}"
      const optMainText = getMainText(String(optValue));
      const valueMainText = getMainText(String(value));
      
      // Match if main texts are equal
      if (optMainText && valueMainText && optMainText === valueMainText) {
        return true;
      }
      
      // Also check if option.code matches the value (for numeric codes)
      if (typeof option === 'object' && option.code !== null && option.code !== undefined) {
        const optCode = String(option.code);
        const valueStr = String(value);
        if (optCode === valueStr || optCode === valueMainText) {
          return true;
        }
      }
      
      return false;
    };

    // Pre-fetch all polling station data for unique AC codes to avoid multiple API calls
    const uniqueACCodes = new Set();
    filteredResponses.forEach(response => {
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

    // Create CSV data rows
    const csvData = filteredResponses.map((response, rowIndex) => {
      // Extract AC and polling station from responses
      const { ac: acFromResponse, pollingStation: pollingStationFromResponse } = getACAndPollingStationFromResponses(response.responses);
      
      // Helper function to replace N/A with empty string
      const cleanValue = (value) => {
        if (value === 'N/A' || value === null || value === undefined) return '';
        return value;
      };
      
      // Get AC, PC, and District
      const displayACRaw = acFromResponse || response.selectedPollingStation?.acName || response.selectedAC || '';
      const displayAC = displayACRaw || '';
      
      // Get PC
      let displayPC = response.selectedPollingStation?.pcName || '';
      if (!displayPC && displayAC) {
        const pcFromAC = getLokSabhaFromAC(displayAC);
        displayPC = cleanValue(pcFromAC) || '';
      }
      
      // Get District
      let displayDistrict = response.selectedPollingStation?.district || '';
      if (!displayDistrict && displayAC) {
        const districtFromAC = getDistrictFromAC(displayAC);
        displayDistrict = cleanValue(districtFromAC) || '';
      }
      
      // Get AC code (numeric only, remove alphabets and leading zeros)
      const acCodeRaw = getACCodeFromAC(displayAC);
      const acCode = cleanValue(acCodeRaw) || '';
      
      // Get PC code from polling_stations.json using the polling station
      // Extract polling station code and name first (will be cleaned later)
      const pollingStationValue = pollingStationFromResponse || response.selectedPollingStation?.stationName;
      
      // Get PC code, district code, and region from polling_stations.json using AC code
      let pcCode = '';
      let districtCode = '';
      let regionCode = '';
      let regionName = '';
      
      if (acCode && acCode !== '') {
        // Get data from cached polling station data (from AC code)
        const pollingData = pollingDataMap.get(acCode);
        if (pollingData) {
          // PC code comes from the AC's pc_no in polling_stations.json
          pcCode = cleanValue(pollingData.pcCode) || '';
          districtCode = cleanValue(pollingData.districtCode) || '';
          regionCode = cleanValue(pollingData.regionCode) || '';
          regionName = cleanValue(pollingData.regionName) || '';
        }
      }
      
      // Polling station code and name already extracted above
      const { stationCode: stationCodeRaw, stationName: stationNameRaw } = extractPollingStationCodeAndName(pollingStationValue);
      const stationCode = cleanValue(stationCodeRaw) || '';
      const stationName = cleanValue(stationNameRaw) || '';
      
      // Format response date
      const responseDate = new Date(response.createdAt || response.endTime || response.createdAt);
      const formattedDate = responseDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Build metadata row (matching the header order) - all N/A values replaced with empty strings
      const metadata = [
        rowIndex + 1, // Serial Number
        cleanValue(response.responseId || response._id?.slice(-8)), // Response ID
        cleanValue(response.interviewMode?.toUpperCase()), // Interview Mode
        cleanValue(response.interviewer ? `${response.interviewer.firstName || ''} ${response.interviewer.lastName || ''}`.trim() : null), // Interviewer Name
        response.interviewer?.memberId || response.interviewer?.memberID || '', // Interviewer ID
        cleanValue(response.interviewer?.email), // Interviewer Email
        '', // Supervisor Name (can be empty)
        '', // Supervisor ID (can be empty)
        formattedDate, // Response Date
        cleanValue(response.status), // Status
        cleanValue(acCode), // Assembly Constituency code
        cleanValue(displayAC), // Assembly Constituency (AC)
        cleanValue(pcCode), // Parliamentary Constituency Code
        cleanValue(displayPC), // Parliamentary Constituency (PC)
        cleanValue(districtCode), // District Code
        cleanValue(displayDistrict), // District
        cleanValue(regionCode), // Region Code
        cleanValue(regionName), // Region Name
        cleanValue(stationCode), // Polling Station Code
        cleanValue(stationName), // Polling Station Name
        response.location ? `(${response.location.latitude?.toFixed(4)}, ${response.location.longitude?.toFixed(4)})` : '', // GPS Coordinates
        response.call_id || '' // Call ID
      ];

      // Extract answers for each question in the survey
      const answers = [];
      
      regularQuestions.forEach((surveyQuestion, questionIndex) => {
        // Try to find matching answer by questionId first
        let matchingAnswer = null;
        
        if (surveyQuestion.id) {
          matchingAnswer = response.responses?.find(r => 
            r.questionId === surveyQuestion.id
          );
        }
        
        // If not found by ID, try by questionText
        if (!matchingAnswer && surveyQuestion.text) {
          matchingAnswer = response.responses?.find(r => {
            const rText = getMainText(r.questionText || '');
            const sText = getMainText(surveyQuestion.text || surveyQuestion.questionText || '');
            return rText === sText || r.questionText === surveyQuestion.text || r.questionText === surveyQuestion.questionText;
          });
        }
        
        const multiSelectInfo = questionMultiSelectMap.get(questionIndex);
        const hasOthersOption = questionOthersMap.get(questionIndex);
        
        if (multiSelectInfo && multiSelectInfo.isMultiSelect) {
          // Multi-select question: Show selections first, then Yes/No for each option
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
          
          // Check if "Others" is selected and extract the text after "Others: "
          let isOthersSelected = false;
          selectedValues.forEach(val => {
            const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
            // Check if this value represents "Others" option
            const isOthers = surveyQuestion.options.some(opt => {
              const optText = typeof opt === 'object' ? opt.text : opt;
              return isOthersOption(optText) && optionMatches(opt, val);
            }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
            
            if (isOthers) {
              isOthersSelected = true;
              // Extract text after "Others: " (e.g., "Others: CPM" -> "CPM")
              if (valStr.startsWith('Others: ')) {
                othersText = valStr.substring(8).trim(); // Remove "Others: " prefix
              } else {
                // Try to extract from the value object if it has text property
                const othersTextValue = extractOthersText(val);
                if (othersTextValue) {
                  othersText = othersTextValue;
                }
              }
            }
          });
          
          // Format selected values for the main column
          // If "Others" is selected, show "44" (coded) or "Others" (text) in main column
          // The actual "Others" text goes in the Others (Specify) column
          let mainResponse = '';
          if (selectedValues.length > 0) {
            if (downloadMode === 'codes') {
              // In coded mode: show "44" for Others, codes for other options
              mainResponse = selectedValues.map(val => {
                const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                // Check if this is "Others"
                const isOthers = surveyQuestion.options.some(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return isOthersOption(optText) && optionMatches(opt, val);
                }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
                
                if (isOthers) {
                  return '44'; // Code for "Others"
                }
                // Try to find matching option using improved matching (handles translation formats)
                let option = surveyQuestion.options.find(opt => optionMatches(opt, val));
                
                // If not found with direct matching, try matching by main text
                if (!option) {
                  const valMainText = getMainText(String(val));
                  option = surveyQuestion.options.find(opt => {
                    const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                    const optMainText = getMainText(String(optValue));
                    return optMainText === valMainText && valMainText !== '';
                  });
                }
                
                if (option) {
                  // Priority: 1. option.code (numeric code), 2. getMainText(option.value) to remove translations, 3. getMainText(val)
                  if (option.code !== null && option.code !== undefined && option.code !== '') {
                    return String(option.code);
                  } else if (option.value) {
                    const mainValue = getMainText(String(option.value));
                    // If mainValue is just text like "yes", try to find option by main text to get code
                    if (!/^\d+$/.test(mainValue)) {
                      // Not a numeric code, try to find option by main text to get its code
                      const matchingOpt = surveyQuestion.options.find(opt => {
                        const optMainText = getMainText(String(opt.value || opt.text || ''));
                        return optMainText === mainValue;
                      });
                      if (matchingOpt && matchingOpt.code) {
                        return String(matchingOpt.code);
                      } else {
                        return mainValue;
                      }
                    } else {
                      return mainValue;
                    }
                  } else {
                    const mainValue = getMainText(String(val));
                    return mainValue || String(val);
                  }
                }
                // Option not found even after main text matching, extract main text from val to remove translations
                const mainValue = getMainText(String(val));
                return mainValue || String(val);
              }).join(', ');
            } else {
              // In text mode: show "Others" if selected, exclude Others text from main
              const filteredValues = selectedValues.filter(val => {
                const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
                const isOthers = surveyQuestion.options.some(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return isOthersOption(optText) && optionMatches(opt, val);
                }) || valStr.startsWith('Others: ') || isOthersOption(valStr);
                return !isOthers; // Exclude "Others" from main display
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
            // Return empty string for skipped responses instead of "Skipped"
            mainResponse = '';
          } else {
            mainResponse = '';
          }
          
          // Add main response column
          answers.push(mainResponse);
          
          // Add Yes/No columns for each REGULAR option (excluding "Others")
          // The options are in the same order as in the headers (regularOptions only)
          // Make sure we're not including "Others" in the Yes/No columns
          multiSelectInfo.options.forEach((option, optIndex) => {
            const optText = typeof option === 'object' ? option.text : option;
            // Double-check: skip if this is "Others" option (shouldn't happen, but safety check)
            if (isOthersOption(optText)) {
              // This shouldn't happen since we filtered it out, but if it does, skip it
              return;
            }
            const optValue = typeof option === 'object' ? (option.value || option.text) : option;
            const isSelected = selectedValues.some(val => {
              // Make sure we're not matching "Others" values
              const valStr = typeof val === 'object' ? String(val.text || val.value || val) : String(val);
              if (valStr.startsWith('Others: ') || isOthersOption(valStr)) {
                return false; // Don't match "Others" values
              }
              return optionMatches(option, val);
            });
            // In codes mode: use "1" for Yes, "0" for No
            // In text mode: use "Yes" for Yes, "No" for No
            if (downloadMode === 'codes') {
              answers.push(isSelected ? '1' : '0');
            } else {
              answers.push(isSelected ? 'Yes' : 'No');
            }
          });
          
          // Add "Others" text column if it exists (shows text, not Yes/No)
          // This should always be a text column showing the specified text
          if (hasOthersOption) {
            // Make sure we're pushing the text, not Yes/No
            answers.push(othersText || '');
          }
        } else {
          // Single choice or other question types
          let questionResponse = '';
          let othersText = '';
          
          if (matchingAnswer) {
            if (matchingAnswer.isSkipped) {
              // Return empty string for skipped responses instead of "Skipped"
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
                // Check if response is "Others"
                const responseStr = String(responseValue);
                const isOthersResponse = responseStr.startsWith('Others: ') || 
                  (hasOthersOption && surveyQuestion.options && surveyQuestion.options.some(opt => {
                    const optText = typeof opt === 'object' ? opt.text : opt;
                    return isOthersOption(optText) && optionMatches(opt, responseValue);
                  }));
                
                if (isOthersResponse) {
                  // Extract text after "Others: " for the Others column
                  if (responseStr.startsWith('Others: ')) {
                    othersText = responseStr.substring(8).trim(); // Remove "Others: " prefix
                  } else {
                    const othersTextValue = extractOthersText(responseValue);
                    if (othersTextValue) {
                      othersText = othersTextValue;
                    }
                  }
                  
                  // Main column shows "44" (coded) or "Others" (text)
                  if (downloadMode === 'codes') {
                    questionResponse = '44'; // Code for "Others"
                  } else {
                    questionResponse = 'Others';
                  }
                } else {
                  // Not "Others" - show normal response
                  if (downloadMode === 'codes' && surveyQuestion.options) {
                    // Try to find matching option using improved matching (handles translation formats)
                    let option = surveyQuestion.options.find(opt => optionMatches(opt, responseValue));
                    
                    // If not found with direct matching, try matching by main text
                    if (!option) {
                      const responseMainText = getMainText(String(responseValue));
                      option = surveyQuestion.options.find(opt => {
                        const optValue = typeof opt === 'object' ? (opt.value || opt.text) : opt;
                        const optMainText = getMainText(String(optValue));
                        return optMainText === responseMainText && responseMainText !== '';
                      });
                    }
                    
                    if (option) {
                      // Priority: 1. option.code (numeric code), 2. getMainText(option.value) to remove translations, 3. getMainText(responseValue)
                      if (option.code !== null && option.code !== undefined && option.code !== '') {
                        // Use the code directly (should be numeric)
                        questionResponse = String(option.code);
                      } else if (option.value) {
                        // Extract main text from option.value to remove translation format like "yes_{হ্যাঁ।{हाँ}}"
                        const mainValue = getMainText(String(option.value));
                        // If mainValue is just text like "yes", try to find option by main text to get code
                        if (!/^\d+$/.test(mainValue)) {
                          // Not a numeric code, try to find option by main text to get its code
                          const matchingOpt = surveyQuestion.options.find(opt => {
                            const optMainText = getMainText(String(opt.value || opt.text || ''));
                            return optMainText === mainValue;
                          });
                          if (matchingOpt && matchingOpt.code) {
                            questionResponse = String(matchingOpt.code);
                          } else {
                            questionResponse = mainValue;
                          }
                        } else {
                          questionResponse = mainValue;
                        }
                      } else {
                        // Fallback: extract main text from responseValue
                        const mainValue = getMainText(String(responseValue));
                        questionResponse = mainValue || String(responseValue);
                      }
                    } else {
                      // Option not found even after main text matching
                      // Extract main text from responseValue to remove translations
                      const mainValue = getMainText(String(responseValue));
                      questionResponse = mainValue || String(responseValue);
                    }
                  } else {
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
          
          // Get question code to check if it needs Independent column
          // Use the same questionNumber logic as in header generation (index + 1 from sorted array)
          // This ensures consistency between headers and data rows
          const questionNumber = questionIndex + 1;
          const questionCode = getQuestionCodeFromTemplate(surveyQuestion, questionNumber);
          const hasIndependentOption = surveyQuestion.options && surveyQuestion.options.some(opt => {
            const optText = typeof opt === 'object' ? opt.text : opt;
            const optLower = String(optText).toLowerCase();
            return optLower.includes('independent') && !optLower.includes('other');
          });
          
          // Add question response
          answers.push(questionResponse);
          
          // Add "Others" text column if this question has "Others" option
          if (hasOthersOption) {
            answers.push(othersText || '');
          }
          
          // Add "Independent" text column for Q5, Q6, Q7, Q8, Q9
          if (hasIndependentOption && ['q5', 'q6', 'q7', 'q8', 'q9'].includes(questionCode)) {
            // Check if response is "Independent"
            let independentText = '';
            if (matchingAnswer && matchingAnswer.response) {
              const responseValue = matchingAnswer.response;
              const responseStr = String(responseValue).toLowerCase();
              if (responseStr.includes('independent') || 
                  surveyQuestion.options.some(opt => {
                    const optText = typeof opt === 'object' ? opt.text : opt;
                    const optLower = String(optText).toLowerCase();
                    return optLower.includes('independent') && optionMatches(opt, responseValue);
                  })) {
                // Extract "Independent" text if it has additional text
                const independentOpt = surveyQuestion.options.find(opt => {
                  const optText = typeof opt === 'object' ? opt.text : opt;
                  return String(optText).toLowerCase().includes('independent');
                });
                if (independentOpt && typeof independentOpt === 'object' && independentOpt.text) {
                  const independentTextValue = extractOthersText(responseValue);
                  independentText = independentTextValue || '';
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
      
      // Determine "Assigned to QC" based on batch status (same logic as reports page)
      // 1 = Under QC Queue (sent to QC Queue to be checked)
      //    - Batches with status 'queued_for_qc'
      //    - Sample responses in batches with status 'qc_in_progress' or 'completed'
      //    - Remaining responses where remainingDecision is 'queued_for_qc'
      // 2 = Processing in Batch (in batch collecting state, not yet sent to final QC)
      //    - Batches with status 'collecting'
      //    - Batches with status 'processing' (non-sample responses)
      // Empty = QC completed (Approved or Rejected)
      let assignedToQC = '';
      
      if (response.status === 'Approved' || response.status === 'Rejected') {
        // QC completed - leave empty
        assignedToQC = '';
      } else if (response.status === 'Pending_Approval') {
        // Check if response has batch information
        const qcBatch = response.qcBatch;
        const isSampleResponse = response.isSampleResponse || false;
        
        if (qcBatch) {
          // Get batch status (could be object with status or just ID)
          let batchStatus = null;
          let remainingDecision = null;
          
          if (typeof qcBatch === 'object' && qcBatch.status) {
            batchStatus = qcBatch.status;
            remainingDecision = qcBatch.remainingDecision?.decision;
          } else if (response.qcBatchStatus) {
            // If batch status is stored separately
            batchStatus = response.qcBatchStatus;
            remainingDecision = response.qcBatchRemainingDecision;
          }
          
          if (batchStatus) {
            // "Under QC Queue": Batches completed and sent to review
            if (batchStatus === 'queued_for_qc' ||
                (isSampleResponse && (batchStatus === 'qc_in_progress' || batchStatus === 'completed')) ||
                (!isSampleResponse && remainingDecision === 'queued_for_qc')) {
              assignedToQC = '1';
            }
            // "Processing in Batch": Responses still in collecting phase
            else if (batchStatus === 'collecting' ||
                     (batchStatus === 'processing' && !isSampleResponse)) {
              assignedToQC = '2';
            }
            // Default to processing in batch for other statuses
            else {
              assignedToQC = '2';
            }
          } else {
            // Has batch but no status - assume processing in batch
            assignedToQC = '2';
          }
        } else {
          // No batch - processing in batch (collecting state)
          assignedToQC = '2';
        }
      }
      
      // Get rejection reason code (will be added as last column)
      const rejectionReasonCode = getRejectionReasonCode(response);
      
      // Return metadata, answers, and then Status/QC/Rejection columns at the end in this order:
      // 1. Status
      // 2. QC Completion date
      // 3. Assigned to QC
      // 4. Reason for rejection (LAST)
      return [...metadata, ...answers, statusCode, qcCompletionDate, assignedToQC, rejectionReasonCode];
    });

    // Create CSV with two-row headers
    const csvRows = [];
    
    // Add title row (row 1)
    csvRows.push(allTitleRow);
    
    // Add code row (row 2)
    csvRows.push(allCodeRow);
    
    // Add data rows
    csvRows.push(...csvData);

    const csvContent = csvRows
      .map(row => row.map(field => {
        const fieldStr = String(field || '');
        // Escape quotes and wrap in quotes
        return `"${fieldStr.replace(/"/g, '""')}"`;
      }).join(','))
      .join('\n');

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
    
    showSuccess('CSV downloaded successfully');
  };

  // Handle view response details
  const handleViewResponse = (response) => {
    setSelectedResponse(response);
    setShowResponseDetails(true);
  };

  // Modern Filter Loading Overlay Component
  const FilterLoadingOverlay = () => {
    if (!filterLoading) return null;
    
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center pointer-events-none transition-opacity duration-200">
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center space-y-4 pointer-events-auto animate-[fadeIn_0.2s_ease-in-out]">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-[#001D48]/20 border-t-[#001D48] rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#001D48] animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900">Applying filters...</p>
            <p className="text-xs text-gray-500 mt-1">Please wait while we update the responses</p>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  };

  if (loading) {
    return <ResponsesLoadingScreen />;
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Survey Not Found</h2>
          <button
            onClick={() => navigate(isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys')}
            className="px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <FilterLoadingOverlay />
      <div className="min-h-screen bg-gray-50 w-full view-responses-page">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <button
                  onClick={() => navigate(backPath)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline">Back to Surveys</span>
                </button>
                <div className="h-6 w-px bg-gray-300 flex-shrink-0 hidden sm:block"></div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    {survey.title}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {filteredResponses.length} responses
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                </button>
                
                {!isProjectManagerRoute && (
                  <button
                    onClick={handleCSVDownload}
                    className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download CSV</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border-b border-gray-200 w-full">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Approved + Rejected</option>
                    <option value="approved_rejected_pending">Approved + Rejected + Pending</option>
                    <option value="approved_pending">Approved + Pending</option>
                    <option value="pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => {
                      handleFilterChange('dateRange', e.target.value);
                      // Clear custom dates when switching away from custom
                      if (e.target.value !== 'custom') {
                        handleFilterChange('startDate', '');
                        handleFilterChange('endDate', '');
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                  
                  {/* Custom Date Range Picker */}
                  {filters.dateRange === 'custom' && (
                    <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-[#373177]" />
                        <span className="text-sm font-semibold text-gray-700">Select Date Range</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div className="relative">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            From Date
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                            <DatePicker
                              selected={filters.startDate ? new Date(filters.startDate) : null}
                              onChange={(date) => {
                                if (date) {
                                  const dateStr = date.toISOString().split('T')[0];
                                  handleFilterChange('startDate', dateStr);
                                } else {
                                  handleFilterChange('startDate', '');
                                }
                              }}
                              selectsStart
                              startDate={filters.startDate ? new Date(filters.startDate) : null}
                              endDate={filters.endDate ? new Date(filters.endDate) : null}
                              maxDate={filters.endDate ? new Date(filters.endDate) : new Date()}
                              dateFormat="MMM dd, yyyy"
                              placeholderText="Select start date"
                              className="w-full pl-8 pr-10 py-2.5 bg-white border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-blue-400"
                              showPopperArrow={false}
                              popperClassName="react-datepicker-popper"
                              calendarClassName="custom-calendar"
                              isClearable
                              clearButtonClassName="text-gray-400 hover:text-red-500 transition-colors"
                            />
                          </div>
                          {filters.startDate && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              {new Date(filters.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>

                        {/* End Date */}
                        <div className="relative">
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            To Date
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                            <DatePicker
                              selected={filters.endDate ? new Date(filters.endDate) : null}
                              onChange={(date) => {
                                if (date) {
                                  const dateStr = date.toISOString().split('T')[0];
                                  handleFilterChange('endDate', dateStr);
                                } else {
                                  handleFilterChange('endDate', '');
                                }
                              }}
                              selectsEnd
                              startDate={filters.startDate ? new Date(filters.startDate) : null}
                              endDate={filters.endDate ? new Date(filters.endDate) : null}
                              minDate={filters.startDate ? new Date(filters.startDate) : null}
                              maxDate={new Date()}
                              dateFormat="MMM dd, yyyy"
                              placeholderText="Select end date"
                              className="w-full pl-8 pr-10 py-2.5 bg-white border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-blue-400"
                              showPopperArrow={false}
                              popperClassName="react-datepicker-popper"
                              calendarClassName="custom-calendar"
                              isClearable
                              clearButtonClassName="text-gray-400 hover:text-red-500 transition-colors"
                            />
                          </div>
                          {filters.endDate && (
                            <p className="mt-1.5 text-xs text-gray-500">
                              {new Date(filters.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Date Range Summary */}
                      {filters.startDate && filters.endDate && (
                        <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#E6F0F8]0"></div>
                            <span className="text-sm font-medium text-gray-700">
                              {new Date(filters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(filters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              handleFilterChange('startDate', '');
                              handleFilterChange('endDate', '');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Clear Range
                          </button>
                        </div>
                      )}

                      {/* Helper Text */}
                      {(!filters.startDate || !filters.endDate) && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {!filters.startDate && !filters.endDate 
                              ? 'Select both start and end dates to filter responses'
                              : !filters.startDate 
                                ? 'Please select a start date'
                                : 'Please select an end date'
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Interview Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interview Mode</label>
                  <select
                    value={filters.interviewMode}
                    onChange={(e) => handleFilterChange('interviewMode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Modes</option>
                    {(getFilterOptions?.interviewMode || []).map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>

                {/* Assembly Constituency - Modern Searchable Dropdown */}
                <div className="relative" ref={acDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assembly Constituency
                    {filters.ac && (
                      <span className="text-xs font-normal text-gray-500 ml-1">
                        (AC: {allACObjects.find(ac => ac.name === filters.ac)?.numericCode || ''})
                      </span>
                    )}
                  </label>
                  
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={filters.ac ? filters.ac : "Search by AC name or code..."}
                      value={filters.ac ? filters.ac : acSearchTerm}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAcSearchTerm(value);
                        setShowACDropdown(true);
                        handleFilterChange('ac', ''); // Clear selection when typing
                      }}
                      onFocus={() => {
                        setShowACDropdown(true);
                        if (filters.ac) {
                          setAcSearchTerm(filters.ac);
                          handleFilterChange('ac', '');
                        }
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {filters.ac && (
                      <button
                        onClick={() => {
                          handleFilterChange('ac', '');
                          setAcSearchTerm('');
                          setShowACDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {showACDropdown && filteredACs.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredACs.map(ac => {
                        const isSelected = filters.ac === ac.name;
                        return (
                          <div
                            key={ac.name}
                            onClick={() => {
                              handleFilterChange('ac', ac.name);
                              setAcSearchTerm('');
                              setShowACDropdown(false);
                            }}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                              isSelected ? 'bg-[#E6F0F8]' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{ac.name}</div>
                                {ac.numericCode && (
                                  <div className="text-xs text-gray-500">AC Code: {ac.numericCode}</div>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle className="w-5 h-5 text-[#373177]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showACDropdown && acSearchTerm && filteredACs.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                      No ACs found matching "{acSearchTerm}"
                    </div>
                  )}
                </div>

                {/* Interviewer - Modern Multi-Select Search */}
                <div className="relative" ref={interviewerDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interviewer {filters.interviewerIds?.length > 0 && `(${filters.interviewerIds.length} selected)`}
                  </label>
                  
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by name, email, phone, or Member ID..."
                      value={interviewerSearchTerm}
                      onChange={(e) => {
                        setInterviewerSearchTerm(e.target.value);
                        setShowInterviewerDropdown(true);
                      }}
                      onFocus={() => setShowInterviewerDropdown(true)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {filters.interviewerIds?.length > 0 && (
                      <button
                        onClick={clearInterviewerFilters}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        title="Clear all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Include/Exclude Toggle */}
                  {filters.interviewerIds?.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleInterviewerModeToggle('include')}
                        className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          filters.interviewerMode === 'include'
                            ? 'bg-[#001D48] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Include
                      </button>
                      <button
                        onClick={() => handleInterviewerModeToggle('exclude')}
                        className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          filters.interviewerMode === 'exclude'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Exclude
                      </button>
                    </div>
                  )}

                  {/* Selected Interviewers Chips */}
                  {filters.interviewerIds?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {filters.interviewerIds.map(interviewerId => {
                        const interviewer = allInterviewerObjects.find(i => i._id === interviewerId);
                        if (!interviewer) return null;
                        return (
                          <span
                            key={interviewerId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#E6F0F8] text-blue-800 text-xs rounded-full"
                          >
                            {interviewer.name}
                            <button
                              onClick={() => handleInterviewerToggle(interviewerId)}
                              className="hover:text-[#373177]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {showInterviewerDropdown && filteredInterviewers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredInterviewers.map(interviewer => {
                        const isSelected = filters.interviewerIds?.includes(interviewer._id);
                        return (
                          <div
                            key={interviewer._id}
                            onClick={() => {
                              handleInterviewerToggle(interviewer._id);
                            }}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                              isSelected ? 'bg-[#E6F0F8]' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{interviewer.name}</div>
                                <div className="text-xs text-gray-500 space-x-2">
                                  {interviewer.email && <span>{interviewer.email}</span>}
                                  {interviewer.phone && <span>• {interviewer.phone}</span>}
                                  {interviewer.memberID && <span>• Member ID: {interviewer.memberID}</span>}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle className="w-5 h-5 text-[#373177]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showInterviewerDropdown && interviewerSearchTerm && filteredInterviewers.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                      No interviewers found matching "{interviewerSearchTerm}"
                    </div>
                  )}
                </div>

                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      placeholder="Search by name, interviewer, or Response ID..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={filters.gender}
                    onChange={(e) => handleFilterChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Genders</option>
                    {(getFilterOptions?.gender || []).map(gender => (
                      <option key={gender} value={gender}>{gender}</option>
                    ))}
                  </select>
                </div>

                {/* Age Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age Range
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={filters.ageMin}
                      onChange={(e) => handleFilterChange('ageMin', e.target.value)}
                      placeholder="Min"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      value={filters.ageMax}
                      onChange={(e) => handleFilterChange('ageMax', e.target.value)}
                      placeholder="Max"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>


                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <select
                    value={filters.city}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Cities</option>
                    {(getFilterOptions?.city || []).map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                {/* District */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District
                  </label>
                  <select
                    value={filters.district}
                    onChange={(e) => handleFilterChange('district', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Districts</option>
                    {(getFilterOptions?.district || []).map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                {/* Lok Sabha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lok Sabha
                  </label>
                  <select
                    value={filters.lokSabha}
                    onChange={(e) => handleFilterChange('lokSabha', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Lok Sabha</option>
                    {(getFilterOptions?.lokSabha || []).map(lokSabha => (
                      <option key={lokSabha} value={lokSabha}>{lokSabha}</option>
                    ))}
                  </select>
                </div>

                    {/* State */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        State
                      </label>
                      <select
                        value={filters.state}
                        onChange={(e) => handleFilterChange('state', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All States</option>
                        {(getFilterOptions?.state || []).map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>

                    {/* Interview Mode */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Interview Mode
                      </label>
                      <select
                        value={filters.interviewMode}
                        onChange={(e) => handleFilterChange('interviewMode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Modes</option>
                        {(getFilterOptions?.interviewMode || []).map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Clear All Filters
                </button>
                
                <div className="text-sm text-gray-600">
                  Showing {filteredResponses.length} of {originalResponses.length} responses
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="w-full py-6 px-4 sm:px-6 lg:px-8">
          {filteredResponses.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No responses found</h3>
              <p className="text-gray-600">
                {originalResponses.length === 0 
                  ? 'This survey has no responses yet.'
                  : 'Try adjusting your filters to see more results.'
                }
              </p>
            </div>
          ) : (
            <div className="bg-white shadow-sm border border-gray-200 overflow-hidden w-full">
              {/* Table Header */}
              <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b border-gray-200 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                  <h3 className="text-lg font-semibold text-gray-900">Survey Responses</h3>
                  <div className="text-sm text-gray-600">
                    {filteredResponses.length} of {originalResponses.length} responses
                    {totalTablePages > 1 && (
                      <span className="ml-2 text-gray-500">
                        (Page {tablePagination.currentPage} of {totalTablePages})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto w-full">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                        S.No
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-48">
                        Respondent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell w-32">
                        Demographics
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell w-48">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                        Interviewer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">
                        GPS
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">
                        Mode
                      </th>
                      {filters.status === 'Rejected' && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Rejection Reason
                        </th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedResponses.map((response, index) => {
                      const respondentInfo = getRespondentInfo(response.responses, response);
                      const actualIndex = (tablePagination.currentPage - 1) * tablePagination.pageSize + index + 1;
                      return (
                        <tr key={response._id} className="hover:bg-gray-50 transition-colors">
                          {/* S.No */}
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {actualIndex}
                          </td>
                          
                          {/* Respondent */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-[#E6F0F8] flex items-center justify-center">
                                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#373177]" />
                                </div>
                              </div>
                              <div className="ml-2 sm:ml-4">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {respondentInfo.name}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-500">
                                  ID: {response.responseId || response._id?.slice(-8)}
                                </div>
                                {/* Show demographics on mobile */}
                                <div className="sm:hidden mt-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-[#E6F0F8] text-blue-800">
                                      {respondentInfo.gender}
                                    </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Age: {respondentInfo.age}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Demographics - Hidden on mobile */}
                          <td className="px-4 py-4 hidden sm:table-cell">
                            <div className="text-sm text-gray-900">
                              <div className="flex flex-col space-y-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E6F0F8] text-blue-800 w-fit">
                                  {respondentInfo.gender}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                  Age: {respondentInfo.age}
                                </span>
                              </div>
                            </div>
                          </td>
                          
                          {/* Location - Hidden on small screens */}
                          <td className="px-4 py-4 hidden md:table-cell">
                            <div className="text-sm text-gray-900">
                              {response.selectedPollingStation ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium truncate">{response.selectedPollingStation.acName || response.selectedAC || respondentInfo.ac}</span>
                                  </div>
                                  {response.selectedPollingStation.district && (
                                    <div className="text-xs text-gray-500 truncate">
                                      {response.selectedPollingStation.district}
                                    </div>
                                  )}
                                  <div className="text-xs text-gray-500 truncate">
                                    {response.selectedPollingStation.state || getStateFromGPS(response.location)}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="flex items-center space-x-1">
                                    <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="font-medium truncate">{response.selectedAC || respondentInfo.ac}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {response.location?.city || respondentInfo.city}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {respondentInfo.district}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Interviewer - Hidden on small/medium screens */}
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <div className="text-sm text-gray-900">
                              <div className="font-medium truncate">
                                {response.interviewer ? `${response.interviewer.firstName} ${response.interviewer.lastName}` : 'N/A'}
                              </div>
                              {response.interviewer?.email && (
                                <div className="text-xs text-gray-500 truncate">
                                  {response.interviewer.email}
                                </div>
                              )}
                            </div>
                          </td>
                          
                          {/* Date - Hidden on small/medium/large screens */}
                          <td className="px-4 py-4 hidden xl:table-cell">
                            <div className="text-sm text-gray-900">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>{new Date(response.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(response.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          
                          {/* GPS - Hidden on small/medium/large screens */}
                          <td className="px-4 py-4 hidden xl:table-cell">
                            {response.location ? (
                              <div className="text-sm text-gray-900">
                                <div className="font-mono text-xs">
                                  {response.location.latitude?.toFixed(4)}, {response.location.longitude?.toFixed(4)}
                                </div>
                                <div className="text-xs text-green-600">
                                  ✓ GPS
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">
                                <div className="text-xs">No GPS</div>
                              </div>
                            )}
                          </td>
                          
                          {/* Interview Mode - Hidden on small/medium/large screens */}
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <div className="text-sm text-gray-900">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                response.interviewMode?.toUpperCase() === 'CAPI' 
                                  ? 'bg-[#E6F0F8] text-blue-800' 
                                  : response.interviewMode?.toUpperCase() === 'CATI'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {response.interviewMode?.toUpperCase() || 'N/A'}
                              </span>
                            </div>
                          </td>
                          
                          {/* Rejection Reason - Only shown when status filter is 'Rejected' */}
                          {filters.status === 'Rejected' && (
                            <td className="px-4 py-4">
                              <div className="text-sm text-gray-900">
                                {response.verificationData?.feedback ? (
                                  <div className="max-w-xs">
                                    {(() => {
                                      // Check if it's auto-rejected
                                      const isAutoRejected = response.verificationData.autoRejected === true || 
                                                             (response.verificationData.autoRejectionReasons && 
                                                              response.verificationData.autoRejectionReasons.length > 0) ||
                                                             // Check feedback text for known auto-rejection reasons
                                                             (response.verificationData.feedback && (
                                                               response.verificationData.feedback.includes('Interview Too Short') ||
                                                               response.verificationData.feedback.includes('Not Voter') ||
                                                               response.verificationData.feedback.includes('Not a Registered Voter') ||
                                                               response.verificationData.feedback.includes('Duplicate Response')
                                                             ));
                                      
                                      // Only show label if we can determine it's auto-rejected, otherwise don't show label
                                      if (isAutoRejected) {
                                        return (
                                          <>
                                            <div className="text-xs text-gray-600 mb-1">
                                              Auto Rejected
                                            </div>
                                            <div className="text-sm text-red-700 truncate" title={response.verificationData.feedback}>
                                              {response.verificationData.feedback}
                                            </div>
                                          </>
                                        );
                                      } else if (response.verificationData.reviewer) {
                                        // Has a reviewer, so it's manual rejection
                                        return (
                                          <>
                                            <div className="text-xs text-gray-600 mb-1">
                                              Rejected by QC
                                            </div>
                                            <div className="text-sm text-red-700 truncate" title={response.verificationData.feedback}>
                                              {response.verificationData.feedback}
                                            </div>
                                          </>
                                        );
                                      } else {
                                        // Can't determine, just show feedback without label
                                        return (
                                          <div className="text-sm text-red-700 truncate" title={response.verificationData.feedback}>
                                            {response.verificationData.feedback}
                                          </div>
                                        );
                                      }
                                    })()}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">No reason provided</span>
                                )}
                              </div>
                            </td>
                          )}
                          
                          {/* Actions */}
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleViewResponse(response)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 text-[#373177] hover:text-blue-800 hover:bg-[#E6F0F8] rounded-md transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalTablePages > 1 && (
                <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => handleTablePageChange(tablePagination.currentPage - 1)}
                        disabled={tablePagination.currentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handleTablePageChange(tablePagination.currentPage + 1)}
                        disabled={tablePagination.currentPage === totalTablePages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing{' '}
                          <span className="font-medium">
                            {(tablePagination.currentPage - 1) * tablePagination.pageSize + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-medium">
                            {Math.min(tablePagination.currentPage * tablePagination.pageSize, filteredResponses.length)}
                          </span>{' '}
                          of{' '}
                          <span className="font-medium">{filteredResponses.length}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => handleTablePageChange(tablePagination.currentPage - 1)}
                            disabled={tablePagination.currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          {[...Array(totalTablePages)].map((_, i) => {
                            const page = i + 1;
                            // Show first page, last page, current page, and pages around current
                            if (
                              page === 1 ||
                              page === totalTablePages ||
                              (page >= tablePagination.currentPage - 1 && page <= tablePagination.currentPage + 1)
                            ) {
                              return (
                                <button
                                  key={page}
                                  onClick={() => handleTablePageChange(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    page === tablePagination.currentPage
                                      ? 'z-10 bg-[#E6F0F8] border-blue-500 text-[#373177]'
                                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            } else if (page === tablePagination.currentPage - 2 || page === tablePagination.currentPage + 2) {
                              return (
                                <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                  ...
                                </span>
                              );
                            }
                            return null;
                          })}
                          <button
                            onClick={() => handleTablePageChange(tablePagination.currentPage + 1)}
                            disabled={tablePagination.currentPage === totalTablePages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Response Details Modal */}
      {showResponseDetails && selectedResponse && (
        <ResponseDetailsModal
          response={selectedResponse}
          survey={survey}
          hideSurveyResponses={isProjectManagerRoute}
          hideStatusChange={isProjectManagerRoute}
          onClose={() => {
            setShowResponseDetails(false);
            setSelectedResponse(null);
          }}
          onStatusChange={(updatedResponse) => {
            // Update the response in the list
            setOriginalResponses(prev => 
              prev.map(r => 
                (r._id === updatedResponse._id || r.responseId === updatedResponse.responseId) 
                  ? updatedResponse 
                  : r
              )
            );
            setResponses(prev => 
              prev.map(r => 
                (r._id === updatedResponse._id || r.responseId === updatedResponse.responseId) 
                  ? updatedResponse 
                  : r
              )
            );
            setSelectedResponse(updatedResponse);
          }}
        />
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
    </>
  );
};

export default ViewResponsesPage;
