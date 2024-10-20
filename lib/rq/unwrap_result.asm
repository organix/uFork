; A behavior and procedure that extract the value from a requestor result.
; If the requestor failed, the value will be #?.

.import
    std: "../std.asm"
    dev: "../dev.asm"

proc:
unwrap_result:              ; ( result -- value | #? )
    roll -2                 ; k result
    part 1                  ; k value ok
    if std.return_value     ; k value
    drop 1                  ; k
    push #?                 ; k #?
    ref std.return_value

beh:
unwrap_result_beh:          ; rcvr <- result
    msg 0                   ; result
    call unwrap_result      ; value
    state 0                 ; value rcvr
    ref std.send_msg

.export
    beh
    proc
