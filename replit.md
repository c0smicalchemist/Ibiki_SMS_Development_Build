# Ibiki SMS API Middleware

## Overview

Ibiki SMS is a professional SMS API middleware platform that acts as a secure passthrough service to ExtremeSMS. It enables users to hide their ExtremeSMS credentials from clients while managing pricing, credits, and usage tracking. The platform provides a multi-client API key system with individual credit balances, usage monitoring, and a complete admin dashboard for system configuration and client management.

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
- Landing page (public marketing)
- Signup/Login (authentication)
- Client Dashboard (usage stats, API keys, message logs)
- Admin Dashboard (system config, client management)
- API Documentation (interactive endpoint reference)

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
- API keys stored as hashed values for security
- Tokens include userId and role claims

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
- Complete deployment documentation (DEPLOYMENT.md, QUICKSTART.md)
- First user auto-promoted to admin for easy setup
- Server target: 151.243.109.79