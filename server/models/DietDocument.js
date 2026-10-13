const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  index: { type: Number, required: true }
  // No embedding field — retrieval uses TF-IDF (zero API calls required)
}, { _id: false });

const dietDocumentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'txt'], required: true },
  extractedPreview: { type: String, default: '' },
  chunks: [chunkSchema],
  uploadedAt: { type: Date, default: Date.now }
});

dietDocumentSchema.index({ userId: 1 });

module.exports = mongoose.model('DietDocument', dietDocumentSchema);
