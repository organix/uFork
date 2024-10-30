(
    Base word dictionary for uCode
)

: PANIC! FAIL PANIC! ;      ( if BOOT returns... )
: TODO 0x00AF , PANIC! ;    ( alternative HALT... )

0x03 CONSTANT ^C
0x08 CONSTANT '\b'
0x09 CONSTANT '\t'
0x0A CONSTANT '\n'
0x0D CONSTANT '\r'
0x20 CONSTANT BL
0x30 CONSTANT '0'
0x39 CONSTANT '9'
0x37 CONSTANT A-10
0x41 CONSTANT 'A'
0x46 CONSTANT 'F'
0x5A CONSTANT 'Z'
0x61 CONSTANT 'a'
0x66 CONSTANT 'f'
0x7A CONSTANT 'z'
0x7F CONSTANT DEL

: @EXECUTE
    @                       ( fallthrough to next definition )
: EXECUTE
    0x0FFF AND >R
: (EXIT)
    EXIT
: ?: ( altn cnsq cond -- cnsq | altn )
    SKZ SWAP
: (DROP)
    DROP ;
: NIP ( a b -- b )
    SWAP DROP ;
: TUCK ( a b -- b a b )
    SWAP OVER ;
: 2DUP ( a b -- a b a b )
    OVER OVER ;
: 2DROP ( a b -- )
    DROP DROP ;
: DATA ( -- pc+1 )
    R> EXIT

: ABS ( n -- +n )
    DUP MSB& IF
        NEGATE
    THEN ;
: BOOL ( truthy -- bool )
    IF TRUE ;               ( optimize early exit )
    THEN FALSE ;
: = ( a b -- a==b )
    XOR
: 0= ( n -- n==0 )
: NOT ( truthy -- !bool )
    IF FALSE ;
    THEN TRUE ;
: <> ( a b -- a!=b )
    = INVERT ;
: 0> ( n -- n>0 )
    NEGATE
: 0< ( n -- n<0 )
    MSB& BOOL ;
: > ( a b -- a>b )
    SWAP
: < ( a b -- a<b )
    - 0< ;
: >= ( a b -- a>=b )
    < INVERT ;
: <= ( a b -- a<=b )
    > INVERT ;
: MAX ( a b -- a | b )
    2DUP < ?: ;
: MIN ( a b -- a | b )
    2DUP > ?: ;
: @1+ ( addr -- )
    DUP @ 1+ SWAP ! ;
: @1- ( addr -- )
    DUP @ 1- SWAP ! ;
: J ( -- j ) ( R: j i -- j i )
    R> R@ SWAP >R ;
: JMPTBL ( index -- )
    R>                      ( D: index table )
    2DUP @                  ( D: index table index limit )
    < IF                    ( D: index table )
        + 1+ @              ( D: table[index+1] )
    ELSE                    ( D: index table )
        DUP @               ( D: index table limit )
        + 1+                ( D: index table+limit+1 )
    THEN
    >R ;
: MEMCPY ( dst src count -- )
    ?LOOP-                  ( D: dst src ) ( R: count-1 )
        2DUP                ( D: dst src dst src )
        I + @               ( D: dst src dst data )
        SWAP I + !          ( D: dst src )
    AGAIN
    2DROP ;

: INBOUNDS ( n lo hi -- lo<=n&&n<=hi )
    -ROT OVER SWAP -
    -ROT - OR MSB& 0= ;
: ISDIGIT ( char -- bool )
    '0' '9' INBOUNDS ;
: ISUPPER ( char -- bool )
    'A' 'Z' INBOUNDS ;
: ISLOWER ( char -- bool )
    'a' 'z' INBOUNDS ;
: TOUPPER ( 'A' | 'a' -- 'A' )
    DUP ISLOWER IF
        BL XOR  ( flip case )
    THEN ;
: TOLOWER ( 'A' | 'a' -- 'a' )
    DUP ISUPPER IF
        BL XOR  ( flip case )
    THEN ;
: ISHEX ( char -- bool )
    DUP 'A' 'F' INBOUNDS
    OVER 'a' 'f' INBOUNDS OR
    SWAP ISDIGIT OR ;
: TOHEX ( n -- x )
    0xF AND
    DUP 10 < IF
        '0'
    ELSE
        A-10
    THEN + ;
: FROMHEX ( x -- n )
    TOUPPER
    DUP 'A' < IF
        '0'
    ELSE
        A-10
    THEN - ;

: TX? ( -- ready )
: EMIT?
    0x00 IO@ ;
: SPACE ( -- )
    BL
: EMIT ( char -- )
    BEGIN TX? UNTIL
: TX! ( char -- )
    0x01 IO! ;
: RX? ( -- ready )
: KEY?
    0x02 IO@ ;
: KEY ( -- char )
    BEGIN RX? UNTIL
: RX@ ( -- char )
    0x03 IO@ ;
: SPACES ( n -- )
    ?LOOP-
        SPACE
    AGAIN ;
: CR ( -- )
    '\r' EMIT '\n' EMIT ;
: ECHO ( char -- )
    DUP EMIT
    '\r' = IF
        '\n' EMIT
    THEN ;
: X# ( n -- )
    TOHEX EMIT ;
: X. ( n -- )
    4 ?LOOP-
        4ROL DUP X#
    AGAIN DROP ;

