//////////////////////////////////////////////////////////////////////
//	$Date:: 2016-06-06 10:02:22 +0900#$
//	$Rev: 9703 $
//	Copyright (C) Hiroshi SUGIMURA 2013.09.27 - above.
//////////////////////////////////////////////////////////////////////
// UDP����
var dgram = require('dgram');


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
  EL_obj: null,
  EL_cls: null,
  Node_details:	{
	  "80": [0x30],
	  "82": [0x01, 0x0a, 0x01, 0x00], // EL version, 1.1
	  "83": [0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // identifier
	  "8a": [0x00, 0x00, 0x77], // maker code
	  "9d": [0x02, 0x80, 0xd5],       // inf map, 1 Byte�ڂ͌�
	  "9e": [0x00],                 // set map, 1 Byte�ڂ͌�
	  "9f": [0x09, 0x80, 0x82, 0x83, 0x8a, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7], // get map, 1 Byte�ڂ͌�
	  "d3": [0x00, 0x00, 0x01],  // ���m�[�h�ŕێ�����C���X�^���X���X�g�̑����i�m�[�h�v���t�@�C���܂܂Ȃ��j, user����
	  "d4": [0x00, 0x02],        // ���m�[�h�N���X��, user����
	  "d5": [],    // �C���X�^���X���X�g�ʒm, user����
	  "d6": [],    // ���m�[�h�C���X�^���X���X�gS, user����
	  "d7": [] },  // ���m�[�h�N���X���X�gS, user����
  debugMode: false,
  facilities: {}  	// �l�b�g���[�N���̋@���񃊃X�g
	// �f�[�^�`���̗�
	// { '192.168.0.3': { '05ff01': { d6: '' } },
	// '192.168.0.4': { '05ff01': { '80': '30', '82': '30' } } }
};


// �������C�o�C���h
EL.initialize = function ( objList, userfunc ) {

	// �I�u�W�F�N�g���X�g���m��
	EL.EL_obj = objList;

	// �N���X���X�g�ɂ���
	var classes = objList.map( function(e) {	// �N���X�����ɂ�����
		return e.substr(0,4);
	});
	var classList = classes.filter( function (x, i, self) {		// �d���폜
		return self.indexOf(x) === i;
	});
	EL.EL_cls = classList;

	// �C���X�^���X���
	EL.Node_details["d3"] = [ 0x00, 0x00, EL.EL_obj.length]; // D3�̓m�[�h�v���t�@�C������Ȃ��C�ő�253�ł́H�Ȃ�3Byte�Ȃ̂��H
	var v = EL.EL_obj.map( function( elem ){
		return EL.toHexArray( elem );
	});
	v.unshift( EL.EL_obj.length );
	EL.Node_details["d5"] = Array.prototype.concat.apply([], v);  // D5, D6�����ł悢�D�m�[�h�v���t�@�C������Ȃ��D
	EL.Node_details["d6"] = EL.Node_details["d5"];

	// �N���X���
	EL.Node_details["d4"] = [ 0x00, EL.EL_cls.length + 1]; // D4�����Ȃ����m�[�h�v���t�@�C������D
	v = EL.EL_cls.map( function( elem ){
		return EL.toHexArray( elem );
	});
	v.unshift( EL.EL_cls.length );
	EL.Node_details["d7"] = Array.prototype.concat.apply([], v);  // D7�̓m�[�h�v���t�@�C������Ȃ�

	// EL�󂯎��悤��UDP
	var sock = dgram.createSocket("udp4", function (msg, rinfo) {
		EL.returner( msg, rinfo, userfunc );
	});

	// �}���`�L���X�g�ݒ�
	sock.bind( EL.EL_port, '0.0.0.0', function() {
		sock.setMulticastLoopback( true );
		sock.addMembership( EL.EL_Multi );
		// console.log( "EL_port bind OK!" );
	});


	// �������I������̂Ńm�[�h��INF������
	EL.sendOPC1( '224.0.23.0', [0x0e,0xf0,0x01], [0x0e,0xf0,0x01], 0x73, 0xd5, EL.Node_details["d5"] );

	return sock;
};


