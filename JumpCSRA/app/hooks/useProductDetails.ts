import { useMemo } from 'react';

export function useProductDetails(selectedProduct: any, inflateables: any[]) {
  return useMemo(() => {
    if (!selectedProduct) return null;
    if (typeof selectedProduct === 'object') return selectedProduct;
    return (
      inflateables.find(
        (p: any) => (p.name || '').trim().toLowerCase() === selectedProduct.trim().toLowerCase()
      ) || null
    );
  }, [selectedProduct, inflateables]);
}
