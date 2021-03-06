import _ from 'lodash';
import { InfoWebsite } from '../models/Website';
import { TRPGRouter } from 'trpg/core';

const router = new TRPGRouter();

/**
 * 用户添加表情包
 */
router.get('/website/info', async (ctx) => {
  const url = ctx.query.url;
  if (!url) {
    throw new Error('缺少URL');
  }

  const info = await InfoWebsite.getWebsiteInfo(url);

  ctx.body = { info };
});

export default router;
