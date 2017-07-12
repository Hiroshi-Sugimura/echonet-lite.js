//////////////////////////////////////////////////////////////////////
//	$Date:: 2016-10-18 10:50:04 +0900#$
//	$Rev: 10232 $
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27 - above.
//////////////////////////////////////////////////////////////////////
// UDPつかう
var dgram = require('dgram');


//////////////////////////////////////////////////////////////////////
// ECHONET Lite

/*
	データ構造
	EHD : str.substr( 0, 4 ),
	TID : str.substr( 4, 4 ),
	SEOJ : str.substr( 8, 6 ),
	DEOJ : str.substr( 14, 6 ),
	EDATA: str.substr( 20 ),    // 下記はEDATAの詳細
	ESV : str.substr( 20, 2 ),
	OPC : str.substr( 22, 2 ),
	DETAIL: str.substr( 24 ),
	DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
*/


// クラス変数
var EL = {
	// define
  SETI_SNA: "50",
  SETC_SNA: "51",
  GET_SNA: "52",
  INF_SNA: "53",
  SETGET_SNA: "5e",
  SETI: "60",
  SETC: "61",
  GET: "62",
  INF_REQ: "63",
  SETGET: "6e",
  SET_RES: "71",
  GET_RES: "72",
  INF: "73",
  INFC: "74",
  INFC_RES: "7a",
  SETGET_RES: "7e",
  EL_port: 3610,
  isIPv6: false,
  EL_Multi: '224.0.23.0',
  EL_Multi6: 'FF02::1',
  EL_obj: null,
  EL_cls: null,
  Node_details:	{
	  "80": [0x30],
	  "82": [0x01, 0x0a, 0x01, 0x00], // EL version, 1.1
	  "83": [0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // identifier
	  "8a": [0x00, 0x00, 0x77], // maker code
	  "9d": [0x02, 0x80, 0xd5],       // inf map, 1 Byte目は個数
	  "9e": [0x00],                 // set map, 1 Byte目は個数
	  "9f": [0x09, 0x80, 0x82, 0x83, 0x8a, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7], // get map, 1 Byte目は個数
	  "d3": [0x00, 0x00, 0x01],  // 自ノードで保持するインスタンスリストの総数（ノードプロファイル含まない）, user項目
	  "d4": [0x00, 0x02],        // 自ノードクラス数, user項目
	  "d5": [],    // インスタンスリスト通知, user項目
	  "d6": [],    // 自ノードインスタンスリストS, user項目
	  "d7": [] },  // 自ノードクラスリストS, user項目
  debugMode: false,
  facilities: {}  	// ネットワーク内の機器情報リスト
	// データ形式の例
	// { '192.168.0.3': { '05ff01': { d6: '' } },
	// '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
};


// 初期化，バインド
EL.initialize = function ( objList, userfunc, ipVer ) {

	EL.isIPv6 = (ipVer == 6); // IPv6 flag

	// オブジェクトリストを確保
	EL.EL_obj = objList;

	// クラスリストにする
	var classes = objList.map( function(e) {	// クラスだけにかえる
		return e.substr(0,4);
	});
	var classList = classes.filter( function (x, i, self) {		// 重複削除
		return self.indexOf(x) === i;
	});
	EL.EL_cls = classList;

	// インスタンス情報
	EL.Node_details["d3"] = [ 0x00, 0x00, EL.EL_obj.length]; // D3はノードプロファイル入らない，最大253では？なぜ3Byteなのか？
	var v = EL.EL_obj.map( function( elem ){
		return EL.toHexArray( elem );
	});
	v.unshift( EL.EL_obj.length );
	EL.Node_details["d5"] = Array.prototype.concat.apply([], v);  // D5, D6同じでよい．ノードプロファイル入らない．
	EL.Node_details["d6"] = EL.Node_details["d5"];

	// クラス情報
	EL.Node_details["d4"] = [ 0x00, EL.EL_cls.length + 1]; // D4だけなぜかノードプロファイル入る．
	v = EL.EL_cls.map( function( elem ){
		return EL.toHexArray( elem );
	});
	v.unshift( EL.EL_cls.length );
	EL.Node_details["d7"] = Array.prototype.concat.apply([], v);  // D7はノードプロファイル入らない

	// EL受け取るようのUDP
	var sock = dgram.createSocket(EL.isIPv6 ? "udp6" : "udp4", function (msg, rinfo) {
		EL.returner( msg, rinfo, userfunc );
	});

	// マルチキャスト設定
	sock.bind( EL.EL_port, EL.isIPv6 ? '::' : '0.0.0.0', function() {
		sock.setMulticastLoopback( true );
		sock.addMembership( EL.isIPv6 ? EL.EL_Multi6 : EL.EL_Multi );
		// console.log( "EL_port bind OK!" );
	});


	// 初期化終わったのでノードのINFをだす
	EL.sendOPC1( EL.isIPv6 ? EL.EL_Multi6 : EL.EL_Multi, [0x0e,0xf0,0x01], [0x0e,0xf0,0x01], 0x73, 0xd5, EL.Node_details["d5"] );

	return sock;
};


//////////////////////////////////////////////////////////////////////
// eldata を見る，表示関係
//////////////////////////////////////////////////////////////////////

// ELDATA形式
EL.eldataShow = function( eldata ) {
	if( eldata != null ) {
		console.log( 'EHD: ' + eldata.EHD + 'TID: ' +eldata.TID + 'SEOJ: ' + eldata.SEOJ + 'DEOJ: ' + eldata.DEOJ + '\nEDATA: ' + eldata.EDATA );
	}else{
		console.log( "EL.eldataShow error. eldata is not EL data." );
	}
};


// 文字列
EL.stringShow = function( str ) {
	try{
		eld = EL.parseString(str);
		EL.eldataShow( eld );
	}catch (e){
		throw e;
	}
};

// バイトデータ
EL.bytesShow = function( bytes ) {
	eld = EL.parseBytes( bytes );
	EL.eldataShow( eld );
};


//////////////////////////////////////////////////////////////////////
// 変換系
//////////////////////////////////////////////////////////////////////

// Detailだけをparseする，内部で主に使う
EL.parseDetail = function( opc, str ) {

	try {
		var ret = {}; // 戻り値用，連想配列
		var now = 0;  // 現在のIndex
		var epc = 0;
		var pdc = 0;
		var edt = [];
		var array = EL.toHexArray( str );  // edts

		// OPCループ
		for( var i = 0; i< opc; i += 1 ) {
			// EPC（機能）
			epc = array[now];
			now++;

			// PDC（EDTのバイト数）
			pdc = array[now];
			now++;

			// getの時は pdcが0なのでなにもしない，0でなければ値が入っている
			if( pdc == 0 ) {
				ret[ EL.toHexString(epc) ] = "";
			} else {
				// PDCループ
				for( var j = 0; j < pdc; j += 1 ) {
					// 登録
					edt.push( array[now] );
					now++;
				}
				ret[ EL.toHexString(epc) ] = EL.bytesToString( edt );
			}

		}  // opcループ

	} catch (e) {
		throw new Error('EL.parseDetail(): detail error. opc: ' + opc + ' str: '+ str);
		return {};
	}

	return ret;
};


// バイトデータをいれるとELDATA形式にする
EL.parseBytes = function( bytes ) {
	try{

		// 最低限のELパケットになってない
		if( bytes.length < 14 ) {
			console.error( 1, "EL.parseBytes error. bytes is less then 14 bytes. bytes.length is " + bytes.length  );
			console.error( 1, bytes );
			return null;
		}

		// 数値だったら文字列にして
		var str = "";
		if( bytes[0] != 'string' ) {
			for( var i = 0; i < bytes.length; i++ ) {
				str += EL.toHexString( bytes[i] );
			}
		}

		// 文字列にしたので，parseStringで何とかする
		return ( EL.parseString(str) );
	}catch (e){
		throw e;
	}
};


// 16進数で表現された文字列をいれるとELDATA形式にする
EL.parseString = function( str ) {

	try{
		var eldata = {
			'EHD'    : str.substr( 0, 4 ),
			'TID'    : str.substr( 4, 4 ),
			'SEOJ'   : str.substr( 8, 6 ),
			'DEOJ'   : str.substr( 14, 6 ),
			'EDATA'  : str.substr( 20 ),    // 下記はEDATAの詳細
			'ESV'    : str.substr( 20, 2 ),
			'OPC'    : str.substr( 22, 2 ),
			'DETAIL' : str.substr( 24 ),
			'DETAILs': EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
		};
	}catch (e){
		throw e;
	}

	return ( eldata );
};


// 文字列をいれるとELらしい切り方のStringを得る
EL.getSeparatedString_String = function( str ) {
	try{
		if( typeof str == 'string' ) {
			return ( str.substr( 0, 4 ) + " " +
					 str.substr( 4, 4 ) + " " +
					 str.substr( 8, 6 ) + " " +
					 str.substr( 14, 6 ) + " " +
					 str.substr( 20, 2 ) + " " +
					 str.substr( 22 ) );
		}
		else{
		// console.error( "str is not string." );
		// console.error( str );
		// console.trace();
		// return '';
			throw new Error("str is not string." );
		}
	}catch (e) {
		throw e;
	}
};


// ELDATAをいれるとELらしい切り方のStringを得る
EL.getSeparatedString_ELDATA = function( eldata ) {
	return ( eldata.EHD + ' ' + eldata.TID + ' ' + eldata.SEOJ + ' ' + eldata.DEOJ + ' ' + eldata.EDATA );
};


// ELDATA形式から配列へ
EL.ELDATA2Array = function( eldata ) {
	var ret = EL.toHexArray( eldata.EHD + eldata.TID + eldata.SEOJ + eldata.DEOJ + eldata.EDATA );
	return ret;
};

// 1バイトを文字列の16進表現へ（1Byteは必ず2文字にする）
EL.toHexString = function( byte ) {
	// 文字列0をつなげて，後ろから2文字分スライスする
	return ( ("0" + byte.toString(16)).slice(-2) );
};

// 16進表現の文字列を数値のバイト配列へ
EL.toHexArray = function( string ) {

	var ret = [];

	for( i=0; i < string.length; i += 2 ) {

		l = string.substr( i, 1 );
		r = string.substr( i+1, 1 );

		ret.push( (parseInt(l, 16) * 16) + parseInt(r, 16) );
	}

	return ret;
};


// バイト配列を文字列にかえる
EL.bytesToString = function(bytes) {
	var ret = "";

	for(var i=0; i<bytes.length; i++) {
		ret += EL.toHexString( bytes[i] );
	}
	return ret;
};


//////////////////////////////////////////////////////////////////////
// 送信
//////////////////////////////////////////////////////////////////////

// EL送信のベース
EL.sendBase = function( ip, buffer ) {
	// 送信する
	var client = dgram.createSocket(EL.isIPv6 ? "udp6" : "udp4");
	client.send( buffer, 0, buffer.length, EL.EL_port, ip, function(err, bytes) {
		client.close();
	});
};


// 配列の時
EL.sendArray = function( ip, array ) {
	EL.sendBase( ip, new Buffer(array) );
};


// ELの非常に典型的なOPC一個でやる
EL.sendOPC1 = function( ip, seoj, deoj, esv, epc, edt) {

	if( typeof(seoj) == "string" ) {
		seoj = EL.toHexArray(seoj);
	}

	if( typeof(deoj) == "string" ) {
		deoj = EL.toHexArray(deoj);
	}

	if( typeof(esv) == "string" ){
		esv = (EL.toHexArray(esv))[0];
	}

	if( typeof(epc) == "string" ) {
		epc = (EL.toHexArray(epc))[0]
	}

	if( typeof(edt) == "number" ) {
		edt = [edt];
	}else if( typeof(edt) == "string" ) {
		edt = EL.toHexArray(edt);
	}

	var buffer;

	if( esv == 0x62 ) { // get
		buffer = new Buffer([
			0x10, 0x81,
			0x00, 0x00,
			seoj[0], seoj[1], seoj[2],
			deoj[0], deoj[1], deoj[2],
			esv,
			0x01,
			epc,
			0x00]);
	}else{
		buffer = new Buffer([
			0x10, 0x81,
			0x00, 0x00,
			seoj[0], seoj[1], seoj[2],
			deoj[0], deoj[1], deoj[2],
			esv,
			0x01,
			epc,
			edt.length].concat(edt) );
	}

	// console.log( buffer );

	// データができたので送信する
	EL.sendBase( ip, buffer );
};



// ELの非常に典型的な送信3 文字列タイプ
EL.sendString = function( ip, string ) {
	// 送信する
	EL.sendBase( ip, new Buffer( EL.toHexArray(string) ) );
};


//////////////////////////////////////////////////////////////////////
// EL受信
//////////////////////////////////////////////////////////////////////

// ELの受信データを振り分けるよ，何とかしよう
EL.returner = function( bytes, rinfo, userfunc ) {
	// console.log( "EL.returner:EL.parseBytes.");
	var els;

	try{
		els = EL.parseBytes( bytes );

		// キチンとパースできたか？
		if( null == els ) {
			return;
		}

		// ヘッダ確認
		if( els.EHD != '1081' ) {
			return;
		}

		// Node profileに関してきちんと処理する
		if( els.DEOJ == '0ef000' || els.DEOJ == '0ef001' ) {

			switch( els.ESV ) {
				////////////////////////////////////////////////////////////////////////////////////
				// 0x5x
				// エラー受け取ったときの処理
			  case EL.SETI_SNA:   // "50"
			  case EL.SETC_SNA:   // "51"
			  case EL.GET_SNA:    // "52"
			  case EL.INF_SNA:    // "53"
			  case EL.SETGET_SNA: // "5e"
				// console.log( "EL.returner: get error" );
				// console.dir( els );
				return;
				break;

				////////////////////////////////////////////////////////////////////////////////////
				// 0x6x
			  case EL.SETI: // "60
			  case EL.SETC: // "61"
				break;

			  case EL.GET: // 0x62
				// console.log( "EL.returner: get prop. of Node profile.");
				for( var epc in els.DETAILs ) {
					if( EL.Node_details[epc] ) { // 持ってるEPCのとき
						EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x72, EL.toHexArray(epc), EL.Node_details[epc] );
					} else { // 持っていないEPCのとき, SNA
						EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x52, EL.toHexArray(epc), [0x00] );
					}
				}
				break;

			  case EL.INFREQ: // 0x63
				if( els.DETAILs["d5"] == "00" ) {
					// console.log( "EL.returner: Ver1.0 INF_REQ.");
					EL.sendOPC1( EL.isIPv6 ? EL.EL_Multi6 : EL.EL_Multi, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x73, 0xd5, EL.Node_details["d5"] );
				}
				break;

			  case EL.SETGET: // "6e"
				break;

				////////////////////////////////////////////////////////////////////////////////////
				// 0x7x
			  case EL.SET_RES: // 71
				// SetCに対する返答のSetResは，EDT 0x00でOKの意味を受け取ることとなる．ゆえにその詳細な値をGetする必要がある
				if(els.DETAIL.substr(0,2) == '00' ) {
					var msg = "1081000005ff01" + els.SEOJ + "6201" + els.DETAIL.substr(0,2) + "00";
					EL.sendString( rinfo.address, msg );
				}
				break;

			  case EL.GET_RES: // 72
				// V1.1
				// d6のEDT表現がとても特殊，EDT1バイト目がインスタンス数になっている
				if( els.SEOJ.substr(0, 4) === '0ef0' && els.DETAILs.d6 != null && els.DETAILs.d6 != '' ) {
					// console.log( "EL.returner: get object list! PropertyMap req V1.0.");
					// 自ノードインスタンスリストSに書いてあるオブジェクトのプロパティマップをもらう
					var array = EL.toHexArray( els.DETAILs.d6 );
					var instNum = array[0];
					while( 0 < instNum ) {
						EL.getPropertyMaps( rinfo.address, array.slice( (instNum - 1)*3 +1, (instNum - 1)*3 +4 ) );
						instNum -= 1;
					}
				}else if( els.DETAILs["9f"] != null ) {
					var array = EL.toHexArray( els.DETAILs["9f"] );
					if( array.length < 16 ) { // プロパティマップ16バイト未満は記述形式１
						var num = array[0];
						for( var i=0; i<num; i++ ) {
							// このとき9fをまた取りに行くと無限ループなのでやめる
							if( array[i+1] != 0x9f ) {
								EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x62, array[i+1], [0x00] );
							}
						}
					} else {
						// 16バイト以上なので記述形式2，EPCのarrayを作り直したら，あと同じ
						var array = EL.parseMapForm2( els.DETAILs["9f"] );
						var num = array[0];
						for( var i=0; i<num; i++ ) {
							// このとき9fをまた取りに行くと無限ループなのでやめる
							if( array[i+1] != 0x9f ) {
								EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x62, array[i+1], [0x00] );
							}
						}
					}
				}
				break;

			  case EL.INF:  // 0x73
				// V1.0 オブジェクトリストをもらったらそのオブジェクトのPropertyMapをもらいに行く, デバイスが後で起動した
				if( els.DETAILs.d5 != null && els.DETAILs.d5 != "" ) {
					// ノードプロファイルオブジェクトのプロパティマップをもらう
					EL.getPropertyMaps( rinfo.address, [0x0e, 0xf0, 0x00] );
				}
				break;

			  case EL.INFC: // "74"
				// V1.0 オブジェクトリストをもらったらそのオブジェクトのPropertyMapをもらいに行く
				if( els.DETAILs.d5 != null && els.DETAILs.d5 ) {
					// ノードプロファイルオブジェクトのプロパティマップをもらう
					EL.getPropertyMaps( rinfo.address, [0x0e, 0xf0, 0x00] );

					// console.log( "EL.returner: get object list! PropertyMap req.");
					var array = EL.toHexArray( els.DETAILs.d5 );
					var instNum = array[0];
					while( 0 < instNum ) {
						EL.getPropertyMaps( rinfo.address, array.slice( (instNum - 1)*3 +1, (instNum - 1)*3 +4 ) );
						instNum -= 1;
					}
				}
				break;

			  case EL.INFC_RES: // "7a"
			  case EL.SETGET_RES: // "7e"
				// console.log( "get " );
				// console.dir( els );
				break;

			  default:
				// console.log( "???" );
				// console.dir( els );
				break;
			}
		}

		// 受信状態から機器情報修正, GETとINFREQは除く
		if( els.ESV != "62" && els.ESV != "63" ) {
			EL.renewFacilities( rinfo.address, els );
		}

		// 機器オブジェクトに関してはユーザー関数に任す
		userfunc( rinfo, els );
	} catch(e) {
		// console.error("EL.returner(): received packet error.");
		// console.error( bytes );
		userfunc( rinfo, els, e );
	}

};


