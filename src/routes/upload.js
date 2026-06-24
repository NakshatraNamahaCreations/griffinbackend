const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const auth    = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer config — store with original name + timestamp
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|svg/i;
  if (allowed.test(path.extname(file.originalname)) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// POST /api/upload/image  — upload a single product image
router.post('/image', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({
    success:  true,
    filename: req.file.filename,
    url:      imageUrl,
    fullUrl:  `http://localhost:${process.env.PORT || 4000}${imageUrl}`,
    size:     req.file.size,
  });
});

// DELETE /api/upload/image/:filename
router.delete('/image/:filename', auth, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: 'File not found' });

  fs.unlinkSync(filePath);
  res.json({ success: true, message: 'File deleted' });
});

module.exports = router;
