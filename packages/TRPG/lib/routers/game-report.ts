import { TRPGRouter } from 'trpg/core';
import _ from 'lodash';
import { TRPGGameReport } from '../models/game-report';
import { ssoAuth } from 'packages/Player/lib/middleware/auth';
import { PlayerJWTPayload } from 'packages/Player/types/player';
import { PlayerUser } from 'packages/Player/lib/models/user';
const gameReportRouter = new TRPGRouter<{
  player?: PlayerJWTPayload;
}>();

gameReportRouter.get('/game-report/list', ssoAuth(), async (ctx) => {
  const user = await PlayerUser.findByUUID(ctx.state.player.uuid);

  const reports = await user.getReports();

  ctx.body = { reports };
});

gameReportRouter.post('/game-report/create', ssoAuth(), async function(ctx) {
  const { title, cast, content } = ctx.request.body;
  const player = ctx.state.player;

  if (_.isNil(title)) {
    throw new Error('缺少必要字段');
  }

  const report = await TRPGGameReport.generateGameReport(
    player.uuid,
    title,
    cast,
    content
  );

  ctx.body = { uuid: report.uuid };
});

gameReportRouter.get('/game-report/:reportUUID', async (ctx) => {
  const reportUUID = ctx.params.reportUUID;

  const report = await TRPGGameReport.findByUUID(reportUUID);

  ctx.body = { report };
});

export default gameReportRouter;
