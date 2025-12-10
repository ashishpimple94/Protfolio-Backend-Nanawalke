const mongoose = require('mongoose');

const portfolioSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  colors: {
    primary: { type: String, default: '#4361ee' },
    secondary: { type: String, default: '#7209b7' },
    accent: { type: String, default: '#f72585' },
    background: { type: String, default: '#ffffff' },
    text: { type: String, default: '#1e293b' },
    cardBg: { type: String, default: '#f8fafc' }
  },
  fonts: {
    heading: { type: String, default: 'Inter' },
    body: { type: String, default: 'Inter' },
    size: { type: String, default: 'medium' }
  },
  layout: {
    headerStyle: { type: String, default: 'modern' },
    cardStyle: { type: String, default: 'rounded' },
    spacing: { type: String, default: 'comfortable' },
    borderRadius: { type: String, default: 'medium' },
    shadowIntensity: { type: String, default: 'medium' }
  },
  effects: {
    backgroundType: { type: String, default: 'solid' },
    backgroundGradient: { type: String, default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    backgroundPattern: { type: String, default: 'none' },
    hoverEffect: { type: String, default: 'none' },
    transition: { type: String, default: 'smooth' }
  },
  buttons: {
    style: { type: String, default: 'rounded' },
    size: { type: String, default: 'medium' },
    effect: { type: String, default: 'shadow' }
  },
  profileImage: {
    shape: { type: String, default: 'circle' },
    size: { type: String, default: 'large' },
    border: { type: String, default: 'gradient' },
    borderWidth: { type: String, default: 'medium' },
    shadow: { type: String, default: 'medium' },
    animation: { type: String, default: 'none' }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PortfolioSettings', portfolioSettingsSchema);
