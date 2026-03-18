import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import { useState } from "react";

import type { Route } from "./+types/root";
import EmailTestingDashboard from "./components/EmailTestingDashboard";
import CloudFunctionTestingDashboard from "./components/CloudFunctionTestingDashboard";
import "./app.css";

// Loader to provide environment variables to the client
export async function loader() {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Only expose public environment variables to the client
  const publicEnv = {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '',
    EMAIL_API_KEY: process.env.EMAIL_API_KEY || process.env.VITE_EMAIL_API_KEY || '',
    EMAIL_SERVICE_URL: process.env.EMAIL_SERVICE_URL || process.env.VITE_EMAIL_SERVICE_URL || '',
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '',
  };

  return { isDev, env: publicEnv };
}

// Action handler to prevent POST errors
export async function action({ request }: Route.ActionArgs) {
  // This prevents "no action for route" errors
  // Individual routes should handle their own actions
  return new Response(null, { status: 405, statusText: "Method Not Allowed" });
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "apple-touch-icon-precomposed", href: "/apple-touch-icon-precomposed.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const [testingMode, setTestingMode] = useState<'email' | 'cloudfunction' | 'none'>('none');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Inject environment variables for client-side access */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(data.env)};`,
          }}
        />
      </head>
      <body>
        {children}
        {data.isDev && (
          <>
            {/* Testing Mode Toggle */}
            <div style={{
              position: 'fixed',
              top: '10px',
              right: '10px',
              zIndex: 1001,
              display: 'flex',
              gap: '5px'
            }}>
              <button
                onClick={() => setTestingMode(testingMode === 'email' ? 'none' : 'email')}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
                  backgroundColor: testingMode === 'email' ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                📧 Email Server
              </button>
              <button
                onClick={() => setTestingMode(testingMode === 'cloudfunction' ? 'none' : 'cloudfunction')}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
                  backgroundColor: testingMode === 'cloudfunction' ? '#007bff' : '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                🔥 Cloud Functions
              </button>
            </div>

            {/* Testing Dashboards */}
            {testingMode === 'email' && <EmailTestingDashboard />}
            {testingMode === 'cloudfunction' && <CloudFunctionTestingDashboard />}
          </>
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
  
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (isDev && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
