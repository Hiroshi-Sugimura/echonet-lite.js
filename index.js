//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27
//////////////////////////////////////////////////////////////////////
'use strict'

const os = require('os'); // interface listほしい
const dgram = require('dgram'); // UDPつかう

require('date-utils'); // for log


//////////////////////////////////////////////////////////////////////
// ECHONET Lite

/*
  データ構造
ELSTRUCTURE {
  EHD : str.substr( 0, 4 ),
  TID : str.substr( 4, 4 ),
  SEOJ : str.substr( 8, 6 ),
  DEOJ : str.substr( 14, 6 ),
  EDATA: str.substr( 20 ),    // 下記はEDATAの詳細
  ESV : str.substr( 20, 2 ),
  OPC : str.substr( 22, 2 ),
  DETAIL: str.substr( 24 ),
  DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
}
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
	Multi: '224.0.23.0',
	EL_Multi6: 'FF02::1',
	Multi6: 'FF02::1',
	EL_obj: null,
	EL_cls: null,

	// member
	sock4: null,
	sock6: null,
	NODE_PROFILE: '0ef0',
	NODE_PROFILE_OBJECT: '0ef001',  // 送信専用ノードを作るときは0ef002に変更する
	Node_details:	{
		// super
		"88": [0x42], // Fault status, get
		"8a": [0x00, 0x00, 0x77], // maker code, manufacturer code, kait = 00 00 77, get
		"8b": [0x00, 0x00, 0x02], // business facility code, homeele = 00 00 02, get
		"9d": [0x02, 0x80, 0xd5], // inf map, 1 Byte目は個数, get
		"9e": [0x01, 0xbf],       // set map, 1 Byte目は個数, get
		"9f": [0x0f, 0x80, 0x82, 0x83, 0x88, 0x8a, 0x8b, 0x9d, 0x9e, 0x9f, 0xbf, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7], // get map, 1 Byte目は個数, get
		// detail
		"80": [0x30], // 動作状態, get, inf
		"82": [0x01, 0x0d, 0x01, 0x00], // EL version, 1.13, get
		"83": [0xfe, 0x00, 0x00, 0x77, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01], // identifier, initialize時に、renewNICList()できちんとセットする, get
		"bf": [0x80, 0x00], // 個体識別情報, Unique identifier data
		"d3": [0x00, 0x00, 0x01],  // 自ノードで保持するインスタンスリストの総数（ノードプロファイル含まない）, initialize時にuser項目から自動計算, get
		"d4": [0x00, 0x02],        // 自ノードクラス数（ノードプロファイル含む）, initialize時にuser項目から自動計算, get
		"d5": [],    // インスタンスリスト通知, 1Byte目はインスタンス数, initialize時にuser項目から自動計算, anno
		"d6": [],    // 自ノードインスタンスリストS, initialize時にuser項目から自動計算, get
		"d7": []     // 自ノードクラスリストS, initialize時にuser項目から自動計算, get
	},
	ipVer: 4, // 0 = IPv4 & IPv6, 4 = IPv4, 6 = IPv6
	nicList: {v4: [], v6: []},
	usingIF: {v4: '', v6: ''}, // '' = default
	tid: [0,0],   // transaction id
	ignoreMe: true, // true = 自IPから送信されたデータ受信を無視
	autoGetProperties: true, // true = 自動的にGetPropertyをする
	autoGetDelay: 1000, // 自動取得のときに，すぐにGetせずにDelayする
	autoGetWaitings: 0, // 自動取得待ちの個数
	observeFacilitiesTimerId: null,
	debugMode: false,
	facilities: {},	// ネットワーク内の機器情報リスト
	// データ形式の例
	// { '192.168.0.3': { '05ff01': { d6: '' } },
	// '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
	identificationNumbers: []  // ELの識別番号リスト
};


// 初期化，バインド
// defaultでIPversionは4, 取りうる値は4, 6, 0 = both
// Nodejsの対応が遅れていてまだうまく動かないみたい，しばらくipVer = 4でやる。
// 複数NICがあるときにNICを指定できるようにした。NICの設定はmulticastAddrに出力したいインタフェースのIPを指定する。
// ipVer == 0の時はsocketが4と6の2個手に入れることに注意
EL.initialize = async function (objList, userfunc, ipVer = 4, Options = {v4: '', v6: '', ignoreMe: true, autoGetProperties: true, autoGetDelay: 1000, debugMode: false}) {

	EL.debugMode = Options.debugMode; // true: show debug log
	await EL.renewNICList();	// Network Interface Card List
	EL.ipVer = ipVer;	// ip version

	EL.sock4 = null;
	EL.sock6 = null;
	EL.tid = [0,0];
	EL.observeFacilitiesTimerId = null;
	EL.facilities = {};
	EL.identificationNumbers = [];

	EL.debugMode ? console.log('EL.initialize() NIC list:', EL.nicList) : 0;

	// 複数NIC対策
	EL.usingIF.v4 = (Options.v4 != undefined && Options.v4 != '' && Options.v4 != 'auto') ? Options.v4 : '0.0.0.0';
	if( EL.nicList.v6.length > 1 ) {  // v6が選択可能
		if( process.platform == 'win32' ) {  // windows
			let nic = EL.nicList.v6.find( (dev) => {
				if( dev.name == Options.v6 || dev.address == Options.v6 ) {
					return true;
				}
			});

			if( Options.v6 == undefined || Options.v6 =="" || Options.v6 =="auto" || !nic ) { // なんでもいい場合や、指定のnicがない場合
				EL.usingIF.v6 = '';
			}else if( nic ) {  // 指定があって、nicが見つかった場合
				EL.usingIF.v6 = nic.address;
				// EL.usingIF.v6 = '%' + nic.name;
			}
		}else{  // mac or linux
			EL.usingIF.v6 = (Options.v6 != undefined && Options.v6 !="") ? '%' + Options.v6 : '%' + EL.nicList.v6[0].name;
		}
	}else{
		EL.usingIF.v6 = '';  // v6が無い、または一つしか無い場合は選択しない = default = ''
	}

	EL.ignoreMe = Options.ignoreMe != false ? true : false;	// 自IPから送信されたデータ受信を無視, default true, 微妙な条件の書き方はundef対策
	EL.autoGetProperties = Options.autoGetProperties != false ? true : false;	// 自動的なデータ送信の有無
	EL.autoGetDelay = Options.autoGetDelay != undefined ? Options.autoGetDelay : 1000;	// 自動GetのDelay
	EL.autoGetWaitings = 0;   // 自動取得の待ち処理個数

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
	// 両方対応
	if( EL.ipVer == 0 || EL.ipVer == 4) {
		EL.sock4 = dgram.createSocket({type:"udp4",reuseAddr:true}, (msg, rinfo) => {
			EL.returner(msg, rinfo, userfunc);
		});
	}
	if( EL.ipVer == 0 || EL.ipVer == 6) {
		EL.sock6 = dgram.createSocket({type:"udp6",reuseAddr:true}, (msg, rinfo) => {
			EL.returner(msg, rinfo, userfunc);
		});
	}

	// マルチキャスト設定，ネットワークに繋がっていない（IPが一つもない）と例外がでる。
	if( EL.ipVer == 0 || EL.ipVer == 4) {
		EL.sock4.bind( {'address': '0.0.0.0', 'port': EL.EL_port}, function () {
			EL.sock4.setMulticastLoopback(true);
			EL.sock4.addMembership(EL.EL_Multi);
		});
	}
	if( EL.ipVer == 0 || EL.ipVer == 6) {
		EL.sock6.bind({'address': '::', 'port': EL.EL_port}, function () {
			EL.sock6.setMulticastLoopback(true);
			if( process.platform == 'win32' ) {  // windows
				EL.sock6.addMembership(EL.EL_Multi6, '::' + EL.usingIF.v6);  // bug fixのために分けたけど今は意味はなし
			}else{
				EL.sock6.addMembership(EL.EL_Multi6, '::' + EL.usingIF.v6);
			}
		});
	}

	// 初期化終わったのでノードのINFをだす, IPv4, IPv6ともに出す
	if( EL.ipVer == 0 || EL.ipVer == 4) {
		EL.sendOPC1( EL.EL_Multi, [0x0e, 0xf0, 0x01], [0x0e, 0xf0, 0x01], EL.INF, 0xd5, EL.Node_details["d5"]);
	}
	if( EL.ipVer == 0 || EL.ipVer == 6) {
		EL.sendOPC1( EL.EL_Multi6, [0x0e, 0xf0, 0x01], [0x0e, 0xf0, 0x01], EL.INF, 0xd5, EL.Node_details["d5"]);
	}

	if( EL.ipVer == 4) {
		return EL.sock4;
	}else if( EL.ipVer == 6 ) {
		return EL.sock6;
	}else{
		return {sock4: EL.sock4, sock6: EL.sock6};
	}
};


// release
EL.release = function () {
	EL.clearObserveFacilities();

	if( EL.sock6 ) {
		EL.sock6.close();
		EL.sock6 = null;
	}

	if( EL.sock4 ) {
		EL.sock4.close();
		EL.sock4 = null;
	}
};

// NICリスト更新
// loopback無視
EL.renewNICList = async function () {
	EL.nicList.v4 = [];
	EL.nicList.v6 = [];
	let interfaces = await os.networkInterfaces();
	interfaces = await EL.objectSort(interfaces);  // dev nameでsortすると仮想LAN候補を後ろに逃がせる（とみた）
	// console.log('EL.renewNICList(): interfaces:', interfaces);

	let macArray = [];

	for (let name in interfaces) {
		if( name == 'lo0') {continue;}
		for( const details of interfaces[name] ) {
			if ( !details.internal ) {
				switch(details.family) {
					case 4:   // win
					case "IPv4":  // mac
					// await console.log( 'EL.renewNICList(): IPv4 details:', details );
					EL.nicList.v4.push({name:name, address:details.address});
					macArray = await EL.toHexArray( details.mac.replace(/:/g, '') ); // ここで見つけたmacを機器固有番号に転用
					break;

					case 6:  // win
					case "IPv6":  // mac
					// await console.log( 'EL.renewNICList(): IPv6 details:', details );
					EL.nicList.v6.push({name:name, address:details.address});
					macArray = await EL.toHexArray( details.mac.replace(/:/g, '') ); // ここで見つけたmacを機器固有番号に転用
					break;

					default:
					await console.log( 'EL.renewNICList(): no assoc default:', details );
					break;
				}
			}
		}
		// await console.log( 'EL.renewNICList(): nicList:', EL.nicList );
	}
	// await console.log( 'EL.renewNICList(): nicList:', EL.nicList );

	// macアドレスを識別番号に転用，localhost, lo0はmacを持たないので使えないから排除
	// console.log('EL.renewNICList(): interfaces:', interfaces);
	// console.log('EL.renewNICList(): macArray:', macArray);

	EL.Node_details["83"] = [0xfe, 0x00, 0x00, 0x77, 0x00, 0x00, 0x02, macArray[0], macArray[1], macArray[2], macArray[3], macArray[4], macArray[5], 0x00, 0x00, 0x00, 0x01]; // identifier

	// await console.log( 'EL.renewNICList(): nicList:', EL.nicList );
	return EL.nicList;
};

// 自動取得待ちの個数管理
EL.decreaseWaitings = function () {
	if( EL.autoGetWaitings != 0 ) {
		// console.log( 'decrease:', 'waitings: ', EL.autoGetWaitings );
		EL.autoGetWaitings -= 1;
	}
};


EL.increaseWaitings = function () {
	// console.log( 'increase:', 'waitings: ', EL.autoGetWaitings, 'delay: ', EL.autoGetDelay * (EL.autoGetWaitings+1) );
	EL.autoGetWaitings += 1;
};


// 自分からの送信データを無視するために
EL.myIPaddress = function(rinfo) {
	let ignoreIP = false;
	if( EL.ignoreMe == true ) {
		// loop back
		if( rinfo.address === '127.0.0.1' || rinfo.address === '::1') {
			ignoreIP = true;
			return true;
		}
		// my ip
		EL.nicList.v4.forEach( (ip) => {
			if( ip.address === rinfo.address ) {
				ignoreIP = true;
				return true;
			}
		});
		EL.nicList.v6.forEach( (ip) => {
			if( ip.address === rinfo.address.split('%')[0] ) {
				ignoreIP = true;
				return true;
			}
		});
	}

	// console.log( 'rinfo.address:', rinfo.address, 'is ignoreIP:', ignoreIP );  // @@@debug
	return ignoreIP;
};


function isObjEmpty(obj) {
	return Object.keys(obj).length === 0;
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
EL.parseDetail = function( _opc, str ) {
	// console.log('EL.parseDetail() opc:', _opc, 'str:', str);
	let ret = {}; // 戻り値用，連想配列
	// str = str.toUpperCase();

	try {
		let array = EL.toHexArray( str );  // edts
		let opc = EL.toHexArray(_opc)[0];
		let epc = array[0]; // 最初は0
		let pdc = array[1]; // 最初は1
		let now = 0;  // 入力データの現在処理位置, Index
		let edt = [];  // 各edtをここに集めて，retに集約


		// OPCループ
		for (let i = 0; i < opc; i += 1) {
			epc = array[now];  // EPC = 機能
			edt = []; // EDT = データのバイト数
			now++;

			// PDC（EDTのバイト数）
			pdc = array[now];
			now++;

			// それ以外はEDT[0] == byte数
			// console.log( 'opc count:', i, 'epc:', EL.toHexString(epc), 'pdc:', EL.toHexString(pdc));

			// getの時は pdcが0なのでなにもしない，0でなければ値が入っている
			if (pdc == 0) {
				ret[EL.toHexString(epc)] = "";
			} else {
				// property mapだけEDT[0] != バイト数なので別処理
				if( epc == 0x9d || epc == 0x9e || epc == 0x9f ) {
					if( pdc >= 17) { // プロパティの数が16以上の場合（プロパティカウンタ含めてPDC17以上）は format 2
						// 0byte=epc, 2byte=pdc, 4byte=edt
						for (let j = 0; j < pdc; j += 1) {
							// 登録
							edt.push(array[now]);
							now++;
						}
						ret[ EL.toHexString(epc) ] = EL.bytesToString( EL.parseMapForm2(edt) );
						// return ret;
					}else{
						// format 2でなければ以下と同じ形式で解析可能
						for (let j = 0; j < pdc; j += 1) {
							// 登録
							edt.push(array[now]);
							now++;
						}
						// console.log('epc:', EL.toHexString(epc), 'edt:', EL.bytesToString(edt) );
						ret[EL.toHexString(epc)] = EL.bytesToString(edt);
					}
				}else{
					// PDCループ
					for (let j = 0; j < pdc; j += 1) {
						// 登録
						edt.push(array[now]);
						now++;
					}
					// console.log('epc:', EL.toHexString(epc), 'edt:', EL.bytesToString(edt) );
					ret[EL.toHexString(epc)] = EL.bytesToString(edt);
				}
			}
		}  // opcループ

	} catch (e) {
		throw new Error('EL.parseDetail(): detail error. opc: ' + opc + ' str: ' + str);
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
	if( str.substr(0, 4) == '1082' ) {  // 任意電文形式, arbitrary message format
		eldata = {
			'EHD': str.substr(0, 4),
			'AMF': str.substr(4)
		}
		return (eldata);
	}

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
		console.error(str);
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
	EL.debugMode ? console.log( "======== sendBase:", ip ) :0;
	EL.debugMode ? console.log( buffer ) :0;
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
			ip += EL.usingIF.v6;
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
// TID自動インクリメント
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


// 複数のEPCで送信する
// TID自動インクリメント
// seoj, deoj, esvはbyteでもstringでも受け付ける
// DETAILsは下記のオブジェクトか、配列をとる。配列の場合は順序が守られる
// DETAILs = {epc: edt, epc: edt, ...}
// DETAILs = [{epc: edt}, {epc: edt}, ...]
// ex. {'80':'31', '8a':'000077'}

EL.sendDetails = async function (ip, seoj, deoj, esv, DETAILs) {

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

	let buffer;
	let opc = 0;
	let pdc = 0;
	let detail = '';

	if( Array.isArray( DETAILs ) ) {  // detailsがArrayのときはEPCの出現順序に意味がある場合なので、順番を崩さないようにせよ
		await DETAILs.forEach( (prop) => {
			let epc = Object.keys(prop)[0];
			if( prop[epc] == '' ) {  // '' の時は GetやGet_SNA等で存在する、この時はpdc省略
				detail += epc + '00';
			}else{
				pdc = prop[epc].length / 2;  // Byte数 = 文字数の半分
				detail += epc + EL.toHexString(pdc) + prop[epc];
			}
			opc += 1;
		});
	}else{
		for( let epc in DETAILs ) {
			if( DETAILs[epc] == '' ) {  // '' の時は GetやGet_SNA等で存在する、この時はpdc省略
				detail += epc + '00';
			}else{
				pdc = DETAILs[epc].length / 2;  // Byte数 = 文字数の半分
				detail += epc + EL.toHexString(pdc) + DETAILs[epc];
			}
			opc += 1;
		}
	}

	buffer = Buffer.from([
		0x10, 0x81,
		// 0x00, 0x00,
		EL.tid[0], EL.tid[1],
		seoj[0], seoj[1], seoj[2],
		deoj[0], deoj[1], deoj[2],
		esv,
		opc,
		EL.toHexArray(detail)].flat(Infinity));

	// データができたので送信する
	return EL.sendBase(ip, buffer);
};


// 省略したELDATAの形式で指定して送信する
// ELDATA {
//   TID : String(4),      // 省略すると自動
//   SEOJ : String(6),
//   DEOJ : String(6),
//   ESV : String(2),
//   DETAILs: Object
// }
// ex.
// ELDATA {
//   TID : '0001',      // 省略すると自動
//   SEOJ : '0ef001',
//   DEOJ : '029001',
//   ESV : '61',
//   DETAILs:  {'80':'31', '8a':'000077'}
// }
EL.sendELDATA = function (ip, eldata) {
	let tid = [];
	let seoj = [];
	let deoj = [];

	if( !eldata.TID || !eldata.TID == '') {		// TIDの指定がなければ自動
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
		tid[0] = EL.tid[0];
		tid[1] = EL.tid[1];
	}else{
		tid = EL.toHexArray( eldata.TID );
	}

	seoj = EL.toHexArray(eldata.SEOJ);
	deoj = EL.toHexArray(eldata.DEOJ);
	esv  = EL.toHexArray(eldata.ESV);

	let buffer;
	let opc = 0;
	let pdc = 0;
	let detail = '';

	for( let epc in eldata.DETAILs ) {
		if( eldata.DETAILs[epc] == '' ) {  // '' の時は GetやGet_SNA等で存在する、この時はpdc省略
			detail += epc + '00';
		}else{
			pdc = eldata.DETAILs[epc].length / 2;  // Byte数 = 文字数の半分
			detail += epc + EL.toHexString(pdc) + eldata.DETAILs[epc];
		}
		opc += 1;
	}

	buffer = Buffer.from([
		0x10, 0x81,
		// 0x00, 0x00,
		tid[0], tid[1],
		seoj[0], seoj[1], seoj[2],
		deoj[0], deoj[1], deoj[2],
		esv,
		opc,
		EL.toHexArray(detail)].flat(Infinity));

	// データができたので送信する
	return EL.sendBase(ip, buffer);
};




// ELの返信用、典型的なOPC一個でやる．TIDを併せて返信しないといけないため
EL.replyOPC1 = function (ip, tid, seoj, deoj, esv, epc, edt) {

	if (typeof (tid) == "string") {
		tid = EL.toHexArray(tid);
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
			tid[0], tid[1],
			seoj[0], seoj[1], seoj[2],
			deoj[0], deoj[1], deoj[2],
			esv,
			0x01,
			epc,
			0x00]);
	} else {
		buffer = Buffer.from([
			0x10, 0x81,
			tid[0], tid[1],
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



// dev_details の形式で自分のEPC状況を渡すと、その状況を返答する
// 例えば下記に001101(温度センサ)の例を示す
/*
dev_details: {
	'001101': {
		// super
		'80': [0x30], // 動作状態, on, get, inf
		'81': [0x0f], // 設置場所, set, get, inf
		'82': [0x00, 0x00, 0x50, 0x01],  // spec version, P. rev1, get
		'83': [0xfe, 0x00, 0x00, 0x77, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06], // identifier, get
		'88': [0x42], // 異常状態, 0x42 = 異常無, get
		'8a': [0x00, 0x00, 0x77],  // maker code, kait, get
		'9d': [0x02, 0x80, 0x81],  // inf map, 1 Byte目は個数, get
		'9e': [0x01, 0x81],  // set map, 1 Byte目は個数, get
		'9f': [0x0a, 0x80, 0x81, 0x82, 0x83, 0x88, 0x8a, 0x9d, 0x9e, 0x9f, 0xe0], // get map, 1 Byte目は個数, get
		// detail
		'e0': [0x00, 0xdc]  // 温度計測値, get
	}
}
*/


