import React from 'react';

const DashboardFooter = ({ sidebarOpen }) => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 mt-auto transition-all duration-300" style={{ marginLeft: sidebarOpen ? '16rem' : '0', width: sidebarOpen ? 'calc(100vw - 16rem)' : '100vw' }}>
      <div className="px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-4">
            <p className="text-sm text-gray-600">
              © 2025 Convergent. All rights reserved.
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-2 md:mt-0">
            <span className="text-xs text-gray-500">Version 2.1.4</span>
            <span className="text-xs text-green-600 flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              System Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default DashboardFooter;
