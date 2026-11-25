import { useState, useEffect, useCallback } from 'react';
import { AppRouteId, hashToRoute, routeToHash } from '../types/navigation';

export function useHashRouter(defaultRoute: AppRouteId = 'home') {
  const [route, setRoute] = useState<AppRouteId>(() => {
    if (typeof window === 'undefined') return defaultRoute;
    return window.location.hash ? hashToRoute(window.location.hash) : defaultRoute;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.location.hash) {
      window.history.replaceState(null, '', routeToHash(defaultRoute));
    }

    const onHashChange = () => {
      const next = hashToRoute(window.location.hash);
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [defaultRoute]);

  const navigate = useCallback((nextRoute: AppRouteId, replace = false) => {
    const targetHash = routeToHash(nextRoute);
    setRoute(nextRoute);

    if (typeof window !== 'undefined') {
      if (window.location.hash !== targetHash) {
        if (replace) {
          window.history.replaceState(null, '', targetHash);
        } else {
          window.location.hash = targetHash;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const goHome = useCallback(() => {
    navigate('home');
  }, [navigate]);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1 && route !== 'home') {
      window.history.back();
    } else {
      navigate('home');
    }
  }, [navigate, route]);

  return {
    route,
    navigate,
    goHome,
    goBack,
  };
}
