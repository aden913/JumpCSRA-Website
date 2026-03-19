import { createRequestHandler } from "@react-router/express";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  // Serve static assets
  app.use(
    "/assets",
    express.static(join(__dirname, "build/client/assets"), { 
      immutable: true, 
      maxAge: "1y",
      setHeaders: (res, path) => {
        console.log(`Serving asset: ${path}`);
      }
    })
  );
  app.use(express.static(join(__dirname, "build/client"), { maxAge: "1h" }));
}

// Handle SSR requests
const build = viteDevServer
  ? () => viteDevServer.ssrLoadModule("virtual:react-router/server-build")
  : await import("./build/server/index.js");

app.all(
  "*",
  createRequestHandler({
    build,
    getLoadContext: () => ({
      // You can add context here if needed
    }),
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Build path: ${join(__dirname, "build")}`);
});
