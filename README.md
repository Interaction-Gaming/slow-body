# slow-body

Express middleware to handle badly behaved or slow clients by monitoring request body timing. This middleware helps protect your server from clients that send data too slowly or stall during uploads.

## Features

- Monitors time between chunks of data to detect stalled uploads
- Enforces a total deadline for complete request body delivery
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
import { slowBody } from 'slow-body';

const app = express();

// Use with default options (5s chunk timeout, 30s total timeout)
app.use(slowBody());

// Or configure options
app.use(slowBody({
  chunkTimeout: 2000,    // 2 second timeout between chunks
  totalTimeout: 5000     // 5 second total timeout
}));

// Your routes here
app.post('/upload', (req, res) => {
  // Request body will be automatically monitored
  // Slow requests will be terminated and handled by your error middleware
});
```

## Options

- `chunkTimeout` (number): Maximum time in milliseconds to wait between receiving chunks of data (default: 5000)
- `totalTimeout` (number): Maximum time in milliseconds to wait for the entire request body (default: 30000)

## Error Handling

The middleware integrates with Express's error handling system. When a timeout occurs, it will:

1. Create a `SlowBodyError` with an appropriate message
2. Clean up any resources
3. Pass the error to Express's error handling middleware

Example error handling:

```typescript
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.name === 'SlowBodyError') {
    console.error('Slow client detected:', {
      url: req.url,
      method: req.method,
      message: err.message
    });
    res.status(500).json({ 
      error: err.message,
      type: 'SlowBodyError'
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