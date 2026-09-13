const test = require('node:test');
const assert = require('node:assert/strict');
const { priceCart } = require('../services/pricing');

const percentageRule = { thresholdPence: 5000, percentage: 10 };
const buyXGetYRule = { productId: 1, buyQuantity: 3, freeQuantity: 1 };

function createCart(items) {
  return { items };
}

function createItem({ productId = 1, name = 'Test item', unitPricePence, quantity }) {
  return { productId, name, unitPricePence, quantity };
}

test('calculates a line total and subtotal for one item', () => {
  const result = priceCart(createCart([createItem({ unitPricePence: 1299, quantity: 2 })]));

  assert.equal(result.items[0].lineTotalPence, 2598);
  assert.equal(result.subtotalPence, 2598);
});

test('calculates the subtotal for multiple items', () => {
  const result = priceCart(createCart([
    createItem({ unitPricePence: 1299, quantity: 2 }),
    createItem({ productId: 2, unitPricePence: 499, quantity: 3 })
  ]));

  assert.deepEqual(result.items.map((item) => item.lineTotalPence), [2598, 1497]);
  assert.equal(result.subtotalPence, 4095);
});

test('prices an empty cart at zero', () => {
  assert.deepEqual(priceCart(createCart([])), {
    items: [],
    subtotalPence: 0,
    discounts: [],
    finalTotalPence: 0
  });
});

test('does not apply percentage discount below £50', () => {
  const result = priceCart(createCart([createItem({ unitPricePence: 4999, quantity: 1 })]), {
    percentageRule
  });

  assert.equal(result.discounts.length, 0);
  assert.equal(result.finalTotalPence, 4999);
});

test('applies 10% percentage discount at exactly £50', () => {
  const result = priceCart(createCart([createItem({ unitPricePence: 5000, quantity: 1 })]), {
    percentageRule
  });

  assert.deepEqual(result.discounts[0], {
    type: 'percentage',
    description: '10% off orders over £50',
    amountPence: 500
  });
  assert.equal(result.finalTotalPence, 4500);
});

test('applies 10% percentage discount above £50', () => {
  const result = priceCart(createCart([createItem({ unitPricePence: 6000, quantity: 1 })]), {
    percentageRule
  });

  assert.equal(result.discounts[0].amountPence, 600);
  assert.equal(result.finalTotalPence, 5400);
});

test('rounds percentage discounts to the nearest penny', () => {
  const result = priceCart(createCart([createItem({ unitPricePence: 333, quantity: 3 })]), {
    percentageRule: { thresholdPence: 0, percentage: 10 }
  });

  assert.equal(result.discounts[0].amountPence, 100);
  assert.equal(result.finalTotalPence, 899);
});

test('applies Buy 3 Get 1 for each qualifying quantity', () => {
  const expectedDiscounts = new Map([
    [1, 0],
    [3, 0],
    [4, 1000],
    [7, 1000],
    [8, 2000],
    [12, 3000]
  ]);

  for (const [quantity, expectedDiscountPence] of expectedDiscounts) {
    const result = priceCart(
      createCart([createItem({ unitPricePence: 1000, quantity })]),
      { buyXGetYRule }
    );

    assert.equal(result.discounts[0]?.amountPence || 0, expectedDiscountPence);
  }
});

test('does not apply BOGO to a non-target product', () => {
  const result = priceCart(
    createCart([createItem({ productId: 2, unitPricePence: 1000, quantity: 8 })]),
    { buyXGetYRule }
  );

  assert.deepEqual(result.discounts, []);
  assert.equal(result.finalTotalPence, 8000);
});

test('does not let BOGO discount exceed the item total', () => {
  const result = priceCart(
    createCart([createItem({ unitPricePence: 100, quantity: 10 })]),
    { buyXGetYRule: { ...buyXGetYRule, buyQuantity: 0, freeQuantity: 10 } }
  );

  assert.equal(result.discounts[0].amountPence, 1000);
  assert.equal(result.finalTotalPence, 0);
});

test('applies SAVE5, ignores unknown or missing coupons, and clamps large coupons', () => {
  assert.equal(priceCart(createCart([createItem({ unitPricePence: 1000, quantity: 6 })]), { couponCode: 'SAVE5' }).finalTotalPence, 5500);
  assert.deepEqual(priceCart(createCart([createItem({ unitPricePence: 1000, quantity: 1 })]), { couponCode: 'UNKNOWN' }).discounts, []);
  assert.deepEqual(priceCart(createCart([createItem({ unitPricePence: 1000, quantity: 1 })]), { couponCode: 'toString' }).discounts, []);
  assert.equal(priceCart(createCart([createItem({ unitPricePence: 333, quantity: 1 })]), { couponCode: 'SAVE5' }).finalTotalPence, 0);
  assert.equal(priceCart(createCart([createItem({ unitPricePence: 1000, quantity: 1 })])).finalTotalPence, 1000);
});

test('applies BOGO, then percentage, then coupon', () => {
  const result = priceCart(
    createCart([createItem({ unitPricePence: 1299, quantity: 4 })]),
    { buyXGetYRule, percentageRule, couponCode: 'SAVE5' }
  );

  assert.equal(result.subtotalPence, 5196);
  assert.deepEqual(result.discounts.map((discount) => discount.type), ['buyXGetY', 'coupon']);
  assert.equal(result.finalTotalPence, 3397);
});

test('does not mutate the input cart', () => {
  const cart = createCart([createItem({ unitPricePence: 1299, quantity: 4 })]);
  const originalCart = structuredClone(cart);

  priceCart(cart, { buyXGetYRule });

  assert.deepEqual(cart, originalCart);
});

test('rejects malformed cart data and invalid quantities or prices', () => {
  assert.throws(() => priceCart({}), /items array/);
  assert.throws(() => priceCart(createCart([{}])), /product ID and name/);
  assert.throws(() => priceCart(createCart([createItem({ unitPricePence: 100, quantity: 0 })])), /positive integer/);
  assert.throws(() => priceCart(createCart([createItem({ unitPricePence: -1, quantity: 1 })])), /non-negative integer/);
  assert.throws(() => priceCart(createCart([createItem({ unitPricePence: 100.5, quantity: 1 })])), /non-negative integer/);
});

test('never returns a negative final total', () => {
  const result = priceCart(
    createCart([createItem({ unitPricePence: 100, quantity: 1 })]),
    { couponCode: 'SAVE5' }
  );

  assert.equal(result.finalTotalPence, 0);
});
