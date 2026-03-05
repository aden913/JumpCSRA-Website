import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  console.log('🔧 Vite Config - Build Mode:', mode);
  console.log('🔧 Vite Config - NODE_ENV:', process.env.NODE_ENV);
  
  // Log which Firebase env vars are available at build time
  const firebaseVars = Object.keys(process.env).filter(k => k.includes('FIREBASE'));
  console.log('🔧 Available FIREBASE env vars at build time:', firebaseVars.length > 0 ? firebaseVars : 'NONE');
  
  return {
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    
    // Dev server configuration for Cloudflare Tunnel support
    server: {
      // Allow external connections (required for tunnels)
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      // Don't open browser automatically
      open: false,
      // Enable CORS for dev
      cors: true,
      // Proper headers for SSR
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    },
    
    // Preview server configuration (for testing production builds)
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: false,
      cors: true,
    },
    
    // Define environment variables explicitly for production builds
    // This ensures they're available even if not in a .env file
    // NOTE: These are read from environment variables at build time
    // Set them in .env.production or export before running npm run build
    define: {
      // Log what we're trying to define
      ...(mode === 'production' && console.log('🔧 Defining production env vars from process.env')),
      
      // Make process.env VITE_ variables available
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN
      ),
      'import.meta.env.VITE_FIREBASE_DATABASE_URL': JSON.stringify(
        process.env.VITE_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID
      ),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(
        process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ),
      'import.meta.env.VITE_EMAIL_SERVICE_URL': JSON.stringify(
        process.env.VITE_EMAIL_SERVICE_URL || process.env.EMAIL_SERVICE_URL
      ),
      'import.meta.env.VITE_EMAIL_API_KEY': JSON.stringify(
        process.env.VITE_EMAIL_API_KEY || process.env.EMAIL_API_KEY
      ),
    },
  };
});
