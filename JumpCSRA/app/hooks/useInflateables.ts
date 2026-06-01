import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { firebaseConfig } from '../components/FirebaseConfig';
import { initializeApp, getApps } from 'firebase/app';
import {
  isWebsiteCacheStale,
  normalizeTimestamp,
  preloadImageUrls,
  readWebsiteCache,
  writeWebsiteCache,
} from '../utils/websiteInformationCache';

function normalizeInflateables(value: unknown): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    return Object.values(value);
  }

  return [];
}

function collectInflateableImageUrls(inflateables: any[]): string[] {
  return inflateables.flatMap((item) => {
    const urls = [
      item?.img,
      item?.image,
      ...(Array.isArray(item?.detailImages) ? item.detailImages : []),
    ];

    return urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
  });
}

export function useInflateables() {
  const [inflateables, setInflateables] = useState<any[]>(() => {
    const cachedInflateables = readWebsiteCache<any[]>('inflateables');
    return cachedInflateables ?? [];
  });

  useEffect(() => {
    if (!getApps().length) {
      initializeApp(firebaseConfig);
    }

    const db = getDatabase();
    const inflateablesRef = ref(db, 'inflateables');
    const lastUpdateRef = ref(db, 'dashboardInformation/lastUpdate');

    const refreshInflateables = async (sourceLastUpdate: number) => {
      try {
        const snapshot = await get(inflateablesRef);
        const nextInflateables = normalizeInflateables(snapshot.val());
        setInflateables(nextInflateables);
        writeWebsiteCache('inflateables', nextInflateables, sourceLastUpdate);
        preloadImageUrls(collectInflateableImageUrls(nextInflateables));
      } catch (error) {
        console.error('Error refreshing inflateables cache:', error);
      }
    };

    const unsubscribe = onValue(lastUpdateRef, (snapshot) => {
      const sourceLastUpdate = normalizeTimestamp(snapshot.val());
      const cachedInflateables = readWebsiteCache<any[]>('inflateables');

      if (cachedInflateables && !isWebsiteCacheStale(sourceLastUpdate, 'inflateables')) {
        setInflateables(cachedInflateables);
        preloadImageUrls(collectInflateableImageUrls(cachedInflateables));
        return;
      }

      refreshInflateables(sourceLastUpdate);
    }, (error) => {
      console.error('Error checking website cache timestamp:', error);
      refreshInflateables(0);
    });

    return () => unsubscribe();
  }, []);

  return inflateables;
}
