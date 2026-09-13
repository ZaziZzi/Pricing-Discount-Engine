const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');

const backendDirectory = path.join(__dirname, '..');
let serverProcess;
let baseUrl;

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const temporaryServer = createServer();
    temporaryServer.once('error', reject);
    temporaryServer.listen(0, () => {
      const { port } = temporaryServer.address();
      temporaryServer.close(() => resolve(port));
    });
  });
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // The server may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timed out waiting for the backend server.');
}

async function getJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

before(async () => {
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: backendDirectory,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  await waitForServer(`${baseUrl}/api/health`);
});

after(() => {
  serverProcess.kill();
});

test('health endpoint returns 200', async () => {
  const result = await getJson('/api/health');

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'ok' });
});

test('valid cart returns its pricing result', async () => {
  const result = await getJson('/api/carts/1');

  assert.equal(result.status, 200);
  assert.equal(result.body.id, 1);
  assert.equal(result.body.subtotalPence, 4095);
  assert.equal(result.body.finalTotalPence, 4095);
});

test('SAVE5 is applied through the query parameter', async () => {
  const result = await getJson('/api/carts/1?couponCode=SAVE5');

  assert.equal(result.status, 200);
  assert.equal(result.body.discounts[0].amountPence, 500);
  assert.equal(result.body.finalTotalPence, 3595);
});

test('unknown coupons are ignored safely', async () => {
  const result = await getJson('/api/carts/1?couponCode=UNKNOWN');

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.discounts, []);
  assert.equal(result.body.finalTotalPence, 4095);
});

test('invalid cart IDs return 400', async () => {
  for (const id of ['nope', '0', '-1']) {
    const result = await getJson(`/api/carts/${id}`);

    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'Cart ID must be a positive integer.');
  }
});

test('unknown carts return 404', async () => {
  const result = await getJson('/api/carts/999');

  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'Cart not found.');
});
