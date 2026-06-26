const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { Product } = require('../db');

// ── GET /api/products ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search, visible, page, limit } = req.query;
    const filter = {};

    if (visible === 'true')  filter.visible = true;
    if (visible === 'false') filter.visible = false;
    if (category) filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    if (search) {
      const q = new RegExp(search, 'i');
      filter.$or = [{ name: q }, { category: q }, { desc: q }, { sku: q }];
    }

    const total = await Product.countDocuments(filter);

    let query = Product.find(filter).sort({ id: 1 });
    if (page && limit) {
      const p = parseInt(page) || 1;
      const l = parseInt(limit) || 50;
      query = query.skip((p - 1) * l).limit(l);
      const products = await query.lean();
      return res.json({ products, total, page: p, limit: l, pages: Math.ceil(total / l) });
    }

    const products = await query.lean();
    res.json({ products, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/products/stats/summary ──────────────────────────────
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const products = await Product.find().lean();
    const summary = {
      total:      products.length,
      visible:    products.filter(p => p.visible).length,
      hidden:     products.filter(p => !p.visible).length,
      byCategory: {},
    };
    products.forEach(p => {
      summary.byCategory[p.category] = (summary.byCategory[p.category] || 0) + 1;
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/products/:id ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: parseInt(req.params.id) }).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/products ────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { name, category, img, imgData, desc, price, sku, visible } = req.body;
    if (!name || !name.trim())     return res.status(400).json({ error: 'Product name is required' });
    if (!category || !category.trim()) return res.status(400).json({ error: 'Category is required' });

    const last = await Product.findOne().sort({ id: -1 }).lean();
    const nextId = last ? last.id + 1 : 1;

    const product = await Product.create({
      id:        nextId,
      name:      name.trim(),
      category:  category.trim(),
      img:       img     || '',
      imgData:   imgData || null,
      desc:      desc    || '',
      price:     price   || '',
      sku:       sku     || '',
      visible:   visible !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/products/:id ─────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOne({ id: parseInt(req.params.id) });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, category, img, imgData, desc, price, sku, visible } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'Product name cannot be empty' });

    if (name      !== undefined) product.name      = name.trim();
    if (category  !== undefined) product.category  = category.trim();
    if (img       !== undefined) product.img       = img;
    if (imgData   !== undefined) product.imgData   = imgData;
    if (desc      !== undefined) product.desc      = desc;
    if (price     !== undefined) product.price     = price;
    if (sku       !== undefined) product.sku       = sku;
    if (visible   !== undefined) product.visible   = visible;
    product.updatedAt = new Date().toISOString();

    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/products/:id/visibility ───────────────────────────
router.patch('/:id/visibility', auth, async (req, res) => {
  try {
    const product = await Product.findOne({ id: parseInt(req.params.id) });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.visible   = !product.visible;
    product.updatedAt = new Date().toISOString();
    await product.save();

    res.json({ success: true, visible: product.visible });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/products/:id ──────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Product.deleteOne({ id: parseInt(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/products/bulk/import ───────────────────────────────
router.post('/bulk/import', auth, async (req, res) => {
  try {
    const { products: incoming } = req.body;
    if (!Array.isArray(incoming)) return res.status(400).json({ error: 'products must be an array' });

    const count = await Product.countDocuments();
    if (count > 0) return res.status(409).json({ error: 'Products already exist. Use /bulk/sync instead.' });

    const docs = incoming.map((p, i) => ({
      id:        i + 1,
      name:      p.name     || '',
      category:  p.category || '',
      img:       p.img      || '',
      imgData:   p.imgData  || null,
      desc:      p.desc     || '',
      price:     p.price    || '',
      sku:       p.sku      || '',
      visible:   p.visible  !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await Product.insertMany(docs);
    res.status(201).json({ success: true, imported: docs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/products/bulk/sync ──────────────────────────────────
router.post('/bulk/sync', auth, async (req, res) => {
  try {
    const { products: incoming } = req.body;
    if (!Array.isArray(incoming)) return res.status(400).json({ error: 'products must be an array' });

    const existing = await Product.find({}, { category: 1, img: 1 }).lean();
    const existingKeys = new Set(existing.map(p => `${p.category}|||${p.img}`));

    const last = await Product.findOne().sort({ id: -1 }).lean();
    let nextId = last ? last.id + 1 : 1;

    const toAdd = [];
    for (const p of incoming) {
      const key = `${p.category}|||${p.img}`;
      if (existingKeys.has(key)) continue;
      toAdd.push({
        id:        nextId++,
        name:      p.name     || '',
        category:  p.category || '',
        img:       p.img      || '',
        imgData:   p.imgData  || null,
        desc:      p.desc     || '',
        price:     p.price    || '',
        sku:       p.sku      || '',
        visible:   p.visible  !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      existingKeys.add(key);
    }

    if (toAdd.length > 0) await Product.insertMany(toAdd);
    const total = await Product.countDocuments();
    res.status(201).json({ success: true, added: toAdd.length, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
