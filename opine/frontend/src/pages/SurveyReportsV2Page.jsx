import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ArrowLeft, BarChart3, Database, Users, Phone, Filter, Calendar, X, Search, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Download, TrendingUp } from 'lucide-react';
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
import { Line } from 'react-chartjs-2';

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
import { surveyAPI, authAPI, pollingStationAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { getACByName } from '../utils/assemblyConstituencies';
import assemblyConstituenciesData from '../data/assemblyConstituencies.json';

const SurveyReportsV2Page = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showError } = useToast();
  
  // Determine if we're in project manager route
  const isProjectManagerRoute = location.pathname.includes('/project-manager/');
  const backPath = isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys';
  
  const [survey, setSurvey] = useState(null);
  const [stats, setStats] = useState(null);
  const [acStats, setAcStats] = useState([]);
  const [interviewerStats, setInterviewerStats] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acStatsLoading, setAcStatsLoading] = useState(false);
  const [interviewerStatsLoading, setInterviewerStatsLoading] = useState(false);
  const [chartDataLoading, setChartDataLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  
  // AC/PC mapping cache (similar to SurveyReportsPage)
  const [acPCMappingCache, setAcPCMappingCache] = useState(new Map());
  
  // Tab state
  const [activeTab, setActiveTab] = useState('ac'); // 'ac' or 'interviewer'
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [interviewerCurrentPage, setInterviewerCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // Filter states
  const [filters, setFilters] = useState({
    dateRange: 'all',
    startDate: '',
    endDate: '',
    status: 'approved_rejected_pending',
    interviewMode: '',
    ac: '',
    district: '',
    lokSabha: '',
    interviewerIds: [],
    interviewerMode: 'include'
  });

  // Search-first dropdown states
  const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('');
  const [searchedInterviewers, setSearchedInterviewers] = useState([]);
  const [showInterviewerDropdown, setShowInterviewerDropdown] = useState(false);
  const interviewerDropdownRef = useRef(null);
  const [searchingInterviewers, setSearchingInterviewers] = useState(false);

  const [acSearchTerm, setAcSearchTerm] = useState('');
  const [searchedACs, setSearchedACs] = useState([]);
  const [showACDropdown, setShowACDropdown] = useState(false);
  const acDropdownRef = useRef(null);

  // Debounce timer ref
  const debounceTimerRef = useRef(null);
  const interviewerSearchTimerRef = useRef(null);
  const acSearchTimerRef = useRef(null);

  // Fetch survey details
  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const surveyResponse = await surveyAPI.getSurvey(surveyId);
        if (surveyResponse.success) {
          const surveyData = surveyResponse.data?.survey || surveyResponse.data;
          setSurvey(surveyData);
        }
      } catch (error) {
        console.error('Error fetching survey:', error);
        showError('Failed to load survey details');
      }
    };

    if (surveyId) {
      fetchSurvey();
    }
  }, [surveyId]);

  // Search interviewers by memberId (search-first approach)
  const searchInterviewers = useCallback(async (memberId) => {
    if (!memberId || memberId.trim().length < 2) {
      setSearchedInterviewers([]);
      setShowInterviewerDropdown(false);
      return;
    }

    // Clear existing timer
    if (interviewerSearchTimerRef.current) {
      clearTimeout(interviewerSearchTimerRef.current);
    }

    // Debounce search
    interviewerSearchTimerRef.current = setTimeout(async () => {
      try {
        setSearchingInterviewers(true);
        const response = await authAPI.searchInterviewerByMemberId(memberId.trim(), surveyId);
        
        if (response.success && response.data) {
          setSearchedInterviewers(response.data);
          setShowInterviewerDropdown(true);
        } else {
          setSearchedInterviewers([]);
        }
      } catch (error) {
        console.error('Error searching interviewers:', error);
        setSearchedInterviewers([]);
      } finally {
        setSearchingInterviewers(false);
      }
    }, 500); // 500ms debounce
  }, [surveyId]);

  // Handle interviewer search input change
  useEffect(() => {
    if (interviewerSearchTerm.trim()) {
      searchInterviewers(interviewerSearchTerm);
    } else {
      setSearchedInterviewers([]);
      setShowInterviewerDropdown(false);
    }
  }, [interviewerSearchTerm, searchInterviewers]);

  // Search ACs by code (search-first approach)
  const searchACs = useCallback((acCode) => {
    if (!acCode || acCode.trim().length < 1) {
      setSearchedACs([]);
      setShowACDropdown(false);
      return;
    }

    // Clear existing timer
    if (acSearchTimerRef.current) {
      clearTimeout(acSearchTimerRef.current);
    }

    // Debounce search
    acSearchTimerRef.current = setTimeout(() => {
      const searchTerm = acCode.trim().toLowerCase();
      const matchingACs = [];

      // Search through assembly constituencies data
      if (assemblyConstituenciesData.states) {
        Object.values(assemblyConstituenciesData.states).forEach(state => {
          if (state.assemblyConstituencies) {
            state.assemblyConstituencies.forEach(ac => {
              const acName = ac.acName || '';
              const numericCode = ac.numericCode || '';
              const fullCode = ac.acCode || '';
              
              // Check if search term matches AC code (numeric or full) or name
              const codeMatch = numericCode.includes(searchTerm) || 
                               fullCode.toLowerCase().includes(searchTerm) ||
                               acName.toLowerCase().includes(searchTerm);
              
              if (codeMatch) {
                matchingACs.push({
                  name: acName,
                  numericCode: numericCode,
                  fullCode: fullCode,
                  district: ac.district || '',
                  lokSabha: ac.lokSabha || ''
                });
              }
            });
          }
        });
      }

      // Limit to 20 results
      setSearchedACs(matchingACs.slice(0, 20));
      setShowACDropdown(matchingACs.length > 0);
    }, 300); // 300ms debounce
  }, []);

  // Handle AC search input change
  useEffect(() => {
    if (acSearchTerm.trim()) {
      searchACs(acSearchTerm);
    } else {
      setSearchedACs([]);
      setShowACDropdown(false);
    }
  }, [acSearchTerm, searchACs]);

  // Check if filters are default (no filters applied)
  const areFiltersDefault = useMemo(() => {
    return filters.dateRange === 'all' &&
      !filters.startDate &&
      !filters.endDate &&
      filters.status === 'approved_rejected_pending' &&
      !filters.interviewMode &&
      !filters.ac &&
      !filters.district &&
      !filters.lokSabha &&
      filters.interviewerIds.length === 0;
  }, [filters]);

  // Fetch analytics V2 with debouncing - Always load main stats
  const fetchAnalytics = useCallback(async () => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce API call
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const analyticsResponse = await surveyAPI.getSurveyAnalyticsV2(surveyId, filters);
        
        if (analyticsResponse.success && analyticsResponse.data) {
          setStats(analyticsResponse.data);
          setInitialLoad(false);
        } else {
          showError('Failed to load analytics');
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        showError('Failed to load analytics', error.message);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce
  }, [surveyId, filters, showError]);

  // Fetch AC-wise stats - Only load when filters are applied (not default)
  const fetchACStats = useCallback(async () => {
    // Skip fetch if filters are default and this is initial load
    if (initialLoad && areFiltersDefault) {
      return;
    }

    // Use a separate timer for AC stats to avoid conflicts
    const acStatsTimer = setTimeout(async () => {
      try {
        setAcStatsLoading(true);
        const acStatsResponse = await surveyAPI.getACWiseStatsV2(surveyId, filters);
        
        if (acStatsResponse.success && acStatsResponse.data) {
          setAcStats(acStatsResponse.data);
        } else {
          showError('Failed to load AC-wise stats');
        }
      } catch (error) {
        console.error('Error fetching AC-wise stats:', error);
        showError('Failed to load AC-wise stats', error.message);
      } finally {
        setAcStatsLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(acStatsTimer);
  }, [surveyId, filters, areFiltersDefault, initialLoad, showError]);

  // Helper function to extract numeric AC code (remove state prefix and leading zeros)
  // e.g., "WB001" -> "1", "WB010" -> "10", "WB100" -> "100"
  const getNumericACCode = useCallback((acCode) => {
    if (!acCode || typeof acCode !== 'string') return '';
    
    // Remove state prefix (alphabets at the start) and extract numeric part
    const numericPart = acCode.replace(/^[A-Z]+/, '');
    
    // Remove leading zeros and return as string
    // If all zeros, return "0", otherwise return the number without leading zeros
    const numericValue = parseInt(numericPart, 10);
    return isNaN(numericValue) ? '' : numericValue.toString();
  }, []);

  // Fetch and populate missing AC/PC codes from polling station API
  useEffect(() => {
    if (!acStats || acStats.length === 0 || !survey) return;

    const fetchPCDataForACs = async () => {
      const state = survey.acAssignmentState || 'West Bengal';
      const newCache = new Map(acPCMappingCache);
      
      // Find ACs that need PC data (missing acCode or pcCode)
      const acsToFetch = acStats
        .filter(stat => {
          // Need to fetch if acCode or pcCode is missing/empty
          const needsACCode = !stat.acCode || stat.acCode === '-' || stat.acCode === '';
          const needsPCCode = !stat.pcCode || stat.pcCode === '-' || stat.pcCode === '';
          
          // Check if already cached
          if (acPCMappingCache.has(stat.ac)) {
            const cached = acPCMappingCache.get(stat.ac);
            if (cached.acCode && cached.pcCode) {
              return false; // Already have complete data
            }
          }
          
          return needsACCode || needsPCCode;
        })
        .slice(0, 30); // Limit to 30 at a time to avoid overwhelming the API
      
      if (acsToFetch.length === 0) return;

      // Fetch in parallel - try with AC name first, then with AC code if available
      const fetchPromises = acsToFetch.map(async (acStat) => {
        try {
          // Priority 1: Try with AC code if available (numeric)
          if (acStat.acCode && acStat.acCode !== '-') {
            const response = await pollingStationAPI.getGroupsByAC(state, acStat.acCode);
            if (response.success && response.data) {
              return {
                ac: acStat.ac,
                acCode: acStat.acCode || response.data.ac_no?.toString() || '',
                pcCode: response.data.pc_no?.toString() || '',
                pcName: response.data.pc_name || ''
              };
            }
          }
          
          // Priority 2: Try with AC name
          const response = await pollingStationAPI.getGroupsByAC(state, acStat.ac);
          if (response.success && response.data) {
            // Get AC code from assemblyConstituencies if not available
            let acCode = acStat.acCode;
            if (!acCode || acCode === '-') {
              const acData = getACByName(acStat.ac);
              if (acData?.acCode) {
                acCode = getNumericACCode(acData.acCode);
              } else if (response.data.ac_no) {
                acCode = response.data.ac_no.toString();
              }
            }
            
            return {
              ac: acStat.ac,
              acCode: acCode || '',
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
      let cacheUpdated = false;
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          // Cache by AC name
          newCache.set(result.value.ac, {
            acCode: result.value.acCode,
            pcCode: result.value.pcCode,
            pcName: result.value.pcName
          });
          cacheUpdated = true;
        }
      });
      
      if (cacheUpdated) {
        setAcPCMappingCache(newCache);
      }
    };
    
    fetchPCDataForACs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acStats?.length, survey?.acAssignmentState, getNumericACCode]);

  // Enhance acStats with cached AC/PC codes using useMemo (prevents infinite loops)
  const enhancedAcStats = useMemo(() => {
    if (!acStats || acStats.length === 0) return acStats;
    
    return acStats.map(stat => {
      // First check cache
      const cached = acPCMappingCache.get(stat.ac);
      if (cached) {
        return {
          ...stat,
          acCode: (stat.acCode && stat.acCode !== '-') ? stat.acCode : (cached.acCode || stat.acCode || '-'),
          pcCode: (stat.pcCode && stat.pcCode !== '-') ? stat.pcCode : (cached.pcCode || stat.pcCode || '-'),
          pcName: stat.pcName || cached.pcName || stat.pcName || '-'
        };
      }
      
      // If still missing AC code, try to get from assemblyConstituencies
      if ((!stat.acCode || stat.acCode === '-') && stat.ac) {
        const acData = getACByName(stat.ac);
        if (acData?.acCode) {
          return {
            ...stat,
            acCode: getNumericACCode(acData.acCode)
          };
        }
      }
      
      return stat;
    });
  }, [acStats, acPCMappingCache, getNumericACCode]);

  // Fetch analytics when survey loads or filters change - Always load main stats
  useEffect(() => {
    if (surveyId && survey) {
      fetchAnalytics();
    }
  }, [surveyId, survey, fetchAnalytics]);

  // Fetch analytics when filters change
  useEffect(() => {
    if (surveyId && survey) {
      fetchAnalytics();
    }
  }, [filters.dateRange, filters.startDate, filters.endDate, filters.status, filters.interviewMode, filters.ac, filters.district, filters.lokSabha, filters.interviewerIds, filters.interviewerMode, surveyId, survey, fetchAnalytics]);

  // Fetch AC-wise stats when filters change (only when filters are applied)
  useEffect(() => {
    if (surveyId && survey) {
      fetchACStats();
    }
  }, [filters.dateRange, filters.startDate, filters.endDate, filters.status, filters.interviewMode, filters.ac, filters.district, filters.lokSabha, filters.interviewerIds, filters.interviewerMode, surveyId, survey, fetchACStats]);

  // Fetch Interviewer-wise stats - Only load when filters are applied (not default)
  const fetchInterviewerStats = useCallback(async () => {
    // Skip fetch if filters are default and this is initial load
    if (initialLoad && areFiltersDefault) {
      return;
    }

    // Use a separate timer for interviewer stats to avoid conflicts
    const interviewerStatsTimer = setTimeout(async () => {
      try {
        setInterviewerStatsLoading(true);
        const interviewerStatsResponse = await surveyAPI.getInterviewerWiseStatsV2(surveyId, filters);
        
        if (interviewerStatsResponse.success && interviewerStatsResponse.data) {
          setInterviewerStats(interviewerStatsResponse.data);
        } else {
          showError('Failed to load interviewer-wise stats');
        }
      } catch (error) {
        console.error('Error fetching interviewer-wise stats:', error);
        showError('Failed to load interviewer-wise stats', error.message);
      } finally {
        setInterviewerStatsLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(interviewerStatsTimer);
  }, [surveyId, filters, areFiltersDefault, initialLoad, showError]);

  // Fetch Interviewer-wise stats when filters change (only when filters are applied)
  useEffect(() => {
    if (surveyId && survey) {
      fetchInterviewerStats();
    }
  }, [filters.dateRange, filters.startDate, filters.endDate, filters.status, filters.interviewMode, filters.ac, filters.district, filters.lokSabha, filters.interviewerIds, filters.interviewerMode, surveyId, survey, fetchInterviewerStats]);

  // Fetch Chart Data - Always load when filters are applied
  const fetchChartData = useCallback(async () => {
    // Skip fetch if filters are default and this is initial load
    if (initialLoad && areFiltersDefault) {
      return;
    }

    const chartDataTimer = setTimeout(async () => {
      try {
        setChartDataLoading(true);
        const chartDataResponse = await surveyAPI.getChartDataV2(surveyId, filters);
        
        if (chartDataResponse.success && chartDataResponse.data) {
          setChartData(chartDataResponse.data);
        } else {
          showError('Failed to load chart data');
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        showError('Failed to load chart data', error.message);
      } finally {
        setChartDataLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(chartDataTimer);
  }, [surveyId, filters, areFiltersDefault, initialLoad, showError]);

  // Fetch Chart Data when filters change (only when filters are applied)
  useEffect(() => {
    if (surveyId && survey) {
      fetchChartData();
    }
  }, [filters.dateRange, filters.startDate, filters.endDate, filters.status, filters.interviewMode, filters.ac, filters.district, filters.lokSabha, filters.interviewerIds, filters.interviewerMode, surveyId, survey, fetchChartData]);

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
      const idStr = interviewerId?.toString() || interviewerId;
      const currentIdsStr = currentIds.map(id => id?.toString() || id);
      const isSelected = currentIdsStr.includes(idStr);
      
      return {
        ...prev,
        interviewerIds: isSelected
          ? currentIds.filter(id => (id?.toString() || id) !== idStr)
          : [...currentIds, idStr]
      };
    });
  };

  // Handle interviewer mode toggle
  const handleInterviewerModeToggle = (mode) => {
    handleFilterChange('interviewerMode', mode);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      dateRange: 'all',
      startDate: '',
      endDate: '',
      status: 'approved_rejected_pending',
      interviewMode: '',
      ac: '',
      district: '',
      lokSabha: '',
      interviewerIds: [],
      interviewerMode: 'include'
    });
    setAcSearchTerm('');
    setInterviewerSearchTerm('');
    setSearchedACs([]);
    setSearchedInterviewers([]);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (acDropdownRef.current && !acDropdownRef.current.contains(event.target)) {
        setShowACDropdown(false);
      }
      if (interviewerDropdownRef.current && !interviewerDropdownRef.current.contains(event.target)) {
        setShowInterviewerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add CSS to ensure full width and responsive behavior (same as SurveyReportsPage)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .survey-reports-v2-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .survey-reports-v2-page * {
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

  // Format number with commas
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-IN');
  };

  // Prepare chart data for response trends over time
  const prepareChartData = () => {
    if (!chartData || !chartData.dailyStats || chartData.dailyStats.length === 0) {
      return null;
    }

    const dailyData = chartData.dailyStats;
    
    // Sort data by date
    const sortedData = [...dailyData].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedData.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    });

    const totalResponsesData = sortedData.map(item => item.count || 0);
    const capiData = sortedData.map(item => item.capi || 0);
    const catiData = sortedData.map(item => item.cati || 0);

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
          maxTicksLimit: 20,
          stepSize: undefined,
          callback: function(value) {
            return Number.isInteger(value) ? value : null;
          }
        }
      }
    }
  };

  // Download AC-wise stats as CSV (all filtered data)
  const downloadACStatsCSV = () => {
    if (enhancedAcStats.length === 0) {
      showError('No AC-wise data to download');
      return;
    }

    const headers = [
      'Rank',
      'Assembly Constituency',
      'AC Code',
      'PC Code',
      'PC Name',
      'PS Covered',
      'Completed Interviews',
      'System Rejections',
      'Counts after Terminated and System Rejection',
      'GPS Pending',
      'GPS Fail',
      'Number of Interviewers Worked',
      'Approved',
      'Rejected',
      'Under QC',
      'CAPI',
      'CATI'
    ];

    const csvData = enhancedAcStats.map((stat, index) => [
      index + 1,
      stat.ac || 'N/A',
      stat.acCode || '-',
      stat.pcCode || '-',
      stat.pcName || '-',
      stat.psCovered || 0,
      stat.completedInterviews || 0,
      stat.autoRejected || 0,
      stat.countsAfterRejection || 0,
      stat.gpsPending || 0,
      stat.gpsFail || 0,
      stat.interviewersCount || 0,
      stat.approved || 0,
      stat.rejected || 0,
      stat.underQC || 0,
      stat.capi || 0,
      stat.cati || 0
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ac_wise_performance_${survey?.surveyName?.replace(/[^a-z0-9]/gi, '_') || 'survey'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Download Interviewer-wise stats as CSV (all filtered data)
  const downloadInterviewerStatsCSV = () => {
    if (interviewerStats.length === 0) {
      showError('No interviewer-wise data to download');
      return;
    }

    const headers = [
      'Rank',
      'Interviewer ID',
      'Interviewer',
      'PS Covered',
      'Completed Interviews',
      'System Rejections',
      'Counts after Terminated and System Rejection',
      'GPS Pending',
      'GPS Fail',
      'Approved',
      'Rejected',
      'Under QC',
      'CAPI',
      'CATI'
    ];

    const csvData = interviewerStats.map((stat, index) => [
      index + 1,
      stat.memberId || 'N/A',
      stat.interviewer || 'N/A',
      stat.psCovered || 0,
      stat.completedInterviews || 0,
      stat.autoRejected || 0,
      stat.countsAfterRejection || 0,
      stat.gpsPending || 0,
      stat.gpsFail || 0,
      stat.approved || 0,
      stat.rejected || 0,
      stat.underQC || 0,
      stat.capi || 0,
      stat.cati || 0
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interviewer_wise_performance_${survey?.surveyName?.replace(/[^a-z0-9]/gi, '_') || 'survey'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Pagination calculations for AC stats
  const totalPages = Math.ceil(enhancedAcStats.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedACStats = enhancedAcStats.slice(startIndex, endIndex);

  // Pagination calculations for Interviewer stats
  const interviewerTotalPages = Math.ceil(interviewerStats.length / itemsPerPage);
  const interviewerStartIndex = (interviewerCurrentPage - 1) * itemsPerPage;
  const interviewerEndIndex = interviewerStartIndex + itemsPerPage;
  const paginatedInterviewerStats = interviewerStats.slice(interviewerStartIndex, interviewerEndIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setInterviewerCurrentPage(1);
  }, [filters.dateRange, filters.startDate, filters.endDate, filters.status, filters.interviewMode, filters.ac, filters.district, filters.lokSabha, filters.interviewerIds, filters.interviewerMode]);

  return (
    <div className="min-h-screen bg-gray-50 w-full survey-reports-v2-page">
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
                  Reports V2 - {survey?.surveyName || 'Survey Reports'}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
              Filters
            </h2>
            <button
              onClick={clearFilters}
              className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
              
              {filters.dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    selected={filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null}
                    onChange={(date) => {
                      if (date) {
                        // Format date as YYYY-MM-DD using local timezone (IST)
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        handleFilterChange('startDate', `${year}-${month}-${day}`);
                      } else {
                        handleFilterChange('startDate', '');
                      }
                    }}
                    selectsStart
                    startDate={filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null}
                    endDate={filters.endDate ? new Date(filters.endDate + 'T00:00:00') : null}
                    maxDate={filters.endDate ? new Date(filters.endDate + 'T00:00:00') : new Date()}
                    placeholderText="Start Date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    dateFormat="yyyy-MM-dd"
                  />
                  <DatePicker
                    selected={filters.endDate ? new Date(filters.endDate + 'T00:00:00') : null}
                    onChange={(date) => {
                      if (date) {
                        // Format date as YYYY-MM-DD using local timezone (IST)
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        handleFilterChange('endDate', `${year}-${month}-${day}`);
                      } else {
                        handleFilterChange('endDate', '');
                      }
                    }}
                    selectsEnd
                    startDate={filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null}
                    endDate={filters.endDate ? new Date(filters.endDate + 'T00:00:00') : null}
                    minDate={filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null}
                    maxDate={new Date()}
                    placeholderText="End Date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    dateFormat="yyyy-MM-dd"
                  />
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

            {/* Assembly Constituency - Search First */}
            <div className="relative" ref={acDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assembly Constituency
                {filters.ac && <span className="text-xs text-gray-500 ml-1">(Selected: {filters.ac})</span>}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by AC code or name..."
                  value={acSearchTerm}
                  onChange={(e) => {
                    setAcSearchTerm(e.target.value);
                    if (!e.target.value.trim()) {
                      handleFilterChange('ac', '');
                    }
                  }}
                  onFocus={() => {
                    if (searchedACs.length > 0) {
                      setShowACDropdown(true);
                    }
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {filters.ac && (
                  <button
                    onClick={() => {
                      handleFilterChange('ac', '');
                      setAcSearchTerm('');
                      setSearchedACs([]);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {showACDropdown && searchedACs.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchedACs.map((ac, idx) => (
                    <div
                      key={`${ac.name}-${idx}`}
                      onClick={() => {
                        handleFilterChange('ac', ac.name);
                        setAcSearchTerm('');
                        setShowACDropdown(false);
                      }}
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                        filters.ac === ac.name ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium">{ac.name}</div>
                      <div className="text-xs text-gray-500">
                        {ac.numericCode && `Code: ${ac.numericCode}`}
                        {ac.district && ` • District: ${ac.district}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showACDropdown && acSearchTerm.trim() && searchedACs.length === 0 && !searchingInterviewers && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                  No ACs found matching "{acSearchTerm}"
                </div>
              )}
            </div>

            {/* Interviewer - Search First by Member ID */}
            <div className="relative" ref={interviewerDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interviewer {filters.interviewerIds?.length > 0 && `(${filters.interviewerIds.length} selected)`}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by Member ID (e.g., 186332)..."
                  value={interviewerSearchTerm}
                  onChange={(e) => {
                    setInterviewerSearchTerm(e.target.value);
                  }}
                  onFocus={() => {
                    if (searchedInterviewers.length > 0) {
                      setShowInterviewerDropdown(true);
                    }
                  }}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchingInterviewers && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              {filters.interviewerIds?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {filters.interviewerIds.map(id => {
                    const interviewer = searchedInterviewers.find(i => (i._id?.toString() || i._id) === (id?.toString() || id));
                    if (!interviewer) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {interviewer.firstName} {interviewer.lastName} ({interviewer.memberId})
                        <button onClick={() => handleInterviewerToggle(id)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {showInterviewerDropdown && searchedInterviewers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchedInterviewers.map(int => {
                    const idStr = int._id?.toString() || int._id;
                    const isSelected = filters.interviewerIds.some(id => (id?.toString() || id) === idStr);
                    return (
                      <div
                        key={int._id}
                        onClick={() => handleInterviewerToggle(int._id)}
                        className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <div className="font-medium">{int.firstName} {int.lastName}</div>
                        <div className="text-xs text-gray-500">
                          Member ID: {int.memberId}
                          {int.email && ` • ${int.email}`}
                          {int.responseCount !== undefined && ` • ${int.responseCount} responses`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {showInterviewerDropdown && interviewerSearchTerm.trim() && searchedInterviewers.length === 0 && !searchingInterviewers && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                  No interviewers found matching "{interviewerSearchTerm}"
                </div>
              )}
              {filters.interviewerIds?.length > 0 && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleInterviewerModeToggle('include')}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      filters.interviewerMode === 'include' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Include
                  </button>
                  <button
                    onClick={() => handleInterviewerModeToggle('exclude')}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      filters.interviewerMode === 'exclude' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Exclude
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mb-4"></div>
              <p className="text-gray-600">Loading analytics...</p>
            </div>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Total Responses */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Responses</h3>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalResponses)}</p>
              <p className="text-xs text-gray-400 mt-2">All responses matching filters</p>
            </div>

            {/* Sample Size */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Sample Size</h3>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.sampleSize)}</p>
              <p className="text-xs text-gray-400 mt-2">Target sample size</p>
            </div>

            {/* CAPI Responses */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">CAPI Responses</h3>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.capiResponses)}</p>
              <p className="text-xs text-gray-400 mt-2">Computer-Assisted Personal Interview</p>
            </div>

            {/* CATI Responses */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Phone className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">CATI Responses</h3>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.catiResponses)}</p>
              <p className="text-xs text-gray-400 mt-2">Computer-Assisted Telephone Interview</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500">No data available</p>
          </div>
        )}

        {/* Overall Response Trends Chart */}
        {initialLoad && areFiltersDefault ? null : (
          <div className="mt-6 sm:mt-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Overall Response Trends</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Daily response trends over time</p>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="h-80 w-full">
                {chartDataLoading ? (
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
              {chartData && chartData.dailyStats && chartData.dailyStats.length > 0 && stats && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#373177]">{formatNumber(stats.totalResponses)}</div>
                    <div className="text-sm text-gray-600">Total Responses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{formatNumber(stats.capiResponses)}</div>
                    <div className="text-sm text-gray-600">CAPI Responses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{formatNumber(stats.catiResponses)}</div>
                    <div className="text-sm text-gray-600">CATI Responses</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Tabs Section */}
        {initialLoad && areFiltersDefault ? null : (
          <div className="mt-6 sm:mt-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <div className="flex items-center justify-between px-4 sm:px-6">
                <nav className="flex space-x-1 sm:space-x-2" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('ac')}
                    className={`px-3 sm:px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'ac'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                    }`}
                  >
                    AC-wise Performance
                  </button>
                  <button
                    onClick={() => setActiveTab('interviewer')}
                    className={`px-3 sm:px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'interviewer'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300'
                    }`}
                  >
                    Interviewer-wise Performance
                  </button>
                </nav>
                {/* Download CSV Button */}
                {((activeTab === 'ac' && enhancedAcStats.length > 0) || (activeTab === 'interviewer' && interviewerStats.length > 0)) && (
                  <button
                    onClick={() => activeTab === 'ac' ? downloadACStatsCSV() : downloadInterviewerStatsCSV()}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download As CSV</span>
                    <span className="sm:hidden">CSV</span>
                  </button>
                )}
              </div>
            </div>

            {/* AC-wise Performance Tab Content */}
            {activeTab === 'ac' && (
              <div>
                {acStatsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mb-4"></div>
                      <p className="text-gray-600">Loading AC-wise stats...</p>
                    </div>
                  </div>
                ) : enhancedAcStats.length > 0 ? (
                  <>
                    <div className="overflow-x-auto w-full">
                      <div className="inline-block min-w-full align-middle">
                        <div className="overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rank</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Assembly Constituency</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">AC Code</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PC Code</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PC Name</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PS Covered</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Completed Interviews</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">System Rejections</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">After Rejection</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">GPS Pending</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">GPS Fail</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Interviewers</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Approved</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rejected</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Under QC</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">CAPI</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">CATI</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {paginatedACStats.map((stat, index) => (
                                <tr key={stat.ac || index} className="hover:bg-gray-50">
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <span className="w-6 h-6 bg-[#E6F0F8] text-[#373177] text-xs font-semibold rounded-full flex items-center justify-center">
                                      {startIndex + index + 1}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{stat.ac || 'N/A'}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{stat.acCode || '-'}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{stat.pcCode || '-'}</td>
                                  <td className="px-3 py-3 text-sm text-gray-600 max-w-xs truncate" title={stat.pcName || '-'}>{stat.pcName || '-'}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.psCovered || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.completedInterviews || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-red-600">{formatNumber(stat.autoRejected || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.countsAfterRejection || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.gpsPending || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.gpsFail || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.interviewersCount || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">{formatNumber(stat.approved || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-red-600">{formatNumber(stat.rejected || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-yellow-600">{formatNumber(stat.underQC || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">{formatNumber(stat.capi || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-orange-600">{formatNumber(stat.cati || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="text-sm text-gray-700">
                            Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, enhancedAcStats.length)}</span> of <span className="font-medium">{formatNumber(enhancedAcStats.length)}</span> results
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                  pageNum = totalPages - 4 + i;
                                } else {
                                  pageNum = currentPage - 2 + i;
                                }
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                      currentPage === pageNum
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              Next
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-gray-500">No AC-wise stats available</p>
                  </div>
                )}
              </div>
            )}

            {/* Interviewer-wise Performance Tab Content */}
            {activeTab === 'interviewer' && (
              <div>
                {interviewerStatsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mb-4"></div>
                      <p className="text-gray-600">Loading interviewer-wise stats...</p>
                    </div>
                  </div>
                ) : interviewerStats.length > 0 ? (
                  <>
                    <div className="overflow-x-auto w-full">
                      <div className="inline-block min-w-full align-middle">
                        <div className="overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rank</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Interviewer ID</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Interviewer</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">PS Covered</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Completed Interviews</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">System Rejections</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">After Rejection</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">GPS Pending</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">GPS Fail</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Approved</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Rejected</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Under QC</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">CAPI</th>
                                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">CATI</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {paginatedInterviewerStats.map((stat, index) => (
                                <tr key={stat.interviewerId || index} className="hover:bg-gray-50">
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <span className="w-6 h-6 bg-green-100 text-green-600 text-xs font-semibold rounded-full flex items-center justify-center">
                                      {interviewerStartIndex + index + 1}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{stat.memberId || 'N/A'}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{stat.interviewer || 'N/A'}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.psCovered || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.completedInterviews || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-red-600">{formatNumber(stat.autoRejected || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.countsAfterRejection || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.gpsPending || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">{formatNumber(stat.gpsFail || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">{formatNumber(stat.approved || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-red-600">{formatNumber(stat.rejected || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-yellow-600">{formatNumber(stat.underQC || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">{formatNumber(stat.capi || 0)}</td>
                                  <td className="px-3 py-3 whitespace-nowrap text-sm text-right font-semibold text-orange-600">{formatNumber(stat.cati || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    
                    {/* Pagination Controls */}
                    {interviewerTotalPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="text-sm text-gray-700">
                            Showing <span className="font-medium">{interviewerStartIndex + 1}</span> to <span className="font-medium">{Math.min(interviewerEndIndex, interviewerStats.length)}</span> of <span className="font-medium">{formatNumber(interviewerStats.length)}</span> results
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setInterviewerCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={interviewerCurrentPage === 1}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, interviewerTotalPages) }, (_, i) => {
                                let pageNum;
                                if (interviewerTotalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (interviewerCurrentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (interviewerCurrentPage >= interviewerTotalPages - 2) {
                                  pageNum = interviewerTotalPages - 4 + i;
                                } else {
                                  pageNum = interviewerCurrentPage - 2 + i;
                                }
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setInterviewerCurrentPage(pageNum)}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                      interviewerCurrentPage === pageNum
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => setInterviewerCurrentPage(prev => Math.min(interviewerTotalPages, prev + 1))}
                              disabled={interviewerCurrentPage === interviewerTotalPages}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              Next
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-gray-500">No interviewer-wise stats available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default SurveyReportsV2Page;
