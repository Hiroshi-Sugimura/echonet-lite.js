//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27 - above.
//////////////////////////////////////////////////////////////////////
'use strict'

const os = require('os'); // interface listほしい
const dgram = require('dgram'); // UDPつかう



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
let EL = {
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
	ipVer: 4, // 0 = IPv4 & IPv6, 4 = IPv4, 6 = IPv6
	nicList: {v4: [], v6: []},
	usingIF: {v4: '', v6: ''}, // '' = default
	tid: [0,0],   // transaction id
	ignoreMe: true, // true = 自IPから送信されたデータ受信を無視
	autoGetProperties: true, // true = 自動的にGetPropertyをする
	autoGetDelay: 2000, // 自動取得のときに，すぐにGetせずにDelayする
	autoGetWaitings: 0, // 自動取得待ちの個数
	debugMode: false,
	facilities: {}  	// ネットワーク内の機器情報リスト
	// データ形式の例
	// { '192.168.0.3': { '05ff01': { d6: '' } },
	// '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
};


// 初期化，バインド
// defaultでIPversionは4, 取りうる値は4, 6, 0 = both
// Nodejsの対応が遅れていてまだうまく動かないみたい，しばらくipVer = 4でやる。
// 複数NICがあるときにNICを指定できるようにした。NICの設定はmulticastAddrに出力したいインタフェースのIPを指定する。
// ipVer == 0の時はsocketが4と6の2個手に入れることに注意
EL.initialize = function (objList, userfunc, ipVer = 4, Options = {v4: '', v6: '', ignoreMe: true, autoGetProperties: true, autoGetDelay: 2000, debugMode: false}) {

	EL.debugMode = Options.debugMode; // true: show debug log
	EL.renewNICList();	// Network Interface Card List
	EL.ipVer = ipVer;	// ip version

	// 複数NIC対策
	EL.usingIF.v4 = Options.v4 != undefined && Options.v4 != '' ? Options.v4 : '0.0.0.0';
	EL.usingIF.v6 = Options.v6 != undefined ? Options.v6 : EL.nicList.v6[0].name;

	EL.ignoreMe = Options.ignoreMe != false ? true : false;	// 自IPから送信されたデータ受信を無視, default true, 微妙な条件の書き方はundef対策
	EL.autoGetProperties = Options.autoGetProperties ? true : false;	// 自動的なデータ送信の有無
	EL.autoGetDelay = Options.autoGetDelay? Options.autoGetDelay : 2000;	// 自動GetのDelay
	EL.autoGetWaitings = 0;

	// 邪魔なので
	if( EL.debugMode == true ) {
		console.log('==== echonet-lite.js ====');
		console.log('ipVer:', EL.ipVer, ', v4:', EL.usingIF.v4, ', v6:', EL.usingIF.v6);
		console.log('autoGetProperties:', EL.autoGetProperties, ', autoGetDelay: ', EL.autoGetDelay );
		console.log('ignoreMe:', EL.ignoreMe, ', debugMode:', EL.debugMode );
	}

	// オブジェクトリストを確保
	EL.EL_obj = objList;

	// クラスリストにする
	let classes = objList.map(function (e) {	// クラスだけにかえる
		return e.substr(0, 4);
	});
	let classList = classes.filter(function (x, i, self) {		// 重複削除
		return self.indexOf(x) === i;
	});
	EL.EL_cls = classList;

	// インスタンス情報
	EL.Node_details["d3"] = [0x00, 0x00, EL.EL_obj.length]; // D3はノードプロファイル入らない，最大253では？なぜ3Byteなのか？
	let v = EL.EL_obj.map(function (elem) {
		return EL.toHexArray(elem);
	});
	v.unshift(EL.EL_obj.length);
	EL.Node_details["d5"] = Array.prototype.concat.apply([], v);  // D5, D6同じでよい．ノードプロファイル入らない．
	EL.Node_details["d6"] = EL.Node_details["d5"];

	// クラス情報
	EL.Node_details["d4"] = [0x00, EL.EL_cls.length + 1]; // D4だけなぜかノードプロファイル入る．
	v = EL.EL_cls.map(function (elem) {
		return EL.toHexArray(elem);
	});
	v.unshift(EL.EL_cls.length);
	EL.Node_details["d7"] = Array.prototype.concat.apply([], v);  // D7はノードプロファイル入らない

	// EL受信のUDP socket作成
	let sock4, sock6;
	// 両方対応
	if( EL.ipVer == 0 || EL.ipVer == 4) {
		sock4 = dgram.createSocket({type:"udp4",reuseAddr:true}, (msg, rinfo) => {
			EL.returner(msg, rinfo, userfunc);
		});
	}
	if( EL.ipVer == 0 || EL.ipVer == 6) {
		sock6 = dgram.createSocket({type:"udp6",reuseAddr:true}, (msg, rinfo) => {
			EL.returner(msg, rinfo, userfunc);
		});
	}

	// マルチキャスト設定，ネットワークに繋がっていない（IPが一つもない）と例外がでる。
	if( EL.ipVer == 0 || EL.ipVer == 4) {
		sock4.bind( {'address': '0.0.0.0', 'port': EL.EL_port}, function () {
			sock4.setMulticastLoopback(true);
			sock4.addMembership(EL.EL_Multi);
		});
	}
	if( EL.ipVer == 0 || EL.ipVer == 6) {
		sock6.bind({'address': '::', 'port': EL.EL_port}, function () {
			sock6.setMulticastLoopback(true);
			sock6.addMembership(EL.EL_Multi6, '::'+'%'+EL.usingIF.v6);
		});
	}

	// 初期化終わったのでノードのINFをだす, IPv4, IPv6ともに出す
	if( EL.ipVer == 0 || EL.ipVer == 4) {
		EL.sendOPC1( EL.EL_Multi, [0x0e, 0xf0, 0x01], [0x0e, 0xf0, 0x01], 0x73, 0xd5, EL.Node_details["d5"]);
	}
	if( EL.ipVer == 0 || EL.ipVer == 6) {
		EL.sendOPC1( EL.EL_Multi6, [0x0e, 0xf0, 0x01], [0x0e, 0xf0, 0x01], 0x73, 0xd5, EL.Node_details["d5"]);
	}

	if( EL.ipVer == 4) {
		return sock4;
	}else if( EL.ipVer == 6 ) {
		return sock6;
	}else{
		return {sock4, sock6};
	}
};


