import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  BarChart3, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  ClipboardCheck,
  DollarSign,
  Target,
  Award,
  Plus
} from 'lucide-react';
import SurveyBuilder from './SurveyBuilder';

const CompanyAdminDashboard = () => {
  const [showSurveyBuilder, setShowSurveyBuilder] = useState(false);
  const stats = [
    {
      title: 'Team Members',
      value: '24',
      change: '+3',
      trend: 'up',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Active Surveys',
      value: '8',
      change: '+2',
      trend: 'up',
      icon: ClipboardCheck,
      color: 'green'
    },
    {
      title: 'Completed Interviews',
      value: '1,247',
      change: '+15%',
      trend: 'up',
      icon: BarChart3,
      color: 'purple'
    },
    {
      title: 'Monthly Spend',
      value: '₹45,600',
      change: '-8%',
      trend: 'down',
      icon: DollarSign,
      color: 'orange'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-[#E6F0F8] text-[#001D48]",
      purple: "bg-purple-50 text-[#373177]",
      green: "bg-green-50 text-green-600",
      orange: "bg-orange-50 text-orange-600"
    };
    return colors[color] || colors.blue;
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Dashboard</h1>
        <p className="text-gray-600">Manage your team, surveys, and company operations</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { action: 'New team member added', member: 'Sarah Johnson', time: '2 hours ago', type: 'success' },
              { action: 'Survey completed', survey: 'Consumer Preferences Study', time: '4 hours ago', type: 'info' },
              { action: 'Payment processed', amount: '₹12,500', time: '6 hours ago', type: 'success' },
              { action: 'Quality review pending', survey: 'Brand Awareness Research', time: '8 hours ago', type: 'warning' }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'success' ? 'bg-green-500' :
                  activity.type === 'info' ? 'bg-[#E6F0F8]0' :
                  activity.type === 'warning' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.member || activity.survey || activity.amount} • {activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 bg-gradient-to-r from-[#373177] to-[#373177] text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105">
              <Users className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Add Team Member</span>
            </button>
            <button 
              onClick={() => setShowSurveyBuilder(true)}
              className="p-4 bg-gradient-to-r from-green-600 to-[#373177] text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Create Survey</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <BarChart3 className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">View Reports</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <DollarSign className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Payment Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Additional Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Performance */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          <div className="space-y-3">
            {[
              { name: 'Rajesh Kumar', interviews: 45, rating: '4.9' },
              { name: 'Priya Sharma', interviews: 38, rating: '4.8' },
              { name: 'Amit Singh', interviews: 32, rating: '4.7' },
              { name: 'Sneha Patel', interviews: 28, rating: '4.6' }
            ].map((member, index) => (
              <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.interviews} interviews</p>
                </div>
                <span className="text-sm font-medium text-[#001D48]">★ {member.rating}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Survey Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">In Progress</span>
              <span className="text-sm font-medium text-[#001D48]">5</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completed</span>
              <span className="text-sm font-medium text-green-600">3</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Approval</span>
              <span className="text-sm font-medium text-yellow-600">2</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Draft</span>
              <span className="text-sm font-medium text-gray-600">1</span>
            </div>
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
          <div className="space-y-3">
            {[
              { message: 'New team member verification pending', time: '5 min ago', type: 'warning' },
              { message: 'Survey report generated', time: '1 hour ago', type: 'info' },
              { message: 'Payment processed successfully', time: '2 hours ago', type: 'success' },
              { message: 'Quality review completed', time: '3 hours ago', type: 'success' }
            ].map((notification, index) => (
              <div key={index} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  notification.type === 'success' ? 'bg-green-500' :
                  notification.type === 'warning' ? 'bg-yellow-500' :
                  notification.type === 'error' ? 'bg-red-500' : 'bg-[#E6F0F8]0'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{notification.message}</p>
                  <p className="text-xs text-gray-500">{notification.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Survey Builder Modal */}
      {showSurveyBuilder && (
        <SurveyBuilder
          onClose={() => setShowSurveyBuilder(false)}
          onSave={(surveyData) => {
            console.log('Survey saved:', surveyData);
            setShowSurveyBuilder(false);
            // Here you would typically save the survey to your backend
          }}
        />
      )}
    </>
  );
};

export default CompanyAdminDashboard;

