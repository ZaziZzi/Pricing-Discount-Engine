const { calculateBuyXGetYDiscount } = require('./discounts/buyXGetY');
const { calculateCouponDiscount } = require('./discounts/couponDiscount');
const { calculatePercentageDiscount } = require('./discounts/percentageDiscount');

function priceCart(cart, options = {}) {
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
