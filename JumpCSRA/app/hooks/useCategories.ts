import { useMemo } from 'react';

export function useCategories(inflateables: any[]) {
  return useMemo(() => {
    // Return explicit categories as requested
    return [
      'All',
      'Bounce Houses',
      'Slides',
      'Obstacle Courses',
      'Interactive Games',
      'Party Essentials'
    ];
  }, [inflateables]);
}
