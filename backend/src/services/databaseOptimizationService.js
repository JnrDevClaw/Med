import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getCountFromServer
} from 'firebase/firestore';

/**
 * Database Optimization Service
 * Optimizes Firestore queries, implements pagination, and manages database performance
 */
export class DatabaseOptimizationService {
  constructor(firestore, logger, cacheService) {
    this.firestore = firestore;
    this.logger = logger;
    this.cacheService = cacheService;
    
    // Query performance tracking
    this.queryStats = new Map();
    
    // Batch size configurations
    this.batchSizes = {
      questions: 20,
      answers: 50,
      comments: 100,
      notifications: 50,
      users: 25,
      consultations: 20
    };

    // Index recommendations
    this.recommendedIndexes = [
      {
        collection: 'questions',
        fields: [
          { fieldPath: 'category', order: 'ASCENDING' },
          { fieldPath: 'upvotes', order: 'DESCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'questions',
        fields: [
          { fieldPath: 'authorUsername', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'answers',
        fields: [
          { fieldPath: 'questionId', order: 'ASCENDING' },
          { fieldPath: 'isAccepted', order: 'DESCENDING' },
          { fieldPath: 'upvotes', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'comments',
        fields: [
          { fieldPath: 'parentId', order: 'ASCENDING' },
          { fieldPath: 'parentType', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'ASCENDING' }
        ]
      },
      {
        collection: 'notifications',
        fields: [
          { fieldPath: 'recipientUsername', order: 'ASCENDING' },
          { fieldPath: 'read', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'consultation_requests',
        fields: [
          { fieldPath: 'patientUsername', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'consultation_requests',
        fields: [
          { fieldPath: 'assignedDoctorUsername', order: 'ASCENDING' },
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'createdAt', order: 'DESCENDING' }
        ]
      },
      {
        collection: 'votes',
        fields: [
          { fieldPath: 'targetId', order: 'ASCENDING' },
          { fieldPath: 'targetType', order: 'ASCENDING' },
          { fieldPath: 'voterUsername', order: 'ASCENDING' }
        ]
      }
    ];
  }

  /**
   * Optimized pagination for large datasets
   */
  async getPaginatedResults(collectionName, options = {}) {
    const {
      filters = [],
      orderByField = 'createdAt',
      orderDirection = 'desc',
      limit = this.batchSizes[collectionName] || 20,
      lastDoc = null,
      useCache = true,
      cacheKey = null
    } = options;

    const queryKey = cacheKey || this.generateQueryKey(collectionName, filters, orderByField, orderDirection, limit);
    
    if (useCache) {
      try {
        return await this.cacheService.getQueryResult(queryKey, async () => {
          return await this.executePaginatedQuery(collectionName, options);
        });
      } catch (error) {
        this.logger.warn('Cache failed, executing query directly', { error: error.message });
      }
    }

    return await this.executePaginatedQuery(collectionName, options);
  }

  async executePaginatedQuery(collectionName, options) {
    const startTime = Date.now();
    
    try {
      const {
        filters = [],
        orderByField = 'createdAt',
        orderDirection = 'desc',
        limit = this.batchSizes[collectionName] || 20,
        lastDoc = null
      } = options;

      const collectionRef = collection(this.firestore, collectionName);
      let q = query(collectionRef);

      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });

      // Apply ordering
      q = query(q, orderBy(orderByField, orderDirection));

      // Apply pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      q = query(q, firestoreLimit(limit));

      const snapshot = await getDocs(q);
      const results = [];
      
      snapshot.forEach(doc => {
        results.push({
          id: doc.id,
          ...doc.data(),
          _doc: doc // Store document reference for pagination
        });
      });

      const queryTime = Date.now() - startTime;
      this.trackQueryPerformance(collectionName, queryTime, results.length);

      return {
        results,
        hasMore: results.length === limit,
        lastDoc: results.length > 0 ? results[results.length - 1]._doc : null,
        total: null // We don't calculate total for performance reasons
      };

    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.logger.error('Paginated query failed', {
        collectionName,
        queryTime,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Optimized count queries with caching
   */
  async getOptimizedCount(collectionName, filters = [], useCache = true) {
    const queryKey = `count:${this.generateQueryKey(collectionName, filters)}`;
    
    if (useCache) {
      try {
        return await this.cacheService.getQueryResult(queryKey, async () => {
          return await this.executeCountQuery(collectionName, filters);
        }, 300); // Cache for 5 minutes
      } catch (error) {
        this.logger.warn('Count cache failed, executing query directly', { error: error.message });
      }
    }

    return await this.executeCountQuery(collectionName, filters);
  }

  async executeCountQuery(collectionName, filters) {
    const startTime = Date.now();
    
    try {
      const collectionRef = collection(this.firestore, collectionName);
      let q = query(collectionRef);

      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });

      const snapshot = await getCountFromServer(q);
      const count = snapshot.data().count;

      const queryTime = Date.now() - startTime;
      this.trackQueryPerformance(`${collectionName}_count`, queryTime, 1);

      return count;

    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.logger.error('Count query failed', {
        collectionName,
        queryTime,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Batch operations for better performance
   */
  async batchGetDocuments(collectionName, documentIds, useCache = true) {
    if (documentIds.length === 0) return [];

    const queryKey = `batch:${collectionName}:${documentIds.sort().join(',')}`;
    
    if (useCache) {
      try {
        return await this.cacheService.getQueryResult(queryKey, async () => {
          return await this.executeBatchGet(collectionName, documentIds);
        });
      } catch (error) {
        this.logger.warn('Batch cache failed, executing query directly', { error: error.message });
      }
    }

    return await this.executeBatchGet(collectionName, documentIds);
  }

  async executeBatchGet(collectionName, documentIds) {
    const startTime = Date.now();
    
    try {
      // Split into chunks of 10 (Firestore limit for batch gets)
      const chunks = this.chunkArray(documentIds, 10);
      const allResults = [];

      for (const chunk of chunks) {
        const promises = chunk.map(id => 
          getDocs(query(collection(this.firestore, collectionName), where('__name__', '==', id)))
        );
        
        const snapshots = await Promise.all(promises);
        
        snapshots.forEach(snapshot => {
          snapshot.forEach(doc => {
            allResults.push({
              id: doc.id,
              ...doc.data()
            });
          });
        });
      }

      const queryTime = Date.now() - startTime;
      this.trackQueryPerformance(`${collectionName}_batch`, queryTime, allResults.length);

      return allResults;

    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.logger.error('Batch get failed', {
        collectionName,
        documentCount: documentIds.length,
        queryTime,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Lazy loading implementation
   */
  createLazyLoader(collectionName, baseQuery, batchSize = null) {
    const actualBatchSize = batchSize || this.batchSizes[collectionName] || 20;
    let lastDoc = null;
    let hasMore = true;
    let loading = false;

    return {
      async loadNext() {
        if (loading || !hasMore) {
          return { results: [], hasMore: false };
        }

        loading = true;
        
        try {
          const result = await this.getPaginatedResults(collectionName, {
            ...baseQuery,
            limit: actualBatchSize,
            lastDoc
          });

          lastDoc = result.lastDoc;
          hasMore = result.hasMore;
          
          return {
            results: result.results,
            hasMore: result.hasMore
          };

        } finally {
          loading = false;
        }
      },

      reset() {
        lastDoc = null;
        hasMore = true;
        loading = false;
      },

      get isLoading() {
        return loading;
      },

      get canLoadMore() {
        return hasMore && !loading;
      }
    };
  }

  /**
   * Connection pooling simulation (Firestore handles this internally)
   */
  async executeWithRetry(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        
        this.logger.warn(`Query attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: error.message
        });
      }
    }

    throw lastError;
  }

  /**
   * Rate limiting for API calls
   */
  createRateLimiter(maxRequests = 100, windowMs = 60000) {
    const requests = new Map();

    return {
      async checkLimit(identifier) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Clean old requests
        const userRequests = requests.get(identifier) || [];
        const validRequests = userRequests.filter(time => time > windowStart);
        
        if (validRequests.length >= maxRequests) {
          throw new Error('Rate limit exceeded');
        }
        
        validRequests.push(now);
        requests.set(identifier, validRequests);
        
        return true;
      }
    };
  }

  /**
   * Query performance tracking
   */
  trackQueryPerformance(queryType, executionTime, resultCount) {
    if (!this.queryStats.has(queryType)) {
      this.queryStats.set(queryType, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        totalResults: 0
      });
    }

    const stats = this.queryStats.get(queryType);
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.totalResults += resultCount;

    // Log slow queries
    if (executionTime > 2000) { // 2 seconds
      this.logger.warn('Slow query detected', {
        queryType,
        executionTime,
        resultCount
      });
    }
  }

  /**
   * Utility methods
   */
  generateQueryKey(collectionName, filters, orderBy = '', direction = '', limit = 0) {
    const filterStr = filters.map(f => `${f.field}${f.operator}${f.value}`).join('|');
    return `${collectionName}:${filterStr}:${orderBy}:${direction}:${limit}`;
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Performance monitoring and reporting
   */
  getPerformanceReport() {
    const report = {
      queryStats: Object.fromEntries(this.queryStats),
      cacheStats: this.cacheService.getStats(),
      recommendations: this.getPerformanceRecommendations()
    };

    return report;
  }

  getPerformanceRecommendations() {
    const recommendations = [];
    
    // Analyze query performance
    for (const [queryType, stats] of this.queryStats) {
      if (stats.avgTime > 1000) {
        recommendations.push({
          type: 'slow_query',
          message: `Query type '${queryType}' has high average execution time: ${stats.avgTime}ms`,
          suggestion: 'Consider adding appropriate indexes or optimizing query structure'
        });
      }
      
      if (stats.count > 1000 && stats.avgTime > 500) {
        recommendations.push({
          type: 'frequent_slow_query',
          message: `Query type '${queryType}' is frequently executed and slow`,
          suggestion: 'Consider caching results or denormalizing data'
        });
      }
    }

    // Cache performance recommendations
    const cacheStats = this.cacheService.getStats();
    if (cacheStats.hitRate < 0.5) {
      recommendations.push({
        type: 'low_cache_hit_rate',
        message: `Cache hit rate is low: ${Math.round(cacheStats.hitRate * 100)}%`,
        suggestion: 'Review caching strategy and TTL settings'
      });
    }

    return recommendations;
  }

  /**
   * Database health check
   */
  async performHealthCheck() {
    const health = {
      status: 'healthy',
      checks: {},
      issues: []
    };

    try {
      // Test basic connectivity
      const startTime = Date.now();
      await getDocs(query(collection(this.firestore, 'users'), firestoreLimit(1)));
      const connectionTime = Date.now() - startTime;
      
      health.checks.connectivity = {
        status: connectionTime < 1000 ? 'healthy' : 'slow',
        responseTime: connectionTime
      };

      if (connectionTime > 2000) {
        health.issues.push('Slow database connection');
        health.status = 'warning';
      }

      // Check query performance
      const avgQueryTime = Array.from(this.queryStats.values())
        .reduce((sum, stats) => sum + stats.avgTime, 0) / this.queryStats.size || 0;
      
      health.checks.queryPerformance = {
        status: avgQueryTime < 500 ? 'healthy' : 'slow',
        averageTime: avgQueryTime
      };

      if (avgQueryTime > 1000) {
        health.issues.push('High average query execution time');
        health.status = 'warning';
      }

      // Check cache performance
      const cacheHealth = this.cacheService.healthCheck();
      health.checks.cache = cacheHealth;
      
      if (cacheHealth.status !== 'healthy') {
        health.issues.push(...cacheHealth.issues);
        if (cacheHealth.status === 'critical') {
          health.status = 'critical';
        } else if (health.status === 'healthy') {
          health.status = 'warning';
        }
      }

    } catch (error) {
      health.status = 'critical';
      health.issues.push(`Database connectivity error: ${error.message}`);
      health.checks.connectivity = {
        status: 'failed',
        error: error.message
      };
    }

    return health;
  }

  /**
   * Cleanup and maintenance
   */
  resetPerformanceStats() {
    this.queryStats.clear();
    this.logger.info('Performance statistics reset');
  }

  getRecommendedIndexes() {
    return this.recommendedIndexes;
  }
}

export default DatabaseOptimizationService;