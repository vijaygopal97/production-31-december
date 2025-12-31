import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  X, 
  User, 
  ChevronDown, 
  LogOut, 
  Settings,
  Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const DashboardHeader = ({ sidebarOpen, setSidebarOpen, user }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { logout } = useAuth();
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsOpen]);

  // Function to convert user type to proper display format
  const getUserTypeDisplay = (userType) => {
    const typeMap = {
      'super_admin': 'Super Admin',
      'company_admin': 'Company Admin',
      'project_manager': 'Project Manager',
      'interviewer': 'Interviewer',
      'quality_agent': 'Quality Agent',
      'Data_Analyst': 'Data Analyst'
    };
    return typeMap[userType] || 'Dashboard';
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left Section - Menu Toggle & Logo */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <a href="/" className="flex flex-col items-center hover:opacity-80 transition-opacity duration-200">
            <img 
              src="/logo.png" 
              alt="Convergent Logo" 
              className="h-10 w-auto"
            />
            <p className="text-xs text-gray-500 mt-1">{getUserTypeDisplay(user?.userType)} Dashboard</p>
          </a>
        </div>

        {/* Center Section - Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          <a 
            href="/" 
            className="flex items-center px-4 py-2 text-sm font-medium text-[#001D48] bg-[#E6F0F8] rounded-lg hover:bg-[#D0E1F0] transition-colors duration-200"
          >
            <User className="h-4 w-4 mr-2" />
            Home
          </a>
        </nav>

        {/* Right Section - Settings Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Settings Dropdown */}
          {settingsOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 break-words leading-relaxed mt-1">
                  {user?.email}
                </p>
                <p className="text-xs text-[#001D48] font-medium capitalize mt-1">
                  {user?.userType?.replace('_', ' ')}
                </p>
              </div>
              
              <a 
                href={user?.userType === 'interviewer' ? '/interviewer/profile' : '/profile'} 
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                <User className="h-4 w-4 mr-3" />
                Profile
              </a>
              
              <a 
                href={user?.userType === 'interviewer' ? '/interviewer/profile' : '/settings'} 
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                <Settings className="h-4 w-4 mr-3" />
                Settings
              </a>
              
              <div className="border-t border-gray-100 my-1"></div>
              
              <button 
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <LogOut className="h-4 w-4 mr-3" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
