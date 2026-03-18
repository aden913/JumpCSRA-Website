/**
 * Global type declarations for the application
 */

declare global {
  interface Window {
    /**
     * Environment variables injected by the server
     * Available on the client-side via window.__ENV__
     */
    __ENV__: {
      FIREBASE_API_KEY: string;
      FIREBASE_AUTH_DOMAIN: string;
      FIREBASE_DATABASE_URL: string;
      FIREBASE_PROJECT_ID: string;
      FIREBASE_STORAGE_BUCKET: string;
      FIREBASE_MESSAGING_SENDER_ID: string;
      FIREBASE_APP_ID: string;
      EMAIL_API_KEY?: string;
      EMAIL_SERVICE_URL?: string;
      GOOGLE_MAPS_API_KEY?: string;
    };
  }
}

export {};
