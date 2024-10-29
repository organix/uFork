;
; SVG device demo
;

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

svg_cmds:
    ; background
    pair_t 'M'
    pair_t 0
    pair_t 0
    pair_t 'h'
    pair_t 42
    pair_t 'v'
    pair_t 42
    pair_t 'h'
    pair_t -42
    pair_t 'Z'
    pair_t 'F'
    pair_t 92
    pair_t 92
    pair_t 92
    pair_t 255
    ; square
    pair_t 'M'
    pair_t 4
    pair_t 18
    pair_t 'h'
    pair_t 14
    pair_t 'v'
    pair_t -14
    pair_t 'h'
    pair_t -14
    pair_t 'Z'
    pair_t 'D'
    pair_t 246
    pair_t 157
    pair_t 200
    pair_t 255
    pair_t 1
    pair_t 0
    pair_t 0
    ; triangle
    pair_t 'M'
    pair_t 22
    pair_t 18
    pair_t 'l'
    pair_t 8
    pair_t -14
    pair_t 'l'
    pair_t 8
    pair_t 14
    pair_t 'Z'
    pair_t 'D'
    pair_t 107
    pair_t 228
    pair_t 223
    pair_t 255
    pair_t 1
    pair_t 0
    pair_t 0
    ; cross
    pair_t 'M'
    pair_t 4
    pair_t 38
    pair_t 'l'
    pair_t 14
    pair_t -14
    pair_t 'm'
    pair_t -14
    pair_t 0
    pair_t 'l'
    pair_t 14
    pair_t 14
    pair_t 'D'
    pair_t 155
    pair_t 160
    pair_t 233
    pair_t 255
    pair_t 1
    pair_t 0
    pair_t 0
    ; circle
    pair_t 'M'
    pair_t 22
    pair_t 38
    pair_t 'm'
    pair_t 8
    pair_t 0
    pair_t 'a'
    pair_t 7
    pair_t 7
    pair_t 0
    pair_t 1
    pair_t 0
    pair_t 0
    pair_t -14
    pair_t 'a'
    pair_t 7
    pair_t 7
    pair_t 0
    pair_t 1
    pair_t 0
    pair_t 0
    pair_t 14
    pair_t 'D'
    pair_t 255
    pair_t 102
    pair_t 102
    pair_t 255
    pair_t 1
    pair_t 1
    pair_t 1
    ref #nil

str_out:                    ; (cb out . str) <- result
    state -2                ; str
    typeq #pair_t           ; is_pair(str)
    if_not str_end

    state 0                 ; (cb out . str)
    part 3                  ; rest first out cb
    roll 3                  ; rest out cb code=first
    my self                 ; rest out cb code callback=SELF
    push #?                 ; rest out cb code callback to_cancel=#?
    pair 2                  ; rest out cb req=(to_cancel callback . code)
    state 2                 ; rest out cb req out
    actor send              ; rest out cb
    pair 2                  ; (cb out . rest)
    push str_out            ; (cb out . str=rest) str_out
    actor become            ; --
    ref std.commit

str_end:                    ; --
    msg 0                   ; result
    state 1                 ; result cb
    ref std.send_msg

boot:                       ; _ <- {caps}
    push svg_cmds           ; #? str=svg_cmds
    msg 0                   ; #? str {caps}
    push dev.svg_key        ; #? str {caps} svg_key
    dict get                ; #? str out=svg_dev
    push #?                 ; #? str out #?
    push std.sink_beh       ; #? str out #? sink_beh
    actor create            ; #? str out cb=sink_beh.#?
    pair 2                  ; #? (cb out . str)
    push str_out            ; #? (cb out . str) str_out
    actor create            ; #? str_out.(cb out . str)
    ref std.send_msg

.export
    boot
