import { createRequestHandler } from "@react-router/express";
import { type ServerBuild } from "react-router";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODE = process.env.NODE_ENV || "production";
const BUILD_DIR = path.join(__dirname, "build");

const app = express();

// Trust proxy for proper IP detection behind nginx
app.set("trust proxy", 1);

// Serve static assets with proper caching
app.use(
  "/assets",
  express.static(path.join(BUILD_DIR, "client/assets"), {
    immutable: true,
    maxAge: "1y",
  })
);

// Serve static files from build/client (favicon, etc.)
app.use(
  express.static(path.join(BUILD_DIR, "client"), {
    maxAge: "1h",
  })
);

// Serve files from public directory
if (MODE === "development") {
  app.use(
    express.static("public", {
      maxAge: "1h",
    })
  );
}

// Handle all other requests with React Router
const build = (await import("./build/server/index.js")) as unknown as ServerBuild;

app.all(
  "*",
  createRequestHandler({
    build,
    mode: MODE,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server started on http://localhost:${port}`);
  console.log(`   Mode: ${MODE}`);
});
