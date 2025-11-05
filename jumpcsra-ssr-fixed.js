import { createRequestHandler } from "@react-router/express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve ALL static files from the client build directory
// This includes images, favicons, CSS, JS, etc.
app.use(express.static(path.join(__dirname, "build/client")));

// Handle SSR requests
app.all(
  "*",
  createRequestHandler({
    // Path to the server build
    build: () => import("./build/server/index.js"),
    // Optional: Custom error handling
    onError: (error, { request }) => {
      console.error("SSR Error:", error);
      console.error("Request URL:", request.url);
    },
  })
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 React Router SSR Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📁 Serving from: ${__dirname}`);
  console.log(`📁 Static files from: ${path.join(__dirname, "build/client")}`);
});