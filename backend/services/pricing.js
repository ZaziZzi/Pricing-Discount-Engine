function priceCart(cart) {
  const items = cart.items.map((item) => ({
    ...item,
    lineTotalPence: item.unitPricePence * item.quantity
  }));

  const subtotalPence = items.reduce(
    (subtotal, item) => subtotal + item.lineTotalPence,
    0
  );

  return {
    items,
    subtotalPence
  };
}

module.exports = {
  priceCart
};
