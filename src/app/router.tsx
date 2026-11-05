import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

const OverviewPage = lazy(() => import('@/pages/Overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const CoreEnginePage = lazy(() => import('@/pages/CoreEngine/CoreEnginePage').then((m) => ({ default: m.CoreEnginePage })));
const BinaryLabPage = lazy(() => import('@/pages/BinaryLab/BinaryLabPage').then((m) => ({ default: m.BinaryLabPage })));
const ProfilerPage = lazy(() => import('@/pages/Profiler/ProfilerPage').then((m) => ({ default: m.ProfilerPage })));
const DistributedMeshPage = lazy(() => import('@/pages/DistributedMesh/DistributedMeshPage').then((m) => ({ default: m.DistributedMeshPage })));
const SandboxPage = lazy(() => import('@/pages/Sandbox/SandboxPage').then((m) => ({ default: m.SandboxPage })));
const SystemMonitorPage = lazy(() => import('@/pages/SystemMonitor/SystemMonitorPage').then((m) => ({ default: m.SystemMonitorPage })));
const ExperimentsPage = lazy(() => import('@/pages/Experiments/ExperimentsPage').then((m) => ({ default: m.ExperimentsPage })));
const LogsPage = lazy(() => import('@/pages/Logs/LogsPage').then((m) => ({ default: m.LogsPage })));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center h-64 font-mono text-xs text-gogreen-primary">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gogreen-bright animate-ping" />
          <span>INITIALIZING LABORATORY MODULE...</span>
        </div>
      </div>
    }
  >
    {children}
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <SuspenseWrapper><OverviewPage /></SuspenseWrapper> },
      { path: 'core-engine', element: <SuspenseWrapper><CoreEnginePage /></SuspenseWrapper> },
      { path: 'binary-lab', element: <SuspenseWrapper><BinaryLabPage /></SuspenseWrapper> },
      { path: 'profiler', element: <SuspenseWrapper><ProfilerPage /></SuspenseWrapper> },
      { path: 'distributed-mesh', element: <SuspenseWrapper><DistributedMeshPage /></SuspenseWrapper> },
      { path: 'sandbox', element: <SuspenseWrapper><SandboxPage /></SuspenseWrapper> },
      { path: 'system-monitor', element: <SuspenseWrapper><SystemMonitorPage /></SuspenseWrapper> },
      { path: 'experiments', element: <SuspenseWrapper><ExperimentsPage /></SuspenseWrapper> },
      { path: 'logs', element: <SuspenseWrapper><LogsPage /></SuspenseWrapper> },
      { path: 'settings', element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
