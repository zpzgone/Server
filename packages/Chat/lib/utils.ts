import { ChatMessageType } from '../types/message';
import generateUUID from 'uuid/v4';

/**
 * 判断消息类型是否为普通用户发出的不同消息类型
 * @param messageType 消息类型
 */
export function isNormalMessageType(messageType: ChatMessageType): boolean {
  return ['normal', 'ooc', 'speak', 'action'].includes(messageType);
}

/**
 * 生成聊天消息UUID
 */
export function generateChatMsgUUID(): string {
  return generateUUID();
}
