import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Calendar,
  Filter,
  RefreshCw,
  Target,
  Award,
  Users,
  Timer,
  Star,
  DollarSign,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { performanceAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
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

const PerformanceMonitoring = () => {
  const { showError } = useToast();
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNoData, setHasNoData] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [interviewHistory, setInterviewHistory] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    timeRange: '30d',
    surveyId: '',
    startDate: '',
    endDate: ''
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch performance data
  const fetchPerformanceData = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const params = {
        timeRange: filters.timeRange,
        ...(filters.surveyId && { surveyId: filters.surveyId }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      };

      const [analyticsResponse, trendsResponse, historyResponse] = await Promise.all([
        performanceAPI.getPerformanceAnalytics(params),
        performanceAPI.getPerformanceTrends({ period: 'daily' }),
        performanceAPI.getInterviewHistory({ page: 1, limit: 10 })
      ]);

      if (analyticsResponse.success) {
        setPerformanceData(analyticsResponse.data);
        setHasNoData(false);
      }
      
      if (trendsResponse.success) {
        setTrendsData(trendsResponse.data);
      }
      
      if (historyResponse.success) {
        setInterviewHistory(historyResponse.data);
      }

    } catch (error) {
      console.error('Error fetching performance data:', error);
      
      // Check if it's a network error or no data available
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Set empty data instead of showing error
        setPerformanceData({
          overview: {
            totalInterviews: 0,
            approvedInterviews: 0,
            rejectedInterviews: 0,
            pendingInterviews: 0,
            averageCompletionTime: 0,
            averageCompletionPercentage: 0,
            averageQualityScore: 0,
            totalEarnings: 0
          },
          dailyPerformance: [],
          surveyBreakdown: [],
          qualityMetrics: {
            averageScore: 0,
            scoreDistribution: []
          }
        });
        setTrendsData([]);
        setInterviewHistory([]);
        setHasNoData(true);
      } else {
        showError('Failed to load performance data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [filters]);

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
      timeRange: '30d',
      surveyId: '',
      startDate: '',
      endDate: ''
    });
  };

  // Prepare chart data for performance over time
  const prepareChartData = () => {
    if (!performanceData?.dailyPerformance || performanceData.dailyPerformance.length === 0) {
      return null;
    }

    const dailyData = performanceData.dailyPerformance;
    
    // Sort data by date
    const sortedData = dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedData.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    });

    const interviewsData = sortedData.map(item => item.interviews);
    const approvedData = sortedData.map(item => item.approved);
    const rejectedData = sortedData.map(item => item.rejected);
    const approvalRateData = sortedData.map(item => 
      item.interviews > 0 ? Math.round((item.approved / item.interviews) * 100) : 0
    );

    return {
      labels,
      datasets: [
        {
          label: 'Approved',
          data: approvedData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Rejected',
          data: rejectedData,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Approval Rate (%)',
          data: approvalRateData,
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          yAxisID: 'y1',
          pointStyle: 'circle',
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
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
          title: function(context) {
            return `Date: ${context[0].label}`;
          },
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label === 'Approval Rate (%)') {
              return `${label}: ${value}%`;
            }
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
          text: 'Number of Interviews',
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
          stepSize: 1,
          callback: function(value) {
            return Number.isInteger(value) ? value : null;
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Approval Rate (%)',
          font: {
            size: 12,
            weight: '600'
          }
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value) {
            return value + '%';
          }
        }
      }
    }
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.surveyId) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    return count;
  };

  // Format time duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return 'text-green-600 bg-green-50';
      case 'Rejected': return 'text-red-600 bg-red-50';
      case 'Pending_Approval': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved': return <CheckCircle className="h-4 w-4" />;
      case 'Rejected': return <XCircle className="h-4 w-4" />;
      case 'Pending_Approval': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Monitoring</h1>
          <p className="text-gray-600">Track your interview performance and analytics</p>
        </div>
        <button
          onClick={() => fetchPerformanceData(true)}
          disabled={refreshing}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                {getActiveFilterCount() > 0 && (
                  <span className="px-2 py-1 bg-[#E6F0F8] text-[#001D48] text-xs font-medium rounded-full">
                    {getActiveFilterCount()} active
                  </span>
                )}
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                <span className="text-sm font-medium">
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </span>
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Time Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                  <select
                    value={filters.timeRange}
                    onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                    <option value="all">All time</option>
                  </select>
                </div>

                {/* Survey Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Survey</label>
                  <select
                    value={filters.surveyId}
                    onChange={(e) => handleFilterChange('surveyId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Surveys</option>
                    {performanceData?.availableSurveys?.map((survey) => (
                      <option key={survey._id} value={survey._id}>
                        {survey.surveyName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {getActiveFilterCount() > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Performance Over Time Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#E6F0F8] rounded-lg">
                <TrendingUp className="h-6 w-6 text-[#001D48]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Performance Over Time</h3>
                <p className="text-sm text-gray-600">Daily interview trends and approval rates</p>
              </div>
            </div>
            
            {/* Chart Legend Summary */}
            {performanceData?.dailyPerformance && performanceData.dailyPerformance.length > 0 && (
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-[#E6F0F8]0 rounded-full"></div>
                  <span className="text-gray-600">Total: {performanceData.dailyPerformance.reduce((sum, day) => sum + day.interviews, 0)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Approved: {performanceData.dailyPerformance.reduce((sum, day) => sum + day.approved, 0)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Rejected: {performanceData.dailyPerformance.reduce((sum, day) => sum + day.rejected, 0)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Chart Container */}
          <div className="h-80 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#001D48] mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading performance data...</p>
                </div>
              </div>
            ) : prepareChartData() ? (
              <Line data={prepareChartData()} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No performance data available</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Complete some interviews to see your performance trends
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Chart Insights */}
          {performanceData?.dailyPerformance && performanceData.dailyPerformance.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#E6F0F8] rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="h-4 w-4 text-[#001D48]" />
                  <span className="text-sm font-medium text-blue-900">Best Day</span>
                </div>
                <p className="text-lg font-semibold text-blue-900">
                  {(() => {
                    const bestDay = performanceData.dailyPerformance.reduce((best, day) => 
                      day.interviews > best.interviews ? day : best
                    );
                    return `${bestDay.interviews} ${bestDay.interviews === 1 ? 'interview' : 'interviews'}`;
                  })()}
                </p>
                <p className="text-xs text-blue-700">
                  {new Date(performanceData.dailyPerformance.reduce((best, day) => 
                    day.interviews > best.interviews ? day : best
                  ).date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-[#373177]" />
                  <span className="text-sm font-medium text-purple-900">Average Daily</span>
                </div>
                <p className="text-lg font-semibold text-purple-900">
                  {(() => {
                    const avgInterviews = Math.round(performanceData.dailyPerformance.reduce((sum, day) => sum + day.interviews, 0) / performanceData.dailyPerformance.length);
                    return `${avgInterviews} ${avgInterviews === 1 ? 'interview' : 'interviews'}`;
                  })()}
                </p>
                <p className="text-xs text-purple-700">
                  Over {performanceData.dailyPerformance.length} days
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Overview Cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          </div>
        ) : hasNoData ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <BarChart3 className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Performance Data Available</h3>
            <p className="text-gray-600 text-center max-w-md">
              You haven't completed any interviews yet. Start conducting interviews to see your performance metrics here.
            </p>
            <button
              onClick={() => navigate('/interviewer/available-surveys')}
              className="mt-4 px-6 py-3 bg-[#001D48] text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              View Available Surveys
            </button>
          </div>
        ) : performanceData?.overview ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Total Interviews */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Interviews</p>
                  <p className="text-3xl font-bold text-gray-900">{performanceData.overview.totalInterviews}</p>
                </div>
                <div className="p-3 bg-[#E6F0F8] rounded-lg">
                  <Users className="h-6 w-6 text-[#001D48]" />
                </div>
              </div>
            </div>

            {/* Approval Rate */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approval Rate</p>
                  <p className="text-3xl font-bold text-green-600">{performanceData.overview.approvalRate}%</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No performance data available</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="text-center text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No performance data available</p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Metrics */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            </div>
          </div>
        ) : performanceData?.overview ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Interview Statistics */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-gray-700">Approved Interviews</span>
                  </div>
                  <span className="font-semibold text-green-600">{performanceData.overview.approvedInterviews}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <span className="text-gray-700">Rejected Interviews</span>
                  </div>
                  <span className="font-semibold text-red-600">{performanceData.overview.rejectedInterviews}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    </div>
                    <span className="text-gray-700">Pending Approval</span>
                  </div>
                  <span className="font-semibold text-yellow-600">{performanceData.overview.pendingInterviews}</span>
                </div>
              </div>
            </div>

            {/* Quality Metrics */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#E6F0F8] rounded-lg">
                      <Timer className="h-5 w-5 text-[#001D48]" />
                    </div>
                    <span className="text-gray-700">Avg. Completion Time</span>
                  </div>
                  <span className="font-semibold text-[#001D48]">
                    {formatDuration(performanceData.overview.averageCompletionTime)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[#E8E6F5] rounded-lg">
                      <Target className="h-5 w-5 text-[#373177]" />
                    </div>
                    <span className="text-gray-700">Avg. Completion %</span>
                  </div>
                  <span className="font-semibold text-[#373177]">
                    {Math.round(performanceData.overview.averageCompletionPercentage || 0)}%
                  </span>
                </div>
                
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No interview statistics available</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="text-center text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No quality metrics available</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Interviews */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            </div>
          </div>
        ) : interviewHistory?.interviews ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Interviews</h3>
                <button 
                  onClick={() => navigate('/interviewer/my-interviews')}
                  className="text-[#001D48] hover:text-[#373177] text-sm font-medium transition-colors duration-200"
                >
                  View All
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Survey</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Completion</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviewHistory.interviews.map((interview, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{interview.survey?.surveyName || 'Unknown Survey'}</p>
                            <p className="text-sm text-gray-500">{interview.survey?.category || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                            {getStatusIcon(interview.status)}
                            <span>{interview.status.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {formatDuration(interview.totalTimeSpent)}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {interview.completionPercentage}%
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {formatDate(interview.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No recent interviews available</p>
                <p className="text-sm text-gray-400 mt-1">Complete some interviews to see your recent activity</p>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default PerformanceMonitoring;
