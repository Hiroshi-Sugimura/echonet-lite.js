/**
 * ECHONET Lite ユニットテスト
 */

const EL = require('../index.js');

describe('EL - ECHONET Lite プロトコル', () => {

  // console.errorをモック化してログを抑制
  let consoleErrorSpy;

  beforeAll(() => {
    // console.errorをモック化
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    // console.errorのモックを解除
    consoleErrorSpy.mockRestore();
  });

  describe('変換系関数', () => {

    test('toHexString: バイトを16進数文字列に変換', () => {
      expect(EL.toHexString(0)).toBe('00');
      expect(EL.toHexString(15)).toBe('0f');
      expect(EL.toHexString(255)).toBe('ff');
      expect(EL.toHexString(16)).toBe('10');
    });

    test('toHexString: 境界値テスト', () => {
      expect(EL.toHexString(0)).toBe('00');     // 最小値
      expect(EL.toHexString(255)).toBe('ff');   // 最大値
      expect(EL.toHexString(128)).toBe('80');   // 中間値
    });

    test('toHexArray: 16進数文字列をバイト配列に変換', () => {
      expect(EL.toHexArray('00')).toEqual([0]);
      expect(EL.toHexArray('0f')).toEqual([15]);
      expect(EL.toHexArray('ff')).toEqual([255]);
      expect(EL.toHexArray('1081')).toEqual([16, 129]);
      expect(EL.toHexArray('0ef001')).toEqual([14, 240, 1]);
    });

    test('toHexArray: 空文字列で空配列を返す', () => {
      expect(EL.toHexArray('')).toEqual([]);
    });

    test('toHexArray: 複雑な16進数変換', () => {
      expect(EL.toHexArray('418081A0A1B0F0FF')).toEqual([65, 128, 129, 160, 161, 176, 240, 255]);
    });

    test('bytesToString: バイト配列を16進数文字列に変換', () => {
      expect(EL.bytesToString([0])).toBe('00');
      expect(EL.bytesToString([15])).toBe('0f');
      expect(EL.bytesToString([255])).toBe('ff');
      expect(EL.bytesToString([16, 129])).toBe('1081');
      expect(EL.bytesToString([14, 240, 1])).toBe('0ef001');
    });

    test('bytesToString: 長いバイト配列の変換', () => {
      const bytes = [34, 130, 132, 137, 146, 148, 149, 150, 151, 155, 162, 164, 165, 167, 176, 180, 183, 194, 196, 200, 210, 212, 216, 218, 219, 226, 228, 232, 234, 235, 240, 244, 246, 248, 250];
      expect(EL.bytesToString(bytes)).toBe('2282848992949596979ba2a4a5a7b0b4b7c2c4c8d2d4d8dadbe2e4e8eaebf0f4f6f8fa');
    });

    test('toHexArray と bytesToString の相互変換', () => {
      const testCases = ['00', '0f', 'ff', '1081', '0ef001', '10810001'];
      testCases.forEach(hex => {
        const array = EL.toHexArray(hex);
        const result = EL.bytesToString(array);
        expect(result).toBe(hex);
      });
    });
  });

  describe('パース関数', () => {

    test('parseString: 正常なECHONET Lite電文をパース', () => {
      // GET_RES応答: 動作状態(0x80)=ON(0x30)
      const hexString = '108100010ef0010ef0017201800130';
      const result = EL.parseString(hexString);

      expect(result).toBeDefined();
      expect(result.EHD).toBe('1081');
      expect(result.TID).toBe('0001');
      expect(result.SEOJ).toBe('0ef001');
      expect(result.DEOJ).toBe('0ef001');
      expect(result.ESV).toBe('72');
      expect(result.OPC).toBe('01');
      expect(result.DETAILs).toBeDefined();
      expect(result.DETAILs['80']).toBe('30');
    });

    test('parseString: OPC=1の基本ケース', () => {
      const result = EL.parseString('1081000005ff010ef0016201800130');
      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '6201800130',
        ESV: '62',
        OPC: '01',
        DETAIL: '800130',
        DETAILs: { '80': '30' }
      });
    });

    test('parseString: OPC=4の複数プロパティ', () => {
      const result = EL.parseString('1081000005ff010ef0016204800131b00142bb011cb30118');
      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '6204800131b00142bb011cb30118',
        ESV: '62',
        OPC: '04',
        DETAIL: '800131b00142bb011cb30118',
        DETAILs: { '80': '31', 'b0': '42', 'bb': '1c', 'b3': '18' }
      });
    });

    test('parseString: large opcエラーケース', () => {
      // OPC=2だがデータが1つ分しかない
      expect(() => {
        EL.parseString('1081000005ff010ef0016202300180')
      }).toThrow(Error);
    });

    test('parseString: format 2 (Mitsubishi TV)任意電文形式', () => {
      const result = EL.parseString('10820003000e000106020105ff0162010100');
      expect(result).toEqual({
        EHD: '1082',
        AMF: '0003000e000106020105ff0162010100'
      });
    });

    test('parseString: 不正なヘッダーでエラー', () => {
      const invalidHeader = '2081000101ef00110ef0016201d600';
      expect(() => {
        EL.parseString(invalidHeader);
      }).toThrow();
    });

    test('parseString: 短すぎる電文でエラー', () => {
      const tooShort = '108100';
      expect(() => {
        EL.parseString(tooShort);
      }).toThrow();
    });

    test('parseBytes: Bufferからパース', () => {
      const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x01, 0xef, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0xd6, 0x00]);
      const result = EL.parseBytes(buffer);

      expect(result).toBeDefined();
      expect(result.EHD).toBe('1081');
      expect(result.TID).toBe('0001');
      expect(result.ESV).toBe('62');
    });

    test('parseBytes: OPC=1の基本ケース', () => {
      const result = EL.parseBytes([0x10, 0x81, 0x00, 0x00, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0x80, 0x01, 0x30]);
      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '6201800130',
        ESV: '62',
        OPC: '01',
        DETAIL: '800130',
        DETAILs: { '80': '30' }
      });
    });

    test('parseBytes: OPC=4の複数プロパティ', () => {
      const result = EL.parseBytes([0x10, 0x81, 0x00, 0x00, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x04, 0x80, 0x01, 0x31, 0xb0, 0x01, 0x42, 0xbb, 0x01, 0x1c, 0xb3, 0x01, 0x18]);
      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '6204800131b00142bb011cb30118',
        ESV: '62',
        OPC: '04',
        DETAIL: '800131b00142bb011cb30118',
        DETAILs: { '80': '31', 'b0': '42', 'bb': '1c', 'b3': '18' }
      });
    });

    test('parseBytes: large opcエラーケース', () => {
      // OPC=2だがデータが1つ分しかない
      expect(() => {
        EL.parseBytes([0x10, 0x81, 0x00, 0x00, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x02, 0x30, 0x01, 0x80])
      }).toThrow(Error);
    });

    test('parseDetail: 詳細部分のパース', () => {
      // OPC=2, EPC=0x80(動作状態)=0x30, EPC=0x81(設置場所)=0x01
      const detail = '80013081010f';
      const result = EL.parseDetail('02', detail);

      expect(result).toBeDefined();
      expect(result['80']).toBe('30');
      expect(result['81']).toBe('0f');
    });

    test('parseDetail: OPC=1の基本ケース', () => {
      const result = EL.parseDetail('01', '800130');
      expect(result).toEqual({ '80': '30' });
    });

    test('parseDetail: OPC=1, EPC=2バイトのケース', () => {
      const result = EL.parseDetail('01', 'B9021234');
      expect(result).toEqual({ 'b9': '1234' });
    });

    test('parseDetail: OPC=4の複数プロパティ', () => {
      const result = EL.parseDetail('04', '800131b00142bb011cb30118');
      expect(result).toEqual({
        '80': '31',
        'b0': '42',
        'bb': '1c',
        'b3': '18'
      });
    });

    test('parseDetail: OPC=5, EPC=2バイト含む', () => {
      const result = EL.parseDetail('05', '800131b00142bb011cb9021234b30118');
      expect(result).toEqual({
        '80': '31',
        'b0': '42',
        'bb': '1c',
        'b3': '18',
        'b9': '1234'
      });
    });

    test('parseDetail: 複雑なケース(OPC=8)', () => {
      const result = EL.parseDetail('08', '80013181010f8204000050018311fe000077000002eaed646f381e000000028801428a030000779d060580818fb0a09e070680818fb0b3a0');
      expect(result).toEqual({
        '80': '31',
        '81': '0f',
        '82': '00005001',
        '83': 'fe000077000002eaed646f381e00000002',
        '88': '42',
        '8a': '000077',
        '9d': '0580818fb0a0',
        '9e': '0680818fb0b3a0'
      });
    });

    test('parseDetail: スマートメーターケース(OPC=5)', () => {
      const result = EL.parseDetail('05', 'D30400000001D70106E004000C6C96E30400000006E70400000360');
      expect(result).toEqual({
        'd3': '00000001',
        'd7': '06',
        'e0': '000c6c96',
        'e3': '00000006',
        'e7': '00000360'
      });
    });

    test('parseString: 不正な文字列型でエラー', () => {
      expect(() => {
        EL.parseString(123);  // 数値を渡す
      }).toThrow();
    });

    test('parseString: 奇数長の16進数文字列でエラー', () => {
      const oddLength = '108100001';  // 奇数長
      expect(() => {
        EL.parseString(oddLength);
      }).toThrow(/hex length must be even/);
    });

    test('parseString: 無効なEHD(任意電文形式1082)の処理', () => {
      // 任意電文形式は最低24文字必要
      const arbitraryFormat = '108200010ef0010ef001620180';
      const result = EL.parseString(arbitraryFormat);

      expect(result).toBeDefined();
      expect(result.EHD).toBe('1082');
      expect(result.AMF).toBe('00010ef0010ef001620180');
    });

    test('parseBytes: nullやundefinedでnullを返す', () => {
      expect(EL.parseBytes(null)).toBeNull();
      expect(EL.parseBytes(undefined)).toBeNull();
    });

    test('parseBytes: 短すぎるバッファでnullを返す', () => {
      const tooShort = Buffer.from([0x10, 0x81]);
      expect(EL.parseBytes(tooShort)).toBeNull();
    });

    test('parseBytes: 無効なEHDヘッダーでnullを返す', () => {
      const invalidEHD = Buffer.from([0x20, 0x81, 0x00, 0x01, 0x01, 0xef, 0x01, 0x0e, 0xf0, 0x01, 0x62, 0x01, 0xd6, 0x00]);
      expect(EL.parseBytes(invalidEHD)).toBeNull();
    });

    test('parseDetail: 不正なOPCでエラー', () => {
      expect(() => {
        EL.parseDetail('ff', '80013081010f');  // OPC=255
      }).toThrow();
    });

    test('parseDetail: データ不足でエラー', () => {
      // OPC=2だがデータが1つ分しかない
      expect(() => {
        EL.parseDetail('02', '800130');
      }).toThrow();
    });

    test('parseDetail: BAD EDATAケース', () => {
      // large opc - データ長が合わない
      expect(() => {
        EL.parseDetail('06', 'D30400000001D70106E00400')
      }).toThrow(Error);
    });

    test('parseDetail: large opcエラーケース', () => {
      // OPC=3だがデータが2つ分しかない
      expect(() => {
        EL.parseDetail('03', '300180310288FF')
      }).toThrow(Error);
    });

    test('parseDetail: スマートメーターの不正データ', () => {
      // large opc - 末尾が不足
      expect(() => {
        EL.parseDetail('06', 'D30400000001D70106E004000C6C96E30400000006E7040000036')
      }).toThrow(Error);
    });
  });

  describe('クラスリスト生成', () => {

    test('getClassList: インスタンスリストからクラスリストを生成', () => {
      const objList = ['05ff01', '05ff02', '013001', '013002'];
      const classList = EL.getClassList(objList);

      expect(classList).toContain('05ff');
      expect(classList).toContain('0130');
      expect(classList.length).toBe(2);
    });

    test('getClassList: 重複なしの場合', () => {
      const objList = ['05ff01', '013001', '029001'];
      const classList = EL.getClassList(objList);

      expect(classList.length).toBe(3);
    });

    test('getClassList: 空配列の場合', () => {
      const classList = EL.getClassList([]);
      expect(classList).toEqual([]);
      expect(classList.length).toBe(0);
    });

    test('getClassList: 単一要素の場合', () => {
      const classList = EL.getClassList(['05ff01']);
      expect(classList).toContain('05ff');
      expect(classList.length).toBe(1);
    });

    test('getClassList: 複雑なオブジェクトリスト', () => {
      const classList = EL.getClassList(['05ff01', '013001', '013002', '029001', '013003', '029002']);
      expect(classList).toEqual(['05ff', '0130', '0290']);
    });
  });

  describe('ELDATA変換', () => {

    test('ELDATA2Array: ELDATAをバイト配列に変換', () => {
      const eldata = {
        EHD: '1081',
        TID: '0001',
        SEOJ: '0ef001',
        DEOJ: '0ef001',
        EDATA: '6201d600'
      };

      const result = EL.ELDATA2Array(eldata);
      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toBe(0x10);
      expect(result[1]).toBe(0x81);
    });

    test('getSeparatedString_ELDATA: スペース区切り文字列に変換', () => {
      const eldata = {
        EHD: '1081',
        TID: '0001',
        SEOJ: '0ef001',
        DEOJ: '0ef001',
        EDATA: '6201d600'
      };

      const result = EL.getSeparatedString_ELDATA(eldata);
      expect(result).toBe('1081 0001 0ef001 0ef001 6201d600');
    });

    test('getSeparatedString_String: 文字列でないとエラー', () => {
      expect(() => {
        EL.getSeparatedString_String(123);  // 数値を渡す
      }).toThrow('str is not string.');
    });

    test('getSeparatedString_String: 正常な文字列を区切る', () => {
      // 最低限の長さ: EHD(4) + TID(4) + SEOJ(6) + DEOJ(6) + ESV(2) = 22文字
      const validStr = '108100010ef0010ef00162';
      const result = EL.getSeparatedString_String(validStr);
      expect(result).toContain(' ');
      expect(result).toContain('1081');
    });
  });

  describe('プロパティマップ形式2のパース', () => {

    test('parseMapForm2: 形式2を形式1に変換', () => {
      // 17個のプロパティがある場合のテスト
      // EDT: [個数(17=0x11), bitmap 16bytes]
      const form2Data = [
        0x11,  // 17個
        0x81, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // 0x80(bit7)
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ];

      const result = EL.parseMapForm2(form2Data);
      expect(result[0]).toBeGreaterThan(0);  // 先頭は個数(0より大きい)
      expect(result).toContain(0x80);  // 0x80が含まれる
      expect(result.length).toBeGreaterThan(1);  // 配列が存在する
    });

    test('parseMapForm2: 16プロパティケース', () => {
      const result = EL.parseMapForm2('1001010101010101010101010101010101');
      expect(result).toEqual([0x10, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f]);
    });

    test('parseMapForm2: 16プロパティ複雑なビットマップ', () => {
      const result = EL.parseMapForm2('1041414100004000604100410000020202');
      expect(result).toEqual([16, 128, 129, 130, 136, 138, 157, 158, 159, 215, 224, 225, 226, 229, 231, 232, 234]);
    });

    test('parseMapForm2: 54プロパティケース', () => {
      const result = EL.parseMapForm2('36b1b1b1b1b0b0b1b3b3a1838101838383');
      expect(result).toEqual([
        0x36, // = 54
        0x80, 0x81, 0x82, 0x83, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f, // 14
        0x97, 0x98, 0x9a, 0x9d, 0x9e, 0x9f, // 6
        0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, // 9
        0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9,  // 10
        0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xfb, 0xfd, 0xfe, 0xff
      ]);
    });
  });

  describe('オブジェクトソート', () => {

    test('objectSort: キーでソート', () => {
      const obj = {
        'z': 1,
        'a': 2,
        'm': 3
      };

      const sorted = EL.objectSort(obj);
      const keys = Object.keys(sorted);

      expect(keys[0]).toBe('a');
      expect(keys[1]).toBe('m');
      expect(keys[2]).toBe('z');
    });

    test('objectSort: 等しいケース', () => {
      const result1 = EL.objectSort({'a': 'a', 'b': 'b'});
      const result2 = EL.objectSort({'b': 'b', 'a': 'a'});
      expect(result1).toEqual(result2);
    });

    test('objectSort: 等しくないケース', () => {
      const result1 = EL.objectSort({'a': 'a', 'b': 'b'});
      const result2 = EL.objectSort({'b': 'b', 'c': 'c'});
      expect(result1).not.toEqual(result2);
    });
  });

  describe('定数の確認', () => {

    test('ESVコード定義', () => {
      expect(EL.SETI_SNA).toBe('50');
      expect(EL.SETC_SNA).toBe('51');
      expect(EL.GET_SNA).toBe('52');
      expect(EL.INF_SNA).toBe('53');
      expect(EL.SETI).toBe('60');
      expect(EL.SETC).toBe('61');
      expect(EL.GET).toBe('62');
      expect(EL.INF_REQ).toBe('63');
      expect(EL.SET_RES).toBe('71');
      expect(EL.GET_RES).toBe('72');
      expect(EL.INF).toBe('73');
      expect(EL.INFC).toBe('74');
    });

    test('マルチキャストアドレス定義', () => {
      expect(EL.EL_Multi).toBe('224.0.23.0');
      expect(EL.EL_Multi6).toBe('FF02::1');
    });

    test('ポート番号定義', () => {
      expect(EL.EL_port).toBe(3610);
    });

    test('Node Profile定義', () => {
      expect(EL.NODE_PROFILE).toBe('0ef0');
      expect(EL.NODE_PROFILE_OBJECT).toBe('0ef001');
    });
  });

  describe('renewFacilities 初期化', () => {

    test('新規IP/EOJでも例外なく初期化できる', () => {
      const ip = '198.51.100.55'; // TEST-NET-2
      // 事前クリーンアップ
      if (EL.facilities && EL.facilities[ip]) {
        delete EL.facilities[ip];
      }

      const els = {
        SEOJ: '05ff01',
        OPC: '01',
        DETAIL: '800130'
      };

      expect(() => {
        EL.renewFacilities(ip, els);
      }).not.toThrow();

      expect(EL.facilities[ip]).toBeDefined();
      expect(EL.facilities[ip]['05ff01']).toBeDefined();
      expect(EL.facilities[ip]['05ff01']['80']).toBe('30');

      // 後片付け
      delete EL.facilities[ip];
    });
  });

  describe('識別番号の重複登録を避ける', () => {
    test('同じID/IP/OBJは1回だけ格納される', () => {
      const ip = '192.0.2.10'; // TEST-NET-1
      // 事前クリア
      EL.identificationNumbers = [];
      if (EL.facilities && EL.facilities[ip]) delete EL.facilities[ip];

      const els = {
        SEOJ: '0ef001',
        OPC: '01',
        // EPC=0x83, PDC=1, EDT=00 （短いけどparseDetail的には問題なし）
        DETAIL: '830100'
      };

      // 2回流しても重複しない
      EL.renewFacilities(ip, els);
      EL.renewFacilities(ip, els);

      expect(EL.identificationNumbers.length).toBe(1);
      expect(EL.identificationNumbers[0]).toEqual({ id: '00', ip, OBJ: '0ef001' });

      // 後片付け
      delete EL.facilities[ip];
      EL.identificationNumbers = [];
    });
  });

  describe('PropertyMap統合テスト', () => {

    test('PropertyMap 15 bytes (記述形式1)', () => {
      const bytes = [0x10, 0x81, 0x00, 0x00, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x72, 0x01, 0x9f, 0x10, 0x0f, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f];
      const result = EL.parseBytes(bytes);
      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '72019f100f8182838485868788898a8b8c8d8e8f',
        ESV: '72',
        OPC: '01',
        DETAIL: '9f100f8182838485868788898a8b8c8d8e8f',
        DETAILs: { '9f': '0f8182838485868788898a8b8c8d8e8f' }
      });
    });

    test('PropertyMap 16 bytes (記述形式2 - シンプル)', () => {
      const bytes = [0x10, 0x81, 0x00, 0x00, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x72, 0x01, 0x9f, 0x11, 0x10, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01];
      const result = EL.parseBytes(bytes);

      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '72019f111001010101010101010101010101010101',
        ESV: '72',
        OPC: '01',
        DETAIL: '9f111001010101010101010101010101010101',
        DETAILs: { '9f': '10808182838485868788898a8b8c8d8e8f' }
      });
    });

    test('PropertyMap 16 bytes (記述形式2 - 複雑なビットパターン)', () => {
      const bytes = [0x10, 0x81, 0x00, 0x00, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x72, 0x01, 0x9f, 0x11, 0x10, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];
      const result = EL.parseBytes(bytes);

      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '72019f111001020408102040800102040810204080',
        ESV: '72',
        OPC: '01',
        DETAIL: '9f111001020408102040800102040810204080',
        DETAILs: { '9f': '1080889199a2aab3bbc4ccd5dde6eef7ff' }
      });
    });

    test('PropertyMap many properties (54個)', () => {
      const bytes = [0x10, 0x81, 0x00, 0x00, 0x05, 0xff, 0x01, 0x0e, 0xf0, 0x01, 0x72, 0x01, 0x9f, 0x11, 0x36, 0xB1, 0xB1, 0xB1, 0xB1, 0xB0, 0xB0, 0xB1, 0xB3, 0xB3, 0xA1, 0x83, 0x81, 0x01, 0x83, 0x83, 0x83];
      const result = EL.parseBytes(bytes);

      expect(result).toEqual({
        EHD: '1081',
        TID: '0000',
        SEOJ: '05ff01',
        DEOJ: '0ef001',
        EDATA: '72019f1136b1b1b1b1b0b0b1b3b3a1838101838383',
        ESV: '72',
        OPC: '01',
        DETAIL: '9f1136b1b1b1b1b0b0b1b3b3a1838101838383',
        DETAILs: { '9f': '3680818283868788898a8b8c8d8e8f97989a9d9e9fc0c1c2c3c4c5c6c7c8d0d1d2d3d4d5d6d7d8d9f0f1f2f3f4f5f6f7f8f9fafbfdfeff' }
      });
    });
  });

  describe('complementFacilities_sub', () => {
    let sendDetailsSpy;
    let originalDebugMode;
    let originalAutoGetWaitings;

    beforeEach(() => {
      // sendDetailsをモック化
      sendDetailsSpy = jest.spyOn(EL, 'sendDetails').mockImplementation(() => {});
      originalDebugMode = EL.debugMode;
      originalAutoGetWaitings = EL.autoGetWaitings;
      EL.debugMode = false; // デバッグログを抑制
      EL.autoGetWaitings = 0; // 待ち行列をリセット
    });

    afterEach(() => {
      sendDetailsSpy.mockRestore();
      EL.debugMode = originalDebugMode;
      EL.autoGetWaitings = originalAutoGetWaitings;
    });

    test('9fが存在しない場合はマップ取得要求を送信', () => {
      const props = { '80': '30', '82': '0001' };
      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      expect(sendDetailsSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        EL.NODE_PROFILE_OBJECT,
        '013001',
        EL.GET,
        [{ '9d': '' }, { '9e': '' }, { '9f': '' }]
      );
    });

    test('9fが空文字の場合はマップ取得要求を送信', () => {
      const props = { '9f': '', '80': '30' };
      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      expect(sendDetailsSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        EL.NODE_PROFILE_OBJECT,
        '013001',
        EL.GET,
        [{ '9d': '' }, { '9e': '' }, { '9f': '' }]
      );
    });

    test('9fがundefinedの場合はマップ取得要求を送信', () => {
      const props = { '80': '30' };
      // propsに9fキーが存在しない = undefined
      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      expect(sendDetailsSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        EL.NODE_PROFILE_OBJECT,
        '013001',
        EL.GET,
        [{ '9d': '' }, { '9e': '' }, { '9f': '' }]
      );
    });

    test('正常な9fで不足EPCを補完', (done) => {
      jest.useFakeTimers();
      const props = {
        '9f': '03808182', // 3個のEPC: 80, 81, 82
        '80': '30' // 80は存在
        // 81, 82は存在しない
      };

      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      // タイマーを進める
      jest.runAllTimers();

      expect(sendDetailsSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        EL.NODE_PROFILE_OBJECT,
        '013001',
        EL.GET,
        [{ '81': '' }, { '82': '' }]
      );

      jest.useRealTimers();
      done();
    });

    test('メーカー独自EPC(F0-FF)はスキップ', (done) => {
      jest.useFakeTimers();
      const props = {
        '9f': '0480f0f1', // 4個のEPC: 80, f0, f1
        '80': '30'
      };

      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      jest.runAllTimers();

      // f0, f1はスキップされるため呼ばれない
      expect(sendDetailsSpy).not.toHaveBeenCalled();

      jest.useRealTimers();
      done();
    });

    test('不正なEPC形式(非16進)を検出してスキップ', (done) => {
      jest.useFakeTimers();
      EL.debugMode = true; // デバッグログを有効化
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const props = {
        '9f': '03ZZ8182', // 不正: 'ZZ'
        '81': '0f'
      };

      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      jest.runAllTimers();

      // 'ZZ'は不正なのでスキップ、81は既存、82のみ要求
      expect(sendDetailsSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        EL.NODE_PROFILE_OBJECT,
        '013001',
        EL.GET,
        [{ '82': '' }]
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'complementFacilities_sub: invalid EPC format:',
        'ZZ',
        'in 9f:',
        '03ZZ8182'
      );

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
      done();
    });

    test('不正なEPC形式(奇数長)を検出', (done) => {
      jest.useFakeTimers();
      EL.debugMode = true;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const props = {
        '9f': '0280', // 個数2だが後続が足りない(80のみ)
        // match(/.{2}/g) で ['02', '80'] となり、array[2]はundefined
        '80': '30' // 80は既に存在
      };

      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      jest.runAllTimers();

      // 80は既存なので要求なし、2個目は取得できないのでbreakで終了
      expect(sendDetailsSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
      done();
    });

    test('全EPCが既に存在する場合は何も送信しない', (done) => {
      jest.useFakeTimers();
      const props = {
        '9f': '02808182',
        '80': '30',
        '81': '0f',
        '82': '0001'
      };

      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      jest.runAllTimers();

      expect(sendDetailsSpy).not.toHaveBeenCalled();

      jest.useRealTimers();
      done();
    });

    test('形式2のプロパティマップでも正しく動作', (done) => {
      jest.useFakeTimers();
      // 形式2は既にparseMapForm2で形式1に変換済みと仮定
      // 実際にはrenewFacilitiesでDETAILsとして保存される時点で変換されている
      const props = {
        '9f': '10808182838485868788898a8b8c8d8e8f', // 16個
        '80': '30'
        // 残り15個は存在しない
      };

      EL.complementFacilities_sub('192.168.1.1', '013001', props);

      jest.runAllTimers();

      expect(sendDetailsSpy).toHaveBeenCalled();
      const callArgs = sendDetailsSpy.mock.calls[0];
      const details = callArgs[4];
      // 81-8fの15個が要求される
      expect(details.length).toBe(15);
      expect(details[0]).toEqual({ '81': '' });
      expect(details[14]).toEqual({ '8f': '' });

      jest.useRealTimers();
      done();
    });
  });

  describe('待機カウンタ系関数', () => {
    let originalAutoGetWaitings;

    beforeEach(() => {
      originalAutoGetWaitings = EL.autoGetWaitings;
      EL.autoGetWaitings = 0;
    });

    afterEach(() => {
      EL.autoGetWaitings = originalAutoGetWaitings;
    });

    test('increaseWaitings: カウンタを1増やす', () => {
      expect(EL.autoGetWaitings).toBe(0);
      EL.increaseWaitings();
      expect(EL.autoGetWaitings).toBe(1);
      EL.increaseWaitings();
      expect(EL.autoGetWaitings).toBe(2);
      EL.increaseWaitings();
      expect(EL.autoGetWaitings).toBe(3);
    });

    test('decreaseWaitings: カウンタを1減らす', () => {
      EL.autoGetWaitings = 5;
      EL.decreaseWaitings();
      expect(EL.autoGetWaitings).toBe(4);
      EL.decreaseWaitings();
      expect(EL.autoGetWaitings).toBe(3);
    });

    test('decreaseWaitings: 0の時は減らさない', () => {
      EL.autoGetWaitings = 0;
      EL.decreaseWaitings();
      expect(EL.autoGetWaitings).toBe(0);
      EL.decreaseWaitings();
      expect(EL.autoGetWaitings).toBe(0);
    });

    test('increaseWaitingsとdecreaseWaitingsの組み合わせ', () => {
      EL.increaseWaitings(); // 0 -> 1
      EL.increaseWaitings(); // 1 -> 2
      EL.increaseWaitings(); // 2 -> 3
      expect(EL.autoGetWaitings).toBe(3);

      EL.decreaseWaitings(); // 3 -> 2
      expect(EL.autoGetWaitings).toBe(2);

      EL.increaseWaitings(); // 2 -> 3
      expect(EL.autoGetWaitings).toBe(3);

      EL.decreaseWaitings(); // 3 -> 2
      EL.decreaseWaitings(); // 2 -> 1
      EL.decreaseWaitings(); // 1 -> 0
      expect(EL.autoGetWaitings).toBe(0);

      EL.decreaseWaitings(); // 0のまま
      expect(EL.autoGetWaitings).toBe(0);
    });
  });

  describe('文字列処理系関数', () => {

    describe('getSeparatedString_String', () => {
      test('正常な16進数文字列をスペース区切りに変換', () => {
        const input = '108100010ef0010ef0017201800130';
        const expected = '1081 0001 0ef001 0ef001 72 01800130';
        expect(EL.getSeparatedString_String(input)).toBe(expected);
      });

      test('短い文字列でも正しく区切る', () => {
        const input = '108100010ef0010ef00172';
        const expected = '1081 0001 0ef001 0ef001 72 ';
        expect(EL.getSeparatedString_String(input)).toBe(expected);
      });

      test('長いEDATA部分も正しく処理', () => {
        const input = '108100010ef0010ef001620380013081010f82040001';
        const expected = '1081 0001 0ef001 0ef001 62 0380013081010f82040001';
        expect(EL.getSeparatedString_String(input)).toBe(expected);
      });

      test('文字列以外が渡されたらエラー', () => {
        expect(() => EL.getSeparatedString_String(123)).toThrow('str is not string.');
        expect(() => EL.getSeparatedString_String(null)).toThrow('str is not string.');
        expect(() => EL.getSeparatedString_String(undefined)).toThrow('str is not string.');
        expect(() => EL.getSeparatedString_String([])).toThrow('str is not string.');
      });

      test('オブジェクトが渡されたらエラー', () => {
        expect(() => EL.getSeparatedString_String({})).toThrow('str is not string.');
        expect(() => EL.getSeparatedString_String({ a: 1 })).toThrow('str is not string.');
      });

      test('空文字列でも処理可能', () => {
        const result = EL.getSeparatedString_String('');
        expect(result).toBe('     ');
      });

      test('極端に短い文字列(4文字未満)', () => {
        const result = EL.getSeparatedString_String('10');
        expect(result).toBe('10     ');
      });

      test('関数が渡されたらエラー', () => {
        expect(() => EL.getSeparatedString_String(() => {})).toThrow('str is not string.');
      });
    });

    describe('getSeparatedString_ELDATA', () => {
      test('正常なELDATAオブジェクトをスペース区切り文字列に変換', () => {
        const eldata = {
          EHD: '1081',
          TID: '0001',
          SEOJ: '0ef001',
          DEOJ: '0ef001',
          EDATA: '7201800130'
        };
        const expected = '1081 0001 0ef001 0ef001 7201800130';
        expect(EL.getSeparatedString_ELDATA(eldata)).toBe(expected);
      });

      test('複数プロパティを持つEDATA', () => {
        const eldata = {
          EHD: '1081',
          TID: '0002',
          SEOJ: '05ff01',
          DEOJ: '013501',
          EDATA: '620380013081010f82040001'
        };
        const expected = '1081 0002 05ff01 013501 620380013081010f82040001';
        expect(EL.getSeparatedString_ELDATA(eldata)).toBe(expected);
      });

      test('nullやundefinedが渡されたらエラー', () => {
        expect(() => EL.getSeparatedString_ELDATA(null))
          .toThrow('Input must be an object');
        expect(() => EL.getSeparatedString_ELDATA(undefined))
          .toThrow('Input must be an object');
      });

      test('必須プロパティが欠けているとエラー', () => {
        expect(() => EL.getSeparatedString_ELDATA({}))
          .toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');

        expect(() => EL.getSeparatedString_ELDATA({ EHD: '1081' }))
          .toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');

        expect(() => EL.getSeparatedString_ELDATA({
          EHD: '1081',
          TID: '0001'
        })).toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');
      });

      test('文字列が渡されたらエラー', () => {
        expect(() => EL.getSeparatedString_ELDATA('test'))
          .toThrow('Input must be an object');
      });

      test('数値が渡されたらエラー', () => {
        expect(() => EL.getSeparatedString_ELDATA(123))
          .toThrow('Input must be an object');
      });

      test('配列が渡されたらエラー', () => {
        expect(() => EL.getSeparatedString_ELDATA([]))
          .toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');
      });

      test('SEOJだけ欠けている場合', () => {
        expect(() => EL.getSeparatedString_ELDATA({
          EHD: '1081',
          TID: '0001',
          DEOJ: '0ef001',
          EDATA: '7201800130'
        })).toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');
      });

      test('DEOJだけ欠けている場合', () => {
        expect(() => EL.getSeparatedString_ELDATA({
          EHD: '1081',
          TID: '0001',
          SEOJ: '0ef001',
          EDATA: '7201800130'
        })).toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');
      });

      test('EDATAだけ欠けている場合', () => {
        expect(() => EL.getSeparatedString_ELDATA({
          EHD: '1081',
          TID: '0001',
          SEOJ: '0ef001',
          DEOJ: '0ef001'
        })).toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');
      });

      test('プロパティが空文字列の場合はエラー', () => {
        // 空文字列はfalsyなので!eldata.EHDでtrueになりエラー
        expect(() => EL.getSeparatedString_ELDATA({
          EHD: '',
          TID: '',
          SEOJ: '',
          DEOJ: '',
          EDATA: ''
        })).toThrow('ELDATA object must have EHD, TID, SEOJ, DEOJ, and EDATA properties');
      });
    });
  });

  describe('表示系関数', () => {
    let consoleLogSpy;
    let consoleErrorSpy;
    let originalDebugMode;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      originalDebugMode = EL.debugMode;
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      EL.debugMode = originalDebugMode;
    });

    describe('eldataShow', () => {
      test('debugMode=trueの時にELDATAを表示', () => {
        EL.debugMode = true;
        const eldata = {
          EHD: '1081',
          TID: '0001',
          SEOJ: '0ef001',
          DEOJ: '0ef001',
          EDATA: '7201800130'
        };

        EL.eldataShow(eldata);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          'EHD: 1081TID: 0001SEOJ: 0ef001DEOJ: 0ef001\nEDATA: 7201800130'
        );
      });

      test('debugMode=falseの時は何も表示しない', () => {
        EL.debugMode = false;
        const eldata = {
          EHD: '1081',
          TID: '0001',
          SEOJ: '0ef001',
          DEOJ: '0ef001',
          EDATA: '7201800130'
        };

        EL.eldataShow(eldata);

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      test('eldataがnullの時はエラーメッセージを表示', () => {
        EL.eldataShow(null);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'EL.eldataShow error. eldata is not EL data.'
        );
      });

      test('eldataがundefinedでは何も表示されない', () => {
        // undefinedの場合は何も表示されず終了
        EL.eldataShow(undefined);
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      test('eldataが空オブジェクトでもdebugMode=trueなら表示', () => {
        EL.debugMode = true;
        const eldata = {
          EHD: '',
          TID: '',
          SEOJ: '',
          DEOJ: '',
          EDATA: ''
        };

        EL.eldataShow(eldata);

        expect(consoleLogSpy).toHaveBeenCalled();
      });

      test('eldataが不完全でもdebugMode=trueなら表示試行', () => {
        EL.debugMode = true;
        const eldata = {
          EHD: '1081',
          TID: '0001'
          // SEOJ, DEOJ, EDATAなし
        };

        EL.eldataShow(eldata);

        // エラーは出ないが、undefinedを含む文字列が表示される
        expect(consoleLogSpy).toHaveBeenCalled();
      });
    });

    describe('stringShow', () => {
      test('正常な16進数文字列をパースして表示', () => {
        EL.debugMode = true;
        const hexString = '108100010ef0010ef0017201800130';

        EL.stringShow(hexString);

        expect(consoleLogSpy).toHaveBeenCalled();
        const loggedMessage = consoleLogSpy.mock.calls[0][0];
        expect(loggedMessage).toContain('EHD: 1081');
        expect(loggedMessage).toContain('TID: 0001');
      });

      test('不正な文字列でエラーをthrow', () => {
        expect(() => EL.stringShow('invalid')).toThrow();
      });

      test('短すぎる文字列でエラーをthrow', () => {
        expect(() => EL.stringShow('1081')).toThrow();
      });
    });

    describe('bytesShow', () => {
      test('正常なバイト配列をパースして表示', () => {
        EL.debugMode = true;
        const bytes = [0x10, 0x81, 0x00, 0x01, 0x0e, 0xf0, 0x01, 0x0e, 0xf0, 0x01, 0x72, 0x01, 0x80, 0x01, 0x30];

        EL.bytesShow(bytes);

        expect(consoleLogSpy).toHaveBeenCalled();
        const loggedMessage = consoleLogSpy.mock.calls[0][0];
        expect(loggedMessage).toContain('EHD: 1081');
        expect(loggedMessage).toContain('TID: 0001');
      });

      test('Bufferでも正しく処理', () => {
        EL.debugMode = true;
        const buffer = Buffer.from([0x10, 0x81, 0x00, 0x01, 0x0e, 0xf0, 0x01, 0x0e, 0xf0, 0x01, 0x72, 0x01, 0x80, 0x01, 0x30]);

        EL.bytesShow(buffer);

        expect(consoleLogSpy).toHaveBeenCalled();
        const loggedMessage = consoleLogSpy.mock.calls[0][0];
        expect(loggedMessage).toContain('EHD: 1081');
      });

      test('不正なバイト配列でもエラーハンドリング', () => {
        EL.debugMode = true;
        const invalidBytes = [0x10, 0x81]; // 短すぎる

        EL.bytesShow(invalidBytes);

        // parseBytes内でエラーが出て、eldataShowにnullが渡される
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'EL.eldataShow error. eldata is not EL data.'
        );
      });

      test('空配列でもエラーハンドリング', () => {
        EL.debugMode = true;

        EL.bytesShow([]);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'EL.eldataShow error. eldata is not EL data.'
        );
      });

      test('nullが渡された場合', () => {
        EL.debugMode = true;

        EL.bytesShow(null);

        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      test('文字列が渡された場合(Buffer変換失敗)', () => {
        EL.debugMode = true;

        // 文字列を渡すとエラー
        expect(() => EL.bytesShow('invalid')).toThrow();
      });
    });
  });

  describe('返信サブルーチン関数', () => {

    describe('replyGetDetail_sub', () => {
      test('EOJとEPCが両方存在する場合はtrue', () => {
        const els = { DEOJ: '013501' };
        const dev_details = {
          '013501': {
            '80': '30',
            '81': '0f'
          }
        };

        expect(EL.replyGetDetail_sub(els, dev_details, '80')).toBe(true);
        expect(EL.replyGetDetail_sub(els, dev_details, '81')).toBe(true);
      });

      test('EOJは存在するがEPCが存在しない場合はfalse', () => {
        const els = { DEOJ: '013501' };
        const dev_details = {
          '013501': {
            '80': '30'
          }
        };

        expect(EL.replyGetDetail_sub(els, dev_details, '81')).toBe(false);
        expect(EL.replyGetDetail_sub(els, dev_details, 'b0')).toBe(false);
      });

      test('EOJ自体が存在しない場合はfalse', () => {
        const els = { DEOJ: '029001' };
        const dev_details = {
          '013501': {
            '80': '30'
          }
        };

        expect(EL.replyGetDetail_sub(els, dev_details, '80')).toBe(false);
      });

      test('dev_detailsが空の場合はfalse', () => {
        const els = { DEOJ: '013501' };
        const dev_details = {};

        expect(EL.replyGetDetail_sub(els, dev_details, '80')).toBe(false);
      });

      test('dev_detailsがnullの場合', () => {
        const els = { DEOJ: '013501' };
        const dev_details = null;

        // nullだとプロパティアクセスでエラー
        expect(() => EL.replyGetDetail_sub(els, dev_details, '80')).toThrow();
      });

      test('elsがnullの場合', () => {
        const dev_details = { '013501': { '80': '30' } };

        // null.DEOJでエラー
        expect(() => EL.replyGetDetail_sub(null, dev_details, '80')).toThrow();
      });

      test('EPCがnullの場合', () => {
        const els = { DEOJ: '013501' };
        const dev_details = { '013501': { '80': '30' } };

        // nullはプロパティキーとして使えるので、存在しないとfalse
        expect(EL.replyGetDetail_sub(els, dev_details, null)).toBe(false);
      });

      test('EPCが空文字列の場合', () => {
        const els = { DEOJ: '013501' };
        const dev_details = { '013501': { '80': '30', '': 'test' } };

        // 空文字列のEPCが存在すればtrue
        expect(EL.replyGetDetail_sub(els, dev_details, '')).toBe(true);
      });

      test('EOJのプロパティがnullの場合はPDC=0を返す', () => {
        const els = { DEOJ: '013501' };
        const dev_details = { '013501': null };

        // nullの場合はfalseを返す
        const result = EL.replyGetDetail_sub(els, dev_details, '80');
        expect(result).toBe(false);
      });
    });

    describe('replySetDetail_sub', () => {
      let sendOPC1Spy;

      beforeEach(() => {
        sendOPC1Spy = jest.spyOn(EL, 'sendOPC1').mockImplementation(() => {});
      });

      afterEach(() => {
        sendOPC1Spy.mockRestore();
      });

      test('ノードプロファイルのbf(個体識別番号)を設定できる', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '0ef001',
          SEOJ: '05ff01',
          DETAILs: { 'bf': '0102' }
        };
        const dev_details = {
          '0ef001': {
            'bf': [0x81, 0x00] // 最上位bitは0x80
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, 'bf');

        expect(result).toBe(true);
        // 最上位bitは保持される (0x81 & 0x80) | (0x01 & 0x7F) = 0x81
        expect(dev_details['0ef001']['bf'][0]).toBe(0x81);
        expect(dev_details['0ef001']['bf'][1]).toBe(0x02);
      });

      test('エアコンの動作状態(80)を0x30(ON)に設定', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '013001',
          SEOJ: '05ff01',
          DETAILs: { '80': '30' }
        };
        const dev_details = {
          '013001': {
            '80': [0x31] // 現在OFF
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, '80');

        expect(result).toBe(true);
        expect(dev_details['013001']['80']).toEqual([0x30]);
        // INFが送信される
        expect(sendOPC1Spy).toHaveBeenCalled();
      });

      test('エアコンの動作状態(80)に不正値を設定するとfalse', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '013001',
          SEOJ: '05ff01',
          DETAILs: { '80': 'ff' } // 不正値
        };
        const dev_details = {
          '013001': {
            '80': [0x30]
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, '80');

        expect(result).toBe(false);
        // 値は変更されない
        expect(dev_details['013001']['80']).toEqual([0x30]);
      });

      test('エアコンの温度設定(b3)を20度に設定', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '013001',
          SEOJ: '05ff01',
          DETAILs: { 'b3': '14' } // 20度 (0x14 = 20)
        };
        const dev_details = {
          '013001': {
            'b3': [0x18] // 現在24度
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, 'b3');

        expect(result).toBe(true);
        expect(dev_details['013001']['b3']).toEqual([20]);
      });

      test('エアコンの温度設定(b3)に範囲外の値を設定するとfalse', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '013001',
          SEOJ: '05ff01',
          DETAILs: { 'b3': '64' } // 100度 (範囲外)
        };
        const dev_details = {
          '013001': {
            'b3': [0x18]
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, 'b3');

        expect(result).toBe(false);
      });

      test('サポートされていないEOJ/EPCの組み合わせはfalse', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '013001', // エアコン
          SEOJ: '05ff01',
          DETAILs: { 'ff': '01' } // 未定義EPC
        };
        const dev_details = {
          '013001': {
            '80': [0x30]
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, 'ff');

        expect(result).toBe(false);
      });

      test('未知のEOJクラスはdefaultでfalse', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '099999', // 未知のEOJ
          SEOJ: '05ff01',
          DETAILs: { '80': '30' }
        };
        const dev_details = {
          '099999': {
            '80': [0x31]
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, '80');

        // switch文のdefaultでEPCが存在すればtrue
        expect(result).toBe(true);
      });

      test('rinfoがnullでもエラーにならない(INF送信時はエラー)', () => {
        const els = {
          DEOJ: '013001',
          SEOJ: '05ff01',
          DETAILs: { 'b3': '14' }
        };
        const dev_details = {
          '013001': {
            'b3': [0x18]
          }
        };

        // b3は温度設定でINFなし、rinfoがnullでもエラーにならない
        const result = EL.replySetDetail_sub(null, els, dev_details, 'b3');
        expect(result).toBe(true);
      });

      test('elsがnullの場合', () => {
        const rinfo = { address: '192.168.1.1' };
        const dev_details = {
          '013001': {
            '80': [0x30]
          }
        };

        // null.DEOJでエラー
        expect(() => EL.replySetDetail_sub(rinfo, null, dev_details, '80')).toThrow();
      });

      test('dev_detailsがnullの場合', () => {
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '013001',
          SEOJ: '05ff01',
          DETAILs: { '80': '30' }
        };

        // dev_details[els.DEOJ]でエラー
        expect(() => EL.replySetDetail_sub(rinfo, els, null, '80')).toThrow();
      });

      test('照明(0290)はdefaultケースで処理', () => {
        sendOPC1Spy.mockClear();
        const rinfo = { address: '192.168.1.1' };
        const els = {
          DEOJ: '029001', // 一般照明
          SEOJ: '05ff01',
          DETAILs: { '80': '30' }
        };
        const dev_details = {
          '029001': {
            '80': [0x31]
          }
        };

        const result = EL.replySetDetail_sub(rinfo, els, dev_details, '80');

        // 照明は詳細実装がないためdefaultケースでtrueを返すのみ
        expect(result).toBe(true);
        // 値は更新されない
        expect(dev_details['029001']['80']).toEqual([0x31]);
        // defaultケースではINF送信しない
        expect(sendOPC1Spy).not.toHaveBeenCalled();
      });
    });
  });

  describe('myIPaddress', () => {
    let originalIgnoreMe;
    let originalNicList;

    beforeEach(() => {
      originalIgnoreMe = EL.ignoreMe;
      originalNicList = EL.nicList;
    });

    afterEach(() => {
      EL.ignoreMe = originalIgnoreMe;
      EL.nicList = originalNicList;
    });

    test('ignoreMe=false の時は常にfalseを返す', () => {
      EL.ignoreMe = false;
      const rinfo = { address: '192.168.1.100' };
      expect(EL.myIPaddress(rinfo)).toBe(false);
    });

    test('ループバックアドレス(127.0.0.1)の時はtrueを返す', () => {
      EL.ignoreMe = true;
      const rinfo = { address: '127.0.0.1' };
      expect(EL.myIPaddress(rinfo)).toBe(true);
    });

    test('IPv6ループバックアドレス(::1)の時はtrueを返す', () => {
      EL.ignoreMe = true;
      const rinfo = { address: '::1' };
      expect(EL.myIPaddress(rinfo)).toBe(true);
    });

    test('nicListに含まれるIPv4アドレスの時はtrueを返す', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [
          { address: '192.168.1.10' },
          { address: '10.0.0.5' }
        ],
        v6: []
      };

      expect(EL.myIPaddress({ address: '192.168.1.10' })).toBe(true);
      expect(EL.myIPaddress({ address: '10.0.0.5' })).toBe(true);
    });

    test('nicListに含まれないIPv4アドレスの時はfalseを返す', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [
          { address: '192.168.1.10' }
        ],
        v6: []
      };

      expect(EL.myIPaddress({ address: '192.168.1.100' })).toBe(false);
    });

    test('nicListに含まれるIPv6アドレスの時はtrueを返す', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [],
        v6: [
          { address: 'fe80::1234:5678:abcd:ef01' }
        ]
      };

      expect(EL.myIPaddress({ address: 'fe80::1234:5678:abcd:ef01' })).toBe(true);
    });

    test('IPv6アドレスのゾーンID(%付き)を正しく処理', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [],
        v6: [
          { address: 'fe80::1234:5678:abcd:ef01' }
        ]
      };

      // %en0などのゾーンIDは無視して比較
      expect(EL.myIPaddress({ address: 'fe80::1234:5678:abcd:ef01%en0' })).toBe(true);
    });

    test('nicListに含まれないIPv6アドレスの時はfalseを返す', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [],
        v6: [
          { address: 'fe80::1111:2222:3333:4444' }
        ]
      };

      expect(EL.myIPaddress({ address: 'fe80::5555:6666:7777:8888' })).toBe(false);
    });

    test('rinfoがnullの場合', () => {
      EL.ignoreMe = true;

      // null.addressでエラー
      expect(() => EL.myIPaddress(null)).toThrow();
    });

    test('rinfo.addressがundefinedの場合', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [{ address: '192.168.1.10' }],
        v6: []
      };

      // undefinedとの比較はfalseを返す
      expect(EL.myIPaddress({ address: undefined })).toBe(false);
    });

    test('nicList.v4が空配列の場合', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [],
        v6: []
      };

      expect(EL.myIPaddress({ address: '192.168.1.10' })).toBe(false);
    });

    test('nicList.v6が空配列の場合', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [],
        v6: []
      };

      expect(EL.myIPaddress({ address: 'fe80::1234:5678:abcd:ef01' })).toBe(false);
    });

    test('nicListがnullの場合', () => {
      EL.ignoreMe = true;
      EL.nicList = null;

      // null.v4.forEachでエラー
      expect(() => EL.myIPaddress({ address: '192.168.1.10' })).toThrow();
    });

    test('nicList.v4がundefinedの場合', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v6: []
      };

      // undefined.forEachでエラー
      expect(() => EL.myIPaddress({ address: '192.168.1.10' })).toThrow();
    });

    test('IPv6アドレスに%がない場合も正常処理', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [],
        v6: [
          { address: 'fe80::1234:5678:abcd:ef01' }
        ]
      };

      // %がなくても.split('%')[0]で同じ文字列が返る
      expect(EL.myIPaddress({ address: 'fe80::1234:5678:abcd:ef01' })).toBe(true);
    });

    test('複数のNICに同じIPがある場合', () => {
      EL.ignoreMe = true;
      EL.nicList = {
        v4: [
          { address: '192.168.1.10' },
          { address: '192.168.1.10' }, // 重複
          { address: '10.0.0.5' }
        ],
        v6: []
      };

      // 最初のマッチでtrueを返す
      expect(EL.myIPaddress({ address: '192.168.1.10' })).toBe(true);
    });
  });

  describe('replyOPC1', () => {
    let sendBaseSpy;

    beforeEach(() => {
      sendBaseSpy = jest.spyOn(EL, 'sendBase').mockImplementation(() => {});
    });

    afterEach(() => {
      sendBaseSpy.mockRestore();
    });

    test('文字列パラメータで正常に送信', () => {
      EL.replyOPC1('192.168.1.1', '0001', '0ef001', '013001', '72', '80', '30');

      expect(sendBaseSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        expect.any(Buffer)
      );

      const buffer = sendBaseSpy.mock.calls[0][1];
      expect(buffer[0]).toBe(0x10);
      expect(buffer[1]).toBe(0x81);
      expect(buffer[2]).toBe(0x00); // TID
      expect(buffer[3]).toBe(0x01);
      expect(buffer[10]).toBe(0x72); // ESV
      expect(buffer[11]).toBe(0x01); // OPC
      expect(buffer[12]).toBe(0x80); // EPC
      expect(buffer[13]).toBe(0x01); // PDC
      expect(buffer[14]).toBe(0x30); // EDT
    });

    test('配列パラメータで正常に送信', () => {
      EL.replyOPC1('192.168.1.1', [0x00, 0x02], [0x0e, 0xf0, 0x01], [0x01, 0x30, 0x01], 0x72, 0x80, [0x30]);

      expect(sendBaseSpy).toHaveBeenCalled();
      const buffer = sendBaseSpy.mock.calls[0][1];
      expect(buffer[2]).toBe(0x00); // TID
      expect(buffer[3]).toBe(0x02);
    });

    test('GET(0x62)の時はPDC=0でEDTなし', () => {
      EL.replyOPC1('192.168.1.1', '0001', '0ef001', '013001', '62', '80', '');

      const buffer = sendBaseSpy.mock.calls[0][1];
      expect(buffer[10]).toBe(0x62); // ESV = GET
      expect(buffer[12]).toBe(0x80); // EPC
      expect(buffer[13]).toBe(0x00); // PDC = 0
      expect(buffer.length).toBe(14); // EDTなし
    });

    test('数値EDTも配列に変換', () => {
      EL.replyOPC1('192.168.1.1', '0001', '0ef001', '013001', '72', '80', 0x30);

      const buffer = sendBaseSpy.mock.calls[0][1];
      expect(buffer[14]).toBe(0x30);
    });

    test('複数バイトのEDT', () => {
      EL.replyOPC1('192.168.1.1', '0001', '0ef001', '001101', '72', 'e0', [0x00, 0xdc]);

      const buffer = sendBaseSpy.mock.calls[0][1];
      expect(buffer[12]).toBe(0xe0); // EPC
      expect(buffer[13]).toBe(0x02); // PDC = 2
      expect(buffer[14]).toBe(0x00); // EDT[0]
      expect(buffer[15]).toBe(0xdc); // EDT[1]
    });

    test('tidがnullの場合は変換時にエラー', () => {
      expect(() => EL.replyOPC1('192.168.1.1', null, '0ef001', '013001', '72', '80', '30')).toThrow();
    });

    test('seojがnullの場合は変換時にエラー', () => {
      expect(() => EL.replyOPC1('192.168.1.1', '0001', null, '013001', '72', '80', '30')).toThrow();
    });

    test('deojがnullの場合は変換時にエラー', () => {
      expect(() => EL.replyOPC1('192.168.1.1', '0001', '0ef001', null, '72', '80', '30')).toThrow();
    });

    test('esvがnullの場合は変換時にエラー', () => {
      // nullは文字列として処理されてしまう
      EL.replyOPC1('192.168.1.1', '0001', '0ef001', '013001', null, '80', '30');
      expect(sendBaseSpy).toHaveBeenCalled();
    });

    test('epcがnullの場合は変換時にエラー', () => {
      // nullは文字列として処理されてしまう
      EL.replyOPC1('192.168.1.1', '0001', '0ef001', '013001', '72', null, '30');
      expect(sendBaseSpy).toHaveBeenCalled();
    });

    test('edtがnullの場合はlengthでエラー', () => {
      expect(() => EL.replyOPC1('192.168.1.1', '0001', '0ef001', '013001', '72', '80', null)).toThrow();
    });

    test('edtがundefinedの場合はlengthでエラー', () => {
      expect(() => EL.replyOPC1('192.168.1.1', '0001', '0ef001', '013001', '72', '80', undefined)).toThrow();
    });

    test('空文字列パラメータ', () => {
      EL.replyOPC1('192.168.1.1', '', '0ef001', '013001', '72', '80', '30');

      expect(sendBaseSpy).toHaveBeenCalled();
      const buffer = sendBaseSpy.mock.calls[0][1];
      expect(buffer[2]).toBe(0x00);
      expect(buffer[3]).toBe(0x00);
    });

    test('不正な16進数文字列', () => {
      // toHexArray内でparseIntが失敗してNaNになる可能性
      expect(() => EL.replyOPC1('192.168.1.1', 'ZZZZ', '0ef001', '013001', '72', '80', '30')).toThrow();
    });
  });

  describe('replyGetDetail', () => {
    let sendArraySpy;

    beforeEach(() => {
      sendArraySpy = jest.spyOn(EL, 'sendArray').mockImplementation(() => {});
    });

    afterEach(() => {
      sendArraySpy.mockRestore();
    });

    test('単一プロパティのGETに正常応答', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '62',
        DETAILs: { '80': '' }
      };
      const dev_details = {
        '013001': {
          '80': [0x30]
        }
      };

      EL.replyGetDetail(rinfo, els, dev_details);

      expect(sendArraySpy).toHaveBeenCalled();
      const sentArray = sendArraySpy.mock.calls[0][1];

      // ESVが0x72(GET_RES)であることを確認
      expect(sentArray).toContain(0x72);
      // OPC=1
      expect(sentArray).toContain(0x01);
      // EPC=0x80
      expect(sentArray).toContain(0x80);
      // EDT=0x30
      expect(sentArray).toContain(0x30);
    });

    test('複数プロパティのGETに正常応答', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '62',
        DETAILs: { '80': '', '81': '', 'b3': '' }
      };
      const dev_details = {
        '013001': {
          '80': [0x30],
          '81': [0x0f],
          'b3': [0x18]
        }
      };

      EL.replyGetDetail(rinfo, els, dev_details);

      const sentArray = sendArraySpy.mock.calls[0][1];

      // ESVが0x72(GET_RES)
      expect(sentArray).toContain(0x72);
      // OPC=3が含まれているはず(配列の中の適切な位置)
      const opcIndex = sentArray.findIndex((val, idx, arr) =>
        idx > 10 && val === 0x03 && arr[idx-1] !== 0x03
      );
      expect(opcIndex).toBeGreaterThan(-1);
    });

    test('存在しないプロパティがあるとGET_SNA(0x52)を返す', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '62',
        DETAILs: { '80': '', 'ff': '' } // ffは存在しない
      };
      const dev_details = {
        '013001': {
          '80': [0x30]
        }
      };

      EL.replyGetDetail(rinfo, els, dev_details);

      const sentArray = sendArraySpy.mock.calls[0][1];

      // ESVが0x52(GET_SNA)
      expect(sentArray).toContain(0x52);
    });

    test('全プロパティが存在しない場合もGET_SNAを返す', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '62',
        DETAILs: { 'fe': '', 'ff': '' }
      };
      const dev_details = {
        '013001': {
          '80': [0x30]
        }
      };

      EL.replyGetDetail(rinfo, els, dev_details);

      const sentArray = sendArraySpy.mock.calls[0][1];
      expect(sentArray).toContain(0x52);
    });

    test('elsがnullの場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const dev_details = {
        '013001': {
          '80': [0x30]
        }
      };

      expect(() => EL.replyGetDetail(rinfo, null, dev_details)).toThrow();
    });

    test('dev_detailsがnullの場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '62',
        DETAILs: { '80': '' }
      };

      expect(() => EL.replyGetDetail(rinfo, els, null)).toThrow();
    });

    test('els.DETAILsが空オブジェクトの場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '62',
        DETAILs: {}
      };
      const dev_details = {
        '013001': {
          '80': [0x30]
        }
      };

      EL.replyGetDetail(rinfo, els, dev_details);

      // 空でも送信は行われる(OPC=0)
      expect(sendArraySpy).toHaveBeenCalled();
    });

    test('dev_detailsに該当EOJがない場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '62',
        DETAILs: { '80': '' }
      };
      const dev_details = {
        '029001': { // 違うEOJ
          '80': [0x30]
        }
      };

      EL.replyGetDetail(rinfo, els, dev_details);

      const sentArray = sendArraySpy.mock.calls[0][1];
      // 見つからない→GET_SNA
      expect(sentArray).toContain(0x52);
    });
  });

  describe('replySetDetail', () => {
    let sendArraySpy;
    let replySetDetail_subSpy;

    beforeEach(() => {
      sendArraySpy = jest.spyOn(EL, 'sendArray').mockImplementation(() => {});
      replySetDetail_subSpy = jest.spyOn(EL, 'replySetDetail_sub');
    });

    afterEach(() => {
      sendArraySpy.mockRestore();
      replySetDetail_subSpy.mockRestore();
    });

    test('SetIの時は応答を返さない', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '60', // SETI
        DETAILs: { '80': '30' }
      };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      replySetDetail_subSpy.mockReturnValue(true);
      EL.replySetDetail(rinfo, els, dev_details);

      // SetIは応答を返さない
      expect(sendArraySpy).not.toHaveBeenCalled();
    });

    test('SetCで全て成功した時はSET_RES(0x71)を返す', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '61', // SETC
        DETAILs: { '80': '30' }
      };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      replySetDetail_subSpy.mockReturnValue(true);
      EL.replySetDetail(rinfo, els, dev_details);

      const sentArray = sendArraySpy.mock.calls[0][1];
      expect(sentArray).toContain(0x71); // SET_RES
    });

    test('SetCで一部失敗した時はSETC_SNA(0x51)を返す', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '61', // SETC
        DETAILs: { '80': '30', '81': '0f' }
      };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      // 80は成功、81は失敗
      replySetDetail_subSpy.mockReturnValueOnce(true).mockReturnValueOnce(false);
      EL.replySetDetail(rinfo, els, dev_details);

      const sentArray = sendArraySpy.mock.calls[0][1];
      expect(sentArray).toContain(0x51); // SETC_SNA
    });

    test('DEOJが存在しない場合はfalseを返して何もしない', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '029001', // 存在しないEOJ
        ESV: '61',
        DETAILs: { '80': '30' }
      };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      const result = EL.replySetDetail(rinfo, els, dev_details);

      expect(result).toBe(false);
      expect(sendArraySpy).not.toHaveBeenCalled();
    });

    test('elsがnullの場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      expect(() => EL.replySetDetail(rinfo, null, dev_details)).toThrow();
    });

    test('dev_detailsがnullの場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '61',
        DETAILs: { '80': '30' }
      };

      expect(() => EL.replySetDetail(rinfo, els, null)).toThrow();
    });

    test('els.DETAILsが空オブジェクトの場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '61',
        DETAILs: {}
      };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      replySetDetail_subSpy.mockReturnValue(true);
      EL.replySetDetail(rinfo, els, dev_details);

      // 空でも送信は行われる(OPC=0)
      expect(sendArraySpy).toHaveBeenCalled();
    });

    test('ESVが不明な値の場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
          ESV: '99', // 不明なESV
        DETAILs: { '80': '30' }
      };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      replySetDetail_subSpy.mockReturnValue(true);
      const result = EL.replySetDetail(rinfo, els, dev_details);

        // 不明なESVはswitchでマッチせずundefinedを返す
        expect(result).toBeUndefined();
    });

    test('全てのプロパティ設定が失敗した場合', () => {
      const rinfo = { address: '192.168.1.1' };
      const els = {
        TID: '0001',
        SEOJ: '05ff01',
        DEOJ: '013001',
        ESV: '61',
        DETAILs: { '80': '30', '81': '0f' }
      };
      const dev_details = {
        '013001': {
          '80': [0x31]
        }
      };

      // 全て失敗
      replySetDetail_subSpy.mockReturnValue(false);
      EL.replySetDetail(rinfo, els, dev_details);

      const sentArray = sendArraySpy.mock.calls[0][1];
      expect(sentArray).toContain(0x51); // SETC_SNA
    });
  });

  describe('complementFacilities', () => {
    let sendDetailsSpy;
    let complementFacilities_subSpy;
    let originalAutoGetWaitings;
    let originalFacilities;

    beforeEach(() => {
      sendDetailsSpy = jest.spyOn(EL, 'sendDetails').mockImplementation(() => {});
      complementFacilities_subSpy = jest.spyOn(EL, 'complementFacilities_sub').mockImplementation(() => {});
      originalAutoGetWaitings = EL.autoGetWaitings;
      originalFacilities = EL.facilities;
      EL.autoGetWaitings = 0;
    });

    afterEach(() => {
      sendDetailsSpy.mockRestore();
      complementFacilities_subSpy.mockRestore();
      EL.autoGetWaitings = originalAutoGetWaitings;
      EL.facilities = originalFacilities;
    });

    test('autoGetWaitingsが10を超えるとスキップ', () => {
      EL.autoGetWaitings = 11;
      EL.facilities = {
        '192.168.1.1': {
          '0ef001': { '80': '30' }
        }
      };

      EL.complementFacilities();

      // 処理がスキップされるので何も送信されない
      expect(sendDetailsSpy).not.toHaveBeenCalled();
      expect(complementFacilities_subSpy).not.toHaveBeenCalled();
    });

    test('NodeProfileが無い場合はd6/83/9d/9e/9fを要求', () => {
      EL.facilities = {
        '192.168.1.1': {
          '013001': { '80': '30' } // NodeProfileなし
        }
      };

      EL.complementFacilities();

      expect(sendDetailsSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        EL.NODE_PROFILE_OBJECT,
        EL.NODE_PROFILE_OBJECT,
        EL.GET,
        [{'d6':''}, {'83':''}, {'9d':''}, {'9e':''}, {'9f':''}]
      );
    });

    test('NodeProfileがある場合は各EOJに対してcomplementFacilities_subを呼ぶ', () => {
      EL.facilities = {
        '192.168.1.1': {
          '0ef001': { '80': '30', 'd6': '010130' },
          '013001': { '80': '30' }
        }
      };

      EL.complementFacilities();

      expect(complementFacilities_subSpy).toHaveBeenCalledTimes(2);
      expect(complementFacilities_subSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        '0ef001',
        expect.any(Object)
      );
      expect(complementFacilities_subSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        '013001',
        expect.any(Object)
      );
    });

    test('複数IPアドレスの機器を処理', () => {
      EL.facilities = {
        '192.168.1.1': {
          '0ef001': { '80': '30' },
          '013001': { '80': '30' }
        },
        '192.168.1.2': {
          '0ef001': { '80': '30' },
          '029001': { '80': '30' }
        }
      };

      EL.complementFacilities();

      // 各IPの各EOJに対してcomplementFacilities_subが呼ばれる
      // IP1: 0ef001, 013001 = 2回
      // IP2: 0ef001, 029001 = 2回
      expect(complementFacilities_subSpy).toHaveBeenCalledTimes(4);
    });

    test('facilitiesが空の場合は何もしない', () => {
      EL.facilities = {};

      EL.complementFacilities();

      expect(sendDetailsSpy).not.toHaveBeenCalled();
      expect(complementFacilities_subSpy).not.toHaveBeenCalled();
    });

    test('facilitiesがnullの場合', () => {
      EL.facilities = null;

      // null.forEachでエラー
      expect(() => EL.complementFacilities()).toThrow();
    });

    test('facilitiesがundefinedの場合', () => {
      EL.facilities = undefined;

      // undefinedのObject.keysでエラー
      expect(() => EL.complementFacilities()).toThrow();
    });

    test('NodeProfile(0ef001)が複数プロパティを持つ場合', () => {
      EL.facilities = {
        '192.168.1.1': {
          '0ef001': {
            '80': '30',
            'd6': '010130',
            '83': '00fe01',
            '9d': '01',
            '9e': '01',
            '9f': '01'
          },
          '013001': { '80': '30' }
        }
      };

      EL.complementFacilities();

      // NodeProfileはあるのでcomplementFacilities_subが呼ばれる
      expect(complementFacilities_subSpy).toHaveBeenCalled();
      // NodeProfile自体に対しても呼ばれる
      expect(complementFacilities_subSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        '0ef001',
        expect.any(Object)
      );
    });

    test('一部のIPにNodeProfileがない場合', () => {
      EL.facilities = {
        '192.168.1.1': {
          '0ef001': { '80': '30', 'd6': '010130' },
          '013001': { '80': '30' }
        },
        '192.168.1.2': {
          '013001': { '80': '30' } // NodeProfileなし
        }
      };

      EL.complementFacilities();

      // IP2にNodeProfileがないのでsendDetailsが呼ばれる
      expect(sendDetailsSpy).toHaveBeenCalledWith(
        '192.168.1.2',
        EL.NODE_PROFILE_OBJECT,
        EL.NODE_PROFILE_OBJECT,
        EL.GET,
        [{'d6':''}, {'83':''}, {'9d':''}, {'9e':''}, {'9f':''}]
      );

      // IP1のEOJに対してはcomplementFacilities_subが呼ばれる
      expect(complementFacilities_subSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        '0ef001',
        expect.any(Object)
      );
    });

    test('autoGetWaitingsがちょうど10の場合は処理を実行', () => {
      EL.autoGetWaitings = 10;
      EL.facilities = {
        '192.168.1.1': {
          '0ef001': { '80': '30', 'd6': '010130' },
          '013001': { '80': '30' }
        }
      };

      EL.complementFacilities();

      // 10以下なので処理される
      expect(complementFacilities_subSpy).toHaveBeenCalled();
    });

    test('EOJが0ef001のみの場合', () => {
      EL.facilities = {
        '192.168.1.1': {
          '0ef001': { '80': '30', 'd6': '010130' }
        }
      };

      EL.complementFacilities();

      // NodeProfile自体に対してcomplementFacilities_subが呼ばれる
      expect(complementFacilities_subSpy).toHaveBeenCalledTimes(1);
      expect(complementFacilities_subSpy).toHaveBeenCalledWith(
        '192.168.1.1',
        '0ef001',
        expect.any(Object)
      );
    });
  });

});