// NICリスト更新
// loopback無視
EL.renewNICList = function () {
	EL.nicList.v4 = [];
	EL.nicList.v6 = [];
	let interfaces = os.networkInterfaces();
	interfaces = EL.objectSort(interfaces);  // dev nameでsortすると仮想LAN候補を後ろに逃がせる（とみた）
	// console.dir(interfaces);
	for (let name in interfaces) {
		if( name == 'lo0') {continue;}
		interfaces[name].forEach( function(details) {
			if (!details.internal){
				switch(details.family){
				case "IPv4":
					EL.nicList.v4.push({name:name, address:details.address});
					break;
				case "IPv6":
					EL.nicList.v6.push({name:name, address:details.address});
					break;
				}
			}
		});
	}
	return EL.nicList;
}

// 自動取得待ちの個数管理
EL.decreaseWaitings = function () {
	if( EL.autoGetWaitings != 0 ) {
		// console.log( 'decrease:', 'waitings: ', EL.autoGetWaitings );
		EL.autoGetWaitings -= 1;
	}
}

EL.increaseWaitings = function () {
	// console.log( 'increase:', 'waitings: ', EL.autoGetWaitings, 'delay: ', EL.autoGetDelay * (EL.autoGetWaitings+1) );
	EL.autoGetWaitings += 1;
}



//////////////////////////////////////////////////////////////////////
// eldata を見る，表示関係
//////////////////////////////////////////////////////////////////////

// ELDATA形式
EL.eldataShow = function (eldata) {
	if (eldata != null) {
		console.log('EHD: ' + eldata.EHD + 'TID: ' + eldata.TID + 'SEOJ: ' + eldata.SEOJ + 'DEOJ: ' + eldata.DEOJ + '\nEDATA: ' + eldata.EDATA);
	} else {
		console.error("EL.eldataShow error. eldata is not EL data.");
	}
};


// 文字列
EL.stringShow = function (str) {
	try {
		eld = EL.parseString(str);
		EL.eldataShow(eld);
	} catch (e) {
		throw e;
	}
};

// バイトデータ
EL.bytesShow = function (bytes) {
	eld = EL.parseBytes(bytes);
	EL.eldataShow(eld);
};


