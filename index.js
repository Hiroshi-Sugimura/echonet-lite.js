//////////////////////////////////////////////////////////////////////
//	$Date:: 2016-03-29 18:50:22 +0900#$
//	$Rev: 9375 $
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27 - above.
//////////////////////////////////////////////////////////////////////
// UDP����
var dgram = require('dgram');

// EL Database
// var dbfilename = "ECHONETLite.db"
// var sqlite3 = require('sqlite3').verbose();
// var eldb = new sqlite3.Database(dbfilename);


//////////////////////////////////////////////////////////////////////
// ECHONET Lite

/*
	�f�[�^�\��
	EHD : str.substr( 0, 4 ),
	TID : str.substr( 4, 4 ),
	SEOJ : str.substr( 8, 6 ),
	DEOJ : str.substr( 14, 6 ),
	EDATA: str.substr( 20 ),    // ���L��EDATA�̏ڍ�
	ESV : str.substr( 20, 2 ),
	OPC : str.substr( 22, 2 ),
	DETAIL: str.substr( 24 ),
	DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
*/


// �N���X�ϐ�
var EL = {
EL_port: 3610,
EL_Multi: '224.0.23.0',
EL_obj: null,
facilities: {}  	// �l�b�g���[�N���̋@���񃊃X�g
// �f�[�^�`���̗�
// { '192.168.0.3': { '05ff01': { d6: '' } },
// '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
};


// �������C�o�C���h
EL.initialize = function ( objList, userfunc ) {
	// �I�u�W�F�N�g���X�g���m��
	EL_obj = objList;

	// EL�󂯎��悤��UDP
	var sock = dgram.createSocket("udp4", function (msg, rinfo) {
		EL.returner( msg, rinfo, userfunc );
	});

	// console.log( "EL_port: " + EL.EL_port + " bind." );

	// �}���`�L���X�g�ݒ�
	sock.bind( EL.EL_port, '0.0.0.0', function() {
		sock.setMulticastLoopback( true );
		sock.addMembership( EL.EL_Multi );
		// console.log( "EL_port bind OK!" );
	});

	return sock;
};


//////////////////////////////////////////////////////////////////////
// eldata ������C�\���֌W
//////////////////////////////////////////////////////////////////////

// ELDATA�`��
EL.eldataShow = function( eldata ) {
	if( eldata != null ) {
		console.log(
				   'EHD: ' + eldata.EHD + 'TID: ' +eldata.TID + 'SEOJ: ' + eldata.SEOJ + 'DEOJ: ' + eldata.DEOJ +
				   '\nEDATA: ' + eldata.EDATA );
	}else{
		console.log( "EL.eldataShow error. eldata is not EL data." );
	}
};


// ������
EL.stringShow = function( str ) {
	eld = EL.parseString(str);
	EL.eldataShow( eld );
};


// �o�C�g�f�[�^
EL.bytesShow = function( bytes ) {
	eld = EL.parseBytes( bytes );
	EL.eldataShow( eld );
};



//////////////////////////////////////////////////////////////////////
// �ϊ��n
//////////////////////////////////////////////////////////////////////
EL.parseDetail = function( opc, str ) {

	var ret = {}; // �߂�l�p�C�A�z�z��
	var now = 0;  // ���݂�Index
	var opc = EL.toHexArray( opc )[0];  // opc

	// opc���[�v
	for( i = 0; i< opc; i += 1 ) {
		// EPC
		var epc = str.substr( now, 2 );

		// �㔼�[���Â߂��Ă���Ƃ�������̂�epc zero�΍�
		if( epc == "00" ) {
			break;
		}

		// PDC, �f�[�^��
		var pdc = parseInt( str.substr( now+2, 2 ) );

		// get�̎���num=0
		if( pdc == 0 ) {
			ret[ (str.substr( now, 2 )) ] = "";
		}else {
			// �o�^
			ret[ str.substr( now, 2 ) ] = str.substr( now+4, pdc*2 );
		}

		now += (pdc*2 + 4);

	} // opc���[�v

	return ret;
};