// dev_detailのGetに対して複数OPCにも対応して返答する
EL.replyGetDetail = async function(rinfo, els, dev_details) {
	let success = true;
	let retDetails = [];
	let ret_opc = 0;
	// console.log( 'Recv DETAILs:', els.DETAILs );
	for (let epc in els.DETAILs) {
		if( await EL.replyGetDetail_sub( els, dev_details, epc ) ) {
			retDetails.push( parseInt(epc,16) );  // epcは文字列なので
			retDetails.push( dev_details[els.DEOJ][epc].length );
			retDetails.push( dev_details[els.DEOJ][epc] );
			// console.log( 'retDetails:', retDetails );
		}else{
			// console.log( 'failed:', els.DEOJ, epc );
			retDetails.push( parseInt(epc,16) );  // epcは文字列なので
			retDetails.push( [0x00] );
			success = false;
		}
		ret_opc += 1;
	}

	let ret_esv = success? 0x72: 0x52;  // 一つでも失敗したらGET_SNA

	let arr = [0x10, 0x81, EL.toHexArray(els.TID), EL.toHexArray(els.DEOJ), EL.toHexArray(els.SEOJ), ret_esv, ret_opc, retDetails ];
	EL.sendArray( rinfo.address, arr.flat(Infinity) );
};

