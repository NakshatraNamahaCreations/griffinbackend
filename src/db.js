const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id:        { type: Number, unique: true },
  name:      { type: String, required: true },
  category:  { type: String, required: true },
  img:       { type: String, default: '' },
  imgData:   { type: String, default: null },
  desc:      { type: String, default: '' },
  price:     { type: String, default: '' },
  sku:       { type: String, default: '' },
  visible:   { type: Boolean, default: true },
  createdAt: { type: String },
  updatedAt: { type: String },
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
}

module.exports = { connectDB, Product };
