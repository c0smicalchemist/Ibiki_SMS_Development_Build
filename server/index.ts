import dotenv from "dotenv";

// Load environment-specific config
// IMPORTANT: Don't load .env.production on Railway - it contains localhost database URL

// First, log what environment variables we have
if (process.env.LOG_LEVEL === 'debug') {
  console.log('🔧 Initial environment check:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
}

// Railway detection: Check for multiple Railway-specific environment variables
const railwayVars = Object.keys(process.env).filter(key => key.startsWith('RAILWAY'));
const isRailway = railwayVars.length > 0 || 
  (process.env.NODE_ENV === 'production' && process.env.PORT && process.env.DATABASE_URL);

if (process.env.LOG_LEVEL === 'debug') {
  console.log('🔍 Railway detection:');
  console.log('Railway env vars found:', railwayVars);
  console.log('Railway detected:', isRailway);
}

// CRITICAL: If we're on Railway, don't load any .env files that might override Railway vars
// Railway provides all environment variables directly
if (isRailway) {
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('🚄 Railway detected: Skipping .env files to preserve Railway environment variables');
    console.log('🚄 Using Railway-provided environment variables only');
  }
} else {
  // Local development: load appropriate .env file
  const shouldLoadProductionEnv = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL;
  const envFile = shouldLoadProductionEnv ? '.env.production' : '.env.development';
  
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('Environment file decision:');
    console.log('Should load .env.production:', shouldLoadProductionEnv);
    console.log('Loading env file:', envFile);
  }

  dotenv.config({ path: envFile });
  dotenv.config(); // Also load .env as fallback
}

// Debug: Log environment info for Railway
if (process.env.LOG_LEVEL === 'debug') {
  console.log('🔍 Environment Debug Info:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
  console.log('RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID);
  console.log('RAILWAY_SERVICE_ID:', process.env.RAILWAY_SERVICE_ID);
  console.log('PORT:', process.env.PORT);
  console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
  console.log('DATABASE_URL value:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@') : 'NOT SET');
}

// Check for Railway-specific database variables
const railwayDbVars = Object.keys(process.env).filter(key => 
  key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('DB')
);
if (process.env.LOG_LEVEL === 'debug') {
  console.log('🔍 Database-related env vars:', railwayDbVars);
  console.log('🚄 Railway env vars:', railwayVars);
}

// Railway-specific: Use private network connection to avoid egress fees
if (isRailway) {
  if (process.env.DATABASE_PRIVATE_URL) {
    console.log('🚄 Railway detected: Using private database connection (no egress fees)');
    process.env.DATABASE_URL = process.env.DATABASE_PRIVATE_URL;
  } else if (process.env.DATABASE_PUBLIC_URL) {
    console.log('⚠️  Railway detected: Using public database connection (egress fees apply)');
    process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
  } else if (process.env.DATABASE_URL) {
    console.log('🚄 Railway detected: Using standard DATABASE_URL');
  } else {
    console.log('⚠️  Railway detected but no database URL found');
  }
}

// CRITICAL: Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL ERROR: DATABASE_URL environment variable is not set!');
  console.error('❌ The application REQUIRES a PostgreSQL database.');
  
  // Show all environment variables for debugging
  console.error('🔍 All environment variables:');
  Object.keys(process.env).sort().forEach(key => {
    const value = process.env[key];
    if (key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('DB') || key.startsWith('RAILWAY')) {
      console.error(`  ${key}: ${value}`);
    }
  });
  
  console.error('❌ First 20 env vars:', Object.keys(process.env).slice(0, 20).join(', '));
  
  // In Railway, DATABASE_URL is provided by the PostgreSQL addon
  if (isRailway) {
    console.error('❌ Railway detected: Make sure you have added a PostgreSQL database addon');
    console.error('❌ Go to your Railway project → Add Service → Database → PostgreSQL');
    console.error('❌ The PostgreSQL addon should automatically set DATABASE_URL');
    console.error('❌ Check your Railway project settings and ensure the database is connected');
  } else {
    console.error('❌ Please set DATABASE_URL in your environment variables or .env file.');
    console.error('❌ Example: DATABASE_URL=postgresql://user:password@host:port/database');
  }
  
  // Production consistency: always require a real database
  if (!process.env.DATABASE_URL && !process.env.DATABASE_PRIVATE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRESQL_URL && !process.env.DATABASE_PUBLIC_URL) {
    console.error('❌ Exiting: A consistent PostgreSQL database is required in production');
    process.exit(1);
  }
}

