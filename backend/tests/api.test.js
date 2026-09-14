const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const sqlite3 = require('sqlite3').verbose();
const { databasePath } = require('../db/database');

const backendDirectory = path.join(__dirname, '..');
const temporaryCartId = 9001;
let serverProcess;
let baseUrl;

// Mutations use an isolated cart so tests never alter the seeded demo cart.
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
  return requestJson(pathname);
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return {
    status: response.status,
    body: await response.json()
  };
}

before(async () => {
  await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath);
    db.run('INSERT OR IGNORE INTO carts (id) VALUES (?)', [temporaryCartId], (error) => {
      db.close((closeError) => {
        if (error || closeError) {
          reject(error || closeError);
          return;
        }

        resolve();
      });
    });
  });

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

  const db = new sqlite3.Database(databasePath);
  db.run('DELETE FROM carts WHERE id = ?', [temporaryCartId], () => db.close());
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

test('products endpoint returns the available products', async () => {
  const result = await getJson('/api/products');

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, [
    { id: 1, name: 'Coffee Beans', unitPricePence: 1299 },
    { id: 2, name: 'Tea Bags', unitPricePence: 499 }
  ]);
});

test('adding a product persists and adding it again increases its quantity', async () => {
  const firstAdd = await requestJson(`/api/carts/${temporaryCartId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 1, quantity: 2 })
  });
  const secondAdd = await requestJson(`/api/carts/${temporaryCartId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 1, quantity: 1 })
  });

  assert.equal(firstAdd.status, 200);
  assert.equal(secondAdd.status, 200);
  assert.equal(secondAdd.body.items[0].quantity, 3);
  assert.equal(secondAdd.body.items[0].lineTotalPence, 3897);
});

test('add rejects invalid quantities and unknown products without changing the cart', async () => {
  const before = await getJson(`/api/carts/${temporaryCartId}`);
  const invalidQuantity = await requestJson(`/api/carts/${temporaryCartId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 2, quantity: 0 })
  });
  const unknownProduct = await requestJson(`/api/carts/${temporaryCartId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 999, quantity: 1 })
  });
  const after = await getJson(`/api/carts/${temporaryCartId}`);

  assert.equal(invalidQuantity.status, 400);
  assert.equal(unknownProduct.status, 404);
  assert.deepEqual(after.body.items, before.body.items);
});

test('update changes quantity and rejects invalid quantities', async () => {
  const update = await requestJson(`/api/carts/${temporaryCartId}/items/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 8 })
  });
  const zeroQuantity = await requestJson(`/api/carts/${temporaryCartId}/items/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 0 })
  });
  const nonIntegerQuantity = await requestJson(`/api/carts/${temporaryCartId}/items/1`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 1.5 })
  });

  assert.equal(update.status, 200);
  assert.equal(update.body.items[0].quantity, 8);
  assert.equal(update.body.discounts[0].type, 'buyXGetY');
  assert.equal(update.body.discounts[1].type, 'percentage');
  assert.equal(zeroQuantity.status, 400);
  assert.equal(nonIntegerQuantity.status, 400);
});

test('update distinguishes unknown carts and items', async () => {
  const unknownCart = await requestJson('/api/carts/999/items/1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 2 })
  });
  const unknownItem = await requestJson(`/api/carts/${temporaryCartId}/items/2`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: 2 })
  });

  assert.equal(unknownCart.status, 404);
  assert.equal(unknownCart.body.error, 'Cart not found.');
  assert.equal(unknownItem.status, 404);
  assert.equal(unknownItem.body.error, 'Item not found in cart.');
});

test('delete removes an item and distinguishes unknown items', async () => {
  const remove = await requestJson(`/api/carts/${temporaryCartId}/items/1`, {
    method: 'DELETE'
  });
  const removedAgain = await requestJson(`/api/carts/${temporaryCartId}/items/1`, {
    method: 'DELETE'
  });
  const cart = await getJson(`/api/carts/${temporaryCartId}`);

  assert.equal(remove.status, 200);
  assert.deepEqual(remove.body.items, []);
  assert.equal(removedAgain.status, 404);
  assert.equal(removedAgain.body.error, 'Item not found in cart.');
  assert.deepEqual(cart.body.items, []);
});

test('delete distinguishes unknown carts', async () => {
  const result = await requestJson('/api/carts/999/items/1', { method: 'DELETE' });

  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'Cart not found.');
});
