;
; Demonstrate "sponsor" mechanism
;

.import
    std: "./std.asm"
    dev: "./dev.asm"

start:                  ; (debug_dev) <- ()
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
