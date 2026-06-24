const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/products.json');

// Ensure data file exists
function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ products: [], nextId: 1 }, null, 2));
  }
}

function readDB() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB };
