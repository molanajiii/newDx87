'use strict';
const mongoose = require('mongoose');

// One sub-document per gateway
const gatewaySchema = new mongoose.Schema({
  id:      { type: String, required: true },   // e.g. 'stripe'
  label:   { type: String, required: true },   // e.g. 'Stripe'
  enabled: { type: Boolean, default: false },
  // Extend here when you add live credentials: publicKey, webhookSecret, etc.
}, { _id: false });

const gatewayConfigSchema = new mongoose.Schema({
  _singleton: { type: String, default: 'gateways', immutable: true },
  gateways:   {
    type: [gatewaySchema],
    default: [
      { id: 'stripe',    label: 'Stripe',       enabled: true  },
      { id: 'jazzcash',  label: 'JazzCash',     enabled: true  },
      { id: 'easypaisa', label: 'EasyPaisa',    enabled: true  },
      { id: 'alfalah',   label: 'Bank Alfalah', enabled: false },
      { id: 'meezan',    label: 'Meezan IBAN',  enabled: false },
    ],
  },
}, { timestamps: true });

// Return gateways as the flat object the admin panel expects { stripe:{…}, jazzcash:{…} }
gatewayConfigSchema.methods.toMap = function () {
  return this.gateways.reduce((acc, gw) => {
    acc[gw.id] = { enabled: gw.enabled, label: gw.label };
    return acc;
  }, {});
};

gatewayConfigSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ _singleton: 'gateways' });
  if (!doc) doc = await this.create({});
  return doc;
};

// Toggle / update a single gateway by id
gatewayConfigSchema.statics.patchGateway = async function (gwId, fields) {
  // Use positional operator to update just the matching sub-doc
  const update = {};
  for (const [k, v] of Object.entries(fields)) {
    update[`gateways.$.${k}`] = v;
  }
  const doc = await this.findOneAndUpdate(
    { _singleton: 'gateways', 'gateways.id': gwId },
    { $set: update },
    { new: true }
  );
  if (!doc) throw new Error(`Gateway '${gwId}' not found`);
  return doc;
};

module.exports = mongoose.model('GatewayConfig', gatewayConfigSchema);
