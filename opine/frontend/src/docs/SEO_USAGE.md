# SEO Management System for Convergent

## Overview
This project includes a comprehensive SEO management system using React Helmet Async for dynamic meta tag management.

## Features
- ✅ Dynamic meta title and description per route
- ✅ Open Graph tags for social media sharing
- ✅ Twitter Card support
- ✅ Structured data (JSON-LD) for search engines
- ✅ Canonical URLs
- ✅ Robots meta tags
- ✅ Centralized SEO configuration

## Usage

### 1. Basic Usage with SEO Component
```jsx
import SEO from '../components/SEO';

const MyPage = () => {
  return (
    <>
      <SEO 
        title="Custom Page Title"
        description="Custom page description"
        keywords="custom, keywords, here"
        pathname="/custom-page"
      />
      <div>Your page content</div>
    </>
  );
};
```

### 2. Using the HOC (Higher-Order Component)
```jsx
import withSEO from '../components/withSEO';

const MyPage = () => {
  return <div>Your page content</div>;
};

export default withSEO(MyPage, {
  title: "Custom Page Title",
  description: "Custom page description",
  pathname: "/custom-page"
});
```

### 3. Using the SEOWrapper Component
```jsx
import { SEOWrapper } from '../components/withSEO';

const MyPage = () => {
  return (
    <SEOWrapper 
      title="Custom Page Title"
      description="Custom page description"
      pathname="/custom-page"
    >
      <div>Your page content</div>
    </SEOWrapper>
  );
};
```

### 4. Using the Custom Hook
```jsx
import { useSEO } from '../hooks/useSEO';

const MyPage = () => {
  const { seoConfig, setTitle, setDescription } = useSEO({
    title: "Custom Title",
    description: "Custom Description"
  });

  return (
    <>
      <SEO {...seoConfig} />
      <div>Your page content</div>
    </>
  );
};
```

## Configuration

### SEO Config File (`src/config/seo.js`)
- **Default settings**: Applied to all pages
- **Route-specific settings**: Override defaults for specific routes
- **Structured data**: Automatic generation for organization schema

### Adding New Routes
1. Add route configuration to `SEO_CONFIG.routes` in `src/config/seo.js`
2. Use the SEO component in your route component
3. Set the correct `pathname` prop

Example:
```javascript
// In src/config/seo.js
routes: {
  "/new-page": {
    title: "New Page - Convergent",
    description: "Description for the new page",
    keywords: "new, page, keywords",
    canonical: "https://opineindia.com/new-page"
  }
}
```

## Current Routes with SEO
- `/` - Homepage with comprehensive SEO
- `/about` - About page (configured, not implemented)
- `/contact` - Contact page (configured, not implemented)
- `/register` - Registration page (configured, not implemented)
- `/login` - Login page (configured, not implemented)

## Testing SEO
1. **Development**: Open browser dev tools → Elements tab → Check `<head>` section
2. **Production**: Use tools like:
   - Google Search Console
   - Facebook Sharing Debugger
   - Twitter Card Validator
   - Schema.org Validator

## SEO Best Practices Implemented
- ✅ Unique titles and descriptions per page
- ✅ Proper meta tag structure
- ✅ Open Graph for social sharing
- ✅ Twitter Cards
- ✅ Canonical URLs
- ✅ Structured data for search engines
- ✅ Mobile-friendly viewport
- ✅ Proper robots meta tags

## Future Enhancements
- Server-side rendering (SSR) for better SEO
- Dynamic meta tags based on content
- Image optimization for Open Graph
- Sitemap generation
- Robots.txt management
