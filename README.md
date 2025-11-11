# Overview

このモジュールは**ECHONET Liteプロトコル**をサポートします．
ECHONET Liteプロトコルはスマートハウス機器の通信プロトコルです．

This module provides **ECHONET Lite protocol**.
The ECHONET Lite protocol is a communication protocol for smart home devices.

**注意：本モジュールによるECHONET Lite通信規格上の保証はなく、SDKとしてもECHONET Liteの認証を受けておりません。
また、製品化の場合には各社・各自がECHONET Lite認証を取得する必要があります。**


# API Documents

[API Documents](http://hiroshi-sugimura.github.io/echonet-lite.js/)


# Install

下記コマンドでモジュールをインストールできます．

You can install the module as following command.


```bash
npm i echonet-lite
```


# Demos

## Controller demo

デモプログラムはこんな感じです。動作させるためにはECHONET Lite対応デバイスが必要です。もしお持ちでない場合には**[MoekadenRoom](https://github.com/SonyCSL/MoekadenRoom)**というシミュレータがおすすめです。


Here is a demonstration script.
For test exectuion, some devices with ECHONET Lite is required.
If you do not have any device, we recommend the **[MoekadenRoom](https://github.com/SonyCSL/MoekadenRoom)** as a simulator.

```JavaScript:Demo
// モジュールの機能をELとして使う
// import functions as EL object
var EL = require('echonet-lite');

// 自分自身のオブジェクトを決める
// set EOJ for this script
// initializeで設定される，必ず何か設定しないといけない，今回はコントローラ
// this EOJ list is required. '05ff01' is a controller.
var objList = ['05ff01'];

////////////////////////////////////////////////////////////////////////////
// 初期化するとともに，受信動作をコールバックで登録する
// initialize and setting callback. the callback is called by reseived packet.
var elsocket = EL.initialize( objList, function( rinfo, els, err ) {

	if( err ){
		console.dir(err);
	}else{
		console.log('==============================');
		console.log('Get ECHONET Lite data');
		console.log('rinfo is ');
		console.dir(rinfo);

		// elsはELDATA構造になっているので使いやすいかも
		// els is ELDATA stracture.
		console.log('----');
		console.log('els is ');
		console.dir(els);

		// ELDATAをArrayにする事で使いやすい人もいるかも
		// convert ELDATA into byte array.
		console.log('----');
		console.log( 'ECHONET Lite data array is ' );
		console.log( EL.ELDATA2Array( els ) );

		// 受信データをもとに，実は内部的にfacilitiesの中で管理している
		// this module manages facilities by receved packets.
		console.log('----');
		console.log( 'Found facilities are ' );
		console.dir( EL.facilities );
	}
});

// NetworkのELをすべてsearchしてみよう．
// search ECHONET nodes in local network
EL.search();
```


## Device demo

こんな感じで作ってみたらどうでしょうか．
あとはairconObjのプロパティをグローバル変数として，別の関数から書き換えてもいいですよね．
これでGetに対応できるようになります．

This is a demo program for developping air conditioner object.


```JavaScript:Demo
//////////////////////////////////////////////////////////////////////
//	Copyright (C) Hiroshi SUGIMURA 2022.09.22 - above.
//////////////////////////////////////////////////////////////////////
'use strict'


//////////////////////////////////////////////////////////////////////
// ECHONET Lite
let EL = require('echonet-lite');

// エアコンと照明があるとする
let objList = ['013001','029001'];

// 自分のエアコンのデータ，今回はこのデータをグローバル的に使用する方法で紹介する．
let dev_details = {
	'013001': {
		// super
		"80": [0x30],  // 動作状態
		"81": [0xff],  // 設置場所
		"82": [0x00, 0x00, 0x66, 0x00], // EL version, 1.1
		'83': [0xfe, 0x00, 0x00, 0x77, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02], // identifier, initialize時に、renewNICList()できちんとセットするとよい, get
		"88": [0x42],  // 異常状態
		"8a": [0x00, 0x00, 0x77], // maker code
		"9d": [0x04, 0x80, 0x8f, 0xa0, 0xb0],        // inf map, 1 Byte目は個数
		"9e": [0x04, 0x80, 0x8f, 0xa0, 0xb0],        // set map, 1 Byte目は個数
		"9f": [0x0d, 0x80, 0x81, 0x82, 0x88, 0x8a, 0x8f, 0x9d, 0x9e, 0x9f, 0xa0, 0xb0, 0xb3, 0xbb], // get map, 1 Byte目は個数
		// child
		"8f": [0x41], // 節電動作設定
		"a0": [0x31], // 風量設定
		"b0": [0x41], // 運転モード設定
		"b3": [0x19], // 温度設定値
		"bb": [0x1a] // 室内温度計測値
	},
	'029001': {  // lighting
		// super
		'80': [0x31], // 動作状態, set?, get, inf
		'81': [0x0f], // 設置場所, set, get, inf
		'82': [0x00, 0x00, 0x50, 0x01],  // spec version, P. rev1, get
		'83': [0xfe, 0x00, 0x00, 0x77, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03], // identifier, initialize時に、renewNICList()できちんとセットするとよい, get
		'88': [0x42], // 異常状態, 0x42 = 異常無, get
		'8a': [0x00, 0x00, 0x77],  // maker code, kait, get
		'9d': [0x04, 0x80, 0x81],  // inf map, 1 Byte目は個数, get
		'9e': [0x04, 0x80, 0x81, 0xb6],  // set map, 1 Byte目は個数, get
		'9f': [0x0a, 0x80, 0x81, 0x82, 0x83, 0x88, 0x8a, 0x9d, 0x9e, 0x9f, 0xb6], // get map, 1 Byte目は個数, get
		// uniq
		'b6': [0x42] // 点灯モード設定, set, get
	}
};



async function setup() {
	// ノードプロファイルに関しては内部処理するので，ユーザーはエアコンに関する受信処理だけを記述する．
	let elsocket = await EL.initialize(objList, function (rinfo, els, e) {
		if (e) {
			console.error(e);
			return;
		}
		if( els.DEOJ.substr(0,4) == '0ef0' ) {return;}  // Node profileに関しては何もしない

		// ESVで振り分け，主に0x60系列に対応すればいい
		switch (els.ESV) {
			////////////////////////////////////////////////////////////////////////////////////
			// 0x6x
			case EL.SETI: // "60
			case EL.SETC: // "61"，返信必要あり
			EL.replySetDetail( rinfo, els, dev_details );
			break;

			case EL.GET: // 0x62，Get
			EL.replyGetDetail( rinfo, els, dev_details );
			break;

			case EL.INFREQ: // 0x63
			break;

			case EL.SETGET: // "6e"
			break;

			default:
			break;
		}

	}, 0, {ignoreMe: true, autoGetProperties: false, debugMode: false});

	dev_details['013001']['83'][7]  = dev_details['029001']['83'][7]  = EL.Node_details["83"][7];
	dev_details['013001']['83'][8]  = dev_details['029001']['83'][8]  = EL.Node_details["83"][8];
	dev_details['013001']['83'][9]  = dev_details['029001']['83'][9]  = EL.Node_details["83"][9];
	dev_details['013001']['83'][10] = dev_details['029001']['83'][10] = EL.Node_details["83"][10];
	dev_details['013001']['83'][11] = dev_details['029001']['83'][11] = EL.Node_details["83"][11];
	dev_details['013001']['83'][12] = dev_details['029001']['83'][12] = EL.Node_details["83"][12];

	//////////////////////////////////////////////////////////////////////
	// 全て立ち上がったのでINFでエアコンONの宣言
	EL.sendOPC1('224.0.23.0', [0x01, 0x30, 0x01], [0x0e, 0xf0, 0x01], 0x73, 0x80, 0x30);
	// 全て立ち上がったのでINFで照明ONの宣言
	EL.sendOPC1('224.0.23.0', [0x02, 0x90, 0x01], [0x0e, 0xf0, 0x01], 0x73, 0x80, 0x30);
}


setup();


//////////////////////////////////////////////////////////////////////
// EOF
//////////////////////////////////////////////////////////////////////
```


# Data stracture

```
let EL = {
EL_port: 3610,
EL_Multi: '224.0.23.0',
EL_obj: null,
facilities: {}  // ネットワーク内の機器情報リスト; device and property list in the LAN
// Ex.
// { '192.168.0.3': { '05ff01': { d6: '' } },
// { '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
};
```

ELデータはこのモジュールで定義した構造で，下記のようになっています．
ELDATA is ECHONET Lite data stracture, which conteints

## 受信データ (=els, =el structure型とも)
```
ELDATA {
  EHD : str.substr( 0, 4 ),
  TID : str.substr( 4, 4 ),
  SEOJ : str.substr( 8, 6 ),
  DEOJ : str.substr( 14, 6 ),
  EDATA: str.substr( 20 ),    // EDATA is followings
  ESV : str.substr( 20, 2 ),
  OPC : str.substr( 22, 2 ),
  DETAIL: str.substr( 24 ),
  DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
}
```

## オブジェクト内の機器情報リスト, facilities information

こんな感じ

```
EL.facilities =
{ '192.168.2.103':
   { '05ff01': { '80': '', d6: '' },
     '0ef001': { '80': '30', d6: '0100' } },
  '192.168.2.104': { '0ef001': { d6: '0105ff01' }, '05ff01': { '80': '30' } },
  '192.168.2.115': { '0ef001': { '80': '30', d6: '01013501' } } }
```

## 識別番号リスト, identification numbers

こんな感じ

```
EL.identificationNumbers
[
  {
    id: 'fe0000776e5b0d002b5b0ef00100000000',
    ip: '192.168.2.11',
    OBJ: '0ef001'
  },
  {
    id: 'fe0000776a6ee920fd7002870100000000',
    ip: '192.168.2.11',
    OBJ: '028701'
  }
]
```

## 自分がデバイス扱いしたい場合は下記の dev_details の形でEPC管理すると使える関数がある

下記はエアコンと照明の詳細オブジェクトを持っている場合である。

```
// 自分のエアコンのデータ，今回はこのデータをグローバル的に使用する方法で紹介する．
let dev_details = {
	'013001': {
		// super
		"80": [0x30],  // 動作状態
		"81": [0xff],  // 設置場所
		"82": [0x00, 0x00, 0x66, 0x00], // EL version, 1.1
		"88": [0x42],  // 異常状態
		"8a": [0x00, 0x00, 0x77], // maker code
		"9d": [0x04, 0x80, 0x8f, 0xa0, 0xb0],        // inf map, 1 Byte目は個数
		"9e": [0x04, 0x80, 0x8f, 0xa0, 0xb0],        // set map, 1 Byte目は個数
		"9f": [0x0d, 0x80, 0x81, 0x82, 0x88, 0x8a, 0x8f, 0x9d, 0x9e, 0x9f, 0xa0, 0xb0, 0xb3, 0xbb], // get map, 1 Byte目は個数
		// child
		"8f": [0x41], // 節電動作設定
		"a0": [0x31], // 風量設定
		"b0": [0x41], // 運転モード設定
		"b3": [0x19], // 温度設定値
		"bb": [0x1a] // 室内温度計測値
	},
	'029001': {  // lighting
		// super
		'80': [0x31], // 動作状態, set?, get, inf
		'81': [0x0f], // 設置場所, set, get, inf
		'82': [0x00, 0x00, 0x50, 0x01],  // spec version, P. rev1, get
		'83': [0xfe, 0x00, 0x00, 0x77, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03], // identifier, initialize時に、renewNICList()できちんとセットする, get
		'88': [0x42], // 異常状態, 0x42 = 異常無, get
		'8a': [0x00, 0x00, 0x77],  // maker code, kait, get
		'9d': [0x04, 0x80, 0x81],  // inf map, 1 Byte目は個数, get
		'9e': [0x04, 0x80, 0x81, 0xb6],  // set map, 1 Byte目は個数, get
		'9f': [0x0a, 0x80, 0x81, 0x82, 0x83, 0x88, 0x8a, 0x9d, 0x9e, 0x9f, 0xb6], // get map, 1 Byte目は個数, get
		// uniq
		'b6': [0x42] // 点灯モード設定, set, get
	}
};
```


# API

## 初期化と受信, 監視, initialize, receriver callback and observation

![](img/base.png)

* initialize

```
EL.initialize = function ( objList, userfunc, ipVer = 4, Options = {v4: '', v6: '', ignoreMe: true, autoGetProperties: true, debugMode: false} )
```

- objList is ECHONET Lite object code.
 - for example, ['05ff01'] is a controller.

- userfunc is the your callback function. userfunc is described as following.

```
function( rinfo, els, err ) {
	console.log('==============================');
	if( err ) {
		console.dir(err);
	}else{
		// ToDo
	}
}
```


- ipVer is optional
 - ipVer = 0, IPv4 and IPv6
 - ipVer = 4, IPv4 only
 - ipVer = 6, IPv6 only

- Options is optional
 - v4 is specified for using IPAddress, default '' is auto
 - v6 is specified for using NIC name, default '' is auto
 - ignoreMe is specified to ignore self IP address, default true
 - autoGetProperties is automatic get for properties, default true (trial)
 - autoGetDelay is period of the auto get EDTs, default 3000ms
 - debugMode shows innser log, default false


- More examples

```
let objList = ['05ff01'];

let elsocket = EL.initialize( objList, function( rinfo, els, err ) {
	console.log('==============================');
	if( err ) {
		console.dir(err);
	}else{
		console.log('----');
		console.log('Get ECHONET Lite data');
		console.log('rinfo is '); console.dir(rinfo);
		console.log('els is ');   console.dir(els);
	}
}, 0, { 'v4': '', 'v6': '', ignoreMe:true, autoGetProperties: true, autoGetDelay: 1000, debugMode: false});  // Recommendation for a controller
// }, 0, { 'v4': '', 'v6': '', ignoreMe:true, autoGetProperties: false, debugMode: false});  // Recommendation for a device
```


* 解放, release

```
EL.release = function()
```



* NICリスト再取得, renew NIC list

```
EL.renewNICList = function()
```

- 戻り値はObject
- output is object data.


* ECHONET Liteネットワーク監視

```
EL.setObserveFacilities = function ( interval, onChanged )
```

* ECHONET Liteネットワーク監視終了（タイマー解放）

```
EL.clearObserveFacilities = function ();
```


## データ表示系, data representations

![](img/show.png)


* ELDATA形式, ELDATA type

```
EL.eldataShow = function( eldata )
```


* 文字列, string

```
EL.stringShow = function( str )
```


* バイトデータ, byte data

```
EL.bytesShow = function( bytes )
```



## 変換系, converters

![](img/convert.png)

|       from        |        to         |             function              |
| :---------------: | :---------------: | :-------------------------------: |
|      String       |    ELDATA(EDT)    |       parseDetail(opc,str)        |
| Bytes(=Integer[]) |      ELDATA       |         parseBytes(bytes)         |
|      String       |      ELDATA       |         parseString(str)          |
|      String       | String (like EL)  |  getSeparatedString_String(str)   |
|      ELDATA       | String (like EL)  | getSeparatedString_ELDATA(eldata) |
|      ELDATA       | Bytes(=Integer[]) |       ELDATA2Array(eldata)        |


* DetailだけをParseする，内部でよく使うけど外部で使うかわかりません．
* inner function. Parses only detail (for echonet lite data frame).

```
EL.parseDetail = function( opc, str )
```

* byte dataを入力するとELDATA形式にする
* bytes -> ELDATA type

```
EL.parseBytes = function( bytes )
```


* HEXで表現されたStringをいれるとELDATA形式にする
* HEX string -> ELDATA

```
EL.parseString = function( str )
```


* 文字列をいれるとELらしい切り方のStringを得る
* String -> EL-like String

```
EL.getSeparatedString_String = function( str )
```


* ELDATAをいれるとELらしい切り方のStringを得る
* ELDATA -> EL-like String

```
EL.getSeparatedString_ELDATA = function( eldata )
```

* ELDATA形式から配列へ
* ELDATA -> Array

```
EL.ELDATA2Array = function( eldata )
```


* 変換表, convert pair of datas

|      from      |       to       |     function      |
| :------------: | :------------: | :---------------: |
|      Byte      | 16進表現String | toHexString(byte) |
| 16進表現String |   Integer[]    |  toHexArray(str)  |


* 1バイトを文字列の16進表現へ（1Byteは必ず2文字にする）
* a byte -> HEX string

```
EL.toHexString = function( byte )
```

* HEXのStringを数値のバイト配列へ
* HES String -> Array

```
EL.toHexArray = function( string )
```


## 送信, send

![](img/send.png)

APIは送信の成功失敗に関わらず，TIDをreturnすることにしました。
送信TIDはEL.tid[]で管理しています。
sendOPC1とEL.sendEPCsはEL.tidを自動的に+1します。

ipの指定方法は、
- 文字列で '192.168.10.3' のように記述する方法
- rinfoオブジェクトのように {address:'192.168.10.3', family:'IPv4'} のように記述する方法の両方使えます

* EL送信のベース, base function

```
EL.sendBase = function( ip, buffer )
```

* 配列の時, send Array

```
EL.sendArray = function( ip, array )
```

* OPC一個でやる方式, send EL-like

```
EL.sendOPC1 = function( ip, seoj, deoj, esv, epc, edt)
```

ex.

```
EL.sendOPC1( '192.168.2.150', [0x05,0xff,0x01], [0x01,0x35,0x01], 0x61, 0x80, [0x31]);
EL.sendOPC1( '192.168.2.150', [0x05,0xff,0x01], [0x01,0x35,0x01], 0x61, 0x80, 0x31);
EL.sendOPC1( '192.168.2.150', "05ff01", "013501", "61", "80", "31");
EL.sendOPC1( '192.168.2.150', "05ff01", "013501", EL.SETC, "80", "31");
```


* 文字列で送信, send EL-like string

```
EL.sendString = function( ip, string )
```


* 複数のEPCで送信する
	- seoj, deoj, esvはbyteでもstringでも受け付ける
	- DETAILsは下記の構造で、オブジェクト指定かArray指定でよい。Arrayの場合には送信の際のEPC出現順序が守られる
	- DETAILs = {epc: edt, epc: edt, ...}
	- ex. {'80':'31', '8a':'000077'}
	- DETAILs = [{epc: edt}, {epc: edt}, ...]
	- ex. [{'80':'31'}, {'8a':'000077'}]
```
EL.sendDetails = function (ip, seoj, deoj, esv, DETAILs)
```

* 省略したELDATA型で送信する
	- ELDATA {
	-   TID : String(4),      // 省略すると自動
	-   SEOJ : String(6),
	-   DEOJ : String(6),
	-   ESV : String(2),
	-   DETAILs: Object
	- }
	- ex.
	- ELDATA {
	-   TID : '0001',      // 省略すると自動
	-   SEOJ : '05ff01',
	-   DEOJ : '029001',
	-   ESV : '61',
	-   DETAILs:  {'80':'31', '8a':'000077'}
	- }
```
EL.sendELDATA = function (ip, eldata)
```


* 機器検索

```
EL.search = function()
```

* ネットワーク内のEL機器全体情報を更新する

```
EL.renewFacilities = function( ip, obj, opc, detail )
```

* 機器情報の変化監視 (From Ver. 1.0.0)
* Set observing function to change EL.facilities.

```
EL.setObserveFacilities = function( interval, onChanged );
```

ex.

```
EL.setObserveFacilities( 1000, function() {  // 1000 ms
	console.log('EL.facilities are changed.');
});
```

* 機器情報の未取得EPCを補完する
```
EL.complementFacilities = function ();
```

ex.

```
const cron = require('node-cron');
cron.schedule( '*/3 * * * *', () => {
	EL.complementFacilities();
})
```



## OPC2以上対応, OPC managements for more than two

![](img/multi.png)


* ELの返信用、典型的なOPC一個でやるタイプ．TIDをGetメッセージに合わせて返信しないといけないため

```
EL.replyOPC1 = function (ip, tid, seoj, deoj, esv, epc, edt)
```

* OPC2以上にSet/Getで対応するための関数、自分で管理している機器の状態を dev_details の形式で作ってわたす

```
EL.replyGetDetail = async function(rinfo, els, dev_details)
```

```
EL.replySetDetail = async function(rinfo, els, dev_details)
```


* dev_detailsの形式、エアコンの例

```dev_details:json
let dev_details = {
	'013001': {
		// super
		"80": [0x30],  // 動作状態
		"81": [0xff],  // 設置場所
		"82": [0x00, 0x00, 0x66, 0x00], // EL version, 1.1
		"88": [0x42],  // 異常状態
		"8a": [0x00, 0x00, 0x77], // maker code
		"9d": [0x04, 0x80, 0x8f, 0xa0, 0xb0],        // inf map, 1 Byte目は個数
		"9e": [0x04, 0x80, 0x8f, 0xa0, 0xb0],        // set map, 1 Byte目は個数
		"9f": [0x0d, 0x80, 0x81, 0x82, 0x88, 0x8a, 0x8f, 0x9d, 0x9e, 0x9f, 0xa0, 0xb0, 0xb3, 0xbb], // get map, 1 Byte目は個数
		// child
		"8f": [0x41], // 節電動作設定
		"a0": [0x31], // 風量設定
		"b0": [0x41], // 運転モード設定
		"b3": [0x19], // 温度設定値
		"bb": [0x1a] // 室内温度計測値
	}
};
```


## 受信データの完全コントロール, Full control method for received data.

ELの受信データを振り分けるよ，何とかしよう．
ELの受信をすべて自分で書きたい人はこれを完全に書き換えればいいとおもう．
普通の人はinitializeのuserfuncで事足りるはず．

For controlling all receiving data, update EL.returner function by any function. However this method is not recommended.
Generally, all process can be described in userfunc of EL.initialize.

```
EL.returner = function( bytes, rinfo, userfunc )
```


# echonet-lite.js 攻略情報 / Knowhow

* コントローラ開発者向け

おそらく一番使いやすい受信データ解析はEL.facilitiesをそのままreadすることかも．
たとえば，そのまま表示すると，

Probably, easy analysis of the received data is to display directory.
For example,

```
console.dir( EL.facilities );
```

データはこんな感じ．

Reseiving data as,

```
{ '192.168.2.103':
   { '05ff01': { '80': '', d6: '' },
     '0ef001': { '80': '30', d6: '0100' } },
  '192.168.2.104': { '0ef001': { d6: '0105ff01' }, '05ff01': { '80': '30' } },
  '192.168.2.115': { '0ef001': { '80': '30', d6: '01013501' } } }
```


また，データ送信で一番使いやすそうなのはsendOPC1だとおもう．
これの組み合わせてECHONET Liteはほとんど操作できるのではなかろうか．

The simplest sending method is 'sendOPC1.'

```
EL.sendOPC1( '192.168.2.103', [0x05,0xff,0x01], [0x01,0x35,0x01], 0x61, 0x80, [0x30]);
```


# meta data

## Authors

神奈川工科大学  創造工学部  ホームエレクトロニクス開発学科; Dept. of Home Electronics, Faculty of Creative Engineering, Kanagawa Institute of Technology

杉村　博; SUGIMURA, Hiroshi

## thanks

Thanks to Github users!

## License

MIT License

```
-- License summary --
o Commercial use
o Modification
o Distribution
o Private use
x Liability
x Warranty
```


## Log
- 2.17.2 parseBytes修正、TID条件バグ修正、MAC未取得時の識別子フェールセーフ
- 2.17.1 strict対応、文字列切り出しのBugfix、SetC_SNAのBugfix、コードの見やすさや健全性チェック
- 2.17.0 ELのヘッダチェック、OPC妥当性チェック、IPv4のNIC指定の追加 (from Pull request)
- 2.16.3 EL.SearchをEL.Initializeを完了する前に呼んでしまい情報取得がスタックしてしまう場合があることを解消
- 2.16.2 EL.sendELDATAのesvが宣言されていない を直していただいた
- 2.16.1 IPv6の時に、送信でIF重複指定になる時があったバグを修正
- 2.16.0 getClassListメソド追加
- 2.15.2 renewFacilitiesの格納条件詳細を見直しした
- 2.15.1 renewFacilitiesの格納条件詳細を見直しした
- 2.15.0 renewFacilitiesの格納条件を見直しした
- 2.14.2 Node-profile-objectへのアクセスを0ef000だったのを0ef001に戻した
- 2.14.1 内部的にipをrinfoのまま扱うこととした
- 2.14.0 メーカ独自EPCの未保持無視、IPv4とIPv6の処理をもう少し真面目に、ipをrinfoのような形でも受付可能にした
- 2.13.1 complement系微修正
- 2.13.0 complement系method追加
- 2.12.5 無駄なログ削除
- 2.12.4 sendDetailsのDETAILs指定に配列を受けるようにした。配列の場合にはEPC送信順序を守る
- 2.12.3 autoGetPropertiesの発見をnew objの時も動くように
- 2.12.2 SetC_SNA受信対応
- 2.12.1 SetC_SNA送信対応
- 2.12.0 Search、autoGetPropertiesの処理を一気にGetするように変更、ただし、うまくいくか調査が足りていない。
- 2.11.3 Get_SNAの対応をもう少しまともに
- 2.11.2 parseDetail bug fix, parseMapForm2がarray引数にとれるように修正
- 2.11.1 Get bug fix
- 2.11.0 メソド追加（EL.sendELDATA）
- 2.10.0 メソド追加（EL.sendDetails）
- 2.9.6 parseDetail、OPCが10以上でバグがあったのを修正
- 2.9.5 コメント修正
- 2.9.4 定数 EL_Multi, EL_Multi6 がEL.EL_Multiとなって冗長なので、同等内容のMulti、Multi6を追加した。
- 2.9.3 EPC:bf, Set対応
- 2.9.2 EPC:bf, 追加
- 2.9.1 EPC:83, identifier のバグ修正
- 2.9.0 OPC2以上に対応するべくSet/Getの関数を用意した
- 2.8.1 node profile 8b = 02とした
- 2.8.0 IPv6のignoreMeが効いてないバグを修正
- 2.7.1 NIC auto 対応、NIC list取得のバグ修正、WindowsによるIPv6 Multicastのして方法が不明(bug)
- 2.7.0 method(replyOPC1)を追加、bugfix（自動返信でのTIDの設定ミスを修正）
- 2.6.0 method(release, clearObserveFacilities)を追加
- 2.5.8 PropertyMap2のautoGetの時に，違うEPCをGetするバグを直した
- 2.5.7 識別番号の自動生成はオブジェクトではなく配列とした
- 2.5.6 SET_RESはfacilitiesへの登録をやめた
- 2.5.5 bug fix. format 2
- 2.5.4 bug fix. Option.v6
- 2.5.3 bug fix. ignoreMe
- 2.5.2 bug fix. ipv6 mac
- 2.5.1 bug fix. ipv6 win
- 2.5.0 これから個体識別番号でELネットワーク管理をしたいので，その布石にNodeprofileの個体識別番号を自動生成することとした。macアドレスを利用するので重複しないとおもう。識別番号リストの確保もできるようにした。
- 2.4.2 ignoreMeのときの自IPとして127.0.0.1を排除するように設定。v6は::1を排除する。ignoreMeをデフォルトtrueに。
- 2.4.1 OPCが複数のときにparseDetailで不具合があったのを修正した。関連する関数はparseDetail, parseString, parseBytes, renewFacilitiesの4つ。
- 2.4.0 自動取得をすぐ実行するとデバイス側が対応出来ないことが多いので，3秒（autoGetDelay）待つことにした
- 2.3.1 send系関数全部がTIDを戻り値とするようにした。sendOPC1以外はTIDはを自動設定しない
- 2.3.0 sendOPC1がTIDを自動設定して，戻り値とするようにした
- 2.2.2 autoGetPropertiesをもう少し強化した。debugModeを追加した。
- 2.2.1 InitializeにautoGetPropertiesオプションを追加した。トライアルです。
- 2.2.0 PropertyMap解析のときに，形式2の読み取りにバグがあったのを修正，READMEを整理＆図をつくって充実させた。
- 2.1.1 GetPropertyMapのときに，各プロパティ読み取りのWAITをつけた。処理が遅いデバイス対策
- 2.1.0 自IPの受信を無視する，ignoreMeオプションを実装
- 2.0.3 bind見直し
- 2.0.2 log消し
- 2.0.1 repush
- 2.0.0 IPv4，IPv6，デュアルスタック対応，Interface切り替え対応。複雑になってきたので少しコンソールにログがでる。
- 1.0.4 くだらないログがでてました。削除
- 1.0.3 IPv6をIPv4と同時対応可能にした。initializeを下記のようにするとv4, v6同時に通信できる。複数NIC対応のため，MulticastAddressを指定できるようにしたが，うまく利いていない気はする。
- 1.0.2 IPv6対応のための布石。Node.jsがIPv6のmulticast対応をきちんとしてくれないので動かないような気がする。
- 1.0.1 bug fix. string equal，ユーザ設定が間違っているときにどのようにエラーを出すかを今後の課題として記す。
- 1.0.0 EL.setObserveFacilitiesを実装した。ついでにいろいろあきらめてVer. 1ということにした。
- 0.0.23 Replace new Buffer() by Buffer.from().
- 0.0.22 property mapを一度に3個聞いていたのをデバイスの通信負荷を考慮して少し待つことにした。
- 0.0.21 OPC != 1 でのparseDetailsの処理に不具合があったので修正しました。ほかにも'use strict'に対応，varをletにした。
- 0.0.20 INF_REQがINFREQだったバグを修正した。
- 0.0.19 utf-8n対応，EL.parseDetailのエラーに対応，ライブラリのくせに結構標準出力していたあたりを取った。
- 0.0.18 Readmeを少し修正．
- 0.0.17 473行以下でプロパティマップを受信した場合の処理を記述していますが、ノードプロファイル以外の場合もこの処理に入ってしまうバグがあります。この修正によりノードプロファイルの場合のみプロパティマップ内のプロパティを取得するようになります。
- 0.0.16 Readmeを少し修正．
- 0.0.15 HEX変換をNodeの標準ライブラリにしてくれた．IPv6対応してくれた．
- 0.0.14 EL.sendOPC1の引数の型に関してかなりあいまいに処理できるようにした．seoj, deoj, esv, epcは文字列でもOK，edtは数値も文字列もOKにした．また，esvをわかりやすくするために下記も利用できるように定義した．
```
EL.SETI_SNA   = "50"
EL.SETC_SNA   = "51"
EL.GET_SNA    = "52"
EL.INF_SNA    = "53"
EL.SETGET_SNA = "5e"
EL.SETI       = "60"
EL.SETC       = "61"
EL.GET        = "62"
EL.INF_REQ    = "63"
EL.SETGET     = "6e"
EL.SET_RES    = "71"
EL.GET_RES    = "72"
EL.INF        = "73"
EL.INFC       = "74"
EL.INFC_RES   = "7a"
EL.SETGET_RES = "7e"
```
- 0.0.13 ReadmeのsendOPC1が分かりにくかったので修正．
- 0.0.12 Node Profile Objectに対するGet関係に対応．facilities構成に関して，ESVがSetとINFREQできたEPCをtoIPデバイスのものとして確保するバグを修正．結構頑張って規格に対応したつもりです．README手直し
- 0.0.11 マニュアルの英語表記追加
- 0.0.10 API追加とBug修正，PropertyMap対応，sendOPC1のEPCを3バイトにしたので0.0.9と互換性きえた．Node.jsからだと家電の速度が間に合わないのでUDPの取りこぼしが発生する．ライブラリとしては対処しないこととなった．．