//////////////////////////////////////////////////////////////////////
// eldata ������C�\���֌W
//////////////////////////////////////////////////////////////////////

// ELDATA�`��
EL.eldataShow = function( eldata ) {
	if( eldata != null ) {
		console.log( 'EHD: ' + eldata.EHD + 'TID: ' +eldata.TID + 'SEOJ: ' + eldata.SEOJ + 'DEOJ: ' + eldata.DEOJ + '\nEDATA: ' + eldata.EDATA );
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

// Detail������parse����C�����Ŏ�Ɏg��
EL.parseDetail = function( opc, str ) {

	try {
		var ret = {}; // �߂�l�p�C�A�z�z��
		var now = 0;  // ���݂�Index
		var epc = 0;
		var pdc = 0;
		var edt = [];
		var array = EL.toHexArray( str );  // edts

		// OPC���[�v
		for( var i = 0; i< opc; i += 1 ) {
			// EPC�i�@�\�j
			epc = array[now];
			now++;

			// PDC�iEDT�̃o�C�g���j
			pdc = array[now];
			now++;

			// get�̎��� pdc��0�Ȃ̂łȂɂ����Ȃ��C0�łȂ���Βl�������Ă���
			if( pdc == 0 ) {
				ret[ EL.toHexString(epc) ] = "";
			} else {
				// PDC���[�v
				for( var j = 0; j < pdc; j += 1 ) {
					// �o�^
					edt.push( array[now] );
					now++;
				}
				ret[ EL.toHexString(epc) ] = EL.bytesToString( edt );
			}

		}  // opc���[�v

	} catch (e) {
		console.log('parse detail error. detail string is ');
		console.dir(str);
		console.error(e);
		return {};
	}

	return ret;
};


// �o�C�g�f�[�^��������ELDATA�`���ɂ���
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

	// ������ɂ����̂ŁCparseString�ŉ��Ƃ�����
	return ( EL.parseString(str) );
};


// 16�i���ŕ\�����ꂽ�������������ELDATA�`���ɂ���
EL.parseString = function( str ) {

	var eldata = {
		'EHD'    : str.substr( 0, 4 ),
		'TID'    : str.substr( 4, 4 ),
		'SEOJ'   : str.substr( 8, 6 ),
		'DEOJ'   : str.substr( 14, 6 ),
		'EDATA'  : str.substr( 20 ),    // ���L��EDATA�̏ڍ�
		'ESV'    : str.substr( 20, 2 ),
		'OPC'    : str.substr( 22, 2 ),
		'DETAIL' : str.substr( 24 ),
		'DETAILs': EL.parseDetail( str.substr( 22, 2 ), str.substr( 24 ) )
	};

	return ( eldata );
};


// �������������EL�炵���؂����String�𓾂�
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
		console.trace();
		return '';
	}
};


// ELDATA��������EL�炵���؂����String�𓾂�
EL.getSeparatedString_ELDATA = function( eldata ) {
	return ( eldata.EHD + ' ' + eldata.TID + ' ' + eldata.SEOJ + ' ' + eldata.DEOJ + ' ' + eldata.EDATA );
};


// ELDATA�`������z���
EL.ELDATA2Array = function( eldata ) {
	var ret = EL.toHexArray( eldata.EHD + eldata.TID + eldata.SEOJ + eldata.DEOJ + eldata.EDATA );
	return ret;
};

// 1�o�C�g�𕶎����16�i�\���ցi1Byte�͕K��2�����ɂ���j
EL.toHexString = function( byte ) {
	// ������0���Ȃ��āC��납��2�������X���C�X����
	return ( ("0" + byte.toString(16)).slice(-2) );
};

// 16�i�\���̕�����𐔒l�̃o�C�g�z���
EL.toHexArray = function( string ) {

	var ret = [];

	for( i=0; i < string.length; i += 2 ) {

		l = string.substr( i, 1 );
		r = string.substr( i+1, 1 );

		ret.push( (parseInt(l, 16) * 16) + parseInt(r, 16) );
	}

	return ret;
};


