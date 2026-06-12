'use strict';
const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema({
  _singleton:          { type: String, default: 'settings', immutable: true },
  storeName:           { type: String, default: 'PlayBeat Digital' },
  domain:              { type: String, default: 'playbeat.digital' },
  supportEmail:        { type: String, default: 'support@playbeat.digital' },
  whatsapp:            { type: String, default: '+923390005715' },
  telegram:            { type: String, default: '@pbeatdigi' },
  currency:            { type: String, default: 'PKR' },
  timezone:            { type: String, default: 'Asia/Karachi' },
  instantDelivery:     { type: Boolean, default: true },
  manualDeliverySLA:   { type: String, default: '2 hours' },
  lowStockThreshold:   { type: Number, default: 10 },
  refundWindow:        { type: String, default: '24 hours' },
}, { timestamps: true });

storeSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ _singleton: 'settings' });
  if (!doc) doc = await this.create({});
  return doc;
};

storeSettingsSchema.statics.updateSettings = async function (fields) {
  // Strip protected fields just in case
  const safe = { ...fields };
  delete safe._singleton; delete safe._id; delete safe.__v;
  return this.findOneAndUpdate(
    { _singleton: 'settings' },
    { $set: safe },
    { new: true, upsert: true, runValidators: true }
  );
};

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
