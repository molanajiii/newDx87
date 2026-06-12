'use strict';
const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const User    = require('../models/User');
const Coupon          = require('../models/Coupon');
const HomepageContent = require('../models/HomepageContent');
const StoreSettings   = require('../models/StoreSettings');
const GatewayConfig   = require('../models/GatewayConfig');
const Product         = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');
const { PRODUCTS } = require('../data/products');

router.use(protect, adminOnly);

// ── DASHBOARD STATS ──────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalOrders, completedOrders, pendingOrders, totalUsers] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'completed' }),
      Order.countDocuments({ status: 'pending' }),
      User.countDocuments(),
    ]);
    const revenueAgg = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalPKR' } } },
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const [todayOrders, newUsers] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
    ]);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1); twelveMonthsAgo.setHours(0,0,0,0);
    const monthlyRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$totalPKR' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    const paymentBreakdown = await Order.aggregate([
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, revenue: { $sum: '$totalPKR' } } },
      { $sort: { count: -1 } },
    ]);
    const dbProductCount = await Product.countDocuments();
    res.json({ success: true, stats: { totalOrders, completedOrders, pendingOrders, totalUsers, totalRevenue, todayOrders, newUsers, totalProducts: dbProductCount || PRODUCTS.length, monthlyRevenue, paymentBreakdown } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── ORDERS ───────────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { limit = 50, status, page = 1, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.$or = [{ orderId: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)).populate('user','name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, total, orders });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const { status, paymentStatus, notes, deliveryKey } = req.body;
    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (status)  order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (notes !== undefined) order.notes = notes;
    if (status === 'completed') order.deliveredAt = new Date();
    if (deliveryKey) order.items = order.items.map(item => ({ ...item.toObject(), deliveryKey }));
    await order.save();
    res.json({ success: true, order });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.id });
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    order.status = 'cancelled';
    await order.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── CUSTOMERS ────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { q, limit = 100, page = 1 } = req.query;
    const filter = {};
    if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);
    const userIds = users.map(u => u._id);
    const orderCounts = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 }, spent: { $sum: '$totalPKR' } } },
    ]);
    const countMap = {};
    orderCounts.forEach(o => { countMap[o._id.toString()] = { count: o.count, spent: o.spent }; });
    const enriched = users.map(u => ({ ...u.toObject(), orderCount: countMap[u._id.toString()]?.count || 0, totalSpent: countMap[u._id.toString()]?.spent || 0 }));
    res.json({ success: true, total, users: enriched });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const { role, suspended, banned } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (role      !== undefined) user.role      = role;
    if (suspended !== undefined) user.suspended = suspended;
    if (banned    !== undefined) user.banned    = banned;
    await user.save();
    res.json({ success: true, user: user.toSafe() });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/users/:id/orders', async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, orders });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
