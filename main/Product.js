'use strict';
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Stable slug-like id used by the storefront (kept for backward-compat with
  // the old static data/products.js entries — e.g. "fifa-25-key").
  // If not provided on creation, one is generated from the name.
  slug:        { type: String, required: true, unique: true, trim: true },

  name:        { type: String, required: true, trim: true },
  cat:         {
    type: String,
    required: true,
    enum: ['Games', 'Gift Cards', 'Software', 'AI Tools', 'Subscriptions', 'Top Up', 'Game Items', 'Accounts'],
  },

  // Prices are stored in USD (matches the historical static catalog, which
  // the storefront multiplies by the PKR conversion rate for display).
  usd:         { type: Number, required: true, min: 0 },
  oldUsd:      { type: Number, default: null, min: 0 }, // original/"was" price for sale display

  badge:       { type: String, default: '', enum: ['', 'HOT', 'NEW', 'SALE', 'BEST', 'RARE'] },
  description: { type: String, default: '' },
  delivery:    { type: String, enum: ['Instant', 'Manual'], default: 'Instant' },
  stock:       { type: Number, default: 0, min: 0 },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

// Expose `id` (slug) instead of Mongo's _id when serialized to JSON, to stay
// compatible with the existing admin UI which keys rows by `p.id`.
productSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret.slug;
    delete ret._id;
    delete ret.__v;
    delete ret.slug;
    return ret;
  },
});
productSchema.set('toObject', {
  virtuals: true,
  transform(doc, ret) {
    ret.id = ret.slug;
    delete ret._id;
    delete ret.__v;
    delete ret.slug;
    return ret;
  },
});

// Helper to slugify a product name into an id, e.g. "FIFA 25 Key" -> "fifa-25-key"
productSchema.statics.slugify = function (name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Generate a unique slug, appending -2, -3, ... if needed
productSchema.statics.uniqueSlug = async function (name) {
  const base = this.slugify(name) || 'product';
  let slug = base;
  let i = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await this.exists({ slug })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
};

module.exports = mongoose.model('Product', productSchema);
