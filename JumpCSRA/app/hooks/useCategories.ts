import { useMemo } from 'react';

export function useCategories(inflateables: any[]) {
  return useMemo(() => {
    const catSet = new Set<string>();
    inflateables.forEach((item: any) => {
      if (Array.isArray(item.category)) {
        item.category.forEach((cat: string) => catSet.add(cat));
      } else if (typeof item.category === 'string') {
        catSet.add(item.category);
      }
    });
    return ['All', ...Array.from(catSet)];
  }, [inflateables]);
}