// �o�C�g�f�[�^���Ԃ����ނ�ELDATA�`���ɂ���
EL.parseBytes = function( bytes ) {

	// �Œ����EL�p�P�b�g�ɂȂ��ĂȂ�
	if( bytes.length < 14 ) {
		console.error( 1, "EL.parseBytes error. bytes is less then 14 bytes. bytes.length is " + bytes.length  );
		console.error( 1, bytes );
		return null;
	}

	// ���l�������當����ɂ���
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
	EDATA: str.substr( 20 ),    // ���L��EDATA�̏ڍ�
	ESV : str.substr( 20, 2 ),
	OPC : str.substr( 22, 2 ),
	DETAIL: str.substr( 24 ),
	DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
	};

	return ( eldata );
};


// 16�i���ŕ\�����ꂽ��������Ԃ����ނ�ELDATA�`���ɂ���
EL.parseString = function( str ) {

	var eldata = {
	EHD : str.substr( 0, 4 ),
	TID : str.substr( 4, 4 ),
	SEOJ : str.substr( 8, 6 ),
	DEOJ : str.substr( 14, 6 ),
	EDATA: str.substr( 20 ),    // ���L��EDATA�̏ڍ�
	ESV : str.substr( 20, 2 ),
	OPC : str.substr( 22, 2 ),
	DETAIL: str.substr( 24 ),
	DETAILs: EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
	};

	return ( eldata );
};


// ��������Ԃ����ނ�EL�炵���؂����String�𓾂�
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


// ELDATA���Ԃ����ނ�EL�炵���؂����String�𓾂�
EL.getSeparatedString_ELDATA = function( eldata ) {
	return ( eldata.EHD + ' ' + eldata.TID + ' ' + eldata.SEOJ + ' ' + eldata.DEOJ + ' ' + eldata.EDATA );
};


// ELDATA�`������z���
EL.ELDATA2Array = function( eldata ) {
	var ret = EL.toHexArray( eldata.EHD +
							  eldata.TID +
							  eldata.SEOJ +
							  eldata.DEOJ +
							  eldata.EDATA );

	return ret;
};



// 1�o�C�g������HEX���l�ɂ�����
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

// 1�o�C�g�𕶎����16�i�\���ցi1Byte�͕K��2�����ɂ���j
EL.toHexString = function( byte ) {
	// ������0���Ȃ��āC��납��2�������X���C�X����
	return ( ("0" + byte.toString(16)).slice(-2) );
};

