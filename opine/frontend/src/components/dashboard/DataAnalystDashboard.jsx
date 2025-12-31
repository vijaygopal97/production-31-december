import React from 'react';
import { 
  BarChart3, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Clock,
  Award,
  Target,
  FileText,
  Brain
} from 'lucide-react';

const DataAnalystDashboard = () => {
  const stats = [
    {
      title: 'Available Gigs',
      value: '6',
      change: '+2',
      trend: 'up',
      icon: FileText,
      color: 'blue'
    },
    {
      title: 'My Work',
      value: '12',
      change: '+3',
      trend: 'up',
      icon: BarChart3,
      color: 'green'
    },
    {
      title: 'This Month Earnings',
      value: '₹15,200',
      change: '+25%',
      trend: 'up',
      icon: DollarSign,
      color: 'purple'
    },
    {
      title: 'Analysis Score',
      value: '98.5%',
      change: '+3%',
      trend: 'up',
      icon: Award,
      color: 'orange'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-[#E6F0F8] text-[#373177]",
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Analyst Dashboard</h1>
        <p className="text-gray-600">Analyze survey data, create insights, and deliver professional reports</p>
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
              { action: 'Analysis completed', project: 'Consumer Behavior Study', time: '2 hours ago', type: 'success' },
              { action: 'Report delivered', project: 'Brand Awareness Research', time: '4 hours ago', type: 'success' },
              { action: 'Payment received', amount: '₹2,500', time: '6 hours ago', type: 'success' },
              { action: 'New gig available', project: 'Market Trends Analysis', time: '8 hours ago', type: 'info' }
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'success' ? 'bg-green-500' :
                  activity.type === 'info' ? 'bg-[#E6F0F8]0' :
                  activity.type === 'warning' ? 'bg-yellow-500' : 'bg-gray-500'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.project || activity.amount} • {activity.time}</p>
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
              <FileText className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Browse Gigs</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <BarChart3 className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">My Work</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <Brain className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Performance</span>
            </button>
            <button className="p-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300">
              <DollarSign className="h-6 w-6 mx-auto mb-2" />
              <span className="text-sm font-medium">Payments</span>
            </button>
          </div>
        </div>
      </div>

      {/* Additional Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Gigs */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Gigs</h3>
          <div className="space-y-3">
            {[
              { name: 'Consumer Behavior Analysis', payment: '₹3,500', deadline: '3 days', complexity: 'High' },
              { name: 'Brand Awareness Report', payment: '₹2,200', deadline: '2 days', complexity: 'Medium' },
              { name: 'Market Trends Analysis', payment: '₹4,000', deadline: '5 days', complexity: 'High' },
              { name: 'Product Feedback Insights', payment: '₹1,800', deadline: '1 day', complexity: 'Low' }
            ].map((gig, index) => (
              <div key={index} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-medium text-gray-900">{gig.name}</h4>
                  <span className="text-sm font-bold text-green-600">{gig.payment}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>⏰ {gig.deadline}</span>
                  <span className={`px-2 py-1 rounded-full ${
                    gig.complexity === 'High' ? 'bg-red-100 text-red-600' :
                    gig.complexity === 'Medium' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {gig.complexity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Analysis Accuracy</span>
              <span className="text-sm font-medium text-green-600">98.5%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Delivery Time</span>
              <span className="text-sm font-medium text-[#373177]">2.3 days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Client Satisfaction</span>
              <span className="text-sm font-medium text-[#373177]">4.9/5</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Earnings</span>
              <span className="text-sm font-medium text-green-600">₹15,200</span>
            </div>
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
          <div className="space-y-3">
            {[
              { message: 'New analysis gig available', time: '5 min ago', type: 'info' },
              { message: 'Report approved by client', time: '1 hour ago', type: 'success' },
              { message: 'Payment processed successfully', time: '2 hours ago', type: 'success' },
              { message: 'Performance bonus earned', time: '3 hours ago', type: 'success' }
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
    </>
  );
};

export default DataAnalystDashboard;











