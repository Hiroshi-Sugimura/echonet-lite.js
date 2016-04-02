//////////////////////////////////////////////////////////////////////
//	$Date:: 2016-03-29 18:50:22 +0900#$
//	$Rev: 9375 $
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27 - above.
//////////////////////////////////////////////////////////////////////
// UDPつかう
var dgram = require('dgram');

// EL Database
// var dbfilename = "ECHONETLite.db"
// var sqlite3 = require('sqlite3').verbose();
// var eldb = new sqlite3.Database(dbfilename);


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
EL_port: 3610,
EL_Multi: '224.0.23.0',
EL_obj: null,
facilities: {}  	// ネットワーク内の機器情報リスト
// データ形式の例
// { '192.168.0.3': { '05ff01': { d6: '' } },
// '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
};


// 初期化，バインド
EL.initialize = function ( objList, userfunc ) {
	// オブジェクトリストを確保
	EL_obj = objList;

	// EL受け取るようのUDP
	var sock = dgram.createSocket("udp4", function (msg, rinfo) {
		EL.returner( msg, rinfo, userfunc );
	});

	// console.log( "EL_port: " + EL.EL_port + " bind." );

	// マルチキャスト設定
	sock.bind( EL.EL_port, '0.0.0.0', function() {
		sock.setMulticastLoopback( true );
		sock.addMembership( EL.EL_Multi );
		// console.log( "EL_port bind OK!" );
	});

	return sock;
};


//////////////////////////////////////////////////////////////////////
// eldata を見る，表示関係
//////////////////////////////////////////////////////////////////////

// ELDATA形式
EL.eldataShow = function( eldata ) {
	if( eldata != null ) {
		console.log(
				   'EHD: ' + eldata.EHD + 'TID: ' +eldata.TID + 'SEOJ: ' + eldata.SEOJ + 'DEOJ: ' + eldata.DEOJ +
				   '\nEDATA: ' + eldata.EDATA );
	}else{
		console.log( "EL.eldataShow error. eldata is not EL data." );
	}
};


// 文字列
EL.stringShow = function( str ) {
	eld = EL.parseString(str);
	EL.eldataShow( eld );
};


// バイトデータ
EL.bytesShow = function( bytes ) {
	eld = EL.parseBytes( bytes );
	EL.eldataShow( eld );
};



//////////////////////////////////////////////////////////////////////
// 変換系
//////////////////////////////////////////////////////////////////////
EL.parseDetail = function( opc, str ) {

	var ret = {}; // 戻り値用，連想配列
	var now = 0;  // 現在のIndex
	var opc = EL.toHexArray( opc )[0];  // opc

	// opcループ
	for( i = 0; i< opc; i += 1 ) {
		// EPC
		var epc = str.substr( now, 2 );

		// 後半ゼロづめしてくるときがあるのでepc zero対策
		if( epc == "00" ) {
			break;
		}

		// PDC, データ長
		var pdc = parseInt( str.substr( now+2, 2 ) );

		// getの時はnum=0
		if( pdc == 0 ) {
			ret[ (str.substr( now, 2 )) ] = "";
		}else {
			// 登録
			ret[ str.substr( now, 2 ) ] = str.substr( now+4, pdc*2 );
		}

		now += (pdc*2 + 4);

	} // opcループ

	return ret;
};


// バイトデータをぶち込むとELDATA形式にする
EL.parseBytes = function( bytes ) {

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

	var eldata = {
	EHD : str.substr( 0, 4 ),
	TID : str.substr( 4, 4 ),
	SEOJ : str.substr( 8, 6 ),
	DEOJ : str.substr( 14, 6 ),
	EDATA: str.substr( 20 ),    // 下記はEDATAの詳細
	ESV : str.substr( 20, 2 ),
	OPC : str.substr( 22, 2 ),
	DETAIL: str.substr( 24 ),
	DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
	};

	return ( eldata );
};


// 16進数で表現された文字列をぶち込むとELDATA形式にする
EL.parseString = function( str ) {

	var eldata = {
	EHD : str.substr( 0, 4 ),
	TID : str.substr( 4, 4 ),
	SEOJ : str.substr( 8, 6 ),
	DEOJ : str.substr( 14, 6 ),
	EDATA: str.substr( 20 ),    // 下記はEDATAの詳細
	ESV : str.substr( 20, 2 ),
	OPC : str.substr( 22, 2 ),
	DETAIL: str.substr( 24 ),
	DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
	};

	return ( eldata );
};


