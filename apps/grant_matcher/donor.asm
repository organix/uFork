.import
    dev: "https://ufork.org/lib/dev.asm"
    lib: "https://ufork.org/lib/lib.asm"
    std: "https://ufork.org/lib/std.asm"

store:
    ref 0
GM_petname:
    ref 1
KEQD_petname:
    ref 2

boot:                       ; () <- {caps}
    push #?                 ; hello=#?
    push KEQD_petname       ; hello KEQD
    push store              ; hello KEQD store
    msg 0                   ; hello KEQD store {caps}
    push intro_cb_beh       ; hello KEQD store {caps} intro_cb_beh
    new -1                  ; hello KEQD store callback=intro_cb_beh.{caps}
    push #?                 ; hello KEQD store callback to_cancel=#?
    push dev.intro_tag      ; hello KEQD store callback to_cancel #intro
    pair 5                  ; intro_request=(#intro to_cancel callback store KEQD . hello)
    msg 0                   ; intro_request {caps}
    push dev.awp_key        ; intro_request {caps} awp_key
    dict get                ; intro_request awp_dev
    send -1                 ; --
    ref std.commit

intro_cb_beh:               ; {caps} <- (ok . deposit/error)
    msg 1                   ; ok
    assert #t               ; --
    push store              ; store
    state 0                 ; store {caps}
    push dev.debug_key      ; store {caps} debug_key
    dict get                ; store debug_dev
    pair 1                  ; (debug_dev . store)
    push lib.label_beh      ; (debug_dev . store) label_beh
    new -1                  ; withdraw=label_beh.(debug_dev . store)
    msg -1                  ; withdraw deposit
    pair 1                  ; hello=(deposit . withdraw)
    push GM_petname         ; hello GM
    push store              ; hello GM store
    push #?                 ; hello GM store #?
    push std.sink_beh       ; hello GM store #? sink_beh
    new -1                  ; hello GM store callback=sink_beh.#?
    push #?                 ; hello GM store callback to_cancel=#?
    push dev.intro_tag      ; hello GM store callback to_cancel #intro
    pair 5                  ; intro_request=(#intro to_cancel callback store GM . hello)
    state 0                 ; intro_request {caps}
    push dev.awp_key        ; intro_request {caps} awp_key
    dict get                ; intro_request awp_dev
    send -1                 ; --
    ref std.commit

.export
    boot
