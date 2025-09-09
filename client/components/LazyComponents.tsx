import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// Loading component
export const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// Lazy load heavy components
// export const Dashboard = lazy(() => import('./Dashboard'));
// export const Analytics = lazy(() => import('./Analytics'));
// export const SystemMonitor = lazy(() => import('./SystemMonitor'));
// export const NetworkMonitor = lazy(() => import('./NetworkMonitor'));
// export const ProcessManager = lazy(() => import('./ProcessManager'));
// export const AlertsPanel = lazy(() => import('./AlertsPanel'));
// export const Settings = lazy(() => import('./Settings'));
// export const UserManagement = lazy(() => import('./UserManagement'));

// Wrapper component with error boundary
export const LazyBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
};

// Route-based code splitting configuration
export const routes: any[] = [
  // {
  //   path: '/',
  //   component: Dashboard,
  //   preload: true
  // },
  // {
  //   path: '/analytics',
  //   component: Analytics,
  //   preload: false
  // },
  // {
  //   path: '/system',
  //   component: SystemMonitor,
  //   preload: false
  // },
  // {
  //   path: '/network',
  //   component: NetworkMonitor,
  //   preload: false
  // },
  // {
  //   path: '/processes',
  //   component: ProcessManager,
  //   preload: false
  // },
  // {
  //   path: '/alerts',
  //   component: AlertsPanel,
  //   preload: false
  // },
  // {
  //   path: '/settings',
  //   component: Settings,
  //   preload: false
  // },
  // {
  //   path: '/users',
  //   component: UserManagement,
  //   preload: false
  // }
];

// Preload critical components
export const preloadComponents = () => {
  routes.forEach(route => {
    if (route.preload && route.component) {
      route.component.preload?.();
    }
  });
};