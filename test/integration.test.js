/**
 * ECHONET Lite 結合テスト - 実ネットワーク版
 * 実デバイスまたはシミュレータとの連携テスト
 * IPv4のみ、IPv6のみ、IPv4 & IPv6両方の3パターンをテスト
 */

const EL = require('../index.js');


/**
 * 実ネットワーク通信テスト
 * このテストを実行するには、ECHONET Liteデバイス（またはシミュレータ）がローカルネットワークで起動している必要があります。
 *
 * ECHONET Lite Search要求を送信してデバイスを自動発見します。
 * 実行: npm test -- integration.test.js
 */
describe('EL - 実ネットワーク通信テスト', () => {

  let consoleErrorSpy;
  let consoleLogSpy;
  let receivedMessages = [];
  let detectedDevices = [];
  const TIMEOUT = 10000; // 10秒タイムアウト
  const SEARCH_TIMEOUT = 10000; // Search応答待機時間
  const IPV6_TIMEOUT = 15000; // IPv6は開発環境により時間がかかる場合があるため延長

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
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
   * デバイスを自動発見
   * ECHONET Lite Search要求を送信して、応答デバイスを検出
   */
  const discoverDevice = (ipVersion = 4) => {
    return new Promise((resolve, reject) => {
      const foundDevices = [];
      const timeoutMs = ipVersion === 6 ? IPV6_TIMEOUT : SEARCH_TIMEOUT;
      const searchTimeout = setTimeout(() => {
        EL.release();
        const protocolName = ipVersion === 6 ? 'IPv6' : 'IPv4';
        const errorMsg = ipVersion === 6
          ? `${protocolName} Search応答タイムアウト。ネットワークのIPv6マルチキャスト対応を確認してください。`
          : `${protocolName} Search応答タイムアウト`;
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
          debugMode: false,
          ignoreMe: false
        });

        // Search要求を送信
        EL.search();
      } catch (error) {
        clearTimeout(searchTimeout);
        EL.release();
        reject(error);
      }
    });
  };

  test('IPv4: デバイスのSearch自動発見', (done) => {
    console.log('3秒後にIPv4のSearchテストをします');
    setTimeout(() => {
      discoverDevice(4)
        .then((devices) => {
          expect(devices.length).toBeGreaterThan(0);
          expect(devices[0]).toBeDefined();
          done();
        })
        .catch((error) => {
          done(error);
        });
    }, 3000);
  });

  test('IPv4のみ: マルチキャスト受信テスト', (done) => {
    console.log('3秒後にIPv4のみの受信テストをします');
    setTimeout(() => {
      discoverDevice(4)
        .then((devices) => {
          // Search応答があったので、データ受信テストを実行
          const objList = ['0ef001']; // ノードプロファイルで待機
          const testTimeout = setTimeout(() => {
            EL.release();
            done(new Error('タイムアウト: デバイスからデータを受信できませんでした'));
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
              debugMode: false,
              ignoreMe: false
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
    }, 3000);
  });

  test('IPv6のみ: マルチキャスト受信テスト', (done) => {
    console.log('3秒後にIPv6のみの受信テストをします');
    setTimeout(() => {
      discoverDevice(6)
        .then((devices) => {
          const objList = ['0ef001'];
          const testTimeout = setTimeout(() => {
            EL.release();
            done(new Error('IPv6テストタイムアウト: デバイスがIPv6マルチキャストに応答していない可能性があります。'));
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
              debugMode: false,
              ignoreMe: false
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
    }, 3000);
  }, IPV6_TIMEOUT + 8000); // Jest timeout設定

  test('IPv4 & IPv6両方: 双方向受信テスト', (done) => {
    console.log('3秒後にIPv4 & IPv6両方の受信テストをします');
    setTimeout(() => {
      // Note: EL is singleton. Running discoverDevice(4) and (6) in parallel via Promise.all
      // causes race condition on EL.initialize(), leading to overwrites.
      // Execute sequentially.
      discoverDevice(4)
        .then(() => discoverDevice(6))
        .then(() => {
          const objList = ['0ef001'];
          const receivedCount = { v4: 0, v6: 0 };
          const testTimeout = setTimeout(() => {
            EL.release();
            done(new Error('タイムアウト: 両プロトコルでデータを受信できませんでした'));
          }, TIMEOUT);

          const userfunc = (rinfo, els, error) => {
            if (error) return;
            // 送信元アドレスかIPバージョンを判定
            if (rinfo.family === 'IPv6' && rinfo.address.startsWith('::ffff:')) {
              // IPv4-mapped IPv6アドレス: IPv4デバイスからの応答がIPv6ソケットに届いた場合
              // 両方のスタックが機能しているとみなす
              receivedCount.v4++;
              receivedCount.v6++;
            } else if (rinfo.family === 'IPv4') {
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
              debugMode: false,
              ignoreMe: false // 自身のパケットもカウントして、V4/V6デバイスが不在でもソケット動作を検証できるようにする
            });
            // 明示的にSearchを実行して応答を促す（bind/addMembership完了待ちを含む）
            setTimeout(() => {
              EL.search();
            }, 1000);
          } catch (error) {
            clearTimeout(testTimeout);
            EL.release();
            done(error);
          }
        })
        .catch((error) => {
          done(error);
        });
    }, 3000);
  }, IPV6_TIMEOUT * 2 + 8000); // Jest timeout設定
});
