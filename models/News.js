const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  src: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: 'News'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('News', newsSchema);


