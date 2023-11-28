;;;
;;; mutable data holder (shareable)
;;;

.import
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
cell_beh:               ; (value) <- (tag cust . req)
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
    msg -3              ; (new)
    my beh              ; (new) beh
    beh -1              ; --
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
    push test_overlap   ; test_overlap
    new 0               ; test_overlap.()
    send 0              ; --
    ref std.commit

test_read_beh:
    push 5              ; 5
    push cell_beh       ; 5 cell_beh
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
    push cell_beh       ; 5 check_read(5) #write 4 cell_beh
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
    push cell_beh       ; new old expect 4 cell_beh
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
    assert 4            ; --
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
    assert #t           ; --
    ref std.commit

test_overlap:           ; () <- ()
    push 4              ; 4
    push cell_beh       ; 4 cell_beh
    new 1               ; cell=cell_beh.(4)
    dup 1               ; cell cell
    push cell_set_bit   ; cell cell cell_set_bit
    new 1               ; cell svc1=cell_set_bit.(cell)
    pick 2              ; cell svc1 cell
    push cell_set_bit   ; cell svc1 cell cell_set_bit
    new 1               ; cell svc1 svc2=cell_set_bit.(cell)
    push 7              ; cell svc1 svc2 7
    roll 4              ; svc1 svc2 7 cell
    push cell_verify    ; svc1 svc2 7 cell cell_verify
    new 2               ; t_svc=svc1 h_svc=svc2 cust=cell_verify(cell 7)

    push fork.beh       ; t_svc h_svc cust fork_beh
    new 3               ; fork.(cust h_svc t_svc)
    push #nil           ; fork ()
    push 2              ; fork () 2
    pair 1              ; fork (2)
    push #nil           ; fork (2) ()
    push 1              ; fork (2) () 1
    pair 1              ; fork (2) (1)
    pair 1              ; fork ((1) . (2))
    roll 2              ; ((1) . (2)) fork
    ref std.send_msg

cell_set_bit:           ; (cell) <- (cust bit)
    msg 1               ; cust
    state 1             ; cust cell
    msg 2               ; cust cell bit
    push #?             ; cust cell bit old=#?
    push cell_try_bit   ; cust cell bit old cell_try_bit
    new 4               ; cust'=cell_try_bit.(old bit cell cust)
    push read_tag       ; cust' tag=read_tag
    state 1             ; cust' tag cell
    send 2              ; --
    ref std.commit

cell_try_bit:           ; (old bit cell cust) <- val
    msg 0               ; val
    state 1             ; val old
    cmp eq              ; val==old
    if set_bit_done
    msg 0               ; val
    state 2             ; val bit
    alu or              ; new=val|bit
    msg 0               ; new old=val
    my self             ; new old cust=SELF
    push CAS_tag        ; new old cust tag=CAS_tag
    state 3             ; new old cust tag cell
    send 4              ; --
    state -1            ; (bit cell cust)
    msg 0               ; (bit cell cust) old'=val
    pair 1              ; (old' bit cell cust)
    my beh              ; (old' bit cell cust) beh
    beh -1              ; --
    ref std.commit
set_bit_done:
    msg 0               ; val
    state 4             ; val cust
    ref std.send_msg

cell_verify:            ; (cell expect) <- _
    state 2             ; expect
    push assert_eq_beh  ; expect assert_eq_beh
    new -1              ; cust=assert_eq_beh.expect
    push read_tag       ; cust tag=read_tag
    state 1             ; cust tag cell
    send 2              ; --
    ref std.commit

.export
    beh
    read_tag
    write_tag
    CAS_tag
    boot
