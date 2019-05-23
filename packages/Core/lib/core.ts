import Application from './application';
import Debug from 'debug';
const debug = Debug('trpg:core');

require('./utils'); // 引入工具拓展

export default function createApplication(conf) {
  const app = new Application();

  setConfig(app, conf);

  return app;
}

function setConfig(app, conf) {
  if (!conf) {
    return;
  }

  for (let key in conf) {
    app.set(key, conf[key]);
  }
}