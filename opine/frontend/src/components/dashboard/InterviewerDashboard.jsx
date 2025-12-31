import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  BarChart3, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Clock,
  Award,
  Target,
  Users,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { performanceAPI, surveyAPI } from '../../services/api';

const InterviewerDashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState({
    availableSurveys: 0,
    totalInterviews: 0,
    approvedInterviews: 0,
    rejectedInterviews: 0,
    approvalRate: 0,
    monthlyEarnings: 0,
    loading: true
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
    fetchRecentActivities();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true }));
      
      // Fetch performance data and available surveys in parallel
      const [performanceResponse, availableSurveysResponse] = await Promise.all([
        performanceAPI.getPerformanceAnalytics({ timeRange: '30d' }),
        surveyAPI.getAvailableSurveys()
      ]);

      const performanceData = performanceResponse.data.overview;
      const availableSurveys = availableSurveysResponse.data.surveys || [];

      setDashboardData({
        availableSurveys: availableSurveys.length,
        totalInterviews: performanceData.totalInterviews || 0,
        approvedInterviews: performanceData.approvedInterviews || 0,
        rejectedInterviews: performanceData.rejectedInterviews || 0,
        approvalRate: performanceData.approvalRate || 0,
        monthlyEarnings: performanceData.totalEarnings || 0,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardData(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchRecentActivities = async () => {
    try {
      setActivitiesLoading(true);
      
      // Fetch recent interviews and available surveys to create activity feed
      const [interviewsResponse, surveysResponse] = await Promise.all([
        performanceAPI.getInterviewHistory({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
        surveyAPI.getAvailableSurveys()
      ]);

      const recentInterviews = interviewsResponse.data.interviews || [];
      const availableSurveys = surveysResponse.data.surveys || [];
      
      // Create activity feed from recent data
      const activities = [];
      
      // Add recent interview completions
      recentInterviews.slice(0, 5).forEach(interview => {
        const timeAgo = getTimeAgo(interview.createdAt);
        let message = '';
        let type = 'info';
        
        if (interview.status === 'Approved') {
          message = `Response approved for "${interview.survey?.surveyName || 'Survey'}"`;
          type = 'success';
        } else if (interview.status === 'Rejected') {
          message = `Response rejected for "${interview.survey?.surveyName || 'Survey'}"`;
          type = 'error';
        } else if (interview.status === 'Pending_Approval') {
          message = `Response submitted for "${interview.survey?.surveyName || 'Survey'}"`;
          type = 'info';
        } else {
          message = `Response completed for "${interview.survey?.surveyName || 'Survey'}"`;
          type = 'info';
        }
        
        activities.push({
          message,
          time: timeAgo,
          type,
          timestamp: new Date(interview.createdAt)
        });
      });
      
      // Add new survey assignments (if any)
      availableSurveys.slice(0, 3).forEach(survey => {
        const timeAgo = getTimeAgo(survey.assignedAt || survey.createdAt);
        activities.push({
          message: `New interview assigned: "${survey.surveyName}"`,
          time: timeAgo,
          type: 'info',
          timestamp: new Date(survey.assignedAt || survey.createdAt)
        });
      });
      
      // Sort activities by timestamp (most recent first)
      activities.sort((a, b) => b.timestamp - a.timestamp);
      
      // Take only the 5 most recent activities
      setRecentActivities(activities.slice(0, 5));
      
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      // Fallback to static activities if API fails
      setRecentActivities([
        { message: 'Dashboard loaded successfully', time: 'Just now', type: 'success' },
        { message: 'Performance data updated', time: '1 min ago', type: 'info' }
      ]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Helper function to calculate time ago
  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''} ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} day${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInSeconds / 2592000)} month${Math.floor(diffInSeconds / 2592000) > 1 ? 's' : ''} ago`;
  };

  const stats = [
    {
      title: 'Available Interviews',
      value: dashboardData.loading ? '...' : dashboardData.availableSurveys.toString(),
      change: '',
      trend: 'neutral',
      icon: ClipboardCheck,
      color: 'blue'
    },
    {
      title: 'Total Responses',
      value: dashboardData.loading ? '...' : dashboardData.totalInterviews.toString(),
      change: '',
      trend: 'neutral',
      icon: BarChart3,
      color: 'green'
    },
    {
      title: 'Approval Rate',
      value: dashboardData.loading ? '...' : `${dashboardData.approvalRate.toFixed(1)}%`,
      change: '',
      trend: dashboardData.approvalRate >= 80 ? 'up' : dashboardData.approvalRate >= 60 ? 'neutral' : 'down',
      icon: CheckCircle,
      color: dashboardData.approvalRate >= 80 ? 'green' : dashboardData.approvalRate >= 60 ? 'blue' : 'red'
    },
    {
      title: 'This Month Earnings',
      value: dashboardData.loading ? '...' : `₹${dashboardData.monthlyEarnings.toLocaleString()}`,
      change: '',
      trend: 'neutral',
      icon: DollarSign,
      color: 'purple'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-[#E6F0F8] text-[#001D48]",
      purple: "bg-[#E8E6F5] text-[#373177]",
      green: "bg-green-50 text-green-600",
      red: "bg-red-50 text-red-600",
      orange: "bg-orange-50 text-orange-600"
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Interviewer Dashboard</h1>
        <p className="text-gray-600">Find surveys, track your interviews, and manage your earnings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === 'up' ? ArrowUp : ArrowDown;
          return (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${getColorClasses(stat.color)}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className={`flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded-full ${
                  stat.trend === 'up' 
                    ? 'text-green-700 bg-green-50' 
                    : 'text-red-700 bg-red-50'
                }`}>
                  <TrendIcon className="h-3 w-3" />
                  <span>{stat.change}</span>
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

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => navigate('/interviewer/available-surveys')}
              className="p-4 bg-gradient-to-r from-[#373177] to-[#373177] text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
            >
              <ClipboardCheck className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Browse Interviews</span>
            </button>
            <button 
              onClick={() => navigate('/interviewer/my-interviews')}
              className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
            >
              <BarChart3 className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">My Interviews</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <DollarSign className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Payment History</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <Award className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Performance</span>
            </button>
          </div>
        </div>
      </div>

      {/* Additional Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Interviews */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Interviews</h3>
          <div className="space-y-3">
            {dashboardData.loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#001D48] mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading available interviews...</p>
              </div>
            ) : dashboardData.availableSurveys === 0 ? (
              <div className="text-center py-8">
                <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No interviews available at the moment</p>
                <p className="text-xs text-gray-400 mt-1">Check back later for new opportunities</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-gray-900">{dashboardData.availableSurveys}</p>
                <p className="text-sm text-gray-600">Interview{dashboardData.availableSurveys !== 1 ? 's' : ''} Available</p>
                <button 
                  onClick={() => navigate('/interviewer/available-surveys')}
                  className="mt-3 px-4 py-2 bg-[#001D48] text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View All Interviews
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            {dashboardData.loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#001D48] mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading performance data...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Approval Rate</span>
                  <span className={`text-sm font-medium ${
                    dashboardData.approvalRate >= 80 ? 'text-green-600' : 
                    dashboardData.approvalRate >= 60 ? 'text-[#001D48]' : 'text-red-600'
                  }`}>
                    {dashboardData.approvalRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Responses</span>
                  <span className="text-sm font-medium text-[#001D48]">{dashboardData.totalInterviews}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Approved</span>
                  <span className="text-sm font-medium text-green-600">{dashboardData.approvedInterviews}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month Earnings</span>
                  <span className="text-sm font-medium text-[#373177]">₹{dashboardData.monthlyEarnings.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {activitiesLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#001D48] mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading recent activity...</p>
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">Your activity will appear here</p>
              </div>
            ) : (
              recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'warning' ? 'bg-yellow-500' :
                    activity.type === 'error' ? 'bg-red-500' : 'bg-[#E6F0F8]0'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewerDashboard;











