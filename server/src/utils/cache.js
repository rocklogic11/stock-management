const NodeCache = require('node-cache');
const Redis = require('ioredis');

// 缓存模式: 'redis' 或 'memory'
let cacheMode = 'none';
let redisClient = null;
let memoryCache = null;

function shouldUseMemoryCache() {
  if (process.env.CACHE_MEMORY_ENABLED === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

function disableCache() {
  cacheMode = 'none';
  memoryCache = null;
  console.log('[Cache] Memory cache disabled');
}

// 初始化Redis连接
const initRedis = () => {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true, // 不立即连接
    });

    redisClient.on('connect', () => {
      console.log('[Cache] Redis连接成功');
      cacheMode = 'redis';
    });

    redisClient.on('error', (err) => {
      console.log('[Cache] Redis连接失败，降级到内存模式:', err.message);
      cacheMode = 'memory';
      redisClient = null;
    });

    // 尝试连接
    redisClient.connect().catch(() => {
      console.log('[Cache] Redis不可用，使用内存缓存');
      cacheMode = 'memory';
      redisClient = null;
    });
  } catch (error) {
    console.log('[Cache] Redis初始化失败，使用内存缓存:', error.message);
    cacheMode = 'memory';
  }
};

// 初始化内存缓存
const initMemory = () => {
  memoryCache = new NodeCache({
    stdTTL: 300,  // 5分钟过期
    checkperiod: 60,  // 每60秒检查一次过期项
    useClones: false  // 不克隆对象，提升性能
  });
  console.log('[Cache] 内存缓存初始化完成');
};

// 初始化缓存（自动选择Redis或内存）
const init = () => {
  if (process.env.REDIS_ENABLED === 'true') {
    initRedis();
  } else if (shouldUseMemoryCache()) {
    initMemory();
  } else {
    disableCache();
  }
};

// 获取缓存
const get = async (key) => {
  try {
    if (cacheMode === 'redis' && redisClient) {
      const value = await redisClient.get(key);
      if (value) {
        console.log(`[Cache] HIT: ${key}`);
        return JSON.parse(value);
      }
    } else if (memoryCache) {
      const value = memoryCache.get(key);
      if (value) {
        console.log(`[Cache] HIT: ${key}`);
        return value;
      }
    }
    console.log(`[Cache] MISS: ${key}`);
    return null;
  } catch (error) {
    console.error('[Cache] GET错误:', error.message);
    return null;
  }
};

// 设置缓存
const set = async (key, value, ttl = null) => {
  try {
    const stringValue = JSON.stringify(value);
    
    if (cacheMode === 'redis' && redisClient) {
      if (ttl) {
        await redisClient.setex(key, ttl, stringValue);
      } else {
        await redisClient.set(key, stringValue);
      }
    } else if (memoryCache) {
      if (ttl) {
        memoryCache.set(key, value, ttl);
      } else {
        memoryCache.set(key, value);
      }
    }

    if (cacheMode === 'none') {
      return false;
    }
    
    console.log(`[Cache] SET: ${key}`);
    return true;
  } catch (error) {
    console.error('[Cache] SET错误:', error.message);
    return false;
  }
};

// 删除缓存
const del = async (key) => {
  try {
    if (cacheMode === 'redis' && redisClient) {
      await redisClient.del(key);
    } else if (memoryCache) {
      memoryCache.del(key);
    }
    console.log(`[Cache] DEL: ${key}`);
    return true;
  } catch (error) {
    console.error('[Cache] DEL错误:', error.message);
    return false;
  }
};

// 根据前缀删除所有相关缓存
const delByPrefix = async (prefix) => {
  try {
    if (cacheMode === 'redis' && redisClient) {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`[Cache] DEL BY PREFIX: ${prefix} (${keys.length} keys)`);
      }
    } else if (memoryCache) {
      const keys = memoryCache.keys().filter(key => key.startsWith(prefix));
      if (keys.length > 0) {
        memoryCache.del(keys);
        console.log(`[Cache] DEL BY PREFIX: ${prefix} (${keys.length} keys)`);
      }
    }
    return true;
  } catch (error) {
    console.error('[Cache] DEL BY PREFIX错误:', error.message);
    return false;
  }
};

// 清空所有缓存
const flush = async () => {
  try {
    if (cacheMode === 'redis' && redisClient) {
      await redisClient.flushdb();
    } else if (memoryCache) {
      memoryCache.flushAll();
    }
    console.log('[Cache] FLUSH ALL');
    return true;
  } catch (error) {
    console.error('[Cache] FLUSH错误:', error.message);
    return false;
  }
};

// 获取缓存统计
const getStats = () => {
  if (cacheMode === 'redis' && redisClient) {
    return { mode: 'redis', connected: redisClient.status === 'ready' };
  } else if (memoryCache) {
    return { mode: 'memory', stats: memoryCache.getStats() };
  }
  return { mode: 'none' };
};

// 缓存键前缀
const PREFIX = {
  PRODUCTS: 'products:',
  CATEGORIES: 'categories:',
  STOCK: 'stock:',
  DASHBOARD: 'dashboard:'
};

// 生成缓存键
const keys = {
  // 商品列表（带查询参数）
  productList: (query) => {
    const sortedQuery = Object.keys(query || {})
      .sort()
      .reduce((acc, key) => {
        if (query[key] !== undefined && query[key] !== '') {
          acc[key] = query[key];
        }
        return acc;
      }, {});
    return `${PREFIX.PRODUCTS}list:${JSON.stringify(sortedQuery)}`;
  },

  // 单个商品
  product: (id) => `${PREFIX.PRODUCTS}${id}`,

  // 分类列表
  categoryList: () => `${PREFIX.CATEGORIES}list`,

  // 库存汇总
  stockSummary: () => `${PREFIX.STOCK}summary`,

  // 仪表盘统计
  dashboardStats: () => `${PREFIX.DASHBOARD}stats`
};

// 清除所有商品相关缓存
const clearProductCache = async () => {
  await delByPrefix(PREFIX.PRODUCTS);
};

// 清除所有分类相关缓存
const clearCategoryCache = async () => {
  await delByPrefix(PREFIX.CATEGORIES);
};

// 清除所有库存相关缓存
const clearStockCache = async () => {
  await delByPrefix(PREFIX.STOCK);
};

// 清除所有仪表盘缓存
const clearDashboardCache = async () => {
  await delByPrefix(PREFIX.DASHBOARD);
};

// 初始化
init();

module.exports = {
  get,
  set,
  del,
  delByPrefix,
  flush,
  getStats,
  keys,
  clearProductCache,
  clearCategoryCache,
  clearStockCache,
  clearDashboardCache,
  PREFIX
};
