const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { Server } = require('socket.io');
const http = require('http');

const Photo = require('./models/Photo');
const News = require('./models/News');
const Video = require('./models/Video');
const Suggestion = require('./models/Suggestion');
const AdminMessage = require('./models/AdminMessage');
const User = require('./models/User');
const Poll = require('./models/Poll');
const PortfolioSettings = require('./models/PortfolioSettings');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;
const USE_CLOUD_UPLOADS = process.env.USE_CLOUD_UPLOADS === 'true' || !!process.env.VERCEL;
const isDbConnected = () => mongoose.connection && mongoose.connection.readyState === 1;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:Test12345@clusteradmin.qrlarug.mongodb.net/portfolio?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
});

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for network access
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Create uploads directories if they don't exist (used in local mode)
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
const videosDir = path.join(uploadsDir, 'videos');
const newsDir = path.join(uploadsDir, 'news');

if (!USE_CLOUD_UPLOADS) {
  [photosDir, videosDir, newsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Serve static files from uploads directory (local mode only)
if (!USE_CLOUD_UPLOADS) {
  app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
}

// Configure Cloudinary (cloud mode)
if (USE_CLOUD_UPLOADS) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ url: process.env.CLOUDINARY_URL });
  } else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', db: isDbConnected() ? 'connected' : 'disconnected' });
});

// ============ USER MANAGEMENT ROUTES ============

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json([]);
    }
    const users = await User.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Get user by ID or slug
app.get('/api/users/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Try to find by ID first, then by slug
    let user = await User.findById(identifier).catch(() => null);
    if (!user) {
      user = await User.findOne({ portfolioSlug: identifier, isActive: true });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, phone, address, designation, organization, profileImage, aboutMe, portfolioSlug } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      address: address || '',
      designation: designation || '',
      organization: organization || '',
      profileImage: profileImage || 'https://i.pinimg.com/280x280_RS/79/64/38/796438e5f83630a7d76c63661b857ee5.jpg',
      aboutMe: aboutMe || '',
      portfolioSlug: portfolioSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    });
    
    // Emit event for real-time notification
    io.emit('userCreated', {
      userId: user._id,
      name: user.name,
      portfolioSlug: user.portfolioSlug
    });
    
    res.json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email or portfolio slug already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, designation, organization, profileImage, aboutMe, portfolioSlug, isActive } = req.body;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (designation !== undefined) updateData.designation = designation;
    if (organization !== undefined) updateData.organization = organization;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (aboutMe !== undefined) updateData.aboutMe = aboutMe;
    if (portfolioSlug !== undefined) updateData.portfolioSlug = portfolioSlug;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = Date.now();
    
    const user = await User.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Emit event for real-time notification
    io.emit('userUpdated', {
      userId: user._id,
      name: user.name,
      portfolioSlug: user.portfolioSlug
    });
    
    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (soft delete)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Emit event for real-time notification
    io.emit('userDeleted', {
      userId: user._id,
      name: user.name
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ USER PORTFOLIO ROUTES ============

// Get user's portfolio data (by userId or slug)
app.get('/api/portfolio/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Find user by ID or slug
    let user = await User.findById(identifier).catch(() => null);
    if (!user) {
      user = await User.findOne({ portfolioSlug: identifier, isActive: true });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Get user's content
    const [photos, news, videos, adminMessage] = await Promise.all([
      Photo.find({ userId: user._id }).sort({ uploadedAt: -1 }),
      News.find({ userId: user._id }).sort({ uploadedAt: -1 }),
      Video.find({ userId: user._id }).sort({ uploadedAt: -1 }),
      AdminMessage.findOne({ isActive: true }).sort({ createdAt: -1 })
    ]);
    
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        designation: user.designation,
        organization: user.organization,
        profileImage: user.profileImage,
        aboutMe: user.aboutMe,
        portfolioSlug: user.portfolioSlug
      },
      photos: photos.map((photo) => ({
        id: photo._id,
        src: photo.src,
        filename: photo.filename,
        title: photo.title,
        description: photo.description,
        tags: photo.tags,
        category: photo.category,
        uploadedAt: photo.uploadedAt
      })),
      news: news.map((item) => ({
        id: item._id,
        title: item.title,
        src: item.src,
        filename: item.filename,
        description: item.description,
        tags: item.tags,
        category: item.category,
        uploadedAt: item.uploadedAt
      })),
      videos: videos.map((video) => ({
        id: video._id,
        title: video.title,
        src: video.src,
        filename: video.filename,
        description: video.description,
        tags: video.tags,
        category: video.category,
        isExternal: video.isExternal,
        externalUrl: video.externalUrl,
        uploadedAt: video.uploadedAt
      })),
      adminMessage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configure multer for file uploads
const storage = USE_CLOUD_UPLOADS
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const type = req.body.type || 'photos';
        let uploadPath;
        if (type === 'photos') uploadPath = photosDir;
        else if (type === 'videos') uploadPath = videosDir;
        else if (type === 'news') uploadPath = newsDir;
        else uploadPath = photosDir;
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const type = req.body.type || 'photos';
    
    if (type === 'videos') {
      const allowedTypes = /mp4|mov|avi|wmv|flv|webm/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only video files are allowed!'));
      }
    } else {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      
      if (mimetype && extname) {
        return cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'));
      }
    }
  }
});

