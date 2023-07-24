.import
    dev: "../../lib/dev.asm"
    lib: "../../lib/lib.asm"
    std: "../../lib/std.asm"

store:
    ref 0
GM_petname:
    ref 1
KEQD_petname:
    ref 2

boot:                       ; () <- {caps}
    push KEQD_petname       ; KEQD
    push store              ; KEQD store
    msg 0                   ; KEQD store {caps}
    push intro_cb_beh       ; KEQD store {caps} intro_cb_beh
    new -1                  ; KEQD store intro_cb
    push #?                 ; KEQD store intro_cb #?
    push dev.intro_tag      ; KEQD store intro_cb #? #intro
    msg 0                   ; KEQD store intro_cb #? #intro {caps}
    push dev.awp_key        ; KEQD store intro_cb #? #intro {caps} awp_key
    dict get                ; KEQD store intro_cb #? #intro awp_dev
    send 5                  ; --
    ref std.commit

intro_cb_beh:               ; {caps} <- (deposit . error)
    msg -1                  ; error
    is_eq #nil              ; --
    push store              ; store
    state 0                 ; store {caps}
    push dev.debug_key      ; store {caps} debug_key
    dict get                ; store debug_dev
    push lib.label_beh      ; store debug_dev label_beh
    new 2                   ; withdraw
    msg 1                   ; withdraw deposit
    pair 1                  ; hello=(deposit . withdraw)
    push GM_petname         ; hello GM
    push store              ; hello GM store
    push std.sink_beh       ; hello GM store sink_beh
    new 0                   ; hello GM store sink
    push #?                 ; hello GM store sink #?
    push dev.intro_tag      ; hello GM store sink #? #intro
    state 0                 ; hello GM store sink #? #intro {caps}
    push dev.awp_key        ; hello GM store sink #? #intro {caps} awp_key
    dict get                ; hello GM store sink #? #intro awp_dev
    send 6                  ; --
    ref std.commit

.export
    boot
