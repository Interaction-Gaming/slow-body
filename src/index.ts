import { NextFunction, Response, Request } from 'express'
import { Server } from 'http'
import { Socket } from 'net'

// Symbol for storing content length on the socket
const kContentLength = Symbol('contentLength')
const kBytesReceived = Symbol('bytesReceived')

interface SlowBodySocket extends Socket {
  [kContentLength]?: number
  [kBytesReceived]?: number
}

/**
 * This adds socket-level timeout handling to the server, and needs to be called once, after the httpServer is created.
 * It checks if the client has sent the body of the request within the given time.
 * If the body is not sent in time, we emit a timeout event on the socket, for Express-level middleware to handle.
 * Note that you do need to handle the timeout event in your Express-level middleware - either with a custom middleware, or with the default one in this package.
 */
export const setupSocketTimeout = (server: Server, time: number = 10000) => {
  server.on('connection', (socket: SlowBodySocket) => {
    let lastDataTime = Date.now()
    socket[kBytesReceived] = 0
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
          socket[kBytesReceived]! += chunk.length - (headerEnd + 4)
        }
      } else {
        socket[kBytesReceived]! += chunk.length
      }

      // request has been fully received
      if (socket[kBytesReceived] === socket[kContentLength]) {
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

    // Check for incomplete body on end
    socket.on('end', () => {
      if ( socket[kBytesReceived] !== socket[kContentLength]) {
        // Incomplete body
        socket.emit('incompleteBody')
      }
    })
  })

  // Get Content-Length from request headers
  // this is easier than parsing the headers from the raw socket data
  server.on('request', (req: any, res: any) => {
    const socket: SlowBodySocket = req.socket
    if (req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length'], 10)
      // Store the content length on the socket for the timeout handler to use
      socket[kContentLength] = contentLength
    }
  })
}

/**
 * Create a new timeout middleware. This middleware prevents slow- or no-body POST requests from
 * getting hung up in other middlewares (like the JSON body parser).
 * Returns a 408 and immediately ends the request if a body hasn't been received within the timeout.
 *
 * @param {function} [loggingFn=console.error] The function to call when a slow body is detected
 * @return {function} middleware
 * @public
 */
export const slowBodyTimeout = (loggingFn: (e: Error) => void = console.error) => {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next()
    }

    // First mitigation: if the client knows there's no body at all
    if (req.headers['content-length'] === '0') {
      res.status(400).send('Empty request body not allowed')
      return
    }

    // Second mitigation: reject the request if socket-level timeout is triggered
    req.socket.once('timeout', () => {
      loggingFn(new SlowBodyException(`Body not received in time for ${req.method} ${req.originalUrl}`))
      if (!res.headersSent) {
        res.status(408).send('Request Timeout: No body received')
        res.end()
      }
      req.destroy() // ensure the socket is able to be reused
      return
    })

    // Third mitigation: reject the request if the body is incomplete on end
    req.socket.once('incompleteBody', () => {
      loggingFn(new SlowBodyException(`Incomplete body received for ${req.method} ${req.originalUrl}`))
      if (!res.headersSent) {
        res.status(400).send('Request body incomplete')
        res.end()
      }
      req.destroy() // ensure the socket is able to be reused
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