const extractYouTubeId = (url) => {
  try {
    let finalUrl = url.trim();
    // Auto-add protocol if missing (e.g. youtu.be/.... or youtube.com/...)
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    const parsedUrl = new URL(finalUrl);
    if (parsedUrl.hostname.includes('youtu.be')) {
      return parsedUrl.pathname.replace('/', '');
    }
    if (parsedUrl.hostname.includes('youtube.com')) {
      return parsedUrl.searchParams.get('v');
    }
    return null;
  } catch (error) {
    return null;
  }
};

const buildYouTubeEmbedUrl = (videoId) => {
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
};

// Get all photos
app.get('/api/photos', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json([]);
    }
    const photos = await Photo.find().sort({ uploadedAt: -1 });
    const formattedPhotos = photos.map((photo, index) => ({
      id: photo._id,
      src: photo.src,
      filename: photo.filename,
      title: photo.title,
      description: photo.description,
      tags: photo.tags,
      category: photo.category,
      uploadedAt: photo.uploadedAt
    }));
    res.json(formattedPhotos);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching photos' });
  }
});

// Get all news
app.get('/api/news', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json([]);
    }
    const news = await News.find().sort({ uploadedAt: -1 });
    const formattedNews = news.map((item, index) => ({
      id: item._id,
      title: item.title || `News ${index + 1}`,
      src: item.src,
      filename: item.filename,
      description: item.description,
      tags: item.tags,
      category: item.category,
      uploadedAt: item.uploadedAt
    }));
    res.json(formattedNews);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching news' });
  }
});

// Get all videos
app.get('/api/videos', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json([]);
    }
    const videos = await Video.find().sort({ uploadedAt: -1 });
    const formattedVideos = videos.map((video, index) => ({
      id: video._id,
      title: video.title || `Video ${index + 1}`,
      src: video.src,
      filename: video.filename,
      description: video.description,
      tags: video.tags,
      category: video.category,
      isExternal: video.isExternal,
      externalUrl: video.externalUrl,
      uploadedAt: video.uploadedAt
    }));
    res.json(formattedVideos);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching videos' });
  }
});

