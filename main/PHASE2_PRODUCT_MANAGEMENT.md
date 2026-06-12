# Phase 2 — Product Management Now Fully Functional

This phase replaces the "honest but limited" product UI from Phase 1 with a
real, database-backed Product CRUD system. Add / Edit / Delete now actually
persist.

## Files in this delivery

```
admin__2___fixed.html          ← updated admin panel (Add/Edit/Delete products work)
admin-routes.js                ← updated API routes (full product CRUD)
models/Product.js              ← NEW Mongoose model for the product catalog
scripts/migrate-products-to-db.js ← NEW one-time migration from data/products.js
```

## What changed

### 1. New `Product` model (`models/Product.js`)
A proper MongoDB collection for products, with fields: `slug` (used as the
public `id`), `name`, `cat`, `usd`, `oldUsd`, `badge`, `description`,
`delivery`, `stock`, `active`. Prices are stored in USD (same convention the
admin UI already used: PKR = USD × 278), so existing display math keeps
working unchanged.

### 2. New API endpoints (`admin-routes.js`)
```
GET    /api/admin/products        - now reads from MongoDB
                                     (falls back to the static data/products.js
                                     catalog, read-only, if the DB collection is empty)
POST   /api/admin/products        - create a new product
PATCH  /api/admin/products/:id    - update a product (by slug)
DELETE /api/admin/products/:id    - delete a product (by slug)
```
`GET /products` now returns a `source` field: `"db"` once migrated, or
`"static"` before migration.

### 3. Migration script (`scripts/migrate-products-to-db.js`)
Run once to copy your existing static catalog into MongoDB:
```bash
node scripts/migrate-products-to-db.js
```
- Safe to re-run — existing products (matched by slug) are skipped.
- Pass `--force` to overwrite DB entries with the static catalog values.
- Preserves each product's existing `id` as its slug, so any hardcoded
  storefront links keep working.

### 4. Admin panel (`admin__2___fixed.html`)

**Before migration runs** (DB collection empty, `source: "static"`):
- A yellow banner appears above the Products table explaining that the
  catalog is read-only until the migration script runs.
- "Add Product" shows a toast and does nothing.
- Editing a product opens it in **read-only** mode (no Delete button, Save
  is blocked with a toast).

**After migration runs** (`source: "db"`):
- Banner disappears.
- **Add Product** → `POST /api/admin/products` → row appears immediately.
- **Edit Product** → `PATCH /api/admin/products/:id` → all fields (including
  Stock, Description, Delivery, Active/Inactive) now save and reload.
- **Delete Product** → new trash-icon button in the edit modal footer →
  `DELETE /api/admin/products/:id` (with confirmation).
- The Products table now shows real **Stock** (in stock / out of stock) and
  real **Status** (Active / Inactive) instead of hardcoded placeholders.

## Deployment steps

```bash
# 1. Drop in the new/updated backend files
cp models/Product.js          <project>/models/Product.js
cp scripts/migrate-products-to-db.js <project>/scripts/migrate-products-to-db.js
cp admin-routes.js            <project>/routes/admin-routes.js   # (adjust path as needed)

# 2. Run the migration once
node scripts/migrate-products-to-db.js

# 3. Deploy the updated admin panel
cp admin__2___fixed.html       <project>/admin__2_.html   # or your serving path

# 4. Hard refresh the admin panel (Ctrl+Shift+R)
```

After step 2, the read-only banner disappears and full product CRUD is live.

## Notes / follow-ups

- **Storefront**: if your public storefront also reads from
  `data/products.js`, you'll want to point it at `GET /api/admin/products`
  (or a public equivalent) once migrated, so admin edits are reflected
  site-wide. This delivery only updates the admin-facing API and panel.
- **Stock tracking**: the new `stock` field is now editable per-product from
  the admin panel — this also unblocks the "low stock alerts" item from the
  Phase 1 recommendations whenever you're ready to build it.
- **Categories/badges**: both are constrained to the same enum values already
  used in the admin form's dropdowns, to keep data consistent.
