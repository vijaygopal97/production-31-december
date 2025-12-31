import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  BarChart3, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Settings
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const stats = [
    {
      title: 'Active Companies',
      value: '48',
      change: '+12%',
      trend: 'up',
      icon: Building2,
      color: 'blue'
    },
    {
      title: 'Active Interviewers',
      value: '1,847',
      change: '+8%',
      trend: 'up',
      icon: Users,
      color: 'purple'
    },
    {
      title: 'Completed Surveys',
      value: '23,891',
      change: '+23%',
      trend: 'up',
      icon: BarChart3,
      color: 'green'
    },
    {
      title: 'Response Rate',
      value: '94.2%',
      change: '-2%',
      trend: 'down',
      icon: TrendingUp,
      color: 'orange'
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
        <p className="text-gray-600">Monitor your platform's performance and key metrics</p>
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
              { action: 'New company registered', company: 'Market Research Inc.', time: '2 hours ago', type: 'success' },
              { action: 'Survey completed', company: 'Data Analytics Ltd.', time: '4 hours ago', type: 'info' },
              { action: 'Interviewer verification', company: 'Field Studies Co.', time: '6 hours ago', type: 'warning' },
              { action: 'Payment processed', company: 'Consumer Insights', time: '8 hours ago', type: 'success' }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'success' ? 'bg-green-500' :
                  activity.type === 'info' ? 'bg-blue-500' :
                  activity.type === 'warning' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.company} • {activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/admin/manage-companies" className="p-4 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105">
              <Building2 className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Manage Companies</span>
            </Link>
            <Link to="/admin/manage-users" className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <Users className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Manage Users</span>
            </Link>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <BarChart3 className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">View Reports</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <Settings className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Additional Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Health */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Database</span>
              <span className="text-sm font-medium text-green-600">Healthy</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">API Services</span>
              <span className="text-sm font-medium text-green-600">Operational</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Storage</span>
              <span className="text-sm font-medium text-yellow-600">75% Used</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Backup Status</span>
              <span className="text-sm font-medium text-green-600">Up to Date</span>
            </div>
          </div>
        </div>

        {/* Top Performing Companies */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Companies</h3>
          <div className="space-y-3">
            {[
              { name: 'Market Research Pro', surveys: 156, rating: '4.9' },
              { name: 'Data Insights Co.', surveys: 134, rating: '4.8' },
              { name: 'Field Analytics Ltd.', surveys: 98, rating: '4.7' },
              { name: 'Consumer Studies Inc.', surveys: 87, rating: '4.6' }
            ].map((company, index) => (
              <div key={index} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{company.name}</p>
                  <p className="text-xs text-gray-500">{company.surveys} surveys</p>
                </div>
                <span className="text-sm font-medium text-[#001D48]">★ {company.rating}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
          <div className="space-y-3">
            {[
              { message: 'New company verification pending', time: '5 min ago', type: 'warning' },
              { message: 'Monthly report generated', time: '1 hour ago', type: 'info' },
              { message: 'System backup completed', time: '2 hours ago', type: 'success' },
              { message: 'High server load detected', time: '3 hours ago', type: 'error' }
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

export default SuperAdminDashboard;
