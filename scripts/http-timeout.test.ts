import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchWithTimeout } from '@/lib/http';

test('fetchWithTimeout aborts hung connections', async () => {
  const server = http.createServer(() => {
    // Intentionally never respond.
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind test server');
  }

  await assert.rejects(
    fetchWithTimeout(`http://127.0.0.1:${address.port}`, {}, 50),
    /timed out after 50ms/,
  );

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});
