import { NextFunction, Response, Request } from 'express'
import { Server } from 'http'
import { Socket } from 'net'

/**
 * This adds socket-level timeout handling to the server, and needs to be called once, after the httpServer is created.
 * It checks if the client has sent the body of the request within the given time.
 * If the body is not sent in time, we emit a timeout event on the socket, for Express-level middleware (later in this file)
 * to handle.
 */
export const setupSocketTimeout = (server: Server, time: number = 10000) => {
  console.log('setting up socket timeout')

  server.on('connection', (socket: Socket) => {
    let lastDataTime = Date.now()
    let bytesReceived = 0
    let headersReceived = false

    // Track raw bytes received
    socket.on('data', (chunk: Buffer) => {
      lastDataTime = Date.now()

      if (!headersReceived) {
        // Look for the double CRLF that marks the end of headers
        const headerEnd = chunk.indexOf('\r\n\r\n')
        if (headerEnd !== -1) {
          headersReceived = true
          // Only count bytes after the headers
          bytesReceived += chunk.length - (headerEnd + 4)
        }
      } else {
        bytesReceived += chunk.length
      }

      // request has been fully received
      if (bytesReceived === (socket as any).contentLength) {
        clearInterval(checkIntervalId)
      }
    })

    // Check for inactivity
    const checkIntervalId = setInterval(() => {
      const timeSinceLastData = Date.now() - lastDataTime

      if (timeSinceLastData > time) {
        socket.emit('timeout')
        clearInterval(checkIntervalId)
      }
    }, 1000)

    socket.on('close', () => {
      clearInterval(checkIntervalId)
    })
  })

  // Get Content-Length from request headers
  // this is easier than parsing the headers from the raw socket data
  server.on('request', (req: any, res: any) => {
    const socket = req.socket
    if (req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length'], 10)
      // Store the content length on the socket for the timeout handler to use
      socket.contentLength = contentLength
    }
  })
}

/**
 * Create a new timeout middleware. This middleware prevents slow- or no-body POST requests from
 * getting hung up in other middlewares (like the JSON body parser).
 * Returns a 408 if a body hasn't been received within the timeout.
 *
 * @param {number} [time=25000] The timeout as a number of milliseconds
 * @return {function} middleware
 * @public
 */
export const slowBodyTimeout = (time: number = 10000, loggingFn: (e: Error) => void = console.error) => {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next()
    }

    // First mitigation: if the client knows there's no body at all
    if (req.headers['content-length'] === '0') {
      res.status(400).send('Empty request body not allowed')
      return
    }

    // Second mitigation: reject the request if socket handling code has received no data for $TIME,
    // and the request has not been fully received
    req.socket.on('timeout', () => {
      loggingFn(new SlowBodyException(`Body not received in time for ${req.method} ${req.originalUrl}`))
      res.status(408).send('Request Timeout: No body received')
      res.end()
      return
    })

    next()
    return
  }
}

class SlowBodyException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlowBodyException'
  }
}
