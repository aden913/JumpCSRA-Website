import { getDatabase, get, ref } from 'firebase/database';

const CACHE_PREFIX = 'jumpcsra:websiteInformation';
const LAST_CACHE_AT_KEY = `${CACHE_PREFIX}:lastCacheAt`;
const LAST_SOURCE_UPDATE_KEY = `${CACHE_PREFIX}:lastSourceUpdate`;

type CacheKey = 'inflateables' | 'promoCards';

function getCacheKey(key: CacheKey) {
  return `${CACHE_PREFIX}:${key}`;
}

function getCacheTimestampKey(key: CacheKey) {
  return `${getCacheKey(key)}:lastCacheAt`;
}

export function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value && typeof value === 'object') {
    const possibleTimestamp = value as {
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    };
    const seconds = possibleTimestamp.seconds ?? possibleTimestamp._seconds;
    const nanoseconds = possibleTimestamp.nanoseconds ?? possibleTimestamp._nanoseconds ?? 0;

    if (typeof seconds === 'number') {
      return seconds * 1000 + Math.floor(nanoseconds / 1000000);
    }
  }

  return 0;
}

export function readWebsiteCache<T>(key: CacheKey): T | null {
  if (typeof window === 'undefined') return null;

  const cached = localStorage.getItem(getCacheKey(key));
  if (!cached) return null;

  try {
    return JSON.parse(cached) as T;
  } catch (error) {
    console.warn(`Failed to read ${key} cache:`, error);
    localStorage.removeItem(getCacheKey(key));
    return null;
  }
}

export function writeWebsiteCache<T>(key: CacheKey, value: T, sourceLastUpdate: number) {
  if (typeof window === 'undefined') return;

  try {
    const cacheTime = Date.now().toString();
    localStorage.setItem(getCacheKey(key), JSON.stringify(value));
    localStorage.setItem(getCacheTimestampKey(key), cacheTime);
    localStorage.setItem(LAST_CACHE_AT_KEY, cacheTime);
    localStorage.setItem(LAST_SOURCE_UPDATE_KEY, sourceLastUpdate.toString());
  } catch (error) {
    console.warn(`Failed to write ${key} cache:`, error);
  }
}

export function getLastWebsiteCacheAt(key?: CacheKey): number {
  if (typeof window === 'undefined') return 0;
  if (key) {
    return normalizeTimestamp(localStorage.getItem(getCacheTimestampKey(key)));
  }

  return normalizeTimestamp(localStorage.getItem(LAST_CACHE_AT_KEY));
}

export function isWebsiteCacheStale(sourceLastUpdate: number, key?: CacheKey): boolean {
  if (!sourceLastUpdate) return false;
  return getLastWebsiteCacheAt(key) < sourceLastUpdate;
}

export async function getDashboardInformationLastUpdate(): Promise<number> {
  const db = getDatabase();
  const snapshot = await get(ref(db, 'dashboardInformation/lastUpdate'));
  return normalizeTimestamp(snapshot.val());
}

export function preloadImageUrls(urls: string[]) {
  if (typeof window === 'undefined') return;

  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  uniqueUrls.forEach((url) => {
    const image = new Image();
    image.src = url;
  });
}
