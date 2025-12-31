import React, { useState, useEffect } from 'react';
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
  Star,
  Activity,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  X
} from 'lucide-react';
import { performanceAPI, surveyResponseAPI, surveyAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ResponseDetailsModal from './ResponseDetailsModal';
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

const QualityAgentPerformanceMonitoring = () => {
  const { showError } = useToast();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNoData, setHasNoData] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [reviewsHistory, setReviewsHistory] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    timeRange: '30d',
    surveyId: '',
    startDate: '',
    endDate: ''
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const reviewsLimit = 20;

  // Response details modal state
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [fullSurveyData, setFullSurveyData] = useState(null);
  const [loadingResponse, setLoadingResponse] = useState(false);

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

      const [analyticsResponse, reviewsResponse] = await Promise.all([
        performanceAPI.getQualityAgentAnalytics(params),
        performanceAPI.getQualityAgentReviews({ page: reviewsPage, limit: reviewsLimit, ...params })
      ]);

      if (analyticsResponse.success) {
        setPerformanceData(analyticsResponse.data);
        setHasNoData(false);
      }
      
      if (reviewsResponse.success) {
        setReviewsHistory(reviewsResponse.data);
      }

    } catch (error) {
      console.error('Error fetching performance data:', error);
      
      // Set empty data instead of showing error
      setPerformanceData({
        overview: {
          totalReviewed: 0,
          totalApproved: 0,
          totalRejected: 0,
          totalPending: 0
        },
        dailyPerformance: [],
        surveyPerformance: [],
        recentReviews: []
      });
      setReviewsHistory({ reviews: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } });
      setHasNoData(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [filters, reviewsPage]);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setReviewsPage(1); // Reset to first page when filters change
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      timeRange: '30d',
      surveyId: '',
      startDate: '',
      endDate: ''
    });
    setReviewsPage(1);
  };

  // Fetch full response details
  const fetchFullResponseData = async (review) => {
    try {
      setLoadingResponse(true);
      
      // Use the review object as the response (it should have all the data we need)
      const fullResponse = review;
      
      // Use survey data from the review object (already populated by backend)
      // Quality agents don't have permission to fetch surveys directly
      let surveyData = null;
      if (review.survey) {
        // Survey is already populated in the review object
        surveyData = review.survey;
      }
      
      setSelectedResponse(fullResponse);
      setFullSurveyData(surveyData);
      setShowResponseDetails(true);
    } catch (error) {
      console.error('Error fetching response details:', error);
      showError('Failed to load response details. Please try again.');
    } finally {
      setLoadingResponse(false);
    }
  };

  // Prepare chart data for performance over time
  const prepareChartData = () => {
    if (!performanceData?.dailyPerformance || performanceData.dailyPerformance.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = performanceData.dailyPerformance.map(item => {
      const date = new Date(item.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Total Reviewed',
          data: performanceData.dailyPerformance.map(item => item.totalReviewed),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Approved',
          data: performanceData.dailyPerformance.map(item => item.approved),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Rejected',
          data: performanceData.dailyPerformance.map(item => item.rejected),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.timeRange !== '30d') count++;
    if (filters.surveyId) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    return count;
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Pending_Approval':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
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

  const overview = performanceData?.overview || {
    totalReviewed: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalPending: 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Monitoring</h1>
          <p className="text-gray-600">Track your review performance and analytics</p>
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
                <span className="px-2 py-1 bg-[#E6F0F8] text-[#373177] text-xs font-medium rounded-full">
                  {getActiveFilterCount()} active
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {getActiveFilterCount() > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear All
                </button>
              )}
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
                  {performanceData?.surveyPerformance?.map((survey) => (
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
        </div>
      </div>

      {/* Overview Stats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Reviewed */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reviewed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{overview.totalReviewed || 0}</p>
              </div>
              <div className="p-3 bg-[#E6F0F8] rounded-lg">
                <FileText className="h-6 w-6 text-[#373177]" />
              </div>
            </div>
          </div>

          {/* Total Approved */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Approved</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{overview.totalApproved || 0}</p>
                {overview.totalReviewed > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((overview.totalApproved / overview.totalReviewed) * 100)}% approval rate
                  </p>
                )}
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Rejected */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Rejected</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{overview.totalRejected || 0}</p>
                {overview.totalReviewed > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((overview.totalRejected / overview.totalReviewed) * 100)}% rejection rate
                  </p>
                )}
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Performance Over Time Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#E6F0F8] rounded-lg">
              <TrendingUp className="h-6 w-6 text-[#373177]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Performance Over Time</h3>
              <p className="text-sm text-gray-600">Daily review trends and approval rates</p>
            </div>
          </div>
          
          {/* Chart Legend Summary */}
          {performanceData?.dailyPerformance && performanceData.dailyPerformance.length > 0 && (
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-[#E6F0F8]0 rounded-full"></div>
                <span className="text-gray-600">Total: {performanceData.dailyPerformance.reduce((sum, day) => sum + day.totalReviewed, 0)}</span>
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
          ) : prepareChartData() && prepareChartData().labels.length > 0 ? (
            <Line data={prepareChartData()} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No performance data available</p>
                <p className="text-sm text-gray-400 mt-1">
                  Start reviewing responses to see your performance trends
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
                <Activity className="h-4 w-4 text-[#373177]" />
                <span className="text-sm font-medium text-blue-900">Best Day</span>
              </div>
              <p className="text-lg font-semibold text-blue-900">
                {(() => {
                  const bestDay = performanceData.dailyPerformance.reduce((best, day) => 
                    day.totalReviewed > best.totalReviewed ? day : best
                  );
                  return `${bestDay.totalReviewed} ${bestDay.totalReviewed === 1 ? 'review' : 'reviews'}`;
                })()}
              </p>
              <p className="text-xs text-blue-700">
                {new Date(performanceData.dailyPerformance.reduce((best, day) => 
                  day.totalReviewed > best.totalReviewed ? day : best
                ).date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>

            <div className="bg-[#E8E6F5] rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-4 w-4 text-[#373177]" />
                <span className="text-sm font-medium text-purple-900">Average Daily</span>
              </div>
              <p className="text-lg font-semibold text-purple-900">
                {(() => {
                  const avgReviews = Math.round(performanceData.dailyPerformance.reduce((sum, day) => sum + day.totalReviewed, 0) / performanceData.dailyPerformance.length);
                  return `${avgReviews} ${avgReviews === 1 ? 'review' : 'reviews'}`;
                })()}
              </p>
              <p className="text-xs text-purple-700">
                Over {performanceData.dailyPerformance.length} days
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Survey Performance */}
      {performanceData?.surveyPerformance && performanceData.surveyPerformance.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Survey</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Survey
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Reviewed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approved
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rejected
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approval Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {performanceData.surveyPerformance.map((survey) => (
                    <tr key={survey._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {survey.surveyName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {survey.totalReviewed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {survey.approved}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        {survey.rejected}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {survey.totalReviewed > 0
                          ? `${Math.round((survey.approved / survey.totalReviewed) * 100)}%`
                          : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reviewed Responses */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reviewed Responses</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-20"></div>
              ))}
            </div>
          ) : reviewsHistory?.reviews && reviewsHistory.reviews.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Response ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Survey
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Interviewer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reviewed At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reviewsHistory.reviews.map((review) => (
                      <tr key={review._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {review.responseId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {review.survey?.surveyName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {review.interviewer 
                            ? `${review.interviewer.firstName} ${review.interviewer.lastName}`
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
                            {review.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(review.verificationData?.reviewedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => fetchFullResponseData(review)}
                            disabled={loadingResponse}
                            className="text-[#373177] hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Eye className="h-4 w-4 inline mr-1" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {reviewsHistory.pagination && reviewsHistory.pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((reviewsPage - 1) * reviewsLimit) + 1} to{' '}
                    {Math.min(reviewsPage * reviewsLimit, reviewsHistory.pagination.totalItems)} of{' '}
                    {reviewsHistory.pagination.totalItems} results
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setReviewsPage(prev => Math.max(1, prev - 1))}
                      disabled={reviewsPage === 1}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setReviewsPage(prev => prev + 1)}
                      disabled={reviewsPage >= reviewsHistory.pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No reviews found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasNoData ? 'Start reviewing responses to see your performance data.' : 'No reviews match your current filters.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Response Details Modal */}
      {showResponseDetails && selectedResponse && (
        <ResponseDetailsModal
          response={selectedResponse}
          survey={fullSurveyData}
          onClose={() => {
            setShowResponseDetails(false);
            setSelectedResponse(null);
            setFullSurveyData(null);
          }}
          hideActions={true}
        />
      )}
    </div>
  );
};

export default QualityAgentPerformanceMonitoring;
