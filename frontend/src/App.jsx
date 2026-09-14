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
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
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

  async function loadProducts() {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load products.');
      }

      setProducts(data);
      setSelectedProductId(data[0] ? String(data[0].id) : '');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load products.');
    }
  }

  async function mutateCart(url, method, body) {
    setMutationLoading(true);
    setError('');

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update the cart.');
      }

      await loadPricing(couponCode);
    } catch (requestError) {
      setError(requestError.message || 'Unable to update the cart.');
    } finally {
      setMutationLoading(false);
    }
  }

  useEffect(() => {
    loadPricing();
    loadProducts();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    loadPricing(couponCode);
  }

  function handleAddProduct(event) {
    event.preventDefault();

    if (selectedProductId) {
      mutateCart(`/api/carts/${cartId}/items`, 'POST', {
        productId: Number(selectedProductId),
        quantity: 1
      });
    }
  }

  function updateQuantity(productId, quantity) {
    mutateCart(`/api/carts/${cartId}/items/${productId}`, 'PATCH', { quantity });
  }

  function removeItem(productId) {
    mutateCart(`/api/carts/${cartId}/items/${productId}`, 'DELETE');
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
          <button type="submit" disabled={loading || mutationLoading}>
            {loading || mutationLoading ? 'Loading...' : 'Apply coupon'}
          </button>
        </div>
      </form>

      <form className="add-product-form" onSubmit={handleAddProduct}>
        <label htmlFor="product-select">Add product</label>
        <div className="coupon-controls">
          <select
            id="product-select"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            disabled={products.length === 0 || mutationLoading}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!selectedProductId || mutationLoading}>
            Add
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
                    <div className="cart-item-details">
                      <h3>{item.name}</h3>
                      <p>{item.quantity} × {formatPence(item.unitPricePence)}</p>
                    </div>
                    <div className="cart-item-actions">
                      <div className="quantity-controls" aria-label={`Quantity for ${item.name}`}>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          disabled={item.quantity === 1 || mutationLoading}
                          aria-label={`Decrease ${item.name} quantity`}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={mutationLoading}
                          aria-label={`Increase ${item.name} quantity`}
                        >
                          +
                        </button>
                      </div>
                      <strong>{formatPence(item.lineTotalPence)}</strong>
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => removeItem(item.productId)}
                        disabled={mutationLoading}
                      >
                        Remove
                      </button>
                    </div>
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
