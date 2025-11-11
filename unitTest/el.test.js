/**
 * ECHONET Lite ユニットテスト
 */

const EL = require('../index.js');

describe('EL - ECHONET Lite プロトコル', () => {
  
  describe('変換系関数', () => {
    
    test('toHexString: バイトを16進数文字列に変換', () => {
      expect(EL.toHexString(0)).toBe('00');
      expect(EL.toHexString(15)).toBe('0f');
      expect(EL.toHexString(255)).toBe('ff');
      expect(EL.toHexString(16)).toBe('10');
    });

    test('toHexArray: 16進数文字列をバイト配列に変換', () => {
      expect(EL.toHexArray('00')).toEqual([0]);
      expect(EL.toHexArray('0f')).toEqual([15]);
      expect(EL.toHexArray('ff')).toEqual([255]);
      expect(EL.toHexArray('1081')).toEqual([16, 129]);
      expect(EL.toHexArray('0ef001')).toEqual([14, 240, 1]);
    });

    test('bytesToString: バイト配列を16進数文字列に変換', () => {
      expect(EL.bytesToString([0])).toBe('00');
      expect(EL.bytesToString([15])).toBe('0f');
      expect(EL.bytesToString([255])).toBe('ff');
      expect(EL.bytesToString([16, 129])).toBe('1081');
      expect(EL.bytesToString([14, 240, 1])).toBe('0ef001');
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

    test('parseDetail: 詳細部分のパース', () => {
      // OPC=2, EPC=0x80(動作状態)=0x30, EPC=0x81(設置場所)=0x01
      const detail = '80013081010f';
      const result = EL.parseDetail('02', detail);
      
      expect(result).toBeDefined();
      expect(result['80']).toBe('30');
      expect(result['81']).toBe('0f');
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
      expect(result[0]).toBeGreaterThan(0);  // 先頭は個数（0より大きい）
      expect(result).toContain(0x80);  // 0x80が含まれる
      expect(result.length).toBeGreaterThan(1);  // 配列が存在する
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

});
