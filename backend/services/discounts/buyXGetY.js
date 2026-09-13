function calculateBuyXGetYDiscount(item, rule) {
  if (!rule || item.productId !== rule.productId) {
    return 0;
  }

  const groupSize = rule.buyQuantity + rule.freeQuantity;
  const freeQuantity = Math.floor(item.quantity / groupSize) * rule.freeQuantity;

  return Math.min(freeQuantity * item.unitPricePence, item.lineTotalPence);
}

module.exports = {
  calculateBuyXGetYDiscount
};
