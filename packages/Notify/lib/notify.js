const debug = require('debug')('trpg:component:notify');
const config = require('config').get('notify');
const _ = require('lodash');
const JPush = require('jpush-async').JPushAsync;

module.exports = function NotifyComponent(app) {
  initFunction.call(app);

  return {
    name: 'NotifyComponent',
    require: ['PlayerComponent'],
  };
};

function initFunction() {
  const app = this;
  const db = app.storage.db;

  const appkey = _.get(config, 'jpush.appkey');
  const masterSecret = _.get(config, 'jpush.masterSecret');

  if (!appkey || !masterSecret) {
    debug('init function failed: need jpush info');
    return;
  }

  const _client = JPush.buildClient(config.jpush);

  app.notify = {
    JPush,
    _client,
    async sendNotifyMsg(userUUID, title, msg, options = {}) {
      const platform = _.get(options, 'platform', JPush.ALL);
      const audience = _.get(options, 'audience', JPush.alias(userUUID));

      // TODO: 增加到history

      return await _client
        .push()
        .setPlatform(platform)
        .setAudience(audience)
        .setNotification(
          'title',
          JPush.ios(title),
          JPush.android(title, null, 1)
        )
        .setMessage(msg)
        .setOptions(null, 60)
        .send();
    },
  };
}