// 文字列をぶち込むとELらしい切り方のStringを得る
EL.getSeparatedString_String = function( str ) {
	if( typeof str == 'string' ) {
		return ( str.substr( 0, 4 ) + " " +
				 str.substr( 4, 4 ) + " " +
				 str.substr( 8, 6 ) + " " +
				 str.substr( 14, 6 ) + " " +
				 str.substr( 20, 2 ) + " " +
				 str.substr( 22 ) );
	}else{
		console.error( "str is not string." );
		console.error( str );
		return '';
	}
};


// ELDATAをぶち込むとELらしい切り方のStringを得る
EL.getSeparatedString_ELDATA = function( eldata ) {
	return ( eldata.EHD + ' ' + eldata.TID + ' ' + eldata.SEOJ + ' ' + eldata.DEOJ + ' ' + eldata.EDATA );
};


// ELDATA形式から配列へ
EL.ELDATA2Array = function( eldata ) {
	var ret = EL.toHexArray( eldata.EHD +
							  eldata.TID +
							  eldata.SEOJ +
							  eldata.DEOJ +
							  eldata.EDATA );

	return ret;
};



// 1バイト文字をHEX数値にしたい
EL.charToInteger = function( chara ) {
	var ret = 0;
	switch (chara) {
	case "0": case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "8": case "9":
		ret = parseInt(chara);
		break;
	case "a": case "A":
		ret = 10;
		break;

	case "b": case "B":
		ret = 11;
		break;

	case "c": case "C":
		ret = 12;
		break;

	case "d": case "D":
		ret = 13;
		break;

	case "e": case "E":
		ret = 14;
		break;

	case "f": case "F":
		ret = 15;
		break;

	default : ret = 0; break;
	}
	return ret;
}

// 1バイトを文字列の16進表現へ（1Byteは必ず2文字にする）
EL.toHexString = function( byte ) {
	// 文字列0をつなげて，後ろから2文字分スライスする
	return ( ("0" + byte.toString(16)).slice(-2) );
};

// 16進表現の文字列を数値のバイト配列へ
EL.toHexArray = function( string ) {

	var ret = [];

	for( i=0; i<string.length; i += 2 ) {

		l = string.substr( i, 1 );
		r = string.substr( i+1, 1 );

		ret.push( (EL.charToInteger(l) * 16) + EL.charToInteger(r) );
	}

	return ret;
}



//////////////////////////////////////////////////////////////////////
// データベースからの変換系
/*
EL.toEOJStr = function( s, callback ) {

	s = s.substr( 0, 4 );
	var query = "select ClassNameJ from Object where Class LIKE '" + s + "';";

	// console.dir( query );
	var str = "";
	// 多少重いがDB処理は同期待ちするしかない？
	eldb.all( query, function( err, rows) {

		// allでよんで，無ければないで処理する
		rows = rows[0];

		if( err ) {
			console.dir( err );
		} else {
			if( rows != null ) {
				str = rows.ClassNameJ;

				if( typeof str == 'undefined' || str == "" ) {
					str = "undefined";
				}

			}else{
				str = "null";
			}
		}

		callback( str );
	});

};
*/


//////////////////////////////////////////////////////////////////////
// 送信
//////////////////////////////////////////////////////////////////////

