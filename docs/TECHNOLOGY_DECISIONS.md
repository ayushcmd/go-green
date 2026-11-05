# GoGreen Technology Decisions Record (TDR)

## TDR 001: Frontend Framework & Build Tool
- **Decision:** React 19 + TypeScript + Vite
- **Rationale:** Vite delivers sub-second Hot Module Replacement (HMR) and optimized Rollup-based production builds. TypeScript strict mode guarantees type safety across complex binary structures and telemetry feeds.
- **Alternatives Considered:** Next.js (rejected due to unnecessary SSR complexity for an internal systems laboratory desktop/web hybrid interface).

## TDR 002: Styling & Design System
- **Decision:** Tailwind CSS with custom design tokens in `tailwind.config.js`.
- **Rationale:** Allows granular control over NVIDIA-inspired dark green color scales (`#76FF03`, `#39FF14`, `#080B09`), monospace typography, and microarchitectural grid layouts without heavyweight external component library bloat.
- **Alternatives Considered:** Material UI, Chakra UI (both rejected because their pre-baked aesthetics conflict with low-level industrial hardware aesthetics).

## TDR 003: Client-Side Binary Processing
- **Decision:** Custom `ArrayBuffer` & `DataView` parsing routines for ELF (Executable and Linkable Format) and PE (Portable Executable) binaries.
- **Rationale:** Users can inspect local binaries immediately inside the browser without transmitting large binaries over network connections before remote analysis clusters are online.
- **Supported Formats:** ELF32/64, PE32/PE32+.

## TDR 004: State Management & Telemetry Cache
- **Decision:** Zustand + TanStack Query
- **Rationale:** TanStack Query handles server state, caching, refetching, and offline/reconnection status. Zustand provides lightweight, zero-boilerplate local UI state for command palette, navigation, and binary viewer offsets.

## TDR 005: Testing Frameworks
- **Decision:** Vitest + React Testing Library + Playwright
- **Rationale:** Vitest shares the same configuration and pipeline as Vite, ensuring rapid unit and component test execution. Playwright provides cross-browser E2E verification of critical navigation and analysis workflows.
