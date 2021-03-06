import Redis from 'ioredis';
import Debug from 'debug';
const debug = Debug('trpg:cache');
import _ from 'lodash';
import minimatch from 'minimatch';
import { sleep } from 'lib/helper/utils';

export type CacheValue = string | number | {};
interface CacheOptions {
  /**
   * 过期时间
   * 单位为毫秒
   */
  expires: number;
}
interface RedisOpts {
  url: string;
}

interface LockScopeOpts {
  /**
   * 任务完成后延迟解锁 单位毫秒
   */
  unlockDelay: number;
}

const defaultOption: CacheOptions = {
  expires: 1000 * 60 * 60 * 24, // 默认缓存一天, 0为不过期
};

export interface ICache {
  set(
    key: string,
    value: CacheValue,
    options?: CacheOptions
  ): Promise<CacheValue>;

  /**
   * 往列表末尾追加数据
   * @param key 唯一键
   * @param values 追加的数据
   */
  rpush(key: string, ...values: any[]): Promise<void>;

  /**
   * 清理列表一定范围内的数据
   * @param key 唯一键
   * @param start 起始索引
   * @param size 清理列表长度
   */
  lclear(key: string, start: number, size: number): Promise<void>;

  /**
   * 返回存储中符合条件的键值列表
   * @param glob 匹配规则
   */
  keys(glob: string): Promise<string[]>;
  get(key: string): Promise<CacheValue>;
  getWithGlob(glob: string): Promise<{ [key: string]: CacheValue }>;

  /**
   * 获取列表的所有内容
   * @param key 键
   */
  lget(key: string): Promise<CacheValue[]>;

  /**
   * 设置指定索引位置的列表的值
   * @param key 键
   * @param index 索引
   * @param value 值
   */
  lset(key: string, index: number, value: CacheValue): Promise<CacheValue>;

  /**
   * 向集合中放入一个值，该值在集合中只能存在一个
   * @param key 键
   * @param value 值
   */
  sadd(key: string, value: CacheValue): Promise<void>;

  /**
   * 从集合中移除一个值
   * @param key 键
   * @param value 值
   */
  srem(key: string, ...values: CacheValue[]): Promise<void>;

  /**
   * 返回集合中的所有的成员
   * @param key 键
   */
  smembers(key: string): Promise<CacheValue[]>;

  /**
   * 判定是否在该set中
   * @param key 键
   * @param value 值
   */
  sismember(key: string, value: CacheValue): Promise<boolean>;

  remove(key: string): Promise<any>;
  close(): void;

  /**
   * 分布式锁
   * 自定过期时间: 10秒
   * NOTE: 仅redis缓存有效
   */
  lock(key: string): Promise<boolean>;
  unlock(key: string): Promise<void>;
  /**
   * 创建一个锁范围
   * 进入时加锁
   * 离开时解锁
   * 如果没有取到锁。则跳过
   * @param key 锁名
   * @param scope 锁作用范围
   */
  lockScope(
    key: string,
    scope: () => Promise<void>,
    options?: LockScopeOpts
  ): Promise<void>;
}

export class Cache implements ICache {
  data = {};

  set(
    key: string,
    value: CacheValue,
    options: CacheOptions
  ): Promise<CacheValue> {
    options = Object.assign({}, defaultOption, options);

    debug('[cache]', `set ${key} to ${JSON.stringify(value)}`);
    // this.data[key] = value;
    _.set(this.data, [key, 'rawData'], value);
    if (options.expires > 0) {
      _.set(
        this.data,
        [key, 'expires'],
        new Date().valueOf() + options.expires
      );
    }
    return Promise.resolve(value);
  }

  rpush(key: string, ...values: any[]): Promise<void> {
    if (!this.data[key] || !Array.isArray(this.data[key])) {
      this.data[key] = [];
    }

    this.data[key].push(...values);
    debug(
      '[cache]',
      `rpush ${key} with ${values.map((s) => JSON.stringify(s)).join(',')}`
    );
    return Promise.resolve();
  }

  lclear(key: string, start: number, size: number): Promise<void> {
    if (!this.data[key] || !Array.isArray(this.data[key])) {
      return;
    }

    const arr: any[] = this.data[key];
    arr.splice(start, size);
    debug('[cache]', `lclear ${key} in range [${start}, ${start + size}]`);

    return Promise.resolve();
  }

  keys(glob: string): Promise<string[]> {
    return Promise.resolve(
      Object.keys(this.data).filter(minimatch.filter(glob))
    );
  }

