// Google Maps API utility for managing script loading
// Note: You may see "net::ERR_BLOCKED_BY_CLIENT" errors in console for gen_204 requests.
// These are Google's analytics/tracking requests being blocked by browser extensions (ad blockers, etc.)
// and do NOT affect the functionality of Google Places autocomplete - they can be safely ignored.
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB4F9liX4qhB8-lAsNSbaNadZ8dsxjE2Ao';

interface GoogleMapsLoader {
  isLoaded: boolean;
  isLoading: boolean;
  loadPromise: Promise<void> | null;
}

const googleMapsLoader: GoogleMapsLoader = {
  isLoaded: false,
  isLoading: false,
  loadPromise: null
};

export function loadGoogleMapsAPI(): Promise<void> {
  // If already loaded, return resolved promise
  if (googleMapsLoader.isLoaded && window.google?.maps?.places?.Autocomplete) {
    return Promise.resolve();
  }

  // If currently loading, return the existing promise
  if (googleMapsLoader.isLoading && googleMapsLoader.loadPromise) {
    return googleMapsLoader.loadPromise;
  }

  // Start loading
  googleMapsLoader.isLoading = true;
  googleMapsLoader.loadPromise = new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector(
      `script[src*="maps.googleapis.com/maps/api/js"]`
    );
    
    if (existingScript) {
      // Script exists, wait for it to load
      const checkLoaded = () => {
        if (window.google?.maps?.places?.Autocomplete) {
          googleMapsLoader.isLoaded = true;
          googleMapsLoader.isLoading = false;
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Wait for Places library to be fully loaded
      const checkPlacesLoaded = () => {
        if (window.google?.maps?.places?.Autocomplete) {
          googleMapsLoader.isLoaded = true;
          googleMapsLoader.isLoading = false;
          resolve();
        } else {
          setTimeout(checkPlacesLoaded, 50);
        }
      };
      checkPlacesLoaded();
    };
    
    script.onerror = (error) => {
      googleMapsLoader.isLoading = false;
      googleMapsLoader.loadPromise = null;
      console.error('Failed to load Google Maps API:', error);
      reject(error);
    };
    
    document.head.appendChild(script);
  });

  return googleMapsLoader.loadPromise;
}

export function isGoogleMapsLoaded(): boolean {
  return googleMapsLoader.isLoaded && 
         !!window.google?.maps?.places?.Autocomplete;
}