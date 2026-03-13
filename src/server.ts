import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();

// ---- Trust proxy (needed behind reverse proxy / Cloudflare) ----
if (env.IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

// ---- Security Headers ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://www.paypal.com', 'https://www.sandbox.paypal.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'", 'https://api-m.paypal.com', 'https://api-m.sandbox.paypal.com'],
      frameSrc: ["'self'", 'https://www.paypal.com', 'https://www.sandbox.paypal.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: env.IS_PRODUCTION ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // needed for PayPal iframes
  hsts: env.IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// ---- CORS ----
const allowedOrigins = env.FRONTEND_URL
  ? env.FRONTEND_URL.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600, // preflight cache 10 min
}));

// ---- Global rate limiter ----
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta más tarde.' },
}));

// ---- Body parsing ----
app.use(express.json({ limit: '1mb' }));

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- API Routes ----
app.use('/api', apiRoutes);

// ---- Error handling ----
app.use(notFound);
app.use(errorHandler);

// ---- Start ----
const HOST = '0.0.0.0'; // Required for Render and cloud platforms
app.listen(env.PORT, HOST, () => {
  console.log(`\n   Cobble Quest API running on http://${HOST}:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   CORS origin: ${env.FRONTEND_URL}\n`);
});

export default app;
