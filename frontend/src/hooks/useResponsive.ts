import React from 'react';

const MOBILE_BREAKPOINT = 768;
const COMPACT_BREAKPOINT = 1100;

const getWindowWidth = () => (
  typeof window === 'undefined'
    ? COMPACT_BREAKPOINT
    : window.innerWidth
);

export const useResponsive = () => {
  const [width, setWidth] = React.useState(getWindowWidth);

  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    width,
    isMobile: width < MOBILE_BREAKPOINT,
    isCompact: width < COMPACT_BREAKPOINT,
    isDesktop: width >= COMPACT_BREAKPOINT,
  };
};
