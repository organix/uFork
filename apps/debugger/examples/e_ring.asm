; Joe Armstrong's Erlang challenge:
;   Create a ring of N processes
;   Send M simple messages around the ring
;   Increase N until out of resources

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"
    lib: "https://ufork.org/lib/lib.asm"

;;  CREATE log WITH \_.[ SEND println TO clock ]
;;  DEF build(n, log) AS \(first, m).[
;;      CASE n OF
;;      1 : [
;;          SEND () TO log  # start message passing phase
;;          BECOME ring_0(first, log)
;;          SEND m TO first
;;      ]
;;      _ : [
;;          CREATE next WITH build(sub(n, 1), log)
;;          BECOME ring(next)
;;          SEND (first, m) TO next
;;      ]
;;      END
;;  ]

build:                      ; (n . log) <- (first . m)
    state 1                 ; n
    push 1                  ; n 1
    cmp le                  ; n<=1
    if build_0              ; --

    state 0                 ; (n . log)
    part 1                  ; log n
    push 1                  ; log n 1
    alu sub                 ; log n-1
    pair 1                  ; (n-1 . log)
    push build              ; (n-1 . log) build
    actor create            ; next=build.(n-1 . log)

    dup 1                   ; next next
    push ring               ; next next ring
    actor become            ; next

    msg 0                   ; next (first . m)
    roll 2                  ; (first . m) next
    ref std.send_msg

build_0:
    push #?                 ; #?
    state -1                ; #? log
    actor send              ; --

    state -1                ; log
    msg 1                   ; log first
    pair 1                  ; (first . log)
    push ring_0             ; (first . log) ring_0
    actor become            ; --

    msg 0                   ; (first . m)
    part 1                  ; m first
    ref std.send_msg

;;  DEF ring_0(first, log) AS \m.[
;;      CASE m OF
;;      1 : [
;;          SEND () TO log  # message passing completed
;;          BECOME \_.[]
;;      ]
;;      _ : [
;;          SEND sub(m, 1) TO first
;;      ]
;;      END
;;  ]

ring_0:                     ; (first . log) <- m
    msg 0                   ; m
    eq 1                    ; m==1
    if ring_end             ; --

    msg 0                   ; m
    push 1                  ; m 1
    alu sub                 ; m-1
    state 1                 ; m-1 first
    ref std.send_msg

ring_end:
    push #?                 ; #?
    state -1                ; #? log
    actor send              ; --

    push #?                 ; #?
    push std.sink_beh       ; #? sink_beh
    actor become            ; --
    ref std.commit

;;  DEF ring(next) AS \m.[
;;      SEND m TO next
;;  ]

ring:                       ; next <- m
    msg 0                   ; m
    state 0                 ; m next
    ref std.send_msg

;;  SEND () TO log  # start construction phase
;;  CREATE e_ring WITH build(123456, log)
;;  SEND (e_ring, 789) TO e_ring

; Create a ring of _n_ actors, and send a message around _m_ times.

n:
    ref 500
m:
    ref 10

boot:                       ; _ <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug_dev
    msg 0                   ; debug_dev {caps}
    push dev.clock_key      ; debug_dev {caps} clock_key
    dict get                ; debug_dev clock_dev
    pair 1                  ; (clock_dev . debug_dev)
    push lib.relay_beh      ; (clock_dev . debug_dev) relay_beh
    actor create            ; log=relay_beh.(clock_dev . debug_dev)
    push #?                 ; log #?
    pick 2                  ; log #? log
    actor send              ; log

    push n                  ; log n
    pair 1                  ; (n . log)
    push build              ; (n . log) build
    actor create            ; first=build.(n . log)

    push m                  ; first m
    pick 2                  ; first m first
    pair 1                  ; first (first . m)
    roll 2                  ; (first . m) first
    ref std.send_msg

.export
    build
    boot
