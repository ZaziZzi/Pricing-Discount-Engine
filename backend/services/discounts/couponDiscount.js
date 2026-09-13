const coupons = {
  SAVE5: 500
};

function calculateCouponDiscount(couponCode, subtotalPence) {
  const hasCoupon = Object.prototype.hasOwnProperty.call(coupons, couponCode);
  const couponAmountPence = hasCoupon ? coupons[couponCode] : 0;

  return Math.min(couponAmountPence, subtotalPence);
}

module.exports = {
  calculateCouponDiscount
};
