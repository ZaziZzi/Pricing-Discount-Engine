Main Decisions
Database: SQLite
Data model: carts → cart_items → products
Money: stored as integer pence to avoid floating-point currency issues
Percentage discount: 10% off when the subtotal is £50 or more
Buy X Get Y: applied to qualifying items first
Discount order: Buy X Get Y → percentage discount → flat coupon
Rounding: monetary calculations rounded to the nearest penny
Minimum total: £0.00
Frontend: React
Backend: Node.js + Express
Testing: focus on the pricing engine and important edge cases
Docker: optional final task if the required functionality is complete
Implementation Checklist
1. Project Foundation

Initialise backend and frontend

Configure Express

Configure React

Add basic project structure

Verify both applications run

2. Database

Create SQLite database

Create carts, products and cart_items

Add seed data

Verify relationships and stored prices

3. Backend & Cart API

Retrieve persisted cart

Validate cart data

Return structured cart information

Handle invalid/missing data

4. Pricing Engine

Calculate line totals

Calculate subtotal

Keep pricing logic separate from API routes

Return itemised pricing information

5. Discounts

Add percentage discount

Add Buy X Get Y

Add SAVE5 coupon

Handle unknown coupons

Apply discounts in the agreed order

6. Validation & Tests

Empty cart

Zero quantity

Negative quantity

£50 threshold

Multiple Buy X Get Y groups

Invalid coupon

Coupon greater than subtotal

Multiple discounts

Rounding

Prevent negative totals

Add automated pricing tests

7. React UI

Display cart items

Display coupon input

Call pricing API

Display subtotal

Display each discount and its effect

Display final total

Handle errors

8. Documentation & Finalisation

Complete README

Document architecture and schema

Explain discount decisions

Add AI usage notes

Document limitations/improvements

Review and clean code

Verify project from a clean start

9. Stretch — Only If Time Allows

Docker / Docker Compose

Basic API authentication

More extensible discount-rule structure