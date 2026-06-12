# Storefront — Live Product Data Wired In

## What changed (and what didn't)

**Untouched:** ticker bar, `<header>` (search, top actions, logo, nav), page hero,
filter bar, trust strip, `.site-footer`, `shared.css`, `shared.js`, and all
inline scripts (cart, filterProducts, sortProducts, setView, search, auth
stubs). Zero changes to layout, theme, fonts, or colors.

**Added:** one new shared file, `products-api.js`, plus two `<script>` lines
at the bottom of each page (right after the existing inline `<script>` block,
before `</body>`).

## New file: `products-api.js`

Exposes `PB_loadCategory(cat, opts)`:

- Fetches `GET {API_BASE}/api/products?cat=<cat>` (omit `cat` for all categories)
- Filters to `active !== false`
- Renders cards using your **exact existing markup/classes**
  (`.product-card`, `.product-card-img`, `.pc-badge`, `.product-card-body`,
  `.product-card-game`, `.product-card-name`, `.pc-rating`,
  `.product-card-meta`, `.pc-price`, `.pc-old`, `.pc-cart-btn`) — so
  `filterProducts()`, `sortProducts()`, `setView()`, and `addToCart()` all
  keep working with zero changes.
- Updates `#result-count` and the "Products Listed" hero stat to the real count
- **If the API is unreachable or returns 0 items, the page's existing static
  cards stay exactly as they are** — they double as offline fallback/demo data
- `API_BASE` defaults to `https://playbeat-backend.onrender.com`. Override per
  page by setting `window.PB_API_BASE = '...'` *before* `products-api.js` loads

### Card field mapping (Product model → card)
| Card slot | Source |
|---|---|
| Image icon + gradient | Category icon (🎮🎁💻🤖⚔️👤📺💎) + a stable hue derived from the product id |
| `.pc-badge` | `product.badge` (HOT/NEW/SALE/BEST/RARE) — hidden if empty |
| `.product-card-game` | Delivery type — "⚡ Instant delivery" / "🕐 Manual delivery (≤2h)" |
| `.product-card-name` | `product.name` |
| `.pc-rating` row | Real stock status — "● In stock" / "● Low stock — N left" / "● Out of stock" |
| `.pc-price` / `.pc-old` | `usd * 278` → "PKR X,XXX" (and `oldUsd` if set) |
| Card link | `single.html?id=<product.id>` |
| Add to Cart | Disabled + "Sold Out" when stock is 0 |

I deliberately replaced the old star-rating/review-count row with real stock
status — there's no rating data in the Product model, and showing fake
ratings/review counts felt wrong for a live storefront.

## Per-page wiring

| Page | Category sent to API |
|---|---|
| games.html | `Games` |
| gift-cards.html | `Gift Cards` |
| software.html | `Software` |
| ai-tools.html | `AI Tools` |
| game-items.html | `Game Items` |
| accounts.html | `Accounts` |
| subscriptions.html | `Subscriptions` |
| top-up.html | `Top Up` |
| trending.html | all categories, **badged products only**, max 12 |
| index.html | all categories, **badged products only**, max 8 (featured) |

## Before this goes live

1. **Public API route needed.** Your current `admin-routes.js` only has
   `/api/admin/products` behind `protect + adminOnly`. Add a public
   `GET /api/products` (same shape, filter `active !== false`, no auth) —
   say the word and I'll add it.
2. Set `window.PB_API_BASE` to your real deployed backend URL on each page
   (or globally via a small shared snippet) once you have it.
3. Heads-up (unrelated to this change, didn't touch it): `index.html`'s
   `<title>` and hero copy still say "Subscriptions" — looks like it was
   cloned from `subscriptions.html` and not yet re-themed as the homepage.

## Next candidates
- `single.html` — wire the product detail page to `GET /api/products/:id`
  using the `?id=` query param the cards now link with
- `checkout.html` — connect to a cart/order endpoint
- A public `/api/products` route (see point 1 above)
