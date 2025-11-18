# Ibiki SMS API Middleware

## Overview

Ibiki SMS is a professional SMS API middleware platform that acts as a secure passthrough service to ExtremeSMS. It enables users to hide their ExtremeSMS credentials from clients while managing pricing, credits, and usage tracking. The platform provides a multi-client API key system with individual credit balances, usage monitoring, and a complete admin dashboard for system configuration and client management.

## Recent Changes (November 18, 2025)

### Version 8 (Latest)
1. **API Key Management**: Complete system for managing API keys
   - Copy button in signup dialog (full key shown once)
   - View all API keys in client dashboard (masked for security)
   - Generate new API keys anytime
   - Revoke individual keys with confirmation dialog
   - Show key creation date and last used date
2. **Live Data & Stats**: All statistics pull real data from database
   - Total messages count from actual database (no dummy data)
   - Total clients count from actual user database
   - Real message logs and usage tracking
3. **Fixed ExtremeSMS Integration**:
   - Test Connection uses correct GET /api/v2/account/balance endpoint
   - All test endpoints use Bearer authentication
   - Admin API testing utility works correctly
4. **API Testing Utility**: Admin dashboard now has "API Testing" tab to test all endpoints
5. **Error Log Viewer**: Monitor failed SMS deliveries and system errors with real-time auto-refresh
6. **Security Fix**: Admin tests use ExtremeSMS key directly (not client keys)

### Version 7
1. **API Documentation Updated**: Changed from api.ibikisms.com to http://151.243.109.79 (server IP)
2. **Correct API Routes**: All curl examples now include /api prefix (e.g., /api/v2/sms/sendsingle)
3. **TypeScript Fixed**: Resolved all LSP errors by importing User type
4. **Test Connection**: Functional button to test ExtremeSMS API connectivity with status badge
5. **Real Client Data**: Admin dashboard shows actual clients from database (no dummy data)
6. **Verified Proxy Routing**: All /api/v2/* routes correctly forward to ExtremeSMS

### Previous Updates
1. **Multilingual Support**: Implemented English/Chinese language toggle throughout the application
2. **Add Credits Security**: Restricted add-credits endpoint to admin-only with requireAdmin middleware
3. **Navigation Improvements**: Added back buttons to all dashboard pages (Client Dashboard, Admin Dashboard, API Docs)
4. **API Key Security**: API keys displayed in masked format (prefix...suffix) after creation - full key only shown once during signup
5. **Credit Transaction Tracking**: All credit additions are logged with balanceBefore/balanceAfter for audit trail

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Framework**: Shadcn/ui component library built on Radix UI primitives with Tailwind CSS for styling

**Design System**: 
- Inspired by Stripe Dashboard, Linear, and Vercel Dashboard
- Typography: Inter font for UI, JetBrains Mono for code/credentials
- Clean, B2B SaaS aesthetic prioritizing clarity and information density
- Dark mode support via CSS custom properties
- Responsive grid layouts with mobile-first breakpoints

**State Management**: 
- TanStack Query (React Query) for server state management
- Local storage for JWT token persistence
- React hooks for local component state

**Routing**: Wouter for client-side routing with role-based access control

**Key Pages**:
- Landing page (public marketing with language toggle)
- Signup/Login (authentication with multilingual support)
- Client Dashboard (usage stats, masked API keys, message logs, add credits button)
- Admin Dashboard (system config, client management, ExtremeSMS configuration)
- API Documentation (interactive endpoint reference with back navigation)

**Internationalization**:
- Dual-language support (English and Chinese)
- LanguageContext provider for centralized translation management
- LanguageToggle component in navigation header
- Language preference persisted in localStorage
- Translation keys organized by feature area in client/src/lib/i18n.ts

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Language**: TypeScript with ES modules

**Authentication Strategy**:
- JWT-based authentication for dashboard/admin access
- SHA-256 hashed API keys for client API requests
- Role-based authorization (admin vs client)
- Middleware functions for token verification and role checks

**API Proxy Pattern**:
- Middleware authenticates incoming requests via API key
- Validates client credits before forwarding to ExtremeSMS
- Proxies requests to ExtremeSMS with admin's credentials
- Tracks usage and deducts credits from client balance
- Logs all messages for audit trail

**Storage Layer**:
- Abstract IStorage interface for database operations
- In-memory implementation (MemStorage) for development
- Designed for PostgreSQL via Drizzle ORM in production
- Database schema includes: users, apiKeys, clientProfiles, systemConfig, messageLogs, creditTransactions

**Session Management**: 
- Stateless JWT tokens (no server-side sessions)
- API keys stored as SHA-256 hashed values for security
- API keys displayed as masked format (prefix...suffix) after creation
- Full plaintext API key only shown once during signup for security
- Tokens include userId and role claims

**Credit Management**:
- Admin-only credit addition via POST /api/admin/add-credits
- requireAdmin middleware enforces role-based access control
- Credit transactions logged with balanceBefore and balanceAfter
- Client "Add Credits" button shows contact admin notification
- All credit changes tracked in creditTransactions table

### Data Storage

**ORM**: Drizzle ORM with PostgreSQL dialect

**Database Provider**: Neon serverless PostgreSQL (based on @neondatabase/serverless dependency)

**Schema Design**:
- `users` - Both admin and client accounts with role field
- `apiKeys` - Client API credentials (hashed with prefix/suffix for display)
- `clientProfiles` - Credit balances and custom markup per client
- `systemConfig` - Key-value store for ExtremeSMS credentials and pricing
- `messageLogs` - Audit trail of all SMS transactions
- `creditTransactions` - Financial transaction history

**Migrations**: Drizzle Kit for schema migrations stored in /migrations directory

**Connection**: Environment variable DATABASE_URL required for database provisioning

### External Dependencies

**Third-Party SMS Service**: ExtremeSMS (https://extremesms.net)
- Integration via HTTP REST API
- Admin stores ExtremeSMS API key in system config
- Five endpoints proxied: sendsingle, sendbulk, sendbulkmulti, checkdelivery, checkbalance
- All requests authenticated with admin's ExtremeSMS credentials

**HTTP Client**: Axios for making requests to ExtremeSMS API

**Password Hashing**: bcryptjs for secure password storage

**Token Generation**: jsonwebtoken for JWT creation and verification

**Development Tools**:
- Vite plugins for Replit integration (runtime error overlay, cartographer, dev banner)
- esbuild for server-side bundling in production

**Deployment Infrastructure**:
- PM2 process manager for production server
- Nginx reverse proxy for HTTPS/domain routing
- Ubuntu/Debian Linux server environment
- Automated 1-click deployment script (deploy.sh)
- Deploy in-place from /root (default) or copy to /opt
- Complete deployment documentation (DEPLOYMENT.md, QUICKSTART.md)
- First user auto-promoted to admin for easy setup
- Server target: 151.243.109.79
- Port: 6000 (internal), 80 (Nginx proxy)