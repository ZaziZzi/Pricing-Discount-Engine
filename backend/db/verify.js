const { databasePath, initializeDatabase } = require('./database');

initializeDatabase((error, db) => {
  if (error) {
    console.error('Database initialization failed:', error.message);
    db.close();
    process.exitCode = 1;
    return;
  }

  db.all(
    `SELECT carts.id AS cart_id,
            products.name,
            products.unit_price_pence,
            cart_items.quantity
     FROM carts
     JOIN cart_items ON cart_items.cart_id = carts.id
     JOIN products ON products.id = cart_items.product_id
     ORDER BY cart_items.id`,
    (queryError, rows) => {
      if (queryError) {
        console.error('Database verification failed:', queryError.message);
        db.close();
        process.exitCode = 1;
        return;
      }

      console.log(`Database ready: ${databasePath}`);
      console.table(rows);
      db.close();
    }
  );
});