  get(key: string): Promise<CacheValue> {
    const tmp = this.data[key];
    // IDEA: 这里可以考虑过期不删除。而是不返回数据。因为会被后面的set操作覆盖。是一种懒操作
    if (tmp) {
      if (!tmp.expires || tmp.expires < new Date().valueOf()) {
        // 若expires不存在或expires存在但尚未过期
        return Promise.resolve(_.clone(tmp.rawData));
      }
    }
    return Promise.resolve(null);
  }

  async getWithGlob(glob: string): Promise<{ [key: string]: CacheValue }> {
    const keys = await this.keys(glob);
    if (keys.length > 0) {
      const values = keys
        .map((key) => this.data[key])
        .filter((x) => !x.expires || x.expires < new Date().valueOf())
        .map((val) => val.rawData);
      return _.clone(_.zipObject(keys, values));
    }
    return null;
  }

  async lget(key: string): Promise<CacheValue[]> {
    // NOTE: 列表没有过期机制. 因此不走内部的get
    const arr = _.clone(this.data[key]);

    if (Array.isArray(arr)) {
      return arr;
    } else {
      return [arr];
    }
  }

  async lset(
    key: string,
    index: number,
    value: CacheValue
  ): Promise<CacheValue> {
    _.set(this.data, [key, index], value);

    return value;
  }

  async sadd(key: string, value: CacheValue): Promise<void> {
    let data: Set<CacheValue> = this.data[key];
    if (!data) {
      data = this.data[key] = new Set<CacheValue>();
    }

    data.add(value);
  }

  async srem(key: string, ...values: CacheValue[]): Promise<void> {
    const data: Set<CacheValue> = this.data[key];
    if (_.isSet(data)) {
      values.forEach((value) => {
        data.delete(value);
      });
    }
  }

  async smembers(key: string): Promise<CacheValue[]> {
    const d = this.data[key];
    if (_.isSet(d)) {
      return Array.from(d);
    }

    return [];
  }

  async sismember(key: string, value: CacheValue): Promise<boolean> {
    const d = this.data[key];
    if (_.isSet(d)) {
      return d.has(value);
    }

    return false;
  }

  remove(key: string) {
    if (this.data[key]) {
      delete this.data[key];
    }
    return Promise.resolve(true);
  }

  close() {
    debug('start closing cache');
    this.data = {};
  }

  lock = _.constant(true) as any;
  unlock = _.noop as any;
  lockScope(key: string, scope: () => Promise<void>): Promise<void> {
    // 如果是内存Cache则直接执行lockScope
    return scope();
  }
}

export class RedisCache implements ICache {
  static PREFIX = 'trpg:';

  url: string;
  redis: Redis.Redis;

  constructor(opts: RedisOpts) {
    this.url = opts.url;
    this.redis = new Redis(this.url);
  }

  /**
   * 增加前缀
   */
  private genKey(key: string): string {
    if (!key.startsWith(RedisCache.PREFIX)) {
      return RedisCache.PREFIX + key;
    }
    return key;
  }

  /**
   * 清理前缀
   */
  private purgeKey(key: string): string {
    if (key.startsWith(RedisCache.PREFIX)) {
      return key.substr(RedisCache.PREFIX.length);
    }

    return key;
  }

  private parseVal(val: string): any {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }

  /**
   * 归一化缓存值。将其转化为字符串
   * @param val 值
   */
  private normalizeVal(val: CacheValue): string {
    let ret: string;
    if (_.isObject(val) || _.isNumber(val)) {
      ret = JSON.stringify(val);
    } else {
      ret = val;
    }

    return ret;
  }

  set(
    key: string,
    value: CacheValue,
    options: CacheOptions
  ): Promise<CacheValue> {
    key = this.genKey(key);
    options = Object.assign({}, defaultOption, options);

    debug('[redis]', `set ${key} to ${JSON.stringify(value)}`);

    const expires = options.expires;
    if (_.isNumber(expires) && expires > 0) {
      // 增加过期时间且以毫秒为单位
      return this.redis.set(key, JSON.stringify(value), 'PX', options.expires);
    } else {
      return this.redis.set(key, JSON.stringify(value));
    }
  }

  async rpush(key: string, ...values: any[]): Promise<void> {
    key = this.genKey(key);
    await this.redis.rpush(
      key,
      ...values.map((v) => (_.isObject(v) ? JSON.stringify(v) : v))
    );
    debug(
      '[redis]',
      `rpush ${key} with ${values.map((s) => JSON.stringify(s)).join(',')}`
    );
  }