//////////////////////////////////////////////////////////////////////
// 変換系
//////////////////////////////////////////////////////////////////////

// Detailだけをparseする，内部で主に使う
EL.parseDetail = function( opc, str ) {
	let ret = {}; // 戻り値用，連想配列
	str = str.toUpperCase();

	try {
		let array = EL.toHexArray( str );  // edts
		let epc = array[0]; // 最初は0
		let pdc = array[1]; // 最初は1
		let now = 0;  // 入力データの現在処理位置, Index
		let edt = [];  // 各edtをここに集めて，retに集約

		// property mapだけEDT[0] != バイト数なので別処理
		if( epc == 0x9d || epc == 0x9e || epc == 0x9f ) {
			if( pdc >= 17) { // プロパティの数が16以上の場合（プロパティカウンタ含めてPDC17以上）は format 2
				// 0byte=epc, 2byte=pdc, 4byte=edt
				ret[ EL.toHexString(epc) ] = EL.bytesToString( EL.parseMapForm2( str.substr(4) ) );
				return ret;
			}
			// format 2でなければ以下と同じ形式で解析可能
		}

		// それ以外はEDT[0] == byte数
		// OPCループ
		for (let i = 0; i < opc; i += 1) {
			epc = array[now];  // EPC = 機能
			edt = []; // EDT = データのバイト数
			now++;

			// PDC（EDTのバイト数）
			pdc = array[now];
			now++;

			// getの時は pdcが0なのでなにもしない，0でなければ値が入っている
			if (pdc == 0) {
				ret[EL.toHexString(epc)] = "";
			} else {
				// PDCループ
				for (let j = 0; j < pdc; j += 1) {
					// 登録
					edt.push(array[now]);
					now++;
				}
				ret[EL.toHexString(epc)] = EL.bytesToString(edt);
			}

		}  // opcループ

	} catch (e) {
		throw new Error('EL.parseDetail(): detail error. opc: ' + opc + ' str: ' + str);
		return {};
	}

	return ret;
};


// バイトデータをいれるとELDATA形式にする
EL.parseBytes = function (bytes) {
	try {
		// 最低限のELパケットになってない
		if (bytes.length < 14) {
			console.error("## EL.parseBytes error. bytes is less then 14 bytes. bytes.length is " + bytes.length);
			console.error(bytes);
			return null;
		}

		// 数値だったら文字列にして
		let str = "";
		if (bytes[0] != 'string') {
			for (let i = 0; i < bytes.length; i++) {
				str += EL.toHexString(bytes[i]);
			}
		}
		// 文字列にしたので，parseStringで何とかする
		return (EL.parseString(str));
	} catch (e) {
		throw e;
	}
};


// 16進数で表現された文字列をいれるとELDATA形式にする
EL.parseString = function (str) {
	let eldata = {};

	try {
		eldata = {
			'EHD': str.substr(0, 4),
			'TID': str.substr(4, 4),
			'SEOJ': str.substr(8, 6),
			'DEOJ': str.substr(14, 6),
			'EDATA': str.substr(20),    // 下記はEDATAの詳細
			'ESV': str.substr(20, 2),
			'OPC': str.substr(22, 2),
			'DETAIL': str.substr(24),
			'DETAILs': EL.parseDetail(str.substr(22, 2), str.substr(24))
		};
	} catch (e) {
		throw e;
	}

	return (eldata);
};


// 文字列をいれるとELらしい切り方のStringを得る
EL.getSeparatedString_String = function (str) {
	try {
		if (typeof str == 'string') {
			return (str.substr(0, 4) + " " +
					str.substr(4, 4) + " " +
					str.substr(8, 6) + " " +
					str.substr(14, 6) + " " +
					str.substr(20, 2) + " " +
					str.substr(22));
		} else {
			// console.error( "str is not string." );
			throw new Error("str is not string.");
		}
	} catch (e) {
		throw e;
	}
};


// ELDATAをいれるとELらしい切り方のStringを得る
EL.getSeparatedString_ELDATA = function (eldata) {
	return (eldata.EHD + ' ' + eldata.TID + ' ' + eldata.SEOJ + ' ' + eldata.DEOJ + ' ' + eldata.EDATA);
};


// ELDATA形式から配列へ
EL.ELDATA2Array = function (eldata) {
	let ret = EL.toHexArray(eldata.EHD + eldata.TID + eldata.SEOJ + eldata.DEOJ + eldata.EDATA);
	return ret;
};

