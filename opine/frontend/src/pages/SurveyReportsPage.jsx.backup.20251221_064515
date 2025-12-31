import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  ArrowLeft,
  Download, 
  Filter,
  Calendar,
  MapPin,
  Users,
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  FileText,
  PieChart,
  Activity,
  Award,
  Zap,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  Database
} from 'lucide-react';
import { surveyResponseAPI, surveyAPI, pollingStationAPI } from '../services/api';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { findGenderResponse, normalizeGenderResponse } from '../utils/genderUtils';
import { getMainText } from '../utils/translations';
import { getACByName } from '../utils/assemblyConstituencies';
import assemblyConstituenciesData from '../data/assemblyConstituencies.json';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Enhanced Loading Screen Component - Modern & Data-Driven
const ReportsLoadingScreen = () => {
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const [particles, setParticles] = useState([]);

  const loadingTexts = [
    'Gathering survey responses...',
    'Analyzing participant data...',
    'Processing statistical models...',
    'Generating visual insights...',
    'Compiling comprehensive reports...',
    'Finalizing dashboard...'
  ];

  const loadingStages = [
    { icon: Database, text: 'Fetching Data', color: 'text-blue-500' },
    { icon: Activity, text: 'Processing', color: 'text-emerald-500' },
    { icon: BarChart3, text: 'Analyzing', color: 'text-purple-500' },
    { icon: PieChart, text: 'Visualizing', color: 'text-orange-500' }
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
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                    className="transition-all duration-500 ease-out drop-shadow-lg"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
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
                    }`}>
                      {stage.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Main Loading Text */}
            <div className="h-16 flex items-center justify-center">
              <p
                key={loadingTextIndex}
                className="text-xl lg:text-2xl font-semibold text-gray-800 animate-fade-in-up text-center px-4"
              >
                {loadingTexts[loadingTextIndex]}
              </p>
            </div>

            {/* Linear Progress Bar */}
            <div className="space-y-3">
              <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#001D48] via-[#003366] to-[#0055AA] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progress, 95)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-fast" />
                  <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30 blur-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#001D48] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-[#003366] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-[#0055AA] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-gray-600 font-medium">
                    Processing survey data
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span className="tabular-nums">{Math.max(0, Math.ceil((100 - progress) / 10))}s</span>
                </div>
              </div>
            </div>

            {/* Footer Message */}
            <div className="text-center pt-4 border-t border-gray-200/50">
              <p className="text-sm text-gray-500">
                Building comprehensive analytics from your survey responses
              </p>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          25% {
            transform: translateY(-20px) translateX(10px);
          }
          50% {
            transform: translateY(-10px) translateX(-10px);
          }
          75% {
            transform: translateY(-15px) translateX(5px);
          }
        }

        @keyframes pulse-bar {
          0% {
            transform: scaleY(0.7);
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
            transform: translateY(15px);
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
          animation: shimmer-up 2s infinite;
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
          animation: shimmer-fast 1.5s infinite;
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

const SurveyReportsPage = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Determine if we're in project manager route
  const isProjectManagerRoute = location.pathname.includes('/project-manager/');
  const backPath = isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys';
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [analyticsFromBackend, setAnalyticsFromBackend] = useState(null); // Store analytics from backend aggregation
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false); // Loading state for filter changes
  const [assignedInterviewers, setAssignedInterviewers] = useState(null); // Store assigned interviewers for project managers (null = not loaded yet, [] = loaded but empty)
  const [showFilters, setShowFilters] = useState(true);
  const [showACModal, setShowACModal] = useState(false);
  const [showInterviewerModal, setShowInterviewerModal] = useState(false);
  const [showDailyTrendsModal, setShowDailyTrendsModal] = useState(false);
  
  // Pagination states for modals
  const [acModalPage, setAcModalPage] = useState(1);
  const [acModalPageSize] = useState(25); // Show 25 ACs per page
  const [interviewerModalPage, setInterviewerModalPage] = useState(1);
  const [interviewerModalPageSize] = useState(25); // Show 25 interviewers per page
  const [acPerformanceStats, setAcPerformanceStats] = useState(null);
  const [interviewerPerformanceStats, setInterviewerPerformanceStats] = useState(null);
  const [acPCMappingCache, setAcPCMappingCache] = useState(new Map()); // Cache for AC -> PC data
  const { showError } = useToast();

  // Filter states
  const [filters, setFilters] = useState({
    dateRange: 'all', // 'today', 'week', 'month', 'all'
    startDate: '',
    endDate: '',
    status: 'approved_rejected_pending', // 'all', 'approved_rejected_pending', 'approved_pending', 'pending', 'Approved', 'Rejected'
    interviewMode: '', // 'CAPI', 'CATI', ''
    ac: '',
    district: '',
    lokSabha: '',
    interviewer: '', // Legacy: kept for backward compatibility
    interviewerIds: [], // New: array of interviewer IDs
    interviewerMode: 'include' // 'include' or 'exclude'
  });

  // Interviewer filter states
  const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('');
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);
  const interviewerDropdownRef = useRef(null);

  // AC filter states
  const [acSearchTerm, setAcSearchTerm] = useState('');
  const [showACDropdown, setShowACDropdown] = useState(false);
  const acDropdownRef = useRef(null);

  // Load assembly constituencies data (imported directly, bundled in build)
  const [assemblyConstituencies, setAssemblyConstituencies] = useState(assemblyConstituenciesData);

  useEffect(() => {
    // Data is already loaded via import, no need to fetch
    setAssemblyConstituencies(assemblyConstituenciesData);
  }, []);

  // Get all ACs for the survey's target state
  const getAllACsForState = () => {
    console.log('🔍 getAllACsForState - survey object:', survey);
    console.log('🔍 getAllACsForState - survey.acAssignmentState:', survey?.acAssignmentState);
    console.log('🔍 getAllACsForState - assemblyConstituencies loaded:', !!assemblyConstituencies.states);
    console.log('🔍 getAllACsForState - available states:', Object.keys(assemblyConstituencies.states || {}));
    
    // Try to get state from survey.acAssignmentState first
    let targetState = survey?.acAssignmentState;
    
    // If no state found, try to infer from responses
    if (!targetState && responses.length > 0) {
      // Look for state in response data
      const responseWithState = responses.find(r => r.state);
      if (responseWithState?.state) {
        targetState = responseWithState.state;
        console.log('🔍 Inferred state from responses:', targetState);
      }
    }
    
    // If still no state found, try to infer from AC names in responses
    if (!targetState && responses.length > 0) {
      console.log('🔍 Full response structure:', responses[0]);
      
      // Try different possible field names for AC
      const responseACs = responses.map(r => {
        return r.assemblyConstituency || r.assemblyConstituencyName || r.ac || r.acName || r.constituency;
      }).filter(Boolean);
      
      console.log('🔍 Response ACs:', responseACs);
      
      // If still no ACs found, try to extract from response data
      if (responseACs.length === 0) {
        console.log('🔍 Trying to extract ACs from response data...');
        const allResponseACs = [];
        
        responses.forEach(response => {
          // Check if AC is in the response data directly
          if (response.data) {
            Object.values(response.data).forEach(value => {
              if (typeof value === 'string' && ['Natabari', 'Tufanganj', 'Kumargram'].includes(value)) {
                allResponseACs.push(value);
              }
            });
          }
        });
        
        console.log('🔍 Extracted ACs from response data:', allResponseACs);
        responseACs.push(...allResponseACs);
      }
      
      // Check each state to see if any of the response ACs match
      for (const [stateName, stateData] of Object.entries(assemblyConstituencies.states || {})) {
        const stateACNames = stateData.assemblyConstituencies?.map(ac => ac.acName) || [];
        const matchingACs = responseACs.filter(ac => stateACNames.includes(ac));
        
        if (matchingACs.length > 0) {
          targetState = stateName;
          console.log('🔍 Inferred state from AC names:', targetState, 'with matching ACs:', matchingACs);
          break;
        }
      }
    }
    
    // Final fallback: if we still can't detect state, try West Bengal since we know the ACs
    if (!targetState && responses.length > 0) {
      console.log('🔍 Final fallback: trying West Bengal');
      const westBengalACs = assemblyConstituencies.states?.['West Bengal']?.assemblyConstituencies?.map(ac => ac.acName) || [];
      const responseACs = ['Natabari', 'Tufanganj', 'Kumargram']; // Known ACs from responses
      const matchingACs = responseACs.filter(ac => westBengalACs.includes(ac));
      
      if (matchingACs.length > 0) {
        targetState = 'West Bengal';
        console.log('🔍 Fallback: Using West Bengal with matching ACs:', matchingACs);
      }
    }
    
    if (!targetState || !assemblyConstituencies.states) {
      console.log('❌ Missing targetState or assemblyConstituencies.states');
      console.log('❌ targetState:', targetState);
      console.log('❌ assemblyConstituencies.states:', !!assemblyConstituencies.states);
      return [];
    }
    
    const stateACs = assemblyConstituencies.states[targetState]?.assemblyConstituencies || [];
    console.log('🔍 Found state ACs:', stateACs.length, 'ACs for state:', targetState);
    console.log('🔍 First few ACs:', stateACs.slice(0, 3));
    
    const acNames = stateACs.map(ac => ac.acName);
    console.log('🔍 AC Names:', acNames.slice(0, 5), '... (showing first 5)');
    
    return acNames;
  };

  // Add CSS to ensure full width and responsive behavior
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .survey-reports-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .survey-reports-page * {
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

  // Fetch analytics from backend API (optimized with aggregation)
  const fetchAnalytics = async (currentFilters = filters, isFilterChange = false) => {
    try {
      if (isFilterChange) {
        setFilterLoading(true);
      }
      console.log('🚀 Fetching analytics from backend with filters:', currentFilters);
      
      // Prepare filters for backend API
      const analyticsFilters = {
        dateRange: currentFilters.dateRange || 'all',
        startDate: currentFilters.startDate || '',
        endDate: currentFilters.endDate || '',
        status: currentFilters.status || 'approved_rejected_pending',
        interviewMode: currentFilters.interviewMode || '',
        ac: currentFilters.ac || '',
        district: currentFilters.district || '',
        lokSabha: currentFilters.lokSabha || '',
        interviewerIds: currentFilters.interviewerIds || [],
        interviewerMode: currentFilters.interviewerMode || 'include'
      };

      const analyticsResponse = await surveyAPI.getSurveyAnalytics(surveyId, analyticsFilters);
      
      if (analyticsResponse.success && analyticsResponse.data) {
        console.log('✅ Analytics fetched from backend:', analyticsResponse.data);
        setAnalyticsFromBackend(analyticsResponse.data);
      } else {
        console.warn('⚠️ Analytics API returned unsuccessful response:', analyticsResponse);
        setAnalyticsFromBackend(null);
      }
    } catch (error) {
      console.error('❌ Error fetching analytics from backend:', error);
      // Fallback to client-side calculation
      setAnalyticsFromBackend(null);
      // Don't show error to user - will fallback to client-side calculation
    } finally {
      if (isFilterChange) {
        setFilterLoading(false);
      }
    }
  };

  // Fetch survey and responses data (for dropdowns and other features)
  const fetchSurveyData = async () => {
    try {
      setLoading(true);
      
      // Fetch survey details
      const surveyResponse = await surveyAPI.getSurvey(surveyId);
      if (surveyResponse.success) {
        console.log('Survey object:', surveyResponse.data);
        console.log('Sample size fields:', {
          sampleSize: surveyResponse.data?.sampleSize,
          targetSampleSize: surveyResponse.data?.targetSampleSize,
          specifications: surveyResponse.data?.specifications
        });
        // Survey data might be nested under 'survey' property
        const surveyData = surveyResponse.data?.survey || surveyResponse.data;
        console.log('🔍🔍🔍 Extracted surveyData:', surveyData);
        console.log('🔍🔍🔍 surveyData.mode:', surveyData?.mode);
        console.log('🔍🔍🔍 surveyData.modes:', surveyData?.modes);
        setSurvey(surveyData);
        
        // Fetch responses for dropdown population (AC, Interviewer filters)
        // We still need responses for dropdowns, but we don't need all 10,000 for analytics
        // Fetch a reasonable amount for dropdown population
        const params = {
          page: 1,
          limit: 10000, // Keep same limit for dropdown population (AC/Interviewer lists need all responses)
          status: 'approved_rejected_pending' // Fetch all statuses for dropdown population
        };
        
        const response = await surveyResponseAPI.getSurveyResponses(surveyId, params);
        console.log('🔍 SurveyReportsPage - API Response:', response);
        console.log('🔍 SurveyReportsPage - Responses count:', response.data?.responses?.length);
        console.log('🔍 SurveyReportsPage - Response statuses:', response.data?.responses?.map(r => r.status));
        
        let hasCatiResponses = false;
        if (response.success) {
          setResponses(response.data.responses);
          // Check if there are CATI responses
          hasCatiResponses = response.data?.responses?.some(r => 
          r.interviewMode?.toUpperCase() === 'CATI'
        );
        }

        // Fetch analytics from backend API (with current filters)
        await fetchAnalytics(filters);

        // Fetch AC Performance Stats
        try {
          const acStatsResponse = await surveyResponseAPI.getACPerformanceStats(surveyId);
          if (acStatsResponse.success) {
            setAcPerformanceStats(acStatsResponse.data);
          }
        } catch (acStatsError) {
          console.error('Error fetching AC performance stats:', acStatsError);
          // Don't show error, just log it - AC stats are optional
        }

        // Fetch Interviewer Performance Stats
        try {
          const interviewerStatsResponse = await surveyResponseAPI.getInterviewerPerformanceStats(surveyId);
          if (interviewerStatsResponse.success) {
            setInterviewerPerformanceStats(interviewerStatsResponse.data);
          }
        } catch (interviewerStatsError) {
          console.error('Error fetching interviewer performance stats:', interviewerStatsError);
          // Don't show error, just log it - interviewer stats are optional
        }
      }
    } catch (error) {
      console.error('Error fetching survey data:', error);
      // Only show error if it's not a network/abort error (which are often harmless)
      // Also suppress errors related to source file fetches (HMR issues)
      if (error.name !== 'AbortError' && 
          !error.message?.includes('Failed to fetch') && 
          !error.message?.includes('.jsx') &&
          !error.stack?.includes('.jsx')) {
      showError('Failed to load survey reports', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch assigned team members for project managers
  useEffect(() => {
    const fetchAssignedInterviewers = async () => {
      console.log('🔍 fetchAssignedInterviewers - isProjectManagerRoute:', isProjectManagerRoute);
      console.log('🔍 fetchAssignedInterviewers - user:', user ? { id: user.id, userType: user.userType, hasAssignedTeamMembers: !!user.assignedTeamMembers } : 'null');
      
      if (isProjectManagerRoute && user && user.userType === 'project_manager') {
        try {
          console.log('🔍 Fetching assigned interviewers from API...');
          // Fetch current user with populated assignedTeamMembers
          const userResponse = await api.get('/api/auth/me');
          
          console.log('🔍 API Response:', {
            success: userResponse.data?.success,
            hasData: !!userResponse.data?.data,
            hasAssignedTeamMembers: !!userResponse.data?.data?.assignedTeamMembers,
            assignedTeamMembersCount: userResponse.data?.data?.assignedTeamMembers?.length || 0
          });
          
          if (userResponse.data?.success && userResponse.data?.data?.assignedTeamMembers) {
            const assignedTeamMembers = userResponse.data.data.assignedTeamMembers;
            console.log('🔍 Raw assignedTeamMembers:', assignedTeamMembers);
            
            // Extract interviewer details from assignedTeamMembers
            const interviewerDetails = assignedTeamMembers
              .filter(tm => {
                const isInterviewer = tm.userType === 'interviewer' && tm.user;
                if (!isInterviewer) {
                  console.log('🔍 Filtered out team member:', { userType: tm.userType, hasUser: !!tm.user });
                }
                return isInterviewer;
              })
              .map(tm => {
                const interviewerUser = tm.user;
                const name = `${interviewerUser.firstName || ''} ${interviewerUser.lastName || ''}`.trim() || 'Unknown';
                console.log('🔍 Processing interviewer:', { name, memberId: interviewerUser.memberId, _id: interviewerUser._id });
                return {
                  _id: interviewerUser._id || interviewerUser,
                  firstName: interviewerUser.firstName || '',
                  lastName: interviewerUser.lastName || '',
                  email: interviewerUser.email || '',
                  memberId: interviewerUser.memberId || '',
                  name: name
                };
              })
              .filter(int => {
                const isValid = !!int._id;
                if (!isValid) {
                  console.log('🔍 Filtered out invalid interviewer:', int);
                }
                return isValid;
              });
            
            console.log('🔍 Extracted interviewerDetails:', interviewerDetails.length, interviewerDetails);
            
            if (interviewerDetails.length > 0) {
              console.log('✅ Setting assignedInterviewers state with', interviewerDetails.length, 'interviewers');
              console.log('✅ Interviewer details sample:', interviewerDetails.slice(0, 3));
              setAssignedInterviewers(interviewerDetails);
              console.log('✅ Fetched assigned interviewers for PM:', interviewerDetails.length, interviewerDetails.map(i => i.name));
              console.log('✅ State set - analytics useMemo should recalculate now');
            } else {
              console.log('⚠️ No assigned interviewers found for project manager after filtering');
              setAssignedInterviewers([]);
            }
          } else if (user?.assignedTeamMembers) {
            console.log('🔍 Using fallback - user.assignedTeamMembers:', user.assignedTeamMembers.length);
            // Fallback: use user object if it already has assignedTeamMembers
            const interviewerDetails = user.assignedTeamMembers
              .filter(tm => tm.userType === 'interviewer' && tm.user)
              .map(tm => {
                const interviewerUser = tm.user._id ? tm.user : tm.user;
                return {
                  _id: typeof interviewerUser === 'object' && interviewerUser._id ? interviewerUser._id : interviewerUser,
                  firstName: interviewerUser.firstName || '',
                  lastName: interviewerUser.lastName || '',
                  email: interviewerUser.email || '',
                  memberId: interviewerUser.memberId || '',
                  name: `${interviewerUser.firstName || ''} ${interviewerUser.lastName || ''}`.trim() || 'Unknown'
                };
              })
              .filter(int => int._id);
            
            if (interviewerDetails.length > 0) {
              setAssignedInterviewers(interviewerDetails);
              console.log('✅ Using assigned interviewers from user object:', interviewerDetails.length);
            } else {
              console.log('⚠️ No valid interviewers in user.assignedTeamMembers');
              setAssignedInterviewers([]);
            }
          } else {
            console.log('⚠️ No assignedTeamMembers found in API response or user object');
            setAssignedInterviewers([]);
          }
        } catch (error) {
          console.error('❌ Error fetching assigned interviewers:', error);
          console.error('❌ Error details:', error.response?.data || error.message);
          setAssignedInterviewers([]);
        }
      } else {
        console.log('🔍 Not fetching assigned interviewers - conditions not met:', {
          isProjectManagerRoute,
          hasUser: !!user,
          userType: user?.userType
        });
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

  // Refetch analytics when filters change (optimized - only analytics, not full data)
  useEffect(() => {
    if (surveyId && survey) {
      // Only refetch analytics, not the full survey/responses data
      // Responses are still needed for dropdowns, but analytics come from backend API
      fetchAnalytics(filters, true); // Pass true to indicate this is a filter change
    }
  }, [filters.status, filters.dateRange, filters.startDate, filters.endDate, filters.interviewMode, filters.ac, filters.district, filters.lokSabha, filters.interviewerIds, filters.interviewerMode]);


  // Helper function to calculate dates from dateRange
  // IMPORTANT: Calculate dates in LOCAL timezone (IST for India)
  // When sending to backend, we send the date string that represents the local date
  // Backend will interpret it correctly by using the date's UTC equivalent
  const calculateDatesFromRange = (dateRange, customStartDate, customEndDate) => {
    const now = new Date();
    let startDate = '';
    let endDate = '';
    
    switch (dateRange) {
      case 'today':
        // Get today's date in local timezone (IST)
        const today = new Date(now);
        const todayYear = today.getFullYear();
        const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
        const todayDay = String(today.getDate()).padStart(2, '0');
        startDate = `${todayYear}-${todayMonth}-${todayDay}`;
        endDate = startDate; // Same date, backend adds 23:59:59.999
        break;
      case 'yesterday':
        // Get yesterday's date in local timezone (IST)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayYear = yesterday.getFullYear();
        const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
        startDate = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
        endDate = startDate; // Same date, backend adds 23:59:59.999
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


  // Helper functions
  const getStateFromGPS = (location) => {
    if (location?.state) return location.state;
    if (location?.address?.state) return location.address.state;
    if (location?.administrative_area_level_1) return location.administrative_area_level_1;
    return 'N/A';
  };

  const getDistrictFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    for (const state of Object.values(assemblyConstituencies.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => 
          ac.acName === acName || ac.acName.toLowerCase() === acName.toLowerCase()
        );
        if (constituency && constituency.district) {
          return constituency.district;
        }
      }
    }
    return 'N/A';
  };

  const getLokSabhaFromAC = (acName) => {
    if (!acName || acName === 'N/A' || !assemblyConstituencies.states) return 'N/A';
    
    for (const state of Object.values(assemblyConstituencies.states)) {
      if (state.assemblyConstituencies) {
        const constituency = state.assemblyConstituencies.find(ac => 
          ac.acName === acName || ac.acName.toLowerCase() === acName.toLowerCase()
        );
        if (constituency && constituency.lokSabha) {
          return constituency.lokSabha;
        }
      }
    }
    return 'N/A';
  };

  const getRespondentInfo = (responses, responseData) => {
    if (!responses || !Array.isArray(responses)) {
      return { name: 'N/A', gender: 'N/A', age: 'N/A', city: 'N/A', district: 'N/A', ac: 'N/A', lokSabha: 'N/A', state: 'N/A' };
    }

    // Helper to find response by question text (ignoring translations)
    const findResponseByQuestionText = (responses, searchTexts) => {
      return responses.find(r => {
        if (!r.questionText) return false;
        const mainText = getMainText(r.questionText).toLowerCase();
        return searchTexts.some(text => mainText.includes(text.toLowerCase()));
      });
    };

    // Get survey ID
    const surveyId = responseData?.survey?._id || responseData?.survey?._id || survey?._id || null;

    // Special handling for survey "68fd1915d41841da463f0d46"
    if (surveyId === '68fd1915d41841da463f0d46') {
      // Find name from name question
      const nameResponse = findResponseByQuestionText(responses, [
        'what is your full name',
        'full name',
        'name'
      ]);
      
      // Find gender from "Please note the respondent's gender"
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
      
      // Last resort: try to find in survey structure if available
      if (!genderResponse && survey) {
        // Find the gender question in the survey
        let genderQuestion = null;
        if (survey.sections) {
          for (const section of survey.sections) {
            if (section.questions) {
              genderQuestion = section.questions.find(q => {
                const qText = getMainText(q.text || '').toLowerCase();
                return qText.includes('please note the respondent\'s gender') ||
                       qText.includes('note the respondent\'s gender') ||
                       qText.includes('respondent\'s gender');
              });
              if (genderQuestion) break;
            }
          }
        }
        
        // If found, try to match by question ID
        if (genderQuestion && genderQuestion.id) {
          genderResponse = responses.find(r => r.questionId === genderQuestion.id);
        }
      }
      
      // Find age from age question
      const ageResponse = findResponseByQuestionText(responses, [
        'could you please tell me your age',
        'your age in complete years',
        'age in complete years',
        'age'
      ]);

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

      // Comprehensive AC extraction function
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
      const district = getDistrictFromAC(acName);
      const lokSabha = getLokSabhaFromAC(acName);
      const state = getStateFromGPS(responseData?.location);

      return {
        name: nameResponse?.response || 'N/A',
        gender: genderResponse?.response || 'N/A',
        age: ageResponse?.response || 'N/A',
        city: city,
        district: district,
        ac: acName,
        lokSabha: lokSabha,
        state: state
      };
    }

    // Default behavior for other surveys
    const nameResponse = responses.find(r => 
      getMainText(r.questionText || '').toLowerCase().includes('name') || 
      getMainText(r.questionText || '').toLowerCase().includes('respondent') ||
      getMainText(r.questionText || '').toLowerCase().includes('full name')
    );
    
    // Find gender response (checks both gender and registered voter questions)
    const genderResponse = findGenderResponse(responses, responseData?.survey);
    
    const ageResponse = responses.find(r => 
      getMainText(r.questionText || '').toLowerCase().includes('age') || 
      getMainText(r.questionText || '').toLowerCase().includes('year')
    );

    const acResponse = responses.find(r => 
      r.questionText.toLowerCase().includes('assembly') ||
      r.questionText.toLowerCase().includes('constituency')
    );

    let city = 'N/A';
    if (responseData?.location?.city) {
      city = responseData.location.city;
    } else {
      const cityResponse = responses.find(r => 
        r.questionText.toLowerCase().includes('city') || 
        r.questionText.toLowerCase().includes('location')
      );
      city = cityResponse?.response || 'N/A';
    }

    const acName = acResponse?.response || 'N/A';
    const district = getDistrictFromAC(acName);
    const lokSabha = getLokSabhaFromAC(acName);
    const state = getStateFromGPS(responseData?.location);

    // Normalize gender response to handle translations
    const genderValue = genderResponse?.response ? normalizeGenderResponse(genderResponse.response) : 'N/A';
    // Convert normalized value back to display format
    const genderDisplay = genderValue === 'male' ? 'Male' : (genderValue === 'female' ? 'Female' : (genderResponse?.response || 'N/A'));

    return {
      name: nameResponse?.response || 'N/A',
      gender: genderDisplay,
      age: ageResponse?.response || 'N/A',
      city: city,
      district: district,
      ac: acName,
      lokSabha: lokSabha,
      state: state
    };
  };

  // Filter responses based on current filters
  const filteredResponses = useMemo(() => {
    if (!responses || responses.length === 0) return [];

    return responses.filter(response => {
      // Date range filter - Use LOCAL timezone (IST) for user's perspective
      if (filters.dateRange !== 'all') {
        const responseDate = new Date(response.createdAt);
        const now = new Date();
        
        switch (filters.dateRange) {
          case 'today':
            // Today in local timezone (IST)
            const today = new Date(now);
            today.setHours(0, 0, 0, 0); // Local midnight
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (responseDate < today || responseDate >= tomorrow) return false;
            break;
          case 'yesterday':
            // Yesterday in local timezone (IST)
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0); // Local midnight
            const yesterdayEnd = new Date(yesterday);
            yesterdayEnd.setHours(23, 59, 59, 999); // Local end of day
            if (responseDate < yesterday || responseDate > yesterdayEnd) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            weekAgo.setHours(0, 0, 0, 0);
            if (responseDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            monthAgo.setHours(0, 0, 0, 0);
            if (responseDate < monthAgo) return false;
            break;
        }
      }

      // Custom date range filter - Use local timezone
      if (filters.startDate && filters.endDate) {
        const responseDate = new Date(response.createdAt);
        // Parse dates in local timezone
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (responseDate < startDate || responseDate > endDate) return false;
      }

      // Interview mode filter
      if (filters.interviewMode && response.interviewMode?.toUpperCase() !== filters.interviewMode.toUpperCase()) {
        return false;
      }

      // Geographic filters
      const respondentInfo = getRespondentInfo(response.responses, response);
      
      if (filters.ac && respondentInfo.ac.toLowerCase() !== filters.ac.toLowerCase()) {
        return false;
      }

      if (filters.district && respondentInfo.district.toLowerCase() !== filters.district.toLowerCase()) {
        return false;
      }

      if (filters.lokSabha && respondentInfo.lokSabha.toLowerCase() !== filters.lokSabha.toLowerCase()) {
        return false;
      }

      // Interviewer filter - support both legacy single interviewer and new multi-select
      if (filters.interviewerIds && filters.interviewerIds.length > 0) {
        // Convert interviewer ID to string for comparison (handles both ObjectId and string)
        const interviewerId = response.interviewer?._id?.toString() || response.interviewer?._id || '';
        // Convert filter IDs to strings for comparison
        const filterIds = filters.interviewerIds.map(id => id?.toString() || id);
        const isIncluded = filterIds.includes(interviewerId);
        
        if (filters.interviewerMode === 'include') {
          // Include mode: only show responses from selected interviewers
          if (!isIncluded) return false;
        } else {
          // Exclude mode: exclude responses from selected interviewers
          if (isIncluded) return false;
        }
      } else if (filters.interviewer) {
        // Legacy single interviewer filter (backward compatibility)
        const interviewerName = response.interviewer 
          ? `${response.interviewer.firstName} ${response.interviewer.lastName}`.toLowerCase()
          : '';
        if (!interviewerName.includes(filters.interviewer.toLowerCase())) return false;
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
          // Filter by specific status
          if (response.status !== filters.status) {
            return false;
          }
        }
      } else {
        // Default (status === 'all' or undefined): Show both Approved and Rejected
        if (response.status !== 'Approved' && response.status !== 'Rejected') {
          return false;
        }
      }

      return true;
    });
  }, [responses, filters]);

  // Prepare chart data for response trends over time
  const prepareChartData = () => {
    if (!analytics.dailyStats || analytics.dailyStats.length === 0) {
      return null;
    }

    const dailyData = analytics.dailyStats;
    
    // Sort data by date
    const sortedData = dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedData.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    });

    const totalResponsesData = sortedData.map(item => item.count);
    
    // Use CAPI and CATI data from backend daily stats (if available)
    const capiData = sortedData.map(item => {
      // Backend now provides daily CAPI/CATI breakdown
      if (item.capi !== undefined) {
        return item.capi;
      }
      // Fallback: estimate based on total responses (for backward compatibility)
      return Math.round(item.count * (analytics.capiResponses / Math.max(analytics.totalResponses, 1)));
    });
    
    const catiData = sortedData.map(item => {
      // Backend now provides daily CAPI/CATI breakdown
      if (item.cati !== undefined) {
        return item.cati;
      }
      // Fallback: estimate based on total responses (for backward compatibility)
      return Math.round(item.count * (analytics.catiResponses / Math.max(analytics.totalResponses, 1)));
    });

    return {
      labels,
      datasets: [
        {
          label: 'Total Responses',
          data: totalResponsesData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'CAPI Responses',
          data: capiData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'CATI Responses',
          data: catiData,
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        }
      ]
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date',
          font: {
            size: 12,
            weight: '600'
          }
        },
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 8,
          font: {
            size: 11
          }
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Number of Responses',
          font: {
            size: 12,
            weight: '600'
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          },
          maxTicksLimit: 20, // Limit to 20 ticks maximum to prevent Chart.js warning
          stepSize: undefined, // Let Chart.js calculate optimal stepSize automatically instead of forcing 1
          callback: function(value) {
            return Number.isInteger(value) ? value : null;
          }
        }
      }
    }
  };

  // Helper function to get option text from option value/code
  const getOptionTextFromValue = (value, question) => {
    if (!question || !question.options || !value) {
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
    
    // If not found, return the value as is
    return value;
  };

  // Helper function to find gender question in survey
  const findGenderQuestionInSurvey = (survey) => {
    if (!survey || !survey.sections) return null;
    
    for (const section of survey.sections) {
      if (section.questions) {
        for (const question of section.questions) {
          const qText = getMainText(question.text || '').toLowerCase();
          if (qText.includes('please note the respondent\'s gender') ||
              qText.includes('note the respondent\'s gender') ||
              qText.includes('respondent\'s gender') ||
              qText.includes('gender') ||
              question.id?.includes('gender') ||
              question.id?.includes('respondent_gender')) {
            return question;
          }
        }
      }
    }
    return null;
  };

  // Helper function to extract numeric AC code (remove state prefix and leading zeros)
  // e.g., "WB001" -> "1", "WB010" -> "10", "WB100" -> "100"
  const getNumericACCode = (acCode) => {
    if (!acCode || typeof acCode !== 'string') return '';
    
    // Remove state prefix (alphabets at the start) and extract numeric part
    const numericPart = acCode.replace(/^[A-Z]+/, '');
    
    // Remove leading zeros and return as string
    // If all zeros, return "0", otherwise return the number without leading zeros
    const numericValue = parseInt(numericPart, 10);
    return isNaN(numericValue) ? '' : numericValue.toString();
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    // If we have analytics from backend (optimized aggregation), use it directly
    if (analyticsFromBackend) {
      // Enhance AC stats: Add ACs with 0 responses and AC/PC codes
      let acStats = analyticsFromBackend.acStats || [];
      
      // Helper to normalize AC name for comparison
      const normalizeACName = (acName) => {
        if (!acName || typeof acName !== 'string') return '';
        return acName.trim().toLowerCase().replace(/\s+/g, ' ');
      };
      
      // Helper to get AC/PC data
      const getACPCData = (acName, acCodeFromStat = null) => {
        let numericACCode = acCodeFromStat || '';
        
        if (!numericACCode) {
          const acData = getACByName(acName);
          if (acData?.acCode) {
            numericACCode = getNumericACCode(acData.acCode);
          }
        }
        
        // Check cache
        if (acPCMappingCache.has(acName)) {
          const cached = acPCMappingCache.get(acName);
          return {
            acCode: numericACCode || cached.acCode || '',
            pcCode: cached.pcCode || '',
            pcName: cached.pcName || ''
          };
        }
        
        return {
          acCode: numericACCode,
          pcCode: '',
          pcName: ''
        };
      };
      
      // Enhance existing AC stats with AC/PC codes if missing
      acStats = acStats.map(stat => {
        if (!stat.acCode || !stat.pcCode) {
          const acPCData = getACPCData(stat.ac, stat.acCode);
          return {
            ...stat,
            acCode: stat.acCode || acPCData.acCode || '',
            pcCode: stat.pcCode || acPCData.pcCode || '',
            pcName: stat.pcName || acPCData.pcName || '',
            // Ensure all required fields are present
            autoRejected: stat.autoRejected || 0,
            manualRejected: stat.manualRejected || 0,
            underQC: stat.underQC || 0,
            psCovered: stat.psCovered || 0
          };
        }
        return stat;
      });
      
      // Get all ACs for the state and add missing ones (with 0 responses)
      const allStateACs = getAllACsForState();
      const acsWithResponsesNormalized = new Set(
        acStats.map(stat => normalizeACName(stat.ac))
      );
      
      // Add ACs with 0 responses
      const acsWithZeroResponses = allStateACs
        .filter(acName => {
          const normalized = normalizeACName(acName);
          return !acsWithResponsesNormalized.has(normalized);
        })
        .map(acName => {
          const acPCData = getACPCData(acName);
          return {
            ac: acName,
            acCode: acPCData.acCode,
            pcCode: acPCData.pcCode,
            pcName: acPCData.pcName,
            count: 0,
            capi: 0,
            cati: 0,
            percentage: 0,
            interviewersCount: 0,
            approved: 0,
            rejected: 0,
            autoRejected: 0,
            manualRejected: 0,
            underQC: 0,
            psCovered: 0,
            femalePercentage: 0,
            withoutPhonePercentage: 0,
            scPercentage: 0,
            muslimPercentage: 0,
            age18to24Percentage: 0,
            age50PlusPercentage: 0
          };
        })
        .sort((a, b) => a.ac.localeCompare(b.ac));
      
      // Combine: ACs with responses first (sorted by count), then ACs with 0 responses (sorted by name)
      acStats = [
        ...acStats.sort((a, b) => b.count - a.count),
        ...acsWithZeroResponses
      ];
      
      // Store allStateACs for modal use
      acStats._allStateACs = allStateACs;
      
      // Add assigned interviewers with 0 responses for project managers if needed
      let interviewerStats = analyticsFromBackend.interviewerStats || [];
      
      if (isProjectManagerRoute && assignedInterviewers !== null && Array.isArray(assignedInterviewers) && assignedInterviewers.length > 0) {
        const existingInterviewerIds = new Set(interviewerStats.map(stat => stat.interviewerId?.toString()));
        const interviewersWithZeroResponses = assignedInterviewers
          .filter(interviewer => {
            const interviewerId = interviewer._id?.toString() || interviewer.id?.toString();
            return !existingInterviewerIds.has(interviewerId);
          })
          .map(interviewer => ({
            interviewer: interviewer.name || `${interviewer.firstName} ${interviewer.lastName}`.trim() || 'Unknown',
            interviewerId: interviewer._id || interviewer.id,
            memberId: interviewer.memberId || '',
            count: 0,
            approved: 0,
            rejected: 0,
            autoRejected: 0,
            manualRejected: 0,
            pending: 0,
            underQC: 0,
            capi: 0,
            cati: 0,
            percentage: 0,
            psCovered: 0,
            femalePercentage: 0,
            withoutPhonePercentage: 0,
            scPercentage: 0,
            muslimPercentage: 0,
            age18to24Percentage: 0,
            age50PlusPercentage: 0
          }))
          .sort((a, b) => a.interviewer.localeCompare(b.interviewer));
        
        interviewerStats = [
          ...interviewerStats.sort((a, b) => b.count - a.count),
          ...interviewersWithZeroResponses
        ];
      }
      
      return {
        ...analyticsFromBackend,
        acStats,
        interviewerStats
      };
    }
    
    // Fallback: Calculate from filteredResponses (old method - for backward compatibility)
    // Handle empty responses case - but still include assigned interviewers for PMs
    if (!filteredResponses || filteredResponses.length === 0) {
      // For project managers: Add assigned interviewers with 0 responses even when there are no responses
      let interviewerStats = [];
      if (isProjectManagerRoute && assignedInterviewers !== null && Array.isArray(assignedInterviewers) && assignedInterviewers.length > 0) {
        console.log('🔍 Analytics (empty responses) - Adding', assignedInterviewers.length, 'assigned interviewers');
        interviewerStats = assignedInterviewers
          .map(interviewer => ({
            interviewer: interviewer.name || `${interviewer.firstName} ${interviewer.lastName}`.trim() || 'Unknown',
            memberId: interviewer.memberId || '',
            count: 0,
            approved: 0,
            rejected: 0,
            autoRejected: 0,
            manualRejected: 0,
            pending: 0,
            underQC: 0,
            capi: 0,
            cati: 0,
            percentage: 0,
            psCovered: 0,
            femalePercentage: 0,
            withoutPhonePercentage: 0,
            scPercentage: 0,
            muslimPercentage: 0,
            age18to24Percentage: 0,
            age50PlusPercentage: 0
          }))
          .sort((a, b) => a.interviewer.localeCompare(b.interviewer)); // Sort by name
        console.log('✅ Analytics (empty responses) - Created interviewerStats with', interviewerStats.length, 'interviewers');
      }
      
      return {
        totalResponses: 0,
        capiResponses: 0,
        catiResponses: 0,
        completionRate: 0,
        averageResponseTime: 0,
        acStats: [],
        districtStats: [],
        lokSabhaStats: [],
        interviewerStats: interviewerStats,
        genderStats: {},
        ageStats: {},
        dailyStats: [],
        capiPerformance: {
          approved: 0,
          rejected: 0,
          total: 0
        },
        catiPerformance: {
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
        }
      };
    }

    // Basic stats
    const totalResponses = filteredResponses.length;
    const capiResponses = filteredResponses.filter(r => r.interviewMode?.toUpperCase() === 'CAPI').length;
    const catiResponses = filteredResponses.filter(r => r.interviewMode?.toUpperCase() === 'CATI').length;
    
    // Calculate completion rate (assuming all approved responses are complete)
    const completionRate = survey?.sampleSize ? (totalResponses / survey.sampleSize) * 100 : 0;
    
    // Calculate average response time
    const totalResponseTime = filteredResponses.reduce((sum, r) => {
      return sum + (r.responses?.reduce((responseSum, resp) => responseSum + (resp.responseTime || 0), 0) || 0);
    }, 0);
    const averageResponseTime = totalResponseTime / totalResponses;

    // Helper function to find question response by keywords
    const findQuestionResponse = (responses, keywords) => {
      if (!responses || !Array.isArray(responses)) return null;
      return responses.find(r => {
        const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
        return keywords.some(keyword => questionText.includes(keyword.toLowerCase()));
      });
    };

    // Helper function to get main text value (handle translations)
    const getMainTextValue = (text) => {
      if (!text) return '';
      if (typeof text === 'string') {
        return getMainText(text);
      }
      if (typeof text === 'object' && text !== null) {
        return getMainText(text.text || text.value || text || '');
      }
      return String(text);
    };

    // AC-wise stats with demographic data
    const acMap = new Map();
    const districtMap = new Map();
    const lokSabhaMap = new Map();
    const interviewerMap = new Map();
    const genderMap = new Map();
    const ageMap = new Map();
    const dailyMap = new Map();

    filteredResponses.forEach(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      const responseData = response.responses || [];
      
      // Extract AC code from response (prefer selectedPollingStation.acNo, fallback to extracting from AC name)
      const getACCodeFromResponse = (response) => {
        // Priority 1: Use selectedPollingStation.acNo if available
        if (response.selectedPollingStation?.acNo) {
          return getNumericACCode(String(response.selectedPollingStation.acNo));
        }
        
        // Priority 2: Extract from AC name
        const ac = respondentInfo.ac;
        if (ac && ac !== 'N/A') {
          const acData = getACByName(ac);
          if (acData?.acCode) {
            return getNumericACCode(acData.acCode);
          }
        }
        
        return '';
      };
      
      // Extract polling station info for PS Covered calculation
      const getPollingStationInfo = (response) => {
        const psInfo = response.selectedPollingStation;
        if (psInfo?.stationName) {
          return {
            stationName: psInfo.stationName,
            groupName: psInfo.groupName,
            acNo: psInfo.acNo ? getNumericACCode(String(psInfo.acNo)) : '',
            pcNo: psInfo.pcNo,
            pcName: psInfo.pcName
          };
        }
        return null;
      };
      
      // AC stats
      const ac = respondentInfo.ac;
      if (ac && ac !== 'N/A') {
        const acCode = getACCodeFromResponse(response);
        const psInfo = getPollingStationInfo(response);
        
        const currentCount = acMap.get(ac) || { 
          total: 0, 
          capi: 0, 
          cati: 0,
          interviewers: new Set(),
          approved: 0,
          rejected: 0,
          autoRejected: 0, // Track auto-rejected responses
          manualRejected: 0, // Track manually rejected responses
          underQC: 0,
          femaleCount: 0,
          withoutPhoneCount: 0,
          scCount: 0,
          muslimCount: 0,
          age18to24Count: 0,
          age50PlusCount: 0,
          pollingStations: new Set(), // Track unique polling stations for PS Covered
          acCode: acCode, // Store AC code for this AC
          pcNo: null, // Will be set from polling station data
          pcName: null // Will be set from polling station data
        };
        currentCount.total += 1;
        
        // Track unique polling stations (PS Covered)
        if (psInfo?.stationName) {
          const psKey = `${psInfo.stationName}${psInfo.groupName ? `-${psInfo.groupName}` : ''}`;
          currentCount.pollingStations.add(psKey);
        }
        
        // Update PC data from polling station info if available
        if (psInfo?.pcNo) {
          currentCount.pcNo = psInfo.pcNo;
        }
        if (psInfo?.pcName) {
          currentCount.pcName = psInfo.pcName;
        }
        if (psInfo?.acNo && !currentCount.acCode) {
          currentCount.acCode = psInfo.acNo;
        }
        
        // Check interview mode
        const interviewMode = response.interviewMode?.toUpperCase();
        if (interviewMode === 'CAPI') {
          currentCount.capi += 1;
        } else if (interviewMode === 'CATI') {
          currentCount.cati += 1;
        }
        
        // Track unique interviewers
        if (response.interviewer && response.interviewer._id) {
          currentCount.interviewers.add(response.interviewer._id.toString());
        }
        
        // Track status counts with auto-rejection detection
        if (response.status === 'Approved') {
          currentCount.approved += 1;
        } else if (response.status === 'Rejected') {
          // Check if it's auto-rejected
          const isAutoRejected = response.verificationData?.autoRejected === true || 
                                 (response.verificationData?.autoRejectionReasons && 
                                  response.verificationData.autoRejectionReasons.length > 0) ||
                                 (response.verificationData?.feedback && (
                                   response.verificationData.feedback.includes('Interview Too Short') ||
                                   response.verificationData.feedback.includes('Not Voter') ||
                                   response.verificationData.feedback.includes('Not a Registered Voter') ||
                                   response.verificationData.feedback.includes('Duplicate Response')
                                 ));
          
          if (isAutoRejected) {
            currentCount.autoRejected = (currentCount.autoRejected || 0) + 1;
          } else {
            currentCount.manualRejected = (currentCount.manualRejected || 0) + 1;
          }
          // Keep rejected for backward compatibility (total rejected = auto + manual)
          currentCount.rejected += 1;
        } else if (response.status === 'Pending_Approval') {
          // Count ALL Pending_Approval responses as Under QC
          // This includes responses in batches (collecting phase) and those queued for QC
          currentCount.underQC += 1;
        }

        // Demographic calculations
        // Female count
        const genderResponse = findGenderResponse(responseData, survey) || findQuestionResponse(responseData, ['gender', 'sex']);
        if (genderResponse?.response) {
          const normalizedGender = normalizeGenderResponse(genderResponse.response);
          if (normalizedGender === 'female') {
            currentCount.femaleCount += 1;
          }
        }

        // Phone number check - look for specific phone question text
        let phoneResponse = responseData.find(r => {
          const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
          return questionText.includes('mobile number') || 
                 questionText.includes('phone number') ||
                 questionText.includes('share your mobile') ||
                 questionText.includes('would you like to share your mobile');
        });
        
        // If not found, try generic search
        if (!phoneResponse) {
          phoneResponse = findQuestionResponse(responseData, ['phone', 'mobile', 'contact', 'number']);
        }
        
        // Check if phone number is missing or invalid
        if (!phoneResponse?.response || 
            String(phoneResponse.response).trim() === '' || 
            String(phoneResponse.response).trim() === 'N/A' ||
            String(phoneResponse.response).trim() === '0') {
          currentCount.withoutPhoneCount += 1;
        }

        // SC count (only for survey 68fd1915d41841da463f0d46)
        if (surveyId === '68fd1915d41841da463f0d46') {
          const casteResponse = findQuestionResponse(responseData, ['caste', 'scheduled cast', 'sc', 'category']);
          if (casteResponse?.response) {
            const casteValue = getMainTextValue(String(casteResponse.response)).toLowerCase();
            if (casteValue.includes('scheduled cast') || 
                casteValue.includes('sc') || 
                casteValue.includes('scheduled caste')) {
              currentCount.scCount += 1;
            }
          }
        }

        // Muslim count
        const religionResponse = findQuestionResponse(responseData, ['religion', 'muslim', 'hindu', 'christian']);
        if (religionResponse?.response) {
          const religionValue = getMainTextValue(String(religionResponse.response)).toLowerCase();
          if (religionValue.includes('muslim') || religionValue.includes('islam')) {
            currentCount.muslimCount += 1;
          }
        }

        // Age groups
        const ageResponse = findQuestionResponse(responseData, ['age', 'year']);
        if (ageResponse?.response) {
          const age = parseInt(ageResponse.response);
          if (!isNaN(age) && age > 0 && age < 150) {
            if (age >= 18 && age <= 24) {
              currentCount.age18to24Count += 1;
            }
            if (age >= 50) {
              currentCount.age50PlusCount += 1;
            }
          }
        }
        
        acMap.set(ac, currentCount);
      }

      // District stats
      const district = respondentInfo.district;
      if (district && district !== 'N/A') {
        districtMap.set(district, (districtMap.get(district) || 0) + 1);
      }

      // Lok Sabha stats
      const lokSabha = respondentInfo.lokSabha;
      if (lokSabha && lokSabha !== 'N/A') {
        lokSabhaMap.set(lokSabha, (lokSabhaMap.get(lokSabha) || 0) + 1);
      }

      // Interviewer stats with polling stations and demographics
      if (response.interviewer) {
        const interviewerName = `${response.interviewer.firstName} ${response.interviewer.lastName}`;
        const interviewerMemberId = response.interviewer.memberId || response.interviewer.memberID || '';
        const psInfo = getPollingStationInfo(response);
        
        const currentCount = interviewerMap.get(interviewerName) || { 
          total: 0, 
          capi: 0,
          cati: 0,
          approved: 0, 
          rejected: 0,
          autoRejected: 0, // Track auto-rejected responses
          manualRejected: 0, // Track manually rejected responses
          pending: 0,
          pollingStations: new Set(), // Track unique polling stations for PS Covered
          femaleCount: 0,
          withoutPhoneCount: 0,
          scCount: 0,
          muslimCount: 0,
          age18to24Count: 0,
          age50PlusCount: 0,
          memberId: interviewerMemberId // Store memberId for display
        };
        
        // Update memberId if not set (in case it was missing in first response)
        if (!currentCount.memberId && interviewerMemberId) {
          currentCount.memberId = interviewerMemberId;
        }
        currentCount.total += 1;
        
        // Track unique polling stations (PS Covered)
        if (psInfo?.stationName) {
          const psKey = `${psInfo.stationName}${psInfo.groupName ? `-${psInfo.groupName}` : ''}`;
          currentCount.pollingStations.add(psKey);
        }
        
        // Check interview mode
        const interviewMode = response.interviewMode?.toUpperCase();
        if (interviewMode === 'CAPI') {
          currentCount.capi += 1;
        } else if (interviewMode === 'CATI') {
          currentCount.cati += 1;
        }
        
        // Track status counts with auto-rejection detection
        if (response.status === 'Approved') {
          currentCount.approved += 1;
        } else if (response.status === 'Rejected') {
          // Check if it's auto-rejected
          const isAutoRejected = response.verificationData?.autoRejected === true || 
                                 (response.verificationData?.autoRejectionReasons && 
                                  response.verificationData.autoRejectionReasons.length > 0) ||
                                 (response.verificationData?.feedback && (
                                   response.verificationData.feedback.includes('Interview Too Short') ||
                                   response.verificationData.feedback.includes('Not Voter') ||
                                   response.verificationData.feedback.includes('Not a Registered Voter') ||
                                   response.verificationData.feedback.includes('Duplicate Response')
                                 ));
          
          if (isAutoRejected) {
            currentCount.autoRejected += 1;
          } else {
            currentCount.manualRejected += 1;
          }
          // Keep rejected for backward compatibility (total rejected = auto + manual)
          currentCount.rejected += 1;
        } else if (response.status === 'Pending_Approval') {
          // Count ALL Pending_Approval responses as Under QC (pending)
          // This includes responses in batches (collecting phase) and those queued for QC
          currentCount.pending += 1;
        }
        
        // Demographic calculations for interviewer
        const genderResponse = findGenderResponse(responseData, survey) || findQuestionResponse(responseData, ['gender', 'sex']);
        if (genderResponse?.response) {
          const normalizedGender = normalizeGenderResponse(genderResponse.response);
          if (normalizedGender === 'female') {
            currentCount.femaleCount += 1;
          }
        }

        // Phone number check for interviewer - look for specific phone question text
        let phoneResponse = responseData.find(r => {
          const questionText = getMainText(r.questionText || r.question?.text || '').toLowerCase();
          return questionText.includes('mobile number') || 
                 questionText.includes('phone number') ||
                 questionText.includes('share your mobile') ||
                 questionText.includes('would you like to share your mobile');
        });
        
        // If not found, try generic search
        if (!phoneResponse) {
          phoneResponse = findQuestionResponse(responseData, ['phone', 'mobile', 'contact', 'number']);
        }
        
        // Check if phone number is missing or invalid
        if (!phoneResponse?.response || 
            String(phoneResponse.response).trim() === '' || 
            String(phoneResponse.response).trim() === 'N/A' ||
            String(phoneResponse.response).trim() === '0') {
          currentCount.withoutPhoneCount += 1;
        }

        if (surveyId === '68fd1915d41841da463f0d46') {
          const casteResponse = findQuestionResponse(responseData, ['caste', 'scheduled cast', 'sc', 'category']);
          if (casteResponse?.response) {
            const casteValue = getMainTextValue(String(casteResponse.response)).toLowerCase();
            if (casteValue.includes('scheduled cast') || 
                casteValue.includes('sc') || 
                casteValue.includes('scheduled caste')) {
              currentCount.scCount += 1;
            }
          }
        }

        const religionResponse = findQuestionResponse(responseData, ['religion', 'muslim', 'hindu', 'christian']);
        if (religionResponse?.response) {
          const religionValue = getMainTextValue(String(religionResponse.response)).toLowerCase();
          if (religionValue.includes('muslim') || religionValue.includes('islam')) {
            currentCount.muslimCount += 1;
          }
        }

        const ageResponse = findQuestionResponse(responseData, ['age', 'year']);
        if (ageResponse?.response) {
          const age = parseInt(ageResponse.response);
          if (!isNaN(age) && age > 0 && age < 150) {
            if (age >= 18 && age <= 24) {
              currentCount.age18to24Count += 1;
            }
            if (age >= 50) {
              currentCount.age50PlusCount += 1;
            }
          }
        }
        
        interviewerMap.set(interviewerName, currentCount);
      }

      // Gender stats - convert option code to option text
      const gender = respondentInfo.gender;
      if (gender && gender !== 'N/A') {
        // Find the gender question in the survey
        const genderQuestion = findGenderQuestionInSurvey(survey);
        let genderText = gender;
        
        // If we found the gender question, try to get the option text
        if (genderQuestion) {
          genderText = getOptionTextFromValue(gender, genderQuestion);
        } else {
          // Fallback: try to normalize using getMainText if it contains translations
          genderText = getMainText(gender);
        }
        
        // Use the text (without translations) as the key
        genderMap.set(genderText, (genderMap.get(genderText) || 0) + 1);
      }

      // Age stats
      const age = parseInt(respondentInfo.age);
      if (!isNaN(age)) {
        const ageGroup = Math.floor(age / 10) * 10;
        ageMap.set(ageGroup, (ageMap.get(ageGroup) || 0) + 1);
      }

      // Daily stats
      const date = new Date(response.createdAt).toDateString();
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    });

    // Helper to normalize AC name for comparison (remove extra spaces, trim, lowercase)
    const normalizeACName = (acName) => {
      if (!acName || typeof acName !== 'string') return '';
      return acName.trim().toLowerCase().replace(/\s+/g, ' ');
    };

    // Helper to get AC/PC data from AC name or AC code
    // Match by AC code (numeric) - this is the reliable way to match
    const getACPCData = (acName, acCodeFromMap = null) => {
      // Use AC code from map if available (more reliable)
      let numericACCode = acCodeFromMap || '';
      
      // If no AC code from map, try to get from AC name
      if (!numericACCode) {
        const acData = getACByName(acName);
        if (acData?.acCode) {
          numericACCode = getNumericACCode(acData.acCode);
        }
      }
      
      // Check cache by AC code first (most reliable)
      if (numericACCode) {
        for (const [cachedAcName, cachedData] of acPCMappingCache.entries()) {
          if (cachedData.acCode === numericACCode) {
            return {
              acCode: numericACCode,
              pcCode: cachedData.pcCode || '',
              pcName: cachedData.pcName || ''
            };
          }
        }
      }
      
      // Check cache by AC name (fallback)
      if (acPCMappingCache.has(acName)) {
        const cached = acPCMappingCache.get(acName);
        return {
          acCode: numericACCode || cached.acCode || '',
          pcCode: cached.pcCode || '',
          pcName: cached.pcName || ''
        };
      }
      
      // Return AC code, PC data will be fetched async and cached
      return {
        acCode: numericACCode,
        pcCode: '',
        pcName: ''
      };
    };

    // Convert maps to sorted arrays - First get ACs with responses
    const acStatsWithResponses = Array.from(acMap.entries())
      .map(([ac, data]) => {
        const acPCData = getACPCData(ac, data.acCode);
        const total = data.total;
        
        return { 
          ac, 
          acCode: acPCData.acCode || data.acCode || '',
          pcCode: data.pcNo ? String(data.pcNo) : (acPCData.pcCode || ''),
          pcName: data.pcName || acPCData.pcName || '',
          count: total, 
          capi: data.capi, 
          cati: data.cati, 
          percentage: totalResponses > 0 ? (total / totalResponses) * 100 : 0,
          interviewersCount: data.interviewers ? data.interviewers.size : 0,
          approved: data.approved || 0,
          rejected: data.rejected || 0,
          autoRejected: data.autoRejected || 0,
          manualRejected: data.manualRejected || 0,
          underQC: data.underQC || 0,
          psCovered: data.pollingStations ? data.pollingStations.size : 0, // PS Covered = unique polling stations
          // Demographic percentages (calculated from filtered responses)
          femalePercentage: total > 0 ? (data.femaleCount / total) * 100 : 0,
          withoutPhonePercentage: total > 0 ? (data.withoutPhoneCount / total) * 100 : 0,
          scPercentage: total > 0 ? (data.scCount / total) * 100 : 0,
          muslimPercentage: total > 0 ? (data.muslimCount / total) * 100 : 0,
          age18to24Percentage: total > 0 ? (data.age18to24Count / total) * 100 : 0,
          age50PlusPercentage: total > 0 ? (data.age50PlusCount / total) * 100 : 0
        };
      })
      .sort((a, b) => b.count - a.count);

    // Get all ACs for the state
    const allStateACs = getAllACsForState();
    console.log('🔍 Analytics - allStateACs:', allStateACs.length, 'ACs');
    console.log('🔍 Analytics - acStatsWithResponses:', acStatsWithResponses.length, 'ACs with responses');
    console.log('🔍 Analytics - acStatsWithResponses details:', acStatsWithResponses);
    
    // Create a normalized set of ACs that already have responses (for comparison)
    const acsWithResponsesNormalized = new Set(
      acStatsWithResponses.map(stat => normalizeACName(stat.ac))
    );
    console.log('🔍 Analytics - acsWithResponsesNormalized set:', Array.from(acsWithResponsesNormalized));
    
    // Create a map of normalized AC names to original AC names from responses
    const normalizedToOriginalMap = new Map();
    acStatsWithResponses.forEach(stat => {
      const normalized = normalizeACName(stat.ac);
      if (!normalizedToOriginalMap.has(normalized)) {
        normalizedToOriginalMap.set(normalized, stat.ac);
      }
    });
    
    // Add ACs with 0 responses - use normalized comparison to find missing ACs
    const acsWithZeroResponses = allStateACs
      .filter(acName => {
        const normalized = normalizeACName(acName);
        return !acsWithResponsesNormalized.has(normalized);
      })
      .map(acName => {
        const acPCData = getACPCData(acName);
        return {
          ac: acName,
          acCode: acPCData.acCode,
          pcCode: acPCData.pcCode,
          pcName: acPCData.pcName,
          count: 0,
          capi: 0,
          cati: 0,
          percentage: 0,
          interviewersCount: 0,
          approved: 0,
          rejected: 0,
          underQC: 0,
          psCovered: 0,
          femalePercentage: 0,
          withoutPhonePercentage: 0,
          scPercentage: 0,
          muslimPercentage: 0,
          age18to24Percentage: 0,
          age50PlusPercentage: 0
        };
      })
      .sort((a, b) => a.ac.localeCompare(b.ac));

    console.log('🔍 Analytics - acsWithZeroResponses:', acsWithZeroResponses.length, 'ACs with 0 responses');
    console.log('🔍 Analytics - acsWithZeroResponses sample:', acsWithZeroResponses.slice(0, 3));

    // Combine and sort: ACs with responses first, then ACs with 0 responses
    const acStats = [...acStatsWithResponses, ...acsWithZeroResponses];
    console.log('🔍 Analytics - Final acStats:', acStats.length, 'total ACs');
    console.log('🔍 Analytics - Final acStats sample:', acStats.slice(0, 5));
    
    // Store allStateACs for use in modal (to ensure all ACs are always shown)
    acStats._allStateACs = allStateACs;

    const districtStats = Array.from(districtMap.entries())
      .map(([district, count]) => ({ district, count, percentage: (count / totalResponses) * 100 }))
      .sort((a, b) => b.count - a.count);

    const lokSabhaStats = Array.from(lokSabhaMap.entries())
      .map(([lokSabha, count]) => ({ lokSabha, count, percentage: (count / totalResponses) * 100 }))
      .sort((a, b) => b.count - a.count);

    // Calculate interviewer stats from responses
    const interviewerStatsFromResponses = Array.from(interviewerMap.entries())
      .map(([interviewer, data]) => {
        // Handle both object format (new) and number format (old/backward compatibility)
        const isObject = typeof data === 'object' && data !== null;
        const total = isObject ? (data.total || 0) : (data || 0);
        const approved = isObject ? (data.approved || 0) : 0;
        const rejected = isObject ? (data.rejected || 0) : 0;
        const autoRejected = isObject ? (data.autoRejected || 0) : 0;
        const manualRejected = isObject ? (data.manualRejected || 0) : 0;
        const pending = isObject ? (data.pending || 0) : 0;
        const capi = isObject ? (data.capi || 0) : 0;
        const cati = isObject ? (data.cati || 0) : 0;
        
        return {
          interviewer,
          memberId: isObject ? (data.memberId || '') : '', // Include memberId in stats
          count: total,
          approved: approved,
          rejected: rejected,
          autoRejected: autoRejected,
          manualRejected: manualRejected,
          pending: pending, // This is Under QC (Pending_Approval status)
          underQC: pending, // Alias for consistency with AC stats
          capi: capi,
          cati: cati,
          percentage: totalResponses > 0 ? (total / totalResponses) * 100 : 0,
          psCovered: isObject && data.pollingStations ? data.pollingStations.size : 0,
          // Demographic percentages
          femalePercentage: total > 0 && isObject ? (data.femaleCount / total) * 100 : 0,
          withoutPhonePercentage: total > 0 && isObject ? (data.withoutPhoneCount / total) * 100 : 0,
          scPercentage: total > 0 && isObject ? (data.scCount / total) * 100 : 0,
          muslimPercentage: total > 0 && isObject ? (data.muslimCount / total) * 100 : 0,
          age18to24Percentage: total > 0 && isObject ? (data.age18to24Count / total) * 100 : 0,
          age50PlusPercentage: total > 0 && isObject ? (data.age50PlusCount / total) * 100 : 0
        };
      })
      .sort((a, b) => b.count - a.count);
    
    // For project managers: Add assigned interviewers with 0 responses
    let interviewerStats = [...interviewerStatsFromResponses];
    
    console.log('🔍 Analytics calculation - isProjectManagerRoute:', isProjectManagerRoute);
    console.log('🔍 Analytics calculation - assignedInterviewers:', assignedInterviewers);
    console.log('🔍 Analytics calculation - assignedInterviewers type:', typeof assignedInterviewers);
    console.log('🔍 Analytics calculation - assignedInterviewers length:', assignedInterviewers?.length || 0);
    console.log('🔍 Analytics calculation - assignedInterviewers isArray:', Array.isArray(assignedInterviewers));
    console.log('🔍 Analytics calculation - interviewerStatsFromResponses:', interviewerStatsFromResponses.length);
    
    if (isProjectManagerRoute && assignedInterviewers && Array.isArray(assignedInterviewers) && assignedInterviewers.length > 0) {
      console.log('🔍 Analytics calculation - ENTERING PM ROUTE LOGIC');
      console.log('🔍 PM Route - assignedInterviewers:', assignedInterviewers.length);
      console.log('🔍 PM Route - assignedInterviewers names:', assignedInterviewers.map(i => i.name));
      console.log('🔍 PM Route - interviewerStatsFromResponses:', interviewerStatsFromResponses.length);
      
      // Create a map of existing interviewer stats by memberId and name for easier lookup
      const existingStatsMap = new Map();
      interviewerStatsFromResponses.forEach(stat => {
        const key1 = stat.memberId?.toString()?.toLowerCase();
        const key2 = stat.interviewer?.toLowerCase();
        if (key1) existingStatsMap.set(key1, stat);
        if (key2) existingStatsMap.set(key2, stat);
      });
      
      // Add assigned interviewers with 0 responses (those not already in stats)
      const interviewersWithZeroResponses = assignedInterviewers
        .filter(interviewer => {
          const interviewerName = (interviewer.name || `${interviewer.firstName} ${interviewer.lastName}`.trim() || 'Unknown').toLowerCase();
          const interviewerMemberId = interviewer.memberId?.toString()?.toLowerCase();
          
          // Check if this interviewer already exists in stats
          const existsByName = existingStatsMap.has(interviewerName);
          const existsByMemberId = interviewerMemberId && existingStatsMap.has(interviewerMemberId);
          
          // Also check by direct comparison
          const existsInStats = interviewerStatsFromResponses.some(stat => {
            const statName = stat.interviewer?.toLowerCase();
            const statMemberId = stat.memberId?.toString()?.toLowerCase();
            return (statName === interviewerName) || 
                   (statMemberId && interviewerMemberId && statMemberId === interviewerMemberId);
          });
          
          const shouldInclude = !existsByName && !existsByMemberId && !existsInStats;
          
          if (!shouldInclude) {
            console.log('🔍 Skipping interviewer (already in stats):', interviewer.name || interviewer.firstName);
          }
          
          return shouldInclude;
        })
        .map(interviewer => ({
          interviewer: interviewer.name || `${interviewer.firstName} ${interviewer.lastName}`.trim() || 'Unknown',
          memberId: interviewer.memberId || '',
          count: 0,
          approved: 0,
          rejected: 0,
          autoRejected: 0,
          manualRejected: 0,
          pending: 0,
          underQC: 0,
          capi: 0,
          cati: 0,
          percentage: 0,
          psCovered: 0,
          femalePercentage: 0,
          withoutPhonePercentage: 0,
          scPercentage: 0,
          muslimPercentage: 0,
          age18to24Percentage: 0,
          age50PlusPercentage: 0
        }));
      
      console.log('✅ Added assigned interviewers with 0 responses:', interviewersWithZeroResponses.length);
      console.log('✅ Interviewer names with 0 responses:', interviewersWithZeroResponses.map(i => i.interviewer));
      
      // Combine: interviewers with responses first (sorted by count descending), then interviewers with 0 responses (sorted by name)
      interviewerStats = [
        ...interviewerStatsFromResponses.sort((a, b) => b.count - a.count), // Sort by count descending
        ...interviewersWithZeroResponses.sort((a, b) => a.interviewer.localeCompare(b.interviewer)) // Sort by name ascending
      ];
      
      console.log('✅ Final interviewerStats count:', interviewerStats.length);
      console.log('✅ Final interviewerStats (first 5):', interviewerStats.slice(0, 5).map(i => ({ name: i.interviewer, count: i.count })));
    } else {
      console.log('🔍 Analytics calculation - NOT entering PM route logic');
      console.log('🔍 Analytics calculation - Conditions check:', {
        isProjectManagerRoute,
        hasAssignedInterviewers: !!assignedInterviewers,
        isArray: Array.isArray(assignedInterviewers),
        length: assignedInterviewers?.length || 0
      });
      interviewerStats = interviewerStatsFromResponses.sort((a, b) => b.count - a.count);
    }
    
    console.log('🔍 Analytics calculation - Final interviewerStats before return:', interviewerStats.length);

    const genderStats = Object.fromEntries(genderMap);
    const ageStats = Object.fromEntries(ageMap);
    
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate CAPI Performance stats
    const capiResponsesForStats = filteredResponses.filter(r => r.interviewMode?.toUpperCase() === 'CAPI');
    const capiApproved = capiResponsesForStats.filter(r => r.status?.toLowerCase() === 'approved').length;
    const capiRejected = capiResponsesForStats.filter(r => r.status?.toLowerCase() === 'rejected').length;

    return {
      totalResponses,
      capiResponses,
      catiResponses,
      completionRate,
      averageResponseTime,
      acStats,
      districtStats,
      lokSabhaStats,
      interviewerStats,
      genderStats,
      ageStats,
      dailyStats,
      capiPerformance: {
        approved: capiApproved,
        rejected: capiRejected,
        total: capiResponsesForStats.length
      }
    };
  }, [analyticsFromBackend, filteredResponses, survey, isProjectManagerRoute, assignedInterviewers]);

  // Fetch PC data for ACs that don't have it cached (after analytics is defined)
  // Use AC code for matching - more reliable than AC name
  useEffect(() => {
    const fetchPCDataForACs = async () => {
      if (!survey || !analytics?.acStats) return;
      
      const state = survey.acAssignmentState || 'West Bengal';
      
      // Get ACs with their codes from analytics
      const acsToFetch = analytics.acStats
        .filter(stat => {
          // Only fetch if we have AC code and don't have PC data yet
          if (!stat.acCode) return false;
          // Check if we already have this AC code cached
          const alreadyCached = Array.from(acPCMappingCache.values()).some(
            cached => cached.acCode === stat.acCode && cached.pcCode && cached.pcName
          );
          return !alreadyCached;
        })
        .slice(0, 30); // Limit to 30 at a time
      
      if (acsToFetch.length === 0) return;
      
      const newCache = new Map(acPCMappingCache);
      
      // Fetch in parallel - use AC code (numeric) for fetching (most reliable)
      const fetchPromises = acsToFetch.map(async (acStat) => {
        try {
          // Priority: Use AC code (numeric) for fetching - this is the most reliable
          // The backend API accepts AC number (numeric) or AC name
          let acIdentifier = acStat.acCode || '';
          
          // If we have AC code, use it directly (backend expects numeric string like "1", "2", etc.)
          if (acIdentifier) {
            // AC code is already numeric (e.g., "1", "2", "10")
            const response = await pollingStationAPI.getGroupsByAC(state, acIdentifier);
            if (response.success && response.data) {
              return {
                ac: acStat.ac,
                acCode: acStat.acCode,
                pcCode: response.data.pc_no?.toString() || '',
                pcName: response.data.pc_name || ''
              };
            }
          }
          
          // Fallback: Try with AC name
          const response = await pollingStationAPI.getGroupsByAC(state, acStat.ac);
          if (response.success && response.data) {
            return {
              ac: acStat.ac,
              acCode: acStat.acCode || response.data.ac_no?.toString() || '',
              pcCode: response.data.pc_no?.toString() || '',
              pcName: response.data.pc_name || ''
            };
          }
        } catch (error) {
          console.error(`Error fetching PC data for AC ${acStat.ac} (code: ${acStat.acCode}):`, error);
        }
        return null;
      });
      
      const results = await Promise.allSettled(fetchPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          // Cache by both AC name and AC code for reliable lookup
          newCache.set(result.value.ac, {
            acCode: result.value.acCode,
            pcCode: result.value.pcCode,
            pcName: result.value.pcName
          });
        }
      });
      
      if (newCache.size > acPCMappingCache.size) {
        setAcPCMappingCache(newCache);
      }
    };
    
    fetchPCDataForACs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics?.acStats, survey]);

  // All ACs from ALL responses (Approved, Rejected, Pending_Approval) - for dropdown/search
  // This should NOT be filtered by current filters, so users can always see all available ACs
  // Includes both AC name and numeric AC code for searching
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

  // Filter ACs based on search term (name or numeric code)
  const filteredACs = useMemo(() => {
    if (!allACObjects) return [];
    
    if (!acSearchTerm.trim()) {
      return allACObjects;
    }

    const searchLower = acSearchTerm.toLowerCase();
    const searchNumeric = acSearchTerm.trim(); // For numeric search, don't lowercase
    
    return allACObjects.filter(ac => {
      const nameMatch = ac.name.toLowerCase().includes(searchLower);
      // Search by numeric code (exact match or partial match)
      const numericCodeMatch = ac.numericCode && (
        ac.numericCode === searchNumeric || 
        ac.numericCode.includes(searchNumeric) ||
        searchNumeric.includes(ac.numericCode)
      );
      
      return nameMatch || numericCodeMatch;
    });
  }, [allACObjects, acSearchTerm]);

  // All interviewers from ALL responses (Approved, Rejected, Pending_Approval) - for dropdown/search
  // This should NOT be filtered by current filters, so users can always see all available interviewers
  // Get all unique interviewers from responses
  // NOTE: For project managers, the backend already filters responses to only include
  // responses from assigned interviewers, so this list will only contain assigned interviewers
  const allInterviewerObjects = useMemo(() => {
    if (!responses || responses.length === 0) return [];

    const interviewerMap = new Map(); // Map to store full interviewer objects

    responses.forEach(response => {
      // Only include responses with Approved, Rejected, or Pending_Approval status
      // The backend already filters responses for project managers, so this list
      // will only contain interviewers assigned to the project manager
      if (response.interviewer && 
          (response.status === 'Approved' || 
           response.status === 'Rejected' || 
           response.status === 'Pending_Approval')) {
        const interviewerName = `${response.interviewer.firstName} ${response.interviewer.lastName}`;
        
        // Store full interviewer object for search
        if (!interviewerMap.has(response.interviewer._id)) {
          interviewerMap.set(response.interviewer._id, {
            _id: response.interviewer._id,
            name: interviewerName,
            firstName: response.interviewer.firstName,
            lastName: response.interviewer.lastName,
            email: response.interviewer.email || '',
            phone: response.interviewer.phone || '',
            memberID: response.interviewer.memberId || response.interviewer.memberID || '' // Use memberId (lowercase d) from User model
          });
        }
      }
    });

    console.log('🔍 Frontend - allInterviewerObjects count:', interviewerMap.size);
    console.log('🔍 Frontend - Interviewer IDs:', Array.from(interviewerMap.keys()));
    
    return Array.from(interviewerMap.values());
  }, [responses]);

  // Filter options - based on filteredResponses to show only options available in current filter
  // Note: interviewerObjects is NOT included here - use allInterviewerObjects instead
  const filterOptions = useMemo(() => {
    if (!filteredResponses || filteredResponses.length === 0) return { ac: [], district: [], lokSabha: [], interviewer: [] };

    const acSet = new Set();
    const districtSet = new Set();
    const lokSabhaSet = new Set();
    const interviewerSet = new Set();

    filteredResponses.forEach(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      
      if (respondentInfo.ac && respondentInfo.ac !== 'N/A') {
        acSet.add(respondentInfo.ac);
      }
      if (respondentInfo.district && respondentInfo.district !== 'N/A') {
        districtSet.add(respondentInfo.district);
      }
      if (respondentInfo.lokSabha && respondentInfo.lokSabha !== 'N/A') {
        lokSabhaSet.add(respondentInfo.lokSabha);
      }
      if (response.interviewer) {
        const interviewerName = `${response.interviewer.firstName} ${response.interviewer.lastName}`;
        interviewerSet.add(interviewerName);
      }
    });

    return {
      ac: Array.from(acSet).sort(),
      district: Array.from(districtSet).sort(),
      lokSabha: Array.from(lokSabhaSet).sort(),
      interviewer: Array.from(interviewerSet).sort()
    };
  }, [filteredResponses]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle interviewer selection
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
          : [...currentIds, idStr], // Store as string
        interviewer: '' // Clear legacy interviewer filter when using new system
      };
    });
  };


  // Handle interviewer mode toggle (include/exclude)
  const handleInterviewerModeToggle = (mode) => {
    setFilters(prev => ({
      ...prev,
      interviewerMode: mode
    }));
  };

  // Clear all interviewer filters
  const clearInterviewerFilters = () => {
    setFilters(prev => ({
      ...prev,
      interviewerIds: [],
      interviewer: '',
      interviewerMode: 'include'
    }));
    setInterviewerSearchTerm('');
  };

  // Filter interviewers based on search term - use allInterviewerObjects (not filtered by current filters)
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
      dateRange: 'all',
      startDate: '',
      endDate: '',
      status: 'all', // Default to all (Approved + Rejected)
      interviewMode: '',
      ac: '',
      district: '',
      lokSabha: '',
      interviewer: '',
      interviewerIds: [],
      interviewerMode: 'include'
    });
    setInterviewerSearchTerm('');
  };

  // Handle CSV download
  const handleCSVDownload = () => {
    if (filteredResponses.length === 0) {
      showError('No data to download');
      return;
    }

    const headers = [
      'Response ID',
      'Interview Mode',
      'Interviewer Name',
      'Interviewer Email',
      'Respondent Name',
      'Gender',
      'Age',
      'Assembly Constituency',
      'District',
      'Lok Sabha',
      'State',
      'City',
      'Response Date',
      'GPS Coordinates'
    ];

    const csvData = filteredResponses.map(response => {
      const respondentInfo = getRespondentInfo(response.responses, response);
      
      return [
        response.responseId || response._id?.slice(-8) || 'N/A',
        response.interviewMode?.toUpperCase() || 'N/A',
        response.interviewer ? `${response.interviewer.firstName} ${response.interviewer.lastName}` : 'N/A',
        response.interviewer ? response.interviewer.email : 'N/A',
        respondentInfo.name,
        respondentInfo.gender,
        respondentInfo.age,
        respondentInfo.ac,
        respondentInfo.district,
        respondentInfo.lokSabha,
        respondentInfo.state,
        respondentInfo.city,
        new Date(response.createdAt).toLocaleDateString(),
        response.location ? `(${response.location.latitude}, ${response.location.longitude})` : 'N/A'
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${survey?.surveyName || 'survey'}_reports_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <ReportsLoadingScreen />;
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Survey not found</h3>
          <p className="text-gray-600 mb-4">The requested survey could not be found.</p>
          <button
            onClick={() => navigate('/company/surveys')}
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
              <Activity className="w-6 h-6 text-[#001D48] animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900">Applying filters...</p>
            <p className="text-xs text-gray-500 mt-1">Please wait while we update the data</p>
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
      <div className="min-h-screen bg-gray-50 w-full survey-reports-page">
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
                    {survey.surveyName || survey.name}
                  </h1>
                  <p className="text-sm text-gray-600">Survey Reports & Analytics</p>
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
                    <option value="CAPI">CAPI</option>
                    <option value="CATI">CATI</option>
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
                        // Convert to string for comparison
                        const interviewerIdStr = interviewer._id?.toString() || interviewer._id;
                        const filterIdsStr = (filters.interviewerIds || []).map(id => id?.toString() || id);
                        const isSelected = filterIdsStr.includes(interviewerIdStr);
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

                  {/* No Results Message */}
                  {showInterviewerDropdown && interviewerSearchTerm && filteredInterviewers.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                      No interviewers found matching "{interviewerSearchTerm}"
                    </div>
                  )}
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
                  Showing {filteredResponses.length} of {responses.length} responses
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="w-full py-6 px-4 sm:px-6 lg:px-8 max-w-full overflow-x-hidden">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Responses</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalResponses.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-[#E6F0F8] rounded-lg">
                <BarChart3 className="w-6 h-6 text-[#373177]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sample Size</p>
                <p className="text-2xl font-bold text-gray-900">
                  {survey?.sampleSize?.toLocaleString() || 
                   survey?.targetSampleSize?.toLocaleString() || 
                   survey?.specifications?.sampleSize?.toLocaleString() ||
                   survey?.survey?.sampleSize?.toLocaleString() ||
                   'N/A'}
                </p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CAPI Responses</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.capiResponses.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Activity className="w-6 h-6 text-[#373177]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CATI Responses</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.catiResponses.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Geographic Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* AC-wise Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assembly Constituency Performance</h3>
              <MapPin className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {analytics.acStats.slice(0, 5).map((stat, index) => (
                <div key={stat.ac} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 bg-[#E6F0F8] text-[#373177] text-xs font-semibold rounded-full flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">{stat.ac}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{stat.count}</div>
                    <div className="text-xs text-gray-500">{stat.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setAcModalPage(1); // Reset to first page when opening modal
                  setShowACModal(true);
                }}
                className="w-full text-sm text-[#373177] hover:text-blue-800 font-medium text-center"
              >
                View All ({analytics.acStats.length} ACs)
              </button>
            </div>
          </div>

          {/* Interviewer Performance */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Interviewers</h3>
              <Award className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {(() => {
                const statsToShow = analytics?.interviewerStats || [];
                console.log('🔍 Top Interviewers Display - statsToShow:', statsToShow.length);
                console.log('🔍 Top Interviewers Display - isProjectManagerRoute:', isProjectManagerRoute);
                console.log('🔍 Top Interviewers Display - assignedInterviewers:', assignedInterviewers?.length || 0);
                
                // For project managers, ensure we show at least some assigned interviewers even if they have 0 responses
                const displayStats = statsToShow.slice(0, 5); // Show top 5
                
                console.log('🔍 Top Interviewers Display - displayStats:', displayStats.length, displayStats.map(s => ({ name: s.interviewer, count: s.count })));
                
                // Show loading state if we're a PM but haven't loaded assigned interviewers yet
                if (displayStats.length === 0 && isProjectManagerRoute && assignedInterviewers === null) {
                  return (
                    <div className="text-sm text-gray-500 text-center py-4">
                      Loading interviewers...
                    </div>
                  );
                }
                
                // Only show "No interviewers found" if we're a PM, have checked for assigned interviewers, and still have none
                if (displayStats.length === 0 && isProjectManagerRoute && Array.isArray(assignedInterviewers) && assignedInterviewers.length === 0) {
                  return (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No interviewers found. Please check assigned team members.
                    </div>
                  );
                }
                
                if (displayStats.length === 0) {
                  return (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No interviewers with responses yet.
                    </div>
                  );
                }
                
                return displayStats.map((stat, index) => (
                  <div key={stat.interviewer || index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`w-6 h-6 ${stat.count > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'} text-xs font-semibold rounded-full flex items-center justify-center`}>
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">{stat.interviewer}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">{stat.count || 0}</div>
                      <div className="text-xs text-gray-500">
                        {stat.count > 0 && stat.percentage !== undefined && !isNaN(stat.percentage) 
                          ? stat.percentage.toFixed(1) + '%' 
                          : '0%'}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setInterviewerModalPage(1); // Reset to first page when opening modal
                  setShowInterviewerModal(true);
                }}
                className="w-full text-sm text-[#373177] hover:text-blue-800 font-medium text-center"
              >
                View All ({(analytics?.interviewerStats || []).length} Interviewers)
              </button>
            </div>
          </div>
        </div>

        {/* Overall Time Graph */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Response Trends</h3>
          
          {/* Chart Container */}
          <div className="h-80 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading response trends...</p>
                </div>
              </div>
            ) : prepareChartData() ? (
              <Line data={prepareChartData()} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No response data available</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Complete some responses to see trends
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Chart Insights */}
          {analytics.dailyStats && analytics.dailyStats.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#373177]">{analytics.totalResponses}</div>
                <div className="text-sm text-gray-600">Total Responses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{analytics.capiResponses}</div>
                <div className="text-sm text-gray-600">CAPI Responses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{analytics.catiResponses}</div>
                <div className="text-sm text-gray-600">CATI Responses</div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gender Distribution */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
            <div className="space-y-3">
              {Object.entries(analytics.genderStats).map(([gender, count]) => (
                <div key={gender} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 capitalize">{gender}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#001D48] h-2 rounded-full" 
                        style={{ width: `${(count / analytics.totalResponses) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Age Distribution */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution</h3>
            <div className="space-y-3">
              {Object.entries(analytics.ageStats)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([ageGroup, count]) => (
                <div key={ageGroup} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{ageGroup}-{parseInt(ageGroup) + 9} years</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${(count / analytics.totalResponses) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Response Trends */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Daily Response Trends</h3>
            </div>
            <div className="space-y-3">
              {analytics.dailyStats.slice(-5).map((stat, index) => (
                <div key={stat.date} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(stat.date).toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#373177] h-2 rounded-full" 
                        style={{ width: `${(stat.count / Math.max(...analytics.dailyStats.map(d => d.count), 1)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">{stat.count}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowDailyTrendsModal(true)}
                className="w-full text-sm text-[#373177] hover:text-blue-800 font-medium text-center"
              >
                View All ({analytics.dailyStats.length} Days)
              </button>
          </div>
        </div>
        </div>

        {/* CAPI Performance Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">CAPI Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-600 mb-2">{analytics.capiPerformance.approved}</div>
              <div className="text-sm font-medium text-green-800">Approved Interviews</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-3xl font-bold text-red-600 mb-2">{analytics.capiPerformance.rejected}</div>
              <div className="text-sm font-medium text-red-800">Rejected Interviews</div>
            </div>
            <div className="text-center p-4 bg-[#E6F0F8] rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-[#373177] mb-2">{analytics.capiPerformance.total}</div>
              <div className="text-sm font-medium text-blue-800">Total CAPI Interviews</div>
            </div>
          </div>
        </div>


        {/* AC Performance Modal */}
        {showACModal && (() => {
          // Helper to normalize AC name for comparison
          const normalizeACName = (acName) => {
            if (!acName || typeof acName !== 'string') return '';
            return acName.trim().toLowerCase().replace(/\s+/g, ' ');
          };

          // Helper to get AC/PC data - use cached data from analytics or cache
          const getACPCDataForModal = (acName) => {
            // First try to get from analytics stats (already calculated)
            const acStat = analytics.acStats?.find(s => normalizeACName(s.ac) === normalizeACName(acName));
            if (acStat) {
              // Check cache for PC data if not in stat
              const cached = acPCMappingCache.get(acName);
              return {
                acCode: acStat.acCode || '',
                pcCode: acStat.pcCode || cached?.pcCode || '',
                pcName: acStat.pcName || cached?.pcName || ''
              };
            }
            
            // Check cache
            if (acPCMappingCache.has(acName)) {
              const cached = acPCMappingCache.get(acName);
              const acData = getACByName(acName);
              return {
                acCode: acData ? getNumericACCode(acData.acCode || '') : '',
                pcCode: cached.pcCode || '',
                pcName: cached.pcName || ''
              };
            }
            
            // Fallback: get from assemblyConstituencies
            const acData = getACByName(acName);
            if (acData) {
              return {
                acCode: getNumericACCode(acData.acCode || ''),
                pcCode: '',
                pcName: ''
              };
            }
            
            return { acCode: '', pcCode: '', pcName: '' };
          };

          // Get all ACs from the state
          const allStateACs = getAllACsForState();
          
          // IMPORTANT: Always use frontend filtered stats (analytics.acStats) which respect all filters
          // analytics.acStats is calculated from filteredResponses and matches what's shown on the main page
          // acPerformanceStats is from backend and doesn't respect filters, so it should NOT be used for counts
          const statsFromFrontend = analytics.acStats || [];
          const totalFilteredResponses = analytics.totalResponses || 0;
          
          let allACStatsForModal = [];
          
          // CRITICAL: If there are 0 filtered responses, all stats should be 0
          // Always use frontend stats (filtered) - they match the current filters
          if (statsFromFrontend.length > 0) {
            // Frontend stats already include all ACs (with responses + zeros), so we can use them directly
            // But ensure all counts are 0 if totalFilteredResponses is 0
            if (totalFilteredResponses === 0) {
              // When there are 0 filtered responses, all ACs should show 0 for everything
              allACStatsForModal = statsFromFrontend.map(stat => ({
                ...stat,
                count: 0,
                capi: 0,
                cati: 0,
                percentage: 0,
                interviewersCount: 0,
                approved: 0,
                rejected: 0,
                underQC: 0,
                psCovered: 0,
                femalePercentage: 0,
                withoutPhonePercentage: 0,
                scPercentage: 0,
                muslimPercentage: 0,
                age18to24Percentage: 0,
                age50PlusPercentage: 0
              }));
            } else {
              // Use frontend stats as-is (they're already filtered correctly)
              allACStatsForModal = statsFromFrontend;
            }
            
            // Ensure all state ACs are included (in case frontend stats are incomplete)
            if (allACStatsForModal.length < allStateACs.length) {
              const existingACsNormalized = new Set(
                allACStatsForModal.map(stat => normalizeACName(stat.ac))
              );
              
              const missingACs = allStateACs
                .filter(acName => !existingACsNormalized.has(normalizeACName(acName)))
                .map(acName => ({
                  ac: acName,
                  count: 0,
                  capi: 0,
                  cati: 0,
                  percentage: 0,
                  pcName: '',
                  interviewersCount: 0,
                  approved: 0,
                  rejected: 0,
                  underQC: 0,
                  psCovered: 0,
                  femalePercentage: 0,
                  withoutPhonePercentage: 0,
                  scPercentage: 0,
                  muslimPercentage: 0,
                  age18to24Percentage: 0,
                  age50PlusPercentage: 0
                }));
              
              // Sort: ACs with responses first, then zeros alphabetically
              allACStatsForModal = [...allACStatsForModal, ...missingACs].sort((a, b) => {
                if (a.count > 0 && b.count === 0) return -1;
                if (a.count === 0 && b.count > 0) return 1;
                if (a.count > 0 && b.count > 0) return b.count - a.count;
                return a.ac.localeCompare(b.ac);
              });
            }
          } else {
            // No frontend stats available - create empty entries for all ACs
            // This should only happen if analytics is not yet calculated
            allACStatsForModal = allStateACs.map(acName => ({
              ac: acName,
              count: 0,
              capi: 0,
              cati: 0,
              percentage: 0,
              pcName: '',
              interviewersCount: 0,
              approved: 0,
              rejected: 0,
              underQC: 0,
              psCovered: 0,
              femalePercentage: 0,
              withoutPhonePercentage: 0,
              scPercentage: 0,
              muslimPercentage: 0,
              age18to24Percentage: 0,
              age50PlusPercentage: 0
            })).sort((a, b) => a.ac.localeCompare(b.ac));
          }
          
          // REMOVED: Fallback to backend stats - they don't respect filters and cause data inconsistency
          // The modal should ONLY use frontend filtered stats to match what's shown on the main page
          
          console.log('🔍 Modal - allACStatsForModal length:', allACStatsForModal.length);
          console.log('🔍 Modal - ACs with responses:', allACStatsForModal.filter(s => (s.count || s.totalResponses || 0) > 0).length);
          console.log('🔍 Modal - ACs with zero responses:', allACStatsForModal.filter(s => (s.count || s.totalResponses || 0) === 0).length);

          // Pagination for AC Modal
          const totalACPages = Math.ceil(allACStatsForModal.length / acModalPageSize);
          const startACIndex = (acModalPage - 1) * acModalPageSize;
          const endACIndex = startACIndex + acModalPageSize;
          const paginatedACStats = allACStatsForModal.slice(startACIndex, endACIndex);

          return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-[95vw] max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Assembly Constituency Performance
                  {survey?.acAssignmentState && (
                    <span className="text-sm font-normal text-gray-600 ml-2">
                      - {survey.acAssignmentState}
                    </span>
                  )}
                </h3>
                <div className="flex flex-col items-end space-y-2 ml-4">
                  <button
                    onClick={() => {
                      const statsToUse = allACStatsForModal;
                      const csvData = statsToUse.map(stat => {
                        // Use frontend calculated data (filtered) - it has all stats including PS Covered and demographics
                        const displayStat = {
                          ...stat,
                          pcName: stat.pcName || acPCData.pcName || '',
                          psCovered: stat.psCovered || 0,
                          completedInterviews: stat.count,
                          systemRejections: stat.autoRejected || 0, // Use autoRejected for System Rejections
                          countsAfterRejection: Math.max(0, (stat.count || 0) - (stat.autoRejected || 0)), // Completed Interviews minus System Rejections
                          gpsPending: 0, // Not calculated in frontend
                          gpsFail: 0, // Not calculated in frontend
                          // Use demographic percentages from stat (already calculated from filtered responses)
                          femalePercentage: stat.femalePercentage || 0,
                          withoutPhonePercentage: stat.withoutPhonePercentage || 0,
                          scPercentage: stat.scPercentage || 0,
                          muslimPercentage: stat.muslimPercentage || 0,
                          age18to24Percentage: stat.age18to24Percentage || 0,
                          age50PlusPercentage: stat.age50PlusPercentage || 0
                        };
                        
                        const csvRow = {
                          'Assembly Constituency': stat.ac,
                          'AC Code': displayStat.acCode || stat.acCode || '',
                          'PC Code': displayStat.pcCode || stat.pcCode || '',
                          'PC Name': displayStat.pcName || stat.pcName || '',
                          'PS Covered': displayStat.psCovered || stat.psCovered || 0,
                          'Completed Interviews': displayStat.completedInterviews || displayStat.totalResponses || stat.count,
                          'System Rejections': displayStat.systemRejections || 0,
                          'Counts after Terminated and System Rejection': displayStat.countsAfterRejection || displayStat.totalResponses || stat.count,
                          'GPS Pending': displayStat.gpsPending || 0,
                          'GPS Fail': displayStat.gpsFail || 0,
                          'Number of Interviewers Worked': displayStat.interviewersCount || stat.interviewersCount || 0,
                          'Approved': displayStat.approved || stat.approved || 0,
                          'Rejected': displayStat.rejected || stat.manualRejected || 0, // Use manualRejected for Rejected column
                          'Under QC': displayStat.underQC || stat.underQC || 0,
                          'CAPI Responses': displayStat.capi || stat.capi || 0,
                          'CATI Responses': displayStat.cati || stat.cati || 0,
                          '% Of Female Interviews': `${displayStat.femalePercentage?.toFixed(2) || '0.00'}%`,
                          '% of interviews without Phone Number': `${displayStat.withoutPhonePercentage?.toFixed(2) || '0.00'}%`,
                          '% of Interviews mentioned as Muslims': `${displayStat.muslimPercentage?.toFixed(2) || '0.00'}%`,
                          '% of Interviews under the age of (18-24)': `${displayStat.age18to24Percentage?.toFixed(2) || '0.00'}%`,
                          '% of Interviews under the age of (50)': `${displayStat.age50PlusPercentage?.toFixed(2) || '0.00'}%`
                        };
                        
                        // Add SC column only for survey 68fd1915d41841da463f0d46
                        if (surveyId === '68fd1915d41841da463f0d46') {
                          csvRow['% of Interviews mentioned as SC'] = `${displayStat.scPercentage?.toFixed(2) || '0.00'}%`;
                        }
                        
                        return csvRow;
                      });
                      const csvContent = [Object.keys(csvData[0]), ...csvData.map(row => Object.values(row))]
                        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                        .join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `ac_performance_${survey?.acAssignmentState || 'state'}_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    }}
                    className="flex items-center space-x-2 px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setShowACModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Rank</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Assembly Constituency</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">AC Code</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">PC Code</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">PC Name</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">PS Covered</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Completed Interviews</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">System Rejections</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Counts after Terminated and System Rejection</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">GPS Pending</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">GPS Fail</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Number of Interviewers Worked</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Approved</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Rejected</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Under QC</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">CAPI</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">CATI</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% Of Female Interviews</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of interviews without Phone Number</th>
                      {surveyId === '68fd1915d41841da463f0d46' && (
                        <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews mentioned as SC</th>
                      )}
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews mentioned as Muslims</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews under the age of (18-24)</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews under the age of (50)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Total Row */}
                    {(() => {
                      // Calculate totals for all numeric columns
                      const totals = allACStatsForModal.reduce((acc, stat) => {
                        const acPCData = getACPCDataForModal(stat.ac);
                        const displayStat = {
                          ...stat,
                          acCode: stat.acCode || acPCData.acCode,
                          pcCode: stat.pcCode || acPCData.pcCode,
                          pcName: stat.pcName || acPCData.pcName,
                          psCovered: stat.psCovered || 0,
                          completedInterviews: stat.count,
                          systemRejections: stat.autoRejected || 0, // Use autoRejected for System Rejections
                          countsAfterRejection: Math.max(0, (stat.count || 0) - (stat.autoRejected || 0)), // Completed Interviews minus System Rejections
                          gpsPending: 0,
                          gpsFail: 0,
                          interviewersCount: stat.interviewersCount || 0,
                          approved: stat.approved || 0,
                        rejected: stat.manualRejected || 0, // Use manualRejected for Rejected column (exclude auto-rejected, exclude pending)
                        underQC: (stat.underQC || stat.pending || 0), // Use underQC or pending (Pending_Approval status - includes all in batches)
                          capi: stat.capi || 0,
                          cati: stat.cati || 0
                        };
                        
                        acc.psCovered += displayStat.psCovered || 0;
                        acc.completedInterviews += displayStat.completedInterviews || 0;
                        acc.systemRejections += displayStat.systemRejections || 0;
                        acc.countsAfterRejection += displayStat.countsAfterRejection || 0;
                        acc.gpsPending += displayStat.gpsPending || 0;
                        acc.gpsFail += displayStat.gpsFail || 0;
                        acc.interviewersCount += displayStat.interviewersCount || 0;
                        acc.approved += displayStat.approved || 0;
                        acc.rejected += displayStat.rejected || 0;
                        acc.underQC += displayStat.underQC || 0;
                        acc.capi += displayStat.capi || 0;
                        acc.cati += displayStat.cati || 0;
                        return acc;
                      }, {
                        psCovered: 0,
                        completedInterviews: 0,
                        systemRejections: 0,
                        countsAfterRejection: 0,
                        gpsPending: 0,
                        gpsFail: 0,
                        interviewersCount: 0,
                        approved: 0,
                        rejected: 0,
                        underQC: 0,
                        capi: 0,
                        cati: 0
                      });
                      
                      return (
                        <tr key="total" className="bg-[#E6F0F8] border-b-2 border-[#373177] font-semibold">
                          <td className="py-3 px-4 text-[#373177] font-bold">Total</td>
                          <td className="py-3 px-4 text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.psCovered}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.completedInterviews}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.systemRejections}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.countsAfterRejection}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.gpsPending}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.gpsFail}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.interviewersCount}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.approved}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.rejected}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.underQC}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.capi}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.cati}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          {surveyId === '68fd1915d41841da463f0d46' && (
                            <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          )}
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                        </tr>
                      );
                    })()}
                    {paginatedACStats.map((stat, index) => {
                      // Get AC/PC data
                      const acPCData = getACPCDataForModal(stat.ac);
                      
                      // Use frontend calculated data (filtered) - it has all the demographic percentages and PS Covered
                      const displayStat = {
                        ...stat,
                        acCode: stat.acCode || acPCData.acCode,
                        pcCode: stat.pcCode || acPCData.pcCode,
                        pcName: stat.pcName || acPCData.pcName,
                        psCovered: stat.psCovered || 0, // PS Covered from analytics
                        completedInterviews: stat.count,
                        systemRejections: stat.autoRejected || 0, // Use autoRejected for System Rejections
                        countsAfterRejection: Math.max(0, (stat.count || 0) - (stat.autoRejected || 0)), // Completed Interviews minus System Rejections
                        gpsPending: 0, // Not calculated in frontend
                        gpsFail: 0, // Not calculated in frontend
                        rejected: stat.manualRejected || 0, // Override: Use manualRejected (exclude auto-rejected, exclude pending)
                        underQC: (stat.underQC || stat.pending || 0), // Use underQC or pending (Pending_Approval status - includes all in batches)
                        // Use demographic percentages from stat (already calculated from filtered responses)
                        femalePercentage: stat.femalePercentage || 0,
                        withoutPhonePercentage: stat.withoutPhonePercentage || 0,
                        scPercentage: stat.scPercentage || 0,
                        muslimPercentage: stat.muslimPercentage || 0,
                        age18to24Percentage: stat.age18to24Percentage || 0,
                        age50PlusPercentage: stat.age50PlusPercentage || 0
                      };
                      
                      // Calculate actual rank (global index, not page index)
                      const actualRank = startACIndex + index + 1;
                      
                      return (
                        <tr key={stat.ac} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <span className="w-6 h-6 bg-[#E6F0F8] text-[#373177] text-xs font-semibold rounded-full flex items-center justify-center">
                              {actualRank}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{stat.ac}</td>
                          <td className="py-3 px-4 text-gray-600">{displayStat.acCode || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">{displayStat.pcCode || '-'}</td>
                          <td className="py-3 px-4 text-gray-600">{displayStat.pcName || '-'}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.psCovered || stat.psCovered || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.completedInterviews || stat.count}</td>
                          <td className="py-3 px-4 text-right font-semibold text-red-600">{displayStat.systemRejections || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.countsAfterRejection || stat.count}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.gpsPending || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.gpsFail || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.interviewersCount || stat.interviewersCount || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600">{displayStat.approved || stat.approved || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-red-600">{displayStat.rejected || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-yellow-600">{displayStat.underQC || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600">{displayStat.capi || stat.capi || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-orange-600">{displayStat.cati || stat.cati || 0}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.femalePercentage?.toFixed(2) || stat.femalePercentage?.toFixed(2) || '0.00'}%</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.withoutPhonePercentage?.toFixed(2) || stat.withoutPhonePercentage?.toFixed(2) || '0.00'}%</td>
                          {surveyId === '68fd1915d41841da463f0d46' && (
                            <td className="py-3 px-4 text-right text-gray-600">{displayStat.scPercentage?.toFixed(2) || stat.scPercentage?.toFixed(2) || '0.00'}%</td>
                          )}
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.muslimPercentage?.toFixed(2) || stat.muslimPercentage?.toFixed(2) || '0.00'}%</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.age18to24Percentage?.toFixed(2) || stat.age18to24Percentage?.toFixed(2) || '0.00'}%</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.age50PlusPercentage?.toFixed(2) || stat.age50PlusPercentage?.toFixed(2) || '0.00'}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls for AC Modal */}
              {totalACPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setAcModalPage(prev => Math.max(1, prev - 1))}
                      disabled={acModalPage === 1}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        acModalPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#001D48] text-white hover:bg-[#003366]'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {acModalPage} of {totalACPages}
                    </span>
                    <button
                      onClick={() => setAcModalPage(prev => Math.min(totalACPages, prev + 1))}
                      disabled={acModalPage === totalACPages}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        acModalPage === totalACPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#001D48] text-white hover:bg-[#003366]'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing {startACIndex + 1} - {Math.min(endACIndex, allACStatsForModal.length)} of {allACStatsForModal.length} Assembly Constituencies
                  </div>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalACPages) }, (_, i) => {
                      let pageNum;
                      if (totalACPages <= 5) {
                        pageNum = i + 1;
                      } else if (acModalPage <= 3) {
                        pageNum = i + 1;
                      } else if (acModalPage >= totalACPages - 2) {
                        pageNum = totalACPages - 4 + i;
                      } else {
                        pageNum = acModalPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setAcModalPage(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            acModalPage === pageNum
                              ? 'bg-[#373177] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* Interviewer Performance Modal */}
        {showInterviewerModal && (() => {
          // Pagination for Interviewer Modal
          const interviewerStats = analytics?.interviewerStats || [];
          const totalInterviewerPages = Math.ceil(interviewerStats.length / interviewerModalPageSize);
          const startInterviewerIndex = (interviewerModalPage - 1) * interviewerModalPageSize;
          const endInterviewerIndex = startInterviewerIndex + interviewerModalPageSize;
          const paginatedInterviewerStats = interviewerStats.slice(startInterviewerIndex, endInterviewerIndex);

          return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-[95vw] max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Interviewer Performance</h3>
                <div className="flex flex-col items-end space-y-2 ml-4">
                  <button
                    onClick={() => {
                      // Always use filtered frontend stats (analytics.interviewerStats) which respect all filters
                      const statsToUse = analytics?.interviewerStats || [];
                      const csvData = statsToUse.map(stat => {
                        // Use frontend calculated data (filtered) - it respects current filters
                        const displayStat = {
                          ...stat,
                          psCovered: stat.psCovered || 0,
                          completedInterviews: stat.count,
                          systemRejections: stat.autoRejected || 0, // Use autoRejected for System Rejections
                          countsAfterRejection: Math.max(0, (stat.count || 0) - (stat.autoRejected || 0)), // Completed Interviews minus System Rejections
                          gpsPending: 0, // Not calculated in frontend
                          gpsFail: 0, // Not calculated in frontend
                          underQC: stat.pending || 0, // Use pending (Pending_Approval status)
                          capi: stat.capi || 0, // Use CAPI count from analytics
                          cati: stat.cati || 0, // Use CATI count from analytics
                          // Use demographic percentages from stat (already calculated from filtered responses)
                          femalePercentage: stat.femalePercentage || 0,
                          withoutPhonePercentage: stat.withoutPhonePercentage || 0,
                          scPercentage: stat.scPercentage || 0,
                          muslimPercentage: stat.muslimPercentage || 0,
                          age18to24Percentage: stat.age18to24Percentage || 0,
                          age50PlusPercentage: stat.age50PlusPercentage || 0
                        };
                        
                        const csvRow = {
                          'Interviewer ID': stat.memberId || 'N/A',
                          'Interviewer': stat.interviewer,
                          'PS Covered': displayStat.psCovered || 0,
                          'Completed Interviews': displayStat.completedInterviews || displayStat.totalResponses || stat.count,
                          'System Rejections': displayStat.systemRejections || 0,
                          'Counts after Terminated and System Rejection': displayStat.countsAfterRejection || displayStat.totalResponses || stat.count,
                          'GPS Pending': displayStat.gpsPending || 0,
                          'GPS Fail': displayStat.gpsFail || 0,
                          'Approved': displayStat.approved || stat.approved || 0,
                          'Rejected': displayStat.rejected || stat.manualRejected || 0, // Use manualRejected for Rejected column
                          'Under QC': displayStat.underQC || stat.pending || 0, // Use pending (Pending_Approval status)
                          'CAPI': displayStat.capi || stat.capi || 0,
                          'CATI': displayStat.cati || stat.cati || 0,
                          '% Of Female Interviews': `${displayStat.femalePercentage?.toFixed(2) || '0.00'}%`,
                          '% of interviews without Phone Number': `${displayStat.withoutPhonePercentage?.toFixed(2) || '0.00'}%`,
                          '% of Interviews mentioned as Muslims': `${displayStat.muslimPercentage?.toFixed(2) || '0.00'}%`,
                          '% of Interviews under the age of (18-24)': `${displayStat.age18to24Percentage?.toFixed(2) || '0.00'}%`,
                          '% of Interviews under the age of (50)': `${displayStat.age50PlusPercentage?.toFixed(2) || '0.00'}%`
                        };
                        
                        // Add SC column only for survey 68fd1915d41841da463f0d46
                        if (surveyId === '68fd1915d41841da463f0d46') {
                          csvRow['% of Interviews mentioned as SC'] = `${displayStat.scPercentage?.toFixed(2) || '0.00'}%`;
                        }
                        
                        return csvRow;
                      });
                      const csvContent = [Object.keys(csvData[0]), ...csvData.map(row => Object.values(row))]
                        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                        .join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `interviewer_performance_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    }}
                    className="flex items-center space-x-2 px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setShowInterviewerModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Rank</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Interviewer ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Interviewer</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">PS Covered</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Completed Interviews</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">System Rejections</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Counts after Terminated and System Rejection</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">GPS Pending</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">GPS Fail</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Approved</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Rejected</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Under QC</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">CAPI</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">CATI</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% Of Female Interviews</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of interviews without Phone Number</th>
                      {surveyId === '68fd1915d41841da463f0d46' && (
                        <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews mentioned as SC</th>
                      )}
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews mentioned as Muslims</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews under the age of (18-24)</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">% of Interviews under the age of (50)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Total Row */}
                    {(() => {
                      // Calculate totals for all numeric columns
                      const totals = (analytics?.interviewerStats || []).reduce((acc, stat) => {
                        const displayStat = {
                          ...stat,
                          psCovered: stat.psCovered || 0,
                          completedInterviews: stat.count,
                          systemRejections: stat.autoRejected || 0, // Use autoRejected for System Rejections
                          countsAfterRejection: Math.max(0, (stat.count || 0) - (stat.autoRejected || 0)), // Completed Interviews minus System Rejections
                          gpsPending: 0,
                          gpsFail: 0,
                        underQC: (stat.underQC || stat.pending || 0), // Use underQC or pending (Pending_Approval status - includes all in batches)
                        approved: stat.approved || 0,
                        rejected: stat.manualRejected || 0, // Use manualRejected for Rejected column (exclude auto-rejected, exclude pending)
                          capi: stat.capi || 0, // Use CAPI count from analytics
                          cati: stat.cati || 0 // Use CATI count from analytics
                        };
                        
                        acc.psCovered += displayStat.psCovered || 0;
                        acc.completedInterviews += displayStat.completedInterviews || 0;
                        acc.systemRejections += displayStat.systemRejections || 0;
                        acc.countsAfterRejection += displayStat.countsAfterRejection || 0;
                        acc.gpsPending += displayStat.gpsPending || 0;
                        acc.gpsFail += displayStat.gpsFail || 0;
                        acc.approved += displayStat.approved || 0;
                        acc.rejected += displayStat.rejected || 0;
                        acc.underQC += displayStat.underQC || 0;
                        acc.capi += displayStat.capi || 0;
                        acc.cati += displayStat.cati || 0;
                        return acc;
                      }, {
                        psCovered: 0,
                        completedInterviews: 0,
                        systemRejections: 0,
                        countsAfterRejection: 0,
                        gpsPending: 0,
                        gpsFail: 0,
                        approved: 0,
                        rejected: 0,
                        underQC: 0,
                        capi: 0,
                        cati: 0
                      });
                      
                      return (
                        <tr key="total" className="bg-[#E6F0F8] border-b-2 border-[#373177] font-semibold">
                          <td className="py-3 px-4 text-[#373177] font-bold">Total</td>
                          <td className="py-3 px-4 text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.psCovered}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.completedInterviews}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.systemRejections}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.countsAfterRejection}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.gpsPending}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.gpsFail}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.approved}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.rejected}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.underQC}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.capi}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">{totals.cati}</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          {surveyId === '68fd1915d41841da463f0d46' && (
                            <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          )}
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                          <td className="py-3 px-4 text-right text-[#373177] font-bold">-</td>
                        </tr>
                      );
                    })()}
                    {/* Always use filtered frontend stats (analytics.interviewerStats) which respect all filters */}
                    {paginatedInterviewerStats.map((stat, index) => {
                      // Use frontend calculated data (filtered) - it respects current filters and has all stats
                      const displayStat = {
                        ...stat,
                        psCovered: stat.psCovered || 0, // PS Covered from analytics
                        completedInterviews: stat.count,
                        systemRejections: stat.autoRejected || 0, // Use autoRejected for System Rejections
                        countsAfterRejection: Math.max(0, (stat.count || 0) - (stat.autoRejected || 0)), // Completed Interviews minus System Rejections
                        gpsPending: 0, // Not calculated in frontend
                        gpsFail: 0, // Not calculated in frontend
                        underQC: (stat.underQC || stat.pending || 0), // Use underQC or pending (Pending_Approval status - includes all in batches)
                        approved: stat.approved || 0,
                        rejected: stat.manualRejected || 0, // Override: Use manualRejected (exclude auto-rejected, exclude pending)
                        capi: stat.capi || 0, // Use CAPI count from analytics
                        cati: stat.cati || 0, // Use CATI count from analytics
                        // Use demographic percentages from stat (already calculated from filtered responses)
                        femalePercentage: stat.femalePercentage || 0,
                        withoutPhonePercentage: stat.withoutPhonePercentage || 0,
                        scPercentage: stat.scPercentage || 0,
                        muslimPercentage: stat.muslimPercentage || 0,
                        age18to24Percentage: stat.age18to24Percentage || 0,
                        age50PlusPercentage: stat.age50PlusPercentage || 0
                      };
                      
                      // Calculate actual rank (global index, not page index)
                      const actualRank = startInterviewerIndex + index + 1;
                      
                      return (
                        <tr key={stat.interviewer} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <span className="w-6 h-6 bg-green-100 text-green-600 text-xs font-semibold rounded-full flex items-center justify-center">
                              {actualRank}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{stat.memberId || 'N/A'}</td>
                          <td className="py-3 px-4 font-medium text-gray-900">{stat.interviewer}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.psCovered || stat.psCovered || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.completedInterviews || stat.count}</td>
                          <td className="py-3 px-4 text-right font-semibold text-red-600">{displayStat.systemRejections || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.countsAfterRejection ?? 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.gpsPending || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{displayStat.gpsFail || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600">{displayStat.approved || stat.approved || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-red-600">{displayStat.rejected || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-yellow-600">{displayStat.underQC || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-green-600">{displayStat.capi || stat.capi || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-orange-600">{displayStat.cati || stat.cati || 0}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.femalePercentage?.toFixed(2) || stat.femalePercentage?.toFixed(2) || '0.00'}%</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.withoutPhonePercentage?.toFixed(2) || stat.withoutPhonePercentage?.toFixed(2) || '0.00'}%</td>
                          {surveyId === '68fd1915d41841da463f0d46' && (
                            <td className="py-3 px-4 text-right text-gray-600">{displayStat.scPercentage?.toFixed(2) || stat.scPercentage?.toFixed(2) || '0.00'}%</td>
                          )}
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.muslimPercentage?.toFixed(2) || stat.muslimPercentage?.toFixed(2) || '0.00'}%</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.age18to24Percentage?.toFixed(2) || stat.age18to24Percentage?.toFixed(2) || '0.00'}%</td>
                          <td className="py-3 px-4 text-right text-gray-600">{displayStat.age50PlusPercentage?.toFixed(2) || stat.age50PlusPercentage?.toFixed(2) || '0.00'}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls for Interviewer Modal */}
              {totalInterviewerPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setInterviewerModalPage(prev => Math.max(1, prev - 1))}
                      disabled={interviewerModalPage === 1}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        interviewerModalPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#001D48] text-white hover:bg-[#003366]'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {interviewerModalPage} of {totalInterviewerPages}
                    </span>
                    <button
                      onClick={() => setInterviewerModalPage(prev => Math.min(totalInterviewerPages, prev + 1))}
                      disabled={interviewerModalPage === totalInterviewerPages}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        interviewerModalPage === totalInterviewerPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#001D48] text-white hover:bg-[#003366]'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing {startInterviewerIndex + 1} - {Math.min(endInterviewerIndex, interviewerStats.length)} of {interviewerStats.length} Interviewers
                  </div>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalInterviewerPages) }, (_, i) => {
                      let pageNum;
                      if (totalInterviewerPages <= 5) {
                        pageNum = i + 1;
                      } else if (interviewerModalPage <= 3) {
                        pageNum = i + 1;
                      } else if (interviewerModalPage >= totalInterviewerPages - 2) {
                        pageNum = totalInterviewerPages - 4 + i;
                      } else {
                        pageNum = interviewerModalPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setInterviewerModalPage(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            interviewerModalPage === pageNum
                              ? 'bg-[#373177] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* Daily Trends Modal */}
        {showDailyTrendsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-[95vw] max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Daily Response Trends</h3>
                <div className="flex flex-col items-end space-y-2 ml-4">
                  <button
                    onClick={() => {
                      const csvData = analytics.dailyStats.map(stat => ({
                        'Date': new Date(stat.date).toLocaleDateString(),
                        'Response Count': stat.count
                      }));
                      const csvContent = [Object.keys(csvData[0]), ...csvData.map(row => Object.values(row))]
                        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                        .join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `daily_trends_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    }}
                    className="flex items-center space-x-2 px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setShowDailyTrendsModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {analytics.dailyStats.map((stat, index) => (
                  <div key={stat.date} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(stat.date).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-[#373177] h-2 rounded-full" 
                          style={{ width: `${(stat.count / Math.max(...analytics.dailyStats.map(d => d.count))) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-8 text-right">{stat.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
};

export default SurveyReportsPage;
