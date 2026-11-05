# GoGreen Development & Engineering Guide

## 1. Prerequisites
- Node.js >= 20.x (Current environment: v24.14.0)
- npm >= 10.x (Current environment: 11.20.0)
- Git >= 2.x

## 2. Quickstart
```bash
# Clone the repository
git clone https://github.com/ayushcmd/go-green.git
cd go-green

# Install dependencies
npm install

# Start development server
npm run dev

# Run unit tests
npm test

# Run TypeScript checks
npm run typecheck

# Run linting
npm run lint

# Build for production
npm run build

# Run Playwright end-to-end tests
npx playwright test
```

## 3. Directory Layout
```
go-green/
├── docs/                      # Technical architecture and design docs
├── src/
│   ├── app/                   # Root App, Router, and Providers
│   ├── components/
│   │   ├── charts/            # Recharts analytical components
│   │   ├── layout/            # AppShell, Sidebar, Topbar, Breadcrumbs
│   │   ├── terminal/          # Terminal, CodeViewer, HexViewer
│   │   └── ui/                # Core UI design primitives
│   ├── hooks/                 # Custom React hooks (keyboard shortcuts, telemetry)
│   ├── pages/                 # All 10 studio modules
│   ├── services/              # Binary parser, local storage, API clients
│   ├── styles/                # Global CSS and Tailwind directives
│   └── types/                 # Strict TypeScript domain interfaces
├── public/                    # Static assets, favicon, logo
├── index.html                 # Main entry HTML
├── tailwind.config.js         # NVIDIA green color palette & font configuration
├── vite.config.ts             # Vite build & Vitest test configuration
└── tsconfig.json              # Strict TypeScript compiler options
```

## 4. Architectural Rules
1. **Never fabricate operational data:** If a subsystem is offline, display `Not connected` or `No workers connected`.
2. **Never use prohibited labels:** Words like "Demo", "Dummy", "Mock Dashboard", "Placeholder", "Prototype" are forbidden in the user interface.
3. **Strict type safety:** Always define typed interfaces in `src/types/`. Do not bypass compiler type checking.
