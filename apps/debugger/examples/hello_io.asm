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

str_out:                    ; cb,out,str <- result
    state -2                ; str
    typeq #pair_t           ; is_pair(str)
    if_not str_end

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
    msg 0                   ; result
    state 1                 ; result cb
    ref std.send_msg

boot:                       ; _ <- {caps}
    push #?                 ; #?
    push hello              ; #? str
    msg 0                   ; #? str {caps}
    push dev.io_key         ; #? str {caps} dev.io_key
    dict get                ; #? str io_dev
    push #?                 ; #? str io_dev #?
    push std.sink_beh       ; #? str io_dev #? sink_beh
    actor create            ; #? str out=io_dev cb=sink_beh.#?
    pair 2                  ; #? cb,out,str
    push str_out            ; #? cb,out,str str_out
    actor create            ; #? str_out.cb,out,str
    ref std.send_msg

.export
    boot