// CRITICAL: Validate DATABASE_URL format (if present)
if (process.env.DATABASE_URL) {
  console.log('🔍 Final DATABASE_URL validation:');
  console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
  console.log('DATABASE_URL type:', typeof process.env.DATABASE_URL);
  console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);

  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log('✅ DATABASE_URL format is valid');
    console.log('Database host:', url.hostname);
    console.log('Database port:', url.port);
    console.log('Database name:', url.pathname.slice(1));
  } catch (error: any) {
    console.error('❌ WARNING: DATABASE_URL format is invalid!');
    console.error('❌ Exiting: Fix DATABASE_URL for consistent storage');
    process.exit(1);
  }
} else {
  console.log('🔍 DATABASE_URL not set - will use in-memory storage');
}

import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { storage } from "./storage";

const app = express();

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

function serveStatic(app: express.Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  const exists = fs.existsSync(distPath);
  if (!exists) {
    console.warn(`Skipping static file serving; missing ${distPath}`);
    return;
  }
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }
  }));
  app.get(/^(?!\/api).*/, (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    res.sendFile(indexPath);
  });
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const resolvedDbUrl =
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    process.env.DATABASE_PUBLIC_URL ||
    "";
  if (!process.env.DATABASE_URL && resolvedDbUrl) {
    process.env.DATABASE_URL = resolvedDbUrl;
  }
  // Bootstrap secrets from system_config if env vars are missing
  try {
    const desiredKeys = [
      { env: 'JWT_SECRET', cfg: 'jwt_secret' },
      { env: 'SESSION_SECRET', cfg: 'session_secret' },
      { env: 'WEBHOOK_SECRET', cfg: 'webhook_secret' },
      { env: 'RESEND_API_KEY', cfg: 'resend_api_key' },
    ];
    for (const k of desiredKeys) {
      if (!process.env[k.env]) {
        const rec = await storage.getSystemConfig(k.cfg);
        if (rec?.value) {
          process.env[k.env] = rec.value;
          console.log(`🔐 Loaded ${k.env} from system_config`);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️  Unable to bootstrap secrets from system_config:', (e as any)?.message || e);
  }
  // Add a simple test route before registerRoutes
  app.get("/api/test", (req, res) => {
    res.json({ message: "Server is running", timestamp: new Date().toISOString() });
  });
  
  console.log('🔧 Registering routes...');
  let server;
  try {
    // Apply database migrations during startup (outside of constructors)
    try {
      if (process.env.DATABASE_URL && process.env.RUN_DB_MIGRATIONS !== 'false') {
        const connectionString = process.env.DATABASE_URL;
        const shouldUseSSL = () => {
          if (!connectionString) return false;
          if (process.env.POSTGRES_SSL === 'true') return true;
          return connectionString.includes('sslmode=require') || /neon\.tech|railway/i.test(connectionString);
        };
        const { Pool } = await import('pg');
        const { drizzle } = await import('drizzle-orm/node-postgres');
        const { migrate } = await import('drizzle-orm/node-postgres/migrator');
        const pool = new Pool(shouldUseSSL() ? { connectionString, ssl: { rejectUnauthorized: false } } : { connectionString });
        const db = drizzle(pool);
        const migrationsFolder = path.resolve(import.meta.dirname, '..', 'migrations');
        await migrate(db, { migrationsFolder });
        await pool.end();
        console.log('✅ Database migrations applied at startup');
      }
    } catch (e: any) {
      console.warn('⚠️  Startup migrations skipped or failed:', e?.message || e);
      // Fallback: ensure essential tables exist for runtime
      try {
        if (process.env.DATABASE_URL) {
          const { Pool } = await import('pg');
          const connectionString = process.env.DATABASE_URL;
          const useSSL = connectionString.includes('sslmode=require') || process.env.POSTGRES_SSL === 'true';
          const pool = new Pool(useSSL ? { connectionString, ssl: { rejectUnauthorized: false } } : { connectionString });
          const exec = async (q: string) => {
            try { await pool.query(q); } catch (err: any) { console.warn('⚠️  Bootstrap step warning:', err?.message || err); }
          };
          console.log('🔧 Attempting schema bootstrap (CREATE TABLE IF NOT EXISTS)');
          await exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
          await exec(`CREATE TABLE IF NOT EXISTS users (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            email text NOT NULL UNIQUE,
            password text NOT NULL,
            name text NOT NULL,
            company text,
            role text NOT NULL DEFAULT 'client',
            is_active boolean NOT NULL DEFAULT true,
            reset_token text,
            reset_token_expiry timestamp,
            created_at timestamp NOT NULL DEFAULT now()
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS email_idx ON users(email)`);
          await exec(`CREATE INDEX IF NOT EXISTS reset_token_idx ON users(reset_token)`);

          await exec(`CREATE TABLE IF NOT EXISTS api_keys (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            key_hash text NOT NULL UNIQUE,
            key_prefix text NOT NULL,
            key_suffix text NOT NULL,
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamp NOT NULL DEFAULT now(),
            last_used_at timestamp,
            CONSTRAINT fk_api_keys_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS user_id_idx ON api_keys(user_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS key_hash_idx ON api_keys(key_hash)`);

          await exec(`CREATE TABLE IF NOT EXISTS client_profiles (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL UNIQUE,
            credits numeric(10,2) NOT NULL DEFAULT 0.00,
            currency text NOT NULL DEFAULT 'USD',
            custom_markup numeric(10,4),
            assigned_phone_numbers text[],
            rate_limit_per_minute integer NOT NULL DEFAULT 200,
            business_name text,
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_client_profiles_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);

          await exec(`CREATE TABLE IF NOT EXISTS system_config (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            key text NOT NULL UNIQUE,
            value text NOT NULL,
            updated_at timestamp NOT NULL DEFAULT now()
          )`);

          await exec(`CREATE TABLE IF NOT EXISTS message_logs (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            message_id text NOT NULL,
            endpoint text NOT NULL,
            recipient text,
            recipients text[],
            sender_phone_number text,
            status text NOT NULL,
            cost_per_message numeric(10,4) NOT NULL,
            charge_per_message numeric(10,4) NOT NULL,
            total_cost numeric(10,2) NOT NULL,
            total_charge numeric(10,2) NOT NULL,
            message_count integer NOT NULL DEFAULT 1,
            request_payload text,
            response_payload text,
            is_example boolean NOT NULL DEFAULT false,
            created_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_message_logs_user FOREIGN KEY(user_id) REFERENCES users(id)
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS message_user_id_idx ON message_logs(user_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS message_created_at_idx ON message_logs(created_at)`);
          await exec(`CREATE INDEX IF NOT EXISTS message_id_idx ON message_logs(message_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS message_sender_phone_idx ON message_logs(sender_phone_number)`);
          await exec(`CREATE INDEX IF NOT EXISTS message_is_example_idx ON message_logs(is_example)`);

          await exec(`CREATE TABLE IF NOT EXISTS credit_transactions (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            amount numeric(10,2) NOT NULL,
            type text NOT NULL,
            description text NOT NULL,
            balance_before numeric(10,2) NOT NULL,
            balance_after numeric(10,2) NOT NULL,
            message_log_id varchar,
            created_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_credit_tx_user FOREIGN KEY(user_id) REFERENCES users(id),
            CONSTRAINT fk_credit_tx_message FOREIGN KEY(message_log_id) REFERENCES message_logs(id)
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS transaction_user_id_idx ON credit_transactions(user_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS transaction_created_at_idx ON credit_transactions(created_at)`);

          await exec(`CREATE TABLE IF NOT EXISTS incoming_messages (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar,
            "from" text NOT NULL,
            firstname text,
            lastname text,
            business text,
            message text NOT NULL,
            status text NOT NULL,
            matched_block_word text,
            receiver text NOT NULL,
            usedmodem text,
            port text,
            timestamp timestamp NOT NULL,
            message_id text NOT NULL,
            is_read boolean NOT NULL DEFAULT false,
            is_example boolean NOT NULL DEFAULT false,
            created_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_incoming_user FOREIGN KEY(user_id) REFERENCES users(id)
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS incoming_user_id_idx ON incoming_messages(user_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS incoming_receiver_idx ON incoming_messages(receiver)`);
          await exec(`CREATE INDEX IF NOT EXISTS incoming_timestamp_idx ON incoming_messages(timestamp)`);
          await exec(`CREATE INDEX IF NOT EXISTS incoming_message_id_idx ON incoming_messages(message_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS incoming_from_idx ON incoming_messages("from")`);
          await exec(`CREATE INDEX IF NOT EXISTS incoming_is_example_idx ON incoming_messages(is_example)`);

          await exec(`CREATE TABLE IF NOT EXISTS client_contacts (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            phone_number text NOT NULL,
            firstname text,
            lastname text,
            business text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_client_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS contact_user_id_idx ON client_contacts(user_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS contact_phone_idx ON client_contacts(phone_number)`);
          await exec(`CREATE INDEX IF NOT EXISTS contact_business_idx ON client_contacts(business)`);
          await exec(`CREATE INDEX IF NOT EXISTS contact_phone_user_idx ON client_contacts(phone_number, user_id)`);

          await exec(`CREATE TABLE IF NOT EXISTS contact_groups (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            name text NOT NULL,
            description text,
            business_unit_prefix text,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_contact_groups_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS group_user_id_idx ON contact_groups(user_id)`);

          await exec(`CREATE TABLE IF NOT EXISTS contacts (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            group_id varchar,
            phone_number text NOT NULL,
            name text,
            email text,
            notes text,
            synced_to_extremesms boolean NOT NULL DEFAULT false,
            last_exported_at timestamp,
            is_example boolean NOT NULL DEFAULT false,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now(),
            CONSTRAINT fk_contacts_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_contacts_group FOREIGN KEY(group_id) REFERENCES contact_groups(id) ON DELETE SET NULL
          )`);
          await exec(`CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS contacts_group_id_idx ON contacts(group_id)`);
          await exec(`CREATE INDEX IF NOT EXISTS contacts_phone_idx ON contacts(phone_number)`);
          await exec(`CREATE INDEX IF NOT EXISTS contacts_synced_idx ON contacts(synced_to_extremesms)`);
          await exec(`CREATE INDEX IF NOT EXISTS contacts_is_example_idx ON contacts(is_example)`);

          await pool.end();
          console.log('✅ Schema bootstrap completed');
        }
      } catch (bootErr: any) {
        console.warn('⚠️  Schema bootstrap failed:', bootErr?.message || bootErr);
      }
    }

    server = await registerRoutes(app);
    console.log('✅ Routes registered successfully');
  } catch (error) {
    console.error('❌ Failed to register routes:', error);
    throw error;
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Add debug route to see what routes are registered
  app.get("/api/debug/routes", (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      }
    });
    res.json({ routes, environment: process.env.NODE_ENV });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('🔧 Environment check for Vite/Static serving:');
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    console.log('app.get("env"):', app.get("env"));
    console.log('isRailway:', isRailway);
    console.log('Railway vars count:', railwayVars.length);
  }
  
  // FORCE production mode on Railway regardless of NODE_ENV
  console.log('🔧 Setting up static file serving (Railway or production)...');
  serveStatic(app);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  console.log('🚀 Starting server...');
  console.log(`🌐 Port: ${port}`);
  console.log(`🏠 Host: 0.0.0.0`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log('✅ Server started successfully!');
    console.log(`✅ Listening on http://0.0.0.0:${port}`);
    console.log('✅ Health check available at /api/health');
    log(`serving on port ${port}`);
  });

  // Handle server startup errors
  server.on('error', (error) => {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  });

})().catch((error) => {
  console.error('❌ Application startup failed:', error);
  process.exit(1);
});
