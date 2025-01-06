;;;
;;; mutable data holder (shareable)
;;;

.import
    dev: "./dev.asm"
    std: "./std.asm"
    lib: "./lib.asm"

read_op:
    ref 0
write_op:
    ref 1
CAS_op:
    ref 2

op_table:
    dict_t read_op read
    dict_t write_op write
    dict_t CAS_op CAS
    ref #nil

beh:
cell_beh:                   ; value <- cust,op,args
    push op_table           ; op_table
    msg 2                   ; op_table op
    dict get                ; op_code
    dup 1                   ; op_code op_code
    typeq #instr_t          ; op_code is_instr(op_code)
    if_not std.abort        ; op_code
    jump                    ; --

read:                       ; value <- cust,#read,_
    state 0                 ; value
    ref std.cust_send

write:                      ; value <- cust,#write,value'
    msg -2                  ; value'
    push cell_beh           ; value' cell_beh
    actor become            ; --
    actor self              ; SELF
    ref std.cust_send

CAS:                        ; value <- cust,#CAS,old,new
    msg 3                   ; old
    state 0                 ; old value
    cmp eq                  ; old==value
    if_not read             ; --
    msg -3                  ; new
    push cell_beh           ; new cell_beh
    actor become            ; --
    ref read

; demonstration

cas_add:                    ; old,inc,cell <- old'
    state 1                 ; old
    msg 0                   ; old old'
    cmp eq                  ; old==old'
    if std.commit           ; --

    state 0                 ; old,inc,cell
    part 2                  ; cell inc old
    drop 1                  ; cell inc
    msg 0                   ; cell inc old'

    dup 2                   ; cell inc old' inc old'
    alu add                 ; cell inc old' new=inc+old'
    pick 2                  ; cell inc old' new old'
    push CAS_op             ; cell inc old' new old' #CAS
    actor self              ; cell inc old' new old' #CAS cust=SELF
    pair 3                  ; cell inc old' cust,#CAS,old',new
    state -2                ; cell inc old' cust,#CAS,old',new cell
    actor send              ; cell inc old'

    pair 2                  ; old',inc,cell
    push cas_add            ; old',inc,cell cas_add
    actor become            ; --
    ref std.commit

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; rcvr=debug_dev
    push lib.once_beh       ; rcvr once_beh
    actor create            ; judge=once_beh.rcvr

    push test               ; judge test
    actor become            ; --
    msg 0                   ; {caps}
    actor self              ; {caps} SELF
    ref std.send_msg

test:                       ; judge <- {caps}
    state 0                 ; judge
    msg 0                   ; judge {caps}
    pair 1                  ; {caps},judge
    push test2              ; {caps},judge test2
    actor become            ; --

    push 0                  ; value=0
    push cell_beh           ; value cell_beh
    actor create            ; cell=cell_beh.value

    push #?                 ; cell _
    push read_op            ; cell _ #read
    state 0                 ; cell _ #read judge
    push 1234               ; cell _ #read judge 1234
    pair 1                  ; cell _ #read 1234,judge
    push validate           ; cell _ #read 1234,judge validate
    actor create            ; cell _ #read cust=validate.1234,judge
    pair 2                  ; cell msg=cust,#read,_

    pick 2                  ; cell msg cust=cell
    push 100                ; cell msg cust delay=0.1s
    pair 2                  ; cell delay,cust,msg
    msg 0                   ; cell delay,cust,msg {caps}
    push dev.timer_key      ; cell delay,cust,msg {caps} timer_key
    dict get                ; cell delay,cust,msg timer_dev
    actor send              ; cell

    push 1000               ; cell value'=1000
    push write_op           ; cell value' #write
    actor self              ; cell value' #write cust=SELF
    pair 2                  ; cell cust,#write,value'
    roll 2                  ; cust,#write,value' cell
    ref std.send_msg

test2:                      ; {caps},judge <- cell
    push 0                  ; old'=0
    msg 0                   ; old' cell
    push 200                ; old' cell inc=200
    push #?                 ; old' cell inc old=#?
    pair 2                  ; old' old,inc,cell
    push cas_add            ; old' old,inc,cell cas_add
    actor create            ; old' cas_add.old,inc,cell
    actor send              ; --

    push 0                  ; old'=0
    msg 0                   ; old' cell
    push 30                 ; old' cell inc=30
    push #?                 ; old' cell inc old=#?
    pair 2                  ; old' old,inc,cell
    push cas_add            ; old' old,inc,cell cas_add
    actor create            ; old' cas_add.old,inc,cell
    actor send              ; --

    push 0                  ; old'=0
    msg 0                   ; old' cell
    push 4                  ; old' cell inc=4
    push #?                 ; old' cell inc old=#?
    pair 2                  ; old' old,inc,cell
    push cas_add            ; old' old,inc,cell cas_add
    actor create            ; old' cas_add.old,inc,cell
    actor send              ; --

    push #f                 ; msg=#f
    state -1                ; msg cust=judge
    push 200                ; msg cust delay=0.2s
    pair 2                  ; delay,cust,msg
    state 1                 ; delay,cust,msg {caps}
    push dev.timer_key      ; delay,cust,msg {caps} timer_key
    dict get                ; delay,cust,msg timer_dev
    ref std.send_msg

validate:                   ; expect,judge <- actual
    state 1                 ; expect
    msg 0                   ; expect actual
    cmp eq                  ; expect==actual
    state -1                ; expect==actual judge
    ref std.send_msg

.export
    beh
    read_op
    write_op
    CAS_op
    boot
    test
