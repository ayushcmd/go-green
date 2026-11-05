import {
  LayoutDashboard,
  Cpu,
  Binary,
  Gauge,
  Network,
  ShieldCheck,
  Activity,
  FlaskConical,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: (workers: number) => number | undefined;
}

export const navigationItems: NavigationItem[] = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/core-engine', label: 'Core Engine', icon: Cpu },
  { path: '/binary-lab', label: 'Binary Lab', icon: Binary },
  { path: '/profiler', label: 'Profiler', icon: Gauge },
  { path: '/distributed-mesh', label: 'Distributed Mesh', icon: Network, badge: (workers: number) => (workers > 0 ? workers : undefined) },
  { path: '/sandbox', label: 'Sandbox', icon: ShieldCheck },
  { path: '/system-monitor', label: 'System Monitor', icon: Activity },
  { path: '/experiments', label: 'Experiments', icon: FlaskConical },
  { path: '/logs', label: 'Logs & Traces', icon: ScrollText },
  { path: '/settings', label: 'Settings', icon: Settings },
];