// 16�i�\���̕�����𐔒l�̃o�C�g�z���
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
// �f�[�^�x�[�X����̕ϊ��n
/*
EL.toEOJStr = function( s, callback ) {

	s = s.substr( 0, 4 );
	var query = "select ClassNameJ from Object where Class LIKE '" + s + "';";

	// console.dir( query );
	var str = "";
	// �����d����DB�����͓����҂����邵���Ȃ��H
	eldb.all( query, function( err, rows) {

		// all�ł��ŁC������΂Ȃ��ŏ�������
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
// ���M
//////////////////////////////////////////////////////////////////////

// EL���M�̃x�[�X
EL.sendBase = function( ip, buffer ) {

	// ���M����
	var client = dgram.createSocket("udp4");
	client.send( buffer, 0, buffer.length, EL.EL_port, ip, function(err, bytes) {
		client.close();
	});
};


// �z��̎�
EL.sendArray = function( ip, array ) {
	EL.sendBase( ip, new Buffer(array) );
};


// EL�̔��ɓT�^�I��OPC��ł��
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

	// �f�[�^���ł����̂ő��M����
	EL.sendBase( ip, buffer );
};



// EL�̔��ɓT�^�I�ȑ��M3 ������^�C�v
EL.sendString = function( ip, string ) {
	// ���M����
	EL.sendBase( ip, new Buffer( EL.toHexArray(string) ) );
};


//////////////////////////////////////////////////////////////////////
// EL��M
//////////////////////////////////////////////////////////////////////

// EL�̎�M�f�[�^��U�蕪�����C���Ƃ����悤
EL.returner = function( bytes, rinfo, userfunc ) {
   // console.log( "EL.returner:EL.parseBytes.");

	var elstructure = EL.parseBytes( bytes );

	try{
		console.log( "EL.returner:selection.");

		// �L�`���ƃp�[�X�ł������H
		if( null == elstructure ) {
			// App.println( 1, "EL.returner:EL.parseBytes is null.");
			return;
		}

		// �w�b�_�m�F
		if( elstructure.EHD != '1081' ) {
			// App.println( 1, "bytes is not EL. Reseive data is:" );
			// App.print( 1, bytes );
			return;
		}

		// Ver 1.0�ŃT�[�`�iINF_REQ�j���ꂽ
		if( elstructure.SEOJ == '05ff01' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '6301d500' ) {
			// App.println( 3, "EL.returner:Ver1.0 INF_REQ.");
			EL.sendOPC1( '224.0.23.0', [0x0e, 0xf0], [0x05, 0xff], 0x73, 0xd5, [EL_obj.length].concat(Array.prototype.concat.apply([], EL_obj)) );
		}
		// Ver 1.1�ŃT�[�`�iGet�j���ꂽ
		else if( elstructure.SEOJ == '05ff01' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '6201d600' ) {
			// App.println( 3, "EL.returner:Ver1.1 GET.");
			EL.sendOPC1( rinfo.address, [0x0e, 0xf0], [0x05, 0xff], 0x72, 0xd6, [EL_obj.length].concat(Array.prototype.concat.apply([], EL_obj)) );
		}
		// �d���̏�Ԃ�Get�Ή�����
		else if( elstructure.SEOJ == '05ff01' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '62018000' ) {
			EL.sendOPC1( rinfo.address, [0x0e, 0xf0], [0x05, 0xff], 0x72, 0x80, [0x30] );  // EL ver 1.1����
		}
		// ���@��̏�Ԃ�m�邽�߂�
		// node profile�������オ������C�I�u�W�F�N�g���X�g�����炢�ɍs��
		else if( elstructure.SEOJ == '0ef001' && elstructure.DEOJ == '0ef001' && elstructure.EDATA == '7401800130' ) {
			EL.sendOPC1( rinfo.address, [0x05, 0xff], [0x0e, 0xf0], 0x62, 0xd5, [0x00] );
		}
		// �I�u�W�F�N�g���X�g�����������I�u�W�F�N�g�̓d����Ԃ��m�F�������DEL ver1.1 d5, EL ver 1.0 D6
		else if( ( elstructure.DEOJ == '0ef001' || elstructure.DEOJ == '05ff01' ) && (elstructure.DETAIL.substr(0, 2) == 'd5' || elstructure.DETAIL.substr(0, 2) == 'd6') ) {
			var msg = "1081000005ff01" + elstructure.SEOJ + "62018000";
			EL.sendString( rinfo.address, msg );
		}
		// SetC�ɑ΂���ԓ���SetRes�́CEDT 0x00��OK�̈Ӗ����󂯎�邱�ƂƂȂ�D�䂦�ɂ��̏ڍׂȒl��Get����K�v������
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
// EL�C��ʂ̒ʐM�葱��
//////////////////////////////////////////////////////////////////////

// �@�팟��
EL.search = function() {
	EL.sendOPC1( EL.EL_Multi, [0x05,0xff], [0x0e, 0xf0], 0x62, 0xD6, [0x00] );
};



// �l�b�g���[�N����EL�@��S�̏����X�V����
EL.renewFacilities = function( ip, obj, opc, detail ) {
	try {
		epcList = EL.parseDetail( opc, detail );

		// �V�KIP
		if( EL.facilities[ ip ] == null ) {
			EL.facilities[ ip ] = {};
		}

		// �V�Kobj
		if( EL.facilities[ ip ][ obj ] == null ) {
			EL.facilities[ ip ][ obj ] = {};
		}

		for( var epc in epcList ) {

			// �V�Kepc
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
