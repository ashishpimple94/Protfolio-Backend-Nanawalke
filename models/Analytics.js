const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: ['file_upload', 'file_delete', 'suggestion_submit', 'admin_message', 'page_view']
  },
  fileName: {
    type: String
  },
  fileType: {
    type: String
  },
  category: {
    type: String
  },
  userId: {
    type: String
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Analytics', analyticsSchema);