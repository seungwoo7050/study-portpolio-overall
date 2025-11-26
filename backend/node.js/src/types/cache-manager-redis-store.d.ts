declare module 'cache-manager-redis-store' {
  import { CacheStoreFactory, CacheStore } from 'cache-manager';

  const redisStore: CacheStoreFactory | (() => CacheStore);
  export { redisStore };
  export default redisStore;
}
