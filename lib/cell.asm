;;;
;;; mutable data holder (shareable)
;;;

.import
    assert_eq: "./testing/assert_eq.asm"
    std: "./std.asm"
    fork: "./fork.asm"

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
beh:
cell_beh:                   ; value <- (tag cust . req)
    msg 1                   ; tag
    eq read_tag             ; tag==read
    if read                 ; --
    msg 1                   ; tag
    eq write_tag            ; tag==write
    if write                ; --
    msg 1                   ; tag
    eq CAS_tag              ; tag==CAS
    if CAS                  ; --
    ref std.abort

read:                       ; value <- (tag cust)
    state 0                 ; value
    msg 2                   ; value cust
    ref std.send_msg

write:                      ; value <- (tag cust . value')
    msg -2                  ; value'
    push cell_beh           ; value' cell_beh
    beh -1                  ; --
    my self                 ; SELF
    msg 2                   ; SELF cust
    ref std.send_msg

CAS:                        ; value <- (tag cust old . new)
    msg 3                   ; old
    state 0                 ; old value
    cmp eq                  ; old==value
    if_not read             ; --
    msg -3                  ; new
    push cell_beh           ; new cell_beh
    beh -1                  ; --
    ref read

; unit test suite
boot:
    call test_read          ; --
    call test_write         ; --
    call test_hit           ; --
    call test_miss          ; --
    call test_overlap       ; --
    ref std.commit

test_read:                  ; ( -- )
    push 5                  ; k 5
    push cell_beh           ; k 5 cell_beh
    new -1                  ; k cell(5)
    push 5                  ; k cell(5) 5
    push check_read_beh     ; k cell(5) 5 check_read_beh
    new -1                  ; k cell(5) check_read(5)
    send -1                 ; k
    return

test_write:                 ; ( -- )
    push 5                  ; k 5
    dup 1                   ; k 5 5
    push check_read_beh     ; k 5 5 check_read_beh
    new -1                  ; k 5 check_read(5)
    push write_tag          ; k 5 check_read(5) #write
    pair 2                  ; k msg=(#write check_read(5) . 5)
    push 4                  ; k msg 4
    push cell_beh           ; k msg 4 cell_beh
    new -1                  ; k msg cell(4)
    send -1                 ; k
    return

test_hit:                   ; ( -- )
    push 5                  ; k new=5
    push 4                  ; k new=5 old=4
    push 5                  ; k new=5 old=4 expect=5
    call test_CAS           ; k
    return

test_miss:                  ; ( -- )
    push 5                  ; k new=5
    push 3                  ; k new=5 old=3
    push 4                  ; k new=5 old=3 expect=4
    call test_CAS           ; k
    return

test_CAS:                   ; ( new old expect -- )
    roll -4                 ; k new old expect
    push 4                  ; k new old expect 4
    push cell_beh           ; k new old expect 4 cell_beh
    new -1                  ; k new old expect cell(4)
    roll -4                 ; k cell(4) new old expect
    pick 4                  ; k cell(4) new old expect cell(4)
    pair 1                  ; k cell(4) new old state=(cell(4) . expect)
    push check_CAS_beh      ; k cell(4) new old state check_CAS_beh
    new -1                  ; k cell(4) new old check_CAS
    push CAS_tag            ; k cell(4) new old check_CAS #CAS
    pair 3                  ; k cell(4) msg=(#CAS check_CAS old . new)
    roll 2                  ; k msg cell(4)
    send -1                 ; k
    return

check_CAS_beh:              ; (cell . expect) <- value
    msg 0                   ; value
    assert 4                ; --
    state 1                 ; cell
    state -1                ; cell expect
    push check_read_beh     ; cell expect check_read_beh
    new -1                  ; cell check_read(expect)
    ref std.send_msg

check_read_beh:             ; expect <- cell
    push #nil               ; ()
    state 0                 ; () expect
    push assert_eq.beh      ; () expect assert_eq_beh
    new -1                  ; () cust=assert_eq
    push read_tag           ; () cust #read
    pair 2                  ; (#read cust)
    msg 0                   ; (#read cust) cell
    send -1                 ; --
    ref std.commit

test_overlap:               ; ( -- )
    push 4                  ; k 4
    push cell_beh           ; k 4 cell_beh
    new -1                  ; k cell=cell_beh.(4)
    dup 1                   ; k cell cell
    push cell_set_bit       ; k cell cell cell_set_bit
    new -1                  ; k cell t_svc=cell_set_bit.cell
    pick 2                  ; k cell t_svc cell
    push cell_set_bit       ; k cell t_svc cell cell_set_bit
    new -1                  ; k cell t_svc h_svc=cell_set_bit.cell
    push 7                  ; k cell t_svc h_svc expect=7
    roll 4                  ; k t_svc h_svc expect cell
    pair 1                  ; k t_svc h_svc (cell . expect)
    push cell_verify        ; k t_svc h_svc (cell . expect) cell_verify
    new -1                  ; k t_svc h_svc cust=cell_verify.(cell . expect)
    pair 2                  ; k (cust h_svc . t_svc)
    push fork.beh           ; k (cust h_svc . t_svc) fork_beh
    new -1                  ; k fork.(cust h_svc . t_svc)
    push 2                  ; k fork 2
    push 1                  ; k fork 2 1
    pair 1                  ; k fork (1 . 2)
    roll 2                  ; k (1 . 2) fork
    send -1                 ; k
    return

cell_set_bit:               ; cell <- (cust . bit)
    push #nil               ; ()
    msg 1                   ; () cust
    state 0                 ; () cust cell
    msg -1                  ; () cust cell bit
    push #?                 ; () cust cell bit old=#?
    pair 3                  ; () (old bit cell . cust)
    push cell_try_bit       ; () (old bit cell . cust) cell_try_bit
    new -1                  ; () cust'=cell_try_bit.(old bit cell . cust)
    push read_tag           ; () cust' tag=read_tag
    pair 2                  ; (#read cust')
    state 0                 ; (#read cust') cell
    send -1                 ; --
    ref std.commit

cell_try_bit:               ; (old bit cell . cust) <- val
    msg 0                   ; val
    state 1                 ; val old
    cmp eq                  ; val==old
    if set_bit_done
    msg 0                   ; val
    state 2                 ; val bit
    alu or                  ; new=val|bit
    msg 0                   ; new old=val
    my self                 ; new old cust=SELF
    push CAS_tag            ; new old cust tag=CAS_tag
    pair 3                  ; (#CAS cust old . new)
    state 3                 ; (#CAS cust old . new) cell
    send -1                 ; --
    state -1                ; (bit cell . cust)
    msg 0                   ; (bit cell . cust) old'=val
    pair 1                  ; (old' bit cell . cust)
    push cell_try_bit       ; (old' bit cell . cust) cell_try_bit
    beh -1                  ; --
    ref std.commit
set_bit_done:
    msg 0                   ; val
    state -3                ; val cust
    ref std.send_msg

cell_verify:                ; (cell . expect) <- _
    push #nil               ; ()
    state -1                ; () expect
    push assert_eq.beh      ; () expect assert_eq_beh
    new -1                  ; () cust=assert_eq_beh.expect
    push read_tag           ; () cust tag=read_tag
    pair 2                  ; (#read cust)
    state 1                 ; (#read cust) cell
    send -1                 ; --
    ref std.commit

.export
    beh
    read_tag
    write_tag
    CAS_tag
    boot
