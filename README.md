# slow-body

Express middleware to handle badly behaved or slow clients by monitoring request body timing at the socket level. This middleware helps protect your server from clients that send data too slowly or stall during uploads, preventing them from getting stuck in body parsing middleware.

## Features

- Socket-level monitoring before Express middleware processing
- Precise tracking of headers vs body data
- Configurable timeout for body delivery
- Works with Express's error handling system
- Compatible with other Express middleware
- TypeScript support

## Installation

```bash
npm install slow-body
```

## Usage

```typescript
import express from 'express';
import { setupSocketTimeout, slowBodyTimeout } from 'slow-body';

const app = express();
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// Set up socket-level timeout handling (must be called after app.listen)
setupSocketTimeout(server, 10000); // 10 second timeout

// Add the Express middleware to handle timeouts
app.use(slowBodyTimeout(console.error));

// Now it's safe to use body parsing middleware
app.use(express.json());

// Your routes here
app.post('/upload', (req, res) => {
  // Request body will be automatically monitored
  // Slow requests will be terminated before reaching body parsing
});
```

## API

### setupSocketTimeout(server: Server, time?: number)

Sets up socket-level timeout handling. Must be called after creating the HTTP server.

- `server`: The HTTP server instance
- `time`: Timeout in milliseconds (default: 10000)

### slowBodyTimeout(loggingFn?: (error: Error) => void)

Creates Express middleware to handle socket timeouts.

- `loggingFn`: Optional function to log timeout errors (default: console.error)

## Error Handling

The middleware handles slow body errors directly by sending a response and destroying the request. It does not call `next(err)`. For other errors, use a standard Express error handler.

When a timeout or incomplete body is detected, the middleware will:

1. Log the error using the provided logging function
2. Send a 408 (timeout) or 400 (incomplete body) response
3. Call both `res.end()` and `req.destroy()` to ensure the socket is closed and not left in-use (this prevents resource leaks and slowloris attacks)

**Note:** You do not need to handle slow body errors in your error handler, but you should still have a generic error handler for other errors.

## Example

See the [examples/basic](examples/basic) directory for a complete working example that demonstrates:

- Basic request handling
- Slow client detection
- Error handling
- Request logging

## License

MIT