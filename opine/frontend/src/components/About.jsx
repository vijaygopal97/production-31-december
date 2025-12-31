import React from 'react';
import { Users, Target, Award, Globe, Heart, Shield, TrendingUp, CheckCircle } from 'lucide-react';
import SEO from './SEO';

const About = () => {
  const teamMembers = [
    {
      name: "Vijay Gopal",
      role: "Founder & CEO",
      description: "Visionary leader with 10+ years in market research and technology innovation.",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face"
    },
    {
      name: "Sarah Johnson",
      role: "CTO",
      description: "Technology expert specializing in scalable platform architecture and data security.",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face"
    },
    {
      name: "Rajesh Kumar",
      role: "Head of Operations",
      description: "Operations specialist with deep expertise in field research and quality assurance.",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face"
    }
  ];

  const values = [
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Data Security",
      description: "We prioritize the security and privacy of all research data with enterprise-grade protection."
    },
    {
      icon: <Heart className="h-8 w-8" />,
      title: "Quality First",
      description: "Every interview and data point is verified to ensure the highest quality research outcomes."
    },
    {
      icon: <Globe className="h-8 w-8" />,
      title: "Global Reach",
      description: "Connecting research companies with field interviewers across India and beyond."
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Innovation",
      description: "Continuously evolving our platform with cutting-edge technology and methodologies."
    }
  ];

  const milestones = [
    {
      year: "2024",
      title: "Convergent Founded",
      description: "Started with a vision to revolutionize market research in India"
    },
    {
      year: "2024",
      title: "Platform Launch",
      description: "Launched our multi-tenant platform connecting companies with field interviewers"
    },
    {
      year: "2024",
      title: "1000+ Interviews",
      description: "Successfully conducted over 1000 field interviews across multiple cities"
    },
    {
      year: "2024",
      title: "Enterprise Clients",
      description: "Partnered with leading market research companies and brands"
    }
  ];

  return (
    <>
      <SEO pathname="/about" />
      <div className="about-page">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-[#E6F0F8] via-white to-[#E8E6F5] py-20 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-72 h-72 bg-[#3FADCC] rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
            <div className="absolute top-0 right-0 w-72 h-72 bg-[#373177] rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
            <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-[#001D48] rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
          </div>

          <div className="relative w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <div className="text-center">
              {/* Badge */}
              <div className="inline-flex items-center px-4 py-2 bg-[#E6F0F8] text-[#001D48] rounded-full text-sm font-medium mb-8">
                <Users className="w-4 h-4 mr-2" />
                About Convergent
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Revolutionizing Market Research
                <span className="block bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] bg-clip-text text-transparent">
                  Through Technology
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
                We're building the future of market research by connecting companies with verified field interviewers, 
                ensuring data quality, security, and efficiency across India.
              </p>
            </div>
          </div>
        </section>

        {/* Mission & Vision Section */}
        <section className="py-20 bg-white">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Mission */}
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <Target className="w-4 h-4 mr-2" />
                  Our Mission
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
                  Empowering Research Excellence
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  To democratize access to high-quality market research by creating a seamless platform 
                  that connects research companies with professional field interviewers, ensuring data 
                  integrity and research excellence across India.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                    <p className="text-gray-700">Verified and trained field interviewers</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                    <p className="text-gray-700">Enterprise-grade data security</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-1 flex-shrink-0" />
                    <p className="text-gray-700">Real-time quality monitoring</p>
                  </div>
                </div>
              </div>

              {/* Vision */}
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 bg-[#E8E6F5] text-purple-800 rounded-full text-sm font-medium">
                  <Award className="w-4 h-4 mr-2" />
                  Our Vision
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
                  Leading India's Research Revolution
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  To become India's most trusted platform for market research, setting new standards 
                  for data quality, interviewer professionalism, and research innovation while 
                  empowering businesses to make data-driven decisions.
                </p>
                <div className="bg-gradient-to-r from-[#E6F0F8] to-[#E8E6F5] p-6 rounded-xl">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Our Impact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#001D48]">1000+</div>
                      <div className="text-sm text-gray-600">Interviews Conducted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[#373177]">50+</div>
                      <div className="text-sm text-gray-600">Cities Covered</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 bg-gray-50">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-4 py-2 bg-[#E6F0F8] text-[#001D48] rounded-full text-sm font-medium mb-6">
                <Heart className="w-4 h-4 mr-2" />
                Our Values
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                What Drives Us Forward
              </h2>
              <p className="text-xl text-gray-600 max-w-4xl mx-auto">
                Our core values guide every decision we make and every interaction we have with our clients and interviewers.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <div key={index} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="text-[#001D48] mb-4">
                    {value.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20 bg-white">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-6">
                <Users className="w-4 h-4 mr-2" />
                Our Team
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                Meet the Visionaries
              </h2>
              <p className="text-xl text-gray-600 max-w-4xl mx-auto">
                Our diverse team of experts is passionate about transforming the market research industry.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {teamMembers.map((member, index) => (
                <div key={index} className="text-center group">
                  <div className="relative mb-6">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-48 h-48 rounded-full mx-auto object-cover shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {member.name}
                  </h3>
                  <p className="text-[#001D48] font-medium mb-3">
                    {member.role}
                  </p>
                  <p className="text-gray-600 leading-relaxed">
                    {member.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="py-20 bg-gray-50">
          <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            <div className="text-center mb-16">
              <div className="inline-flex items-center px-4 py-2 bg-[#E8E6F5] text-purple-800 rounded-full text-sm font-medium mb-6">
                <TrendingUp className="w-4 h-4 mr-2" />
                Our Journey
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                Milestones & Achievements
              </h2>
              <p className="text-xl text-gray-600 max-w-4xl mx-auto">
                From our founding to becoming a trusted name in market research.
              </p>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-[#001D48] via-[#373177] to-[#3FADCC]"></div>

              <div className="space-y-12">
                {milestones.map((milestone, index) => (
                  <div key={index} className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                      <div className="bg-white p-6 rounded-xl shadow-lg">
                        <div className="text-2xl font-bold text-[#001D48] mb-2">
                          {milestone.year}
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {milestone.title}
                        </h3>
                        <p className="text-gray-600">
                          {milestone.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Timeline dot */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-[#001D48] rounded-full border-4 border-white shadow-lg"></div>
                    
                    <div className="w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Research?
            </h2>
            <p className="text-xl text-[#E6F0F8] mb-8 max-w-3xl mx-auto">
              Join hundreds of companies already using Convergent to conduct high-quality market research.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-4 bg-white text-[#001D48] font-semibold rounded-lg hover:bg-gray-100 transition-colors duration-300 shadow-lg">
                Get Started Today
              </button>
              <button className="px-8 py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-[#001D48] transition-all duration-300">
                Contact Our Team
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default About;