// 上記のサブルーチン
EL.replyGetDetail_sub = function( els, dev_details, epc) {
	if( !dev_details[els.DEOJ] ) { // EOJそのものがあるか？
		return false
	}

	// console.log( dev_details[els.DEOJ], els.DEOJ, epc );
	if (dev_details[els.DEOJ][epc]) { // EOJは存在し、EPCも持っている
		return true;
	}else{
		return false;  // EOJはなある、EPCはない
	}
};


// dev_detailのSetに対して複数OPCにも対応して返答する
// ただしEPC毎の設定値に関して基本はノーチェックなので注意すべし
// EPC毎の設定値チェックや、INF処理に関しては下記の replySetDetail_sub にて実施
// SET_RESはEDT入ってない
EL.replySetDetail = async function(rinfo, els, dev_details) {
	// DEOJが自分のオブジェクトでない場合は破棄
	if ( !dev_details[els.DEOJ] ) { // EOJそのものがあるか？
		return false;
	}

	let success = true;
	let retDetails = [];
	let ret_opc = 0;
	// console.log( 'Recv DETAILs:', els.DETAILs );
	for (let epc in els.DETAILs) {
		if( await EL.replySetDetail_sub( rinfo, els, dev_details, epc ) ) {
			retDetails.push( parseInt(epc,16) );  // epcは文字列
			retDetails.push( [0x00] );  // 処理できた分は0を返す
		}else{
			retDetails.push( parseInt(epc,16) );  // epcは文字列なので
			retDetails.push( parseInt(els.DETAILs[epc].length/2, 16) );  // 処理できなかった部分は要求と同じ値を返却
			retDetails.push( parseInt(els.DETAILs[epc], 16) );
			success = false;
		}
		ret_opc += 1;
	}

	if( els.ESV == EL.SETI ) { return; }  // SetIなら返却なし

	// SetCは SetC_ResかSetC_SNAを返す
	let ret_esv = success? 0x71: 0x51;  // 一つでも失敗したらSETC_SNA

	let arr = [0x10, 0x81, EL.toHexArray(els.TID), EL.toHexArray(els.DEOJ), EL.toHexArray(els.SEOJ), ret_esv, ret_opc, retDetails ];
	EL.sendArray( rinfo.address, arr.flat(Infinity) );
};

