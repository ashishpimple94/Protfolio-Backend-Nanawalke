# Backend Server

Node.js/Express backend server for Portfolio and Admin Panel.

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

The server will run on [http://localhost:5000](http://localhost:5000)

## API Endpoints

- `GET /api/photos` - Get all photos
- `GET /api/news` - Get all news
- `GET /api/videos` - Get all videos
- `POST /api/upload` - Upload a file (form-data with `file` and `type`)
- `DELETE /api/delete/:type/:filename` - Delete a file
- `POST /api/suggestions` - Submit a suggestion

## File Storage

Uploaded files are stored in:
- `public/uploads/photos/` - Photo files
- `public/uploads/videos/` - Video files
- `public/uploads/news/` - News image files


