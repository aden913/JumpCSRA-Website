import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type { DeliveryDistanceResult } from "../utils/backendPlacesService";

async function calculateFallbackDeliveryDistance(destination: unknown, signal: AbortSignal) {
  if (!destination || typeof destination !== "object" ||
    !("lat" in destination) || !("lng" in destination)) return;

  const { lat, lng } = destination;
  if (typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
    typeof lng !== "number" || !Number.isFinite(lng) || Math.abs(lng) > 180) return;

  // 410 Carolina Springs Rd, North Augusta, SC 29841
  const origin = "-81.946718,33.488484";
  const routeUrl = `https://router.project-osrm.org/route/v1/driving/${origin};${lng},${lat}?overview=false`;
  const response = await fetch(routeUrl, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });
  if (!response.ok) return;

  const route = await response.json();
  const distanceMeters = route.routes?.[0]?.distance;
  if (route.code !== "Ok" || typeof distanceMeters !== "number" ||
    !Number.isFinite(distanceMeters) || distanceMeters < 0) return;

  const distanceMiles = distanceMeters * 0.000621371;
  const maxDeliveryMiles = 200;
  const withinDeliveryRange = distanceMiles <= maxDeliveryMiles;
  return Response.json({
    distanceMeters,
    distanceMiles,
    maxDeliveryMiles,
    withinDeliveryRange,
    deliveryCost: withinDeliveryRange ? Math.round(distanceMiles * 6) : 0,
    provider: "osrm",
  } satisfies DeliveryDistanceResult, { headers: { "Cache-Control": "no-store" } });
}

async function forwardPlacesRequest(request: Request, operation: string) {
  const baseUrl = process.env.PLACES_SERVICE_URL || "http://173.230.132.127:3001";
  const apiKey = process.env.PLACES_API_KEY;

  try {
    const upstream = new URL(`/api/places/${operation}`, baseUrl);
    upstream.search = new URL(request.url).search;

    const headers = new Headers();
    if (apiKey) headers.set("X-API-Key", apiKey);
    if (request.method === "POST") headers.set("Content-Type", "application/json");

    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.text() : undefined,
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "The address service is temporarily unavailable." }, { status: 502 });
  }
}

export function loader({ request, params }: LoaderFunctionArgs) {
  if (params.operation !== "autocomplete" && params.operation !== "details") {
    return new Response(null, { status: 404 });
  }
  return forwardPlacesRequest(request, params.operation);
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (params.operation !== "delivery-distance") {
    return new Response(null, { status: 404 });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  const fallbackRequest = request.clone();
  const response = await forwardPlacesRequest(request, params.operation);
  if (response.status < 500 || request.signal.aborted) return response;

  try {
    const payload = await fallbackRequest.json();
    return await calculateFallbackDeliveryDistance(payload?.destinationCoordinates, request.signal) ?? response;
  } catch {
    return response;
  }
}