// 1バイトを文字列の16進表現へ（1Byteは必ず2文字にする）
EL.toHexString = function (byte) {
	// 文字列0をつなげて，後ろから2文字分スライスする
	return (("0" + byte.toString(16)).slice(-2));
};

// 16進表現の文字列を数値のバイト配列へ
EL.toHexArray = function (string) {
	let ret = [];

	for (let i = 0; i < string.length; i += 2) {
		let l = string.substr(i, 1);
		let r = string.substr(i + 1, 1);
		ret.push((parseInt(l, 16) * 16) + parseInt(r, 16));
	}

	return ret;
};


// バイト配列を文字列にかえる
EL.bytesToString = function (bytes) {
	let ret = "";

	for (let i = 0; i < bytes.length; i++) {
		ret += EL.toHexString(bytes[i]);
	}
	return ret;
};


//////////////////////////////////////////////////////////////////////
// 送信
//////////////////////////////////////////////////////////////////////

// EL送信のベース
EL.sendBase = function (ip, buffer) {
	let tid = [ buffer[2], buffer[3] ];

	// console.log(ip, buffer);
	// ipv4
	if( EL.ipVer == 0 || EL.ipVer == 4 ) {
		// 送信先がipv4ならやる，'.'が使われているかどうかで判定しちゃう
		if( ip.indexOf('.') != -1 ) {
			let client = dgram.createSocket({type:"udp4",reuseAddr:true});

			if( EL.usingIF.v4 != '' ) {
				client.bind( EL.EL_port + 20000, EL.usingIF.v4, () => {
					client.setMulticastInterface( EL.usingIF.v4 );
					client.send(buffer, 0, buffer.length, EL.EL_port, ip, function (err, bytes) {
						if( err ) { console.error('TID:', tid[0], tid[1], err); }
						client.close();
					});
				});
			}else{
				client.send(buffer, 0, buffer.length, EL.EL_port, ip, function (err, bytes) {
					if( err ) { console.error('TID:', tid[0], tid[1], err); }
					client.close();
				});
			}

		}
	}

	// ipv6
	if( EL.ipVer == 0 || EL.ipVer == 6 ) {
		// 送信先がipv6ならやる，':'が使われているかどうかで判定しちゃう
		if( ip.indexOf(':') != -1 ) {
			let client = dgram.createSocket({type:"udp6",reuseAddr:true});
			ip += '%' + EL.usingIF.v6;
			client.send(buffer, 0, buffer.length, EL.EL_port, ip, function (err, bytes) {
				if( err ) { console.error('TID:', tid[0], tid[1], err); }
				client.close();
			});
		}
	}

	return tid;
};


// 配列の時
EL.sendArray = function (ip, array) {
	return EL.sendBase(ip, Buffer.from(array));
};


// ELの非常に典型的なOPC一個でやる
EL.sendOPC1 = function (ip, seoj, deoj, esv, epc, edt) {

	// TIDの調整
	let carry = 0; // 繰り上がり
	if( EL.tid[1] == 0xff ) {
		EL.tid[1] = 0;
		carry = 1;
	} else {
		EL.tid[1] += 1;
	}
	if( carry == 1 ) {
		if( EL.tid[0] == 0xff ) {
			EL.tid[0] = 0;
		} else {
			EL.tid[0] += 1;
		}
	}

	if (typeof (seoj) == "string") {
		seoj = EL.toHexArray(seoj);
	}

	if (typeof (deoj) == "string") {
		deoj = EL.toHexArray(deoj);
	}

	if (typeof (esv) == "string") {
		esv = (EL.toHexArray(esv))[0];
	}

	if (typeof (epc) == "string") {
		epc = (EL.toHexArray(epc))[0]
	}

	if (typeof (edt) == "number") {
		edt = [edt];
	} else if (typeof (edt) == "string") {
		edt = EL.toHexArray(edt);
	}

	let buffer;

	if (esv == 0x62) { // get
		buffer = Buffer.from([
			0x10, 0x81,
			// 0x00, 0x00,
			EL.tid[0], EL.tid[1],
			seoj[0], seoj[1], seoj[2],
			deoj[0], deoj[1], deoj[2],
			esv,
			0x01,
			epc,
			0x00]);
	} else {
		buffer = Buffer.from([
			0x10, 0x81,
			// 0x00, 0x00,
			EL.tid[0], EL.tid[1],
			seoj[0], seoj[1], seoj[2],
			deoj[0], deoj[1], deoj[2],
			esv,
			0x01,
			epc,
			edt.length].concat(edt));
	}

	// データができたので送信する
	return EL.sendBase(ip, buffer);
};



