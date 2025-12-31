import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Page title mapping for dashboard routes only
// Public pages (/, /about, /contact, /register, /login, /forgot-password) 
// are handled by their individual SEO components
const pageTitles = {
  // Super Admin routes
  '/admin/dashboard': 'Dashboard - Super Admin | Convergent',
  '/admin/add-user': 'Add User - Super Admin | Convergent',
  '/admin/manage-users': 'User Management - Super Admin | Convergent',
  '/admin/manage-companies': 'Company Management - Super Admin | Convergent',
  '/admin/survey-templates': 'Survey Templates - Super Admin | Convergent',
  '/admin/reports': 'Reports & Analytics - Super Admin | Convergent',
  '/admin/settings': 'System Settings - Super Admin | Convergent',
  '/admin/profile': 'Profile Settings - Super Admin | Convergent',
  
  // Company Admin routes
  '/company/dashboard': 'Dashboard - Company Admin | Convergent',
  '/company/team-management': 'Team Management - Company Admin | Convergent',
  '/company/surveys': 'Surveys - Company Admin | Convergent',
  '/company/survey-approvals': 'Survey Approvals - Company Admin | Convergent',
  '/company/document-verification': 'Document Verification - Company Admin | Convergent',
  '/company/performance': 'Performance Monitoring - Company Admin | Convergent',
  '/company/payment-settings': 'Payment Settings - Company Admin | Convergent',
  '/company/account-settings': 'Account Settings - Company Admin | Convergent',
  '/company/profile': 'Profile Settings - Company Admin | Convergent',
  
  // Project Manager routes
  '/project-manager/dashboard': 'Dashboard - Project Manager | Convergent',
  '/project-manager/surveys': 'Survey Management - Project Manager | Convergent',
  '/project-manager/survey-approvals': 'Survey Approvals - Project Manager | Convergent',
  '/project-manager/performance': 'Performance Monitoring - Project Manager | Convergent',
  '/project-manager/payment-settings': 'Payment Settings - Project Manager | Convergent',
  '/project-manager/profile': 'Profile Settings - Project Manager | Convergent',
  
  // Interviewer routes
  '/interviewer/dashboard': 'Dashboard - Interviewer | Convergent',
  '/interviewer/available-surveys': 'Available Interviews - Interviewer | Convergent',
  '/interviewer/my-interviews': 'My Interviews - Interviewer | Convergent',
  '/interviewer/performance': 'Performance Monitoring - Interviewer | Convergent',
  '/interviewer/payments-history': 'Payments History - Interviewer | Convergent',
  '/interviewer/payment-settings': 'Payment Settings - Interviewer | Convergent',
  '/interviewer/profile': 'Profile Settings - Interviewer | Convergent',
  
  // Quality Agent routes
  '/quality-agent/dashboard': 'Dashboard - Quality Agent | Convergent',
  '/quality-agent/available-surveys': 'Available Interviews - Quality Agent | Convergent',
  '/quality-agent/validation-history': 'Validation History - Quality Agent | Convergent',
  '/quality-agent/performance': 'Performance Monitoring - Quality Agent | Convergent',
  '/quality-agent/payments-history': 'Payments History - Quality Agent | Convergent',
  '/quality-agent/payment-settings': 'Payment Settings - Quality Agent | Convergent',
  '/quality-agent/profile': 'Profile Settings - Quality Agent | Convergent',
  
  // Data Analyst routes
  '/data-analyst/dashboard': 'Dashboard - Data Analyst | Convergent',
  '/data-analyst/available-gigs': 'Available Gigs - Data Analyst | Convergent',
  '/data-analyst/my-work': 'My Work - Data Analyst | Convergent',
  '/data-analyst/performance': 'Performance Monitoring - Data Analyst | Convergent',
  '/data-analyst/payments-history': 'Payments History - Data Analyst | Convergent',
  '/data-analyst/payment-settings': 'Payment Settings - Data Analyst | Convergent',
  '/data-analyst/profile': 'Profile Settings - Data Analyst | Convergent',
  
  // Default dashboard
  '/dashboard': 'Dashboard | Convergent'
};

// Custom hook to manage page titles for dashboard routes only
export const usePageTitle = (shouldManageTitle = true) => {
  const location = useLocation();
  
  useEffect(() => {
    // Only apply titles for dashboard routes if shouldManageTitle is true
    // Public pages (/, /about, /contact, etc.) handle their own SEO
    if (shouldManageTitle) {
      const title = pageTitles[location.pathname];
      
      if (title) {
        // Force update the document title for dashboard routes
        document.title = title;
        
        // Also update any existing Helmet title if present
        const existingTitle = document.querySelector('title');
        if (existingTitle) {
          existingTitle.textContent = title;
        }
        
        // Force a re-render of the title element
        const titleElement = document.querySelector('title');
        if (titleElement) {
          titleElement.innerHTML = title;
        }
      }
    }
    // For public pages, let their SEO components handle the title
    
  }, [location.pathname, shouldManageTitle]);
  
  return shouldManageTitle ? (pageTitles[location.pathname] || null) : null;
};

export default usePageTitle;
