import BasePackage from 'lib/package';
import TRPGReportDefinition from './models/game-report';
import gameReportRouter from './routers/game-report';
import { joinMapRoom } from './map-event';
import { getMapManager, MapManagerCls } from './managers/map-manager';

// 注入方法声明
declare module 'packages/Core/lib/application' {
  interface Application {
    trpg: {
      mapManager?: MapManagerCls;
      [others: string]: any;
    };
  }
}

export default class TRPG extends BasePackage {
  public name: string = 'TRPG';
  public require: string[] = ['Player', 'Actor', 'Group', 'Chat'];
  public desc: string =
    'TRPG 专用包, 所有TRPG Engine独有内容都应当存放在这个包里';

  onInit(): void {
    this.regModel(TRPGReportDefinition);

    this.regRoute(gameReportRouter);

    this.initMapService();
  }

  /**
   * 初始化地图服务
   */
  initMapService() {
    const app = this.app;
    const enable = app.get('trpg.map.enable', false);
    if (enable) {
      // 地图管理器
      const mapManager = getMapManager({
        redisUrl: app.get('redisUrl'),
        cache: app.cache,
      });
      app.trpg = {
        mapManager,
      };

      this.regSocketEvent('joinMapRoom', joinMapRoom);
    }
  }
}
