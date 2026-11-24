import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import type { IncomingMessage, ServerResponse } from 'node:http';

function readNodeRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function localApiMiddlewarePlugin(): Plugin {
  return {
    name: 'focusquest-local-api',
    configureServer(server) {
      dotenv.config();

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        try {
          const mod = await server.ssrLoadModule('/netlify/functions/api.ts');
          const handleApiRequest = mod.handleApiRequest as (request: Request) => Promise<Response>;

          const host = req.headers.host || 'localhost:5173';
          const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
          const fullUrl = `${proto}://${host}${req.url}`;

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              for (const v of value) headers.append(key, v);
            } else if (typeof value === 'string') {
              headers.set(key, value);
            }
          }

          const method = (req.method || 'GET').toUpperCase();
          const hasBody = method !== 'GET' && method !== 'HEAD';
          const bodyBuffer = hasBody ? await readNodeRequestBody(req) : undefined;

          const webRequest = new Request(fullUrl, {
            method,
            headers,
            body:
              bodyBuffer && bodyBuffer.length > 0
                ? new Uint8Array(bodyBuffer)
                : undefined,
          });

          const webResponse = await handleApiRequest(webRequest);

          res.statusCode = webResponse.status;

          const setCookies =
            typeof webResponse.headers.getSetCookie === 'function'
              ? webResponse.headers.getSetCookie()
              : [];

          webResponse.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') return;
            res.setHeader(key, value);
          });

          if (setCookies.length > 0) {
            res.setHeader('set-cookie', setCookies);
          }

          const arrayBuf = await webResponse.arrayBuffer();
          res.end(Buffer.from(arrayBuf));
        } catch (err) {
          console.error('[Local API Middleware Error]', err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error: 'Erro no servidor local da API.',
            })
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApiMiddlewarePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
