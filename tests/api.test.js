import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../api/nasa.js';

test('rechaza recursos fuera de la lista blanca', async () => {
  const res = await GET(new Request('http://x/api/nasa?resource=../../etc'));
  assert.equal(res.status, 400);
});

test('reenvía a api.nasa.gov con la clave del servidor y filtra parámetros', async () => {
  const original = globalThis.fetch;
  let called;
  globalThis.fetch = async (url) => { called = new URL(url); return new Response('[]', { status: 200 }); };
  process.env.NASA_API_KEY = 'secreta';
  try {
    const res = await GET(new Request('http://x/api/nasa?resource=flares&startDate=2026-09-01&evil=1&endDate=<script>'));
    assert.equal(res.status, 200);
    assert.equal(called.pathname, '/DONKI/FLR');
    assert.equal(called.searchParams.get('api_key'), 'secreta');
    assert.equal(called.searchParams.get('startDate'), '2026-09-01');
    assert.equal(called.searchParams.get('evil'), null);
    assert.equal(called.searchParams.get('endDate'), null);
    assert.match(res.headers.get('cache-control'), /s-maxage/);
  } finally {
    globalThis.fetch = original;
    delete process.env.NASA_API_KEY;
  }
});

test('devuelve 502 si la NASA no responde', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try {
    const res = await GET(new Request('http://x/api/nasa?resource=neo&page=1'));
    assert.equal(res.status, 502);
  } finally {
    globalThis.fetch = original;
  }
});