// ELの非常に典型的な送信3 文字列タイプ
EL.sendString = function (ip, string) {
	// 送信する
	return EL.sendBase(ip, Buffer.from(EL.toHexArray(string)));
};


//////////////////////////////////////////////////////////////////////
// EL受信
//////////////////////////////////////////////////////////////////////

// ELの受信データを振り分ける
EL.returner = function (bytes, rinfo, userfunc) {
	// console.log( "========");
	// console.log( "EL.returner:EL.parseBytes.");

	// 自IPを無視する設定があればチェックして無視する
	let ignoreIP = false;
	if( EL.ignoreMe == true ) {
		// loop back
		if( rinfo.address === '127.0.0.1' || rinfo.address === '::1') {
			ignoreIP = true;
			return;
		}

		// my ip
		EL.nicList.v4.forEach( (ip) => {
			if( ip.address === rinfo.address ) {
				ignoreIP = true;
				return;
			}
		});
		EL.nicList.v6.forEach( (ip) => {
			if( ip.address === rinfo.address ) {
				ignoreIP = true;
				return;
			}
		});
	}

	// 無視しない
	let els;

	try {
		els = EL.parseBytes(bytes);

		// キチンとパースできたか？
		if (null == els) {
			return;
		}

		// ヘッダ確認
		if (els.EHD != '1081') {
			return;
		}

		// Node profileに関してきちんと処理する
		if (els.DEOJ.substr(0,4) == '0ef0' ) {

			switch (els.ESV) {
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
				for (let epc in els.DETAILs) {
					if (EL.Node_details[epc]) { // 持ってるEPCのとき
						EL.sendOPC1(rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x72, EL.toHexArray(epc), EL.Node_details[epc]);
					} else { // 持っていないEPCのとき, SNA
						EL.sendOPC1(rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x52, EL.toHexArray(epc), [0x00]);
					}
				}
				break;

			case EL.INF_REQ: // 0x63
				if (els.DETAILs["d5"] == "00") {
					// console.log( "EL.returner: Ver1.0 INF_REQ.");
					if( EL.ipVer == 0 || EL.ipVer == 4) { // ipv4
						EL.sendOPC1( EL.EL_Multi, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x73, 0xd5, EL.Node_details["d5"]);
					}
					if( EL.ipVer == 0 || EL.ipVer == 6) { // ipv6
						EL.sendOPC1( EL.EL_Multi6, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x73, 0xd5, EL.Node_details["d5"]);
					}

				}
				break;

			case EL.SETGET: // "6e"
				break;

				////////////////////////////////////////////////////////////////////////////////////
				// 0x7x
			case EL.SET_RES: // 71
				// SetCに対する返答のSetResは，EDT 0x00でOKの意味を受け取ることとなる．ゆえにその詳細な値をGetする必要がある
				// autoGetPropertiesがfalseなら自動取得しない
				if( els.DETAIL.substr(0,2) == '00' && EL.autoGetProperties ) {
					// console.log('EL.SET_RES: autoGetProperties');
					setTimeout(() => {
						let msg = "1081000005ff01" + els.SEOJ + "6201" + els.DETAIL.substr(0,2) + "00";
						EL.sendString( rinfo.address, msg );
						EL.decreaseWaitings();
					}, EL.autoGetDelay * (EL.autoGetWaitings+1));
					EL.increaseWaitings();
				}
				break;

			case EL.GET_RES: // 72
				// V1.1
				// d6のEDT表現がとても特殊，EDT1バイト目がインスタンス数になっている
				// autoGetPropertiesがfalseなら自動取得しない
				if( els.SEOJ.substr(0, 4) === '0ef0' && els.DETAILs.d6 != null && els.DETAILs.d6 != '' && EL.autoGetProperties ) {
					// console.log( "EL.returner: get object list! PropertyMap req V1.0.");
					// 自ノードインスタンスリストSに書いてあるオブジェクトのプロパティマップをもらう
					let array = EL.toHexArray( els.DETAILs.d6 );
					let instNum = array[0];
					while( 0 < instNum ) {
						EL.getPropertyMaps( rinfo.address, array.slice( (instNum - 1)*3 +1, (instNum - 1)*3 +4 ) );
						instNum -= 1;
					}
				}else if( els.DETAILs["9f"] != null && EL.autoGetProperties) {  // 自動プロパティ取得は初期化フラグ, 9fはGetProps. 基本的に9fは9d, 9eの和集合になる。(そのような決まりはないが)
					let array = EL.toHexArray( els.DETAILs["9f"] );
					if( array.length < 17 ) { // プロパティの数16個未満は記述形式１( =カウンタ含めて17バイト未満
						let num = array[0];
						for( let i=0; i<num; i++ ) {
							// このとき9fをまた取りに行くと無限ループなのでやめる
							if( array[i+1] != 0x9f ) {
								// ものすごい勢いでGetするとデバイスが追い付かないので，autoGetDelay * (autoGetWaitings+1) する
								// console.log('GET_RES 9f format1', rinfo.address);
								setTimeout(() => {
									EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x62, array[i+1], [0x00] );
									EL.decreaseWaitings();
								}, EL.autoGetDelay * (EL.autoGetWaitings+1));
								EL.increaseWaitings();
							}
						}
					} else {
						// プロパティ16個以上（17byte以上）なので記述形式2，EPCのarrayを作り直したら，あと同じ
						let array = EL.parseMapForm2( els.DETAILs["9f"] ); // 2~17byte目がプロパティマップ
						let num = array[0];
						for( let i=0; i<num; i++ ) {
							// このとき9fをまた取りに行くと無限ループなのでやめる
							if( array[i+1] != 0x9f ) {
								// ものすごい勢いでGetするとデバイスが追い付かないので，200ms Waitする
								// console.log('GET_RES 9f format2', rinfo.address);
								setTimeout(() => {
									EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x62, array[i+1], [0x00] );
									EL.decreaseWaitings();
								}, EL.autoGetDelay * (EL.autoGetWaitings+1));
								EL.increaseWaitings();
							}
						}
					}
				}
				break;

			case EL.INF:  // 0x73
				// V1.0 オブジェクトリストをもらったらそのオブジェクトのPropertyMapをもらいに行く, デバイスが後で起動した
				// autoGetPropertiesがfalseならやらない
				if( els.DETAILs.d5 != null && els.DETAILs.d5 != ""  && EL.autoGetProperties) {
					// ノードプロファイルオブジェクトのプロパティマップをもらう
					EL.getPropertyMaps( rinfo.address, [0x0e, 0xf0, 0x00] );
				}
				break;

			case EL.INFC: // "74"
				// V1.0 オブジェクトリストをもらったらそのオブジェクトのPropertyMapをもらいに行く
				// autoGetPropertiesがfalseならやらない
				if( els.DETAILs.d5 != null && els.DETAILs.d5  && EL.autoGetProperties) {
					// ノードプロファイルオブジェクトのプロパティマップをもらう
					EL.getPropertyMaps( rinfo.address, [0x0e, 0xf0, 0x00] );

					// console.log( "EL.returner: get object list! PropertyMap req.");
					let array = EL.toHexArray( els.DETAILs.d5 );
					let instNum = array[0];
					while( 0 < instNum ) {
						EL.getPropertyMaps( rinfo.address, array.slice( (instNum - 1)*3 +1, (instNum - 1)*3 +4 ) );
						instNum -= 1;
					}
				}
				break;

			case EL.INFC_RES: // "7a"
			case EL.SETGET_RES: // "7e"
				break;

			default:
				break;
			}
		}

		// 受信状態から機器情報修正, GETとINFREQは除く
		if (els.ESV != "62" && els.ESV != "63") {
			EL.renewFacilities(rinfo.address, els);
		}

		// 機器オブジェクトに関してはユーザー関数に任す
		userfunc(rinfo, els);
	} catch (e) {
		userfunc(rinfo, els, e);
	}
};


