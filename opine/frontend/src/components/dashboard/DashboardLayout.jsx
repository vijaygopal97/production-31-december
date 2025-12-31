import React, { useState, useEffect } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import DashboardFooter from './DashboardFooter';
import { useAuth } from '../../contexts/AuthContext';

const DashboardLayout = ({ children, user }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isAuthenticated } = useAuth();

  // Check if user is authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = '/login';
      return;
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <DashboardHeader 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
        user={user}
      />

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <DashboardSidebar 
          sidebarOpen={sidebarOpen} 
          userType={user?.userType}
        />

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 min-h-full min-w-0`} style={{ marginLeft: sidebarOpen ? '16rem' : '0', width: sidebarOpen ? 'calc(100vw - 16rem)' : '100vw' }}>
          <div className="p-6 min-h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <DashboardFooter sidebarOpen={sidebarOpen} />

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default DashboardLayout;
