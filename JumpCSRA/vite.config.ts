import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Load env file based on mode (development/production)
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log('🔧 Vite Config - Build Mode:', mode);
  console.log('🔧 Vite Config - NODE_ENV:', process.env.NODE_ENV);
  
  // Log which Firebase env vars are available at build time
  const firebaseVars = Object.keys(env).filter(k => k.includes('FIREBASE'));
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
  };
});
