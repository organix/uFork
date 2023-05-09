;;;
;;; mutable data holder (shareable)
;;;

.import
    std: "./std.asm"
    dev: "./dev.asm"

;;  LET cell_beh(value) = \(cust, req).[
;;      CASE req OF
;;      (#read) : [ SEND value TO cust ]
;;      (#write, value') : [
;;          BECOME cell_beh(value')
;;          SEND SELF TO cust
;;      ]
;;      (#CAS, old, new) : [
;;          IF $old = $value [ BECOME cell_beh(new) ]
;;          SEND value TO cust
;;      ]
;;      END
;;  ]
;;  CREATE cell WITH cell_beh(0)
cell_beh:               ; (value) <- (tag cust . req)
    msg 1               ; tag
    eq 0                ; tag==read
    if cell_read        ; --
    msg 1               ; tag
    eq 1                ; tag==write
    if cell_write       ; --
    msg 1               ; tag
    eq 2                ; tag==CAS
    if cell_CAS         ; --
    ref std.abort

cell_read:
    state 1             ; value
    msg 2               ; value cust
    ref std.send_msg

cell_write:
    msg -2              ; (value')
    my beh              ; (value') beh
    beh -1              ; --
    my self             ; SELF
    msg 2               ; SELF cust
    ref std.send_msg

cell_CAS:
    msg 3               ; old
    state 1             ; old value
    cmp eq              ; old==value
    if_not cell_read    ; --
    msg -3              ; (new)
    my beh              ; (new) beh
    beh -1              ; --
    ref cell_read

; unit test suite
boot:                   ; () <- {caps}
    msg 0               ; {caps}
    push dev.debug_key  ; {caps} dev.debug_key
    dict get            ; debug_dev
    ref std.commit

.export
    cell_beh
    boot
