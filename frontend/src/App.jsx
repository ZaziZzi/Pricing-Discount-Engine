import { useEffect, useState } from 'react';

const cartId = 1;

function formatPence(pence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(pence / 100);
}

function App() {
  const [couponCode, setCouponCode] = useState('');
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPricing(code = '') {
    setLoading(true);
    setError('');
    setPricing(null);

    const query = code.trim() ? `?couponCode=${encodeURIComponent(code.trim())}` : '';

    try {
      const response = await fetch(`/api/carts/${cartId}${query}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load cart pricing.');
      }

      setPricing(data);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load cart pricing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPricing();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    loadPricing(couponCode);
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="eyebrow">Hut 3</p>
        <h1>Pricing &amp; Discount Engine</h1>
        <p>Cart {cartId} pricing from the backend.</p>
      </header>

      <form className="coupon-form" onSubmit={handleSubmit}>
        <label htmlFor="coupon-code">Coupon code</label>
        <div className="coupon-controls">
          <input
            id="coupon-code"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder="Optional, e.g. SAVE5"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Apply coupon'}
          </button>
        </div>
      </form>

      {loading && <p className="status-message">Loading cart pricing...</p>}

      {!loading && error && (
        <p className="status-message error-message" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && pricing && (
        <>
          <section className="cart-section" aria-labelledby="cart-heading">
            <div className="section-heading">
              <h2 id="cart-heading">Cart items</h2>
              <span>{pricing.items.length} item{pricing.items.length === 1 ? '' : 's'}</span>
            </div>

            {pricing.items.length === 0 ? (
              <p className="empty-message">This cart is empty.</p>
            ) : (
              <div className="item-list">
                {pricing.items.map((item) => (
                  <article className="cart-item" key={item.productId}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.quantity} × {formatPence(item.unitPricePence)}</p>
                    </div>
                    <strong>{formatPence(item.lineTotalPence)}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="summary" aria-labelledby="summary-heading">
            <h2 id="summary-heading">Pricing summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{formatPence(pricing.subtotalPence)}</strong>
            </div>

            <div className="discounts">
              <h3>Discounts</h3>
              {pricing.discounts.length === 0 ? (
                <p className="empty-message">No discounts applied</p>
              ) : (
                pricing.discounts.map((discount, index) => (
                  <div className="summary-row discount-row" key={`${discount.type}-${index}`}>
                    <span>{discount.description}</span>
                    <strong>-{formatPence(discount.amountPence)}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="summary-row final-total">
              <span>Final total</span>
              <strong>{formatPence(pricing.finalTotalPence)}</strong>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
