import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

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

export function action({ request, params }: ActionFunctionArgs) {
  if (params.operation !== "delivery-distance") {
    return new Response(null, { status: 404 });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  return forwardPlacesRequest(request, params.operation);
}