// Upload file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const type = req.body.type;
    const userId = req.body.userId; // Get userId from request
    const title = req.body.title || (type === 'news' ? 'News' : type === 'videos' ? 'Video' : 'Untitled');
    const description = req.body.description || '';
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const category = req.body.category || (type === 'news' ? 'news' : type === 'videos' ? 'videos' : 'general');
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    if (USE_CLOUD_UPLOADS) {
      const folder = `uploads/${type || 'photos'}`;
      const resourceType = type === 'videos' ? 'video' : 'image';

      const streamResult = await new Promise((resolve, reject) => {
        const uploadOptions = { folder, resource_type: resourceType };
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
        stream.end(req.file.buffer);
      });

      let savedItem;
      if (type === 'photos') {
        savedItem = await Photo.create({ 
          userId: userId || null,
          filename: streamResult.public_id, 
          src: streamResult.secure_url,
          title,
          description,
          tags,
          category
        });
      } else if (type === 'news') {
        savedItem = await News.create({ 
          userId: userId || null,
          filename: streamResult.public_id, 
          src: streamResult.secure_url, 
          title,
          description,
          tags,
          category
        });
      } else if (type === 'videos') {
        savedItem = await Video.create({ 
          userId: userId || null,
          filename: streamResult.public_id, 
          src: streamResult.secure_url, 
          title,
          description,
          tags,
          category,
          isExternal: false 
        });
      }

      // Emit event for real-time notification
      io.emit('fileUploaded', {
        type,
        userId: userId || null,
        title: savedItem.title,
        filename: savedItem.filename,
        category: savedItem.category
      });

      return res.json({
        message: 'File uploaded successfully',
        file: { 
          id: savedItem._id, 
          filename: savedItem.filename, 
          url: savedItem.src, 
          type,
          userId: savedItem.userId,
          title: savedItem.title,
          description: savedItem.description,
          tags: savedItem.tags,
          category: savedItem.category
        }
      });
    } else {
      const fileUrl = `/uploads/${req.body.type}/${req.file.filename}`;
      let savedItem;
      if (type === 'photos') {
        savedItem = await Photo.create({ 
          userId: userId || null,
          filename: req.file.filename, 
          src: fileUrl,
          title,
          description,
          tags,
          category
        });
      } else if (type === 'news') {
        savedItem = await News.create({ 
          userId: userId || null,
          filename: req.file.filename, 
          src: fileUrl, 
          title,
          description,
          tags,
          category
        });
      } else if (type === 'videos') {
        savedItem = await Video.create({ 
          userId: userId || null,
          filename: req.file.filename, 
          src: fileUrl, 
          title,
          description,
          tags,
          category,
          isExternal: false 
        });
      }
      
      // Emit event for real-time notification
      io.emit('fileUploaded', {
        type,
        userId: userId || null,
        title: savedItem.title,
        filename: savedItem.filename,
        category: savedItem.category
      });

      return res.json({
        message: 'File uploaded successfully',
        file: { 
          id: savedItem._id, 
          filename: req.file.filename, 
          url: fileUrl, 
          type,
          userId: savedItem.userId,
          title: savedItem.title,
          description: savedItem.description,
          tags: savedItem.tags,
          category: savedItem.category
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add YouTube video link
app.post('/api/videos/youtube', async (req, res) => {
  try {
    const { url, title, description, tags, category, userId } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const videoId = extractYouTubeId(url.trim());
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const embedUrl = buildYouTubeEmbedUrl(videoId);
    const filename = `youtube-${videoId}-${Date.now()}`;

    const video = await Video.create({
      userId: userId || null,
      filename,
      src: embedUrl,
      title: title && title.trim() ? title.trim() : 'YouTube Video',
      description: description || '',
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
      category: category || 'videos',
      isExternal: true,
      externalUrl: url.trim()
    });

    // Emit event for real-time notification
    io.emit('fileUploaded', {
      type: 'videos',
      userId: userId || null,
      title: video.title,
      filename: video.filename,
      category: video.category,
      isExternal: true
    });

    res.json({
      message: 'YouTube video added successfully',
      video: {
        id: video._id,
        userId: video.userId,
        filename: video.filename,
        src: video.src,
        title: video.title,
        description: video.description,
        tags: video.tags,
        category: video.category,
        isExternal: video.isExternal,
        externalUrl: video.externalUrl
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file
app.delete('/api/delete/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    let item;
    if (type === 'photos') item = await Photo.findOne({ filename });
    else if (type === 'videos') item = await Video.findOne({ filename });
    else if (type === 'news') item = await News.findOne({ filename });
    else return res.status(400).json({ error: 'Invalid type' });

    if (!item) return res.status(404).json({ error: 'File not found in database' });

    if (USE_CLOUD_UPLOADS && item.src && item.src.includes('res.cloudinary.com')) {
      const resourceType = type === 'videos' ? 'video' : 'image';
      await cloudinary.uploader.destroy(item.filename, { resource_type: resourceType });
    } else {
      const filePath = path.join(type === 'photos' ? photosDir : type === 'videos' ? videosDir : newsDir, item.filename);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (type === 'photos') await Photo.deleteOne({ _id: item._id });
    else if (type === 'videos') await Video.deleteOne({ _id: item._id });
    else if (type === 'news') await News.deleteOne({ _id: item._id });

    // Emit event for real-time notification
    io.emit('fileDeleted', {
      type,
      filename: item.filename,
      title: item.title
    });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all suggestions
app.get('/api/suggestions', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json([]);
    }
    const suggestions = await Suggestion.find().populate('userId', 'name email portfolioSlug').sort({ submittedAt: -1 });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching suggestions' });
  }
});

// Submit suggestion
app.post('/api/suggestions', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    console.log('📥 Received suggestion:', { message, userId });
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Create suggestion with userId if provided
    const suggestionData = {
      message: message.trim()
    };
    
    if (userId) {
      console.log('✅ Adding userId to suggestion:', userId);
      suggestionData.userId = userId;
    } else {
      console.log('⚠️ No userId provided - creating anonymous suggestion');
    }
    
    const suggestion = await Suggestion.create(suggestionData);
    console.log('💾 Suggestion created:', suggestion);
    
    // Populate user data for real-time notification
    const populatedSuggestion = await Suggestion.findById(suggestion._id)
      .populate('userId', 'name email portfolioSlug');
    
    console.log('👤 Populated suggestion:', populatedSuggestion);
    
    // Emit event for real-time notification
    io.emit('newSuggestion', {
      message: populatedSuggestion.message,
      userId: populatedSuggestion.userId,
      submittedAt: populatedSuggestion.submittedAt
    });
    
    res.json({ 
      message: 'Suggestion submitted successfully',
      id: suggestion._id,
      suggestion: populatedSuggestion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active admin message
app.get('/api/admin-message', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json(null);
    }
    const adminMessage = await AdminMessage.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (adminMessage) {
      res.json(adminMessage);
    } else {
      res.json(null);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error fetching admin message' });
  }
});

// Create/Update admin message
app.post('/api/admin-message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Deactivate all previous messages
    await AdminMessage.updateMany({}, { isActive: false });
    
    // Create new active message
    const adminMessage = await AdminMessage.create({
      message: message.trim(),
      isActive: true
    });
    
    // Emit event for real-time notification
    io.emit('adminMessageUpdated', {
      message: adminMessage.message,
      createdAt: adminMessage.createdAt
    });
    
    res.json({ 
      message: 'Admin message created successfully',
      id: adminMessage._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all admin messages
app.get('/api/admin-messages', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json([]);
    }
    const messages = await AdminMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching admin messages' });
  }
});

// ============ PORTFOLIO SETTINGS ROUTES ============

// Get portfolio settings for a user
app.get('/api/portfolio-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    let settings = await PortfolioSettings.findOne({ userId });
    
    // If no settings exist, return default settings
    if (!settings) {
      return res.json({
        colors: {
          primary: '#4361ee',
          secondary: '#7209b7',
          accent: '#f72585',
          background: '#ffffff',
          text: '#1e293b',
          cardBg: '#f8fafc'
        },
        fonts: {
          heading: 'Inter',
          body: 'Inter',
          size: 'medium'
        },
        layout: {
          headerStyle: 'modern',
          cardStyle: 'rounded',
          spacing: 'comfortable',
          borderRadius: 'medium',
          shadowIntensity: 'medium'
        },
        effects: {
          backgroundType: 'solid',
          backgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundPattern: 'none',
          hoverEffect: 'none',
          transition: 'smooth'
        },
        buttons: {
          style: 'rounded',
          size: 'medium',
          effect: 'shadow'
        },
        profileImage: {
          shape: 'circle',
          size: 'large',
          border: 'gradient',
          borderWidth: 'medium',
          shadow: 'medium',
          animation: 'none'
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching portfolio settings' });
  }
});

// Save/Update portfolio settings for a user
app.post('/api/portfolio-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { colors, fonts, layout, effects, buttons, profileImage } = req.body;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update or create settings
    let settings = await PortfolioSettings.findOne({ userId });
    
    if (settings) {
      // Update existing settings
      if (colors) settings.colors = { ...settings.colors, ...colors };
      if (fonts) settings.fonts = { ...settings.fonts, ...fonts };
      if (layout) settings.layout = { ...settings.layout, ...layout };
      if (effects) settings.effects = { ...settings.effects, ...effects };
      if (buttons) settings.buttons = { ...settings.buttons, ...buttons };
      if (profileImage) settings.profileImage = { ...settings.profileImage, ...profileImage };
      settings.updatedAt = Date.now();
      await settings.save();
    } else {
      // Create new settings
      settings = await PortfolioSettings.create({
        userId,
        colors: colors || {},
        fonts: fonts || {},
        layout: layout || {},
        effects: effects || {},
        buttons: buttons || {},
        profileImage: profileImage || {}
      });
    }
    
    // Emit event for real-time notification
    io.emit('portfolioSettingsUpdated', {
      userId,
      userName: user.name,
      settings
    });
    
    res.json({
      message: 'Portfolio settings saved successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete portfolio settings for a user
app.delete('/api/portfolio-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    await PortfolioSettings.findOneAndDelete({ userId });
    
    res.json({ message: 'Portfolio settings deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ POLLING ROUTES ============

// Get all polls (for admin)
app.get('/api/polls', async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.json([]);
    }
    const polls = await Poll.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name')
      .populate('portfolioUserId', 'name email portfolioSlug')
      .populate('options.voters.userId', 'name email portfolioSlug');
    res.json(polls);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching polls' });
  }
});

// Get active polls for a specific user's portfolio
app.get('/api/polls/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isDbConnected()) {
      return res.json([]);
    }
    const polls = await Poll.find({ 
      portfolioUserId: userId,
      isActive: true 
    })
      .sort({ createdAt: -1 })
      .populate('options.voters.userId', 'name email portfolioSlug');
    res.json(polls);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching polls' });
  }
});

// Create new poll
app.post('/api/polls', async (req, res) => {
  try {
    const { question, options, endDate, createdBy, portfolioUserId } = req.body;
    
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options are required' });
    }
    
    if (!portfolioUserId) {
      return res.status(400).json({ error: 'Portfolio User ID is required' });
    }
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const pollOptions = options.map(opt => ({
      text: typeof opt === 'string' ? opt : opt.text,
      votes: 0,
      voters: []
    }));
    
    const poll = await Poll.create({
      question: question.trim(),
      options: pollOptions,
      portfolioUserId: portfolioUserId,
      endDate: endDate ? new Date(endDate) : null,
      createdBy: createdBy || null,
      isActive: true
    });
    
    const populatedPoll = await Poll.findById(poll._id)
      .populate('portfolioUserId', 'name email portfolioSlug');
    
    // Emit event for real-time notification
    io.emit('pollCreated', {
      pollId: poll._id,
      question: poll.question
    });
    
    res.json({
      message: 'Poll created successfully',
      poll: populatedPoll
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote on a poll
app.post('/api/polls/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { optionIndex, userId } = req.body;
    
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({ error: 'Option index is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required for voting' });
    }
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const poll = await Poll.findById(id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (!poll.isActive) {
      return res.status(400).json({ error: 'Poll is not active' });
    }
    
    if (poll.endDate && new Date() > poll.endDate) {
      return res.status(400).json({ error: 'Poll has ended' });
    }
    
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ error: 'Invalid option index' });
    }
    
    // Check if user has already voted
    const hasVoted = poll.options.some(opt => 
      opt.voters.some(voter => voter.userId && voter.userId.toString() === userId)
    );
    
    if (hasVoted) {
      return res.status(400).json({ error: 'You have already voted in this poll' });
    }
    
    // Add vote with user details
    poll.options[optionIndex].votes += 1;
    poll.options[optionIndex].voters.push({
      userId: userId,
      votedAt: new Date()
    });
    
    await poll.save();
    
    // Populate and return updated poll
    const updatedPoll = await Poll.findById(id)
      .populate('createdBy', 'name')
      .populate('options.voters.userId', 'name email portfolioSlug');
    
    // Emit event for real-time update
    io.emit('pollUpdated', {
      pollId: poll._id,
      options: poll.options.map(opt => ({ text: opt.text, votes: opt.votes }))
    });
    
    res.json({
      message: 'Vote recorded successfully',
      poll: updatedPoll
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle poll status
app.put('/api/polls/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const poll = await Poll.findById(id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    poll.isActive = !poll.isActive;
    await poll.save();
    
    res.json({
      message: `Poll ${poll.isActive ? 'activated' : 'deactivated'} successfully`,
      poll
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete poll
app.delete('/api/polls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isDbConnected()) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    const poll = await Poll.findByIdAndDelete(id);
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    res.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected to the admin panel');
  
  socket.on('disconnect', () => {
    console.log('A user disconnected from the admin panel');
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

// Vercel serverless compatibility: export app when running on Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Accessible from network at: http://YOUR_IP:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please kill the process using this port or change the PORT in server.js`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}