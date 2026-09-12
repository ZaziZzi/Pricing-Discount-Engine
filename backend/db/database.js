const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDirectory = path.join(__dirname, '..', 'data');
const databasePath = path.join(dataDirectory, 'pricing.sqlite');
const schemaPath = path.join(__dirname, 'schema.sql');

function seedDatabase(db, callback) {
  db.serialize(() => {
    db.run(
      'INSERT OR IGNORE INTO products (id, name, unit_price_pence) VALUES (?, ?, ?)',
      [1, 'Coffee Beans', 1299]
    );
    db.run(
      'INSERT OR IGNORE INTO products (id, name, unit_price_pence) VALUES (?, ?, ?)',
      [2, 'Tea Bags', 499]
    );
    db.run('INSERT OR IGNORE INTO carts (id) VALUES (?)', [1]);
    db.run(
      'INSERT OR IGNORE INTO cart_items (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [1, 1, 1, 2]
    );
    db.run(
      'INSERT OR IGNORE INTO cart_items (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)',
      [2, 1, 2, 3],
      callback
    );
  });
}

function initializeDatabase(callback) {
  fs.mkdirSync(dataDirectory, { recursive: true });

  const db = new sqlite3.Database(databasePath);
  db.run('PRAGMA foreign_keys = ON');
  db.exec(fs.readFileSync(schemaPath, 'utf8'), (schemaError) => {
    if (schemaError) {
      callback(schemaError, db);
      return;
    }

    seedDatabase(db, (seedError) => callback(seedError, db));
  });
}

module.exports = {
  databasePath,
  initializeDatabase
};