// EL送信のベース
EL.sendBase = function( ip, buffer ) {

	// 送信する
	var client = dgram.createSocket("udp4");
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
	var buffer;

	if( esv == 0x62 ) { // get
		buffer = new Buffer([
			0x10, 0x81,
			0x00, 0x00,
			seoj[0], seoj[1], 0x01,
			deoj[0], deoj[1], 0x01,
			esv,
			0x01,
			epc,
			0x00]);
	}else{
		buffer = new Buffer([
			0x10, 0x81,
			0x00, 0x00,
			seoj[0], seoj[1], 0x01,
			deoj[0], deoj[1], 0x01,
			esv,
			0x01,
			epc,
			edt.length].concat(edt) );
	}

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

	var elstructure = EL.parseBytes( bytes );

	try{
		console.log( "EL.returner:selection.");

		// キチンとパースできたか？
		if( null == elstructure ) {
			// App.println( 1, "EL.returner:EL.parseBytes is null.");
			return;
		}

		// ヘッダ確認
		if( elstructure.EHD != '1081' ) {
			// App.println( 1, "bytes is not EL. Reseive data is:" );
			// App.print( 1, bytes );
			return;
		}

		// Ver 1.0でサーチ（INF_REQ）された
		if( elstructure.SEOJ == '05ff01' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '6301d500' ) {
			// App.println( 3, "EL.returner:Ver1.0 INF_REQ.");
			EL.sendOPC1( '224.0.23.0', [0x0e, 0xf0], [0x05, 0xff], 0x73, 0xd5, [EL_obj.length].concat(Array.prototype.concat.apply([], EL_obj)) );
		}
		// Ver 1.1でサーチ（Get）された
		else if( elstructure.SEOJ == '05ff01' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '6201d600' ) {
			// App.println( 3, "EL.returner:Ver1.1 GET.");
			EL.sendOPC1( rinfo.address, [0x0e, 0xf0], [0x05, 0xff], 0x72, 0xd6, [EL_obj.length].concat(Array.prototype.concat.apply([], EL_obj)) );
		}
		// 電源の状態をGet対応する
		else if( elstructure.SEOJ == '05ff01' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '62018000' ) {
			EL.sendOPC1( rinfo.address, [0x0e, 0xf0], [0x05, 0xff], 0x72, 0x80, [0x30] );  // EL ver 1.1方式
		}
		// 他機器の状態を知るために
		// node profileが立ち上がったら，オブジェクトリストをもらいに行く
		else if( elstructure.SEOJ == '0ef001' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '7401800130' ) {
			EL.sendOPC1( rinfo.address, [0x05, 0xff], [0x0e, 0xf0], 0x62, 0xd5, [0x00] );
		}
		// オブジェクトリストをもらったらオブジェクトの電源状態を確認したい．EL ver1.1 d5, EL ver 1.0 D6
		else if( ( elstructure.DEOJ == '0ef001' || elstructure.DEOJ == '05ff01' ) && (elstructure.DETAIL.substr(0, 2) == 'd5' || elstructure.DETAIL.substr(0, 2) == 'd6') ) {
			var msg = "1081000005ff01" + elstructure.SEOJ + "62018000";
			EL.sendString( rinfo.address, msg );
		}
		// SetCに対する返答のSetResは，EDT 0x00でOKの意味を受け取ることとなる．ゆえにその詳細な値をGetする必要がある
		else if( elstructure.ESV == '71' && elstructure.DETAIL.substr(0,2) == '00' ) {
			var msg = "1081000005ff01" + elstructure.SEOJ + "6201" + elstructure.DETAIL.substr(0,2) + "00";
			EL.sendString( rinfo.address, msg );
		}

		userfunc( rinfo, elstructure );
	} catch(e) {
		// App.println( 1, "EL.returner error. get bytes is not EL. Detail is following:");
		// App.print( 1, "elstructure is" );
		// App.print( 1, elstructure );
		// App.print( 1, "bytes is" );
		// App.print( 1, bytes );
		// App.print( 1, "rinfo is" );
		// App.print( 1, rinfo );
		// App.print( 1, e );
	}

};




//////////////////////////////////////////////////////////////////////
// EL，上位の通信手続き
//////////////////////////////////////////////////////////////////////

// 機器検索
EL.search = function() {
	EL.sendOPC1( EL.EL_Multi, [0x05,0xff], [0x0e, 0xf0], 0x62, 0xD6, [0x00] );
};



// ネットワーク内のEL機器全体情報を更新する
EL.renewFacilities = function( ip, obj, opc, detail ) {
	try {
		epcList = EL.parseDetail( opc, detail );

		// 新規IP
		if( EL.facilities[ ip ] == null ) {
			EL.facilities[ ip ] = {};
		}

		// 新規obj
		if( EL.facilities[ ip ][ obj ] == null ) {
			EL.facilities[ ip ][ obj ] = {};
		}

		for( var epc in epcList ) {

			// 新規epc
			if( EL.facilities[ ip ][ obj ][ epc ] == null ) {
				EL.facilities[ ip ][ obj ][ epc ] = {};
			}

			EL.facilities[ ip ][ obj ][ epc ] = epcList[ epc ];
		}
	}catch(e) {
		// App.println( 1, "EL.renewFacilities error. ip is " + ip + ". obj is " + obj + ". opc is " + opc);
		// App.println( 1, "detail is ");
		// App.println( 1, detail );
	}
};


module.exports = EL;

//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
