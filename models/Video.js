const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for backward compatibility
  },
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
  description: {
    type: String,
    default: ''
  },
  tags: [{
    type: String
  }],
  category: {
    type: String,
    default: 'videos'
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