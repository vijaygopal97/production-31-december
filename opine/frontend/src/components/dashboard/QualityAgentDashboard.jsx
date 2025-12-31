import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  BarChart3, 
  DollarSign,
  Award,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { performanceAPI, surveyResponseAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const QualityAgentDashboard = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    validationsToday: 0,
    totalReviewed: 0,
    approvalRate: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [qualityMetrics, setQualityMetrics] = useState({
    approvalRate: 0,
    validationsToday: 0,
    totalReviewed: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch pending approvals count
      const pendingResponse = await surveyResponseAPI.getPendingApprovals();
      const pendingCount = pendingResponse.success ? (pendingResponse.data?.total || 0) : 0;

      // Fetch today's performance (last 24 hours)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      const todayEnd = new Date().toISOString();

      const [analyticsResponse, reviewsResponse] = await Promise.all([
        performanceAPI.getQualityAgentAnalytics({ 
          timeRange: '7d',
          startDate: todayStart,
          endDate: todayEnd
        }),
        performanceAPI.getQualityAgentReviews({ 
          page: 1, 
          limit: 5,
          startDate: todayStart,
          endDate: todayEnd
        })
      ]);

      let validationsToday = 0;
      let totalReviewed = 0;
      let totalApproved = 0;
      let approvalRate = 0;

      if (analyticsResponse.success && analyticsResponse.data?.overview) {
        const overview = analyticsResponse.data.overview;
        validationsToday = overview.totalReviewed || 0;
        totalReviewed = overview.totalReviewed || 0;
        totalApproved = overview.totalApproved || 0;
        approvalRate = totalReviewed > 0 
          ? Math.round((totalApproved / totalReviewed) * 100) 
          : 0;
      }

      // Get all-time stats for quality score
      const allTimeResponse = await performanceAPI.getQualityAgentAnalytics({ timeRange: 'all' });
      let allTimeReviewed = 0;
      let allTimeApproved = 0;
      if (allTimeResponse.success && allTimeResponse.data?.overview) {
        allTimeReviewed = allTimeResponse.data.overview.totalReviewed || 0;
        allTimeApproved = allTimeResponse.data.overview.totalApproved || 0;
      }

      // Format recent activity from reviews
      const activities = [];
      if (reviewsResponse.success && reviewsResponse.data?.reviews) {
        reviewsResponse.data.reviews.forEach((review) => {
          const reviewedAt = review.verificationData?.reviewedAt 
            ? new Date(review.verificationData.reviewedAt)
            : null;
          
          if (reviewedAt) {
            const timeAgo = getTimeAgo(reviewedAt);
            const surveyName = review.survey?.surveyName || 'Unknown Survey';
            const action = review.status === 'Approved' 
              ? 'Interview approved' 
              : review.status === 'Rejected'
              ? 'Interview rejected'
              : 'Review completed';
            
            activities.push({
              action,
              survey: surveyName,
              time: timeAgo,
              type: review.status === 'Approved' ? 'success' : review.status === 'Rejected' ? 'error' : 'info'
            });
          }
        });
      }

      setStats({
        pendingApprovals: pendingCount,
        validationsToday,
        totalReviewed: allTimeReviewed,
        approvalRate: allTimeReviewed > 0 
          ? Math.round((allTimeApproved / allTimeReviewed) * 100) 
          : 0
      });

      setQualityMetrics({
        approvalRate: allTimeReviewed > 0 
          ? Math.round((allTimeApproved / allTimeReviewed) * 100) 
          : 0,
        validationsToday,
        totalReviewed: allTimeReviewed
      });

      setRecentActivity(activities.slice(0, 4));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const statsCards = [
    {
      title: 'Pending Reviews',
      value: stats.pendingApprovals.toString(),
      change: null,
      trend: null,
      icon: ClipboardCheck,
      color: 'blue'
    },
    {
      title: 'Validations Today',
      value: stats.validationsToday.toString(),
      change: null,
      trend: null,
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: 'Total Reviewed',
      value: stats.totalReviewed.toString(),
      change: null,
      trend: null,
      icon: BarChart3,
      color: 'purple'
    },
    {
      title: 'Approval Rate',
      value: `${stats.approvalRate}%`,
      change: null,
      trend: null,
      icon: Award,
      color: 'orange'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-[#E6F0F8] text-[#373177]",
      purple: "bg-[#E8E6F5] text-[#373177]",
      green: "bg-green-50 text-green-600",
      orange: "bg-orange-50 text-orange-600"
    };
    return colors[color] || colors.blue;
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Quality Agent Dashboard</h1>
        <p className="text-gray-600">Review interviews, ensure quality, and track your validation performance</p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${getColorClasses(stat.color)}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'error' ? 'bg-red-500' :
                    activity.type === 'info' ? 'bg-[#E6F0F8]0' :
                    activity.type === 'warning' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.survey} • {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No recent activity</p>
              <p className="text-xs text-gray-400 mt-1">Start reviewing responses to see activity here</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => navigate('/quality-agent/survey-approvals')}
              className="p-4 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
            >
              <ClipboardCheck className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Review Surveys</span>
            </button>
            <button 
              onClick={() => navigate('/quality-agent/performance')}
              className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
            >
              <BarChart3 className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Performance</span>
            </button>
            <button 
              onClick={() => navigate('/quality-agent/validation-history')}
              className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
            >
              <CheckCircle className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">History</span>
            </button>
            <button 
              onClick={() => navigate('/quality-agent/payments-history')}
              className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
            >
              <DollarSign className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Payments</span>
            </button>
          </div>
        </div>
      </div>

      {/* Additional Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Metrics */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-6 bg-gray-100 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Approval Rate</span>
                <span className="text-sm font-medium text-green-600">{qualityMetrics.approvalRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Validations Today</span>
                <span className="text-sm font-medium text-[#373177]">{qualityMetrics.validationsToday}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Reviewed</span>
                <span className="text-sm font-medium text-[#373177]">{qualityMetrics.totalReviewed}</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-6 bg-gray-100 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending Reviews</span>
                <span className="text-sm font-medium text-orange-600">{stats.pendingApprovals}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Today's Reviews</span>
                <span className="text-sm font-medium text-green-600">{stats.validationsToday}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overall Performance</span>
                <span className="text-sm font-medium text-[#373177]">{stats.approvalRate}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default QualityAgentDashboard;











