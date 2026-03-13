import dotenv from 'dotenv';
dotenv.config();

// Require critical secrets — fail fast if missing
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV,
  IS_PRODUCTION: isProduction,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Pelican Panel API
  PELICAN_URL: process.env.PELICAN_URL || '',
  PELICAN_API_KEY: process.env.PELICAN_API_KEY || '',               // Application key (papp_) — list servers, admin info
  PELICAN_CLIENT_API_KEY: process.env.PELICAN_CLIENT_API_KEY || '', // Client key (pacc_) — commands, files, resources
  PELICAN_SERVER_ID: process.env.PELICAN_SERVER_ID || '',           // Primary game server (Cobble Quest)
  PELICAN_LOBBY_SERVER_ID: process.env.PELICAN_LOBBY_SERVER_ID || '',   // Lobby server
  PELICAN_VELOCITY_SERVER_ID: process.env.PELICAN_VELOCITY_SERVER_ID || '', // Velocity proxy — used to send commands to all backend servers

  // PayPal REST API
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '',
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '',
  PAYPAL_MODE: (process.env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live',

  // Stripe (placeholder — ready for future integration)
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
} as const;

export default env;