( uFork Virtual Machine )
: rom_image DATA
: rsvd_rom
(    T        X        Y        Z       ADDR: VALUE )
0x0000 , 0x0000 , 0x0000 , 0x0000 ,  ( ^0000: #? )
0x0000 , 0x0000 , 0x0000 , 0x0000 ,  ( ^0001: #nil )
0x0000 , 0x0000 , 0x0000 , 0x0000 ,  ( ^0002: #f )
0x0000 , 0x0000 , 0x0000 , 0x0000 ,  ( ^0003: #t )
0x0000 , 0x0000 , 0x0000 , 0x0000 ,  ( ^0004: --reserved-- )
0x000c , 0x0001 , 0x0001 , 0x0000 ,  ( ^0005: EMPTY_DQ )
0x0006 , 0x8001 , 0x0000 , 0x0000 ,  ( ^0006: #type_t )
0x0006 , 0x0000 , 0x0000 , 0x0000 ,  ( ^0007: #fixnum_t )
0x0006 , 0x8002 , 0x0000 , 0x0000 ,  ( ^0008: #actor_t )
0x0006 , 0x8002 , 0x0000 , 0x0000 ,  ( ^0009: PROXY_T )
0x0006 , 0x8002 , 0x0000 , 0x0000 ,  ( ^000a: STUB_T )
0x0006 , 0x8003 , 0x0000 , 0x0000 ,  ( ^000b: #instr_t )
0x0006 , 0x8002 , 0x0000 , 0x0000 ,  ( ^000c: #pair_t )
0x0006 , 0x8003 , 0x0000 , 0x0000 ,  ( ^000d: #dict_t )
0x0006 , 0xffff , 0x0000 , 0x0000 ,  ( ^000e: FWD_REF_T )
0x0006 , 0x8000 , 0x0000 , 0x0000 ,  ( ^000f: FREE_T )
: boot_rom
(    T        X        Y        Z       ADDR )
0x000b , 0x8002 , 0x802a , 0x0026 ,  ( ^0010 )
0x000b , 0x8016 , 0x8000 , 0x002b ,  ( ^0011 )
0x000b , 0x8011 , 0x8000 , 0x002c ,  ( ^0012 )
0x000b , 0x8012 , 0x8001 , 0x0048 ,  ( ^0013 )
0x000b , 0x8002 , 0x0018 , 0x0056 ,  ( ^0014 )
0x000b , 0x8002 , 0x8003 , 0x0078 ,  ( ^0015 )
0x000b , 0x8002 , 0x0001 , 0x009b ,  ( ^0016 )
0x000b , 0x8002 , 0x8006 , 0x00a8 ,  ( ^0017 )
0x000c , 0x8111 , 0x0019 , 0x0000 ,  ( ^0018 )
0x000c , 0x8222 , 0x001a , 0x0000 ,  ( ^0019 )
0x000c , 0x8333 , 0x0001 , 0x0000 ,  ( ^001a )
0x000b , 0x8000 , 0x0000 , 0x00ae ,  ( ^001b )
0x000b , 0x8018 , 0x8000 , 0x00b2 ,  ( ^001c )
0x000b , 0x8018 , 0x8002 , 0x00b4 ,  ( ^001d )
0x000b , 0x8018 , 0x8000 , 0x00c9 ,  ( ^001e )
0x000b , 0x8019 , 0x8002 , 0x00cc ,  ( ^001f )
0x000b , 0x8002 , 0xfffd , 0x00cf ,  ( ^0020 )
0x000b , 0x8018 , 0x8000 , 0x00d3 ,  ( ^0021 )
0x000b , 0x8018 , 0x8001 , 0x0023 ,  ( ^0022 )
0x000b , 0x801a , 0xffff , 0x0024 ,  ( ^0023 )
0x000b , 0x800f , 0x8001 , 0x0000 ,  ( ^0024 )
0x000b , 0x800f , 0x8000 , 0x0000 ,  ( ^0025 )
0x000b , 0x8018 , 0x8000 , 0x0027 ,  ( ^0026 )
0x000b , 0x800c , 0x8000 , 0x0028 ,  ( ^0027 )
0x000b , 0x8002 , 0x0011 , 0x0029 ,  ( ^0028 )
0x000b , 0x801d , 0x8002 , 0x002a ,  ( ^0029 )
0x000b , 0x8007 , 0x802a , 0x0012 ,  ( ^002a )
0x000b , 0x8012 , 0x8000 , 0x0024 ,  ( ^002b )
0x000b , 0x8007 , 0x0001 , 0x002d ,  ( ^002c )
0x000b , 0x8002 , 0x8003 , 0x002e ,  ( ^002d )
0x000b , 0x8002 , 0x8002 , 0x002f ,  ( ^002e )
0x000b , 0x8011 , 0x8001 , 0x0030 ,  ( ^002f )
0x000b , 0x8002 , 0x8001 , 0x0031 ,  ( ^0030 )
0x000b , 0x8011 , 0x8001 , 0x0032 ,  ( ^0031 )
0x000b , 0x8012 , 0x8001 , 0x0033 ,  ( ^0032 )
0x000b , 0x8007 , 0x8001 , 0x0034 ,  ( ^0033 )
0x000b , 0x8016 , 0x8000 , 0x0035 ,  ( ^0034 )
0x000b , 0x8012 , 0x8001 , 0x0036 ,  ( ^0035 )
0x000b , 0x8007 , 0x8002 , 0x0037 ,  ( ^0036 )
0x000b , 0x8016 , 0x8001 , 0x0038 ,  ( ^0037 )
0x000b , 0x8012 , 0x8001 , 0x0039 ,  ( ^0038 )
0x000b , 0x8017 , 0x8001 , 0x003a ,  ( ^0039 )
0x000b , 0x8007 , 0x0000 , 0x003b ,  ( ^003a )
0x000b , 0x8017 , 0x8000 , 0x003c ,  ( ^003b )
0x000b , 0x8007 , 0x8003 , 0x003d ,  ( ^003c )
0x000b , 0x8012 , 0xffff , 0x003e ,  ( ^003d )
0x000b , 0x8007 , 0x0000 , 0x003f ,  ( ^003e )
0x000b , 0x8002 , 0x0001 , 0x0040 ,  ( ^003f )
0x000b , 0x8012 , 0xffff , 0x0041 ,  ( ^0040 )
0x000b , 0x8007 , 0x0000 , 0x0042 ,  ( ^0041 )
0x000b , 0x8002 , 0x0001 , 0x0043 ,  ( ^0042 )
0x000b , 0x8002 , 0x8001 , 0x0044 ,  ( ^0043 )
0x000b , 0x8011 , 0x8001 , 0x0045 ,  ( ^0044 )
0x000b , 0x8012 , 0xffff , 0x0046 ,  ( ^0045 )
0x000b , 0x8007 , 0x8001 , 0x0047 ,  ( ^0046 )
0x000b , 0x8007 , 0x0000 , 0x0013 ,  ( ^0047 )
0x000b , 0x8017 , 0x8001 , 0x0049 ,  ( ^0048 )
0x000b , 0x8003 , 0x0025 , 0x004a ,  ( ^0049 )
0x000b , 0x8002 , 0x8000 , 0x004b ,  ( ^004a )
0x000b , 0x8006 , 0x8000 , 0x004c ,  ( ^004b )
0x000b , 0x8003 , 0x004d , 0x0025 ,  ( ^004c )
0x000b , 0x8002 , 0xffff , 0x004e ,  ( ^004d )
0x000b , 0x8006 , 0x8000 , 0x004f ,  ( ^004e )
0x000b , 0x8003 , 0x0025 , 0x0050 ,  ( ^004f )
0x000b , 0x8002 , 0x0001 , 0x0051 ,  ( ^0050 )
0x000b , 0x8003 , 0x0025 , 0x0052 ,  ( ^0051 )
0x000b , 0x8002 , 0x0004 , 0x0053 ,  ( ^0052 )
0x000b , 0x8003 , 0x0054 , 0x0025 ,  ( ^0053 )
0x000b , 0x8002 , 0x8000 , 0x0055 ,  ( ^0054 )
0x000b , 0x8003 , 0x0025 , 0x0014 ,  ( ^0055 )
0x000b , 0x8012 , 0x8001 , 0x0057 ,  ( ^0056 )
0x000b , 0x8007 , 0x8111 , 0x0058 ,  ( ^0057 )
0x000b , 0x8012 , 0x8001 , 0x0059 ,  ( ^0058 )
0x000b , 0x8007 , 0x8222 , 0x005a ,  ( ^0059 )
0x000b , 0x8012 , 0x8001 , 0x005b ,  ( ^005a )
0x000b , 0x8007 , 0x8333 , 0x005c ,  ( ^005b )
0x000b , 0x8007 , 0x0001 , 0x005d ,  ( ^005c )
0x000b , 0x8002 , 0x0018 , 0x005e ,  ( ^005d )
0x000b , 0x8013 , 0x8000 , 0x005f ,  ( ^005e )
0x000b , 0x8007 , 0x0018 , 0x0060 ,  ( ^005f )
0x000b , 0x8002 , 0x0018 , 0x0061 ,  ( ^0060 )
0x000b , 0x8013 , 0x8001 , 0x0062 ,  ( ^0061 )
0x000b , 0x8007 , 0x8111 , 0x0063 ,  ( ^0062 )
0x000b , 0x8002 , 0x0018 , 0x0064 ,  ( ^0063 )
0x000b , 0x8013 , 0xffff , 0x0065 ,  ( ^0064 )
0x000b , 0x8007 , 0x0019 , 0x0066 ,  ( ^0065 )
0x000b , 0x8002 , 0x0018 , 0x0067 ,  ( ^0066 )
0x000b , 0x8013 , 0x8002 , 0x0068 ,  ( ^0067 )
0x000b , 0x8007 , 0x8222 , 0x0069 ,  ( ^0068 )
0x000b , 0x8002 , 0x0018 , 0x006a ,  ( ^0069 )
0x000b , 0x8013 , 0xfffe , 0x006b ,  ( ^006a )
0x000b , 0x8007 , 0x001a , 0x006c ,  ( ^006b )
0x000b , 0x8002 , 0x0018 , 0x006d ,  ( ^006c )
0x000b , 0x8013 , 0x8003 , 0x006e ,  ( ^006d )
0x000b , 0x8007 , 0x8333 , 0x006f ,  ( ^006e )
0x000b , 0x8002 , 0x0018 , 0x0070 ,  ( ^006f )
0x000b , 0x8013 , 0xfffd , 0x0071 ,  ( ^0070 )
0x000b , 0x8007 , 0x0001 , 0x0072 ,  ( ^0071 )
0x000b , 0x8002 , 0x0018 , 0x0073 ,  ( ^0072 )
0x000b , 0x8013 , 0x8004 , 0x0074 ,  ( ^0073 )
0x000b , 0x8007 , 0x0000 , 0x0075 ,  ( ^0074 )
0x000b , 0x8002 , 0x0018 , 0x0076 ,  ( ^0075 )
0x000b , 0x8013 , 0xfffc , 0x0077 ,  ( ^0076 )
0x000b , 0x8007 , 0x0000 , 0x0015 ,  ( ^0077 )
0x000b , 0x8002 , 0x8002 , 0x0079 ,  ( ^0078 )
0x000b , 0x8002 , 0x8001 , 0x007a ,  ( ^0079 )
0x000b , 0x8014 , 0x8000 , 0x007b ,  ( ^007a )
0x000b , 0x8007 , 0x0000 , 0x007c ,  ( ^007b )
0x000b , 0x8014 , 0x8001 , 0x007d ,  ( ^007c )
0x000b , 0x8007 , 0x8001 , 0x007e ,  ( ^007d )
0x000b , 0x8014 , 0xffff , 0x007f ,  ( ^007e )
0x000b , 0x8007 , 0x8001 , 0x0080 ,  ( ^007f )
0x000b , 0x8014 , 0x8002 , 0x0081 ,  ( ^0080 )
0x000b , 0x8007 , 0x8002 , 0x0082 ,  ( ^0081 )
0x000b , 0x8014 , 0xfffe , 0x0083 ,  ( ^0082 )
0x000b , 0x8007 , 0x8001 , 0x0084 ,  ( ^0083 )
0x000b , 0x8015 , 0x8000 , 0x0085 ,  ( ^0084 )
0x000b , 0x8016 , 0x8001 , 0x0086 ,  ( ^0085 )
0x000b , 0x8007 , 0x8002 , 0x0087 ,  ( ^0086 )
0x000b , 0x8015 , 0x8001 , 0x0088 ,  ( ^0087 )
0x000b , 0x8016 , 0x8001 , 0x0089 ,  ( ^0088 )
0x000b , 0x8007 , 0x8002 , 0x008a ,  ( ^0089 )
0x000b , 0x8015 , 0xffff , 0x008b ,  ( ^008a )
0x000b , 0x8016 , 0x8001 , 0x008c ,  ( ^008b )
0x000b , 0x8007 , 0x8002 , 0x008d ,  ( ^008c )
0x000b , 0x8015 , 0x8002 , 0x008e ,  ( ^008d )
0x000b , 0x8016 , 0x8001 , 0x008f ,  ( ^008e )
0x000b , 0x8007 , 0x8001 , 0x0090 ,  ( ^008f )
0x000b , 0x8015 , 0xfffd , 0x0091 ,  ( ^0090 )
0x000b , 0x8007 , 0x8002 , 0x0092 ,  ( ^0091 )
0x000b , 0x8014 , 0x8003 , 0x0093 ,  ( ^0092 )
0x000b , 0x8007 , 0x0000 , 0x0094 ,  ( ^0093 )
0x000b , 0x8015 , 0x8003 , 0x0095 ,  ( ^0094 )
0x000b , 0x8007 , 0x0000 , 0x0096 ,  ( ^0095 )
0x000b , 0x8007 , 0x8003 , 0x0097 ,  ( ^0096 )
0x000b , 0x8014 , 0x8003 , 0x0098 ,  ( ^0097 )
0x000b , 0x8007 , 0x0000 , 0x0099 ,  ( ^0098 )
0x000b , 0x8015 , 0xfffe , 0x009a ,  ( ^0099 )
0x000b , 0x8007 , 0x0000 , 0x0016 ,  ( ^009a )
0x000b , 0x8002 , 0x0000 , 0x009c ,  ( ^009b )
0x000b , 0x8002 , 0x001c , 0x009d ,  ( ^009c )
0x000b , 0x801c , 0xffff , 0x009e ,  ( ^009d )
0x000b , 0x8011 , 0x8001 , 0x009f ,  ( ^009e )
0x000b , 0x8002 , 0x0020 , 0x00a0 ,  ( ^009f )
0x000b , 0x801c , 0xffff , 0x00a1 ,  ( ^00a0 )
0x000b , 0x8002 , 0x0003 , 0x00a2 ,  ( ^00a1 )
0x000b , 0x8014 , 0x8002 , 0x00a3 ,  ( ^00a2 )
0x000b , 0x801a , 0xffff , 0x00a4 ,  ( ^00a3 )
0x000b , 0x8002 , 0x0002 , 0x00a5 ,  ( ^00a4 )
0x000b , 0x8014 , 0x8002 , 0x00a6 ,  ( ^00a5 )
0x000b , 0x801a , 0xffff , 0x00a7 ,  ( ^00a6 )
0x000b , 0x8017 , 0x8001 , 0x0017 ,  ( ^00a7 )
0x000b , 0x8002 , 0x8008 , 0x00a9 ,  ( ^00a8 )
0x000b , 0x8002 , 0x001b , 0x00aa ,  ( ^00a9 )
0x000b , 0x801c , 0x8001 , 0x00ab ,  ( ^00aa )
0x000b , 0x8002 , 0x001d , 0x00ac ,  ( ^00ab )
0x000b , 0x801c , 0x8000 , 0x00ad ,  ( ^00ac )
0x000b , 0x801a , 0x8002 , 0x0024 ,  ( ^00ad )
0x000b , 0x8019 , 0x8001 , 0x00af ,  ( ^00ae )
0x000b , 0x8018 , 0x8000 , 0x00b0 ,  ( ^00af )
0x000b , 0x800e , 0x8000 , 0x00b1 ,  ( ^00b0 )
0x000b , 0x8007 , 0x0003 , 0x0024 ,  ( ^00b1 )
0x000b , 0x8002 , 0x001c , 0x00b3 ,  ( ^00b2 )
0x000b , 0x801d , 0xffff , 0x0024 ,  ( ^00b3 )
0x000b , 0x8016 , 0x8001 , 0x00b5 ,  ( ^00b4 )
0x000b , 0x8002 , 0x8002 , 0x00b6 ,  ( ^00b5 )
0x000b , 0x800e , 0x8003 , 0x00b7 ,  ( ^00b6 )
0x000b , 0x8003 , 0x0022 , 0x00b8 ,  ( ^00b7 )
0x000b , 0x8018 , 0x8001 , 0x00b9 ,  ( ^00b8 )
0x000b , 0x8002 , 0x001e , 0x00ba ,  ( ^00b9 )
0x000b , 0x801c , 0xffff , 0x00bb ,  ( ^00ba )
0x000b , 0x8014 , 0x8002 , 0x00bc ,  ( ^00bb )
0x000b , 0x8002 , 0x8001 , 0x00bd ,  ( ^00bc )
0x000b , 0x800d , 0x8005 , 0x00be ,  ( ^00bd )
0x000b , 0x8014 , 0x8002 , 0x00bf ,  ( ^00be )
0x000b , 0x8002 , 0x001d , 0x00c0 ,  ( ^00bf )
0x000b , 0x801c , 0x8000 , 0x00c1 ,  ( ^00c0 )
0x000b , 0x801a , 0x8002 , 0x00c2 ,  ( ^00c1 )
0x000b , 0x8015 , 0x8002 , 0x00c3 ,  ( ^00c2 )
0x000b , 0x8002 , 0x8002 , 0x00c4 ,  ( ^00c3 )
0x000b , 0x800d , 0x8005 , 0x00c5 ,  ( ^00c4 )
0x000b , 0x8015 , 0x8002 , 0x00c6 ,  ( ^00c5 )
0x000b , 0x8002 , 0x001d , 0x00c7 ,  ( ^00c6 )
0x000b , 0x801c , 0x8000 , 0x00c8 ,  ( ^00c7 )
0x000b , 0x801a , 0x8002 , 0x0024 ,  ( ^00c8 )
0x000b , 0x8019 , 0x8000 , 0x00ca ,  ( ^00c9 )
0x000b , 0x8002 , 0x001f , 0x00cb ,  ( ^00ca )
0x000b , 0x801d , 0x8002 , 0x0024 ,  ( ^00cb )
0x000b , 0x8018 , 0x8000 , 0x00cd ,  ( ^00cc )
0x000b , 0x800d , 0x8004 , 0x00ce ,  ( ^00cd )
0x000b , 0x8019 , 0x8001 , 0x0023 ,  ( ^00ce )
0x000b , 0x8002 , 0xfffe , 0x00d0 ,  ( ^00cf )
0x000b , 0x8002 , 0xffff , 0x00d1 ,  ( ^00d0 )
0x000b , 0x8002 , 0x0024 , 0x00d2 ,  ( ^00d1 )
0x000b , 0x801d , 0x8000 , 0x0021 ,  ( ^00d2 )
0x000b , 0x8019 , 0x8001 , 0x0023 ,  ( ^00d3 )
( 848 cells, 212 quads )

( 0x0000 CONSTANT #?          ( undefined ) ... ucode.js )
( 0x0001 CONSTANT #nil        ( empty list ) ... ucode.js )
0x0002 CONSTANT #f          ( boolean false )
0x0003 CONSTANT #t          ( boolean true )
( 0x0004 CONSTANT ROM_04      ( --reserved-- ) )
0x0005 CONSTANT EMPTY_DQ    ( empty deque )
0x0006 CONSTANT #type_t     ( type of types )
0x0007 CONSTANT #fixnum_t   ( integer fixnum )
0x0008 CONSTANT #actor_t    ( actor address )
0x0009 CONSTANT PROXY_T     ( outbound proxy )
0x000A CONSTANT STUB_T      ( inbound stub )
0x000B CONSTANT #instr_t    ( machine code )
0x000C CONSTANT #pair_t     ( pair/cons-cell )
0x000D CONSTANT #dict_t     ( name/value binding )
0x000E CONSTANT FWD_REF_T   ( GC "broken heart" )
0x000F CONSTANT FREE_T      ( GC free quad )

0x8003 CONSTANT #3          ( fixnum three )
0x8002 CONSTANT #2          ( fixnum two )
0x8001 CONSTANT #1          ( fixnum one )
( : #0                        ( fixnum zero ) ... ucode.js )
0x8000 CONSTANT E_OK        ( not an error )
( : #-1                       ( fixnum negative one ) ... ucode.js )
0xFFFF CONSTANT E_FAIL      ( general failure )
: #-2                       ( fixnum negative two )
0xFFFE CONSTANT E_BOUNDS    ( out of bounds )
: #-3                       ( fixnum negative three )
0xFFFD CONSTANT E_NO_MEM    ( no memory available )
0xFFFC CONSTANT E_NOT_FIX   ( fixnum required )
0xFFFB CONSTANT E_NOT_CAP   ( capability required )
0xFFFA CONSTANT E_NOT_PTR   ( memory pointer required )
0xFFF9 CONSTANT E_NOT_ROM   ( ROM pointer required )
0xFFF8 CONSTANT E_NOT_RAM   ( RAM pointer required )
0xFFF7 CONSTANT E_NOT_EXE   ( instruction required )
0xFFF6 CONSTANT E_NO_TYPE   ( type required )
0xFFF5 CONSTANT E_MEM_LIM   ( Sponsor memory limit reached )
0xFFF4 CONSTANT E_CPU_LIM   ( Sponsor instruction limit reached )
0xFFF3 CONSTANT E_MSG_LIM   ( Sponsor event limit reached )
0xFFF2 CONSTANT E_ASSERT    ( assertion failed )
0xFFF1 CONSTANT E_STOP      ( actor stopped )

: invalid ( -- )
    E_FAIL
: disrupt ( reason -- )
    FAIL disrupt ;

( : is_fix ( raw -- truthy )
    MSB& ; ... ucode.js )
: is_cap ( raw -- bool )
    0xE000 AND 0x6000 = ;
: is_ptr ( raw -- bool )
    0xA000 AND 0= ;         ( is_ram or is_rom )
: is_ram ( raw -- bool )
    0xE000 AND 0x4000 = ;   ( excludes ocaps )
: is_rom ( raw -- bool )
    0xC000 AND 0= ;

( : int2fix ( n -- #n )
    MSB| ; ... ucode.js )
: fix2int ( #n -- n )
    ROL ASR ;
: ptr2cap ( ptr -- cap )
    0x2000 OR ;
: cap2ptr ( cap -- ptr )
    0xDFFF AND ;

0x4000 CONSTANT mem_desc    ( quad-memory descriptor )
0x4001 CONSTANT ek_queues   ( event/continuation queues )
0x400F CONSTANT root_spn    ( root sponsor )
0x4010 CONSTANT ram_base    ( first allocatable RAM address )

: mem_top@ ( -- data )
    mem_desc QT@ ;
: mem_next@ ( -- data )
    mem_desc QX@ ;
: mem_free@ ( -- data )
    mem_desc QY@ ;
: mem_root@ ( -- data )
    mem_desc QZ@ ;
: mem_next! ( data -- )
    mem_desc QX! ;
: mem_free! ( data -- )
    mem_desc QY! ;

: e_head@ ( -- data )
    ek_queues QT@ ;
: e_tail@ ( -- data )
    ek_queues QX@ ;
: k_head@ ( -- data )
    ek_queues QY@ ;
: k_tail@ ( -- data )
    ek_queues QZ@ ;

: spn_memory@ ( sponsor -- data )
    QT@ ;
: spn_events@ ( sponsor -- data )
    QX@ ;
: spn_cycles@ ( sponsor -- data )
    QY@ ;
: spn_signal@ ( sponsor -- data )
    QZ@ ;

( 2-bit gc color markings )
0x0 CONSTANT gc_free_color
0x1 CONSTANT gc_genx_color
0x2 CONSTANT gc_geny_color
0x3 CONSTANT gc_scan_color
VARIABLE gc_curr_gen        ( currently active gc generation {x, y} )
VARIABLE gc_prev_gen        ( previously active gc generation {y, x} )
VARIABLE gc_phase           ( current phase in gc state-machine )
VARIABLE gc_scan_ptr        ( scan-list processing pointer )

( FIXME: re-use rom_image until we have dedicated space for gc colors )
: gc_color@ ( qref -- color )
    rom_image + @ ;
: gc_set_color ( qref color -- )
    SWAP
: gc_color! ( color qref -- )
    rom_image + ! ;

: gc_init ( -- )
    ( loop to set reserved RAM to gc_free_color )
    gc_free_color 16 ?LOOP-
        DUP I gc_color!
    AGAIN DROP
    gc_genx_color gc_curr_gen !
    gc_geny_color gc_prev_gen ! ;

: gc_gen_swap ( -- )
    gc_curr_gen @ gc_prev_gen @
    gc_curr_gen ! gc_prev_gen ! ;

: gc_valid ( qref -- addr in_heap )
    cap2ptr DUP is_ram ;
: gc_scan ( qref -- )
    gc_valid IF             ( D: addr )
        ( mark quad to-be-scanned )
        DUP gc_color@ gc_prev_gen @ = IF
            DUP gc_scan_ptr @ < IF
                DUP gc_scan_ptr !
            THEN
            gc_scan_color gc_set_color ;
        THEN
    THEN DROP ;
: gc_mark ( qref -- )
    gc_valid IF             ( D: addr )
        ( mark quad in-use )
        DUP gc_curr_gen @ gc_set_color
        gc_phase @ 2 = IF
            DUP QT@ gc_scan
            DUP QX@ gc_scan
            DUP QY@ gc_scan
            DUP QZ@ gc_scan
        THEN
    THEN DROP ;
: gc_free ( qref -- )
    gc_valid IF             ( D: addr )
        ( mark quad in free-list )
        gc_free_color gc_set_color ;
    THEN DROP ;

: release ( qref -- )
    cap2ptr DUP gc_free
    FREE_T OVER QT!
    ( #? OVER QX! #? OVER QY! )
    mem_next@ OVER QZ! mem_next!
    mem_free@ 1+ mem_free! ;

: gc_phase_0 ( -- )
    EXIT

: gc_phase_1 ( -- )
    gc_gen_swap
    mem_root@ gc_scan
    e_head@ gc_scan
    k_head@ gc_scan
    root_spn spn_signal@ gc_scan
    ram_base gc_scan_ptr !  ( start after reserved RAM )
    2 gc_phase ! ;

: gc_phase_2 ( -- )
    gc_scan_ptr @           ( D: addr )
    DUP mem_top@ < IF
        DUP gc_color@ gc_scan_color = IF
            gc_mark ;
        THEN
        1+ gc_scan_ptr ! ;
    THEN DROP
    3 gc_phase ! ;

: gc_phase_3 ( -- )
    gc_scan_ptr @ 1-        ( D: addr )
    DUP gc_scan_ptr !
    DUP ram_base >= IF
        DUP gc_color@ gc_prev_gen @ = IF
            release ;
        THEN DROP ;
    THEN DROP
    0 gc_phase ! ;

: gc_step ( -- )
    gc_phase @
    JMPTBL 4 ,
    gc_phase_0              ( idle phase )
    gc_phase_1              ( prep phase )
    gc_phase_2              ( mark phase )
    gc_phase_3              ( sweep phase )
    DROP                    ( default )
    0 gc_phase ! ;

: gc_increment ( -- )
    ( incremental garbage-collection )
    gc_phase @ 0= IF
        1 gc_phase ! ;
    THEN
    16 ?LOOP-               ( 16 steps per increment )
        gc_step
    AGAIN ;

: gc_collect ( -- )
    ( stop-the-world garbage-collection )
    1 gc_phase !
    BEGIN
        gc_step
        gc_phase @ 0=
    UNTIL ;

: wr_mark ( value qref -- value qref )
    OVER gc_mark ;
: qt! ( value qref -- )
    DUP is_ram IF
        wr_mark QT! ;
    THEN disrupt ;
: qx! ( value qref -- )
    DUP is_ram IF
        wr_mark QX! ;
    THEN disrupt ;
: qy! ( value qref -- )
    DUP is_ram IF
        wr_mark QY! ;
    THEN disrupt ;
: qz! ( value qref -- )
    DUP is_ram IF
        wr_mark QZ! ;
    THEN disrupt ;

: mem_top! ( data -- )
    mem_desc QT! ;
: mem_root! ( data -- )
    mem_desc qz! ;

: e_head! ( data -- )
    ek_queues QT! ;
: e_tail! ( data -- )
    ek_queues qx! ;
: k_head! ( data -- )
    ek_queues QY! ;
: k_tail! ( data -- )
    ek_queues qz! ;

: spn_memory! ( data sponsor -- )
    QT! ;
: spn_events! ( data sponsor -- )
    QX! ;
: spn_cycles! ( data sponsor -- )
    QY! ;
: spn_signal! ( data sponsor -- )
    qz! ;

: event_enqueue ( event -- )
    #nil OVER QZ!
    e_head@ is_ram IF
        DUP e_tail@ QZ!
    ELSE
        DUP e_head!
    THEN
    e_tail! ;
: event_dequeue ( -- event | #nil )
    e_head@ DUP is_ram IF
        DUP QZ@             ( D: event next )
        DUP e_head!
        is_ram NOT IF
            #nil e_tail!
        THEN                ( D: event )
    THEN ;

: cont_enqueue ( cont -- )
    #nil OVER QZ!
    k_head@ is_ram IF
        DUP k_tail@ QZ!
    ELSE
        DUP k_head!
    THEN
    k_tail! ;
: cont_dequeue ( -- cont | #nil )
    k_head@ DUP is_ram IF
        DUP QZ@             ( D: cont next )
        DUP k_head!
        is_ram NOT IF
            #nil k_tail!
        THEN                ( D: cont )
    THEN ;

: ip@
    k_head@ QT@ ;
: sp@
    k_head@ QX@ ;
: ep@
    k_head@ QY@ ;
: kp@
    k_head@ QZ@ ;
: ip!
    k_head@ qt! ;
: sp!
    k_head@ qx! ;
: ep!
    k_head@ qy! ;

: op@
    ip@ QX@ ;
: imm@
    ip@ QY@ ;
: k@
    ip@ QZ@ ;

: sponsor@
    ep@ QT@ ;
: self@
    ep@ QX@ ;
: msg@
    ep@ QY@ ;

: reserve ( -- qref )
    mem_next@ DUP #nil XOR IF
        mem_free@ 1- mem_free!
        DUP QZ@ mem_next! ;
    THEN DROP
    mem_top@ DUP 0x5000 < IF
        DUP 1+ mem_top! ;
    THEN
    E_NO_MEM disrupt ;
: 0alloc ( T -- qref )
    reserve >R              ( D: T ) ( R: qref )
    R@ QT!                  ( D: ) ( R: qref )
    #? R@ QX!               ( D: ) ( R: qref )
: _clear2
    #? R@ QY!               ( D: ) ( R: qref )
: _clear1
    #? R@ QZ!               ( D: ) ( R: qref )
: _clear0
    R> DUP gc_mark ;        ( D: qref ) ( R: )
: 1alloc ( X T -- qref )
    reserve >R              ( D: X T ) ( R: qref )
    R@ QT!                  ( D: X ) ( R: qref )
    R@ QX!                  ( D: ) ( R: qref )
    _clear2 ;
: 2alloc ( Y X T -- qref )
    reserve >R              ( D: Y X T ) ( R: qref )
    R@ QT!                  ( D: Y X ) ( R: qref )
    R@ QX!                  ( D: Y ) ( R: qref )
    R@ QY!                  ( D: ) ( R: qref )
    _clear1 ;
: 3alloc ( Z Y X T -- qref )
    reserve >R              ( D: Z Y X T ) ( R: qref )
    R@ QT!                  ( D: Z Y X ) ( R: qref )
    R@ QX!                  ( D: Z Y ) ( R: qref )
    R@ QY!                  ( D: Z ) ( R: qref )
    R@ QZ!                  ( D: ) ( R: qref )
    _clear0 ;

: is_pair ( raw -- bool )
    DUP is_ptr IF
        QT@ #pair_t = ;
    THEN DROP FALSE ;
: typeq ( raw typ -- truthy )
    DUP #fixnum_t = IF
        DROP is_fix ;
    THEN
    DUP #actor_t = IF
        DROP is_cap ;
    THEN
    2DUP SWAP QT@ = IF
        PROXY_T = IF        ( D: raw )
            is_cap ;
        THEN
        is_ptr ;
    THEN
    2DROP FALSE ;

: pair ( rest first -- pair )
    #pair_t 2alloc ;
: part ( pair -- rest first )
    DUP is_pair IF
        DUP QY@ SWAP QX@ ;
    THEN DROP #? DUP ;
: first ( pair -- first )
    DUP is_pair IF
        QX@ ;
    THEN DROP #? ;
: rest ( pair -- rest )
    DUP is_pair IF
        QY@ ;
    THEN DROP #? ;

: n_rest ( pair n -- tail )
    ?LOOP-
        rest
    AGAIN ;
: nth ( pair n -- item | tail )
    DUP 0> IF
        1- n_rest first ;
    THEN
    ?LOOP+                  ( D: pair )
        rest
    AGAIN ;

: insert ( item prev -- )
    DUP is_pair IF          ( D: item prev )
        DUP rest            ( D: item prev next )
        ROT pair            ( D: prev (item . next) )
        SWAP qy! ;          ( D: -- )
    THEN 2DROP ;
(
To Insert item at prev:

    If prev is a #pair_t
        Let entry be cons(item, cdr(prev))
        Set prev.Y to entry
)

: extract ( next prev -- next )
    DUP is_pair IF
        OVER rest           ( D: next prev cdr(next) )
        SWAP qy! ;          ( D: next )
    THEN DROP ;
(
To Extract next from prev:

    If prev is a #pair_t
        Set prev.Y to cdr(next)
)

: enlist ( head n -- rest list )
    DUP 0> IF
        OVER SWAP 1-        ( D: list head n-1 )
        n_rest              ( D: list last )
        DUP is_pair IF
            DUP QY@ -ROT    ( D: rest list last )
            #nil SWAP QY! ; ( D: rest list )
        THEN
        DROP #nil SWAP ;    ( D: #nil list )
    THEN                    ( D: head n )
    DROP #nil ;             ( D: head #nil )
(
To Enlist fixnum:n as list:

    If n > 0
        Let list be the stack pointer
        Let p be list
        Advance p by n-1
        If p is a #pair_t
            Let the stack pointer become cdr(p)
            Set p.Y to #nil
        Otherwise
            Let the stack pointer become #nil
    Otherwise
        Let list be #nil
)

: reverse_onto ( head list -- head' )
    ( WARNING! this is a destructive in-place operation )
    BEGIN                   ( D: head list )
        DUP is_pair
    WHILE
        DUP QY@             ( D: head list next )
        -ROT                ( D: next head list )
        TUCK                ( D: next list head list )
        qy!                 ( D: next list )
        SWAP                ( D: list next )
    REPEAT                  ( D: head' list' )
    DROP ;                  ( D: head' )
(
To Reverse list onto head:

    While list is a #pair_t
        Let next be cdr(list)
        Set list.Y to head
        Let head become list
        Let list become next
)

: pair_onto ( head list -- head' list' )
    part                ( D: head rest first )
    SWAP -ROT           ( D: rest head first )
    pair                ( D: rest (first . head) )
    SWAP ;              ( D: (first . head) rest )
: copy_onto ( head list -- head' )
    BEGIN                   ( D: head list )
        DUP is_pair
    WHILE
        pair_onto           ( D: head' list' )
    REPEAT
    DROP ;                  ( D: head' )
(
To Copy list onto head:

    While list is a #pair_t
        Let head be cons(car(list), head)
        Let list become cdr(list)
)

: n_copy_onto ( head list n -- head' list' )
    ?LOOP-
        pair_onto           ( D: head' list' )
    AGAIN ;
(
To Copy fixnum:n of list onto head:

    While n > 0
        Let head be cons(car(list), head)
        Let list become cdr(list)
        Let n become n-1
)

: nil_result ( -- ip' )
    sp@ #nil
: push_result ( sp' result -- ip' )
    pair
: update_sp ( sp' -- ip' )
    sp! k@ ;
: undef_result ( -- ip' )
    sp@ #? push_result ;
: rplc_result ( sp result -- ip' )
    OVER DUP is_ram IF      ( D: sp result sp )
        qx!                 ( WARNING! stack modified in-place )
    ELSE
        2DROP
    THEN                    ( D: sp )
    update_sp ;

: op_end ( -- ip' | error )
    imm@ #1 = IF
        self@ DUP QZ@       ( D: self effect )
        DUP QZ@             ( D: self effect events )
        BEGIN               ( D: self effect events )
            DUP is_ram
        WHILE               ( D: self effect events )
            DUP QZ@         ( D: self effect event events' )
            SWAP event_enqueue
        REPEAT              ( D: self effect events )
        DROP SWAP cap2ptr   ( D: effect ^self )
        OVER QX@ OVER qx!   ( update code )
        OVER QY@ OVER qy!   ( update data )
        #? SWAP qz!         ( make actor ready )
        release             ( free effect )
        #? ;                ( end continuation )
    THEN
    imm@ #0 = IF
        E_STOP ;
    THEN
    E_BOUNDS ;

: op_push ( -- ip' | error )
    sp@ imm@                ( D: sp item )
    push_result ;

: op_assert ( -- ip' | error )
    sp@ part                ( D: rest first )
    imm@ = IF               ( D: rest )
        update_sp ;
    THEN
    E_ASSERT ;

: peek_1arg ( -- sp tos )
    sp@ DUP QX@ ;
: uf_bool ( truthy -- #t | #f )
    IF #t ELSE #f THEN ;
: cmp_result ( sp truthy -- ip' )
    uf_bool rplc_result ;
: op_eq ( -- ip' | error )
    peek_1arg               ( D: sp value )
    imm@ = cmp_result ;

: peek_2args ( -- sp' nos tos )
    sp@ part                ( D: sp' tos )
    OVER QX@                ( D: sp' tos nos )
    SWAP ;
: 2fix_args ( -- sp' #n #m 2is_fix )
    peek_2args              ( D: sp' #n #m )
    OVER is_fix OVER is_fix AND ;
: 2fix2int ( #n #m -- n m )
    SWAP fix2int            ( D: #m n )
    SWAP fix2int ;          ( D: n m )
: 2not_fix ( sp' #n #m -- ip' )
    2DROP #? rplc_result ;
: cmp_eq                    ( D: )
    peek_2args = cmp_result ;
: cmp_ne                    ( D: )
    peek_2args XOR cmp_result ;
: cmp_lt                    ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        < cmp_result ;
    THEN
    2not_fix ;
: cmp_le                    ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        <= cmp_result ;
    THEN
    2not_fix ;
: cmp_ge                    ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        >= cmp_result ;
    THEN
    2not_fix ;
: cmp_gt                    ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        > cmp_result ;
    THEN
    2not_fix ;
: op_cmp ( -- ip' | error )
    imm@ DUP is_fix IF
        fix2int             ( imm )
        JMPTBL 0x6 ,
        cmp_eq              ( 0000: eq )
        cmp_ge              ( 0001: ge )
        cmp_gt              ( 0002: gt )
        cmp_lt              ( 0003: lt )
        cmp_le              ( 0004: le )
        cmp_ne              ( 0005: ne )
        DROP E_BOUNDS ;     ( default case )
    THEN
    E_NOT_FIX ;

: if_truthy                 ( D: sp' )
    sp! imm@ ;              ( continue true )
: op_if ( -- ip' | error )
    sp@ part                ( sp cond )
    JMPTBL 4 ,
    update_sp               ( ^0000: #? )
    update_sp               ( ^0001: #nil )
    update_sp               ( ^0002: #f )
    if_truthy               ( ^0003: #t )
    #0 XOR IF               ( default case )
        if_truthy ;
    THEN
    update_sp ;

: op_typeq ( -- ip' | error )
    peek_1arg imm@          ( D: sp value type )
    DUP #type_t typeq IF
        typeq uf_bool       ( D: sp uf_bool )
        rplc_result ;
    THEN
    E_NO_TYPE ;

: capture_stack             ( D: )
    #nil sp@ push_result ;
: op_pair ( -- ip' | error )
    imm@ DUP is_fix IF
        fix2int DUP 0> IF
            sp@ SWAP        ( D: sp +n )
            1- n_rest       ( D: prev )
            DUP is_ram IF
                DUP QY@     ( D: prev last )
                DUP is_ram IF
                    DUP QX@ ( D: prev last tail )
                    ROT     ( D: last tail prev )
                    qy!     ( D: last )
                    sp@     ( D: last list )
                    OVER    ( D: last list last )
                    qx!     ( D: last )
                    update_sp ;
                THEN DROP
            THEN DROP
            capture_stack ;
        THEN                ( D: n )
        DUP 0= IF
            DROP k@ ;       ( no effect )
        THEN
        DUP -1 = IF
            DROP capture_stack ;
        THEN
        DROP undef_result ;
    THEN
    E_NOT_FIX ;

: op_part ( -- ip' | error )
    imm@ DUP is_fix IF
        fix2int DUP 0> IF
            sp@ part        ( D: n sp' list )
            ROT             ( D: sp' list n )
            #nil -ROT       ( D: sp' copy=#nil list n )
            n_copy_onto     ( D: sp' copy' list' )
            ROT SWAP        ( D: copy' sp' list' )
            pair SWAP       ( D: sp'' copy' )
            reverse_onto    ( D: sp''' )
            update_sp ;
        THEN                ( D: n )
        DUP 0= IF
            DROP k@ ;       ( no effect )
        THEN
        DUP -1 = IF
            DROP sp@ part   ( D: sp' list )
            #nil SWAP       ( D: sp' copy=#nil list )
            copy_onto       ( D: sp' copy' )
            reverse_onto    ( D: sp'' )
            update_sp ;
        THEN
        DROP undef_result ;
    THEN
    E_NOT_FIX ;

: op_nth ( -- ip' | error )
    sp@ part imm@           ( D: sp' pair #n )
: nth_result
    DUP is_fix IF           ( D: sp' pair #n )
        fix2int nth push_result ;
    THEN
    E_NOT_FIX ;

: op_drop ( -- ip' | error )
    sp@ imm@ DUP is_fix IF  ( D: sp #n )
        fix2int             ( D: sp n )
        DUP MSB& IF         ( D: sp -n )
            2DROP k@ ;
        THEN
        ?LOOP-
            rest            ( D: sp' )
        AGAIN
        update_sp ;
    THEN
    E_NOT_FIX ;

: op_dup ( -- ip' | error )
    imm@ #1 = IF
        sp@ DUP first       ( D: sp tos )
        push_result ;
    THEN
    imm@ fix2int 1 > IF     ( TODO: implement n > 1 )
        E_BOUNDS ;
    THEN
    k@ ;                    ( no-op )

: op_pick ( -- ip' | error )
    imm@ #0 = IF
        undef_result ;
    THEN
    imm@ DUP is_fix IF      ( D: #n )
        fix2int DUP MSB& IF ( D: -n )
            sp@ TUCK first  ( D: sp -n item )
            -ROT 1+ nth     ( D: item prev )
            insert k@ ;
        THEN                ( D: +n )
        sp@ DUP             ( D: +n sp sp )
        ROT nth             ( D: sp item )
        push_result ;
    THEN
    E_NOT_FIX ;

: op_roll ( -- ip' | error )
    imm@ DUP is_fix IF      ( D: #n )
        fix2int DUP MSB& IF ( D: -n )
            NEGATE 1-       ( D: n-1 )
            DUP 0> IF       ( D: n-1 )
                sp@ part    ( D: n-1 sp' item )
                >R          ( D: n-1 sp' ) ( R: item )
                TUCK        ( D: sp' n-1 sp' ) ( R: item )
                SWAP 1-     ( D: sp' sp' n-2 ) ( R: item )
                n_rest      ( D: sp' prev ) ( R: item )
                R> SWAP     ( D: sp' item prev )
                insert      ( D: sp' )
                update_sp ;
            THEN
        ELSE                ( D: +n )
            1- DUP 0> IF    ( D: n-1 )
                1- sp@      ( D: n-2 sp )
                SWAP n_rest ( D: prev )
                DUP rest    ( D: prev next )
                SWAP        ( D: next prev )
                extract sp@ ( D: next sp )
                SWAP first  ( D: sp item )
                push_result ;
            THEN
        THEN                ( D: n )
        DROP k@ ;           ( no-op )
    THEN
    E_NOT_FIX ;

: alu_result ( sp n -- ip' )
    int2fix rplc_result ;
: alu_not                   ( D: )
    peek_1arg               ( D: sp #n )
    DUP is_fix IF
        fix2int             ( D: sp n )
        INVERT alu_result ;
    THEN
    DROP #? rplc_result ;
: alu_and                   ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        AND alu_result ;
    THEN
    2not_fix ;
: alu_or                    ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        OR alu_result ;
    THEN
    2not_fix ;
: alu_xor                   ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        XOR alu_result ;
    THEN
    2not_fix ;
: alu_add                   ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        + alu_result ;
    THEN
    2not_fix ;
: alu_sub                   ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        - alu_result ;
    THEN
    2not_fix ;
: alu_mul                   ( D: )
    2fix_args IF            ( D: sp' #n #m )
        2fix2int            ( D: sp' n m )
        * alu_result ;
    THEN
    2not_fix ;
: op_alu ( -- ip' | error )
    imm@ DUP is_fix IF
        fix2int             ( imm )
        JMPTBL 0xD ,
        alu_not             ( 0000: not )
        alu_and             ( 0001: and )
        alu_or              ( 0002: or )
        alu_xor             ( 0003: xor )
        alu_add             ( 0004: add )
        alu_sub             ( 0005: sub )
        alu_mul             ( 0006: mul )
        E_BOUNDS            ( 0007: -reserved- )
        E_BOUNDS            ( 0008: lsl )
        E_BOUNDS            ( 0009: lsr )
        E_BOUNDS            ( 000A: asr )
        E_BOUNDS            ( 000B: rol )
        E_BOUNDS            ( 000C: ror )
        DROP E_BOUNDS ;     ( default case )
    THEN
    E_NOT_FIX ;

: quad_ZYXT ( sp quad -- ip' )
    SWAP OVER QZ@           ( D: quad sp Z )
    pair SWAP               ( D: sp' quad )
: quad_YXT ( sp quad -- ip' )
    SWAP OVER QY@           ( D: quad sp Y )
    pair SWAP               ( D: sp' quad )
: quad_XT ( sp quad -- ip' )
    SWAP OVER QX@           ( D: quad sp X )
    pair SWAP               ( D: sp' quad )
: quad_T ( sp quad -- ip' )
    QT@ pair update_sp ;    ( D: ip' )
: quad_1 ( sp' -- ip' ) ( R: T -- )
    R> 0alloc push_result ;
: quad_2 ( sp' -- ip' ) ( R: T -- )
    part R>                 ( D: sp'' X T )
    1alloc push_result ;
: quad_3 ( sp' -- ip' ) ( R: T -- )
    part >R                 ( D: sp'' ) ( R: T X )
    part                    ( D: sp''' Y ) ( R: T X )
    R> R>                   ( D: sp''' Y X T )
    2alloc push_result ;
: quad_4 ( sp' -- ip' ) ( R: T -- )
    part >R                 ( D: sp'' ) ( R: T X )
    part >R                 ( D: sp''' ) ( R: T X Y )
    part                    ( D: sp'''' Z ) ( R: T X Y )
    R> R> R>                ( D: sp'''' Z Y X T )
    3alloc push_result ;
: op_quad ( -- ip' | error )
    imm@ DUP is_fix IF
        fix2int DUP MSB& IF ( D: -n )
            sp@ part        ( D: -n sp' quad )
            ROT ABS 1-      ( D: sp' quad index )
            JMPTBL 0x4 ,
            quad_T
            quad_XT
            quad_YXT
            quad_ZYXT
            2DROP           ( default case )
            #? push_result ;
        THEN                ( D: +n )
        sp@ part            ( D: +n sp' T )
        DUP #type_t typeq IF
            ROT 1-          ( D: sp' T arity )
            2DUP int2fix    ( D: sp' T arity T #a )
            SWAP QX@        ( D: sp' T arity #a #A )
            = IF            ( D: sp' T arity )
                SWAP >R     ( D: sp' arity ) ( R: T )
                JMPTBL 0x4 ,
                quad_1
                quad_2
                quad_3
                quad_4
                R> 2DROP    ( default case )
                #? push_result ;
            THEN
            2DROP           ( D: sp' )
            #? push_result ;
        THEN
        ROT 2DROP           ( D: sp' )
        #? push_result ;
    THEN
    DROP undef_result ;

(
: nil_result ( -- ip' )
    sp@ #nil
: push_result ( sp' result -- ip' )
    pair
: update_sp ( sp' -- ip' )
    sp! k@ ;
)

: dict_has                  ( D: )
    sp@ part                ( D: sp' key )
    >R part                 ( D: sp'' dict ) ( R: key )
: dict_has_search
    DUP QT@                 ( D: sp'' dict type ) ( R: key )
    #dict_t = IF            ( D: sp'' dict ) ( R: key )
        DUP QX@             ( D: sp'' dict key' ) ( R: key )
        R@ = IF             ( D: sp'' dict ) ( R: key )
            R> 2DROP        ( D: sp'' )
            #t push_result ;
        THEN                ( D: sp'' dict ) ( R: key )
        QZ@                 ( D: sp'' next' ) ( R: key )
        dict_has_search ;
    THEN                    ( D: sp'' dict ) ( R: key )
    R> 2DROP                ( D: sp'' )
    #f push_result ;

: dict_get                  ( D: )
    sp@ part                ( D: sp' key )
    >R part                 ( D: sp'' dict ) ( R: key )
: dict_get_search
    DUP QT@                 ( D: sp'' dict type ) ( R: key )
    #dict_t = IF            ( D: sp'' dict ) ( R: key )
        DUP QX@             ( D: sp'' dict key' ) ( R: key )
        R@ = IF             ( D: sp'' dict ) ( R: key )
            R> DROP QY@     ( D: sp'' value' )
            push_result ;
        THEN                ( D: sp'' dict ) ( R: key )
        QZ@                 ( D: sp'' next' ) ( R: key )
        dict_get_search ;
    THEN                    ( D: sp'' dict ) ( R: key )
    R> 2DROP                ( D: sp'' )
    #? push_result ;

: dict_add                  ( D: )
    sp@ part >R             ( D: sp' ) ( R: value )
    part >R                 ( D: sp'' ) ( R: value key )
    part R> R> SWAP         ( D: sp''' dict key ) ( R: value )
    R> SWAP                 ( D: sp''' dict value key ) ( R: )
    #dict_t 3alloc          ( D: [#dict_t, key, value, dict] )
    push_result ;

: dict_set                  ( D: )
    E_BOUNDS ;
: dict_del                  ( D: )
    E_BOUNDS ;
: op_dict ( -- ip' | error )
    imm@ DUP is_fix IF
        fix2int             ( imm )
        JMPTBL 5 ,
        dict_has            ( 0: has )
        dict_get            ( 1: get )
        dict_add            ( 2: add )
        dict_set            ( 3: set )
        dict_del            ( 4: del )
        DROP E_BOUNDS ;     ( default case )
    THEN
    E_NOT_FIX ;

(
    #dict_t operations...

has:                        ; ( dict key k -- bool )
    roll -3                 ; k dict key
    roll 2                  ; k key dict
has_search:                 ; k key dict
    quad -4                 ; k key next value' key' type
    eq #dict_t              ; k key next value' key' type==#dict_t
    if_not has_none         ; k key next value' key'
    pick 4                  ; k key next value' key' key
    cmp eq                  ; k key next value' key'==key
    if has_found            ; k key next value'
    drop 1                  ; k key dict=next
    ref has_search
has_found:                  ; k key next value'
    drop 3                  ; k
    ref std.return_t
has_none:                   ; k key next value' key'
    drop 4                  ; k
    ref std.return_f

get:                        ; ( dict key k -- value )
    roll -3                 ; k dict key
    roll 2                  ; k key dict
get_search:                 ; k key dict
    quad -4                 ; k key next value' key' type
    eq #dict_t              ; k key next value' key' type==#dict_t
    if_not get_none         ; k key next value' key'
    pick 4                  ; k key next value' key' key
    cmp eq                  ; k key next value' key'==key
    if get_found            ; k key next value'
    drop 1                  ; k key dict=next
    ref get_search
get_found:                  ; k key next value'
    roll -4                 ; value' k key next
    drop 2                  ; value' k
    return                  ; value'
get_none:                   ; k key next value' key'
    drop 4                  ; k
    ref std.return_undef

add:                        ; ( dict key value k -- dict' )
    roll -4                 ; k dict key value
add_tail:                   ; k dict key value
    roll 2                  ; k dict value key
    push #dict_t            ; k dict value key #dict_t
    quad 4                  ; k dict'
    ref std.return_value

set:                        ; ( dict key value k -- dict' )
    roll -4                 ; k dict key value
    roll 3                  ; k key value dict
    pick 3                  ; k key value dict key
    call del                ; k key value dict'
    roll -3                 ; k dict' key value
    ref add_tail

del:                        ; ( dict key k -- dict' )
    roll -3                 ; k dict key
    push #nil               ; k dict key rev=()
    pick 3                  ; k orig key rev dict
del_rev:
    quad -4                 ; k orig key rev next value' key' type
    eq #dict_t              ; k orig key rev next value' key' type==#dict_t
    if_not del_none         ; k orig key rev next value' key'
    dup 1                   ; k orig key rev next value' key' key'
    pick 6                  ; k orig key rev next value' key' key' key
    cmp eq                  ; k orig key rev next value' key' key'==key
    if del_found            ; k orig key rev next value' key'
    roll 4                  ; k orig key next value' key' rev
    roll -3                 ; k orig key next rev value' key'
    push #dict_t            ; k orig key next rev value' key' #dict_t
    quad 4                  ; k orig key next rev'
    roll 2                  ; k orig key rev' next
    ref del_rev
del_found:                  ; k orig key rev next value' key'
    roll 6                  ; k key rev next value' key' orig
    drop 3                  ; k key rev dict'=next
    roll 2                  ; k key dict' rev
del_copy:
    quad -4                 ; k key dict' next value' key' type'
    eq #dict_t              ; k key dict' next value' key' type'==#dict_t
    if_not del_done         ; k key dict' next value' key'
    roll 4                  ; k key next value' key' dict'
    roll -3                 ; k key next dict' value' key'
    push #dict_t            ; k key next dict' value' key' #dict_t
    quad 4                  ; k key next dict''
    roll 2                  ; k key dict'' next
    ref del_copy
del_done:                   ; k key dict' next value' key'
    drop 3                  ; k key dict'
    roll -3                 ; dict' k key
    drop 1                  ; dict' k
    return                  ; dict'
del_none:                   ; k orig key rev next value' key'
    drop 5                  ; k orig
    ref std.return_value
)

: common_actor_args ( -- sp' args tos TRUE | error FALSE )
    sp@ part imm@           ( D: sp' tos #n )
    DUP is_fix IF
        fix2int DUP MSB& IF ( D: sp' tos -n )
            DUP -1 = IF
                DROP SWAP   ( D: tos sp' )
                part ROT    ( D: sp'' args tos )
                TRUE ;
            THEN
            DUP -2 = IF
                DROP        ( D: sp' tos )
                DUP QY@     ( D: sp' tos args )
                SWAP QX@    ( D: sp' args tos' )
                TRUE ;
            THEN
            DUP -3 = IF
                DROP        ( D: sp' arg )
                DUP QZ@     ( D: sp' arg tos' )
                TRUE ;
            THEN
            E_BOUNDS FALSE ;
        THEN                ( D: sp' tos +n )
        ROT SWAP            ( D: tos sp' +n )
        enlist ROT          ( D: rest list tos )
        TRUE ;
    THEN
    E_NOT_FIX FALSE ;

: send_effect ( msg target sponsor -- )
    2alloc >R               ( D: ) ( R: event )
    self@ QZ@               ( D: effect ) ( R: event )
    DUP QZ@                 ( D: effect events ) ( R: event )
    R@ qz!                  ( D: effect ) ( R: events' )
    R> SWAP qz! ;           ( D: )
: op_send ( -- ip' | error )
    common_actor_args IF    ( D: sp' msg target )
        DUP is_cap IF
            sponsor@        ( D: sp' msg target sponsor )
            send_effect     ( D: sp' )
            update_sp ;
        THEN
        E_NOT_CAP ;
    THEN ;                  ( D: error )

: create_effect ( state beh -- actor )
    #actor_t 2alloc ptr2cap ;
: op_new ( -- ip' | error )
    common_actor_args IF    ( D: sp' data code )
        DUP #instr_t typeq IF
            create_effect   ( D: sp' actor )
            push_result ;
        THEN
        E_NOT_EXE ;
    THEN ;                  ( D: error )

: become_effect ( state beh -- )
    self@ QZ@ TUCK          ( D: state effect beh effect )
    qx! qy! ;               ( D: )
: op_beh ( -- ip' | error )
    common_actor_args IF    ( D: sp' data code )
        DUP #instr_t typeq IF
            become_effect   ( D: sp' )
            update_sp ;
        THEN
        E_NOT_EXE ;
    THEN ;                  ( D: error )

: actor_send ( sp -- ip' | error )
    part                    ( D: sp' target )
    DUP is_cap IF
        >R                  ( D: sp' ) ( R: target )
        part                ( D: sp'' msg ) ( R: target )
        R>                  ( D: sp'' msg target )
        sponsor@            ( D: sp'' msg target sponsor )
        send_effect         ( D: sp'' )
        update_sp ;
    THEN
    2DROP k@ ;
: actor_post ( sp -- ip' | error )
    part                    ( D: sp' target )
    DUP is_cap IF
        >R                  ( D: sp' ) ( R: target )
        part                ( D: sp'' msg ) ( R: target )
        R>                  ( D: sp'' msg target )
        ROT                 ( D: msg target sp'' )
        part                ( D: msg target sp''' sponsor )
        SWAP                ( D: msg target sponsor sp''' )
        >R                  ( D: msg target sponsor ) ( R: sp''' )
        send_effect         ( D: ) ( R: sp''' )
        R>                  ( D: sp''' )
        update_sp ;
    THEN
    2DROP k@ ;
: actor_create ( sp -- ip' | error )
    part                    ( D: sp' beh )
    DUP #instr_t typeq IF
        >R                  ( D: sp' ) ( R: beh )
        part                ( D: sp'' state ) ( R: beh )
        R>                  ( D: sp'' state beh )
        create_effect       ( D: sp'' actor )
        push_result ;
    THEN
    2DROP k@ ;
: actor_become ( sp -- ip' | error )
    part                    ( D: sp' beh )
    DUP #instr_t typeq IF
        >R                  ( D: sp' ) ( R: beh )
        part                ( D: sp'' state ) ( R: beh )
        R>                  ( D: sp'' state beh )
        become_effect       ( D: sp'' )
        update_sp ;
    THEN
    2DROP k@ ;
: op_actor ( -- ip' | error )
    sp@ imm@ DUP is_fix IF
        fix2int             ( imm )
        JMPTBL 4 ,
        actor_send          ( 0: send )
        actor_post          ( 1: post )
        actor_create        ( 2: create )
        actor_become        ( 3: become )
        DROP                ( default case )
    THEN
    update_sp ;

: op_my ( -- ip' | error )
    sp@ self@
    imm@ #0 = IF            ( D: sp self )
        push_result ;
    THEN
    imm@ #1 = IF            ( D: sp self )
        QX@ push_result ;
    THEN
    imm@ #2 = IF            ( D: sp self )
        2DROP               ( TODO: implement state spread onto stack )
    THEN
    E_BOUNDS ;

: op_msg ( -- ip' | error )
    sp@ msg@ imm@           ( D: sp msg #n )
    nth_result ;

: op_state ( -- ip' | error )
    sp@ self@ QY@ imm@      ( D: sp state #n )
    nth_result ;

: op_jump ( -- ip' | error )
    sp@ part                ( D: sp' k )
    DUP #instr_t typeq IF
        SWAP sp! ;          ( D: k )
    THEN
    E_NOT_EXE ;

: op_debug ( -- ip' | error )
    k@ ;                    ( no-op )

: perform_op ( opcode -- ip' | error )
    JMPTBL 32 ,
    op_debug                ( 0x8000: debug )
    op_jump                 ( 0x8001: jump )
    op_push                 ( 0x8002: push )
    op_if                   ( 0x8003: if )
    invalid                 ( 0x8004: --reserved-- )
    op_typeq                ( 0x8005: typeq )
    op_eq                   ( 0x8006: eq )
    op_assert               ( 0x8007: assert )

    invalid                 ( 0x8008: sponsor )
    op_actor                ( 0x8009: actor )
    invalid                 ( 0x800A: dict )
    invalid                 ( 0x800B: deque )
    op_my                   ( 0x800C: my )
    op_alu                  ( 0x800D: alu )
    op_cmp                  ( 0x800E: cmp )
    op_end                  ( 0x800F: end )

    op_quad                 ( 0x8010: quad )
    op_pair                 ( 0x8011: pair )
    op_part                 ( 0x8012: part )
    op_nth                  ( 0x8013: nth )
    op_pick                 ( 0x8014: pick )
    op_roll                 ( 0x8015: roll )
    op_dup                  ( 0x8016: dup )
    op_drop                 ( 0x8017: drop )

    op_msg                  ( 0x8018: msg )
    op_state                ( 0x8019: state )
    op_send                 ( 0x801A: send )
    invalid                 ( 0x801B: signal )
    op_new                  ( 0x801C: new )
    op_beh                  ( 0x801D: beh )
    invalid                 ( 0x801E: --reserved-- )
    invalid                 ( 0x801F: --reserved-- )

    DROP invalid ;          ( default case )

: dispatch_event ( -- )
    event_dequeue           ( D: event )
    DUP QX@ QZ@ IF          ( D: event )
        ( target busy )
        event_enqueue ;
    THEN                    ( D: event )
    #nil OVER qz!
    DUP QX@ >R              ( D: event ) ( R: target )
    #nil R@ QX@             ( D: ep sp ip ) ( R: target )
    2alloc                  ( D: cont ) ( R: target )
    #nil R@ QY@ R@ QX@      ( D: cont event data code ) ( R: target )
    #actor_t 3alloc         ( D: cont effect ) ( R: target )
    R> cap2ptr qz!          ( D: cont )
    cont_enqueue ;

VARIABLE run_limit          ( number of iterations remaining )
VARIABLE saved_sp           ( sp before instruction execution )
: run_loop ( limit -- )
    run_limit !
    #? root_spn spn_signal!
    k_head@ is_ram IF
        ( execute instruction )
        ip@ DUP #instr_t typeq IF
            QX@ DUP is_fix IF
                sp@ saved_sp !
                ( WARNING! the `saved_sp` must remain valid
                  during execution of every instruction )
                fix2int perform_op
                DUP is_fix IF
                    ( restore `saved_sp` and signal error )
                    saved_sp @ sp!
                    root_spn spn_signal! ;
                THEN        ( D: ip' )
                DUP #instr_t typeq IF
                    ip!     ( update ip in continuation )
                    cont_dequeue
                    cont_enqueue
                ELSE        ( free terminated cont & event )
                    DROP cont_dequeue
                    DUP QY@ ( D: cont event )
                    release release
                    ( gc_collect )
                THEN
            ELSE            ( D: op )
                E_NOT_FIX root_spn spn_signal! ;
            THEN
        ELSE                ( D: ip )
            E_NOT_EXE root_spn spn_signal! ;
        THEN
        e_head@ is_ram IF
            dispatch_event
        THEN
    ELSE
        e_head@ is_ram IF
            dispatch_event
        ELSE
            E_OK root_spn spn_signal! ;
        THEN
    THEN
    run_limit @ DUP 0> IF
        1- DUP 0= IF
            DROP ;
        THEN
    THEN
    gc_increment
    run_loop ;

: rom_init
    212 DUP 2ROL            ( n_quads n_cells )
    rom_image + SWAP        ( end_addr n_quads )
    ?LOOP-                  ( for each quad... )
        1- DUP @ I QZ!      ( D: end-1 )
        1- DUP @ I QY!      ( D: end-2 )
        1- DUP @ I QX!      ( D: end-3 )
        1- DUP @ I QT!      ( D: end-4 )
    AGAIN DROP ;

: ram_init
    ram_base mem_top!
    #nil mem_next!
    #0 mem_free!
    #nil mem_root!
    #nil e_head!
    #nil e_tail!
    #nil k_head!
    #nil k_tail!
    13 ?LOOP-               ( initialize device-actors )
        0x4002 I +
        #actor_t OVER QT!
        I int2fix OVER QX!
        #nil OVER QY!
        #? OVER QZ!
        DROP
    AGAIN
    0x9000 root_spn spn_memory!
    0x8100 root_spn spn_events!
    0xB000 root_spn spn_cycles!
    #? root_spn spn_signal!
    gc_init ;

: ufork_init
    rom_init
    ram_init
    EXIT

: assert ( truthy -- )
    NOT IF
        FAIL
    THEN ;
: =assert ( actual expect -- )
    = assert ;

: ufork_init_test
    mem_free@ ( 0 int2fix ) #0 =assert
    mem_next@ #nil =assert
    e_head@ #nil =assert
    k_head@ #nil =assert
    EXIT

: pair_test
    #nil #f pair #t pair
    part #t =assert
    part #f =assert
    DUP #nil =assert
    part #? =assert #? =assert
    EXIT

: alloc_test
    mem_top@                ( D: top_before )
    #-1 #0 #pair_t 2alloc   ( D: top_before 1st )
    DUP QT@ #pair_t =assert
    DUP QX@ #0 =assert
    DUP QY@ #-1 =assert
    DUP QZ@ #? =assert
    is_ptr assert
    0x2222 0x1111 pair      ( D: top_before 2nd )
    0x4444 0x3333 pair      ( D: top_before 2nd 3rd )
    SWAP release release    ( D: top_before )
    0x6666 0x5555 pair      ( D: top_before 4th )
    DROP                    ( D: top_before )
    mem_top@                ( D: top_before top_after )
    SWAP - 3 =assert
    mem_free@ #1 =assert
    EXIT

: queue_test
    #nil 0x6002 root_spn 2alloc
    DUP event_enqueue
    DUP e_head@ =assert
    DUP e_tail@ =assert
    #t 0x600E root_spn 2alloc
    DUP event_enqueue
    OVER e_head@ =assert
    DUP e_tail@ =assert
    SWAP event_dequeue =assert
    event_dequeue =assert
    #nil event_dequeue =assert
    EXIT

: test_suite
    ufork_init_test
    pair_test
    alloc_test
    queue_test
    EXIT

: ufork_boot
    ram_init                ( reset RAM )
    ( create bootstrap actor and initial event )
    #nil 0x0010             ( state=() beh=boot )
    #actor_t 2alloc ptr2cap
    DUP 0x6010 =assert      ( bootstrap actor at known address )
    #f SWAP root_spn 2alloc
    event_enqueue
    0 run_loop
    root_spn spn_signal@ #0 =assert
    EXIT

: ufork_reboot
    ( 2nd boot for test verification )
    #? root_spn spn_signal!
    #t 0x6010 root_spn 2alloc
    event_enqueue
    0 run_loop
    root_spn spn_signal@ #0 =assert
    EXIT

( Debugging Monitor )
0x21 CONSTANT '!'
0x2E CONSTANT '.'
0x2F CONSTANT '/'
0x3C CONSTANT '<'
0x3E CONSTANT '>'
0x3F CONSTANT '?'
0x40 CONSTANT '@'
0x5B CONSTANT '['
0x5D CONSTANT ']'
0x70 CONSTANT 'p'
0x71 CONSTANT 'q'
0x72 CONSTANT 'r'
0x7E CONSTANT '~'
VARIABLE cmd    ( last command character read )
VARIABLE inp    ( input data accumulator )
VARIABLE tos    ( top of stack )
VARIABLE nos    ( next on stack )
VARIABLE here   ( upload address )
: to_qaddr ( raw -- qaddr )
    DUP MSB& IF
        0x0FFF AND          ( uCode | fixnum )
    ELSE
        2ROL
        DUP LSB& IF         ( RAM address )
            0x3FFC AND 0x4000 OR
        ELSE                ( ROM address )
            0x7FFC AND MSB|
        THEN
    THEN ;
: parse_qaddr ( qaddr -- field raw )
        DUP 0x3 AND SWAP    ( D: field addr )
        DUP MSB& IF
            2ASR 0x1FFF AND
        ELSE
            2ASR 0x0FFF AND
            0x4000 OR
        THEN ;              ( D: field raw )
: fetch ( addr -- data )
    DUP 0xC000 AND IF
        parse_qaddr         ( D: field raw )
        OVER 0x1 = IF
            QX@             ( D: field data )
        ELSE
            OVER 0x2 = IF
                QY@         ( D: field data )
            ELSE
                OVER 0x3 = IF
                    QZ@     ( D: field data )
                ELSE
                    QT@     ( D: field data )
                THEN
            THEN
        THEN
        NIP                 ( D: data )
    ELSE
        @                   ( D: data )
    THEN ;
: store ( data addr -- )
    DUP 0xC000 AND IF
        parse_qaddr SWAP    ( D: data raw field )
        DUP 0x1 = IF
            DROP QX!
        ELSE
            DUP 0x2 = IF
                DROP QY!
            ELSE
                DUP 0x3 = IF
                    DROP QZ!
                ELSE
                    DROP QT!
                THEN
            THEN
        THEN
    ELSE
        !
    THEN ;
: push ( a -- )
    tos @ nos !
    tos ! ;
: pop ( -- a )
    tos @
    nos @ tos ! ;
: dump ( start end -- )
    OVER -                  ( D: start span )
    DUP 0< IF
        2DROP
    ELSE
        1+ ?LOOP-
            DUP fetch       ( D: addr data )
            OVER 0x7 AND IF
                SPACE
            ELSE
                CR
            THEN
            X. 1+           ( D: addr+1 )
        AGAIN CR DROP
    THEN ;
: >inp ( key -- )
    FROMHEX inp @           ( D: nybble accum )
    4ROL 0xFFF0 AND OR      ( D: accum' )
    inp ! ;
: >here ( data -- )
    here @ store
    here @1+ ;
: prompt ( -- )
    '>' EMIT BL EMIT ;
: del ( -- )
    cmd @
    DUP BL > IF
        DUP ISHEX IF
            inp @
            4ASR 0x0FFF AND
            DUP IF
                DUP TOHEX
            ELSE
                BL
            THEN cmd !
            inp !
        ELSE
            BL cmd !
        THEN
        '\b' EMIT BL EMIT '\b' EMIT
    THEN DROP ;
: eol ( begin -- end )
    ( EMIT ) KEY
    DUP '\r' = SKZ EXIT
    eol ;
: upload ( cmd' key' -- cmd key )
    2DROP                   ( D: -- )
    KEY                     ( D: key )
    DUP '/' = IF
        eol                 ( comment to EOL )
    THEN
    cmd @ SWAP              ( D: cmd key )
    DUP BL <= IF
        OVER ISHEX IF
            here @ 0xF AND NOT IF
                '~' EMIT    ( show upload progress )
            THEN
            inp @ >here
        THEN
        OVER ']' = IF       ( end of upload )
            here @ push
            DUP ECHO
            EXIT
        THEN
        0 inp !             ( clear input accum )
    THEN
    DUP ISHEX IF
        DUP >inp            ( add digit to accum )
    THEN
    DUP ']' = IF
        DUP EMIT
    THEN
    DUP cmd !               ( key -> cmd )
    upload ;
: MONITOR
    KEY                     ( D: key )
    DUP ^C = SKZ EXIT       ( abort! )
    DUP '\b' = IF
        DROP DEL
    THEN
    DUP DEL = IF
        del                 ( delete previous )
    THEN
    DUP ECHO
    cmd @ SWAP              ( D: cmd key )
    ( '<' EMIT OVER X. '.' EMIT DUP X. '>' EMIT )
    DUP BL <= IF
        OVER ISHEX IF
            inp @ push
        THEN
        OVER '@' = IF
            pop fetch push
        THEN
        OVER '.' = IF
            pop X. CR
        THEN
        OVER '!' = IF
            pop pop SWAP store
        THEN
        OVER 'q' = IF
            pop to_qaddr push
        THEN
        OVER 'p' = IF
            pop parse_qaddr SWAP push push
        THEN
        OVER '?' = IF
            pop pop SWAP dump
        THEN
        OVER '[' = IF
            pop here ! upload
        THEN
        OVER 'r' = IF
            pop EXECUTE
        THEN
        0 inp !             ( clear input accum )
        DUP '\r' = IF
            prompt
        THEN
    THEN
    DUP ISHEX IF
        DUP >inp            ( add digit to accum )
    THEN
    DUP DEL = IF
        2DROP
    ELSE
        NIP cmd !           ( key -> cmd )
    THEN
    MONITOR ;

: ECHOLOOP
    KEY
    DUP X. CR
    ( DUP ECHO )
    ^C = SKZ EXIT           ( abort! )
    ECHOLOOP ;

( WARNING! if BOOT returns we PANIC! )
: BOOT
    ( ECHOLOOP )
    ufork_init
    test_suite
    ufork_boot
    ( ufork_reboot )
    prompt MONITOR ;