  // ltrim 为保留一部分。即清理的逻辑下保留的数据应为 (start + size, -1)
  async lclear(key: string, start: number, size: number): Promise<void> {
    key = this.genKey(key);
    await this.redis.ltrim(key, start + size, -1);
    debug('[redis]', `lclear ${key} in range [${start}, ${start + size}]`);
  }

  async keys(glob: string): Promise<string[]> {
    glob = this.genKey(glob);

    const keys: string[] = [];
    let cursor = 0;
    do {
      const [_cursor, _keys] = await this.redis.scan(cursor, 'MATCH', glob);
      cursor = Number(_cursor);
      if (isNaN(cursor)) {
        cursor = 0;
      }
      keys.push(..._keys);
    } while (cursor != 0);

    return _.uniq(keys).map(this.purgeKey); // 返回结果去重 并移除前缀
  }

  async get(key: string): Promise<CacheValue> {
    key = this.genKey(key);
    const val = await this.redis.get(key);
    debug('[redis]', `get ${key}: ${JSON.stringify(val)}`);
    return JSON.parse(val);
  }

  async getWithGlob(glob: string): Promise<{ [key: string]: CacheValue }> {
    const keys = await this.keys(glob);
    debug('[redis]', `get keys with ${glob}`);
    if (keys.length > 0) {
      const values = await Promise.all(keys.map((key) => this.get(key)));
      return _.zipObject(keys, values);
    }
    return Promise.resolve(null);
  }

  async sadd(key: string, value: CacheValue): Promise<void> {
    key = this.genKey(key);
    await this.redis.sadd(key, this.normalizeVal(value));
    debug('[redis]', `sadd ${key} with ${JSON.stringify(value)}`);
  }

  async srem(key: string, ...values: CacheValue[]): Promise<void> {
    key = this.genKey(key);

    if (_.isEmpty(values)) {
      return;
    }

    await this.redis.srem(key, ...values.map(this.normalizeVal));
    debug(
      '[redis]',
      `srem ${key} with ${values.map((v) => JSON.stringify(v)).join(',')}`
    );
  }

  async smembers(key: string): Promise<CacheValue[]> {
    key = this.genKey(key);
    const members = await this.redis.smembers(key);
    debug('[redis]', `smembers ${key}: ${JSON.stringify(members)}`);
    return members.map(this.parseVal);
  }

  async sismember(key: string, value: CacheValue): Promise<boolean> {
    key = this.genKey(key);

    const ret = await this.redis.sismember(key, this.normalizeVal(value));
    debug('[redis]', `sismember ${key}: ${ret}`);
    return Boolean(ret);
  }

  async lget(key: string): Promise<CacheValue[]> {
    key = this.genKey(key);
    const arr: string[] = await this.redis.lrange(key, 0, -1); // 获取所有值
    debug('[redis]', `lget ${key}: ${JSON.stringify(arr)}`);
    return arr.map(this.parseVal);
  }

  async lset(
    key: string,
    index: number,
    value: CacheValue
  ): Promise<CacheValue> {
    key = this.genKey(key);
    await this.redis.lset(
      key,
      index,
      _.isObject(value) ? JSON.stringify(value) : value
    );
    debug('[redis]', `lset ${key}[${index}]: ${value}`);

    return value;
  }

  remove(key: string): Promise<number> {
    key = this.genKey(key);
    debug('[redis]', `remove ${key}`);
    return this.redis.del(key);
  }

  close(): void {
    this.redis.disconnect();
    debug('closed redis cli');
  }

  async lock(key: string): Promise<boolean> {
    key = 'lock:' + this.genKey(key);
    const timestamp = new Date().valueOf().toString(); // 锁的值任意
    const ret = await this.redis.set(key, timestamp, 'EX', 10, 'NX');
    if (ret === 'OK') {
      debug('[redis]', `lock [${key}] success`);
      return true;
    } else {
      debug('[redis]', `lock [${key}] failed`);
      return false;
    }
  }

  async unlock(key: string): Promise<void> {
    key = 'lock:' + this.genKey(key);
    debug('[redis]', `unlock [${key}]`);
    await this.redis.del(key);
  }

  async lockScope(
    key: string,
    scope: () => Promise<void>,
    options?: LockScopeOpts
  ) {
    const isSuccess = await this.lock(key);
    if (!isSuccess) {
      // 如果没有获得锁，则跳过
      return;
    }

    try {
      await scope();

      const unlockDelay = _.get(options, 'unlockDelay');
      if (_.isNumber(unlockDelay) && unlockDelay > 0) {
        await sleep(unlockDelay);
      }
    } finally {
      await this.unlock(key);
    }
  }
}