// ネットワーク内のEL機器全体情報を更新する，受信したら勝手に実行される
EL.renewFacilities = function( ip, els ) {
	try {
		epcList = EL.parseDetail( els.OPC, els.DETAIL );

		// 新規IP
		if( EL.facilities[ ip ] == null ) { //見つからない
			EL.facilities[ ip ] = {};
		}

		// 新規obj
		if( EL.facilities[ ip ][ els.SEOJ ] == null ) {
			EL.facilities[ ip ][ els.SEOJ ] = {};
			// 新規オブジェクトのとき，プロパティリストもらおう
			EL.getPropertyMaps( ip, EL.toHexArray(els.SEOJ) );
		}

		for( var epc in epcList ) {
			// 新規epc
			if( EL.facilities[ ip ][ els.SEOJ ][ epc ] == null ) {
				EL.facilities[ ip ][ els.SEOJ ][ epc ] = {};
			}

			EL.facilities[ ip ][ els.SEOJ ][ epc ] = epcList[ epc ];
		}
	}catch(e) {
		console.error("EL.renewFacilities error.");
		// console.dir(e);
		throw e;
	}
};




//////////////////////////////////////////////////////////////////////
// EL，上位の通信手続き
//////////////////////////////////////////////////////////////////////

// 機器検索
EL.search = function() {
	EL.sendOPC1( EL.isIPv6 ? EL.EL_Multi6 : EL.EL_Multi, [0x0e,0xf0, 0x01], [0x0e, 0xf0, 0x00], 0x62, 0xD6, [0x00] );  // すべてノードに対して，すべてのEOJをGetする
};


// プロパティマップをすべて取得する
EL.getPropertyMaps = function ( ip, eoj ) {
	EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9D, [0x00] );  // INF prop
	EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9E, [0x00] );  // SET prop
	EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9F, [0x00] );  // GET prop
};


// parse Propaty Map Form 2
// 16以上のプロパティ数の時，記述形式2，出力はForm1にすること
EL.parseMapForm2 = function( bitstr ) {
	var ret = [];
	var val = 0x80;
	var array = EL.toHexArray( bitstr );

	// bit loop
	for( var bit=0; bit<8; bit += 1 ) {
		// byte loop
		for( var byt=1; byt<17; byt+=1 ) {
			if( (array[byt] >> bit) & 0x01 ) {
				ret.push(val);
			}
			val += 1;
		}
	}

	ret.unshift( ret.length );

	return ret;
};



module.exports = EL;

//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
