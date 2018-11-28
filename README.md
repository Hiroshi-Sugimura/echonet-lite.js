# Overview

このモジュールは**ECHONET Liteプロトコル**をサポートします．
ECHONET Liteプロトコルはスマートハウス機器の通信プロトコルです．

This module provides **ECHONET Lite protocol**.
The ECHONET Lite protocol is a communication protocol for smart home devices.


## Install

下記コマンドでモジュールをインストールできます．

You can install the module as following command.

```
 > npm install echonet-lite
```


## Demos(controller)


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


## Demos(Devices)

こんな感じで作ってみたらどうでしょうか．
あとはairconObjのプロパティをグローバル変数として，別の関数から書き換えてもいいですよね．
これでGetに対応できるようになります．


```JavaScript:Demo
//////////////////////////////////////////////////////////////////////
// ECHONET Lite
var EL = require('echonet-lite');

// エアコンを例に
var objList = ['013001'];

// 自分のエアコンのデータ，今回はこのデータをグローバル的に使用する方法で紹介する．
var airconObj = {
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
};

// ノードプロファイルに関しては内部処理するので，ユーザーはエアコンに関する受信処理だけを記述する．
var elsocket = EL.initialize( objList, function( rinfo, els ) {
    // コントローラがGetしてくるので，対応してあげる
    // エアコンを指定してきたかチェック
    if( els.DEOJ == '013000' || els.DEOJ == '013001' ) {
        // ESVで振り分け，主に0x60系列に対応すればいい
        switch( els.ESV ) {
            ////////////////////////////////////////////////////////////////////////////////////
            // 0x6x
          case EL.SETI: // "60
            break;
          case EL.SETC: // "61"，返信必要あり
            break;

          case EL.GET: // 0x62，Get
            for( var epc in els.DETAILs ) {
                if( airconObj[epc] ) { // 持ってるEPCのとき
                    EL.sendOPC1( rinfo.address, [0x01, 0x30, 0x01], EL.toHexArray(els.SEOJ), 0x72, EL.toHexArray(epc), airconObj[epc] );
                } else { // 持っていないEPCのとき, SNA
                    EL.sendOPC1( rinfo.address, [0x01, 0x30, 0x01], EL.toHexArray(els.SEOJ), 0x52, EL.toHexArray(epc), [0x00] );
                }
            }
            break;

          case EL.INFREQ: // 0x63
            break;

          case EL.SETGET: // "6e"
            break;

          default:
            // console.log( "???" );
            // console.dir( els );
            break;
        }
    }
});

//////////////////////////////////////////////////////////////////////
// 全て立ち上がったのでINFでエアコンONの宣言
EL.sendOPC1( '224.0.23.0', [0x01,0x30,0x01], [0x0e,0xf0,0x01], 0x73, 0x80, [0x30]);
```


## Data stracture

