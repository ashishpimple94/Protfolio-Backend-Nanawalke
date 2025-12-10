const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    default: ''
  },
  designation: {
    type: String,
    default: ''
  },
  organization: {
    type: String,
    default: ''
  },
  profileImage: {
    type: String,
    default: 'https://i.pinimg.com/280x280_RS/79/64/38/796438e5f83630a7d76c63661b857ee5.jpg'
  },
  aboutMe: {
    type: String,
    default: ''
  },
  portfolioSlug: {
    type: String,
    required: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate portfolio slug from name if not provided
userSchema.pre('save', function(next) {
  if (!this.portfolioSlug && this.name) {
    this.portfolioSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
