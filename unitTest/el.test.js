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

});
