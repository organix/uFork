;
; SVG device demo
;

.import
    dev: "https://ufork.org/lib/dev.asm"
    std: "https://ufork.org/lib/std.asm"

svg_cmds:
    pair_t 'M'
    pair_t 3
    pair_t 5
    pair_t 'h'
    pair_t 8
    pair_t 'V'
    pair_t 13
    pair_t 'H'
    pair_t 3
    pair_t 'Z'
    pair_t 'F'
    pair_t 255
    pair_t 153
    pair_t 0
    pair_t 255
    ref #nil

; A write request looks like (to_cancel callback fixnum),
; where to_cancel is the optional customer for a cancel capability,
; and callback is the customer that will receive the result.
; The result looks like (#unit) on success, and (#? . error) on failure.

str_out:                ; (cb out . str) <- result
    state -2            ; str
    typeq #pair_t       ; is_pair(str)
    if_not str_end

    state 0             ; (cb out . str)
    part 3              ; rest first out cb
    roll 3              ; rest out cb code=first
    my self             ; rest out cb code callback=SELF
    push #?             ; rest out cb code callback to_cancel=#?
    state 2             ; rest out cb code callback to_cancel out
    send 3              ; rest out cb
    pair 2              ; (cb out . rest)
    my beh              ; (cb out . str=rest) beh
    beh -1              ; --
    ref std.commit

str_end:                ; --
    msg 0               ; result
    state 1             ; cb
    ref std.send_msg

boot:                   ; () <- {caps}
    push svg_cmds       ; svg_cmds
    msg 0               ; svg_cmds {caps}
    push dev.svg_key    ; svg_cmds {caps} svg_key
    dict get            ; svg_cmds svg_dev
    push std.sink_beh   ; svg_cmds svg_dev sink_beh
    new 0               ; str=svg_cmds out=svg_dev cb=sink_beh.()
    pair 2              ; (cb out . str)
    push str_out        ; (cb out . str) str_out
    new -1              ; str_out.(cb out . str)
    send 0              ; --
    ref std.commit

.export
    boot
