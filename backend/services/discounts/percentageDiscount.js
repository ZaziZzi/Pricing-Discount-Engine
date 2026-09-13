function calculatePercentageDiscount(subtotalPence, rule) {
  if (!rule || subtotalPence < rule.thresholdPence) {
    return 0;
  }

  return Math.round((subtotalPence * rule.percentage) / 100);
}

module.exports = {
  calculatePercentageDiscount
};
