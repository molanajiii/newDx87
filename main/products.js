'use strict';
/**
 * routes/products.js
 *
 * Public, read-only product catalog API for the storefront.
 *
 * Mount this WITHOUT the admin auth middleware, e.g. in your main server
 * file:
 *
 *   const productsRouter = require('./routes/products');
 *   app.use('/api/products', productsRouter);
 *
 * Mirrors the same DB-with-fallback behaviour as
 * GET /api/admin/products: once the Product collection has been migrated
 * (see scripts/migrate-products-to-db.js), this serves live data with
 * "source": "db". Until then it falls back to the static
 * data/products.js catalog with "source": "static", so the storefront
 * never has to show an empty page.
 *
 * Only ACTIVE products are returned here (admin can still see inactive
 * products via /api/admin/products — this route is customer-facing).
 *
 * Routes:
 *   GET /api/products            - list (optional ?cat=, ?q=)
 *   GET /api/products/:id        - single product by slug/id (for the
 *                                   future product-detail page)
 */
const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');
const { PRODUCTS } = require('../data/products');

// Shared helper — returns only active products, DB if migrated, else static.
async function getActiveProducts() {
  const dbCount = await Product.countDocuments();
  if (dbCount > 0) {
    const docs = await Product.find({ active: true }).sort({ createdAt: -1 });
    return { items: docs.map(d => d.toObject()), source: 'db' };
  }
  // Static catalog: treat missing `active` as active (matches the admin
  // route's assumption that legacy static entries are live).
  const items = PRODUCTS.filter(p => p.active !== false);
  return { items, source: 'static' };
}

// GET /api/products?cat=Games&q=fifa
router.get('/', async (req, res) => {
  try {
    const { q, cat } = req.query;
    let { items, source } = await getActiveProducts();

    if (cat) items = items.filter(p => p.cat === cat);
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(needle));
    }

    res.json({ success: true, count: items.length, source, products: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:id  (slug, e.g. "fifa-25-key")
router.get('/:id', async (req, res) => {
  try {
    const { items, source } = await getActiveProducts();
    const product = items.find(p => p.id === req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, source, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
