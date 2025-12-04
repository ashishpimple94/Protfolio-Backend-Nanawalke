const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const Photo = require('./models/Photo');
const News = require('./models/News');
const Video = require('./models/Video');
const Suggestion = require('./models/Suggestion');
const AdminMessage = require('./models/AdminMessage');

const app = express();
const PORT = process.env.PORT || 3001;
const USE_CLOUD_UPLOADS = process.env.USE_CLOUD_UPLOADS === 'true' || !!process.env.VERCEL;

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
  res.status(200).json({ status: 'ok' });
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
    const photos = await Photo.find().sort({ uploadedAt: -1 });
    const formattedPhotos = photos.map((photo, index) => ({
      id: photo._id,
      src: photo.src,
      filename: photo.filename
    }));
    res.json(formattedPhotos);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching photos' });
  }
});

// Get all news
app.get('/api/news', async (req, res) => {
  try {
    const news = await News.find().sort({ uploadedAt: -1 });
    const formattedNews = news.map((item, index) => ({
      id: item._id,
      title: item.title || `News ${index + 1}`,
      src: item.src,
      filename: item.filename
    }));
    res.json(formattedNews);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching news' });
  }
});

// Get all videos
app.get('/api/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ uploadedAt: -1 });
    const formattedVideos = videos.map((video, index) => ({
      id: video._id,
      title: video.title || `Video ${index + 1}`,
      src: video.src,
      filename: video.filename,
      isExternal: video.isExternal,
      externalUrl: video.externalUrl
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

    if (USE_CLOUD_UPLOADS) {
      const folder = `uploads/${type || 'photos'}`;
      const resourceType = type === 'videos' ? 'video' : 'image';
      const title = req.body.title || (type === 'news' ? 'News' : type === 'videos' ? 'Video' : undefined);

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
        savedItem = await Photo.create({ filename: streamResult.public_id, src: streamResult.secure_url });
      } else if (type === 'news') {
        savedItem = await News.create({ filename: streamResult.public_id, src: streamResult.secure_url, title });
      } else if (type === 'videos') {
        savedItem = await Video.create({ filename: streamResult.public_id, src: streamResult.secure_url, title, isExternal: false });
      }

      return res.json({
        message: 'File uploaded successfully',
        file: { id: savedItem._id, filename: savedItem.filename, url: savedItem.src, type }
      });
    } else {
      const fileUrl = `/uploads/${req.body.type}/${req.file.filename}`;
      let savedItem;
      if (type === 'photos') {
        savedItem = await Photo.create({ filename: req.file.filename, src: fileUrl });
      } else if (type === 'news') {
        savedItem = await News.create({ filename: req.file.filename, src: fileUrl, title: req.body.title || 'News' });
      } else if (type === 'videos') {
        savedItem = await Video.create({ filename: req.file.filename, src: fileUrl, title: req.body.title || 'Video', isExternal: false });
      }
      return res.json({
        message: 'File uploaded successfully',
        file: { id: savedItem._id, filename: req.file.filename, url: fileUrl, type }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add YouTube video link
app.post('/api/videos/youtube', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    const videoId = extractYouTubeId(url.trim());
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const embedUrl = buildYouTubeEmbedUrl(videoId);
    const filename = `youtube-${videoId}-${Date.now()}`;

    const video = await Video.create({
      filename,
      src: embedUrl,
      title: title && title.trim() ? title.trim() : 'YouTube Video',
      isExternal: true,
      externalUrl: url.trim()
    });

    res.json({
      message: 'YouTube video added successfully',
      video: {
        id: video._id,
        filename: video.filename,
        src: video.src,
        title: video.title,
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

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all suggestions
app.get('/api/suggestions', async (req, res) => {
  try {
    const suggestions = await Suggestion.find().sort({ submittedAt: -1 });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching suggestions' });
  }
});

// Submit suggestion
app.post('/api/suggestions', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const suggestion = await Suggestion.create({
      message: message.trim()
    });
    
    res.json({ 
      message: 'Suggestion submitted successfully',
      id: suggestion._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active admin message
app.get('/api/admin-message', async (req, res) => {
  try {
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
    
    // Deactivate all previous messages
    await AdminMessage.updateMany({}, { isActive: false });
    
    // Create new active message
    const adminMessage = await AdminMessage.create({
      message: message.trim(),
      isActive: true
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
    const messages = await AdminMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching admin messages' });
  }
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
  const server = app.listen(PORT, '0.0.0.0', () => {
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
