const express = require('express');
const router  = express.Router();
const { readDB } = require('../db');

const CATEGORIES = [
  { id: 'Apparel',                 label: 'Apparel',               icon: 'shirt' },
  { id: 'Dinner Sets',             label: 'Dinner Sets',           icon: 'utensils' },
  { id: 'Drinkware',               label: 'Drinkware',             icon: 'coffee' },
  { id: 'Eco Friendly Products',   label: 'Eco Friendly Products', icon: 'leaf' },
  { id: 'Festive Collection',      label: 'Festive Collection',    icon: 'gift' },
  { id: 'Gadgets',                 label: 'Gadgets',               icon: 'smartphone' },
  { id: 'Joining Kit New',         label: 'Joining Kits',          icon: 'package' },
  { id: 'Kitchen Appliances',      label: 'Kitchen Appliances',    icon: 'layers' },
  { id: 'Rewards and Recognition', label: 'Rewards & Recognition', icon: 'award' },
  { id: 'Workspace Essentials',    label: 'Workspace Essentials',  icon: 'briefcase' },
];

// GET /api/categories — list all categories with product counts
router.get('/', (req, res) => {
  const { products } = readDB();
  const withCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: products.filter(p => p.category === cat.id && p.visible).length,
    total: products.filter(p => p.category === cat.id).length,
  }));
  res.json({ categories: withCounts });
});

module.exports = router;
