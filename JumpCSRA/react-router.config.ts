import type { Config } from "@react-router/dev/config";

export default {
  // Enable SSR
  ssr: true,
  
  // Explicitly set the build directory
  buildDirectory: "build",
  
  // Server build configuration
  serverBuildFile: "index.js",
  
  // IMPORTANT: Future flags for React Router v7 features
  future: {
    // Enable v3 route conventions (required for proper manifest generation)
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
  },
} satisfies Config;
