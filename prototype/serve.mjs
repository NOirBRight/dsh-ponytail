import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))
const port = Number(process.env.PONYTAIL_PROTOTYPE_PORT ?? 4178)
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname
  const file = pathname === '/' ? 'settings.html' : pathname.slice(1)
  try {
    const body = await readFile(join(root, file))
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Ponytail settings prototype: http://127.0.0.1:${port}/?variant=a`)
})
