# Ibiki SMS API Middleware

## Overview
Ibiki SMS is a professional SMS API middleware platform designed to secure and manage SMS communication through ExtremeSMS. It hides ExtremeSMS credentials from clients while offering robust features for pricing management, credit control, and usage tracking. The platform includes a multi-client API key system with individual credit balances, real-time usage monitoring, and a comprehensive admin dashboard for system configuration and client management. Key capabilities include 2-way SMS support, live balance monitoring, and secure password reset functionality.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript, using Vite as the build tool. It leverages Shadcn/ui (Radix UI + Tailwind CSS) for a clean, B2B SaaS-inspired design, featuring Inter font for UI and JetBrains Mono for code, dark mode support, and responsive layouts. State management is handled by TanStack Query for server state and React hooks for local component state, with Wouter for client-side routing and role-based access control. The application supports English and Chinese languages, with preferences stored in localStorage.

### Backend Architecture
The backend is a Node.js Express.js server written in TypeScript. It uses JWT for dashboard/admin authentication and SHA-256 hashed API keys for client API requests, enforcing role-based authorization. An API proxy pattern authenticates requests, validates client credits, and forwards them to ExtremeSMS using the admin's credentials, while tracking usage and logging messages. The storage layer uses an abstract IStorage interface, with an in-memory implementation for development and PostgreSQL via Drizzle ORM for production. Session management is stateless, relying on JWT tokens, and API keys are securely stored and displayed. Credit management is admin-only, with all transactions logged for auditing.

### Data Storage
The project uses Drizzle ORM with a PostgreSQL dialect, specifically Neon serverless PostgreSQL. The schema includes tables for `users`, `apiKeys`, `clientProfiles`, `systemConfig`, `messageLogs`, `creditTransactions`, and `incomingMessages`. Drizzle Kit manages schema migrations. Database connection requires a `DATABASE_URL` environment variable.

### UI/UX Decisions
The design is inspired by Stripe Dashboard, Linear, and Vercel Dashboard, emphasizing clarity and information density. It features Inter font for general UI, JetBrains Mono for code and credentials, and supports dark mode. Responsive grid layouts ensure usability across devices.

### Feature Specifications
- **Multi-client API Key System**: Secure API key generation, masking, and revocation.
- **Credit Management**: Individual client credit balances, admin-only credit addition, and detailed transaction logging.
- **Usage Tracking**: Real-time monitoring of client API usage.
- **2-Way SMS Support**: Incoming SMS handling, routing to clients, and client-specific inboxes.
- **ExtremeSMS Integration**: Proxying of SMS sending, delivery reports, and balance checks.
- **Admin Dashboard**: Comprehensive system configuration, client management, and ExtremeSMS API testing.
- **Internationalization**: Full English and Chinese language support across the application.
- **Password Reset**: Secure password reset flow via email with token validation.
- **Live Data**: All statistics and activity logs are populated with real-time data.
- **Business Field Routing**: Advanced message routing based on business fields, conversation history, and assigned phone numbers.

## External Dependencies

- **Third-Party SMS Service**: ExtremeSMS (https://extremesms.net) for SMS gateway functionality.
- **HTTP Client**: Axios for API requests to ExtremeSMS.
- **Password Hashing**: bcryptjs for secure storage of user passwords.
- **Token Generation**: jsonwebtoken for JWT creation and verification.
- **Database Provider**: Neon serverless PostgreSQL via `@neondatabase/serverless`.
- **Email Service**: Resend for sending password reset emails.