; Some hand-assembled Humus behaviors, exhibiting a proposed compilation
; strategy. This example was chosen to highlight the role-agnostic compilation
; of closures, and how they capture their environment.

; DEF top_beh(p) AS \(cust, q).[
;     SEND add(p, q) TO next
;     CREATE next WITH \r.[
;         SEND (p, q, r) TO cust
;     ]
; ]
; CREATE top WITH top_beh(1)
; SEND (println, 2) TO top

.import
    dev: "https://ufork.org/lib/dev.asm"
    hum: "https://ufork.org/lib/hum.asm"
    std: "https://ufork.org/lib/std.asm"

next_code:                  ; args k env=((cust . q) p)

; Assemble the (p, q, r) tuple from the message and captured environments.

    pick 3                  ; args k env r=args
    pick 2                  ; args k env r env
    nth 1                   ; args k env r (cust . q)
    nth -1                  ; args k env r q
    pick 3                  ; args k env r q env
    nth 2                   ; args k env r q p
    pair 2                  ; args k env msg=(p q . r)

; Send the tuple to the customer.

    pick 2                  ; args k env msg env
    nth 1                   ; args k env msg (cust . q)
    nth 1                   ; args k env msg cust
    send -1                 ; args k env
    roll 3                  ; k env args
    drop 2                  ; k
    return

top_code:                   ; args k env=(p)

; Construct the message to be sent to the 'next' actor.

    pick 1                  ; args k env (p)
    nth 1                   ; args k env p
    pick 4                  ; args k env p (cust . q)
    nth -1                  ; args k env p q
    alu add                 ; args k env msg=p+q

; Make the 'next' actor.

    push next_code          ; args k env msg next_code
    pick 3                  ; args k env msg next_code env
    pick 6                  ; args k env msg next_code env args
    pair 1                  ; args k env msg next_code env'=(args . env)
    call hum.make_closure   ; args k env msg closure
    push hum.closure_beh    ; args k env msg closure beh
    new -1                  ; args k env msg next=beh.closure

; Send it the message.

    send -1                 ; args k env
    drop 1                  ; args k
    roll 2                  ; k args
    drop 1                  ; k
    return

boot:                       ; () <- {caps}

; Construct the message to be sent to the 'top' actor.
; The debug device will receive the reply.

    push 2                  ; q=2
    msg 0                   ; q {caps}
    push dev.debug_key      ; q {caps} debug_key
    dict get                ; q cust=debug
    pair 1                  ; msg=(cust . q)

; Create the 'top' actor.

    push top_code           ; msg code=top_code
    push #nil               ; msg code ()
    push 1                  ; msg code () 1
    pair 1                  ; msg code env=(1)
    call hum.make_closure   ; msg top_closure
    push hum.closure_beh    ; msg top_closure beh
    new -1                  ; msg top=top_closure.beh

; Send it the message.

    send -1                 ; --
    ref std.commit

.export
    boot