// �o�C�g�z��𕶎���ɂ�����
EL.bytesToString = function(bytes) {
	var ret = "";

	for(var i=0; i<bytes.length; i++) {
		ret += EL.toHexString( bytes[i] );
	}
	return ret;
};


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

	var els = EL.parseBytes( bytes );

	try{
		// �L�`���ƃp�[�X�ł������H
		if( null == els ) {
			return;
		}

		// �w�b�_�m�F
		if( els.EHD != '1081' ) {
			return;
		}

		// Node profile�Ɋւ��Ă�����Ə�������
		if( els.DEOJ == '0ef000' || els.DEOJ == '0ef001' ) {

			switch( els.ESV ) {
				////////////////////////////////////////////////////////////////////////////////////
				// 0x5x
				// �G���[�󂯎�����Ƃ��̏���
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
					if( EL.Node_details[epc] ) { // �����Ă�EPC�̂Ƃ�
						EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x72, EL.toHexArray(epc), EL.Node_details[epc] );
					} else { // �����Ă��Ȃ�EPC�̂Ƃ�, SNA
						EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x52, EL.toHexArray(epc), [0x00] );
					}
				}
				break;

			  case EL.INFREQ: // 0x63
				if( els.DETAILs["d5"] == "00" ) {
					// console.log( "EL.returner: Ver1.0 INF_REQ.");
					EL.sendOPC1( '224.0.23.0', [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x73, 0xd5, EL.Node_details["d5"] );
				}
				break;

			  case EL.SETGET: // "6e"
				break;

				////////////////////////////////////////////////////////////////////////////////////
				// 0x7x
			  case EL.SET_RES: // 71
				// SetC�ɑ΂���ԓ���SetRes�́CEDT 0x00��OK�̈Ӗ����󂯎�邱�ƂƂȂ�D�䂦�ɂ��̏ڍׂȒl��Get����K�v������
				if(els.DETAIL.substr(0,2) == '00' ) {
					var msg = "1081000005ff01" + els.SEOJ + "6201" + els.DETAIL.substr(0,2) + "00";
					EL.sendString( rinfo.address, msg );
				}
				break;

			  case EL.GET_RES: // 72
				// V1.1
				// d6��EDT�\�����ƂĂ�����CEDT1�o�C�g�ڂ��C���X�^���X���ɂȂ��Ă���
				if( els.DETAILs.d6 != null && els.DETAILs.d6 != '' ) {
					// console.log( "EL.returner: get object list! PropertyMap req V1.0.");
					// �v���p�e�B�}�b�v�ɏ����Ă���I�u�W�F�N�g�̃v���p�e�B�}�b�v�����炤
					var array = EL.toHexArray( els.DETAILs.d6 );
					var instNum = array[0];
					while( 0 < instNum ) {
						EL.getPropertyMaps( rinfo.address, array.slice( (instNum - 1)*3 +1, (instNum - 1)*3 +4 ) );
						instNum -= 1;
					}
				}else if( els.DETAILs["9f"] != null ) {
					var array = EL.toHexArray( els.DETAILs["9f"] );
					if( array.length < 16 ) { // �v���p�e�B�}�b�v16�o�C�g�����͋L�q�`���P
						var num = array[0];
						for( var i=0; i<num; i++ ) {
							// ���̂Ƃ�9f���܂����ɍs���Ɩ������[�v�Ȃ̂ł�߂�
							if( array[i+1] != 0x9f ) {
								EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x62, array[i+1], [0x00] );
							}
						}
					} else {
						// 16�o�C�g�ȏ�Ȃ̂ŋL�q�`��2�CEPC��array����蒼������C���Ɠ���
						var array = EL.parseMapForm2( els.DETAILs["9f"] );
						var num = array[0];
						for( var i=0; i<num; i++ ) {
							// ���̂Ƃ�9f���܂����ɍs���Ɩ������[�v�Ȃ̂ł�߂�
							if( array[i+1] != 0x9f ) {
								EL.sendOPC1( rinfo.address, [0x0e, 0xf0, 0x01], EL.toHexArray(els.SEOJ), 0x62, array[i+1], [0x00] );
							}
						}
					}
				}
				break;

			  case EL.INF:  // 0x73
				// V1.0 �I�u�W�F�N�g���X�g����������炻�̃I�u�W�F�N�g��PropertyMap�����炢�ɍs��, �f�o�C�X����ŋN������
				if( els.DETAILs.d5 != null && els.DETAILs.d5 != "" ) {
					// �m�[�h�v���t�@�C���I�u�W�F�N�g�̃v���p�e�B�}�b�v�����炤
					EL.getPropertyMaps( rinfo.address, [0x0e, 0xf0, 0x00] );
				}
				break;

			  case EL.INFC: // "74"
				// V1.0 �I�u�W�F�N�g���X�g����������炻�̃I�u�W�F�N�g��PropertyMap�����炢�ɍs��
				if( els.DETAILs.d5 != null && els.DETAILs.d5 ) {
					// �m�[�h�v���t�@�C���I�u�W�F�N�g�̃v���p�e�B�}�b�v�����炤
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

		// ��M��Ԃ���@����C��, GET��INFREQ�͏���
		if( els.ESV != "62" && els.ESV != "63" ) {
			EL.renewFacilities( rinfo.address, els );
		}

		// �@��I�u�W�F�N�g�Ɋւ��Ă̓��[�U�[�֐��ɔC��
		userfunc( rinfo, els );
	} catch(e) {
		console.error("EL.returner error.");
		console.trace();
		console.dir(e);
		console.dir( els );
	}

};


