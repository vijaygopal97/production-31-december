import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  ArrowLeft,
  Download, 
  Filter,
  X,
  Search,
  CheckCircle,
  Phone,
  Calendar,
  AlertCircle,
  Database,
  Activity,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { surveyAPI, surveyResponseAPI } from '../services/api';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { getMainText } from '../utils/translations';
import { getACByName } from '../utils/assemblyConstituencies';
import assemblyConstituenciesData from '../data/assemblyConstituencies.json';

// Enhanced Loading Screen Component for Caller Performance Page - Modern & Data-Driven
const CallerPerformanceLoadingScreen = () => {
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const [particles, setParticles] = useState([]);

  const loadingTexts = [
    'Fetching caller performance data...',
    'Loading call records...',
    'Processing call statistics...',
    'Analyzing caller metrics...',
    'Compiling performance reports...',
    'Finalizing caller dashboard...'
  ];

  const loadingStages = [
    { icon: Database, text: 'Fetching Data', color: 'text-blue-500' },
    { icon: Phone, text: 'Loading Calls', color: 'text-emerald-500' },
    { icon: Activity, text: 'Processing', color: 'text-purple-500' },
    { icon: TrendingUp, text: 'Analyzing', color: 'text-orange-500' }
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
                    stroke="url(#gradient-caller)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                    className="transition-all duration-500 ease-out drop-shadow-lg"
                  />
                  <defs>
                    <linearGradient id="gradient-caller" x1="0%" y1="0%" x2="100%" y2="100%">
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
                Please wait while we load your caller performance data
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
                <span>Loading performance data...</span>
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

const CallerPerformancePage = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Determine if we're in project manager route
  const isProjectManagerRoute = location.pathname.includes('/project-manager/');
  const backPath = isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys';
  
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false); // Loading state for filter changes
  const [assignedInterviewers, setAssignedInterviewers] = useState(null);
  const [catiStats, setCatiStats] = useState(null);
  const [showCatiFilters, setShowCatiFilters] = useState(true);
  const { showError } = useToast();

  // Pagination state for Interviewer Performance table
  const [interviewerPage, setInterviewerPage] = useState(1);
  const [interviewerPageSize] = useState(25); // Show 25 interviewers per page

  // CATI Performance filter states
  const [catiFilters, setCatiFilters] = useState({
    dateRange: 'all',
    startDate: '',
    endDate: '',
    ac: '',
    interviewerIds: [],
    interviewerMode: 'include'
  });
  
  // CATI Interviewer filter states
  const [catiInterviewerSearchTerm, setCatiInterviewerSearchTerm] = useState('');
  const [showCatiInterviewerDropdown, setShowCatiInterviewerDropdown] = useState(false);
  const catiInterviewerDropdownRef = useRef(null);
  
  // CATI AC filter states
  const [catiAcSearchTerm, setCatiAcSearchTerm] = useState('');
  const [showCatiACDropdown, setShowCatiACDropdown] = useState(false);
  const catiAcDropdownRef = useRef(null);

  // Load assembly constituencies data
  const [assemblyConstituencies, setAssemblyConstituencies] = useState(assemblyConstituenciesData);

  useEffect(() => {
    setAssemblyConstituencies(assemblyConstituenciesData);
  }, []);

  // Add CSS to ensure full width and responsive behavior (same as Reports page)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .caller-performance-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .caller-performance-page * {
        max-width: none !important;
      }
      
      /* React DatePicker Custom Styling */
      .react-datepicker {
        font-family: inherit;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      }
      
      .react-datepicker__header {
        background-color: #3b82f6;
        border-bottom: 1px solid #e5e7eb;
        border-top-left-radius: 0.5rem;
        border-top-right-radius: 0.5rem;
        padding-top: 0.75rem;
        position: relative;
      }
      
      .react-datepicker__current-month {
        color: white;
        font-weight: 600;
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
      }
      
      .react-datepicker__day-name {
        color: rgba(255, 255, 255, 0.9);
        font-weight: 500;
        width: 2rem;
        line-height: 2rem;
        margin: 0.166rem;
        font-size: 0.75rem;
      }
      
      .react-datepicker__day {
        width: 2rem;
        line-height: 2rem;
        margin: 0.166rem;
        border-radius: 0.375rem;
        color: #374151;
        font-size: 0.875rem;
      }
      
      .react-datepicker__day:hover {
        border-radius: 0.375rem;
        background-color: #e5e7eb;
      }
      
      .react-datepicker__day--selected,
      .react-datepicker__day--in-selecting-range,
      .react-datepicker__day--in-range {
        background-color: #3b82f6;
        color: white;
        border-radius: 0.375rem;
      }
      
      .react-datepicker__day--selected:hover,
      .react-datepicker__day--in-selecting-range:hover,
      .react-datepicker__day--in-range:hover {
        background-color: #2563eb;
      }
      
      .react-datepicker__day--keyboard-selected {
        background-color: #dbeafe;
        color: #1e40af;
        border-radius: 0.375rem;
      }
      
      .react-datepicker__day--disabled {
        color: #d1d5db;
        cursor: not-allowed;
      }
      
      .react-datepicker__day--today {
        font-weight: 600;
        color: #3b82f6;
      }
      
      .react-datepicker__day--today.react-datepicker__day--selected {
        color: white;
      }
      
      .react-datepicker__triangle {
        display: none;
      }
      
      .react-datepicker__navigation {
        top: 0.75rem;
      }
      
      .react-datepicker__navigation-icon::before {
        border-color: white;
      }
      
      .react-datepicker__navigation:hover *::before {
        border-color: rgba(255, 255, 255, 0.8);
      }
      
      .react-datepicker__month-container {
        padding: 0.5rem;
      }
      
      .react-datepicker__input-container {
        width: 100%;
        position: relative;
      }
      
      .react-datepicker__input-container input {
        width: 100%;
        padding: 0.625rem 2.5rem 0.625rem 2rem;
        border: 2px solid #d1d5db;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        cursor: pointer;
        background-color: white;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      }
      
      .react-datepicker__input-container input:hover {
        border-color: #93c5fd;
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
      }
      
      .react-datepicker__input-container input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), 0 2px 4px 0 rgba(0, 0, 0, 0.1);
      }
      
      .react-datepicker__input-container input::placeholder {
        color: #9ca3af;
        font-weight: 400;
      }
      
      .react-datepicker__close-icon {
        padding: 0.5rem;
        right: 0.5rem;
      }
      
      .react-datepicker__close-icon::after {
        background-color: #6b7280;
        font-size: 1rem;
        padding: 0.25rem;
      }
      
      .react-datepicker__close-icon:hover::after {
        background-color: #374151;
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

  // Helper function to get numeric AC code
  const getNumericACCode = (acCode) => {
    if (!acCode) return '';
    // Extract numeric part from codes like "AC-171" or "171"
    const match = acCode.toString().match(/\d+/);
    return match ? match[0] : '';
  };

  // Helper function to calculate dates from dateRange
  const calculateDatesFromRange = (dateRange, customStartDate, customEndDate) => {
    const now = new Date();
    let startDate = '';
    let endDate = '';
    
    switch (dateRange) {
      case 'today':
        const today = new Date(now);
        const todayYear = today.getFullYear();
        const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
        const todayDay = String(today.getDate()).padStart(2, '0');
        startDate = `${todayYear}-${todayMonth}-${todayDay}`;
        endDate = startDate;
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayYear = yesterday.getFullYear();
        const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
        startDate = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
        endDate = startDate;
        break;
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoYear = weekAgo.getFullYear();
        const weekAgoMonth = String(weekAgo.getMonth() + 1).padStart(2, '0');
        const weekAgoDay = String(weekAgo.getDate()).padStart(2, '0');
        startDate = `${weekAgoYear}-${weekAgoMonth}-${weekAgoDay}`;
        const todayForWeek = new Date(now);
        const todayWeekYear = todayForWeek.getFullYear();
        const todayWeekMonth = String(todayForWeek.getMonth() + 1).padStart(2, '0');
        const todayWeekDay = String(todayForWeek.getDate()).padStart(2, '0');
        endDate = `${todayWeekYear}-${todayWeekMonth}-${todayWeekDay}`;
        break;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const monthAgoYear = monthAgo.getFullYear();
        const monthAgoMonth = String(monthAgo.getMonth() + 1).padStart(2, '0');
        const monthAgoDay = String(monthAgo.getDate()).padStart(2, '0');
        startDate = `${monthAgoYear}-${monthAgoMonth}-${monthAgoDay}`;
        const todayForMonth = new Date(now);
        const todayMonthYear = todayForMonth.getFullYear();
        const todayMonthMonth = String(todayForMonth.getMonth() + 1).padStart(2, '0');
        const todayMonthDay = String(todayForMonth.getDate()).padStart(2, '0');
        endDate = `${todayMonthYear}-${todayMonthMonth}-${todayMonthDay}`;
        break;
      case 'custom':
        startDate = customStartDate || '';
        endDate = customEndDate || '';
        break;
      default:
        startDate = '';
        endDate = '';
    }
    
    return { startDate, endDate };
  };

  // Fetch CATI stats from backend (optimized)
  const fetchCatiStats = async (currentFilters = catiFilters, isFilterChange = false) => {
    try {
      if (isFilterChange) {
        setFilterLoading(true);
      }
      console.log('🚀 Fetching CATI stats from backend with filters:', currentFilters);
      
      const { startDate, endDate } = calculateDatesFromRange(
        currentFilters.dateRange, 
        currentFilters.startDate, 
        currentFilters.endDate
      );
      
      const catiStatsResponse = await surveyAPI.getCatiStats(
        surveyId, 
        startDate || null, 
        endDate || null,
        currentFilters.interviewerIds || [],
        currentFilters.interviewerMode || 'include',
        currentFilters.ac || ''
      );
      
      if (catiStatsResponse && catiStatsResponse.success) {
        console.log('✅ CATI stats fetched from backend:', catiStatsResponse.data);
        setCatiStats(catiStatsResponse.data);
      } else {
        console.warn('⚠️ CATI stats API returned unsuccessful response:', catiStatsResponse);
        setCatiStats(null);
      }
    } catch (error) {
      console.error('❌ Error fetching CATI stats from backend:', error);
      setCatiStats(null);
      // Don't show error to user - will show empty state
    } finally {
      if (isFilterChange) {
        setFilterLoading(false);
      }
    }
  };

  // Fetch survey and responses data (for dropdowns only)
  const fetchSurveyData = async () => {
    try {
      setLoading(true);
      
      // Fetch survey details
      const surveyResponse = await surveyAPI.getSurvey(surveyId);
      if (surveyResponse.success) {
        const surveyData = surveyResponse.data?.survey || surveyResponse.data;
        setSurvey(surveyData);
        
        // Fetch responses ONLY for dropdown population (AC, Interviewer filters)
        // We don't need all 10,000 for stats - backend handles that
        const params = {
          page: 1,
          limit: 10000, // Keep same limit for dropdown population (AC/Interviewer lists need all responses)
          status: 'approved_rejected_pending'
        };
        
        const response = await surveyResponseAPI.getSurveyResponses(surveyId, params);
        if (response.success) {
          setResponses(response.data.responses);
        }
      }

      // Fetch CATI stats from backend API (with current filters)
      await fetchCatiStats(catiFilters);
    } catch (error) {
      console.error('Error fetching survey data:', error);
      showError('Failed to load caller performance data', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch assigned team members for project managers
  useEffect(() => {
    const fetchAssignedInterviewers = async () => {
      if (isProjectManagerRoute && user && user.userType === 'project_manager') {
        try {
          const userResponse = await api.get('/api/auth/me');
          if (userResponse.data?.success && userResponse.data?.data?.assignedTeamMembers) {
            const assignedTeamMembers = userResponse.data.data.assignedTeamMembers;
            const interviewerDetails = assignedTeamMembers
              .filter(tm => tm.userType === 'interviewer' && tm.user && tm.user._id)
              .map(tm => ({
                _id: tm.user._id,
                firstName: tm.user.firstName || '',
                lastName: tm.user.lastName || '',
                email: tm.user.email || '',
                memberId: tm.user.memberId || '',
                name: `${tm.user.firstName || ''} ${tm.user.lastName || ''}`.trim() || 'Unknown'
              }))
              .filter(int => !!int._id);
            
            if (interviewerDetails.length > 0) {
              setAssignedInterviewers(interviewerDetails);
            } else {
              setAssignedInterviewers([]);
            }
          } else {
            setAssignedInterviewers([]);
          }
        } catch (error) {
          console.error('Error fetching assigned interviewers:', error);
          setAssignedInterviewers([]);
        }
      } else {
        setAssignedInterviewers([]);
      }
    };
    
    fetchAssignedInterviewers();
  }, [isProjectManagerRoute, user]);

  // Fetch survey and responses data on initial load
  useEffect(() => {
    if (surveyId) {
      fetchSurveyData();
    }
  }, [surveyId]);

  // Refetch CATI stats when CATI filters change (optimized - only stats, not full data)
  useEffect(() => {
    if (!survey || !surveyId) return;
    
    const surveyMode = survey?.mode;
    const surveyModes = survey?.modes;
    const isCatiSurvey = surveyMode === 'cati' || 
                        surveyMode === 'multi_mode' ||
                        (surveyModes && Array.isArray(surveyModes) && surveyModes.includes('cati'));
    
    if (isCatiSurvey) {
      // Only refetch CATI stats, not the full survey/responses data
      // Responses are still needed for dropdowns, but stats come from backend API
      fetchCatiStats(catiFilters, true); // Pass true to indicate this is a filter change
      // Reset to first page when filters change
      setInterviewerPage(1);
    }
  }, [surveyId, survey, catiFilters.dateRange, catiFilters.startDate, catiFilters.endDate, catiFilters.interviewerIds, catiFilters.interviewerMode, catiFilters.ac]);

  // Helper function to extract AC from response (similar to SurveyReportsPage)
  const extractACFromResponse = (response) => {
    // Priority 1: Check selectedAC field
    if (response?.selectedAC && typeof response.selectedAC === 'string' && response.selectedAC.trim() && response.selectedAC !== 'N/A') {
      return getMainText(response.selectedAC).trim();
    }
    
    // Priority 2: Check selectedPollingStation.acName
    if (response?.selectedPollingStation?.acName && typeof response.selectedPollingStation.acName === 'string' && response.selectedPollingStation.acName.trim() && response.selectedPollingStation.acName !== 'N/A') {
      return getMainText(response.selectedPollingStation.acName).trim();
    }
    
    // Priority 3: Check responses array for questionId === 'ac-selection'
    if (response?.responses && Array.isArray(response.responses)) {
      const acSelectionResponse = response.responses.find(r => 
        r.questionId === 'ac-selection' && r.response
      );
      if (acSelectionResponse && typeof acSelectionResponse.response === 'string' && acSelectionResponse.response.trim() && acSelectionResponse.response !== 'N/A') {
        return getMainText(acSelectionResponse.response).trim();
      }
      
      // Priority 4: Search by question text containing "assembly" or "constituency"
      const acTextResponse = response.responses.find(r => {
        if (!r.questionText || !r.response) return false;
        const questionText = getMainText(r.questionText).toLowerCase();
        const hasAssembly = questionText.includes('assembly');
        const hasConstituency = questionText.includes('constituency');
        const isConsentQuestion = questionText.includes('consent') || questionText.includes('agree');
        return (hasAssembly || hasConstituency) && !isConsentQuestion && typeof r.response === 'string' && r.response.trim() && r.response !== 'N/A';
      });
      if (acTextResponse) {
        return getMainText(acTextResponse.response).trim();
      }
    }
    
    return null;
  };

  // All ACs from responses - for dropdown/search
  const allACObjects = useMemo(() => {
    if (!responses || responses.length === 0) return [];

    const acMap = new Map();

    responses.forEach(response => {
      if (response.status === 'Approved' || 
          response.status === 'Rejected' || 
          response.status === 'Pending_Approval') {
        // Extract AC from response
        const acName = extractACFromResponse(response);
        
        if (acName && acName !== 'N/A') {
          if (!acMap.has(acName)) {
            const acData = getACByName(acName);
            const fullCode = acData?.acCode || '';
            const numericCode = getNumericACCode(fullCode);
            
            acMap.set(acName, {
              name: acName,
              code: fullCode,
              numericCode: numericCode
            });
          }
        }
      }
    });

    return Array.from(acMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [responses]);

  // All interviewers from responses - for dropdown/search
  const allInterviewerObjects = useMemo(() => {
    if (!responses || responses.length === 0) return [];

    const interviewerMap = new Map();

    responses.forEach(response => {
      if (response.interviewer && 
          (response.status === 'Approved' || 
           response.status === 'Rejected' || 
           response.status === 'Pending_Approval')) {
        const interviewerName = `${response.interviewer.firstName} ${response.interviewer.lastName}`;
        
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
    
    if (!catiInterviewerSearchTerm.trim()) {
      return allInterviewerObjects;
    }

    const searchLower = catiInterviewerSearchTerm.toLowerCase();
    return allInterviewerObjects.filter(interviewer => {
      const name = `${interviewer.firstName || ''} ${interviewer.lastName || ''}`.toLowerCase();
      const email = (interviewer.email || '').toLowerCase();
      const phone = (interviewer.phone || '').toLowerCase();
      const memberID = (interviewer.memberID || '').toLowerCase();
      
      return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower) || memberID.includes(searchLower);
    });
  }, [allInterviewerObjects, catiInterviewerSearchTerm]);

  // CATI Filter handlers
  const handleCatiFilterChange = (key, value) => {
    setCatiFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle CATI interviewer selection
  const handleCatiInterviewerToggle = (interviewerId) => {
    setCatiFilters(prev => {
      const currentIds = prev.interviewerIds || [];
      const isSelected = currentIds.includes(interviewerId);
      
      return {
        ...prev,
        interviewerIds: isSelected
          ? currentIds.filter(id => id !== interviewerId)
          : [...currentIds, interviewerId]
      };
    });
  };

  // Handle CATI interviewer mode toggle (include/exclude)
  const handleCatiInterviewerModeToggle = () => {
    setCatiFilters(prev => ({
      ...prev,
      interviewerMode: prev.interviewerMode === 'include' ? 'exclude' : 'include'
    }));
  };

  // Clear CATI interviewer filters
  const clearCatiInterviewerFilters = () => {
    setCatiFilters(prev => ({
      ...prev,
      interviewerIds: []
    }));
    setCatiInterviewerSearchTerm('');
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (catiInterviewerDropdownRef.current && !catiInterviewerDropdownRef.current.contains(event.target)) {
        setShowCatiInterviewerDropdown(false);
      }
      if (catiAcDropdownRef.current && !catiAcDropdownRef.current.contains(event.target)) {
        setShowCatiACDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Default CATI Performance data structure
  const catiPerformanceData = catiStats || {
    callerPerformance: {
      callsMade: 0,
      callsAttended: 0,
      callsConnected: 0,
      totalTalkDuration: '0:00:00'
    },
    numberStats: {
      callNotReceived: 0,
      ringing: 0,
      notRinging: 0
    },
    callNotRingStatus: {
      switchOff: 0,
      numberNotReachable: 0,
      numberDoesNotExist: 0
    },
    callRingStatus: {
      callsConnected: 0,
      callsNotConnected: 0
    }
  };

  if (loading) {
    return <CallerPerformanceLoadingScreen />;
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Survey not found</h3>
          <p className="text-gray-600 mb-4">The requested survey could not be found.</p>
          <button
            onClick={() => navigate(backPath)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Surveys</span>
          </button>
        </div>
      </div>
    );
  }

  // Modern Filter Loading Overlay Component
  const FilterLoadingOverlay = () => {
    if (!filterLoading) return null;

  return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center pointer-events-none transition-opacity duration-200">
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center space-y-4 pointer-events-auto animate-[fadeIn_0.2s_ease-in-out]">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-[#001D48]/20 border-t-[#001D48] rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Phone className="w-6 h-6 text-[#001D48] animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900">Applying filters...</p>
            <p className="text-xs text-gray-500 mt-1">Please wait while we update caller data</p>
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

  return (
    <>
      <FilterLoadingOverlay />
    <div className="min-h-screen bg-gray-50 w-full caller-performance-page">
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
                  {survey?.surveyName || survey?.name || 'Caller Performance'}
                </h1>
                <p className="text-sm text-gray-600">Caller Performance & Analytics</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
              <button
                onClick={() => setShowCatiFilters(!showCatiFilters)}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">{showCatiFilters ? 'Hide Filters' : 'Show Filters'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showCatiFilters && (
        <div className="bg-white border-b border-gray-200 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={catiFilters.dateRange}
                  onChange={(e) => {
                    const newDateRange = e.target.value;
                    handleCatiFilterChange('dateRange', newDateRange);
                    // Clear custom dates when switching away from custom
                    if (newDateRange !== 'custom') {
                      handleCatiFilterChange('startDate', '');
                      handleCatiFilterChange('endDate', '');
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
                {catiFilters.dateRange === 'custom' && (
                  <div className="mt-3 p-4 bg-gradient-to-br from-[#E6F0F8] to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
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
                            selected={catiFilters.startDate ? new Date(catiFilters.startDate) : null}
                            onChange={(date) => {
                              if (date) {
                                const dateStr = date.toISOString().split('T')[0];
                                handleCatiFilterChange('startDate', dateStr);
                              } else {
                                handleCatiFilterChange('startDate', '');
                              }
                            }}
                            selectsStart
                            startDate={catiFilters.startDate ? new Date(catiFilters.startDate) : null}
                            endDate={catiFilters.endDate ? new Date(catiFilters.endDate) : null}
                            maxDate={catiFilters.endDate ? new Date(catiFilters.endDate) : new Date()}
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
                        {catiFilters.startDate && (
                          <p className="mt-1.5 text-xs text-gray-500">
                            {new Date(catiFilters.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
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
                            selected={catiFilters.endDate ? new Date(catiFilters.endDate) : null}
                            onChange={(date) => {
                              if (date) {
                                const dateStr = date.toISOString().split('T')[0];
                                handleCatiFilterChange('endDate', dateStr);
                              } else {
                                handleCatiFilterChange('endDate', '');
                              }
                            }}
                            selectsEnd
                            startDate={catiFilters.startDate ? new Date(catiFilters.startDate) : null}
                            endDate={catiFilters.endDate ? new Date(catiFilters.endDate) : null}
                            minDate={catiFilters.startDate ? new Date(catiFilters.startDate) : null}
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
                        {catiFilters.endDate && (
                          <p className="mt-1.5 text-xs text-gray-500">
                            {new Date(catiFilters.endDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Date Range Summary */}
                    {catiFilters.startDate && catiFilters.endDate && (
                      <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#373177]"></div>
                          <span className="text-sm font-medium text-gray-700">
                            {new Date(catiFilters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(catiFilters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            handleCatiFilterChange('startDate', '');
                            handleCatiFilterChange('endDate', '');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Clear Range
                        </button>
                      </div>
                    )}

                    {/* Helper Text */}
                    {(!catiFilters.startDate || !catiFilters.endDate) && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {!catiFilters.startDate && !catiFilters.endDate 
                            ? 'Select both start and end dates to filter responses'
                            : !catiFilters.startDate 
                              ? 'Please select a start date'
                              : 'Please select an end date'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assembly Constituency */}
              <div className="relative" ref={catiAcDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assembly Constituency</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={catiFilters.ac ? catiFilters.ac : "Search AC..."}
                      value={catiFilters.ac ? catiFilters.ac : catiAcSearchTerm}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCatiAcSearchTerm(value);
                        setShowCatiACDropdown(true);
                        handleCatiFilterChange('ac', '');
                      }}
                      onFocus={() => {
                        setShowCatiACDropdown(true);
                        if (catiFilters.ac) {
                          setCatiAcSearchTerm(catiFilters.ac);
                          handleCatiFilterChange('ac', '');
                        }
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {catiFilters.ac && (
                      <button
                        onClick={() => {
                          handleCatiFilterChange('ac', '');
                          setCatiAcSearchTerm('');
                          setShowCatiACDropdown(false);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showCatiACDropdown && (() => {
                    const catiFilteredACs = !catiAcSearchTerm.trim() 
                      ? allACObjects 
                      : allACObjects.filter(ac => {
                          const searchLower = catiAcSearchTerm.toLowerCase();
                          const searchNumeric = catiAcSearchTerm.trim();
                          const nameMatch = ac.name.toLowerCase().includes(searchLower);
                          const numericCodeMatch = ac.numericCode && (
                            ac.numericCode === searchNumeric || 
                            ac.numericCode.includes(searchNumeric) ||
                            searchNumeric.includes(ac.numericCode)
                          );
                          return nameMatch || numericCodeMatch;
                        });
                    return catiFilteredACs.length > 0 ? (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {catiFilteredACs.map(ac => {
                          const isSelected = catiFilters.ac === ac.name;
                          return (
                            <div
                              key={ac.name}
                              onClick={() => {
                                handleCatiFilterChange('ac', ac.name);
                                setCatiAcSearchTerm('');
                                setShowCatiACDropdown(false);
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
                    ) : null;
                  })()}
                  {showCatiACDropdown && catiAcSearchTerm && (() => {
                    const catiFilteredACs = allACObjects.filter(ac => {
                      const searchLower = catiAcSearchTerm.toLowerCase();
                      const searchNumeric = catiAcSearchTerm.trim();
                      const nameMatch = ac.name.toLowerCase().includes(searchLower);
                      const numericCodeMatch = ac.numericCode && (
                        ac.numericCode === searchNumeric || 
                        ac.numericCode.includes(searchNumeric) ||
                        searchNumeric.includes(ac.numericCode)
                      );
                      return nameMatch || numericCodeMatch;
                    });
                    return catiFilteredACs.length === 0 ? (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                        No ACs found matching "{catiAcSearchTerm}"
                      </div>
                    ) : null;
                  })()}
              </div>
            </div>

            {/* CATI Interviewer Filter */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="relative" ref={catiInterviewerDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CATI Interviewers {catiFilters.interviewerIds?.length > 0 && `(${catiFilters.interviewerIds.length} selected)`}
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search by name, email, phone, or Member ID..."
                        value={catiInterviewerSearchTerm}
                        onChange={(e) => {
                          setCatiInterviewerSearchTerm(e.target.value);
                          setShowCatiInterviewerDropdown(true);
                        }}
                        onFocus={() => setShowCatiInterviewerDropdown(true)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {catiFilters.interviewerIds?.length > 0 && (
                        <button
                          onClick={clearCatiInterviewerFilters}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          title="Clear all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCatiInterviewerModeToggle}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          catiFilters.interviewerMode === 'include'
                            ? 'bg-[#373177] text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {catiFilters.interviewerMode === 'include' ? 'Include' : 'Exclude'}
                      </button>
                    </div>
                  </div>
                  {showCatiInterviewerDropdown && filteredInterviewers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredInterviewers.filter(interviewer => {
                        if (!catiInterviewerSearchTerm.trim()) return true;
                        const searchLower = catiInterviewerSearchTerm.toLowerCase();
                        const name = `${interviewer.firstName || ''} ${interviewer.lastName || ''}`.toLowerCase();
                        const email = (interviewer.email || '').toLowerCase();
                        const phone = (interviewer.phone || '').toLowerCase();
                        const memberID = (interviewer.memberID || '').toLowerCase();
                        return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower) || memberID.includes(searchLower);
                      }).map(interviewer => {
                        const interviewerId = interviewer._id?.toString() || interviewer.id?.toString();
                        const isSelected = catiFilters.interviewerIds?.includes(interviewerId);
                        return (
                          <div
                            key={interviewerId}
                            onClick={() => handleCatiInterviewerToggle(interviewerId)}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                              isSelected ? 'bg-[#E6F0F8]' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {interviewer.firstName} {interviewer.lastName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {interviewer.email && <span>{interviewer.email}</span>}
                                  {interviewer.phone && <span className="ml-2">• {interviewer.phone}</span>}
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
                </div>
            </div>
          </div>
        </div>
        )}

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* CATI Performance Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
          {/* Caller Performance */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Caller Performance</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-[#E6F0F8] rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-[#373177] mb-1">{catiPerformanceData.callerPerformance.callsMade || 0}</div>
                <div className="text-xs font-medium text-blue-800">Total Number of Dials</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600 mb-1">{catiPerformanceData.callerPerformance.callsAttended || 0}</div>
                <div className="text-xs font-medium text-green-800">Interviewer Picked up</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-600 mb-1">{catiPerformanceData.callerPerformance.callsConnected || 0}</div>
                <div className="text-xs font-medium text-orange-800">Respondent Picked Up</div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="text-2xl font-bold text-indigo-600 mb-1">{catiPerformanceData.callerPerformance.totalTalkDuration || '0:00:00'}</div>
                <div className="text-xs font-medium text-indigo-800">Talk Duration</div>
              </div>
            </div>
          </div>

          {/* Number Stats */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Number Stats</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-600 mb-1">{catiPerformanceData.numberStats.callNotReceived}</div>
                <div className="text-xs font-medium text-gray-800">Call Not Received to Telecaller</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600 mb-1">{catiPerformanceData.numberStats.ringing}</div>
                <div className="text-xs font-medium text-yellow-800">Respondent Ph. Ringing</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600 mb-1">{catiPerformanceData.numberStats.notRinging}</div>
                <div className="text-xs font-medium text-red-800">Respondent Ph. Not Ringing</div>
              </div>
            </div>
          </div>

          {/* Call Not Ring Status */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Call Not Ring Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-600 mb-1">{catiPerformanceData.callNotRingStatus.switchOff}</div>
                <div className="text-xs font-medium text-gray-800">Switch Off</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600 mb-1">{catiPerformanceData.callNotRingStatus.numberNotReachable}</div>
                <div className="text-xs font-medium text-red-800">Number Not Reachable</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-600 mb-1">{catiPerformanceData.callNotRingStatus.numberDoesNotExist}</div>
                <div className="text-xs font-medium text-orange-800">Number Does Not Exist</div>
              </div>
            </div>
          </div>

          {/* Call Ring Status */}
          <div className="mb-8">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Call Ring Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600 mb-1">{catiPerformanceData.callRingStatus.callsConnected}</div>
                <div className="text-xs font-medium text-green-800">Respondent Picked Up</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600 mb-1">{catiPerformanceData.callRingStatus.callsNotConnected}</div>
                <div className="text-xs font-medium text-red-800">Calls Not Connected</div>
              </div>
            </div>
          </div>

          {/* Interviewer Performance Table */}
          {catiStats?.interviewerStats && catiStats.interviewerStats.length > 0 && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h4 className="text-md font-semibold text-gray-800">Interviewer Performance</h4>
                  <span className="text-sm text-gray-600">
                    ({catiStats.interviewerStats.length} total interviewers)
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (!catiStats?.interviewerStats || catiStats.interviewerStats.length === 0) {
                      showError('No data to export');
                      return;
                    }
                    
                    const csvData = catiStats.interviewerStats.map(stat => ({
                      'S.No': stat.sNo || '',
                      'Interviewer ID': stat.memberID || 'N/A',
                      'Caller Name': stat.interviewerName || 'N/A',
                      'Caller Mobile No.': stat.interviewerPhone || 'N/A',
                      'Number of Dials': stat.numberOfDials || 0,
                      'Calls Connected': stat.callsConnected || 0,
                      'Incomplete': stat.incomplete || 0,
                      'Completed': stat.completed || 0,
                      'Approved': stat.approved || 0,
                      'Under QC Queue': stat.underQCQueue || 0,
                      'Processing in Batch': stat.processingInBatch || 0,
                      'Rejected': stat.rejected || 0,
                      'Form Duration': stat.formDuration || '0:00:00',
                      'Call Not Received to Telecaller': stat.callNotReceivedToTelecaller || 0,
                      'Interviewer Picked up': stat.ringing || 0,
                      'Not Ringing': stat.notRinging || 0,
                      'Switch Off': stat.switchOff || 0,
                      'Number Not Reachable': stat.numberNotReachable || 0,
                      'Number Does Not Exist': stat.numberDoesNotExist || 0,
                      'No Response by Telecaller': stat.noResponseByTelecaller || 0
                    }));
                    
                    const csvContent = [Object.keys(csvData[0]), ...csvData.map(row => Object.values(row))]
                      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                      .join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `interviewer_performance_cati_${survey?.surveyName?.replace(/[^a-z0-9]/gi, '_') || 'survey'}_${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Export as CSV</span>
                </button>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">S.No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Interviewer ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Caller Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Caller Mobile No.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Number of Dials</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Calls Connected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Incomplete</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Completed</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Approved</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Under QC Queue</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Processing in Batch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Rejected</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Form Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Call Not Received to Telecaller</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Interviewer Picked up</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Not Ringing</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Switch Off</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Number Not Reachable</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Number Does Not Exist</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">No Response by Telecaller</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Calculate totals for ALL interviewers (not just paginated ones)
                      // This ensures totals are accurate regardless of pagination
                      const totals = catiStats.interviewerStats.reduce((acc, stat) => {
                        acc.numberOfDials += stat.numberOfDials || 0;
                        acc.callsConnected += stat.callsConnected || 0;
                        acc.completed += stat.completed || 0;
                        acc.approved += stat.approved || 0;
                        acc.underQCQueue += stat.underQCQueue || 0;
                        acc.processingInBatch += stat.processingInBatch || 0;
                        acc.rejected += stat.rejected || 0;
                        acc.incomplete += stat.incomplete || 0;
                        acc.callNotReceivedToTelecaller += stat.callNotReceivedToTelecaller || 0;
                        acc.ringing += stat.ringing || 0;
                        acc.notRinging += stat.notRinging || 0;
                        acc.switchOff += stat.switchOff || 0;
                        acc.numberNotReachable += stat.numberNotReachable || 0;
                        acc.numberDoesNotExist += stat.numberDoesNotExist || 0;
                        acc.noResponseByTelecaller += stat.noResponseByTelecaller || 0;
                        
                        // Parse and sum form duration
                        let durationSeconds = 0;
                        if (stat.formDuration) {
                          if (typeof stat.formDuration === 'number') {
                            durationSeconds += stat.formDuration;
                          } else if (typeof stat.formDuration === 'string') {
                            const parts = stat.formDuration.split(':');
                            if (parts.length === 3) {
                              durationSeconds += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                            } else if (parts.length === 2) {
                              durationSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
                            } else {
                              const parsed = parseInt(stat.formDuration);
                              if (!isNaN(parsed)) durationSeconds += parsed;
                            }
                          }
                        }
                        acc.totalFormDurationSeconds += durationSeconds;
                        
                        return acc;
                      }, {
                        numberOfDials: 0,
                        callsConnected: 0,
                        completed: 0,
                        approved: 0,
                        underQCQueue: 0,
                        processingInBatch: 0,
                        rejected: 0,
                        incomplete: 0,
                        callNotReceivedToTelecaller: 0,
                        ringing: 0,
                        notRinging: 0,
                        switchOff: 0,
                        numberNotReachable: 0,
                        numberDoesNotExist: 0,
                        noResponseByTelecaller: 0,
                        totalFormDurationSeconds: 0
                      });
                      
                      // Format total form duration
                      const formatDuration = (seconds) => {
                        const hours = Math.floor(seconds / 3600);
                        const minutes = Math.floor((seconds % 3600) / 60);
                        const secs = seconds % 60;
                        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                      };
                      
                      // Calculate pagination
                      const totalInterviewers = catiStats.interviewerStats.length;
                      const totalPages = Math.ceil(totalInterviewers / interviewerPageSize);
                      const startIndex = (interviewerPage - 1) * interviewerPageSize;
                      const endIndex = startIndex + interviewerPageSize;
                      const paginatedStats = catiStats.interviewerStats.slice(startIndex, endIndex);
                      
                      return (
                        <>
                          {/* Total Row - Always show totals from ALL interviewers */}
                          <tr className="bg-[#E6F0F8] border-b-2 border-[#373177] font-semibold">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">Total</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">-</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">-</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">-</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.numberOfDials}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.callsConnected}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.incomplete}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.completed}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.approved}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.underQCQueue}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.processingInBatch}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.rejected}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{formatDuration(totals.totalFormDurationSeconds)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.callNotReceivedToTelecaller}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.ringing}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.notRinging}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.switchOff}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.numberNotReachable}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.numberDoesNotExist}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-[#373177] font-bold">{totals.noResponseByTelecaller}</td>
                          </tr>
                          {/* Individual Interviewer Rows - Paginated */}
                          {paginatedStats.map((stat, index) => {
                            // Calculate actual row number (accounting for pagination)
                            const actualIndex = startIndex + index;
                            return (
                              <tr key={stat.interviewerId || actualIndex} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.sNo || actualIndex + 1}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.memberID || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.interviewerName || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.interviewerPhone || 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.numberOfDials || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.callsConnected || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.incomplete || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.completed || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.approved || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.underQCQueue || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.processingInBatch || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.rejected || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.formDuration || '0:00:00'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.callNotReceivedToTelecaller || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.ringing || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.notRinging || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.switchOff || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.numberNotReachable || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.numberDoesNotExist || 0}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{stat.noResponseByTelecaller || 0}</td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {catiStats.interviewerStats.length > interviewerPageSize && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((interviewerPage - 1) * interviewerPageSize) + 1} to {Math.min(interviewerPage * interviewerPageSize, catiStats.interviewerStats.length)} of {catiStats.interviewerStats.length} interviewers
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInterviewerPage(prev => Math.max(1, prev - 1))}
                      disabled={interviewerPage === 1}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        interviewerPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#001D48] text-white hover:bg-blue-700'
                      }`}
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(catiStats.interviewerStats.length / interviewerPageSize)) }, (_, i) => {
                        let pageNum;
                        const totalPages = Math.ceil(catiStats.interviewerStats.length / interviewerPageSize);
                        
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (interviewerPage <= 3) {
                          pageNum = i + 1;
                        } else if (interviewerPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = interviewerPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setInterviewerPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                              interviewerPage === pageNum
                                ? 'bg-[#373177] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setInterviewerPage(prev => Math.min(Math.ceil(catiStats.interviewerStats.length / interviewerPageSize), prev + 1))}
                      disabled={interviewerPage >= Math.ceil(catiStats.interviewerStats.length / interviewerPageSize)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        interviewerPage >= Math.ceil(catiStats.interviewerStats.length / interviewerPageSize)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#001D48] text-white hover:bg-blue-700'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default CallerPerformancePage;

