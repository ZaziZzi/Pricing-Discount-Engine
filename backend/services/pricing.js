const { calculateBuyXGetYDiscount } = require('./discounts/buyXGetY');
const { calculateCouponDiscount } = require('./discounts/couponDiscount');
const { calculatePercentageDiscount } = require('./discounts/percentageDiscount');

function validateCart(cart) {
  if (!cart || !Array.isArray(cart.items)) {
    throw new TypeError('Cart must contain an items array.');
  }

  cart.items.forEach((item) => {
    if (!item || !Number.isInteger(item.productId) || !item.name) {
      throw new TypeError('Each cart item must have a product ID and name.');
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new RangeError('Item quantity must be a positive integer.');
    }

    if (!Number.isInteger(item.unitPricePence) || item.unitPricePence < 0) {
      throw new RangeError('Item price must be a non-negative integer in pence.');
    }
  });
}

function priceCart(cart, options = {}) {
  validateCart(cart);

  // Keep calculations in integer pence so currency arithmetic stays exact.
  const items = cart.items.map((item) => ({
    ...item,
    lineTotalPence: item.unitPricePence * item.quantity
  }));

  const subtotalPence = items.reduce(
    (subtotal, item) => subtotal + item.lineTotalPence,
    0
  );

  let discountedSubtotalPence = subtotalPence;
  const discounts = [];

  // Discounts are deliberately ordered: item-level BOGO, percentage, then coupon.
  if (options.buyXGetYRule) {
    const buyXGetYDiscountPence = items.reduce(
      (discount, item) => discount + calculateBuyXGetYDiscount(item, options.buyXGetYRule),
      0
    );

    if (buyXGetYDiscountPence > 0) {
      discountedSubtotalPence -= buyXGetYDiscountPence;
      discounts.push({
        type: 'buyXGetY',
        description: `Buy ${options.buyXGetYRule.buyQuantity}, get ${options.buyXGetYRule.freeQuantity} free`,
        amountPence: buyXGetYDiscountPence
      });
    }
  }

  const percentageDiscountPence = calculatePercentageDiscount(
    discountedSubtotalPence,
    options.percentageRule
  );

  if (percentageDiscountPence > 0) {
    discountedSubtotalPence -= percentageDiscountPence;
    discounts.push({
      type: 'percentage',
      description: `${options.percentageRule.percentage}% off orders over £${options.percentageRule.thresholdPence / 100}`,
      amountPence: percentageDiscountPence
    });
  }

  const couponDiscountPence = calculateCouponDiscount(
    options.couponCode,
    discountedSubtotalPence
  );

  if (couponDiscountPence > 0) {
    discountedSubtotalPence -= couponDiscountPence;
    discounts.push({
      type: 'coupon',
      description: options.couponCode,
      amountPence: couponDiscountPence
    });
  }

  return {
    items,
    subtotalPence,
    discounts,
    finalTotalPence: Math.max(0, discountedSubtotalPence)
  };
}

module.exports = {
  priceCart
};