// �l�b�g���[�N����EL�@��S�̏����X�V����C��M�����珟��Ɏ��s�����
EL.renewFacilities = function( ip, els ) {
	try {
		epcList = EL.parseDetail( els.OPC, els.DETAIL );

		// �V�KIP
		if( EL.facilities[ ip ] == null ) { //������Ȃ�
			EL.facilities[ ip ] = {};
		}

		// �V�Kobj
		if( EL.facilities[ ip ][ els.SEOJ ] == null ) {
			EL.facilities[ ip ][ els.SEOJ ] = {};
			// �V�K�I�u�W�F�N�g�̂Ƃ��C�v���p�e�B���X�g���炨��
			EL.getPropertyMaps( ip, EL.toHexArray(els.SEOJ) );
		}

		for( var epc in epcList ) {
			// �V�Kepc
			if( EL.facilities[ ip ][ els.SEOJ ][ epc ] == null ) {
				EL.facilities[ ip ][ els.SEOJ ][ epc ] = {};
			}

			EL.facilities[ ip ][ els.SEOJ ][ epc ] = epcList[ epc ];
		}
	}catch(e) {
		console.error("EL.renewFacilities error.");
		console.dir(e);
	}
};




//////////////////////////////////////////////////////////////////////
// EL�C��ʂ̒ʐM�葱��
//////////////////////////////////////////////////////////////////////

// �@�팟��
EL.search = function() {
	EL.sendOPC1( EL.EL_Multi, [0x0e,0xf0, 0x01], [0x0e, 0xf0, 0x00], 0x62, 0xD6, [0x00] );  // ���ׂăm�[�h�ɑ΂��āC���ׂĂ�EOJ��Get����
};


// �v���p�e�B�}�b�v�����ׂĎ擾����
EL.getPropertyMaps = function ( ip, eoj ) {
	EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9D, [0x00] );  // INF prop
	EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9E, [0x00] );  // SET prop
	EL.sendOPC1( ip, [0x0e,0xf0,0x01], eoj, 0x62, 0x9F, [0x00] );  // GET prop
};


// parse Propaty Map Form 2
// 16�ȏ�̃v���p�e�B���̎��C�L�q�`��2�C�o�͂�Form1�ɂ��邱��
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
