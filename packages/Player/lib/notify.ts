import { getGlobalApplication } from 'lib/application';
import { PlayerInvite } from './models/invite';

/**
 * 通知用户增加好友请求
 */
export async function notifyAddInvite(userUUID: string, invite: PlayerInvite) {
  const trpgapp = getGlobalApplication();

  await trpgapp.player.manager.unicastSocketEvent(
    userUUID,
    'player::invite',
    invite
  );
}

/**
 * 通知用户删除好友请求
 */
export async function notifyRemoveInvite(userUUID: string, inviteUUID: string) {
  const trpgapp = getGlobalApplication();

  await trpgapp.player.manager.unicastSocketEvent(
    userUUID,
    'player::removeInvite',
    { inviteUUID }
  );
}