// ネットワーク内のEL機器全体情報を更新する，受信したら勝手に実行される
EL.renewFacilities = function (ip, els) {
	let epcList;
	try {
		epcList = EL.parseDetail(els.OPC, els.DETAIL);

		// 新規IP
		if (EL.facilities[ip] == null) { //見つからない
			EL.facilities[ip] = {};
		}

		// 新規obj
		if (EL.facilities[ip][els.SEOJ] == null) {
			EL.facilities[ip][els.SEOJ] = {};
			// 新規オブジェクトのとき，プロパティリストもらおう
			// console.log('new facilities');
			// 自動取得フラグがfalseならやらない
			if( EL.autoGetProperties ) {
				EL.getPropertyMaps(ip, EL.toHexArray(els.SEOJ));
			}
		}

		for (let epc in epcList) {
			// 新規epc
			if (EL.facilities[ip][els.SEOJ][epc] == null) {
				EL.facilities[ip][els.SEOJ][epc] = {};
			}

			EL.facilities[ip][els.SEOJ][epc] = epcList[epc];
		}
	} catch (e) {
		console.error("EL.renewFacilities error.");
		// console.dir(e);
		throw e;
	}
};



//--------------------------------------------------------------------
// facilitiesの定期的な監視

// ネットワーク内のEL機器全体情報を更新したらユーザの関数を呼び出す
EL.setObserveFacilities = function ( interval, onChanged ) {
	let oldVal = JSON.stringify(EL.objectSort(EL.facilities));
	const onObserve = function() {
		const newVal = JSON.stringify(EL.objectSort(EL.facilities));
		if ( oldVal == newVal ) return;
		onChanged();
		oldVal = newVal;
	};

	setInterval( onObserve, interval );
};

