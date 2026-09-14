const express = require('express');
const { initializeDatabase } = require('./db/database');
const { priceCart } = require('./services/pricing');

const app = express();
const port = process.env.PORT || 3001;
const discountOptions = {
  buyXGetYRule: {
    productId: 1,
    buyQuantity: 3,
    freeQuantity: 1
  },
  percentageRule: {
    thresholdPence: 5000,
    percentage: 10
  }
};

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function getCartRows(db, cartId, callback) {
  db.all(
    `SELECT carts.id AS cart_id,
            products.id AS product_id,
            products.name,
            products.unit_price_pence,
            cart_items.quantity
     FROM carts
     LEFT JOIN cart_items ON cart_items.cart_id = carts.id
     LEFT JOIN products ON products.id = cart_items.product_id
     WHERE carts.id = ?
     ORDER BY cart_items.id`,
    [cartId],
    callback
  );
}

function getPricedCart(db, cartId, couponCode, callback) {
  getCartRows(db, cartId, (queryError, rows) => {
    if (queryError) {
      callback(queryError);
      return;
    }

    if (rows.length === 0) {
      callback(null, null);
      return;
    }

    const items = rows
      .filter((row) => row.product_id !== null)
      .map((row) => ({
        productId: row.product_id,
        name: row.name,
        unitPricePence: row.unit_price_pence,
        quantity: row.quantity
      }));

    callback(null, {
      id: rows[0].cart_id,
      ...priceCart(
        { items },
        {
          ...discountOptions,
          couponCode
        }
      )
    });
  });
}

function sendPricedCart(db, cartId, couponCode, res) {
  getPricedCart(db, cartId, couponCode, (queryError, cart) => {
    if (queryError) {
      res.status(500).json({ error: 'Failed to retrieve cart.' });
      return;
    }

    if (!cart) {
      res.status(404).json({ error: 'Cart not found.' });
      return;
    }

    res.json(cart);
  });
}

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Hut 3 Pricing & Discount Engine backend is running.'
  });
});

initializeDatabase((databaseError, db) => {
  if (databaseError) {
    console.error('Database initialization failed:', databaseError.message);
    db.close();
    process.exitCode = 1;
    return;
  }

  app.get('/api/carts/:id', (req, res) => {
    const cartId = Number(req.params.id);

    if (!/^\d+$/.test(req.params.id) || !Number.isSafeInteger(cartId) || cartId <= 0) {
      res.status(400).json({ error: 'Cart ID must be a positive integer.' });
      return;
    }

    sendPricedCart(db, cartId, req.query.couponCode, res);
  });

  app.get('/api/products', (req, res) => {
    db.all(
      'SELECT id, name, unit_price_pence AS unitPricePence FROM products ORDER BY id',
      (queryError, products) => {
        if (queryError) {
          res.status(500).json({ error: 'Failed to retrieve products.' });
          return;
        }

        res.json(products);
      }
    );
  });

  app.post('/api/carts/:id/items', (req, res) => {
    const cartId = Number(req.params.id);
    const productId = Number(req.body.productId);
    const quantity = req.body.quantity;

    if (!/^\d+$/.test(req.params.id) || !isPositiveInteger(cartId)) {
      res.status(400).json({ error: 'Cart ID must be a positive integer.' });
      return;
    }

    if (!isPositiveInteger(productId) || !isPositiveInteger(quantity)) {
      res.status(400).json({ error: 'Product ID and quantity must be positive integers.' });
      return;
    }

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', (beginError) => {
        if (beginError) {
          res.status(500).json({ error: 'Failed to start cart update.' });
          return;
        }

        db.get('SELECT id FROM carts WHERE id = ?', [cartId], (cartError, cart) => {
          if (cartError || !cart) {
            db.run('ROLLBACK', () => {
              res.status(cartError ? 500 : 404).json({
                error: cartError ? 'Failed to check cart.' : 'Cart not found.'
              });
            });
            return;
          }

          db.get('SELECT id FROM products WHERE id = ?', [productId], (productError, product) => {
            if (productError || !product) {
              db.run('ROLLBACK', () => {
                res.status(productError ? 500 : 404).json({
                  error: productError ? 'Failed to check product.' : 'Product not found.'
                });
              });
              return;
            }

            db.run(
              `INSERT INTO cart_items (cart_id, product_id, quantity)
               VALUES (?, ?, ?)
               ON CONFLICT(cart_id, product_id)
               DO UPDATE SET quantity = quantity + excluded.quantity`,
              [cartId, productId, quantity],
              (itemError) => {
                if (itemError) {
                  db.run('ROLLBACK', () => res.status(500).json({ error: 'Failed to add product.' }));
                  return;
                }

                db.run('COMMIT', (commitError) => {
                  if (commitError) {
                    db.run('ROLLBACK', () => res.status(500).json({ error: 'Failed to save cart.' }));
                    return;
                  }

                  sendPricedCart(db, cartId, req.query.couponCode, res);
                });
              }
            );
          });
        });
      });
    });
  });

  app.patch('/api/carts/:id/items/:productId', (req, res) => {
    const cartId = Number(req.params.id);
    const productId = Number(req.params.productId);
    const quantity = req.body.quantity;

    if (!/^\d+$/.test(req.params.id) || !isPositiveInteger(cartId) || !isPositiveInteger(productId)) {
      res.status(400).json({ error: 'Cart ID and product ID must be positive integers.' });
      return;
    }

    if (!isPositiveInteger(quantity)) {
      res.status(400).json({ error: 'Quantity must be a positive integer.' });
      return;
    }

    db.get('SELECT id FROM carts WHERE id = ?', [cartId], (cartError, cart) => {
      if (cartError) {
        res.status(500).json({ error: 'Failed to check cart.' });
        return;
      }

      if (!cart) {
        res.status(404).json({ error: 'Cart not found.' });
        return;
      }

      db.run(
        'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
        [quantity, cartId, productId],
        function (itemError) {
          if (itemError) {
            res.status(500).json({ error: 'Failed to update cart item.' });
            return;
          }

          if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found in cart.' });
            return;
          }

          sendPricedCart(db, cartId, req.query.couponCode, res);
        }
      );
    });
  });

  app.delete('/api/carts/:id/items/:productId', (req, res) => {
    const cartId = Number(req.params.id);
    const productId = Number(req.params.productId);

    if (!/^\d+$/.test(req.params.id) || !isPositiveInteger(cartId) || !isPositiveInteger(productId)) {
      res.status(400).json({ error: 'Cart ID and product ID must be positive integers.' });
      return;
    }

    db.get('SELECT id FROM carts WHERE id = ?', [cartId], (cartError, cart) => {
      if (cartError) {
        res.status(500).json({ error: 'Failed to check cart.' });
        return;
      }

      if (!cart) {
        res.status(404).json({ error: 'Cart not found.' });
        return;
      }

      db.run(
        'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cartId, productId],
        function (itemError) {
          if (itemError) {
            res.status(500).json({ error: 'Failed to remove cart item.' });
            return;
          }

          if (this.changes === 0) {
            res.status(404).json({ error: 'Item not found in cart.' });
            return;
          }

          sendPricedCart(db, cartId, req.query.couponCode, res);
        }
      );
    });
  });

  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
});
