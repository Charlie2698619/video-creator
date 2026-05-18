import { createServer } from './http.js'

const server = await createServer()
const address = server.address()
const port = typeof address === 'object' && address ? address.port : 8787

console.log(`Video Creator local server listening on http://127.0.0.1:${port}`)
