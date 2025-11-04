/**
 * React Scan Setup - Track unnecessary re-renders
 * 
 * To enable: Set REACT_SCAN_ENABLED=true in .env.local
 * Check browser console for re-render warnings
 */

import React from 'react';

if (process.env.NODE_ENV === 'development' && process.env.REACT_SCAN_ENABLED === 'true') {
  // Dynamic import to avoid bundling in production
  import('@welldone-software/why-did-you-render')
    .then((whyDidYouRender) => {
      whyDidYouRender.default(React, {
        trackAllPureComponents: true,
        trackExtraHooks: [require('@tanstack/react-query').useQuery],
      });
      console.log('🔍 React Scan enabled - Check console for re-render warnings');
    })
    .catch(() => {
      console.warn('React Scan not available - install @welldone-software/why-did-you-render');
    });
}

export {};
