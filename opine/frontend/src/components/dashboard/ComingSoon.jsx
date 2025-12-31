import React from 'react';
import { 
  Clock, 
  Rocket, 
  Zap, 
  Star,
  ArrowRight,
  CheckCircle,
  Sparkles
} from 'lucide-react';

const ComingSoon = ({ title, description, features = [], icon: Icon = Rocket }) => {
  const defaultFeatures = [
    "Advanced analytics and reporting",
    "Real-time data processing",
    "Enhanced user experience",
    "Mobile-optimized interface"
  ];

  const displayFeatures = features.length > 0 ? features : defaultFeatures;

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Coming Soon Content */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-xl p-8 shadow-sm border border-gray-100 mb-8">
        <div className="text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] rounded-full mb-8 shadow-2xl">
            <Icon className="h-12 w-12 text-white" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Clock className="w-4 h-4 mr-2" />
            Coming Soon
          </div>

          {/* Subtitle */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Feature in Development
          </h2>

          {/* Description */}
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Our development team is working hard to bring you this feature. We're committed to delivering the best possible experience.
          </p>

          {/* Features List */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#373177] mr-2" />
              What's Coming
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayFeatures.map((feature, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors duration-200">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Development Progress</span>
              <span className="text-sm font-medium text-[#373177]">75%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: '75%' }}></div>
            </div>
            <p className="text-xs text-gray-600 mt-2">Expected completion: Soon</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="group px-6 py-3 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center">
              <Star className="h-4 w-4 mr-2" />
              Get Notified
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
            </button>
            <button className="px-6 py-3 border-2 border-[#001D48] text-[#373177] font-medium rounded-lg hover:bg-[#001D48] hover:text-white transition-all duration-300 flex items-center justify-center">
              <Zap className="h-4 w-4 mr-2" />
              Learn More
            </button>
          </div>

        </div>
      </div>

      {/* Additional Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="bg-blue-100 p-3 rounded-full w-fit mb-4">
            <Rocket className="h-6 w-6 text-[#373177]" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Innovation</h3>
          <p className="text-gray-600 text-sm">Cutting-edge technology and modern design principles</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="bg-[#E8E6F5] p-3 rounded-full w-fit mb-4">
            <Zap className="h-6 w-6 text-[#373177]" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Performance</h3>
          <p className="text-gray-600 text-sm">Optimized for speed and seamless user experience</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="bg-green-100 p-3 rounded-full w-fit mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality</h3>
          <p className="text-gray-600 text-sm">Thoroughly tested and enterprise-ready features</p>
        </div>
      </div>
    </>
  );
};

export default ComingSoon;
