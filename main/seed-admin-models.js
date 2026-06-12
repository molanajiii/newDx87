#!/usr/bin/env node
/**
 * scripts/seed-admin-models.js
 *
 * One-time migration: populates Coupon, HomepageContent, StoreSettings, and
 * GatewayConfig collections from the hard-coded defaults that used to live in
 * admin-routes.js memory.
 *
 * Usage:
 *   node scripts/seed-admin-models.js
 *
 * Safe to re-run — uses upserts, never duplicates.
 */

'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

const Coupon          = require('../models/Coupon');
const HomepageContent = require('../models/HomepageContent');
const StoreSettings   = require('../models/StoreSettings');
const GatewayConfig   = require('../models/GatewayConfig');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('❌  MONGODB_URI not set in environment'); process.exit(1); }

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB\n');

  // ── Coupons ────────────────────────────────────────────────────────────────
  const defaultCoupons = [
    { code: 'LAUNCH20', type: 'percent', value: 20, uses: 0, limit: 100, expiry: null, active: true },
    { code: 'FLAT500',  type: 'fixed',   value: 500, uses: 3, limit: 50,  expiry: null, active: true },
  ];
  let cpnNew = 0;
  for (const c of defaultCoupons) {
    const exists = await Coupon.findOne({ code: c.code });
    if (!exists) { await Coupon.create(c); cpnNew++; }
  }
  console.log(`Coupons   — ${cpnNew} inserted, ${defaultCoupons.length - cpnNew} already existed`);

  // ── HomepageContent ────────────────────────────────────────────────────────
  const hp = await HomepageContent.getSingleton();
  console.log(`Homepage  — singleton ready (updatedAt: ${hp.updatedAt || 'default'})`);

  // ── StoreSettings ──────────────────────────────────────────────────────────
  const st = await StoreSettings.getSingleton();
  console.log(`Settings  — singleton ready (store: ${st.storeName})`);

  // ── GatewayConfig ──────────────────────────────────────────────────────────
  const gw = await GatewayConfig.getSingleton();
  console.log(`Gateways  — ${gw.gateways.length} gateways ready`);

  console.log('\n🎉  Seed complete. All admin data is now persisted in MongoDB.');
  await mongoose.disconnect();
}

run().catch(err => { console.error('❌  Seed failed:', err.message); process.exit(1); });
