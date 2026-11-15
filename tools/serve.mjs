// Serves preview/ on http://localhost:4173 so the gallery can be opened in a browser.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'preview')
const PORT = Number(process.env.PORT ?? 4173)
const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' }

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(/^[\\/]+/, '')
  const file = join(ROOT, path === '' ? 'index.html' : path)

  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end()
    return
  }

  try {
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    response.end(body)
  } catch {
    response.writeHead(404).end('not found')
  }
}).listen(PORT, '127.0.0.1', () => console.log(`preview on http://localhost:${PORT}`))
