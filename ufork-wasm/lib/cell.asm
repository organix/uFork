;;;
;;; mutable data holder (shareable)
;;;

.import
    std: "./std.asm"

read_tag:
    ref 0
write_tag:
    ref 1
CAS_tag:
    ref 2

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
beh:                    ; (value) <- (tag cust . req)
    msg 1               ; tag
    eq read_tag         ; tag==read
    if read             ; --
    msg 1               ; tag
    eq write_tag        ; tag==write
    if write            ; --
    msg 1               ; tag
    eq CAS_tag          ; tag==CAS
    if CAS              ; --
    ref std.abort

read:                   ; <- (tag cust)
    state 1             ; value
    msg 2               ; value cust
    ref std.send_msg

write:                  ; <- (tag cust value')
    msg -2              ; (value')
    my beh              ; (value') beh
    beh -1              ; --
    my self             ; SELF
    msg 2               ; SELF cust
    ref std.send_msg

CAS:                    ; <- (tag cust old new)
    msg 3               ; old
    state 1             ; old value
    cmp eq              ; old==value
    if_not read         ; --
    msg 4               ; new
    my beh              ; new beh
    beh 1               ; --
    ref read

; unit test suite
boot:
    push test_read_beh  ; test_read_beh
    new 0               ; test_read
    send 0              ; --
    push test_write_beh ; test_write_beh
    new 0               ; test_write
    send 0              ; --
    push test_hit_beh   ; test_hit_beh
    new 0               ; test_hit
    send 0              ; --
    push test_miss_beh  ; test_miss_beh
    new 0               ; test_miss
    send 0              ; --
    ref std.commit

test_read_beh:
    push 5              ; 5
    push beh            ; 5 beh
    new 1               ; cell(5)
    push 5              ; cell(5) 5
    push check_read_beh ; cell(5) 5 check_read_beh
    new -1              ; cell(5) check_read(5)
    ref std.send_msg

test_write_beh:
    push 5              ; 5
    push 5              ; 5 5
    push check_read_beh ; 5 5 check_read_beh
    new -1              ; 5 check_read(5)
    push write_tag      ; 5 check_read(5) #write
    push 4              ; 5 check_read(5) #write 4
    push beh            ; 5 check_read(5) #write 4 beh
    new 1               ; 5 check_read(5) #write cell(4)
    send 3              ; --
    ref std.commit

test_hit_beh:
    push 5              ; new=5
    push 4              ; new=5 old=4
    push 5              ; new=5 old=4 expect=5
    ref test_CAS

test_miss_beh:
    push 5              ; new=5
    push 3              ; new=5 old=3
    push 4              ; new=5 old=3 expect=4
    ref test_CAS

test_CAS:               ; new old expect
    push 4              ; new old expect 4
    push beh            ; new old expect 4 beh
    new 1               ; new old expect cell(4)
    roll 2              ; new old cell(4) expect
    pick 2              ; new old cell(4) expect cell(4)
    push check_CAS_beh  ; new old cell(4) expect cell(4) check_CAS_beh
    new 2               ; new old cell(4) check_CAS
    push CAS_tag        ; new old cell(4) check_CAS #CAS
    roll 3              ; new old check_CAS #CAS cell(4)
    send 4              ; --
    ref std.commit

check_CAS_beh:          ; (cell expect) <- value
    msg 0               ; value
    is_eq 4             ; --
    state 1             ; cell
    state 2             ; cell expect
    push check_read_beh ; cell expect check_read_beh
    new -1              ; cell check_read(expect)
    ref std.send_msg

check_read_beh:         ; expect <- cell
    state 0             ; expect
    push assert_eq_beh  ; expect assert_eq_beh
    new -1              ; assert_eq
    push read_tag       ; assert_eq #read
    msg 0               ; assert_eq #read cell
    send 2              ; --
    ref std.commit

assert_eq_beh:          ; expect <- value
    msg 0               ; value
    state 0             ; value expect
    cmp eq              ; value==expect
    is_eq #t            ; --
    ref std.commit

.export
    beh
    read_tag
    write_tag
    CAS_tag
    boot
