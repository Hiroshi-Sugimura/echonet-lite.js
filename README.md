echonet-lite.js

============

# Overview

This module provides ECHONET Lite protocol.

## Description


## Demos


    // モジュールの機能をELとして使う
    var EL = require('echonet-lite');

    // 自分自身のオブジェクトを決める
    // initializeで設定される，必ず何か設定しないといけない，今回はコントローラ
    var objList = ['05ff01'];

    ////////////////////////////////////////////////////////////////////////////
    // 初期化するとともに，受信動作をコールバックで登録する
    var elsocket = EL.initialize( objList, function( rinfo, els ) {
    console.log('==============================');
    console.log('Get ECHONET Lite data');
    console.log('rinfo is ');
    console.dir(rinfo);

    // elsはELDATA構造になっているので使いやすいかも
    console.log('----');
    console.log('els is ');
    console.dir(els);

    // ELDATAをArrayにする事で使いやすい人もいるかも
    console.log('----');
    console.log( 'ECHONET Lite data array is ' );
    console.log( EL.ELDATA2Array( els ) );

    // 受信データをもとに，実は内部的にfacilitiesの中で管理している
    console.log('----');
    console.log( 'Found facilities are ' );
    console.dir( EL.facilities );
    });

    // NetworkのELをすべてsearchしてみよう．
    EL.search = function();




## Data stracture

    var EL = {
    EL_port: 3610,
    EL_Multi: '224.0.23.0',
    EL_obj: null,
    facilities: {}  // ネットワーク内の機器情報リスト
    // Ex.
    // { '192.168.0.3': { '05ff01': { d6: '' } },
    // { '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
    };


    ELDATA is ECHONET Lite data stracture, which conteints
    EHD : str.substr( 0, 4 ),
    TID : str.substr( 4, 4 ),
    SEOJ : str.substr( 8, 6 ),
    DEOJ : str.substr( 14, 6 ),
    EDATA: str.substr( 20 ),    // EDATA is followings
    ESV : str.substr( 20, 2 ),
    OPC : str.substr( 22, 2 ),
    DETAIL: str.substr( 24 ),
    DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )


## Install

    > npm install echonet-lite


## API


### 初期化，バインド
* EL.initialize = function ( objList, userfunc )


### データ表示系


ELDATA形式

* EL.eldataShow = function( eldata )


文字列

* EL.stringShow = function( str )


バイトデータ

* EL.bytesShow = function( bytes )


### 変換系

* EL.parseDetail = function( opc, str )

バイトデータを入力するとELDATA形式にする

* EL.parseBytes = function( bytes )


16進数で表現された文字列をぶち込むとELDATA形式にする

* EL.parseString = function( str )


文字列をいれるとELらしい切り方のStringを得る

* EL.getSeparatedString_String = function( str )


ELDATAをいれるとELらしい切り方のStringを得る

* EL.getSeparatedString_ELDATA = function( eldata )

ELDATA形式から配列へ

* EL.ELDATA2Array = function( eldata )

1バイト文字をHEX数値にしたい

* EL.charToInteger = function( chara )

1バイトを文字列の16進表現へ（1Byteは必ず2文字にする）

* EL.toHexString = function( byte )

16進表現の文字列を数値のバイト配列へ

* EL.toHexArray = function( string )


### 送信

EL送信のベース

* EL.sendBase = function( ip, buffer )

配列の時

* EL.sendArray = function( ip, array )

ELの非常に典型的なOPC一個でやる方式

* EL.sendOPC1 = function( ip, seoj, deoj, esv, epc, edt)

ELの非常に典型的な送信3 文字列タイプ

* EL.sendString = function( ip, string )


### EL受信

ELの受信データを振り分けるよ，何とかしよう．
ELの受信をすべて自分で書きたい人はこれを完全に書き換えればいいとおもう．
普通の人はinitializeのuserfuncで事足りるはず．

* EL.returner = function( bytes, rinfo, userfunc )


### EL，上位の通信手続き

機器検索

* EL.search = function()

ネットワーク内のEL機器全体情報を更新する

* EL.renewFacilities = function( ip, obj, opc, detail )



## Author

Hiroshi SUGIMURA

