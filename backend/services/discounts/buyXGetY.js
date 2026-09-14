function calculateBuyXGetYDiscount(item, rule) {
  if (!rule || item.productId !== rule.productId) {
    return 0;
  }

  // Complete groups of buy + free quantities determine how many units are free.
  const groupSize = rule.buyQuantity + rule.freeQuantity;
  const freeQuantity = Math.floor(item.quantity / groupSize) * rule.freeQuantity;

  return Math.min(freeQuantity * item.unitPricePence, item.lineTotalPence);
}

module.exports = {
  calculateBuyXGetYDiscount
};
