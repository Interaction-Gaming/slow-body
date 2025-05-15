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
const server = app.listen(3000);

// Set up socket-level timeout handling
setupSocketTimeout(server, 10000); // 10 second timeout

// Add the Express middleware to handle timeouts
app.use(slowBodyTimeout(10000));

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

### slowBodyTimeout(time?: number, loggingFn?: (error: Error) => void)

Creates Express middleware to handle socket timeouts.

- `time`: Timeout in milliseconds (default: 10000)
- `loggingFn`: Optional function to log timeout errors (default: console.error)

## Error Handling

The middleware integrates with Express's error handling system. When a timeout occurs, it will:

1. Create a `SlowBodyException` with an appropriate message
2. Send a 408 Request Timeout response
3. Log the error using the provided logging function

Example error handling:

```typescript
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.name === 'SlowBodyException') {
    console.error('Slow client detected:', {
      url: req.url,
      method: req.method,
      message: err.message
    });
    res.status(408).json({ 
      error: err.message,
      type: 'SlowBodyException'
    });
  } else {
    next(err);
  }
});
```

## Example

See the [examples/basic](examples/basic) directory for a complete working example that demonstrates:

- Basic request handling
- Slow client detection
- Error handling
- Request logging

## License

MIT