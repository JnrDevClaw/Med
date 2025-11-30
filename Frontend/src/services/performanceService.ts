import { api } from '../utils/api';

export interface PerformanceStats {
  queryStats: Record<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
    totalResults: number;
  }>;
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
    caches: Record<string, {
      keys: number;
      stats: any;
    }>;
  };
  recommendations: Array<{
    type: string;
    message: string;
    suggestion: string;
  }>;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  checks: Record<string, {
    status: string;
    responseTime?: number;
    averageTime?: number;
    error?: string;
  }>;
  issues: string[];
}

export class PerformanceService {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Client-side caching
   */
  static setCache(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  static getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  static clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Cached API calls
   */
  static async getCachedData<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    // Check cache first
    const cached = this.getCache(key);
    if (cached) {
      return cached;
    }

    // Fetch data
    const data = await fetchFunction();
    
    // Cache the result
    this.setCache(key, data, ttl);
    
    return data;
  }

  /**
   * Performance monitoring
   */
  static async getPerformanceStats(): Promise<PerformanceStats> {
    return this.getCachedData(
      'performance:stats',
      async () => {
        const response = await api.get('/performance/stats');
        return response.stats;
      },
      2 * 60 * 1000 // 2 minutes cache
    );
  }

  static async getSystemHealth(): Promise<SystemHealth> {
    return this.getCachedData(
      'performance:health',
      async () => {
        const response = await api.get('/performance/health');
        return response.health;
      },
      1 * 60 * 1000 // 1 minute cache
    );
  }

  /**
   * Lazy loading utilities
   */
  static createLazyLoader<T>(
    fetchFunction: (offset: number, limit: number) => Promise<{ results: T[]; hasMore: boolean }>,
    batchSize: number = 20
  ) {
    let offset = 0;
    let loading = false;
    let hasMore = true;
    let allResults: T[] = [];

    return {
      async loadNext(): Promise<{ results: T[]; hasMore: boolean; total: number }> {
        if (loading || !hasMore) {
          return { results: [], hasMore: false, total: allResults.length };
        }

        loading = true;
        
        try {
          const result = await fetchFunction(offset, batchSize);
          
          allResults = [...allResults, ...result.results];
          offset += result.results.length;
          hasMore = result.hasMore;
          
          return {
            results: result.results,
            hasMore: result.hasMore,
            total: allResults.length
          };
        } finally {
          loading = false;
        }
      },

      reset() {
        offset = 0;
        loading = false;
        hasMore = true;
        allResults = [];
      },

      get isLoading() {
        return loading;
      },

      get canLoadMore() {
        return hasMore && !loading;
      },

      get allResults() {
        return [...allResults];
      }
    };
  }

  /**
   * Image lazy loading
   */
  static setupImageLazyLoading(): void {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      });

      // Observe all images with data-src attribute
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  /**
   * Debounce utility for search and input
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle utility for scroll and resize events
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Virtual scrolling helper
   */
  static createVirtualScroller<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    buffer: number = 5
  ) {
    let scrollTop = 0;
    
    return {
      updateScrollTop(newScrollTop: number) {
        scrollTop = newScrollTop;
      },

      getVisibleItems() {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
        const endIndex = Math.min(
          items.length - 1,
          Math.floor((scrollTop + containerHeight) / itemHeight) + buffer
        );

        return {
          startIndex,
          endIndex,
          visibleItems: items.slice(startIndex, endIndex + 1),
          offsetY: startIndex * itemHeight,
          totalHeight: items.length * itemHeight
        };
      }
    };
  }

  /**
   * Performance measurement
   */
  static measurePerformance<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const startTime = performance.now();
      
      try {
        const result = await operation();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
        
        // Log slow operations
        if (duration > 1000) {
          console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
        }
        
        resolve(result);
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.error(`Performance: ${name} failed after ${duration.toFixed(2)}ms`, error);
        reject(error);
      }
    });
  }

  /**
   * Memory usage monitoring
   */
  static getMemoryUsage(): any {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        usagePercentage: ((performance as any).memory.usedJSHeapSize / (performance as any).memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }

  /**
   * Network performance monitoring
   */
  static monitorNetworkRequests(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            console.log('Navigation timing:', {
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
              totalTime: navEntry.loadEventEnd - navEntry.fetchStart
            });
          }
          
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.duration > 1000) {
              console.warn('Slow resource:', {
                name: resourceEntry.name,
                duration: resourceEntry.duration,
                size: resourceEntry.transferSize
              });
            }
          }
        });
      });

      observer.observe({ entryTypes: ['navigation', 'resource'] });
    }
  }

  /**
   * Bundle size analysis
   */
  static analyzeBundleSize(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const jsResources = entries.filter(entry => 
          entry.name.includes('.js') && entry.entryType === 'resource'
        ) as PerformanceResourceTiming[];

        const totalJSSize = jsResources.reduce((total, entry) => 
          total + (entry.transferSize || 0), 0
        );

        console.log('Bundle analysis:', {
          totalJSFiles: jsResources.length,
          totalJSSize: `${(totalJSSize / 1024).toFixed(2)} KB`,
          largestJS: jsResources.sort((a, b) => 
            (b.transferSize || 0) - (a.transferSize || 0)
          )[0]
        });
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  /**
   * Cache management for development
   */
  static async clearServerCache(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      try {
        await api.post('/performance/cache/clear');
        console.log('Server cache cleared');
      } catch (error) {
        console.error('Failed to clear server cache:', error);
      }
    }
  }

  static async cleanupServerCache(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      try {
        const response = await api.post('/performance/cache/cleanup');
        console.log('Server cache cleanup:', response.message);
      } catch (error) {
        console.error('Failed to cleanup server cache:', error);
      }
    }
  }

  /**
   * Client-side cache statistics
   */
  static getCacheStats() {
    const stats = {
      totalKeys: this.cache.size,
      memoryUsage: 0,
      oldestEntry: null as Date | null,
      newestEntry: null as Date | null
    };

    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const [key, value] of this.cache.entries()) {
      // Estimate memory usage (rough calculation)
      stats.memoryUsage += JSON.stringify(value.data).length;
      
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        stats.oldestEntry = new Date(value.timestamp);
      }
      
      if (value.timestamp > newestTimestamp) {
        newestTimestamp = value.timestamp;
        stats.newestEntry = new Date(value.timestamp);
      }
    }

    return stats;
  }
}

export default PerformanceService;