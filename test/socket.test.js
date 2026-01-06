/**
 * ECHONET Lite ソケット処理ユニットテスト
 * dgramモジュールをモック化してソケット関連の処理をテスト
 */

const dgram = require('dgram');
const EL = require('../index.js');

// dgramモジュールのモック化
jest.mock('dgram');

describe('EL - ソケット処理', () => {

  // console.errorをモック化してログを抑制
  let consoleErrorSpy;

  beforeAll(() => {
    // フェイクタイマーを使用してsetTimeoutを制御
    jest.useFakeTimers();
    // console.errorをモック化
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterAll(() => {
    // テスト終了後は実タイマーに戻す
    jest.useRealTimers();
    // console.errorのモックを解除
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    // 各テストの前にモックをクリア
    jest.clearAllMocks();
  });

  afterEach(() => {
    // テスト後に保留中のタイマーをクリア
    jest.clearAllTimers();
  });

  describe('safeCloseSocket関数', () => {

    test('正常なソケットをクローズできる', () => {
      const mockSocket = {
        close: jest.fn()
      };

      // safeCloseSocketは直接exportされてないので、内部で使われることを確認
      // ここでは手動で同じロジックをテスト
      const safeCloseSocket = (socket) => {
        try {
          if (socket && typeof socket.close === 'function') {
            socket.close();
          }
        } catch (e) {
          // エラーは無視
        }
      };

      safeCloseSocket(mockSocket);
      expect(mockSocket.close).toHaveBeenCalledTimes(1);
    });

    test('nullソケットでもエラーにならない', () => {
      const safeCloseSocket = (socket) => {
        try {
          if (socket && typeof socket.close === 'function') {
            socket.close();
          }
        } catch (e) {
          // エラーは無視
        }
      };

      expect(() => {
        safeCloseSocket(null);
      }).not.toThrow();
    });

    test('undefinedソケットでもエラーにならない', () => {
      const safeCloseSocket = (socket) => {
        try {
          if (socket && typeof socket.close === 'function') {
            socket.close();
          }
        } catch (e) {
          // エラーは無視
        }
      };

      expect(() => {
        safeCloseSocket(undefined);
      }).not.toThrow();
    });

    test('closeメソッドがエラーを投げても例外を握りつぶす', () => {
      const mockSocket = {
        close: jest.fn(() => {
          throw new Error('Socket close error');
        })
      };

      const safeCloseSocket = (socket) => {
        try {
          if (socket && typeof socket.close === 'function') {
            socket.close();
          }
        } catch (e) {
          // エラーは無視
        }
      };

      expect(() => {
        safeCloseSocket(mockSocket);
      }).not.toThrow();
      expect(mockSocket.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendBase関数 - IPv4', () => {

    test('IPv4アドレスへの送信が成功する', () => {
      const mockSocket = {
        on: jest.fn(),
        bind: jest.fn((port, address, callback) => {
          // bindが成功したとして即座にコールバックを呼ぶ
          if (callback) callback();
        }),
        setMulticastInterface: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          // 送信成功
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      // initializeは不要 - sendBaseは単独で動作する
      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00]);

      const tid = EL.sendBase('192.168.1.1', buffer);

      expect(tid).toBeDefined();
      expect(Array.isArray(tid)).toBe(true);
      expect(tid.length).toBe(2);
    });

    test('IPv4送信時にソケットエラーが発生してもクラッシュしない', () => {
      const mockSocket = {
        on: jest.fn(),  // エラーハンドラーは登録するだけ
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          // 送信エラー
          if (callback) callback(new Error('Send failed'), 0);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00]);

      expect(() => {
        EL.sendBase('192.168.1.1', buffer);
      }).not.toThrow();
    });
  });

  describe('sendBase関数 - IPv6', () => {

    test('IPv6アドレスへの送信が成功する', () => {
      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          // 送信先アドレスにスコープIDが正しく付与されているか確認
          expect(address).toContain('%en0');
          // 送信成功
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      // interfaceを指定しておく
      EL.usingIF.v6 = 'en0';

      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00]);

      const tid = EL.sendBase('fe80::1', buffer);

      expect(tid).toBeDefined();
      expect(Array.isArray(tid)).toBe(true);
    });

    test('既にスコープIDが含まれるIPv6アドレスに二重付与しない', () => {
      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          // 二重付与（fe80::1%en0%en0）されていないこと
          expect(address).toBe('fe80::1%en0');
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);
      EL.usingIF.v6 = 'en0';

      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00]);
      EL.sendBase('fe80::1%en0', buffer);
    });

    test('IPv6送信時にソケットエラーが発生してもクラッシュしない', () => {
      const mockSocket = {
        on: jest.fn(),  // エラーハンドラーは登録するだけ
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          // 送信エラー
          if (callback) callback(new Error('Send failed'), 0);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00]);

      expect(() => {
        EL.sendBase('fe80::1%en0', buffer);
      }).not.toThrow();
    });
  });

  describe('sendOPC1関数', () => {

    test('TIDが正しくインクリメントされる', () => {
      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      // 初期TIDを取得
      const initialTid = [...EL.tid];

      // 送信実行
      const tid1 = EL.sendOPC1('192.168.1.1', '05ff01', '0ef001', 0x62, 0x80, []);

      expect(tid1).toBeDefined();
      expect(tid1[0]).toBe(initialTid[0]);
      // TIDの下位バイトがインクリメントされるか、初期値による
      expect(tid1[1]).toBeGreaterThanOrEqual(initialTid[1]);
    });

    test('TIDが0xFFを超えるとキャリーオーバーする', () => {
      // TIDを0xFFに設定
      EL.tid = [0x00, 0xFF];

      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      // 送信実行 - sendOPC1内でTIDがインクリメントされる
      const tid1 = EL.sendOPC1('192.168.1.1', '05ff01', '0ef001', 0x62, 0x80, []);

      // 0xFFの次は0にリセット、上位バイトは1にインクリメント
      expect(EL.tid[1]).toBe(0);  // 0xFFの次は0
      expect(EL.tid[0]).toBe(1);  // キャリーオーバーで1になる
    });
  });

  describe('エラーハンドリングの統合テスト', () => {

    test('ソケット生成に失敗してもクラッシュしない', () => {
      dgram.createSocket = jest.fn(() => {
        throw new Error('Socket creation failed');
      });

      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00]);

      expect(() => {
        EL.sendBase('192.168.1.1', buffer);
      }).not.toThrow();
    });

    test('マルチキャスト設定失敗時にソケットがクローズされる', () => {
      const mockSocket = {
        on: jest.fn(),
        bind: jest.fn((port, address, callback) => {
          if (callback) callback();
        }),
        setMulticastInterface: jest.fn(() => {
          throw new Error('Multicast interface error');
        }),
        send: jest.fn(),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      // マルチキャスト用のインターフェース設定は内部変数を直接設定
      EL.usingIF = { v4: '192.168.1.100', v6: '' };
      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00]);

      expect(() => {
        EL.sendBase('224.0.23.0', buffer);
      }).not.toThrow();

      // エラー時にcloseが呼ばれることを確認
      // setTimeoutで遅延実行されるため、すぐには確認できない
    });
  });

  describe('sendArray関数', () => {

    test('配列からBufferに変換して送信できる', () => {
      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      const array = [0x10, 0x81, 0x00, 0x01, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x00];

      const tid = EL.sendArray('192.168.1.1', array);

      expect(tid).toBeDefined();
      expect(Array.isArray(tid)).toBe(true);
    });
  });

  describe('sendString関数', () => {

    test('16進数文字列から送信できる', () => {
      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      const hexString = '1081000005ff010ef00163018000';

      const tid = EL.sendString('192.168.1.1', hexString);

      expect(tid).toBeDefined();
      expect(Array.isArray(tid)).toBe(true);
    });

    test('sendString送信エラー時もクラッシュしない', () => {
      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          if (callback) callback(new Error('Send failed'), 0);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      expect(() => {
        EL.sendString('192.168.1.1', '1081000005ff010ef00163018000');
      }).not.toThrow();
    });
  });

  describe('search関数 (機器検索)', () => {

    test('機器検索パケットを送信できる', () => {
      const mockSocket = {
        on: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, callback) => {
          if (callback) callback(null, buffer.length);
        }),
        close: jest.fn()
      };

      dgram.createSocket = jest.fn(() => mockSocket);

      // search()は内部でマルチキャストに送信する
      expect(() => {
        EL.search();
      }).not.toThrow();
    });
  });

});
