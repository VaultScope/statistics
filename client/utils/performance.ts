// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Memoize function
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    
    // Limit cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  }) as T;
}

// Request animation frame throttle
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  
  return function rafThrottled(...args: Parameters<T>) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func(...args);
        rafId = null;
      });
    }
  };
}

// Batch updates
export class BatchProcessor<T> {
  private queue: T[] = [];
  private timeoutId?: NodeJS.Timeout;
  private processing = false;

  constructor(
    private processor: (items: T[]) => void | Promise<void>,
    private delay = 100,
    private maxBatchSize = 50
  ) {}

  add(item: T) {
    this.queue.push(item);
    
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  async flush() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    
    const items = [...this.queue];
    this.queue = [];
    
    try {
      await this.processor(items);
    } finally {
      this.processing = false;
    }
  }
}

// Lazy import helper
export function lazyImport<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(factory);
}

// Performance observer
export class PerformanceObserver {
  private observer?: PerformanceObserver;
  private metrics: Map<string, number[]> = new Map();

  start() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) {
      return;
    }

    this.observer = new window.PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric(entry.name, entry.duration);
      }
    });

    this.observer.observe({ entryTypes: ['measure', 'navigation'] });
  }

  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics() {
    const result: Record<string, { avg: number; min: number; max: number }> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[name] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    }
    
    return result;
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Image lazy loading
export function lazyLoadImage(src: string, placeholder?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(src);
    img.onerror = reject;
    
    if (placeholder) {
      resolve(placeholder);
    }
    
    img.src = src;
  });
}

// Web Worker helper
export class WorkerPool<T, R> {
  private workers: Worker[] = [];
  private queue: Array<{
    data: T;
    resolve: (value: R) => void;
    reject: (error: any) => void;
  }> = [];
  private busy: Set<Worker> = new Set();

  constructor(
    private workerScript: string,
    private poolSize = navigator.hardwareConcurrency || 4
  ) {
    this.initializeWorkers();
  }

  private initializeWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerScript);
      this.workers.push(worker);
    }
  }

  async process(data: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0) return;

    const availableWorker = this.workers.find(w => !this.busy.has(w));
    if (!availableWorker) return;

    const task = this.queue.shift()!;
    this.busy.add(availableWorker);

    availableWorker.onmessage = (e) => {
      task.resolve(e.data);
      this.busy.delete(availableWorker);
      this.processQueue();
    };

    availableWorker.onerror = (e) => {
      task.reject(e);
      this.busy.delete(availableWorker);
      this.processQueue();
    };

    availableWorker.postMessage(task.data);
  }

  terminate() {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.queue = [];
    this.busy.clear();
  }
}

import React from 'react';