```
var EL = {
EL_port: 3610,
EL_Multi: '224.0.23.0',
EL_obj: null,
facilities: {}  // ネットワーク内の機器情報リスト
// Ex.
// { '192.168.0.3': { '05ff01': { d6: '' } },
// { '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
};


ELデータはこのモジュールで定義した構造で，下記のようになっています．
ELDATA is ECHONET Lite data stracture, which conteints

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


## API


### 初期化，バインド, initialize

```
EL.initialize = function ( objList, userfunc, ipVer )
```

そしてuserfuncはこんな感じで使いましょう。

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


### データ表示系, data representations

* ELDATA形式

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


### 変換系, converters


| from              |    to             |   function                         |
|:-----------------:|:-----------------:|:----------------------------------:|
| Bytes(=Integer[]) | ELDATA            | parseBytes(bytes)                  |
| String            | ELDATA            | parseString(str)                   |
| String            | ELっぽいString    | getSeparatedString_String(str)     |
| ELDATA            | ELっぽいString    | getSeparatedString_ELDATA(eldata)  |
| ELDATA            | Bytes(=Integer[]) | ELDATA2Array(eldata)               |


* DetailだけをParseする，内部でよく使うけど外部で使うかわかりません．

```
EL.parseDetail = function( opc, str )
```

* byte dataを入力するとELDATA形式にする

```
EL.parseBytes = function( bytes )
```


* HEXで表現されたStringをいれるとELDATA形式にする

```
EL.parseString = function( str )
```


* 文字列をいれるとELらしい切り方のStringを得る

```
EL.getSeparatedString_String = function( str )
```


* ELDATAをいれるとELらしい切り方のStringを得る

```
EL.getSeparatedString_ELDATA = function( eldata )
```

* ELDATA形式から配列へ

```
EL.ELDATA2Array = function( eldata )
```


* 変換表

| from              |    to          |   function                         |
|:-----------------:|:--------------:|:----------------------------------:|
| Byte              | 16進表現String | toHexString(byte)                  |
| 16進表現String    |  Integer[]     | toHexArray(str)                    |


* 1バイトを文字列の16進表現へ（1Byteは必ず2文字にする）

```
EL.toHexString = function( byte )
```

* HEXのStringを数値のバイト配列へ

```
EL.toHexArray = function( string )
```


### 送信, send

* EL送信のベース

```
EL.sendBase = function( ip, buffer )
```

* 配列の時

```
EL.sendArray = function( ip, array )
```

* ELの非常に典型的なOPC一個でやる方式

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


* ELの非常に典型的な送信3 文字列タイプ

```
EL.sendString = function( ip, string )
```


### 受信データの完全コントロール, Full control method for received data.

ELの受信データを振り分けるよ，何とかしよう．
ELの受信をすべて自分で書きたい人はこれを完全に書き換えればいいとおもう．
普通の人はinitializeのuserfuncで事足りるはず．

```
EL.returner = function( bytes, rinfo, userfunc )
```



### EL，上位の通信手続き

* 機器検索

```
EL.search = function()
```

* ネットワーク内のEL機器全体情報を更新する

```
EL.renewFacilities = function( ip, obj, opc, detail )
```


## ECHONET Lite攻略情報


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



## Authors

神奈川工科大学  創造工学部  ホームエレクトロニクス開発学科．

Dept. of Home Electronics, Faculty of Creative Engineering, Kanagawa Institute of Technology.


杉村　博

SUGIMURA, Hiroshi

### thanks

Thanks to Github users!


## Log

0.0.22 property mapを一度に3個聞いていたのをデバイスの通信負荷を考慮して少し待つことにした。

0.0.21 OPC != 1 でのparseDetailsの処理に不具合があったので修正しました。ほかにも'use strict'に対応，varをletにした。

0.0.20 INF_REQがINFREQだったバグを修正した。

0.0.19 utf-8n対応，EL.parseDetailのエラーに対応，ライブラリのくせに結構標準出力していたあたりを取った。

0.0.18 Readmeを少し修正．

0.0.17 473行以下でプロパティマップを受信した場合の処理を記述していますが、
ノードプロファイル以外の場合もこの処理に入ってしまうバグがあります。
この修正によりノードプロファイルの場合のみプロパティマップ内のプロパティを取得するようになります。


0.0.16 Readmeを少し修正．

0.0.15 HEX変換をNodeの標準ライブラリにしてくれた．IPv6対応してくれた．

0.0.14 EL.sendOPC1の引数の型に関してかなりあいまいに処理できるようにした．
seoj, deoj, esv, epcは文字列でもOK，edtは数値も文字列もOKにした．
また，esvをわかりやすくするために下記も利用できるように定義した．

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

0.0.13 ReadmeのsendOPC1が分かりにくかったので修正．

0.0.12 Node Profile Objectに対するGet関係に対応．facilities構成に関して，ESVがSetとINFREQできたEPCをtoIPデバイスのものとして確保するバグを修正．結構頑張って規格に対応したつもりです．README手直し

0.0.11 マニュアルの英語表記追加

0.0.10 API追加とBug修正，PropertyMap対応，sendOPC1のEPCを3バイトにしたので0.0.9と互換性きえた．Node.jsからだと家電の速度が間に合わないのでUDPの取りこぼしが発生する．ライブラリとしては対処しないこととなった．．
