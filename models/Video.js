const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  filename: {
    type: String
  },
  src: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: 'Video'
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  externalUrl: {
    type: String
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Video', videoSchema);


