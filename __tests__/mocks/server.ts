import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup MSW server with request handlers
export const server = setupServer(...handlers)

// Error handling for unhandled requests
server.events.on('request:unhandled', (req) => {
  console.warn('Found an unhandled %s request to %s', req.method, req.url)
})