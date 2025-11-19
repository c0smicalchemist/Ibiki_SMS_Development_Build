# Ibiki SMS - Design Guidelines

## Design Approach

**Selected Approach:** Design System - Drawing from Stripe Dashboard + Linear + Vercel Dashboard  
**Rationale:** Developer-focused B2B SaaS tool requiring clarity, efficiency, and trust. Clean, modern aesthetic that prioritizes information density and usability.

## Core Design Elements

### Typography Hierarchy

**Font Stack:** Inter (Google Fonts) for UI + JetBrains Mono for code/API keys

- **Headlines (H1):** text-4xl font-bold tracking-tight
- **Section Headers (H2):** text-2xl font-semibold  
- **Subsections (H3):** text-xl font-semibold
- **Card Titles:** text-lg font-medium
- **Body Text:** text-base font-normal
- **Small Labels:** text-sm font-medium
- **Code/Credentials:** font-mono text-sm
- **Micro Copy:** text-xs

### Layout System

**Spacing Primitives:** Use Tailwind units 2, 4, 6, 8, 12, 16, 24  
- Component padding: p-4, p-6, p-8
- Section spacing: space-y-6, space-y-8, space-y-12
- Card gaps: gap-4, gap-6
- Page margins: mx-auto max-w-7xl px-4 sm:px-6 lg:px-8

**Grid Systems:**
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Admin tables: Full-width with horizontal scroll on mobile
- Documentation: Two-column split (sidebar navigation + content area)

## Page-Specific Layouts

### 1. Landing/Public Page (Pre-Login)

**Hero Section (60vh):**
- Centered layout with bold headline about API middleware/passthrough
- Subheading explaining value proposition
- Dual CTA buttons: "Get Started" (primary) + "View Documentation" (secondary)
- No hero image (keep clean and professional)

**Features Section:**
- 3-column grid showcasing: Secure API Proxy, Client Management, Real-time Monitoring
- Icon + title + 2-line description per card
- Cards with subtle borders, rounded corners (rounded-lg)

**Documentation Preview:**
- Code block showing sample Ibiki SMS API call
- Side-by-side comparison emphasizing simplicity

**Footer:**
- Company branding, quick links, contact information

### 2. Client Portal (Post-Login)

**Dashboard Layout:**
- Top navigation bar with logo, main nav, account dropdown
- Page title + breadcrumbs
- Stats cards in 3-column grid: Total Messages Sent, Current Balance, API Status (online/offline)
- "Your API Credentials" prominent card with copy-to-clipboard functionality

**API Documentation Page:**
- Fixed left sidebar (240px) with endpoint navigation
- Main content area (max-w-4xl) with:
  - Endpoint cards showing method badge (POST/GET), path, description
  - Code examples with syntax highlighting
  - Request/response tables
  - Try-it-now interactive form (optional per endpoint)
- Sticky "Authentication" reminder banner at top

### 3. Admin Dashboard

**Client List View:**
- Data table with columns: Client Name, Email, API Key (masked), Status, Messages Sent, Last Active, Actions
- Search/filter bar above table
- Pagination controls below

**Configuration Panel:**
- Dedicated page with form to update ExtremeSMS credentials
- Clear warning about production impact
- "Test Connection" button before saving

**Monitoring Dashboard:**
- Real-time activity feed showing recent API calls
- Charts showing usage over time (line chart)
- Error rate metrics

## Component Library

### Navigation
- **Top Nav:** Horizontal with logo left, nav items center, user menu right
- **Sidebar:** Vertical navigation for docs with collapsible sections

### Forms
- **Input Fields:** Full-width with labels above, rounded-md borders, focus rings
- **Buttons:** Primary (solid), Secondary (outlined), Ghost (text-only)
- **Copy Buttons:** Icon-only with tooltip, positioned inline with credentials

### Cards
- **Stat Cards:** Icon, metric number (large), label (small), subtle gradient backgrounds
- **Content Cards:** Padding p-6, rounded-lg borders, hover state with slight shadow
- **API Endpoint Cards:** Method badge (colored pill), monospace path, collapsible details

### Tables
- **Admin Tables:** Striped rows, sticky header, compact spacing, action dropdown per row
- **Responsive:** Stack on mobile with card-like presentation

### Code Blocks
- Syntax-highlighted with copy button
- Dark theme for code (regardless of page theme)
- Line numbers for multi-line examples

### Badges/Pills
- **Status Indicators:** Small rounded-full pills (Active/Inactive, Online/Offline)
- **HTTP Methods:** POST (one style), GET (another), colored consistently

### Overlays
- **Modals:** Centered, max-w-lg, backdrop blur
- **Toasts:** Top-right corner for success/error notifications

## Key Interactions

- **Copy-to-Clipboard:** One-click with visual feedback (checkmark animation)
- **API Key Masking:** Show/hide toggle with eye icon
- **Collapsible Sections:** Smooth expand/collapse for API endpoint details
- **Form Validation:** Inline error messages, real-time validation
- **Loading States:** Skeleton screens for tables, spinners for actions

## Accessibility & Polish

- All interactive elements have focus states with visible outlines
- Consistent 4.5:1 contrast ratios throughout
- Keyboard navigation supported
- ARIA labels for icon-only buttons
- Consistent spacing rhythm creates professional, trustworthy appearance
- Generous whitespace prevents information overwhelm despite density