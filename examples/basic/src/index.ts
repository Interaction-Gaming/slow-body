import express from "express";
import { setupSocketTimeout, slowBodyTimeout } from "../../../src";

const app = express();
const port = 3000;

// Basic request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Use the slow-body middleware with custom options
app.use(slowBodyTimeout(console.error));

// Parse JSON bodies - this should not hang if the body is slow to arrive
app.use(express.json());

// Test endpoint for normal requests
app.post("/upload", (req, res) => {
  console.log("Received request body:", req.body);
  res.json({
    message: "Request processed successfully",
    bodySize: JSON.stringify(req.body).length,
  });
});

// Generic error handler (slow body errors are handled directly by the middleware above)
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      headers: req.headers,
    });
    res.status(500).json({
      error: err.message,
      name: err.name,
    });
  }
);

const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
  console.log("\nTest with normal request:");
  console.log(
    'curl -X POST -H "Content-Type: application/json" -d \'{"test":"data"}\' http://localhost:3000/upload'
  );
  console.log("\nTest with slow request (should timeout):");
  console.log(
    'curl -X POST -H "Content-Type: application/json" --data-binary @<(dd if=/dev/zero bs=100 count=1 2>/dev/null | tr "\\0" "a") http://localhost:3000/slow'
  );
});

// Set up socket-level timeout handling (must be called after app.listen)
setupSocketTimeout(10000, server); // 10s timeout
