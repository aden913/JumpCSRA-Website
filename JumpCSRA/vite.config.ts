import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// @ts-expect-error - Type conflict due to duplicate Vite installations in parent/child directories
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development/production)
  const env = loadEnv(mode, process.cwd(), '');
  
  console.log('');
  console.log('='.repeat(80));
  console.log('🔧 VITE BUILD-TIME CONFIGURATION');
  console.log('='.repeat(80));
  console.log('Build Mode:', mode);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Working Directory:', process.cwd());
  console.log('');
  
  // Check for Firebase env vars at BUILD TIME
  console.log('🔍 Checking for VITE_FIREBASE_* environment variables at BUILD TIME:');
  const firebaseVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_DATABASE_URL',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_EMAIL_API_KEY',
    'VITE_EMAIL_SERVICE_URL'
  ];
  
  let foundCount = 0;
  let missingVars = [];
  
  for (const varName of firebaseVars) {
    const value = env[varName] || process.env[varName];
    if (value) {
      foundCount++;
      console.log(`  ✅ ${varName}: "${value.substring(0, 20)}...${value.slice(-4)}" (${value.length} chars)`);
    } else {
      missingVars.push(varName);
      console.log(`  ❌ ${varName}: MISSING`);
    }
  }
  
  console.log('');
  console.log(`📊 Summary: ${foundCount}/${firebaseVars.length} environment variables found`);
  
  if (missingVars.length > 0) {
    console.error('');
    console.error('❌❌❌ CRITICAL: Missing environment variables at BUILD TIME!');
    console.error('Missing:', missingVars.join(', '));
    console.error('');
    console.error('These variables will be EMPTY in the built bundle!');
    console.error('');
    console.error('FIX: Before running "npm run build", set these variables:');
    console.error('  export VITE_FIREBASE_API_KEY="your-key"');
    console.error('  export VITE_FIREBASE_AUTH_DOMAIN="your-domain"');
    console.error('  # ... etc for all variables');
    console.error('');
    console.error('Or create a .env file in:', process.cwd());
    console.error('');
  } else {
    console.log('✅ All required environment variables are available at build time!');
  }
  
  console.log('='.repeat(80));
  console.log('');
  
  const config = {
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    
    // Dev server configuration for Cloudflare Tunnel support
    server: {
      // Allow external connections (required for tunnels)
      host: '0.0.0.0',
      port: 3000,
      strictPort: false,
      // Don't open browser automatically
      open: false,
      // Enable CORS for dev
      cors: true,
      // Allow Cloudflare tunnel hosts
      allowedHosts: [
        '.trycloudflare.com',
        'localhost',
        '127.0.0.1',
      ],
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
  
  return config;
});
