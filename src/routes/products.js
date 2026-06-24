const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { readDB, writeDB } = require('../db');

// ── GET /api/products ─────────────────────────────────────────────
// Public — the website reads products from here
// Query params: ?category=Drinkware  ?search=mug  ?visible=true  ?page=1&limit=50
router.get('/', (req, res) => {
  const { category, search, visible, page, limit } = req.query;
  let { products } = readDB();

  // Filter visible (website always passes visible=true)
  if (visible === 'true')  products = products.filter(p => p.visible);
  if (visible === 'false') products = products.filter(p => !p.visible);

  // Filter by category
  if (category) products = products.filter(p =>
    p.category.toLowerCase() === category.toLowerCase()
  );

  // Search
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.desc  && p.desc.toLowerCase().includes(q)) ||
      (p.sku   && p.sku.toLowerCase().includes(q))
    );
  }

  // Pagination
  const total = products.length;
  if (page && limit) {
    const p = parseInt(page) || 1;
    const l = parseInt(limit) || 50;
    products = products.slice((p - 1) * l, p * l);
    return res.json({ products, total, page: p, limit: l, pages: Math.ceil(total / l) });
  }

  res.json({ products, total });
});

// ── GET /api/products/:id ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { products } = readDB();
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

// ── POST /api/products ────────────────────────────────────────────
// Protected — admin only
router.post('/', auth, (req, res) => {
  const { name, category, img, imgData, desc, price, sku, visible } = req.body;

  if (!name || !name.trim())
    return res.status(400).json({ error: 'Product name is required' });
  if (!category || !category.trim())
    return res.status(400).json({ error: 'Category is required' });

  const db = readDB();
  const newProduct = {
    id:       db.nextId++,
    name:     name.trim(),
    category: category.trim(),
    img:      img     || '',
    imgData:  imgData || null,
    desc:     desc    || '',
    price:    price   || '',
    sku:      sku     || '',
    visible:  visible !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.products.push(newProduct);
  writeDB(db);

  res.status(201).json({ success: true, product: newProduct });
});

// ── PUT /api/products/:id ─────────────────────────────────────────
// Protected — admin only
router.put('/:id', auth, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  const { name, category, img, imgData, desc, price, sku, visible } = req.body;

  if (name !== undefined && !name.trim())
    return res.status(400).json({ error: 'Product name cannot be empty' });

  const existing = db.products[idx];
  db.products[idx] = {
    ...existing,
    name:      name     !== undefined ? name.trim()     : existing.name,
    category:  category !== undefined ? category.trim() : existing.category,
    img:       img      !== undefined ? img             : existing.img,
    imgData:   imgData  !== undefined ? imgData         : existing.imgData,
    desc:      desc     !== undefined ? desc            : existing.desc,
    price:     price    !== undefined ? price           : existing.price,
    sku:       sku      !== undefined ? sku             : existing.sku,
    visible:   visible  !== undefined ? visible         : existing.visible,
    updatedAt: new Date().toISOString(),
  };

  writeDB(db);
  res.json({ success: true, product: db.products[idx] });
});

// ── PATCH /api/products/:id/visibility ───────────────────────────
// Toggle visible on/off
router.patch('/:id/visibility', auth, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  db.products[idx].visible   = !db.products[idx].visible;
  db.products[idx].updatedAt = new Date().toISOString();
  writeDB(db);

  res.json({ success: true, visible: db.products[idx].visible });
});

// ── DELETE /api/products/:id ──────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  const db = readDB();
  const idx = db.products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  db.products.splice(idx, 1);
  writeDB(db);

  res.json({ success: true, message: 'Product deleted' });
});

// ── POST /api/products/bulk/import ───────────────────────────────
// Bulk import — used on first run when DB is empty
router.post('/bulk/import', auth, (req, res) => {
  const { products: incoming } = req.body;
  if (!Array.isArray(incoming))
    return res.status(400).json({ error: 'products must be an array' });

  const db = readDB();

  // Only import if DB is empty (first-time migration)
  if (db.products.length > 0)
    return res.status(409).json({ error: 'Products already exist. Use /bulk/sync to add missing products.' });

  let nextId = db.nextId || 1;
  db.products = incoming.map(p => ({
    id:        nextId++,
    name:      p.name      || '',
    category:  p.category  || '',
    img:       p.img       || '',
    imgData:   p.imgData   || null,
    desc:      p.desc      || '',
    price:     p.price     || '',
    sku:       p.sku       || '',
    visible:   p.visible   !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  db.nextId = nextId;
  writeDB(db);

  res.status(201).json({ success: true, imported: db.products.length });
});

// ── POST /api/products/bulk/sync ──────────────────────────────────
// Sync — adds only products that don't already exist (by category+img)
// Safe to run multiple times — never duplicates, never deletes
router.post('/bulk/sync', auth, (req, res) => {
  const { products: incoming } = req.body;
  if (!Array.isArray(incoming))
    return res.status(400).json({ error: 'products must be an array' });

  const db = readDB();

  // Build a set of existing category+img combos
  const existing = new Set(db.products.map(p => `${p.category}|||${p.img}`));

  let added = 0;
  let nextId = db.nextId || (db.products.length + 1);

  for (const p of incoming) {
    const key = `${p.category}|||${p.img}`;
    if (existing.has(key)) continue; // already in DB — skip

    db.products.push({
      id:        nextId++,
      name:      p.name      || '',
      category:  p.category  || '',
      img:       p.img       || '',
      imgData:   p.imgData   || null,
      desc:      p.desc      || '',
      price:     p.price     || '',
      sku:       p.sku       || '',
      visible:   p.visible   !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    existing.add(key);
    added++;
  }

  db.nextId = nextId;
  writeDB(db);

  res.status(201).json({ success: true, added, total: db.products.length });
});

// ── GET /api/products/stats/summary ──────────────────────────────
router.get('/stats/summary', auth, (req, res) => {
  const { products } = readDB();
  const summary = {
    total:   products.length,
    visible: products.filter(p => p.visible).length,
    hidden:  products.filter(p => !p.visible).length,
    byCategory: {},
  };
  products.forEach(p => {
    summary.byCategory[p.category] = (summary.byCategory[p.category] || 0) + 1;
  });
  res.json(summary);
});

module.exports = router;
