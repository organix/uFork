; "Hello, World!" example streaming to I/O device

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

hello:                      ; +72,+101,+108,+108,+111,+63,+10,#nil
    pair_t 'H'
    pair_t 'e'
    pair_t 'l'
    pair_t 'l'
    pair_t 'o'
    pair_t '?'
    pair_t '\n'
    ref #nil

str_out:                    ; cb,out,str <- ok,value
    msg 1                   ; ok
    if_not str_end          ; --

    state -2                ; str
    typeq #pair_t           ; is_pair(str)
    if_not str_end          ; --

    state 0                 ; cb,out,str
    part 3                  ; rest first out cb
    roll 3                  ; rest out cb code=first
    actor self              ; rest out cb code callback=SELF
    push #?                 ; rest out cb code callback to_cancel=#?
    pair 2                  ; rest out cb req=to_cancel,callback,code
    state 2                 ; rest out cb req out
    actor send              ; rest out cb
    pair 2                  ; cb,out,rest
    push str_out            ; cb,out,str=rest str_out
    actor become            ; --
    ref std.commit

str_end:                    ; --
    msg 0                   ; ok,value
    state 1                 ; ok,value cb
    ref std.send_msg

boot:                       ; _ <- {caps}
    push #?                 ; value=#?
    push #t                 ; #? ok=#t
    pair 1                  ; ok,value

    push hello              ; ok,value str=hello
    msg 0                   ; ok,value str {caps}
    push dev.io_key         ; ok,value str {caps} io_key
    dict get                ; ok,value str out=io_dev
    push #?                 ; ok,value str out #?
    push std.sink_beh       ; ok,value str out #? sink_beh
    actor create            ; ok,value str out cb=sink_beh.#?

    pair 2                  ; ok,value cb,out,str
    push str_out            ; ok,value cb,out,str str_out
    actor create            ; ok,value str_out.cb,out,str
    ref std.send_msg

.export
    boot
