import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_API_URL = process.env.REACT_APP_API_URL || 'https://playbeat-backend.onrender.com';

// ── SECURITY MIDDLEWARE ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", RENDER_API_URL],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"]
    }
  }
}));

// ── CORS MIDDLEWARE ──────────────────────────────────────
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    'https://playbeat.vercel.app',
    'https://playbeat-digital.vercel.app'
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── LOGGING MIDDLEWARE ──────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── STATIC FILES ─────────────────────────────────────────
app.use(express.static(join(__dirname, 'public')));

// ── HEALTH CHECK ENDPOINT ────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// ── BACKEND PROXY ENDPOINTS ──────────────────────────────

/**
 * Proxy API requests to Render backend
 * This allows frontend to call /api/* which gets forwarded to RENDER_API_URL/api/*
 */
app.all('/api/*', async (req, res) => {
  try {
    const apiPath = req.path.replace('/api', '');
    const targetUrl = `${RENDER_API_URL}/api${apiPath}`;
    
    console.log(`[PROXY] ${req.method} ${req.path} → ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PlayBeat-Frontend/1.0',
        ...(req.headers['authorization'] && { 'Authorization': req.headers['authorization'] })
      },
      body: ['GET', 'HEAD', 'DELETE'].includes(req.method) ? undefined : JSON.stringify(req.body)
    });
    
    const data = await response.json().catch(() => ({}));
    
    // Forward all headers from backend
    response.headers.forEach((value, name) => {
      if (!['content-encoding', 'transfer-encoding'].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[PROXY ERROR]', error.message);
    res.status(502).json({
      error: 'Backend service unavailable',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ── FALLBACK TO INDEX.HTML (SPA routing) ─────────────────
app.get('*', (req, res) => {
  if (req.accepts('html')) {
    res.sendFile(join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── ERROR HANDLING ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    timestamp: new Date().toISOString()
  });
});

// ── START SERVER ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║          🎵 PlayBeat Digital Frontend Server 🎵            ║
╠════════════════════════════════════════════════════════════╣
║ Server:        http://localhost:${PORT}                        
║ Status:        ✅ Running
║ Backend URL:   ${RENDER_API_URL}
║ Environment:   ${process.env.NODE_ENV || 'production'}
║ CORS Enabled:  ✅ Yes
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
