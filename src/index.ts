import { Request, Response, NextFunction } from 'express';
import { Socket } from 'net';

export interface SlowBodyOptions {
  /**
   * Maximum time in milliseconds to wait between receiving chunks of data
   * @default 5000 (5 seconds)
   */
  chunkTimeout?: number;

  /**
   * Maximum time in milliseconds to wait for the entire request body
   * @default 30000 (30 seconds)
   */
  totalTimeout?: number;
}

interface ExtendedSocket extends Socket {
  _slowBody?: {
    chunkTimer: NodeJS.Timeout;
    totalTimer: NodeJS.Timeout;
    receivedBytes: number;
    expectedLength?: number;
  };
}

class SlowBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlowBodyError';
  }
}

/**
 * Express middleware to handle slow or badly behaved clients
 * @param options Configuration options
 */
export function slowBody(options: SlowBodyOptions = {}) {
  const chunkTimeout = options.chunkTimeout ?? 5000;
  const totalTimeout = options.totalTimeout ?? 30000;

  return (req: Request, res: Response, next: NextFunction) => {
    const socket = req.socket as ExtendedSocket;
    
    // Skip if socket is already being monitored
    if (socket._slowBody) {
      next();
      return;
    }

    // Parse expected content length
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    // If no content length or GET/HEAD request, skip monitoring
    if (!contentLength || ['GET', 'HEAD'].includes(req.method || '')) {
      next();
      return;
    }

    // Initialize socket monitoring
    socket._slowBody = {
      receivedBytes: 0,
      expectedLength: contentLength,
      chunkTimer: setTimeout(() => {
        const err = new SlowBodyError('Timeout waiting for request body chunk');
        cleanup();
        next(err);
      }, chunkTimeout),
      totalTimer: setTimeout(() => {
        const err = new SlowBodyError('Timeout waiting for complete request body');
        cleanup();
        next(err);
      }, totalTimeout)
    };

    // Monitor data chunks
    socket.on('data', (chunk: Buffer) => {
      const monitoring = socket._slowBody;
      if (!monitoring) return;

      // Reset chunk timeout
      clearTimeout(monitoring.chunkTimer);
      monitoring.chunkTimer = setTimeout(() => {
        const err = new SlowBodyError('Timeout waiting for request body chunk');
        cleanup();
        next(err);
      }, chunkTimeout);

      // Track received bytes
      monitoring.receivedBytes += chunk.length;
    });

    // Clean up on request end
    const cleanup = () => {
      const monitoring = socket._slowBody;
      if (!monitoring) return;

      clearTimeout(monitoring.chunkTimer);
      clearTimeout(monitoring.totalTimer);
      delete socket._slowBody;
    };

    socket.on('end', cleanup);
    socket.on('error', (err) => {
      cleanup();
      next(err);
    });
    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };
} 