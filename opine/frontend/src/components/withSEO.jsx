import React from 'react';
import SEO from './SEO';

// Higher-Order Component for automatic SEO management
const withSEO = (WrappedComponent, seoConfig = {}) => {
  return function SEOEnhancedComponent(props) {
    const { pathname = "/", ...seoProps } = seoConfig;
    
    return (
      <>
        <SEO pathname={pathname} {...seoProps} />
        <WrappedComponent {...props} />
      </>
    );
  };
};

// Alternative: Component wrapper for inline SEO
export const SEOWrapper = ({ children, pathname = "/", ...seoProps }) => {
  return (
    <>
      <SEO pathname={pathname} {...seoProps} />
      {children}
    </>
  );
};

export default withSEO;
