;
; Demonstrate "sponsor" mechanism
;

.import
    std: "./std.asm"
    dev: "./dev.asm"

E_MEM_LIM:
    ref -9
E_MSG_LIM:
    ref -11
E_CPU_LIM:
    ref -10

refill:                 ; (memory events cycles) <- sponsor
    msg 0               ; sponsor
    get Z               ; error
    dup 1               ; error error
    eq E_CPU_LIM        ; error error==E_CPU_LIM
    if refill_0         ; error
    dup 1               ; error error
    eq E_MEM_LIM        ; error error==E_MEM_LIM
    if refill_0         ; error
    dup 1               ; error error
    eq E_MSG_LIM        ; error error==E_MSG_LIM
    if refill_0         ; error
    msg 0               ; error sponsor
    sponsor stop        ; error --
    ref std.commit
refill_0:
    msg 0               ; sponsor
    sponsor reclaim     ; sponsor
    state 1             ; sponsor memory
    sponsor memory      ; sponsor
    state 2             ; sponsor events
    sponsor memory      ; sponsor
    state 3             ; sponsor cycles
    sponsor cycles      ; sponsor
    my self             ; sponsor control=SELF
    sponsor start       ; --
    ref std.commit

start:                  ; (debug_dev) <- ()
    sponsor new         ; sponsor
    push 48             ; sponsor 48
    sponsor memory      ; sponsor
    push 8              ; sponsor 8
    sponsor events      ; sponsor
    push 64             ; sponsor 64
    sponsor cycles      ; sponsor
    dup 1               ; sponsor sponsor
    state 1             ; sponsor sponsor debug_dev
    push control_1      ; sponsor sponsor debug_dev control_1
    new 1               ; sponsor sponsor control_1.(debug_dev)
    sponsor start       ; sponsor
    push start_1        ; sponsor start_1
    new 0               ; sponsor start_1.()
    signal 0            ; --
    ref std.commit

start_1:                ; () <- ()
    push loop_forever   ; loop_forever
    new 0               ; loop_forever.()
    send 0              ; --
    push fork_bomb      ; fork_bomb
    new 0               ; fork_bomb.()
    send 0              ; --
    push 0              ; 0
    push count_to       ; 0 count_to
    new 0               ; 0 count_to.()
    ref std.send_msg

control_1:              ; (debug_dev) <- sponsor
    msg 0               ; sponsor
    get Z               ; error
    msg 0               ; error sponsor
    sponsor stop        ; error
    state 1             ; error debug_dev
    ref std.send_msg

loop_forever:
    dup 0 loop_forever

fork_bomb:              ; () <- ()
    my self             ; SELF
    send 0              ; --
    my self             ; SELF
    send 0              ; --
    ref std.commit

count_to:               ; (limit) <- count
    state 1             ; limit
    typeq #fixnum_t     ; typeof(limit)==#fixnum_t
    if_not count_next   ; --
    msg 0               ; count
    state 1             ; count limit
    cmp ge              ; count>=limit
    if std.commit       ; --
count_next:
    msg 0               ; count
    push 1              ; count 1
    alu add             ; count+1
    my self             ; count+1 SELF
    ref std.send_msg

test_quad:              ; _ <- _
    push #type_t        ; #type_t
    quad 1              ; custom_t
    dup 1               ; custom_t custom_t
    push #pair_t        ; custom_t custom_t #pair_t
    push #dict_t        ; custom_t custom_t #pair_t #dict_t
    push 42             ; custom_t custom_t #pair_t #dict_t 42
    push #t             ; custom_t custom_t #pair_t #dict_t 42 #t
    push #nil           ; custom_t custom_t #pair_t #dict_t 42 #t ()
    quad 4              ; custom_t custom_t #pair_t {42:#t}
    push #nil           ; custom_t custom_t #pair_t {42:#t} ()
    quad 3              ; custom_t custom_t ({42:#t})
    quad 2              ; custom_t [custom_t, ({42:#t})]
    dup 2               ; custom_t [custom_t, ({42:#t})] custom_t [custom_t, ({42:#t})]
    get T               ; custom_t [custom_t, ({42:#t})] custom_t custom_t
    cmp eq              ; custom_t [custom_t, ({42:#t})] #t
    is_eq #t            ; custom_t [custom_t, ({42:#t})]
    get X               ; custom_t ({42:#t})
    part 1              ; custom_t () {42:#t}
    dup 1               ; custom_t () {42:#t} {42:#t}
    get Y               ; custom_t () {42:#t} #t
    is_eq #t            ; custom_t () {42:#t}
    get Z               ; custom_t () ()
    cmp eq              ; custom_t #t
    is_eq #t            ; custom_t
    ref std.commit

boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} debug_key
    dict get            ; debug_dev
    push start          ; debug_dev start
    new 1               ; start.(debug_dev)
    send 0              ; --
    ref std.commit

.export
    refill
    boot