// 上記のサブルーチン
EL.replySetDetail_sub = function(rinfo, els, dev_details, epc) {
	let edt = els.DETAILs[epc];

	switch( els.DEOJ.substr(0,4) ) {
		case EL.NODE_PROFILE: // ノードプロファイルはsetするものがbfだけ
		switch( epc ) {
			case 'bf': // 個体識別番号, 最上位1bitは変化させてはいけない。
			let ea = EL.toHexArray(edt);
			dev_details[els.DEOJ][epc] = [ ((ea[0] & 0x7F) | (dev_details[els.DEOJ][epc][0] & 0x80)), ea[1] ];
			return true;
			break;

			default:
			return false;
			break;
		}
		break;


		case '0130': // エアコン
		switch (epc) { // 持ってるEPCのとき
			// super
			case '80':  // 動作状態, set, get, inf
			if( edt == '30' || edt == '31' ) {
				dev_details[els.DEOJ][epc] = [parseInt(edt, 16)];
				EL.sendOPC1( EL.EL_Multi, EL.toHexArray(els.DEOJ), EL.toHexArray(els.SEOJ), EL.INF, EL.toHexArray(epc), [parseInt(edt, 16)] );  // INF
				return true;
			}else{
				return false;
			}
			break;

			case '81':  // 設置場所, set, get, inf
			dev_details[els.DEOJ][epc] = [parseInt(edt, 16)];
			EL.sendOPC1( EL.EL_Multi, EL.toHexArray(els.DEOJ), EL.toHexArray(els.SEOJ), EL.INF, EL.toHexArray(epc), [parseInt(edt, 16)] );  // INF
			return true;
			break;

			// detail
			case '8f': // 節電動作設定, set, get, inf
			if( edt == '41' || edt == '42' ) {
				dev_details[els.DEOJ][epc] = [parseInt(edt, 16)];
				EL.sendOPC1( EL.EL_Multi, EL.toHexArray(els.DEOJ), EL.toHexArray(els.SEOJ), EL.INF, EL.toHexArray(epc), [parseInt(edt, 16)] );  // INF
				return true;
			}else{
				return false;
			}
			break;

			case 'b0': // 運転モード設定, set, get, inf
			switch( edt ) {
				case '40': // その他
				case '41': // 自動
				case '42': // 冷房
				case '43': // 暖房
				case '44': // 除湿
				case '45': // 送風
				dev_details[els.DEOJ][epc] = [parseInt(edt, 16)];
				EL.sendOPC1( EL.EL_Multi, EL.toHexArray(els.DEOJ), EL.toHexArray(els.SEOJ), EL.INF, EL.toHexArray(epc), [parseInt(edt, 16)] );  // INF
				return true;
				break;

				default:
				return false;
			}
			break;

			case 'b3': // 温度設定, set, get
			let temp = parseInt( edt, 16 );
			if( -1 < temp && temp < 51 ) {
				dev_details[els.DEOJ][epc] = [temp];
				return true;
			}else{
				return false;
			}
			break;

			case 'a0': // 風量設定, set, get, inf
			switch( edt ) {
				case '31': // 0x31..0x38の8段階
				case '32': // 0x31..0x38の8段階
				case '33': // 0x31..0x38の8段階
				case '34': // 0x31..0x38の8段階
				case '35': // 0x31..0x38の8段階
				case '36': // 0x31..0x38の8段階
				case '37': // 0x31..0x38の8段階
				case '38': // 0x31..0x38の8段階
				case '41': // 自動
				dev_details[els.DEOJ][epc] = [parseInt(edt, 16)];
				EL.sendOPC1( EL.EL_Multi, EL.toHexArray(els.DEOJ), EL.toHexArray(els.SEOJ), EL.INF, EL.toHexArray(epc), [parseInt(edt, 16)] );  // INF
				return true;
				break;
				default:
				// EDTがおかしい
				return false;
			}
			break;

			default: // 持っていないEPCやset不可能のとき
			if (dev_details[els.DEOJ][epc]) { // EOJは存在し、EPCも持っている
				return true;
			}else{
				return false;  // EOJはなある、EPCはない
			}
		}
		break;


		default:  // 詳細を作っていないオブジェクトの一律処理
		if (dev_details[els.DEOJ][epc]) { // EOJは存在し、EPCも持っている
			return true;
		}else{
			return false;  // EOJはなある、EPCはない
		}
	}
};




