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
0x0000 , 0x0000 , 0x0000 , 0x0000 ,  ( ^0004: #unit )
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
0x000b , 0x8011 , 0x8000 , 0x0020 ,  ( ^0010 )
0x000b , 0x8016 , 0x8000 , 0x0024 ,  ( ^0011 )
0x000b , 0x8011 , 0x8000 , 0x0025 ,  ( ^0012 )
0x000b , 0x8012 , 0x8001 , 0x0036 ,  ( ^0013 )
0x000b , 0x8002 , 0x0016 , 0x0044 ,  ( ^0014 )
0x000b , 0x8002 , 0x0001 , 0x0066 ,  ( ^0015 )
0x000c , 0x8111 , 0x0017 , 0x0000 ,  ( ^0016 )
0x000c , 0x8222 , 0x0018 , 0x0000 ,  ( ^0017 )
0x000c , 0x8333 , 0x0001 , 0x0000 ,  ( ^0018 )
0x000b , 0x8018 , 0x8000 , 0x0073 ,  ( ^0019 )
0x000b , 0x8002 , 0x0001 , 0x0075 ,  ( ^001a )
0x000b , 0x8018 , 0x8000 , 0x0077 ,  ( ^001b )
0x000b , 0x8018 , 0x8001 , 0x001d ,  ( ^001c )
0x000b , 0x801a , 0xffff , 0x001e ,  ( ^001d )
0x000b , 0x800f , 0x8001 , 0x0000 ,  ( ^001e )
0x000b , 0x800f , 0x8000 , 0x0000 ,  ( ^001f )
0x000b , 0x800c , 0x8000 , 0x0021 ,  ( ^0020 )
0x000b , 0x8011 , 0x8001 , 0x0022 ,  ( ^0021 )
0x000b , 0x8002 , 0x0011 , 0x0023 ,  ( ^0022 )
0x000b , 0x801d , 0xffff , 0x0012 ,  ( ^0023 )
0x000b , 0x8012 , 0x8000 , 0x001e ,  ( ^0024 )
0x000b , 0x8007 , 0x0001 , 0x0026 ,  ( ^0025 )
0x000b , 0x8002 , 0x8003 , 0x0027 ,  ( ^0026 )
0x000b , 0x8002 , 0x8002 , 0x0028 ,  ( ^0027 )
0x000b , 0x8011 , 0x8001 , 0x0029 ,  ( ^0028 )
0x000b , 0x8002 , 0x8001 , 0x002a ,  ( ^0029 )
0x000b , 0x8011 , 0x8001 , 0x002b ,  ( ^002a )
0x000b , 0x8012 , 0x8001 , 0x002c ,  ( ^002b )
0x000b , 0x8007 , 0x8001 , 0x002d ,  ( ^002c )
0x000b , 0x8016 , 0x8000 , 0x002e ,  ( ^002d )
0x000b , 0x8012 , 0x8001 , 0x002f ,  ( ^002e )
0x000b , 0x8007 , 0x8002 , 0x0030 ,  ( ^002f )
0x000b , 0x8016 , 0x8001 , 0x0031 ,  ( ^0030 )
0x000b , 0x8012 , 0x8001 , 0x0032 ,  ( ^0031 )
0x000b , 0x8017 , 0x8001 , 0x0033 ,  ( ^0032 )
0x000b , 0x8007 , 0x0000 , 0x0034 ,  ( ^0033 )
0x000b , 0x8017 , 0x8000 , 0x0035 ,  ( ^0034 )
0x000b , 0x8007 , 0x8003 , 0x0013 ,  ( ^0035 )
0x000b , 0x8017 , 0x8001 , 0x0037 ,  ( ^0036 )
0x000b , 0x8003 , 0x001f , 0x0038 ,  ( ^0037 )
0x000b , 0x8002 , 0x8000 , 0x0039 ,  ( ^0038 )
0x000b , 0x8006 , 0x8000 , 0x003a ,  ( ^0039 )
0x000b , 0x8003 , 0x003b , 0x001f ,  ( ^003a )
0x000b , 0x8002 , 0xffff , 0x003c ,  ( ^003b )
0x000b , 0x8006 , 0x8000 , 0x003d ,  ( ^003c )
0x000b , 0x8003 , 0x001f , 0x003e ,  ( ^003d )
0x000b , 0x8002 , 0x0001 , 0x003f ,  ( ^003e )
0x000b , 0x8003 , 0x001f , 0x0040 ,  ( ^003f )
0x000b , 0x8002 , 0x0004 , 0x0041 ,  ( ^0040 )
0x000b , 0x8003 , 0x0042 , 0x001f ,  ( ^0041 )
0x000b , 0x8002 , 0x8000 , 0x0043 ,  ( ^0042 )
0x000b , 0x8003 , 0x001f , 0x0014 ,  ( ^0043 )
0x000b , 0x8012 , 0x8001 , 0x0045 ,  ( ^0044 )
0x000b , 0x8007 , 0x8111 , 0x0046 ,  ( ^0045 )
0x000b , 0x8012 , 0x8001 , 0x0047 ,  ( ^0046 )
0x000b , 0x8007 , 0x8222 , 0x0048 ,  ( ^0047 )
0x000b , 0x8012 , 0x8001 , 0x0049 ,  ( ^0048 )
0x000b , 0x8007 , 0x8333 , 0x004a ,  ( ^0049 )
0x000b , 0x8007 , 0x0001 , 0x004b ,  ( ^004a )
0x000b , 0x8002 , 0x0016 , 0x004c ,  ( ^004b )
0x000b , 0x8013 , 0x8000 , 0x004d ,  ( ^004c )
0x000b , 0x8007 , 0x0016 , 0x004e ,  ( ^004d )
0x000b , 0x8002 , 0x0016 , 0x004f ,  ( ^004e )
0x000b , 0x8013 , 0x8001 , 0x0050 ,  ( ^004f )
0x000b , 0x8007 , 0x8111 , 0x0051 ,  ( ^0050 )
0x000b , 0x8002 , 0x0016 , 0x0052 ,  ( ^0051 )
0x000b , 0x8013 , 0xffff , 0x0053 ,  ( ^0052 )
0x000b , 0x8007 , 0x0017 , 0x0054 ,  ( ^0053 )
0x000b , 0x8002 , 0x0016 , 0x0055 ,  ( ^0054 )
0x000b , 0x8013 , 0x8002 , 0x0056 ,  ( ^0055 )
0x000b , 0x8007 , 0x8222 , 0x0057 ,  ( ^0056 )
0x000b , 0x8002 , 0x0016 , 0x0058 ,  ( ^0057 )
0x000b , 0x8013 , 0xfffe , 0x0059 ,  ( ^0058 )
0x000b , 0x8007 , 0x0018 , 0x005a ,  ( ^0059 )
0x000b , 0x8002 , 0x0016 , 0x005b ,  ( ^005a )
0x000b , 0x8013 , 0x8003 , 0x005c ,  ( ^005b )
0x000b , 0x8007 , 0x8333 , 0x005d ,  ( ^005c )
0x000b , 0x8002 , 0x0016 , 0x005e ,  ( ^005d )
0x000b , 0x8013 , 0xfffd , 0x005f ,  ( ^005e )
0x000b , 0x8007 , 0x0001 , 0x0060 ,  ( ^005f )
0x000b , 0x8002 , 0x0016 , 0x0061 ,  ( ^0060 )
0x000b , 0x8013 , 0x8004 , 0x0062 ,  ( ^0061 )
0x000b , 0x8007 , 0x0000 , 0x0063 ,  ( ^0062 )
0x000b , 0x8002 , 0x0016 , 0x0064 ,  ( ^0063 )
0x000b , 0x8013 , 0xfffc , 0x0065 ,  ( ^0064 )
0x000b , 0x8007 , 0x0000 , 0x0015 ,  ( ^0065 )
0x000b , 0x8002 , 0x0000 , 0x0067 ,  ( ^0066 )
0x000b , 0x8002 , 0x0019 , 0x0068 ,  ( ^0067 )
0x000b , 0x801c , 0xffff , 0x0069 ,  ( ^0068 )
0x000b , 0x8011 , 0x8001 , 0x006a ,  ( ^0069 )
0x000b , 0x8002 , 0x001a , 0x006b ,  ( ^006a )
0x000b , 0x801c , 0xffff , 0x006c ,  ( ^006b )
0x000b , 0x8002 , 0x0003 , 0x006d ,  ( ^006c )
0x000b , 0x8014 , 0x8002 , 0x006e ,  ( ^006d )
0x000b , 0x801a , 0xffff , 0x006f ,  ( ^006e )
0x000b , 0x8002 , 0x0002 , 0x0070 ,  ( ^006f )
0x000b , 0x8014 , 0x8002 , 0x0071 ,  ( ^0070 )
0x000b , 0x801a , 0xffff , 0x0072 ,  ( ^0071 )
0x000b , 0x8017 , 0x8001 , 0x001e ,  ( ^0072 )
0x000b , 0x8002 , 0x0019 , 0x0074 ,  ( ^0073 )
0x000b , 0x801d , 0xffff , 0x001e ,  ( ^0074 )
0x000b , 0x8002 , 0x001e , 0x0076 ,  ( ^0075 )
0x000b , 0x801d , 0xffff , 0x001b ,  ( ^0076 )
0x000b , 0x8019 , 0x8001 , 0x001d ,  ( ^0077 )
( 480 cells, 120 quads )

( 0x0000 CONSTANT #?          ( undefined ) ... ucode.js )
( 0x0001 CONSTANT #nil        ( empty list ) ... ucode.js )
0x0002 CONSTANT #f          ( boolean false )
0x0003 CONSTANT #t          ( boolean true )
0x0004 CONSTANT #unit       ( inert result )
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

: wr_mark ( value qref -- value qref )
    OVER DROP ;             ( TODO: if gc in progress, mark _value_ in-use )
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

( : int2fix ( n -- #n )
    MSB| ; ... ucode.js )
: fix2int ( #n -- n )
    ROL ASR ;
: ptr2cap ( ptr -- cap )
    0x2000 OR ;
: cap2ptr ( cap -- ptr )
    0xDFFF AND ;

0x4000 CONSTANT q_mem_desc  ( quad-memory descriptor )
: mem_top@ ( -- data )
    q_mem_desc QT@ ;
: mem_next@ ( -- data )
    q_mem_desc QX@ ;
: mem_free@ ( -- data )
    q_mem_desc QY@ ;
: mem_root@ ( -- data )
    q_mem_desc QZ@ ;
: mem_top! ( data -- )
    q_mem_desc QT! ;
: mem_next! ( data -- )
    q_mem_desc QX! ;
: mem_free! ( data -- )
    q_mem_desc QY! ;
: mem_root! ( data -- )
    q_mem_desc QZ! ;

0x4001 CONSTANT q_ek_queues ( event/continuation queues )
: e_head@ ( -- data )
    q_ek_queues QT@ ;
: e_tail@ ( -- data )
    q_ek_queues QX@ ;
: e_head! ( data -- )
    q_ek_queues QT! ;
: e_tail! ( data -- )
    q_ek_queues QX! ;
: k_head@ ( -- data )
    q_ek_queues QY@ ;
: k_tail@ ( -- data )
    q_ek_queues QZ@ ;
: k_head! ( data -- )
    q_ek_queues QY! ;
: k_tail! ( data -- )
    q_ek_queues QZ! ;

0x400F CONSTANT q_root_spn  ( root sponsor )
: spn_memory@ ( sponsor -- data )
    QT@ ;
: spn_events@ ( sponsor -- data )
    QX@ ;
: spn_cycles@ ( sponsor -- data )
    QY@ ;
: spn_signal@ ( sponsor -- data )
    QZ@ ;
: spn_memory! ( data sponsor -- )
    QT! ;
: spn_events! ( data sponsor -- )
    QX! ;
: spn_cycles! ( data sponsor -- )
    QY! ;
: spn_signal! ( data sponsor -- )
    QZ! ;

: event_enqueue ( event -- )
    #nil OVER qz!
    e_head@ is_ram IF
        DUP e_tail@ qz!
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
    #nil OVER qz!
    k_head@ is_ram IF
        DUP k_tail@ qz!
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
: release ( qref -- )
    FREE_T OVER QT!
    ( #? OVER QX! #? OVER QY! )
    mem_next@ OVER QZ! mem_next!
    mem_free@ 1+ mem_free! ;
: 0alloc ( T -- qref )
    reserve >R              ( D: T ) ( R: qref )
    R@ QT!                  ( D: ) ( R: qref )
    #? R@ QX!               ( D: ) ( R: qref )
: _clear2
    #? R@ QY!               ( D: ) ( R: qref )
: _clear1
    #? R@ QZ!               ( D: ) ( R: qref )
: _clear0
    R> ;                    ( D: qref ) ( R: )
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

(

The following functions are used in various instruction descriptions:

    Define cons(x, y) as: #pair_t(x, y)
    Define car(x) as: if x is a #pair_t then x.X else #?
    Define cdr(x) as: if x is a #pair_t then x.Y else #?

To Advance p by fixnum:n:

    While n > 0
        Let p become cdr(p)
        Let n become n-1

To Insert item at prev:

    If prev is a #pair_t
        Let entry be cons(item, cdr(prev))
        Set prev.Y to entry

To Extract next from prev:

    If prev is a #pair_t
        Set prev.Y to cdr(next)

To Enlist fixnum:n as list:

    If n > 0
        Let list be the stack pointer
        Let p be list
        Advance p by n
        If p is a #pair_t
            Let the stack pointer become cdr(p)
            Set p.Y to #nil
        Otherwise
            Let the stack pointer become #nil
    Otherwise
        Let list be #nil

To Reverse list onto head:

    While list is a #pair_t
        Let next be cdr(list)
        Set list.Y to head
        Let head become list
        Let list become next

To Copy list onto head:

    While list is a #pair_t
        Let head be cons(car(list), head)
        Let list become cdr(list)

To Copy fixnum:n of list onto head:

    While n > 0
        Let head be cons(car(list), head)
        Let list become cdr(list)
        Let n become n-1
)

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
: cmp_result ( sp truthy -- ip' )
    IF #t ELSE #f THEN
    rplc_result ;           ( WARNING! stack modified in-place )
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
: 2not_fix ( sp' #n #m )
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
    sp@ part imm@           ( D: sp' value type )
    DUP #type_t typeq IF
        typeq IF            ( D: sp' )
            #t
        ELSE
            #f
        THEN push_result ;
    THEN
    E_NO_TYPE ;

: op_pair ( -- ip' | error )
    imm@ #1 = IF
        sp@ part >R         ( D: rest ) ( R: first )
        part R>             ( D: rest' second first )
        pair push_result ;
    THEN
    imm@ #0 = IF
        nil_result ;
    THEN
    imm@ #-1 = IF
        #nil sp@ push_result ;
    THEN
    E_BOUNDS ;

: op_part ( -- ip' | error )
    imm@ #1 = IF
        sp@ part            ( D: rest pair )
        part >R             ( D: rest tail ) ( R: head )
        pair                ( D: (tail . rest) ) ( R: head )
        R> pair             ( D: (head . (tail . rest)) )
        update_sp ;
    THEN
    imm@ #0 = IF
        k@ ;                ( no-op )
    THEN
    E_BOUNDS ;

(
: n_rest ( pair n -- tail )
    ?LOOP-
        rest
    AGAIN ;
: nth' ( pair n -- item | tail )
    DUP 0= IF               ( D: pair 0 )
        DROP ;              ( D: pair )
    THEN
    DUP MSB& IF             ( D: pair -n )
        NEGATE n_rest ;
    THEN                    ( D: pair +n )
    1- n_rest first ;
)
: nth ( pair n -- item | tail )
    DUP 0= IF               ( D: pair 0 )
        DROP ;              ( D: pair )
    THEN
    DUP MSB& IF             ( D: pair -n )
        ?LOOP+              ( D: pair )
            rest
        AGAIN ;
    THEN                    ( D: pair +n )
    1- ?LOOP-               ( D: pair )
        rest
    AGAIN first ;
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
    imm@ is_fix IF
        imm@ fix2int        ( D: n )
        DUP MSB& IF         ( D: -n )
            E_BOUNDS ;      ( TODO: implement n < 0 )
        THEN
        0= IF               ( D: 0 )
            undef_result ;
        THEN
        sp@ DUP             ( D: sp sp )
        imm@ nth_result ;
    THEN
    E_NOT_FIX ;

: alu_result ( sp n -- ip' )
    int2fix rplc_result ;   ( WARNING! stack modified in-place )
: alu_not                   ( D: )
    peek_1arg               ( D: sp' #n )
    DUP is_fix IF
        fix2int             ( D: sp' n )
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

: send_effect ( msg target sponsor -- )
    2alloc >R               ( D: ) ( R: event )
    self@ QZ@               ( D: effect ) ( R: event )
    DUP QZ@                 ( D: effect events ) ( R: event )
    R@ qz!                  ( D: effect ) ( R: events' )
    R> SWAP qz! ;           ( D: )
: op_send ( -- ip' | error )
    imm@ #-1 = IF
        sp@ part            ( D: sp' target )
        DUP is_cap IF
            SWAP part       ( D: target sp'' msg )
            ROT sponsor@    ( D: sp'' msg target sponsor )
            send_effect     ( D: sp'' )
            update_sp ;
        THEN
        E_NOT_CAP ;
    THEN
    E_BOUNDS ;

: create_effect ( state beh -- actor )
    #actor_t 2alloc ptr2cap ;
: op_new ( -- ip' | error )
    imm@ #-1 = IF
        sp@ part            ( D: sp' beh )
        DUP #instr_t typeq IF
            SWAP part ROT   ( D: sp'' state beh )
            create_effect   ( D: sp'' actor )
            push_result ;
        THEN
        E_NOT_EXE ;
    THEN
    E_BOUNDS ;

: become_effect ( state beh -- )
    self@ QZ@ TUCK          ( D: state effect beh effect )
    qx! qy! ;               ( D: )
: op_beh ( -- ip' | error )
    imm@ #-1 = IF
        sp@ part            ( D: sp' beh )
        DUP #instr_t typeq IF
            SWAP part ROT   ( D: sp'' state beh )
            become_effect   ( D: sp'' )
            update_sp ;
        THEN
        E_NOT_EXE ;
    THEN
    E_BOUNDS ;

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

: perform_op ( opcode -- ip' | error )
    JMPTBL 32 ,
    invalid                 ( 0x8000: debug )
    invalid                 ( 0x8001: jump )
    op_push                 ( 0x8002: push )
    op_if                   ( 0x8003: if )
    invalid                 ( 0x8004: -unused- )
    op_typeq                ( 0x8005: typeq )
    op_eq                   ( 0x8006: eq )
    op_assert               ( 0x8007: assert )

    invalid                 ( 0x8008: sponsor )
    invalid                 ( 0x8009: quad )
    invalid                 ( 0x800A: dict )
    invalid                 ( 0x800B: deque )
    op_my                   ( 0x800C: my )
    invalid                 ( 0x800D: alu )
    invalid                 ( 0x800E: cmp )
    op_end                  ( 0x800F: end )

    invalid                 ( 0x8010: -unused- )
    op_pair                 ( 0x8011: pair )
    op_part                 ( 0x8012: part )
    op_nth                  ( 0x8013: nth )
    op_pick                 ( 0x8014: pick )
    invalid                 ( 0x8015: roll )
    op_dup                  ( 0x8016: dup )
    op_drop                 ( 0x8017: drop )

    op_msg                  ( 0x8018: msg )
    op_state                ( 0x8019: state )
    op_send                 ( 0x801A: send )
    invalid                 ( 0x801B: signal )
    op_new                  ( 0x801C: new )
    op_beh                  ( 0x801D: beh )
    invalid                 ( 0x801E: -unused- )
    invalid                 ( 0x801F: -unused- )

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
    #? q_root_spn spn_signal!
    k_head@ is_ram IF
        ( execute instruction )
        sp@ saved_sp !
        ip@ DUP #instr_t typeq IF
            QX@ DUP is_fix IF
                fix2int perform_op
                DUP is_fix IF
                    saved_sp @ sp!
                    q_root_spn spn_signal! ;
                THEN        ( D: ip' )
                DUP #instr_t typeq IF
                    ip!     ( update ip in continuation )
                    cont_dequeue
                    cont_enqueue
                ELSE        ( free terminated cont & event )
                    DROP cont_dequeue
                    DUP QY@ ( D: cont event )
                    release release
                THEN
            ELSE            ( D: op )
                E_BOUNDS q_root_spn spn_signal! ;
            THEN
        ELSE                ( D: ip )
            E_NOT_EXE q_root_spn spn_signal! ;
        THEN
        e_head@ is_ram IF
            dispatch_event
        THEN
    ELSE
        e_head@ is_ram IF
            dispatch_event
        ELSE
            E_OK q_root_spn spn_signal! ;
        THEN
    THEN
    run_limit @ DUP 0> IF
        1- DUP 0= IF
            DROP ;
        THEN
    THEN
    run_loop ;

: rom_init
    120 DUP 2ROL            ( n_quads n_cells )
    rom_image + SWAP        ( end_addr n_quads )
    ?LOOP-                  ( for each quad... )
        1- DUP @ I QZ!      ( D: end-1 )
        1- DUP @ I QY!      ( D: end-2 )
        1- DUP @ I QX!      ( D: end-3 )
        1- DUP @ I QT!      ( D: end-4 )
    AGAIN DROP ;

: ram_init
    0x4010 mem_top!
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
    0x9000 q_root_spn spn_memory!
    0x8100 q_root_spn spn_events!
    0xB000 q_root_spn spn_cycles!
    #? q_root_spn spn_signal! ;

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
    #nil 0x6002 q_root_spn 2alloc
    DUP event_enqueue
    DUP e_head@ =assert
    DUP e_tail@ =assert
    #unit 0x600E q_root_spn 2alloc
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
    #f SWAP q_root_spn 2alloc
    event_enqueue
    0 run_loop
    q_root_spn spn_signal@ #0 =assert
    EXIT

: ufork_reboot
    ( 2nd boot for test verification )
    #? q_root_spn spn_signal!
    #t 0x6010 q_root_spn 2alloc
    event_enqueue
    0 run_loop
    q_root_spn spn_signal@ #0 =assert
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
    ufork_reboot
    prompt MONITOR ;
