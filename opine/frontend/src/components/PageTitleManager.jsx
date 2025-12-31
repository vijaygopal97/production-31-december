import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

const PageTitleManager = () => {
  const location = useLocation();
  
  // Always call the hook, but pass the condition to it
  // Only manage titles for dashboard routes
  // Public pages handle their own SEO
  const isDashboardRoute = location.pathname.startsWith('/admin/') || 
                          location.pathname.startsWith('/company/') ||
                          location.pathname.startsWith('/project-manager/') ||
                          location.pathname.startsWith('/interviewer/') ||
                          location.pathname.startsWith('/quality-agent/') ||
                          location.pathname.startsWith('/data-analyst/') ||
                          location.pathname === '/dashboard';
  
  usePageTitle(isDashboardRoute);
  
  return null; // This component doesn't render anything
};

export default PageTitleManager;
