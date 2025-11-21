import dotenv from "dotenv";

// Load environment-specific config
// IMPORTANT: Don't load .env.production on Railway - it contains localhost database URL
// Railway detection: Check for multiple Railway-specific environment variables
const isRailway = !!(
  process.env.RAILWAY_ENVIRONMENT || 
  process.env.RAILWAY_PROJECT_ID || 
  process.env.RAILWAY_SERVICE_ID ||
  process.env.RAILWAY_DEPLOYMENT_ID ||
  process.env.RAILWAY_REPLICA_ID ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  (process.env.NODE_ENV === 'production' && process.env.PORT && !process.env.DATABASE_URL)
);

const envFile = process.env.NODE_ENV === 'production' && !isRailway ? '.env.production' : '.env.development';

console.log('🔧 Environment loading:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Railway detected:', isRailway);
console.log('Loading env file:', envFile);

// Log all environment variables that might indicate Railway
console.log('🔍 Railway detection variables:');
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID);
console.log('RAILWAY_SERVICE_ID:', process.env.RAILWAY_SERVICE_ID);
console.log('RAILWAY_DEPLOYMENT_ID:', process.env.RAILWAY_DEPLOYMENT_ID);
console.log('RAILWAY_REPLICA_ID:', process.env.RAILWAY_REPLICA_ID);

dotenv.config({ path: envFile });
dotenv.config(); // Also load .env as fallback

// Debug: Log environment info for Railway
console.log('🔍 Environment Debug Info:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID);
console.log('RAILWAY_SERVICE_ID:', process.env.RAILWAY_SERVICE_ID);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL value:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@') : 'NOT SET');

// Check for Railway-specific database variables
const railwayDbVars = Object.keys(process.env).filter(key => 
  key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('DB')
);
console.log('🔍 Database-related env vars:', railwayDbVars);

// Log all Railway-related environment variables
const railwayVars = Object.keys(process.env).filter(key => key.startsWith('RAILWAY'));
console.log('🚄 Railway env vars:', railwayVars);

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
  
  // In Railway, DATABASE_URL is provided by the PostgreSQL addon
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.error('❌ Railway detected: Make sure you have added a PostgreSQL database addon');
    console.error('❌ Go to your Railway project → Add Service → Database → PostgreSQL');
    console.error('❌ Available env vars:', Object.keys(process.env).slice(0, 10).join(', '), '...');
  } else {
    console.error('❌ Please set DATABASE_URL in your environment variables or .env file.');
    console.error('❌ Example: DATABASE_URL=postgresql://user:password@host:port/database');
  }
  
  process.exit(1);
}

// CRITICAL: Validate DATABASE_URL format
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
  console.error('❌ FATAL ERROR: DATABASE_URL format is invalid!');
  console.error('DATABASE_URL value:', process.env.DATABASE_URL);
  console.error('Parse error:', error.message);
  process.exit(1);
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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
