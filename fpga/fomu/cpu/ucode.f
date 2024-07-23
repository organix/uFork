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
    @
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
    IF TRUE ;
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
        SWAP 1+             ( D: table index+1 )
        + @                 ( D: table[index+1] )
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
: rom_image DATA            ( 16 x 4 cells )
(   T           X           Y           Z           VALUE   NAME        )
  0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0000   #?          )
  0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0001   #nil        )
  0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0002   #f          )
  0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0003   #t          )
  0x0000 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0004   #unit       )
  0x000C ,    0x0001 ,    0x0001 ,    0x0000 ,    ( ^0005   EMPTY_DQ    )
  0x0006 ,    0x8001 ,    0x0000 ,    0x0000 ,    ( ^0006   #type_t     )
  0x0006 ,    0x0000 ,    0x0000 ,    0x0000 ,    ( ^0007   #fixnum_t   )
  0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^0008   #actor_t    )
  0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^0009   PROXY_T     )
  0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^000A   STUB_T      )
  0x0006 ,    0x8003 ,    0x0000 ,    0x0000 ,    ( ^000B   #instr_t    )
  0x0006 ,    0x8002 ,    0x0000 ,    0x0000 ,    ( ^000C   #pair_t     )
  0x0006 ,    0x8003 ,    0x0000 ,    0x0000 ,    ( ^000D   #dict_t     )
  0x0006 ,    0xFFFF ,    0x0000 ,    0x0000 ,    ( ^000E   FWD_REF_T   )
  0x0006 ,    0x8000 ,    0x0000 ,    0x0000 ,    ( ^000F   FREE_T      )
  0x000B ,    0x8018 ,    0x8001 ,    0x0011 ,    ( ^0010   msg 1       )
  0x000B ,    0x801A ,    0xFFFF ,    0x0012 ,    ( ^0011   send -1     )
  0x000B ,    0x800F ,    0x8001 ,    0x0000 ,    ( ^0012   end commit  )

(
cust_send:                  ; msg
    msg 1                   ; msg cust
send_msg:                   ; msg cust
    send -1                 ; --
sink_beh:                   ; _ <- _
commit:
    end commit
)

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

0x8001 CONSTANT #1          ( fixnum one )
( : #0                        ( fixnum zero ) ... ucode.js )
0x8000 CONSTANT E_OK        ( not an error )
( : #-1                       ( fixnum negative one ) ... ucode.js )
0xFFFF CONSTANT E_FAIL      ( general failure )
0xFFFE CONSTANT E_BOUNDS    ( out of bounds )
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
: quad ( raw -- qaddr )
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
: memcpy ( dst src count -- )
    ?LOOP-                  ( D: dst src ) ( R: count-1 )
        2DUP                ( D: dst src dst src )
        I + fetch           ( D: dst src dst data )
        SWAP I + store      ( D: dst src )
    AGAIN
    2DROP ;

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

( : int2fix ( num -- raw )
    MSB| ; ... ucode.js )
: fix2int ( raw -- num )
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
    k_head@ QT! ;
: sp!
    k_head@ QX! ;
: ep!
    k_head@ QY! ;

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

: cons ( cdr car -- pair )
    #pair_t 2alloc ;
: car ( pair -- first )
    DUP is_pair IF
        QX@ ;
    THEN DROP #? ;
: cdr ( pair -- rest )
    DUP is_pair IF
        QY@ ;
    THEN DROP #? ;
: part ( pair -- rest first )
    DUP is_pair IF
        DUP QY@ SWAP QX@ ;
    THEN DROP #? DUP ;

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

(
Type checking can produce the following errors:

0xFFFC CONSTANT E_NOT_FIX   ( fixnum required )
0xFFFB CONSTANT E_NOT_CAP   ( capability required )
0xFFFA CONSTANT E_NOT_PTR   ( memory pointer required )
0xFFF9 CONSTANT E_NOT_ROM   ( ROM pointer required )
0xFFF8 CONSTANT E_NOT_RAM   ( RAM pointer required )
0xFFF7 CONSTANT E_NOT_EXE   ( instruction required )
0xFFF6 CONSTANT E_NO_TYPE   ( type required )
)

: perform_op JMPTBL 32 ,    ( opcode -- ip | error )
    invalid                 ( 0x8000: debug )
    invalid                 ( 0x8001: jump )
    invalid                 ( 0x8002: push )
    invalid                 ( 0x8003: if )
    invalid                 ( 0x8004: -unused- )
    invalid                 ( 0x8005: typeq )
    invalid                 ( 0x8006: eq )
    invalid                 ( 0x8007: assert )

    invalid                 ( 0x8008: sponsor )
    invalid                 ( 0x8009: quad )
    invalid                 ( 0x800A: dict )
    invalid                 ( 0x800B: deque )
    invalid                 ( 0x800C: my )
    invalid                 ( 0x800D: alu )
    invalid                 ( 0x800E: cmp )
    invalid                 ( 0x800F: end )

    invalid                 ( 0x8010: -unused- )
    invalid                 ( 0x8011: pair )
    invalid                 ( 0x8012: part )
    invalid                 ( 0x8013: nth )
    invalid                 ( 0x8014: pick )
    invalid                 ( 0x8015: roll )
    invalid                 ( 0x8016: dup )
    invalid                 ( 0x8017: drop )

    invalid                 ( 0x8018: msg )
    invalid                 ( 0x8019: state )
    invalid                 ( 0x801A: send )
    invalid                 ( 0x801B: signal )
    invalid                 ( 0x801C: new )
    invalid                 ( 0x801D: beh )
    invalid                 ( 0x801E: -unused- )
    invalid                 ( 0x801F: -unused- )

    DROP invalid ;          ( default case )

: dispatch_event ( -- )
    event_dequeue           ( D: event )
    DUP QX@ QZ@ IF          ( D: event )
        ( target busy )
        event_enqueue ;
    THEN                    ( D: event )
    #nil OVER QZ!
    DUP QX@ >R              ( D: event ) ( R: target )
    #nil R@ QX@             ( D: ep sp ip ) ( R: target )
    2alloc                  ( D: cont ) ( R: target )
    #nil R@ QY@ R@ QX@      ( D: cont event data code ) ( R: target )
    #actor_t 3alloc         ( D: cont effect ) ( R: target )
    R> QZ!                  ( D: cont )
    cont_enqueue ;

: run_exit ( limit -- )
    DROP ;                  ( FIXME: may want to return the remaining limit... )
VARIABLE saved_sp           ( sp before instruction execution )
: run_loop ( limit -- )
    #? q_root_spn spn_signal!
    k_head@ is_ram IF
        ( execute instruction )
        sp@ saved_sp !
        ip@ DUP #instr_t typeq IF
            QT@ DUP is_fix IF
                fix2int perform_op
                DUP is_fix IF
                    saved_sp @ sp!
                    q_root_spn spn_signal! run_exit ;
                THEN
                ip!         ( update ip in continuation )
                cont_dequeue
                cont_enqueue
            THEN
        THEN
        e_head@ is_ram IF
            dispatch_event
        THEN
    ELSE
        e_head@ is_ram IF
            dispatch_event
        ELSE
            #0 q_root_spn spn_signal! run_exit ;
        THEN
    THEN
    DUP 0> IF
        1- DUP 0= IF
            run_exit ;
        THEN
    THEN
    run_loop ;

: ufork_init
    0x8000 rom_image 64 memcpy
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
    #? q_root_spn spn_signal!
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

: cons_test
    #nil #f cons #t cons
    DUP car #t =assert
    cdr
    part #f =assert
    DUP #nil =assert
    cdr #? =assert
    EXIT

: alloc_test
    mem_top@                ( D: top_before )
    #-1 #0 #pair_t 2alloc   ( D: top_before 1st )
    DUP QT@ #pair_t =assert
    DUP QX@ #0 =assert
    DUP QY@ #-1 =assert
    DUP QZ@ #? =assert
    is_ptr assert
    0x2222 0x1111 cons      ( D: top_before 2nd )
    0x4444 0x3333 cons      ( D: top_before 2nd 3rd )
    SWAP release release    ( D: top_before )
    0x6666 0x5555 cons      ( D: top_before 4th )
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
    ufork_init
    ufork_init_test
    cons_test
    alloc_test
    queue_test
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
            pop quad push
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
    ( ECHOLOOP ) test_suite prompt MONITOR ;
