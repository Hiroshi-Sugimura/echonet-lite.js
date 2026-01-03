/**
 * ECHONET Lite 結合テスト - 実ネットワーク版
 * MoekadenRoomとの連携テスト
 * IPv4のみ、IPv6のみ、IPv4 & IPv6両方の3パターンをテスト
 */

const EL = require('../index.js');

/**
 * 実ネットワーク通信テスト（MoekadenRoomとの連携）
 * このテストを実行するにはMoekadenRoomがローカルで起動している必要があります
 * https://github.com/SonyCSL/MoekadenRoom
 *
 * ECHONET Lite Search要求を送信してMoekadenRoomを自動発見します
 * 実行: npm test -- integration.test.js
 */
describe('EL - 実ネットワーク通信テスト (MoekadenRoom対応)', () => {

  let consoleErrorSpy;
  let consoleLogSpy;
  let receivedMessages = [];
  let detectedDevices = [];
  const TIMEOUT = 10000; // 10秒タイムアウト
  const SEARCH_TIMEOUT = 10000; // Search応答待機時間
  const IPV6_TIMEOUT = 15000; // IPv6はまだ開発中のため、タイムアウト時間を延長

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  afterEach(() => {
    // 各テスト後にリソース解放
    if (EL.sock4 || EL.sock6) {
      EL.release();
    }
    receivedMessages = [];
  });

  /**
   * MoekadenRoomを自動発見
   * ECHONET Lite Search要求を送信して、応答デバイスを検出
   */
  const discoverMoekadenRoom = (ipVersion = 4) => {
    return new Promise((resolve, reject) => {
      const foundDevices = [];
      const timeoutMs = ipVersion === 6 ? IPV6_TIMEOUT : SEARCH_TIMEOUT;
      const searchTimeout = setTimeout(() => {
        EL.release();
        const protocolName = ipVersion === 6 ? 'IPv6' : 'IPv4';
        const errorMsg = ipVersion === 6
          ? `MoekadenRoom: ${protocolName} Search応答タイムアウト。MoekadenRoomのIPv6マルチキャスト対応を確認してください。`
          : `MoekadenRoom: ${protocolName} Search応答タイムアウト`;
        reject(new Error(errorMsg));
      }, timeoutMs);

      const discoveryFunc = (rinfo, els, error) => {
        if (error) return;

        // 正しくデバイスが応答しているか確認（els.DETAILs が存在するかチェック）
        if (els && els.DETAILs) {
          foundDevices.push(els);

          // デバイスが見つかったら完了
          if (foundDevices.length > 0) {
            clearTimeout(searchTimeout);
            EL.release();
            resolve(foundDevices);
          }
        }
      };

      try {
        // ノードプロファイル（0ef001）でSearch
        EL.initialize(['0ef001'], discoveryFunc, ipVersion, {
          debugMode: false
        });

        // Search要求を送信
        const multicastAddr = ipVersion === 6 ? 'ff02::1' : '224.0.23.0';
        EL.sendOPC1(
          multicastAddr,
          EL.toHexArray('0ef001'), // 自ノード
          EL.toHexArray('0ef001'), // ノードプロファイル
          0x63, // Inf_Req（Search要求）
          0xd5, // インスタンスリスト通知
          []
        );
      } catch (error) {
        clearTimeout(searchTimeout);
        EL.release();
        reject(error);
      }
    });
  };

  test('IPv4: MoekadenRoomのSearch自動発見', (done) => {
    discoverMoekadenRoom(4)
      .then((devices) => {
        expect(devices.length).toBeGreaterThan(0);
        expect(devices[0]).toBeDefined();
        done();
      })
      .catch((error) => {
        done(error);
      });
  });

  test('IPv4のみ: MoekadenRoomからのマルチキャスト受信', (done) => {
    discoverMoekadenRoom(4)
      .then((devices) => {
        // Search応答があったので、データ受信テストを実行
        const objList = ['013001']; // エアコンディショナー
        const testTimeout = setTimeout(() => {
          EL.release();
          done(new Error('タイムアウト: MoekadenRoomからデータを受信できませんでした'));
        }, TIMEOUT);

        const userfunc = (rinfo, els, error) => {
          if (error) return;
          clearTimeout(testTimeout);
          receivedMessages.push({ rinfo, els });

          // 最初のメッセージを受け取ったら成功
          expect(receivedMessages.length).toBeGreaterThan(0);
          expect(receivedMessages[0].els).toBeDefined();

          EL.release();
          done();
        };

        try {
          EL.initialize(objList, userfunc, 4, {
            debugMode: false
          });
        } catch (error) {
          clearTimeout(testTimeout);
          EL.release();
          done(error);
        }
      })
      .catch((error) => {
        done(error);
      });
  });

  test('IPv6のみ: MoekadenRoomからのマルチキャスト受信', (done) => {
    discoverMoekadenRoom(6)
      .then((devices) => {
        const objList = ['013001'];
        const testTimeout = setTimeout(() => {
          EL.release();
          done(new Error('IPv6テストタイムアウト: MoekadenRoomがIPv6マルチキャストに応答していない可能性があります。MoekadenRoomのIPv6設定を確認してください。'));
        }, IPV6_TIMEOUT);

        const userfunc = (rinfo, els, error) => {
          if (error) return;
          clearTimeout(testTimeout);
          receivedMessages.push({ rinfo, els });

          expect(receivedMessages.length).toBeGreaterThan(0);

          EL.release();
          done();
        };

        try {
          EL.initialize(objList, userfunc, 6, {
            debugMode: false
          });
        } catch (error) {
          clearTimeout(testTimeout);
          EL.release();
          done(error);
        }
      })
      .catch((error) => {
        done(error);
      });
  }, IPV6_TIMEOUT + 5000); // Jest timeout設定

  test('IPv4 & IPv6両方: MoekadenRoomからの双方向受信', (done) => {
    Promise.all([
      discoverMoekadenRoom(4),
      discoverMoekadenRoom(6)
    ])
      .then((results) => {
        const objList = ['013001'];
        const receivedCount = { v4: 0, v6: 0 };
        const testTimeout = setTimeout(() => {
          EL.release();
          done(new Error('タイムアウト: 両プロトコルでデータを受信できませんでした'));
        }, TIMEOUT);

        const userfunc = (rinfo, els, error) => {
          if (error) return;
          // 送信元アドレスかIPバージョンを判定
          if (rinfo.family === 'IPv4') {
            receivedCount.v4++;
          } else if (rinfo.family === 'IPv6') {
            receivedCount.v6++;
          }

          receivedMessages.push({ rinfo, els });

          // 両プロトコルからデータを受け取ったら成功
          if (receivedCount.v4 > 0 && receivedCount.v6 > 0) {
            clearTimeout(testTimeout);
            expect(receivedMessages.length).toBeGreaterThanOrEqual(2);

            EL.release();
            done();
          }
        };

        try {
          EL.initialize(objList, userfunc, 0, {
            debugMode: false
          });
        } catch (error) {
          clearTimeout(testTimeout);
          EL.release();
          done(error);
        }
      })
      .catch((error) => {
        done(error);
      });
  }, IPV6_TIMEOUT * 2 + 5000); // Jest timeout設定（両方のProtocolが必要）
});
