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
      (queryError, rows) => {
        if (queryError) {
          res.status(500).json({ error: 'Failed to retrieve cart.' });
          return;
        }

        if (rows.length === 0) {
          res.status(404).json({ error: 'Cart not found.' });
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

        const pricedCart = priceCart(
          { items },
          {
            ...discountOptions,
            couponCode: req.query.couponCode
          }
        );

        res.json({
          id: rows[0].cart_id,
          ...pricedCart
        });
      }
    );
  });

  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
});