//////////////////////////////////////////////////////////////////////
// EL受信
//////////////////////////////////////////////////////////////////////

// ELの受信データを振り分ける
EL.returner = function (bytes, rinfo, userfunc) {
	EL.debugMode ? console.log( "======== returner:", rinfo.address ) :0;
	EL.debugMode ? console.log( bytes) :0;

	// 自IPを無視する設定があればチェックして無視する
	// 無視しないならチェックもしない
	if( EL.ignoreMe ? EL.myIPaddress(rinfo) : false ) {
		return;
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
		if ( els.DEOJ.substr(0,4) == EL.NODE_PROFILE ) {
			els.DEOJ = EL.NODE_PROFILE_OBJECT;  // ここで0ef000, 0ef001, 0ef002の表記ゆれを統合する

			switch (els.ESV) {
				////////////////////////////////////////////////////////////////////////////////////
				// 0x5x
				// エラー受け取ったときの処理
				case EL.SETI_SNA:   // "50"
				break;
				case EL.SETC_SNA:   // "51"
				// SetCに対する返答のSetResは，EDT 0x00でOKの意味を受け取ることとなる．ゆえにその詳細な値をGetする必要がある
				// OPCが2以上の時、全EPCがうまくいった時だけSET_RESが返却され、一部のEPCが失敗したらSETC_SNAになる
				// 成功EPCにはPDC=0,EDTなし、失敗EPCにはオウム返しでくる
				// つまりここではPDC=0のものを読みに行くのだが、一気に取得するとまた失敗するかもしれないのでひとつづつ取得する
				// autoGetPropertiesがfalseなら自動取得しない
				// epcひとつづつ取得する方式
				if(  EL.autoGetProperties ) {
					for( let epc in els.DETAILs ) {
						setTimeout(() => {
							EL.sendDetails( rinfo.address, EL.NODE_PROFILE_OBJECT, els.SEOJ, EL.GET, { [epc]:'' } );
							EL.decreaseWaitings();
						}, EL.autoGetDelay * (EL.autoGetWaitings+1));
						EL.increaseWaitings();
					}
				}
				break;
				case EL.INF_SNA:    // "53"
				case EL.SETGET_SNA: // "5e"
				// console.log( "EL.returner: get error" );
				// console.dir( els );
				break;

				////////////////////////////////////////////////////////////////////////////////////
				// 0x6x
				case EL.SETI: // "60
				case EL.SETC: // "61"
				EL.replySetDetail( rinfo, els, { [EL.NODE_PROFILE_OBJECT]: EL.Node_details} );
				break;

				case EL.GET: // 0x62
				// console.log( "EL.returner: get prop. of Node profile els:", els);
				EL.replyGetDetail( rinfo, els, { [EL.NODE_PROFILE_OBJECT]: EL.Node_details} );
				break;

				case EL.INF_REQ: // 0x63
				if (els.DETAILs["d5"] == "00") {  // EL ver. 1.0以前のコントローラからサーチされた場合のレスポンス
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
				// OPCが2以上の時、全EPCがうまくいった時だけSET_RESが返却される
				// 一部のEPCが失敗したらSETC_SNAになる
				// autoGetPropertiesがfalseなら自動取得しない
				// epc一気に取得する方法に切り替えた(ver.2.12.0以降)
				if(  EL.autoGetProperties ) {
					let details = {};
					for( let epc in els.DETAILs ) {
						details[epc] = '';
					}
					// console.log('EL.SET_RES: autoGetProperties');
					setTimeout(() => {
						EL.sendDetails( rinfo.address, EL.NODE_PROFILE_OBJECT, els.SEOJ, EL.GET, details );
						EL.decreaseWaitings();
					}, EL.autoGetDelay * (EL.autoGetWaitings+1));
					EL.increaseWaitings();
				}
				break;

				case EL.GET_SNA:   // 52
				// GET_SNAは複数EPC取得時に、一つでもエラーしたらSNAになるので、他EPCが取得成功している場合があるため無視してはいけない。
				// ここでは通常のGET_RESのシーケンスを通すこととする。
				// 具体的な処理としては、PDCが0の時に設定値を取得できていないこととすればよい。
				case EL.GET_RES: // 72
				// autoGetPropertiesがfalseなら自動取得しない
				if( EL.autoGetProperties == false ) { break; }

				// V1.1
				// d6のEDT表現が特殊，EDT1バイト目がインスタンス数になっている
				// なお、d6にはNode profileは入っていない
				if( els.SEOJ.substr(0, 4) === EL.NODE_PROFILE && els.DETAILs['d6'] != null && els.DETAILs['d6'] != '' ) {
					// console.log( "EL.returner: get object list! PropertyMap req V1.0.");
					// 自ノードインスタンスリストSに書いてあるオブジェクトのプロパティマップをもらう
					let array = EL.toHexArray( els.DETAILs.d6 );
					let instNum = array[0];
					while( 0 < instNum ) {
						EL.getPropertyMaps( rinfo.address, array.slice( (instNum - 1)*3 +1, (instNum - 1)*3 +4 ) );
						instNum -= 1;
					}
				}

				if( els.DETAILs["9f"] ) {  // 自動プロパティ取得は初期化フラグ, 9fはGetProps. 基本的に9fは9d, 9eの和集合になる。(そのような決まりはないが)
					// DETAILsは解析後なので，format 1も2も関係なく処理する
					// EPC取れるだけ一気にとる方式に切り替えた(ver.2.12.0以降)
					let array =  els.DETAILs["9f"].match(/.{2}/g);
					let details = {};
					let num = EL.toHexArray( array[0] )[0];
					for( let i=0; i<num; i++ ) {
						// d6, 9d, 9e, 9fはサーチの時点で取得しているはず
						// 特にd6と9fは取り直すと無限ループするので注意
						if( array[i+1] != 'd6' && array[i+1] != '9d' && array[i+1] != '9e' && array[i+1] != '9f' ) {
							details[ array[i+1] ] = '';
						}
					}

					setTimeout(() => {
						EL.sendDetails( rinfo.address, EL.NODE_PROFILE_OBJECT, els.SEOJ, EL.GET, details);
						EL.decreaseWaitings();
					}, EL.autoGetDelay * (EL.autoGetWaitings+1));
					EL.increaseWaitings();
				}
				break;

				case EL.INF:  // 0x73
				// ECHONETネットワークで、新規デバイスが起動したのでプロパティもらいに行く
				// autoGetPropertiesがfalseならやらない
				if( els.DETAILs.d5 != null && els.DETAILs.d5 != ""  && EL.autoGetProperties) {
					// ノードプロファイルオブジェクトのプロパティマップをもらう
					EL.getPropertyMaps( rinfo.address, [0x0e, 0xf0, 0x00] );
				}
				break;

				case EL.INFC: // "74"
				// ECHONET Lite Ver. 1.0以前の処理で利用していたフロー
				// オブジェクトリストをもらったらそのオブジェクトのPropertyMapをもらいに行く
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

		// 受信状態から機器情報修正, GETとINFREQ，SET_RESは除く
		if (els.ESV != "62" && els.ESV != "63" && els.ESV != '71') {
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
			// 新規オブジェクトのとき，プロパティリストもらうと取りきるまでループしちゃうのでやめた
		}

		for (let epc in epcList) {
			// 新規epc
			if (EL.facilities[ip][els.SEOJ][epc] == null) {
				EL.facilities[ip][els.SEOJ][epc] = {};
			}

			EL.facilities[ip][els.SEOJ][epc] = epcList[epc];

			// もしEPC = 0x83の時は識別番号なので，識別番号リストに確保
			if( epc === '83' ) {
				EL.identificationNumbers.push( {id: epcList[epc], ip: ip, OBJ: els.SEOJ } );
			}
		}
	} catch (e) {
		console.error("EL.renewFacilities error.");
		// console.dir(e);
		throw e;
	}
};


// ネットワーク内のEL機器全体情報のEPCを取得したか確認する
// 取得漏れがあれば取得する
// あまり実施するとネットワーク負荷がすごくなるので注意
EL.complementFacilities = function () {
	// EL.autoGetWaitings が多すぎるときにはネットワーク負荷がありすぎるので実施しないほうがよい
	if( EL.autoGetWaitings > 10 ) {
		// console.log( 'EL.complementFacilities() skipped, for EL.autoGetWaitings:', EL.autoGetWaitings );
		return;
	}

	Object.keys( EL.facilities ).forEach( (ip) => {  // 保持するIPについて全チェック
		let node = EL.facilities[ip];
		let eojs = Object.keys( node );  // 保持するEOJについて全チェック

		let node_prof = eojs.filter( (v) => { return v.substr(0.4) == '0ef0'; } );
		if( !node_prof ) {  // Node Profileがない
			// node_profを取りに行く、node_profがとれればその先は自動でとれると期待
			EL.sendDetails( ip, EL.NODE_PROFILE_OBJECT, [0x0e, 0xf0, 0x00], EL.GET, [{'d6':''}, {'83':''}, {'9d':''}, {'9e':''}, {'9f':''}]);
		}else{
			// node_profはある
			eojs.forEach( (eoj) => {
				EL.complementFacilities_sub( ip, eoj, node[eoj] );
			})
		}
	});
};

EL.complementFacilities_sub = function ( ip, eoj, props ) {  // サブルーチン
	let epcs = Object.keys( props );
	let getMap = epcs.filter( (v) => { return v.substr(0.4) == '9f'; } );

	if( !getMap ) {
		// get prop. mapがなければ取りに行く。そのあとは自動で取得すると期待
		EL.sendDetails( ip, EL.NODE_PROFILE_OBJECT, eoj, EL.GET, [{'9d':''}, {'9e':''}, {'9f':''}]);
	}else{
		// get prop. mapにあるEPCに関してすべて値を持っているかチェックして、持っていないEPCをリストして取得しにいく
		// to be developing.
		let array = props[getMap].match(/.{2}/g);
		let pdc = EL.toHexArray( array[0] )[0];
		let details = {};
		for( let i=0; i<pdc; i++ ) {
			if( props[array[i+1]] == null || props[array[i+1]] == '' ) {  // propsにそのEPC
				details[ array[i+1] ] = '';
			}
		}

		if( !isObjEmpty(details) ) {
			console.log( 'ip:', ip, 'props:', props, 'details:', details );
			setTimeout(() => {
				EL.sendDetails( ip, EL.NODE_PROFILE_OBJECT, eoj, EL.GET, details);
				EL.decreaseWaitings();
			}, EL.autoGetDelay * (EL.autoGetWaitings+1));
			EL.increaseWaitings();
		}
	}
};


//--------------------------------------------------------------------
// facilitiesの定期的な監視

// ネットワーク内のEL機器全体情報を更新したらユーザの関数を呼び出す
EL.setObserveFacilities = function ( interval, onChanged ) {
	if ( EL.observeFacilitiesTimerId ) return;  // 多重呼び出し排除

	let oldVal = JSON.stringify(EL.objectSort(EL.facilities));
	const onObserve = function() {
		const newVal = JSON.stringify(EL.objectSort(EL.facilities));
		if ( oldVal == newVal ) return;
		onChanged();
		oldVal = newVal;
	};

	EL.observeFacilitiesTimerId = setInterval( onObserve, interval );
};

// 監視終了
EL.clearObserveFacilities = function() {
	if ( EL.observeFacilitiesTimerId ) {
		clearInterval( EL.observeFacilitiesTimerId );
		EL.observeFacilitiesTimerId = null;
	}
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
	// 複合サーチ
	// ipv4
	if( EL.ipVer == 0 || EL.ipVer == 4 ) {
		EL.sendDetails( EL.EL_Multi, EL.NODE_PROFILE_OBJECT, [0x0e, 0xf0, 0x00], EL.GET, [{'d6':''}, {'83':''}, {'9d':''}, {'9e':''}, {'9f':''}]);
	}

	// ipv6
	if( EL.ipVer == 0 || EL.ipVer == 6 ) {
		EL.sendDetails( EL.EL_Multi6, EL.NODE_PROFILE_OBJECT, [0x0e, 0xf0, 0x00], EL.GET, [{'d6':''}, {'83':''}, {'9d':''}, {'9e':''}, {'9f':''}]);
	}

};


// プロパティマップをすべて取得する
// 一度に一気に取得するとデバイス側が対応できないタイミングもあるようで，適当にwaitする。
EL.getPropertyMaps = function ( ip, _eoj ) {
	// console.log('EL.getPropertyMaps(), ip:', ip, 'eoj:', _eoj);

	let eoj = [];

	if( typeof _eoj == 'string' ) {
		eoj = EL.toHexArray( _eoj );
	}else{
		eoj = _eoj;
	}

	// プロファイルオブジェクトのときはプロパティマップももらうけど，識別番号ももらう
	if( eoj[0] == 0x0e && eoj[1] == 0xf0 ) {
		setTimeout(() => {
			EL.sendDetails( ip, EL.NODE_PROFILE_OBJECT, eoj, EL.GET, {'83':'', '9d':'', '9e':'', '9f':''});
			EL.decreaseWaitings();
		}, EL.autoGetDelay * (EL.autoGetWaitings+1));
		EL.increaseWaitings();
	}else{
		// デバイスオブジェクト
		setTimeout(() => {
			EL.sendDetails( ip, EL.NODE_PROFILE_OBJECT, eoj, EL.GET, {'9d':'', '9e':'', '9f':''});
			EL.decreaseWaitings();
		}, EL.autoGetDelay * (EL.autoGetWaitings+1));
		EL.increaseWaitings();
	}

};


// parse Propaty Map Form 2
// 16以上のプロパティ数の時，記述形式2，出力はForm1にすること, bitstr = EDT
// bitstrは 数値配列[0x01, 0x30]のようなやつ、か文字列"0130"のようなやつを受け付ける
EL.parseMapForm2 = function (bitstr) {
	let ret = [];
	let val = 0x80;
	let array = [];

	if (typeof (bitstr) == "string") {
		array = EL.toHexArray(bitstr);
	}else{
		array = bitstr;
	}

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
