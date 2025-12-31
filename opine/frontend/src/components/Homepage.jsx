import React, { useState } from 'react';
import { ArrowRight, Shield, Globe, Users, Building2, BarChart3, Globe2, Zap, Building, ClipboardCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from './SEO';

const Homepage = () => {
  const [activeTab, setActiveTab] = useState('companies');

  const features = [
    {
      icon: Building2,
      title: "Multi-Tenant Architecture",
      description: "Complete data isolation for each company with independent operations and custom pricing models.",
      color: "blue"
    },
    {
      icon: Users,
      title: "Quality Interviewer Network",
      description: "Access to verified gig workers with built-in quality assurance and performance tracking.",
      color: "purple"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade data encryption, GDPR compliance, and international privacy protection standards.",
      color: "green"
    },
    {
      icon: BarChart3,
      title: "Real-Time Analytics",
      description: "Comprehensive dashboards with project tracking, interviewer performance, and data quality metrics.",
      color: "orange"
    },
    {
      icon: Globe2,
      title: "Global Operations",
      description: "Multi-country support with localized payment processing and regional compliance management.",
      color: "pink"
    },
    {
      icon: Zap,
      title: "Scalable Platform",
      description: "Handle thousands of concurrent interviews with automated workflow management and instant scaling.",
      color: "indigo"
    }
  ];

  const companySteps = [
    {
      icon: Building,
      title: "Register Your Company",
      description: "Create your company account with complete data isolation and custom branding options."
    },
    {
      icon: ClipboardCheck,
      title: "Create Survey Projects",
      description: "Set up your research projects with detailed requirements, quotas, and quality parameters."
    },
    {
      icon: Users,
      title: "Access Interviewer Network",
      description: "Connect with verified interviewers in your target regions with automated matching."
    },
    {
      icon: BarChart3,
      title: "Monitor & Analyze",
      description: "Track progress in real-time with comprehensive analytics and quality assurance reports."
    }
  ];

  const interviewerSteps = [
    {
      icon: Users,
      title: "Join Our Network",
      description: "Register as an interviewer and complete our verification and training process."
    },
    {
      icon: ClipboardCheck,
      title: "Browse Available Projects",
      description: "Find survey projects that match your skills, location, and availability preferences."
    },
    {
      icon: Building,
      title: "Conduct Interviews",
      description: "Complete field interviews using our mobile app with built-in quality controls."
    },
    {
      icon: BarChart3,
      title: "Get Paid",
      description: "Receive payments directly through our secure platform with transparent pricing."
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: "bg-[#E6F0F8] text-[#001D48] group-hover:bg-[#001D48] group-hover:text-white",
      purple: "bg-[#E8E6F5] text-[#373177] group-hover:bg-[#373177] group-hover:text-white",
      green: "bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white",
      orange: "bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white",
      pink: "bg-pink-100 text-pink-600 group-hover:bg-pink-600 group-hover:text-white",
      indigo: "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
    };
    return colors[color] || colors.blue;
  };

  const steps = activeTab === 'companies' ? companySteps : interviewerSteps;

  return (
    <>
      <SEO pathname="/" />
      <div className="homepage">
      {/* Hero Section */}
      <section id="home" className="relative bg-gradient-to-br from-[#E6F0F8] via-white to-[#E8E6F5] py-20 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-72 h-72 bg-[#3FADCC] rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#373177] rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-[#3FADCC] rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
        </div>

        <div className="relative w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-8">
              <Shield className="w-4 h-4 mr-2" />
              Enterprise-Grade Security & Privacy
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Connect Research Companies with
              <span className="block bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] bg-clip-text text-transparent">
                Professional Interviewers
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Convergent's multi-tenant platform enables market research companies worldwide to conduct high-quality field interviews through our network of verified gig workers, ensuring data security and privacy protection.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button className="group px-8 py-4 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-semibold rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center">
                Get Started as Company
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
              <button className="px-8 py-4 border-2 border-[#001D48] text-[#001D48] font-semibold rounded-lg hover:bg-[#001D48] hover:text-white transition-all duration-300">
                Join as Interviewer
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="flex flex-col items-center p-6 bg-white/70 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="bg-[#E6F0F8] p-3 rounded-full mb-4">
                  <Globe className="h-6 w-6 text-[#001D48]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Global Reach</h3>
                <p className="text-gray-600 text-center">Multi-country operations with localized support</p>
              </div>
              
              <div className="flex flex-col items-center p-6 bg-white/70 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="bg-[#E8E6F5] p-3 rounded-full mb-4">
                  <Shield className="h-6 w-6 text-[#373177]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Platform</h3>
                <p className="text-gray-600 text-center">Enterprise-grade data isolation and privacy</p>
              </div>
              
              <div className="flex flex-col items-center p-6 bg-white/70 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
                <div className="bg-green-100 p-3 rounded-full mb-4">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality Network</h3>
                <p className="text-gray-600 text-center">Verified interviewers and quality assurance</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC]">
                Market Research Excellence
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Our comprehensive platform provides everything you need to conduct professional field interviews 
              with complete security, quality assurance, and global scalability.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group p-8 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200"
                >
                  <div className={`inline-flex p-3 rounded-xl transition-all duration-300 ${getColorClasses(feature.color)} mb-6`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-gray-800 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Stats Section */}
          <div className="mt-20 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] rounded-2xl p-8 sm:p-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              <div className="text-white">
                <div className="text-3xl sm:text-4xl font-bold mb-2">50+</div>
                <div className="text-[#E6F0F8] font-medium">Research Companies</div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl font-bold mb-2">10K+</div>
                <div className="text-blue-100 font-medium">Active Interviewers</div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl font-bold mb-2">15+</div>
                <div className="text-blue-100 font-medium">Countries Served</div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl font-bold mb-2">99.9%</div>
                <div className="text-blue-100 font-medium">Uptime Guarantee</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How Convergent Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Our platform streamlines the entire survey process for both research companies and interviewers
            </p>

            {/* Tab Switcher */}
            <div className="inline-flex bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setActiveTab('companies')}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                  activeTab === 'companies'
                    ? 'bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                For Companies
              </button>
              <button
                onClick={() => setActiveTab('interviewers')}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                  activeTab === 'interviewers'
                    ? 'bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                For Interviewers
              </button>
            </div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative">
                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-12 left-full w-8 h-0.5 bg-gradient-to-r from-[#3FADCC] to-[#373177] transform translate-x-4"></div>
                  )}
                  
                  <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
                    {/* Step Number */}
                    <div className="flex items-center mb-4">
                      <div className="bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                        {index + 1}
                      </div>
                      <div className="bg-gray-100 p-2 rounded-lg">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Ready to Get Started?
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Join thousands of companies and interviewers already using Convergent to conduct high-quality market research.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/app" className="px-8 py-3 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-semibold rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                  Start Free Trial
                </Link>
                <button className="px-8 py-3 border-2 border-[#001D48] text-[#001D48] font-semibold rounded-lg hover:bg-[#001D48] hover:text-white transition-all duration-300">
                  Schedule Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
};

export default Homepage;