// This component is a wrapper around SurveyReportsPage for project managers
// The backend automatically filters responses by assigned interviewers
import { useEffect } from 'react';
import SurveyReportsPage from '../../pages/SurveyReportsPage';

const ProjectManagerSurveyReportsPage = () => {
  // Break out of DashboardLayout padding and ensure full width
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Break out of DashboardLayout padding (p-6 = 1.5rem) */
      .project-manager-reports-wrapper {
        position: relative;
        margin: -1.5rem -1.5rem -1.5rem -1.5rem !important;
        width: calc(100% + 3rem) !important;
        max-width: none !important;
        overflow-x: visible;
      }
      
      /* Ensure SurveyReportsPage uses full width */
      .project-manager-reports-wrapper .survey-reports-page {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      /* Break out of any parent container constraints */
      .project-manager-reports-wrapper .survey-reports-page * {
        max-width: none !important;
      }
      
      /* Ensure tables and content are responsive */
      .project-manager-reports-wrapper table {
        width: 100% !important;
        table-layout: auto !important;
      }
      
      /* Ensure responsive behavior on mobile */
      @media (max-width: 768px) {
        .project-manager-reports-wrapper {
          margin: -1rem -1rem -1rem -1rem !important;
          width: calc(100% + 2rem) !important;
        }
      }
      
      /* Prevent horizontal scroll on very small screens */
      @media (max-width: 640px) {
        .project-manager-reports-wrapper {
          overflow-x: auto;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  return (
    <div className="project-manager-reports-wrapper">
      <SurveyReportsPage />
    </div>
  );
};

export default ProjectManagerSurveyReportsPage;