// キーでソートしてからJSONにする
// 単純にJSONで比較するとオブジェクトの格納順序の違いだけで比較結果がイコールにならない
EL.objectSort = function (obj) {
	// まずキーのみをソートする
	let keys = Object.keys(obj).sort();

	// 返却する空のオブジェクトを作る
	let map = {};

	// ソート済みのキー順に返却用のオブジェクトに値を格納する
	keys.forEach(function(key){
		map[key] = obj[key];
	});

	return map;
};


//////////////////////////////////////////////////////////////////////
// EL，上位の通信手続き
//////////////////////////////////////////////////////////////////////

// 機器検索
EL.search = function () {
	// ipv4
	if( EL.ipVer == 0 || EL.ipVer == 4 ) {
		EL.sendOPC1( EL.EL_Multi, [0x0e, 0xf0, 0x01], [0x0e, 0xf0, 0x00], 0x62, 0xD6, [0x00]);  // すべてノードに対して，すべてのEOJをGetする
	}

	// ipv6
	if( EL.ipVer == 0 || EL.ipVer == 6 ) {
		EL.sendOPC1( EL.EL_Multi6, [0x0e, 0xf0, 0x01], [0x0e, 0xf0, 0x00], 0x62, 0xD6, [0x00]);  // すべてノードに対して，すべてのEOJをGetする
	}
};


// プロパティマップをすべて取得する
// 一度に一気に取得するとデバイス側が対応できないタイミングもあるようで，適当にwaitする。
EL.getPropertyMaps = function ( ip, eoj ) {
	// console.log('EL.getPropertyMaps');

	setTimeout(() => {
		EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9D, [0x00] );      // INF prop
		EL.decreaseWaitings();
	}, EL.autoGetDelay * (EL.autoGetWaitings+1));
	EL.increaseWaitings();


	setTimeout(() => {
		EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9E, [0x00] );  // SET prop, after 1s
		EL.decreaseWaitings();
	}, EL.autoGetDelay * (EL.autoGetWaitings+1));
	EL.increaseWaitings();


	setTimeout(() => {
		EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9F, [0x00] );  // GET prop, after more 1s
		EL.decreaseWaitings();
	}, EL.autoGetDelay * (EL.autoGetWaitings+1));
	EL.increaseWaitings();

};


// parse Propaty Map Form 2
// 16以上のプロパティ数の時，記述形式2，出力はForm1にすること, bitstr = EDT
EL.parseMapForm2 = function (bitstr) {
	let ret = [];
	let val = 0x80;
	let array = EL.toHexArray(bitstr);

	// bit loop
	for (let bit = 0; bit < 8; bit += 1) {
		// byte loop
		for (let byt = 1; byt < 17; byt += 1) {
			if ((array[byt] >> bit) & 0x01) {
				ret.push(val);
			}
			val += 1;
		}
	}

	ret.unshift(ret.length);
	return ret;
};



module.exports = EL;

//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
