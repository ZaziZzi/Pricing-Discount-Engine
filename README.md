# Hut 3 Pricing & Discount Engine

A small full-stack pricing demonstration for the Hut 3 Graduate Software Engineer take-home exercise. It stores a persistent shopping cart, applies the agreed discount rules on the backend, and displays the itemised result in a minimal React UI.

## Architecture

```text
React frontend
    -> Express API
    -> pricing and discount services
    -> SQLite database
```

The backend is the source of truth for pricing. The frontend sends cart mutations and displays the pricing result returned by the API; it does not calculate totals or discounts.

## Technologies

- Node.js and JavaScript
- Express
- SQLite using `sqlite3`
- React
- Vite
- Node's built-in `node:test` test runner

## Features

- Persistent SQLite cart with products and cart items
- Add an existing product to a cart
- Increase, decrease, and remove cart items
- Itemised line totals and cart subtotal
- Buy 3 Get 1 Free for Coffee Beans
- 10% percentage discount on qualifying adjusted subtotals
- `SAVE5` flat coupon
- Validation for cart IDs, product IDs, quantities, and pricing input
- Loading and error states in the frontend
- Automated pricing and API tests

## Discount rules

The discount order is a deliberate assumption because the exercise leaves stacking behaviour open:

1. Apply Buy X Get Y Free at item level.
2. Recalculate the subtotal after that item discount.
3. Apply 10% off when the adjusted subtotal is at least 5000 pence (£50).
4. Apply the `SAVE5` coupon for 500 pence (£5).
5. Clamp the final total to a minimum of zero.

All monetary values are integer pence. Percentage discounts are rounded to the nearest penny before being applied. Unknown coupons are ignored safely.

The configured Buy X Get Y rule is Buy 3 Get 1 for product ID 1, Coffee Beans. The rule is passed into the reusable discount function rather than being hidden inside it.

## Examples

### BOGO

Coffee Beans x4 at 1299 pence each:

- Original subtotal: 5196 pence (£51.96)
- BOGO discount: 1299 pence (£12.99)
- Adjusted subtotal: 3897 pence (£38.97)

The adjusted subtotal is below the percentage threshold.

### Percentage discount

Coffee Beans x8:

- Original subtotal: 10392 pence (£103.92)
- BOGO discount: 2598 pence (£25.98)
- Adjusted subtotal: 7794 pence (£77.94)
- 10% discount: 779 pence (£7.79)
- Final total before any coupon: 7015 pence (£70.15)

### All three discounts

Coffee Beans x8 with `SAVE5`:

- Original subtotal: 10392 pence (£103.92)
- BOGO discount: 2598 pence (£25.98)
- Percentage discount: 779 pence (£7.79)
- `SAVE5`: 500 pence (£5.00)
- Final total: 6515 pence (£65.15)

These values are produced by the backend pricing service and are shown here as a worked example.

## Database

SQLite is used because it is relational, local, and requires no separate database server. The database file is created at:

```text
backend/data/pricing.sqlite
```

The schema contains:

- `products`: product names and integer pence prices
- `carts`: cart identities
- `cart_items`: quantities linking carts to products

The three-table structure keeps product data separate from cart state while allowing a cart to contain multiple products through `cart_items`.

Foreign keys are enabled. Quantities must be positive, prices cannot be negative, and `(cart_id, product_id)` is unique so a cart has at most one row per product.

## API

All pricing responses contain the cart ID, items, line totals, subtotal, applied discounts, and final total.

### Health

```http
GET /api/health
```

### Products

```http
GET /api/products
```

Returns the products available for adding to a cart.

### Price a cart

```http
GET /api/carts/:id
GET /api/carts/:id?couponCode=SAVE5
```

The optional `couponCode` query parameter is passed to the backend pricing service.

### Add a product

```http
POST /api/carts/:id/items
Content-Type: application/json

{
  "productId": 1,
  "quantity": 1
}
```

Adding a product already in the cart increases its quantity.

### Update a quantity

```http
PATCH /api/carts/:id/items/:productId
Content-Type: application/json

{
  "quantity": 4
}
```

### Remove a product

```http
DELETE /api/carts/:id/items/:productId
```

Mutation endpoints distinguish a missing cart, missing product, and item not present in the cart with appropriate errors. Add operations use a transaction so validation and the database update succeed or fail together.

## Running locally

From the project root, install dependencies in each application:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

Start the backend in one terminal:

```powershell
cd backend
npm start
```

The backend runs at `http://localhost:3001`.

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

The frontend development proxy sends `/api` requests to the backend on port 3001.

## Verification commands

Run backend tests:

```powershell
cd backend
npm test
```

Verify the SQLite database and seed data:

```powershell
npm run db:verify
```

Check backend syntax:

```powershell
node --check server.js
```

Build the frontend:

```powershell
cd ..\frontend
npm run build
```

The automated tests cover base pricing, discount thresholds and rounding, BOGO quantities, coupons, discount order, immutability, pricing validation, API validation, mutations, persistence, and pricing integration.

## Assumptions and scope

- SQLite is sufficient for this local take-home and keeps setup simple.
- Money is stored and calculated as integer pence to avoid floating-point currency errors.
- Cart 1 and the seeded products provide a small demonstration dataset.
- Authentication, checkout, payments, user accounts, and production deployment are outside the exercise scope.
- The UI is intentionally minimal because the brief prioritises functionality and explainability over visual polish.
- No database-backed discount administration is included; the agreed demonstration rules are configured in the backend.
- The backend is not presented as production-ready infrastructure.

### With more time

I would consider adding authentication and user accounts, more extensible data-driven discount configuration, broader frontend/UI testing, production database and deployment considerations, and Docker setup.

## AI-assisted development

AI tools were used as development assistance during scaffolding, implementation, debugging, and test creation. The resulting code and design decisions were reviewed manually, tested, and adjusted rather than accepted blindly.

For example, generated test assumptions were checked against the actual discount order and corrected when a combined-discount expected value did not match the backend calculation. The implementation decisions remain my responsibility.

One practical issue I encountered was using `&` in the repository folder name. PowerShell interpreted the character as a command operator in some commands, causing path-related errors. I resolved this by renaming the folder to remove the `&`.

### Challenges and resolutions

- Some Windows PowerShell commands failed because of the `&` in the original folder path; renaming the folder removed the ambiguity.
- Early test expectations did not always reflect the agreed discount order; I checked the arithmetic against the pricing service and corrected the fixtures.
- Development servers sometimes occupied ports from earlier runs; stopping stale processes and using the port printed by Vite resolved this.

AI output was treated as a draft: reviewing the code, checking the behaviour, and understanding the final decisions remained part of the development work.
