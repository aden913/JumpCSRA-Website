export type BackendPlacePrediction = {
  description: string;
  placeId: string;
  structuredFormatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

export type BackendPlaceDetails = {
  formatted_address: string;
  address_components?: google.maps.GeocoderAddressComponent[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  } | null;
  place_id: string;
};

export type DeliveryDistanceResult = {
  distanceMeters: number;
  distanceMiles: number;
  deliveryCost: number;
  maxDeliveryMiles: number;
  withinDeliveryRange: boolean;
  provider: string;
};

type Coordinates = {
  lat: number;
  lng: number;
};

const normalizeBaseUrl = (url: string) => url
  .replace(/\/api\/(?:email|places)\/?\*?$/i, '')
  .replace(/\/+$/, '');

function getBaseURL(): string {
  if (typeof window !== 'undefined' && (window as any).ENV?.PLACES_SERVICE_URL) {
    return normalizeBaseUrl((window as any).ENV.PLACES_SERVICE_URL);
  }

  if (typeof window !== 'undefined' && (window as any).ENV?.EMAIL_SERVICE_URL) {
    return normalizeBaseUrl((window as any).ENV.EMAIL_SERVICE_URL);
  }

  return normalizeBaseUrl(
    import.meta.env.VITE_PLACES_SERVICE_URL ||
    import.meta.env.VITE_EMAIL_SERVICE_URL ||
    'http://173.230.132.127:3001'
  );
}

function getApiKey(): string {
  if (typeof window !== 'undefined' && (window as any).ENV?.PLACES_API_KEY) {
    return (window as any).ENV.PLACES_API_KEY;
  }

  if (typeof window !== 'undefined' && (window as any).ENV?.EMAIL_API_KEY) {
    return (window as any).ENV.EMAIL_API_KEY;
  }

  return import.meta.env.VITE_PLACES_API_KEY ||
    import.meta.env.VITE_EMAIL_API_KEY ||
    'jumpcsra_secure_api_key_2024';
}

async function placesRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBaseURL()}/api/places${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getApiKey(),
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Places request failed with status ${response.status}`);
  }

  return data;
}

export async function fetchPlacePredictions(
  input: string,
  sessionToken: string
): Promise<BackendPlacePrediction[]> {
  const params = new URLSearchParams({ input, sessionToken });
  const data = await placesRequest<{ predictions: BackendPlacePrediction[] }>(`/autocomplete?${params}`);
  return data.predictions || [];
}

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<BackendPlaceDetails> {
  const params = new URLSearchParams({ placeId, sessionToken });
  const data = await placesRequest<{ place: BackendPlaceDetails }>(`/details?${params}`);
  return data.place;
}

export async function fetchDeliveryDistance(
  destinationAddress: string,
  destinationCoordinates: Coordinates
): Promise<DeliveryDistanceResult> {
  return placesRequest<DeliveryDistanceResult>('/delivery-distance', {
    method: 'POST',
    body: JSON.stringify({
      destinationAddress,
      destinationCoordinates,
    }),
  });
}

