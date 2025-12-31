import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  ArrowLeft,
  Filter, 
  Download, 
  Search,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  CheckCircle,
  XCircle,
  BarChart3,
  Users
} from 'lucide-react';
import { performanceAPI, surveyAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  Title,
  Tooltip,
  Legend,
  Filler
);

const QCPerformancePage = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine if we're in project manager route
  const isProjectManagerRoute = location.pathname.includes('/project-manager/');
  const backPath = isProjectManagerRoute ? '/project-manager/survey-reports' : '/company/surveys';
  const [survey, setSurvey] = useState(null);
  const [qualityAgents, setQualityAgents] = useState([]);
  const [trendsData, setTrendsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    dateRange: 'all', // 'all', 'today', 'yesterday', 'week', 'month', 'custom'
    startDate: '',
    endDate: '',
    sortBy: 'totalReviews', // totalReviews, approvedResponses, rejectedResponses
    sortOrder: 'desc' // asc, desc
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showFilters, setShowFilters] = useState(true);

  // Add CSS to ensure full width and responsive layout
  // Add CSS to ensure full width and break out of DashboardLayout padding
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .qc-performance-page {
        width: 100vw !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .qc-performance-page * {
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

  // Calculate date range based on dateRange filter
  const getDateRange = useMemo(() => {
    const now = new Date();
    let startDate = '';
    let endDate = '';

    if (filters.dateRange === 'all') {
      // No date filtering
      return { startDate: '', endDate: '' };
    } else if (filters.dateRange === 'custom') {
      // Use custom dates
      return { startDate: filters.startDate, endDate: filters.endDate };
    } else {
      // Calculate based on dateRange
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      switch (filters.dateRange) {
        case 'today':
          startDate = today.toISOString().split('T')[0];
          endDate = tomorrow.toISOString().split('T')[0];
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = yesterday.toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          startDate = weekAgo.toISOString().split('T')[0];
          endDate = tomorrow.toISOString().split('T')[0];
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          startDate = monthAgo.toISOString().split('T')[0];
          endDate = tomorrow.toISOString().split('T')[0];
          break;
      }
    }

    return { startDate, endDate };
  }, [filters.dateRange, filters.startDate, filters.endDate]);

  // Fetch survey and QC performance data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch survey details
      const surveyResponse = await surveyAPI.getSurvey(surveyId);
      if (surveyResponse.success) {
        setSurvey(surveyResponse.data.survey || surveyResponse.data);
      }
      
      // Fetch QC performance data
      const params = {
        ...(getDateRange.startDate && { startDate: getDateRange.startDate }),
        ...(getDateRange.endDate && { endDate: getDateRange.endDate }),
        ...(filters.search && { search: filters.search })
      };
      
      // Fetch both QC performance and trends data in parallel
      const [qcResponse, trendsResponse] = await Promise.all([
        performanceAPI.getQCPerformanceBySurvey(surveyId, params),
        performanceAPI.getQCPerformanceTrends(surveyId, {
          ...(getDateRange.startDate && { startDate: getDateRange.startDate }),
          ...(getDateRange.endDate && { endDate: getDateRange.endDate })
        })
      ]);
      
      if (qcResponse.success) {
        setQualityAgents(qcResponse.data.qualityAgents || []);
      }
      
      if (trendsResponse.success) {
        setTrendsData(trendsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching QC performance:', error);
      showError('Failed to load QC performance data', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (surveyId) {
      fetchData();
    }
  }, [surveyId, filters.dateRange, filters.startDate, filters.endDate, filters.search]);

  // Apply search and sorting
  const filteredAndSortedData = useMemo(() => {
    let data = [...qualityAgents];

    // Apply search filter (name, email, or memberId)
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      data = data.filter(qa => {
        const nameMatch = qa.name?.toLowerCase().includes(searchLower) || false;
        const emailMatch = qa.email?.toLowerCase().includes(searchLower) || false;
        const memberIdMatch = qa.memberId?.toString().includes(searchLower) || false;
        return nameMatch || emailMatch || memberIdMatch;
      });
    }

    // Apply sorting
    data.sort((a, b) => {
      let aValue, bValue;
      
      switch (filters.sortBy) {
        case 'assigned':
          aValue = a.assigned || 0;
          bValue = b.assigned || 0;
          break;
        case 'totalReviews':
          aValue = a.totalReviews;
          bValue = b.totalReviews;
          break;
        case 'approvedResponses':
          aValue = a.approvedResponses;
          bValue = b.approvedResponses;
          break;
        case 'rejectedResponses':
          aValue = a.rejectedResponses;
          bValue = b.rejectedResponses;
          break;
        default:
          aValue = a.totalReviews;
          bValue = b.totalReviews;
      }

      if (filters.sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return data;
  }, [qualityAgents, filters.search, filters.sortBy, filters.sortOrder]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = filteredAndSortedData.slice(startIndex, endIndex);
    
    // Update serial numbers based on current page
    return paginated.map((qa, index) => ({
      ...qa,
      serialNumber: startIndex + index + 1
    }));
  }, [filteredAndSortedData, currentPage, pageSize]);

  // Pagination info
  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      dateRange: 'all',
      startDate: '',
      endDate: '',
      sortBy: 'totalReviews',
      sortOrder: 'desc'
    });
  };

  // Handle CSV download
  const handleCSVDownload = () => {
    const headers = ['S.No', 'Name', 'Email', 'Phone', 'Assigned', 'Total Reviews', 'Approved Responses', 'Rejected Responses'];
    
    const csvData = filteredAndSortedData.map(qa => [
      qa.serialNumber,
      qa.name,
      qa.email,
      qa.phone,
      qa.assigned || 0,
      qa.totalReviews,
      qa.approvedResponses,
      qa.rejectedResponses
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${survey?.surveyName || 'survey'}_qc_performance_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Get sort icon
  const getSortIcon = (column) => {
    if (filters.sortBy !== column) {
      return null;
    }
    return filters.sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  // Handle column sort
  const handleSort = (column) => {
    if (filters.sortBy === column) {
      // Toggle sort order
      setFilters(prev => ({
        ...prev,
        sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      // Set new sort column
      setFilters(prev => ({
        ...prev,
        sortBy: column,
        sortOrder: 'desc'
      }));
    }
  };

  // Prepare chart data for performance over time
  const prepareChartData = () => {
    if (!trendsData?.dailyPerformance || trendsData.dailyPerformance.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = trendsData.dailyPerformance.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Total Reviewed',
          data: trendsData.dailyPerformance.map(item => item.totalReviewed),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Approved',
          data: trendsData.dailyPerformance.map(item => item.approved),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Rejected',
          data: trendsData.dailyPerformance.map(item => item.rejected),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
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
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading QC performance data...</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Survey Not Found</h2>
          <button
            onClick={() => navigate('/company/surveys')}
            className="px-4 py-2 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full qc-performance-page">
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
                  QC Performance - {survey.surveyName || survey.title || 'Survey'}
                </h1>
                <p className="text-sm text-gray-600">
                  {filteredAndSortedData.length} quality agent{filteredAndSortedData.length !== 1 ? 's' : ''}
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
              
              <button
                onClick={handleCSVDownload}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 w-full">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-[#373177] hover:text-blue-800"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Quality Agent
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search by name, email, or Member ID..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Range
                </label>
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
              </div>

              {/* Custom Date Range Picker */}
              {filters.dateRange === 'custom' && (
                <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Stats Cards */}
        {trendsData?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Number of QC Reviews</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{trendsData.summary.totalReviewed}</p>
                </div>
                <div className="p-3 bg-[#E6F0F8] rounded-lg">
                  <BarChart3 className="h-6 w-6 text-[#373177]" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Approved</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{trendsData.summary.totalApproved}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Rejected</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{trendsData.summary.totalRejected}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Daily</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{trendsData.summary.averageDaily}</p>
                  <p className="text-xs text-gray-500 mt-1">{trendsData.summary.daysCount} day{trendsData.summary.daysCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-3 bg-[#E8E6F5] rounded-lg">
                  <TrendingUp className="h-6 w-6 text-[#373177]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Over Time Chart */}
        {trendsData?.dailyPerformance && trendsData.dailyPerformance.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#E6F0F8] rounded-lg">
                  <TrendingUp className="h-6 w-6 text-[#373177]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">QC Performance Over Time</h3>
                  <p className="text-sm text-gray-600">Daily review trends and approval rates</p>
                </div>
              </div>
              
              {/* Chart Legend Summary */}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-[#E6F0F8]0 rounded-full"></div>
                  <span className="text-gray-600">Total: {trendsData.summary.totalReviewed}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Approved: {trendsData.summary.totalApproved}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Rejected: {trendsData.summary.totalRejected}</span>
                </div>
              </div>
            </div>

            {/* Chart Container */}
            <div className="h-80 w-full">
              <Line data={prepareChartData()} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Quality Agents Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
          {/* Section Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#E8E6F5] rounded-lg">
                    <Users className="h-5 w-5 text-[#373177]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Quality Agents Performance</h3>
                    <p className="text-sm text-gray-600">
                      Showing {paginatedData.length} of {filteredAndSortedData.length} quality agent{filteredAndSortedData.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Search within Section */}
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Quality Agent
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search by name, email, or Member ID..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {filters.search && (
                    <button
                      onClick={() => handleFilterChange('search', '')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quality Agents List */}
          {filteredAndSortedData.length > 0 ? (
            <>
              <div className="divide-y divide-gray-200">
                {paginatedData.map((qa) => (
                  <div key={qa._id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      {/* Left: Agent Info */}
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {qa.name?.charAt(0)?.toUpperCase() || 'Q'}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{qa.name}</h4>
                            {qa.memberId && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-[#E6F0F8] text-blue-700 rounded-full">
                                ID: {qa.memberId}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                            <span className="truncate">{qa.email}</span>
                            {qa.phone && qa.phone !== 'N/A' && (
                              <>
                                <span>•</span>
                                <span>{qa.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Stats */}
                      <div className="flex items-center space-x-6 ml-4">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Assigned</div>
                          <div className="text-sm font-semibold text-gray-900">{qa.assigned || 0}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Total Reviews</div>
                          <div className="text-sm font-semibold text-gray-900">{qa.totalReviews}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Approved</div>
                          <div className="text-sm font-semibold text-green-600">{qa.approvedResponses}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Rejected</div>
                          <div className="text-sm font-semibold text-red-600">{qa.rejectedResponses}</div>
                        </div>
                        {qa.totalReviews > 0 && (
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">Approval Rate</div>
                            <div className="text-sm font-semibold text-[#373177]">
                              {((qa.approvedResponses / qa.totalReviews) * 100).toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-700">
                        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAndSortedData.length)} of {filteredAndSortedData.length} quality agents
                      </span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={!hasPrev}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
                        title="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      {/* Page Numbers */}
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
                        
                        if (pageNum < 1 || pageNum > totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-2 min-w-[2.5rem] border rounded-lg transition-colors ${
                              pageNum === currentPage
                                ? 'bg-[#001D48] text-white border-[#001D48]'
                                : 'border-gray-300 hover:bg-white'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={!hasNext}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white transition-colors"
                        title="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No quality agents found</p>
              <p className="text-gray-400 text-sm mt-2">
                {filters.search || filters.startDate || filters.endDate
                  ? 'Try adjusting your filters'
                  : 'No quality agents have reviewed responses for this survey yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QCPerformancePage;

