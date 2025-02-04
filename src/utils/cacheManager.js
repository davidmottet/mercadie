import Redis from 'redis';
import config from '../config/default.js';

class CacheManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.localCache = new Map();

    // Tentative de connexion à Redis
    this.initRedis();
  }

  async initRedis() {
    try {
      this.client = Redis.createClient({
        url: config.cache.redisUrl
      });

      this.client.on('error', (err) => {
        console.error('Redis non disponible, utilisation du cache local:', err);
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Redis connecté');
    } catch (error) {
      console.error('⚠️ Erreur lors de la connexion à Redis:', error);
      this.isConnected = false;
    }
  }

  async get(key) {
    try {
      if (this.isConnected) {
        return await this.client.get(key);
      }
      return this.localCache.get(key);
    } catch (error) {
      console.error(`Erreur lors de la récupération de la clé ${key}:`, error);
      return this.localCache.get(key);
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      if (this.isConnected) {
        await this.client.setEx(key, ttl, value);
      }
      this.localCache.set(key, value);
    } catch (error) {
      console.error(`Erreur lors de la définition de la clé ${key}:`, error);
      this.localCache.set(key, value);
    }
  }

  async del(key) {
    try {
      if (this.isConnected) {
        await this.client.del(key);
      }
      this.localCache.delete(key);
    } catch (error) {
      console.error(`Erreur lors de la suppression de la clé ${key}:`, error);
      this.localCache.delete(key);
    }
  }
}

export default new CacheManager();