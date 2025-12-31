import { useLocation } from 'react-router-dom';
import { getSEOConfig } from '../config/seo';

// Custom hook for SEO management
export const useSEO = (customConfig = {}) => {
  const location = useLocation();
  const pathname = location.pathname;
  
  // Get base SEO config for the current route
  const baseConfig = getSEOConfig(pathname);
  
  // Merge with custom config (custom takes precedence)
  const seoConfig = {
    ...baseConfig,
    ...customConfig,
    // Ensure canonical URL is always set correctly
    canonical: customConfig.canonical || baseConfig.canonical
  };
  
  return {
    seoConfig,
    pathname,
    // Helper function to update page title
    setTitle: (title) => ({ ...seoConfig, title }),
    // Helper function to update description
    setDescription: (description) => ({ ...seoConfig, description }),
    // Helper function to update keywords
    setKeywords: (keywords) => ({ ...seoConfig, keywords })
  };
};

export default useSEO;
