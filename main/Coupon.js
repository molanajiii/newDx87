'use strict';
const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code:    { type: String, required: true, unique: true, uppercase: true, trim: true },
  type:    { type: String, enum: ['percent', 'fixed'], required: true },
  value:   { type: Number, required: true, min: 0 },
  uses:    { type: Number, default: 0, min: 0 },
  limit:   { type: Number, default: 0 },   // 0 = unlimited
  expiry:  { type: Date,   default: null },
  active:  { type: Boolean, default: true },
}, { timestamps: true });

// Enforce limit when redeeming
couponSchema.methods.canRedeem = function () {
  if (!this.active) return false;
  if (this.expiry && new Date() > this.expiry) return false;
  if (this.limit > 0 && this.uses >= this.limit) return false;
  return true;
};

module.exports = mongoose.model('Coupon', couponSchema);
