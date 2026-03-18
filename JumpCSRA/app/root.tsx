import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useState } from "react";

import type { Route } from "./+types/root";
import EmailTestingDashboard from "./components/EmailTestingDashboard";
import CloudFunctionTestingDashboard from "./components/CloudFunctionTestingDashboard";
import "./app.css";

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
  const [testingMode, setTestingMode] = useState<'email' | 'cloudfunction' | 'none'>('none');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        {import.meta.env.DEV && (
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
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
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
