'use strict';
const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  text:    { type: String, default: '' },
  enabled: { type: Boolean, default: true },
}, { _id: false });

const homepageSchema = new mongoose.Schema({
  // Singleton: always upsert the doc with _singleton: 'homepage'
  _singleton: { type: String, default: 'homepage', immutable: true },
  headline:   { type: String, default: "Pakistan's #1 Digital Marketplace" },
  sub:        { type: String, default: 'Instant delivery on game keys, subscriptions, AI tools & more.' },
  badge:      { type: String, default: '🔥 Flash Sale Active' },
  ticker:     { type: String, default: '🎮 FIFA 25 keys now available · 🚀 ChatGPT Plus back in stock' },
  banners:    { type: [bannerSchema], default: [] },
}, { timestamps: true });

// Convenience static: get-or-create the singleton
homepageSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ _singleton: 'homepage' });
  if (!doc) doc = await this.create({});
  return doc;
};

// Convenience static: update and return
homepageSchema.statics.updateContent = async function (fields) {
  const doc = await this.findOneAndUpdate(
    { _singleton: 'homepage' },
    { $set: fields },
    { new: true, upsert: true, runValidators: true }
  );
  return doc;
};

module.exports = mongoose.model('HomepageContent', homepageSchema);