// Products now live in MongoDB (Product model). If the collection is empty
// (e.g. fresh install before running scripts/migrate-products-to-db.js), we
// fall back to the static catalog in data/products.js so the storefront and
// admin panel keep working during the transition.
router.get('/products', async (req, res) => {
  try {
    const { q, cat } = req.query;
    const filter = {};
    if (cat) filter.cat = cat;
    if (q)   filter.name = { $regex: q, $options: 'i' };

    const dbCount = await Product.countDocuments();
    if (dbCount === 0) {
      // Fallback: serve from the static catalog (read-only)
      let items = PRODUCTS;
      if (cat) items = items.filter(p => p.cat === cat);
      if (q)   items = items.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
      return res.json({ success: true, count: items.length, products: items, source: 'static' });
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, products: products.map(p => p.toJSON()), source: 'db' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/products', async (req, res) => {
  try {
    const { name, cat, price, sale, stock, badge, description, delivery, active } = req.body;
    if (!name)  return res.status(400).json({ success: false, error: 'name is required' });
    if (!cat)   return res.status(400).json({ success: false, error: 'cat is required' });
    if (price === undefined || price === null || price === '') {
      return res.status(400).json({ success: false, error: 'price is required' });
    }

    const RATE = 278; // PKR per USD — matches the conversion used in the admin UI
    const slug = await Product.uniqueSlug(name);

    const product = await Product.create({
      slug,
      name,
      cat,
      usd:    Number(price) / RATE,
      oldUsd: sale !== undefined && sale !== null && sale !== '' ? Number(sale) / RATE : null,
      badge:  badge || '',
      description: description || '',
      delivery: delivery || 'Instant',
      stock:  stock !== undefined && stock !== '' ? Number(stock) : 0,
      active: active === undefined ? true : !!active,
    });

    res.status(201).json({ success: true, product: product.toJSON() });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'A product with that name already exists' });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const { name, cat, price, sale, stock, badge, description, delivery, active } = req.body;
    const product = await Product.findOne({ slug: req.params.id });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const RATE = 278;
    if (name !== undefined)        product.name        = name;
    if (cat !== undefined)         product.cat         = cat;
    if (price !== undefined && price !== '')  product.usd    = Number(price) / RATE;
    if (sale !== undefined)        product.oldUsd      = (sale !== '' && sale !== null) ? Number(sale) / RATE : null;
    if (badge !== undefined)       product.badge       = badge;
    if (description !== undefined) product.description = description;
    if (delivery !== undefined)    product.delivery    = delivery;
    if (stock !== undefined && stock !== '')  product.stock  = Number(stock);
    if (active !== undefined)      product.active      = !!active;

    await product.save();
    res.json({ success: true, product: product.toJSON() });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const result = await Product.deleteOne({ slug: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── HOMEPAGE ──────────────────────────────────────────────────────────────────
router.get('/homepage', async (req, res) => {
  try {
    const doc = await HomepageContent.getSingleton();
    res.json({ success: true, content: { ...doc.toObject(), updatedAt: doc.updatedAt } });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/homepage', async (req, res) => {
  try {
    const { headline, sub, badge, ticker, banners } = req.body;
    const fields = {};
    if (headline !== undefined) fields.headline = headline;
    if (sub      !== undefined) fields.sub      = sub;
    if (badge    !== undefined) fields.badge    = badge;
    if (ticker   !== undefined) fields.ticker   = ticker;
    if (banners  !== undefined) fields.banners  = banners;
    const doc = await HomepageContent.updateContent(fields);
    res.json({ success: true, content: doc });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── COUPONS ───────────────────────────────────────────────────────────────────
router.get('/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/coupons', async (req, res) => {
  try {
    const { code, type, value, limit, expiry } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'code required' });
    const coupon = await Coupon.create({
      code:   code.toUpperCase().trim(),
      type,
      value:  +value,
      limit:  +limit || 0,
      expiry: expiry || null,
    });
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Code already exists' });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/coupons/:code', async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndUpdate(
      { code: req.params.code.toUpperCase() },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!coupon) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, coupon });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/coupons/:code', async (req, res) => {
  try {
    const result = await Coupon.deleteOne({ code: req.params.code.toUpperCase() });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── SETTINGS ──────────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const settings = await StoreSettings.getSingleton();
    res.json({ success: true, settings });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/settings', async (req, res) => {
  try {
    const settings = await StoreSettings.updateSettings(req.body);
    res.json({ success: true, settings });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── PASSWORD CHANGE ───────────────────────────────────────────────────────────
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ success: false, error: 'New password must be 8+ characters' });
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ success: false, error: 'Current password incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// ── GATEWAY CONFIG ────────────────────────────────────────────────────────────
router.get('/gateways', async (req, res) => {
  try {
    const doc = await GatewayConfig.getSingleton();
    res.json({ success: true, gateways: doc.toMap() });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.patch('/gateways/:id', async (req, res) => {
  try {
    const doc = await GatewayConfig.patchGateway(req.params.id, req.body);
    const updated = doc.gateways.find(g => g.id === req.params.id);
    res.json({ success: true, gateway: { enabled: updated.enabled, label: updated.label } });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
