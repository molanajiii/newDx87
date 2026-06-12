#!/usr/bin/env node
/**
 * scripts/migrate-products-to-db.js
 *
 * One-time migration: copies the static product catalog from
 * data/products.js into the new `Product` collection in MongoDB.
 *
 * Once this has run successfully, GET /api/admin/products (and the
 * storefront, if it's updated to read from the same source) will serve
 * products from the database, and the admin panel's Add/Edit/Delete
 * Product actions become fully functional.
 *
 * Usage:
 *   node scripts/migrate-products-to-db.js
 *
 * Safe to re-run — existing products (matched by slug) are skipped, never
 * duplicated. Use --force to overwrite existing DB entries with the static
 * catalog values instead.
 */

'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

const Product = require('../models/Product');
const { PRODUCTS } = require('../data/products');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌  MONGODB_URI not set in environment'); process.exit(1); }

const FORCE = process.argv.includes('--force');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB\n');

  if (!Array.isArray(PRODUCTS) || PRODUCTS.length === 0) {
    console.log('⚠️   data/products.js has no products — nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  let inserted = 0, updated = 0, skipped = 0, failed = 0;

  for (const p of PRODUCTS) {
    try {
      // Reuse the existing static `id` as the slug when present (keeps any
      // hardcoded links / cart references on the storefront working).
      // Otherwise derive a slug from the name.
      const slug = p.id ? Product.slugify(p.id) : await Product.uniqueSlug(p.name);

      const doc = {
        slug,
        name:        p.name,
        cat:         p.cat,
        usd:         p.usd,
        oldUsd:      p.oldUsd ?? null,
        badge:       p.badge || '',
        description: p.description || '',
        delivery:    p.delivery || 'Instant',
        stock:       p.stock ?? 0,
        active:      p.active === undefined ? true : !!p.active,
      };

      const existing = await Product.findOne({ slug });
      if (existing && !FORCE) {
        skipped++;
        continue;
      }
      if (existing && FORCE) {
        await Product.updateOne({ slug }, { $set: doc });
        updated++;
        continue;
      }
      await Product.create(doc);
      inserted++;
    } catch (err) {
      console.error(`   ✗ Failed to migrate "${p.name}":`, err.message);
      failed++;
    }
  }

  console.log(`Products  — ${inserted} inserted, ${updated} updated, ${skipped} skipped (already existed), ${failed} failed`);
  console.log(`\n🎉  Migration complete. Total products in DB: ${await Product.countDocuments()}`);
  console.log('\nGET /api/admin/products will now serve from MongoDB ("source":"db").');
  console.log('Admin panel Add / Edit / Delete Product actions are now live.');

  await mongoose.disconnect();
}

run().catch(err => { console.error('❌  Migration failed:', err.message); process.exit(1); });
