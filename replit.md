# Ibiki SMS API Middleware

## Overview

Ibiki SMS is a professional SMS API middleware platform that acts as a secure passthrough service to ExtremeSMS. It enables users to hide their ExtremeSMS credentials from clients while managing pricing, credits, and usage tracking. The platform provides a multi-client API key system with individual credit balances, usage monitoring, and a complete admin dashboard for system configuration and client management.

## Recent Changes (November 19, 2025)

### Version 11.4 (Latest - PostgreSQL Persistence + Full Translations)
1. **CRITICAL FIX: Database Persistence**: Switched from MemStorage to PostgreSQL-backed DbStorage
   - Users, API keys, and settings now persist across restarts and updates
   - DbStorage class implements IStorage using Drizzle ORM with Neon serverless PostgreSQL
   - WebSocket configuration for serverless database connections
   - Zero data loss on application restarts or updates
2. **Complete Translation Coverage**: Fixed all remaining untranslated text
   - ApiEndpointCard now uses translation system
   - Added `api.requestExample` and `api.responseExample` translation keys
   - **Payload content now translates**: Example messages, phone numbers, and names in code samples switch between English and Chinese
   - 100% translation coverage across entire application (EN + 中文)
3. **Database Safety**: All client data preserved through updates
   - Users table persists
   - API keys persist
   - Client profiles and settings persist (credits, assignedPhoneNumbers, markup)
   - Message logs and credit transactions persist
4. **Production-Ready Storage**:
   - Singleton connection pool prevents socket leaks
   - Graceful shutdown handlers (SIGINT/SIGTERM) close pool cleanly
   - Automatic fallback to MemStorage when DATABASE_URL missing (dev mode)
   - First user auto-promotion to admin preserved
   - Default credits and profile values maintained

### Version 11 (2-Way SMS Support)
1. **Incoming SMS Management**: Complete 2-way SMS system with webhook integration
   - New endpoint POST /webhook/incoming-sms receives incoming messages from ExtremeSMS
   - Messages routed to clients based on assigned phone numbers
   - Client API endpoint GET /api/v2/sms/inbox for external access (API key auth)
   - Dashboard endpoint GET /api/client/inbox for UI access (JWT auth)
   - Admin can assign phone numbers to clients via inline editing in client management table
2. **Client Dashboard Inbox**: Live incoming message display
   - Shows sender info (name, business, phone number)
   - Auto-refreshes every 5 seconds
   - Displays message status and timestamps
   - Empty state when no messages or no assigned phone number
3. **Database Schema**: New incomingMessages table with fields:
   - userId (client association), from, firstname, lastname, business
   - message, status, matchedBlockWord, receiver, usedmodem, port
   - timestamp, messageId (ExtremeSMS reference)
   - assignedPhoneNumber field added to clientProfiles for routing
4. **API Documentation**: Updated with 2-way SMS info
   - Inbox endpoint documentation with request/response examples
   - Webhook configuration instructions for ExtremeSMS setup
   - Example payload structure from ExtremeSMS
   - Note about phone number assignment requirement

### Version 10 (ExtremeSMS Balance Display)
1. **Live Balance Monitoring**: Admin dashboard now displays real-time ExtremeSMS account balance
   - New endpoint GET /api/admin/extremesms-balance
   - Auto-refreshes every 30 seconds
   - Shows balance with currency (e.g., "USD 1,234.56")
   - Displays loading and error states appropriately
   - Integrated as 4th stat card on admin dashboard
2. **Security Hardening**:
   - No sensitive data leaked in error messages or logs
   - Only HTTP status codes logged for debugging
   - Generic error messages to protect API credentials
   - Axios validateStatus configured for proper error handling

### Version 9 (Password Reset via Email)
1. **Password Reset Feature**: Complete password reset flow with email notifications
   - Forgot password page with email input
   - Reset password page with token validation
   - Email sent via Resend integration with professional HTML template
   - Secure token generation (1 hour expiration)
   - "Forgot Password?" link on login page
   - Success screens and error handling throughout
2. **Database Schema Updates**: Added resetToken and resetTokenExpiry fields to users table
3. **Backend API**: Three new endpoints for password reset flow
   - POST /api/auth/forgot-password (sends reset email)
   - GET /api/auth/verify-reset-token/:token (validates token)
   - POST /api/auth/reset-password (updates password)
4. **Security Features**:
   - Tokens expire after 1 hour
   - Email enumeration protection (always returns success)
   - Password hashing with bcrypt
   - Tokens cleared after successful reset

### Version 8 (All Dummy Data Removed)
1. **API Key Management**: Complete system for managing API keys
   - Copy button in signup dialog (full key shown once)
   - View all API keys in client dashboard (masked for security)
   - Generate new API keys anytime
   - Revoke individual keys with confirmation dialog
   - Show key creation date and last used date
2. **100% Live Data - Zero Dummy Values**: All statistics pull real data from database
   - Total messages count from actual database (no dummy data)
   - Total clients count from actual user database
   - **Recent API Activity**: Live message logs with client names, timestamps, and status
   - Auto-refresh every 5 seconds for real-time monitoring
   - Proper empty states when no data exists yet
3. **Fixed ExtremeSMS Integration**:
   - Test Connection uses correct GET /api/v2/account/balance endpoint
   - All test endpoints use Bearer authentication
   - Admin API testing utility works correctly
4. **API Testing Utility**: Admin dashboard now has "API Testing" tab to test all endpoints
5. **Error Log Viewer**: Monitor failed SMS deliveries and system errors with real-time auto-refresh
6. **Security**: All admin endpoints properly secured with requireAdmin middleware

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
- `clientProfiles` - Credit balances, custom markup, and assignedPhoneNumber per client
- `systemConfig` - Key-value store for ExtremeSMS credentials and pricing
- `messageLogs` - Audit trail of all outbound SMS transactions
- `creditTransactions` - Financial transaction history
- `incomingMessages` - Incoming SMS messages with sender info and routing data

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