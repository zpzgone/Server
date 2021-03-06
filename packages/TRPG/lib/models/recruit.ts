import { Model, Orm, DBInstance, HasManyGetAssociationsMixin } from 'trpg/core';
import { PlayerUser } from 'packages/Player/lib/models/user';
import { Feed } from 'feed';
import _ from 'lodash';
import moment from 'moment';
import { NoReportError } from 'lib/error';

declare module 'packages/Player/lib/models/user' {
  interface PlayerUser {
    getRecruits: HasManyGetAssociationsMixin<TRPGRecruit>;
  }
}

export type PlatformType = 'trpgengine' | 'qq' | 'other';
export type ContactType = 'user' | 'group';

export class TRPGRecruit extends Model {
  id: number;
  uuid: string;
  title: string;
  content: string;
  author: string;
  platform: PlatformType;
  contact_type: ContactType;
  contact_content: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;

  ownerId?: number;

  static FEED_CACHE_KEY = 'trpg:recruit:feed';
  static CACHE_EXPIRE = 30 * 60 * 1000; // 30分钟 缓存过期时间
  static EDITABLE_FIELD = ['title', 'content'] as const; // 用户更新时可编辑字段

  /**
   * 根据招募UUID获取详细信息
   * @param uuid 招募的UUID
   */
  static async findByUUID(uuid: string): Promise<TRPGRecruit | null> {
    return TRPGRecruit.findOne({
      where: {
        uuid,
      },
    });
  }

  /**
   * 获取没有完成的招募列表
   */
  static async getTRPGRecruitList(): Promise<TRPGRecruit[]> {
    return TRPGRecruit.findAll({
      where: {
        completed: false,
      },
      order: [['updatedAt', 'DESC']],
    });
  }

  /**
   * 所有的用户招募
   */
  static async getAllUserRecruitList(
    playerUUID: string
  ): Promise<TRPGRecruit[]> {
    const user = await PlayerUser.findByUUID(playerUUID);
    if (_.isNil(user)) {
      throw new Error('用户不存在');
    }

    const recruits = await user.getRecruits({
      order: [['updatedAt', 'DESC']],
    });

    return recruits;
  }

  /**
   * 获取招募的Feed
   * 缓存优先
   * 返回atom格式的数据
   */
  static async getTRPGRecruitFeed(): Promise<string> {
    const trpgapp = TRPGRecruit.getApplication();
    const data = await trpgapp.cache.get(TRPGRecruit.FEED_CACHE_KEY);

    if (!_.isNil(data)) {
      // 如果缓存中有数据则直接读缓存数据
      return String(data);
    }

    const recruits: TRPGRecruit[] = await TRPGRecruit.getTRPGRecruitList();

    const feed = new Feed({
      id: trpgapp.get('apihost'),
      title: 'TRPG Engine Recruit',
      copyright: 'TRPG Engine',
      link: 'https://trpg.moonrailgun.com/portal/trpg/recruit/list',
      description: '',
      generator: 'TRPG Engine',
    });
    recruits.forEach((r) => {
      feed.addItem({
        title: r.title,
        link: `https://trpg.moonrailgun.com/portal/trpg/recruit/${r.uuid}`,
        content: r.content,
        contributor: [{ name: r.author }],
        date: r.updatedAt,
      });
    });

    const ret = feed.atom1();
    await trpgapp.cache.set(TRPGRecruit.FEED_CACHE_KEY, ret, {
      expires: TRPGRecruit.CACHE_EXPIRE,
    });

    return ret;
  }

  /**
   * 创建一条招募信息
   * 每天只能发布一条招募信息
   */
  static async createTRPGRecruit(
    playerUUID: string,
    title: string,
    content: string,
    platform?: PlatformType,
    contact_type?: ContactType,
    contact_content?: string
  ): Promise<TRPGRecruit> {
    if (_.isNil(playerUUID) || _.isEmpty(title) || _.isEmpty(content)) {
      throw new Error('缺少必要字段');
    }

    const user = await PlayerUser.findByUUID(playerUUID);
    if (_.isNil(user)) {
      throw new Error('用户不存在');
    }

    // 获取上一条招募信息
    const [prevRecruit] = await user.getRecruits({
      order: [['updatedAt', 'DESC']],
      limit: 1,
    });
    if (
      !_.isNil(prevRecruit) &&
      moment().diff(moment(prevRecruit.createdAt), 'days', true) < 1
    ) {
      // 上一条招募请求在一天内
      throw new NoReportError('不能在1天内发布多条招募信息');
    }

    const recruit = await TRPGRecruit.create({
      title,
      author: user.getName(),
      content,
      platform,
      contact_type,
      contact_content,
      completed: false,
      ownerId: user.id,
    });

    // 清空缓存
    const trpgapp = TRPGRecruit.getApplication();
    await trpgapp.cache.remove(TRPGRecruit.FEED_CACHE_KEY);

    return recruit;
  }

  /**
   * 更新招募信息
   */
  static async updateTRPGRecruit(
    playerUUID: string,
    recruitUUID: string,
    info: Partial<Pick<TRPGRecruit, typeof TRPGRecruit.EDITABLE_FIELD[number]>>
  ): Promise<TRPGRecruit> {
    const player = await PlayerUser.findByUUID(playerUUID);
    if (_.isNil(player)) {
      throw new Error('用户不存在');
    }

    const [recruit] = (await player.getRecruits({
      where: {
        uuid: recruitUUID,
      },
      limit: 1,
    })) as TRPGRecruit[];
    if (_.isNil(recruit)) {
      throw new Error('找不到该条招募信息');
    }

    Object.assign(recruit, info);

    await recruit.save();

    return recruit;
  }

  /**
   * 完成招募
   */
  static async completeTRPGRecruit(
    playerUUID: string,
    recruitUUID: string
  ): Promise<void> {
    const player = await PlayerUser.findByUUID(playerUUID);
    if (_.isNil(player)) {
      throw new Error('用户不存在');
    }

    const [recruit] = (await player.getRecruits({
      where: {
        uuid: recruitUUID,
      },
      limit: 1,
    })) as TRPGRecruit[];
    if (_.isNil(recruit)) {
      throw new Error('找不到该条招募信息');
    }

    recruit.completed = true;
    await recruit.save();
  }
}

export default function TRPGRecruitDefinition(Sequelize: Orm, db: DBInstance) {
  TRPGRecruit.init(
    {
      uuid: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV1 },
      title: { type: Sequelize.STRING, allowNull: false },
      author: { type: Sequelize.STRING, allowNull: false },
      platform: {
        type: Sequelize.ENUM('trpgengine', 'qq', 'other'),
        defaultValue: 'other',
      },
      contact_type: {
        type: Sequelize.ENUM('user', 'group'),
        defaultValue: 'user',
      },
      contact_content: { type: Sequelize.STRING },
      content: { type: Sequelize.TEXT, allowNull: false },
      completed: { type: Sequelize.BOOLEAN, defaultValue: false },
    },
    {
      tableName: 'trpg_recruit',
      sequelize: db,
    }
  );

  TRPGRecruit.belongsTo(PlayerUser, { as: 'owner', foreignKey: 'ownerId' });
  PlayerUser.hasMany(TRPGRecruit, { as: 'recruits', foreignKey: 'ownerId' });

  return TRPGRecruit;
}
