# GoGreen UI Design System & Technical Tokens

## 1. Visual Language & Aesthetics
GoGreen adheres to an NVIDIA-inspired bright green industrial engineering visual system. It emphasizes clarity, high contrast, compact technical layouts, and zero visual fluff.

### 1.1 Color Tokens
| Semantic Name | Hex Value | Usage |
| :--- | :--- | :--- |
| `primary` | `#76FF03` | Primary brand accent, active navigation items, status online |
| `bright` | `#39FF14` | High-visibility focal points, terminal prompts, active toggles |
| `secondary` | `#00C853` | Stable indicators, completed jobs, verified benchmark results |
| `dark` | `#0B1C10` | High-contrast sub-panels, badge backgrounds, selected rows |
| `bg-main` | `#080B09` | Root viewport canvas background |
| `bg-secondary` | `#0D120F` | Sidebar, top header, card title ribbons |
| `bg-panel` | `#111712` | Main analytical cards, tables, hex grid container |
| `bg-elevated` | `#18211B` | Modals, command palette dropdowns, tooltips, flyouts |
| `border-primary` | `#263629` | Structural dividers, panel borders, table cell outlines |
| `text-primary` | `#E8F0EA` | Primary titles, code, high-importance data values |
| `text-secondary` | `#92A096` | Metadata, unit labels, inactive tab headers, timestamps |
| `warning` | `#F2B84B` | Thermal warnings, queued jobs, resource contention alerts |
| `error` | `#FF6464` | Disconnected status, execution failure, panic traps |

### 1.2 Typography
- **Primary Interface Font:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Technical Monospace Font:** `JetBrains Mono`, "Cascadia Code", "Fira Code", monospace

### 1.3 Layout & Elevation
- Grid System: 12-column responsive grid with tight gutters (`gap-4`, `gap-6`).
- Elevation: Rather than heavy drop shadows, elevation is achieved via contrast steps:
  - Base: `#080B09`
  - Panel: `#111712` (Border: 1px solid `#263629`)
  - Elevated: `#18211B` (Border: 1px solid `#39FF14` with low opacity)

### 1.4 Component Patterns
- **Status Indicators:** Crisp circular badges with pulse animation for active states.
- **Data Tables:** Dense monospace-aligned rows with column sorting and zebra striping.
- **Empty States:** Clear, technical illustrations and honest status messages (`Not connected`, `No workers connected`).
- **Interactive Terminals:** Monospace prompt with command history, raw output streaming, and syntax coloring.
