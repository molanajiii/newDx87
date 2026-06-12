/* ════════════════════════════════════════════════════════════════════════
   PlayBeat Digital — Live Product Loader
   ════════════════════════════════════════════════════════════════════════
   Drop this on any category page (after shared.js) and call
   PB_loadCategory(...) to replace the static demo cards in #products-grid
   with live data from GET /api/products.

   - Does NOT touch header, footer, hero, filter bar, or trust strip.
   - If the API is unreachable or returns zero items for this category,
     the existing static cards in the page stay exactly as-is (they double
     as both demo content and an offline fallback).
   - Renders cards using the SAME markup/classes as the static cards
     (.product-card, .product-card-img, .pc-badge, .product-card-body,
     .product-card-game, .product-card-name, .pc-rating, .product-card-meta,
     .pc-price, .pc-old, .pc-cart-btn) so all existing CSS, filterProducts(),
     sortProducts(), setView() and addToCart() keep working unchanged.

   Usage:
     <script src="products-api.js"></script>
     <script>PB_loadCategory('Games');</script>

     // Trending / Featured — pull badged items across all categories:
     <script>PB_loadCategory('', { onlyBadged: true, limit: 12 });</script>

   Override the API origin per-page if needed, before this script loads:
     <script>window.PB_API_BASE = 'https://your-backend.example.com';</script>
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  const API_BASE = window.PB_API_BASE || 'https://playbeat-backend.onrender.com';
  const PKR_RATE = 278; // PKR per USD — matches the admin panel & Product model

  // Per-category icon shown on the card image tile
  const CATEGORY_ICON = {
    'Games':         '🎮',
    'Gift Cards':    '🎁',
    'Software':      '💻',
    'AI Tools':      '🤖',
    'Game Items':    '⚔️',
    'Accounts':      '👤',
    'Subscriptions': '📺',
    'Top Up':        '💎',
  };

  function pkr(usd) {
    return 'PKR ' + Math.round((usd || 0) * PKR_RATE).toLocaleString();
  }

  // Deterministic hue from a product's id/name, so each card keeps a
  // stable (not random-on-reload) gradient like the static demo cards.
  function hueFromString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function deliveryLabel(p) {
    return p.delivery === 'Manual' ? '🕐 Manual delivery (≤2h)' : '⚡ Instant delivery';
  }

  function stockLabel(p) {
    const stock = p.stock ?? 0;
    if (stock <= 0) return '<span style="color:#ff5d5d">● Out of stock</span>';
    if (stock <= 5) return `<span style="color:#f5a623">● Low stock — ${stock} left</span>`;
    return '<span style="color:#00ffcc">● In stock</span>';
  }

  function cardHTML(p) {
    const icon  = CATEGORY_ICON[p.cat] || '🛒';
    const hue1  = hueFromString(String(p.id || p.name || ''));
    const hue2  = (hue1 + 40) % 360;
    const out   = (p.stock ?? 0) <= 0;
    const badge = p.badge ? `<div class="pc-badge">${escapeHTML(p.badge)}</div>` : '';
    const old   = p.oldUsd ? `<span class="pc-old">${pkr(p.oldUsd)}</span>` : '';

    return `
      <a href="single.html?id=${encodeURIComponent(p.id)}"
         class="product-card" data-id="${escapeHTML(p.id)}" data-cat="${escapeHTML(p.cat)}"
         ${out ? '' : 'onclick="addToCart(this,event)"'}>
        <div class="product-card-img" style="background: linear-gradient(135deg,hsl(${hue1},40%,12%) 0%,hsl(${hue2},50%,20%) 100%);">
          <span style="font-size:48px;line-height:1">${icon}</span>
          ${badge}
        </div>
        <div class="product-card-body">
          <div class="product-card-game">${deliveryLabel(p)}</div>
          <div class="product-card-name">${escapeHTML(p.name)}</div>
          <div class="pc-rating">${stockLabel(p)}</div>
          <div class="product-card-meta" style="margin-top:8px;">
            <span class="pc-price">${pkr(p.usd)}</span>
            ${old}
            <button class="pc-cart-btn" ${out ? 'disabled style="opacity:.45;cursor:not-allowed"' : ''}
                    onclick="${out ? 'event.preventDefault()' : 'addToCart(this,event)'}">
              ${out ? 'Sold Out' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </a>`;
  }

  function updateResultCount(n) {
    const el = document.getElementById('result-count');
    if (el) el.textContent = `Showing ${n} product${n === 1 ? '' : 's'}`;
  }

  // Updates the "12+ / Products Listed" hero stat, wherever it appears
  function updateHeroCount(n) {
    document.querySelectorAll('.hero-stat').forEach(stat => {
      const label = stat.querySelector('span');
      const num   = stat.querySelector('b');
      if (label && num && /products listed/i.test(label.textContent || '')) {
        num.textContent = n + '+';
      }
    });
  }

  /**
   * Load products for `cat` into #products-grid.
   * @param {string} cat - Product category (must match the Product model's
   *   `cat` enum exactly, e.g. 'Games', 'Gift Cards', 'AI Tools'). Pass ''
   *   to fetch across all categories (used for Trending/Featured).
   * @param {object} [opts]
   * @param {boolean} [opts.onlyBadged] - keep only products with a non-empty badge
   * @param {number}  [opts.limit] - max number of cards to render
   * @param {(a,b)=>number} [opts.sort] - custom sort before limiting
   */
  window.PB_loadCategory = async function (cat, opts = {}) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    try {
      const params = new URLSearchParams();
      if (cat) params.set('cat', cat);
      const url = `${API_BASE}/api/products${params.toString() ? '?' + params : ''}`;

      const res  = await fetch(url);
      const data = await res.json().catch(() => null);
      if (!data || !data.success) throw new Error(data?.error || `HTTP ${res.status}`);

      let products = (data.products || []).filter(p => p.active !== false);
      const totalActive = products.length;

      if (opts.onlyBadged) products = products.filter(p => !!p.badge);
      if (opts.sort) products = products.slice().sort(opts.sort);
      if (opts.limit) products = products.slice(0, opts.limit);

      if (!products.length) return; // keep the static demo/fallback cards as-is

      grid.innerHTML = products.map(cardHTML).join('');
      updateResultCount(products.length);
      updateHeroCount(totalActive);

      // Re-apply the page's existing search filter (if any text is present)
      if (typeof filterProducts === 'function') {
        try { filterProducts(); } catch (_) { /* ignore */ }
      }
    } catch (err) {
      console.warn('[PlayBeat] Live products unavailable — showing demo catalog.', err.message);
    }
  };
})();
