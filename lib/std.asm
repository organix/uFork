;
; The uFork standard library
;

; Status Codes

E_OK:                       ; not an error
    ref 0
E_FAIL:                     ; general failure
    ref -1
E_BOUNDS:                   ; out of bounds
    ref -2
E_NO_MEM:                   ; no memory available
    ref -3
E_NOT_FIX:                  ; fixnum required
    ref -4
E_NOT_CAP:                  ; capability required
    ref -5
E_NOT_PTR:                  ; memory pointer required
    ref -6
E_NOT_ROM:                  ; ROM pointer required
    ref -7
E_NOT_RAM:                  ; RAM pointer required
    ref -8
E_NOT_EXE:                  ; instruction required
    ref -9
E_NO_TYPE:                  ; type required
    ref -10
E_MEM_LIM:                  ; Sponsor memory limit reached
    ref -11
E_CPU_LIM:                  ; Sponsor instruction limit reached
    ref -12
E_MSG_LIM:                  ; Sponsor event limit reached
    ref -13
E_ASSERT:                   ; assertion failed
    ref -14
E_STOP:                     ; actor stopped
    ref -15
E_ABORT:                    ; actor transaction aborted
    ref -16

; Common Tail-Sequences

cust_send:                  ; msg
    msg 1                   ; msg cust
send_msg:                   ; msg cust
    actor send              ; --
sink_beh:                   ; _ <- _
commit:
    end commit

rv_self:                    ; _ <- cust,_
    actor self cust_send    ; msg=SELF

rv_undef:                   ; _ <- cust,_
    push #? cust_send       ; msg=#?

rv_nil:                     ; _ <- cust,_
    push #nil cust_send     ; msg=#nil

rv_false:                   ; _ <- cust,_
    push #f cust_send       ; msg=#f

rv_true:                    ; _ <- cust,_
    push #t cust_send       ; msg=#t

rv_zero:                    ; _ <- cust,_
    push 0 cust_send        ; msg=0

rv_one:                     ; _ <- cust,_
    push 1 cust_send        ; msg=1

resend:                     ; _ <- msg
    msg 0                   ; msg
    actor self              ; msg cust=SELF
    ref send_msg

stop:
    end stop

abort:
    push #?
    end abort

; Call/Return Procedure Helpers

return_value:               ; k rv
    roll 2                  ; rv k
    return                  ; rv

return_undef:               ; k
    push #?                 ; k rv=#?
    ref return_value

return_nil:                 ; k
    push #nil               ; k rv=#nil
    ref return_value

return_false:               ; k
    push #f                 ; k rv=#f
    ref return_value

return_true:                ; k
    push #t                 ; k rv=#t
    ref return_value

return_zero:                ; k
    push 0                  ; k rv=0
    ref return_value

return_one:                 ; k
    push 1                  ; k rv=1
    ref return_value

.export
    E_OK
    E_FAIL
    E_BOUNDS
    E_NO_MEM
    E_NOT_FIX
    E_NOT_CAP
    E_NOT_PTR
    E_NOT_ROM
    E_NOT_RAM
    E_NOT_EXE
    E_NO_TYPE
    E_MEM_LIM
    E_CPU_LIM
    E_MSG_LIM
    E_ASSERT
    E_STOP
    cust_send
    send_msg
    sink_beh
    commit
    rv_self
    rv_undef
    rv_nil
    rv_false
    rv_true
    rv_zero
    rv_one
    resend
    stop
    abort
    return_value
    return_undef
    return_nil
    return_false
    return_true
    return_zero
    return_one
