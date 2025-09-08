import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { debounce, throttle } from '../utils/performance';

// Custom hook for optimized state management
export function useOptimizedState<T>(initialValue: T, delay = 0) {
  const [state, setState] = useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setOptimizedState = useCallback((newValue: T | ((prev: T) => T)) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setState(newValue);
      }, delay);
    } else {
      setState(newValue);
    }
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setOptimizedState] as const;
}

// Hook for debounced state
export function useDebouncedState<T>(initialValue: T, delay = 500) {
  const [value, setValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);

  const debouncedSetValue = useMemo(
    () => debounce((newValue: T) => setDebouncedValue(newValue), delay),
    [delay]
  );

  useEffect(() => {
    debouncedSetValue(value);
  }, [value, debouncedSetValue]);

  return [value, setValue, debouncedValue] as const;
}

// Hook for throttled state
export function useThrottledState<T>(initialValue: T, delay = 500) {
  const [value, setValue] = useState<T>(initialValue);
  const [throttledValue, setThrottledValue] = useState<T>(initialValue);

  const throttledSetValue = useMemo(
    () => throttle((newValue: T) => setThrottledValue(newValue), delay),
    [delay]
  );

  useEffect(() => {
    throttledSetValue(value);
  }, [value, throttledSetValue]);

  return [value, setValue, throttledValue] as const;
}

// Hook for lazy loading with intersection observer
export function useLazyLoad(threshold = 0.1) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return [ref, isIntersecting] as const;
}

// Hook for virtual scrolling
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  };
}

// Hook for memoized expensive computations
export function useMemoizedComputation<T>(
  compute: () => T,
  deps: React.DependencyList
): T {
  const computationRef = useRef<{ value: T; deps: React.DependencyList }>();

  if (
    !computationRef.current ||
    !areDepsEqual(computationRef.current.deps, deps)
  ) {
    computationRef.current = {
      value: compute(),
      deps
    };
  }

  return computationRef.current.value;
}

// Hook for request deduplication
export function useRequestDeduplication<T>(
  fetcher: () => Promise<T>,
  key: string
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestRef = useRef<Promise<T> | null>(null);

  const execute = useCallback(async () => {
    if (requestRef.current) {
      return requestRef.current;
    }

    setLoading(true);
    setError(null);

    requestRef.current = fetcher();

    try {
      const result = await requestRef.current;
      setData(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
      requestRef.current = null;
    }
  }, [fetcher]);

  return { data, loading, error, execute };
}

// Helper function to compare dependencies
function areDepsEqual(deps1: React.DependencyList, deps2: React.DependencyList): boolean {
  if (deps1.length !== deps2.length) return false;
  
  for (let i = 0; i < deps1.length; i++) {
    if (!Object.is(deps1[i], deps2[i])) return false;
  }
  
  return true;
}