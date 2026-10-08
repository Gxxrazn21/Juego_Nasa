// Vercel Function: proxy hacia api.nasa.gov.
// Mantiene la clave NASA_API_KEY en el servidor (nunca llega al navegador)
// y solo permite los recursos que usa el juego.

const BASE = 'https://api.nasa.gov';

const RESOURCES = {
  neo: { path: '/neo/rest/v1/neo/browse', params: ['page', 'size'] },
  flares: { path: '/DONKI/FLR', params: ['startDate', 'endDate'] },
  cmes: { path: '/DONKI/CME', params: ['startDate', 'endDate'] },
  apod: { path: '/planetary/apod', params: ['date', 'thumbs'] },
};

const SAFE_VALUE = /^[0-9A-Za-z-]{1,20}$/;

export async function GET(request) {
  const url = new URL(request.url);
  const resource = RESOURCES[url.searchParams.get('resource')];
  if (!resource) return json({ error: 'Recurso no permitido' }, 400);

  const target = new URL(BASE + resource.path);
  for (const name of resource.params) {
    const value = url.searchParams.get(name);
    if (value != null && SAFE_VALUE.test(value)) target.searchParams.set(name, value);
  }
  target.searchParams.set('api_key', process.env.NASA_API_KEY || 'DEMO_KEY');

  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(9000) });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // Cache en el CDN de Vercel: 1 h fresco, 1 día sirviendo mientras revalida.
        'cache-control': res.ok ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
      },
    });
  } catch (err) {
    return json({ error: 'NASA API no disponible', detail: String(err?.message || err) }, 502);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
