import { defineConfig, loadEnv } from 'vite';
import { GET as nasaProxy } from './api/nasa.js';

// En desarrollo y en `vite preview` servimos /api/nasa con el mismo código que la Vercel Function.
async function handle(req, res) {
  const response = await nasaProxy(new Request(`http://localhost${req.originalUrl}`));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}

function nasaApiDev() {
  return {
    name: 'nasa-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/nasa', handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/nasa', handle);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.NASA_API_KEY) process.env.NASA_API_KEY = env.NASA_API_KEY;
  return {
    plugins: [nasaApiDev()],
    build: { chunkSizeWarningLimit: 900 },
  };
});
