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

async function placesRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/places${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
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

