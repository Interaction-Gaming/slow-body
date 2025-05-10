# slow-body

Express middleware to handle badly behaved or slow clients by monitoring request body size and timing.

## Installation

```bash
npm install slow-body
```

## Usage

```typescript
import express from 'express';
import { slowBody } from 'slow-body';

const app = express();

// Use with default options (30s timeout, 1MB max size)
app.use(slowBody());

// Or configure options
app.use(slowBody({
  timeout: 5000,    // 5 second timeout
  maxSize: 1024 * 1024 * 10  // 10MB max size
}));

// Your routes here
app.post('/upload', (req, res) => {
  // Request body will be automatically monitored
  // Slow or oversized requests will be terminated
});
```

## Options

- `timeout` (number): Maximum time in milliseconds to wait for the request body to be fully received (default: 30000)
- `maxSize` (number): Maximum size of the request body in bytes (default: 1048576 - 1MB)

## License

ISC 