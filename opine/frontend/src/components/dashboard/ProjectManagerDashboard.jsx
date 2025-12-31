import React from 'react';
import { 
  ClipboardCheck, 
  BarChart3, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Target,
  Users,
  DollarSign,
  Award,
  Clock
} from 'lucide-react';

const ProjectManagerDashboard = () => {
  const stats = [
    {
      title: 'Active Surveys',
      value: '6',
      change: '+2',
      trend: 'up',
      icon: ClipboardCheck,
      color: 'blue'
    },
    {
      title: 'Completed Interviews',
      value: '892',
      change: '+23%',
      trend: 'up',
      icon: BarChart3,
      color: 'green'
    },
    {
      title: 'Pending Approvals',
      value: '45',
      change: '-12%',
      trend: 'down',
      icon: Target,
      color: 'orange'
    },
    {
      title: 'Team Performance',
      value: '94.2%',
      change: '+5%',
      trend: 'up',
      icon: Award,
      color: 'purple'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-blue-50 text-[#001D48]",
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Manager Dashboard</h1>
        <p className="text-gray-600">Manage surveys, monitor performance, and track project progress</p>
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
              { action: 'Survey published', survey: 'Consumer Behavior Study', time: '1 hour ago', type: 'success' },
              { action: 'Interview completed', interviewer: 'Rajesh Kumar', time: '2 hours ago', type: 'info' },
              { action: 'Quality review passed', survey: 'Brand Awareness Research', time: '3 hours ago', type: 'success' },
              { action: 'Deadline approaching', survey: 'Market Trends Analysis', time: '4 hours ago', type: 'warning' }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'success' ? 'bg-green-500' :
                  activity.type === 'info' ? 'bg-blue-500' :
                  activity.type === 'warning' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.survey || activity.interviewer} • {activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105">
              <ClipboardCheck className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Create Survey</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <Target className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Review Approvals</span>
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
        {/* Survey Progress */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Progress</h3>
          <div className="space-y-4">
            {[
              { name: 'Consumer Behavior Study', progress: 85, status: 'In Progress' },
              { name: 'Brand Awareness Research', progress: 100, status: 'Completed' },
              { name: 'Market Trends Analysis', progress: 60, status: 'In Progress' },
              { name: 'Product Feedback Survey', progress: 30, status: 'In Progress' }
            ].map((survey, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">{survey.name}</span>
                  <span className="text-xs text-gray-500">{survey.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      survey.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${survey.progress}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500">{survey.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team Performance */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
          <div className="space-y-3">
            {[
              { name: 'Rajesh Kumar', interviews: 45, quality: '4.9' },
              { name: 'Priya Sharma', interviews: 38, quality: '4.8' },
              { name: 'Amit Singh', interviews: 32, quality: '4.7' },
              { name: 'Sneha Patel', interviews: 28, quality: '4.6' }
            ].map((member, index) => (
              <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.interviews} interviews</p>
                </div>
                <span className="text-sm font-medium text-[#001D48]">★ {member.quality}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
          <div className="space-y-3">
            {[
              { message: 'New survey approval required', time: '5 min ago', type: 'warning' },
              { message: 'Quality review completed', time: '1 hour ago', type: 'success' },
              { message: 'Interview deadline approaching', time: '2 hours ago', type: 'warning' },
              { message: 'Performance report generated', time: '3 hours ago', type: 'info' }
            ].map((notification, index) => (
              <div key={index} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  notification.type === 'success' ? 'bg-green-500' :
                  notification.type === 'warning' ? 'bg-yellow-500' :
                  notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
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
    </>
  );
};

export default ProjectManagerDashboard;











