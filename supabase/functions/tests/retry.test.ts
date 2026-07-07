import { assertEquals, assertRejects } from '@std/assert';
import { fetchWithRetry, isRetryableStatus } from '../_shared/retry.ts';

const noSleep = () => Promise.resolve();

function fetchSequence(responses: (Response | Error)[]): {
  fetchFn: typeof fetch;
  calls: () => number;
} {
  let i = 0;
  const fetchFn = ((_url: string | URL | Request, _init?: RequestInit) => {
    const item = responses[Math.min(i, responses.length - 1)];
    i++;
    if (item instanceof Error) return Promise.reject(item);
    return Promise.resolve(item.clone());
  }) as typeof fetch;
  return { fetchFn, calls: () => i };
}

Deno.test('succeeds first try — no retries', async () => {
  const seq = fetchSequence([new Response('ok', { status: 200 })]);
  const res = await fetchWithRetry('http://x', {}, { fetchFn: seq.fetchFn, sleep: noSleep });
  assertEquals(res.status, 200);
  assertEquals(seq.calls(), 1);
});

Deno.test('retries 429 then succeeds', async () => {
  const seq = fetchSequence([
    new Response('slow down', { status: 429 }),
    new Response('ok', { status: 200 }),
  ]);
  const res = await fetchWithRetry('http://x', {}, { fetchFn: seq.fetchFn, sleep: noSleep });
  assertEquals(res.status, 200);
  assertEquals(seq.calls(), 2);
});

Deno.test('retries network error then succeeds', async () => {
  const seq = fetchSequence([new TypeError('fetch failed'), new Response('ok', { status: 200 })]);
  const res = await fetchWithRetry('http://x', {}, { fetchFn: seq.fetchFn, sleep: noSleep });
  assertEquals(res.status, 200);
  assertEquals(seq.calls(), 2);
});

Deno.test('gives up after the attempt budget on persistent 500s', async () => {
  const seq = fetchSequence([new Response('boom', { status: 500 })]);
  await assertRejects(() =>
    fetchWithRetry('http://x', {}, { attempts: 3, fetchFn: seq.fetchFn, sleep: noSleep })
  );
  assertEquals(seq.calls(), 3);
});

Deno.test('does NOT retry permanent 4xx errors', async () => {
  const seq = fetchSequence([new Response('bad request', { status: 400 })]);
  const res = await fetchWithRetry('http://x', {}, { fetchFn: seq.fetchFn, sleep: noSleep });
  assertEquals(res.status, 400);
  assertEquals(seq.calls(), 1);
});

Deno.test('isRetryableStatus boundary', () => {
  assertEquals(isRetryableStatus(429), true);
  assertEquals(isRetryableStatus(500), true);
  assertEquals(isRetryableStatus(503), true);
  assertEquals(isRetryableStatus(400), false);
  assertEquals(isRetryableStatus(404), false);
  assertEquals(isRetryableStatus(200), false);
});
