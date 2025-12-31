import React from 'react';
import { Helmet } from 'react-helmet-async';
import { getSEOConfig, generateStructuredData, getRobotsMeta } from '../config/seo';

const SEO = ({ 
  title, 
  description, 
  keywords, 
  canonical, 
  ogTitle, 
  ogDescription, 
  ogImage, 
  ogType = "website",
  twitterCard = "summary_large_image",
  twitterSite = "@Convergent",
  noIndex = false,
  customStructuredData = null,
  pathname = "/"
}) => {
  // Get base SEO config for the route
  const baseConfig = getSEOConfig(pathname);
  
  // Merge with provided props (props take precedence)
  const seoConfig = {
    title: title || baseConfig.title,
    description: description || baseConfig.description,
    keywords: keywords || baseConfig.keywords,
    canonical: canonical || baseConfig.canonical,
    ogTitle: ogTitle || baseConfig.ogTitle || title || baseConfig.title,
    ogDescription: ogDescription || baseConfig.ogDescription || description || baseConfig.description,
    ogImage: ogImage || baseConfig.ogImage,
    ogType: ogType || baseConfig.ogType,
    twitterCard: twitterCard || baseConfig.twitterCard,
    twitterSite: twitterSite || baseConfig.twitterSite,
    robots: noIndex ? "noindex, nofollow" : getRobotsMeta()
  };

  // Generate structured data
  const structuredData = customStructuredData || generateStructuredData(seoConfig);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seoConfig.title}</title>
      <meta name="description" content={seoConfig.description} />
      <meta name="keywords" content={seoConfig.keywords} />
      <meta name="author" content={baseConfig.author} />
      <meta name="robots" content={seoConfig.robots} />
      <link rel="canonical" href={seoConfig.canonical} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={seoConfig.ogTitle} />
      <meta property="og:description" content={seoConfig.ogDescription} />
      <meta property="og:image" content={seoConfig.ogImage} />
      <meta property="og:url" content={seoConfig.canonical} />
      <meta property="og:type" content={seoConfig.ogType} />
      <meta property="og:site_name" content="Convergent" />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content={seoConfig.twitterCard} />
      <meta name="twitter:site" content={seoConfig.twitterSite} />
      <meta name="twitter:title" content={seoConfig.ogTitle} />
      <meta name="twitter:description" content={seoConfig.ogDescription} />
      <meta name="twitter:image" content={seoConfig.ogImage} />
      
      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      <meta name="distribution" content="global" />
      <meta name="rating" content="general" />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

export default SEO;
