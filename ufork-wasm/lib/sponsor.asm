;
; Demonstrate "sponsor" mechanism
;

.import
    std: "./std.asm"
    dev: "./dev.asm"

start:                  ; (debug_dev) <- ()
    sponsor new         ; sponsor
    push 48             ; sponsor 48
    sponsor memory      ; sponsor
    push 8              ; sponsor 8
    sponsor events      ; sponsor
    push 64             ; sponsor 64
    sponsor instrs      ; sponsor
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
    push 0              ; 0
    push count_to       ; 0 count_to
    new 0               ; 0 count_to.()
    ref std.send_msg

control_1:              ; (debug_dev) <- sponsor
    msg 0               ; sponsor
    get Z               ; error
    msg 0               ; error sponsor
    sponsor reclaim     ; error
    state 1             ; error debug_dev
    ref std.send_msg

loop_forever:
    dup 0 loop_forever

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
    cell 1              ; custom_t
    dup 1               ; custom_t custom_t
    push #pair_t        ; custom_t custom_t #pair_t
    push #dict_t        ; custom_t custom_t #pair_t #dict_t
    push 42             ; custom_t custom_t #pair_t #dict_t 42
    push #t             ; custom_t custom_t #pair_t #dict_t 42 #t
    push #nil           ; custom_t custom_t #pair_t #dict_t 42 #t ()
    cell 4              ; custom_t custom_t #pair_t {42:#t}
    push #nil           ; custom_t custom_t #pair_t {42:#t} ()
    cell 3              ; custom_t custom_t ({42:#t})
    cell 2              ; custom_t [custom_t, ({42:#t})]
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
    boot
