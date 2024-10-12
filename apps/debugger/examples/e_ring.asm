; Joe Armstrong's Erlang challenge:
;   Create a ring of N processes
;   Send M simple messages around the ring
;   Increase N until out of resources

.import
    std: "https://ufork.org/lib/std.asm"
    dev: "https://ufork.org/lib/dev.asm"

;;  CREATE log WITH stopwatch(clock, println)

stopwatch:                  ; (clock_dev . debug_dev) <- _
    state 0                 ; (clock_dev . debug_dev)
    part 1                  ; debug_dev clock_dev
    ref std.send_msg

;;  DEF build(n, log) AS \(first, m).[
;;      CASE m OF
;;      1 : [
;;          SEND () TO log
;;          BECOME ring_0(first, log)
;;          SEND m TO first  # start message passing phase
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
    new -1                  ; next=build.(n-1 . log)

    dup 1                   ; next next
    push ring               ; next next ring
    beh -1                  ; next

    msg 0                   ; next (first . m)
    roll 2                  ; (first . m) next
    ref std.send_msg

build_0:
    state -1                ; log
    send 0                  ; --

    state -1                ; log
    msg 1                   ; log first
    pair 1                  ; (first . log)
    push ring_0             ; (first . log) ring_0
    beh -1                  ; --

    msg 0                   ; (first . m)
    part 1                  ; m first
    ref std.send_msg

;;  DEF ring_0(first, log) AS \m.[
;;      CASE m OF
;;      1 : [
;;          SEND () TO log
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
    state -1                ; log
    send 0                  ; --

    push std.sink_beh       ; sink_beh
    beh 0                   ; --
    ref std.commit

;;  DEF ring(next) AS \m.[
;;      SEND m TO next
;;  ]

ring:                       ; next <- m
    msg 0                   ; m
    state 0                 ; m next
    ref std.send_msg

;;  SEND () TO log
;;  CREATE e_ring WITH build(123456, log)
;;  SEND (e_ring, 789) TO e_ring

; Create a ring of _n_ actors, and send a message around _m_ times.

n:
    ref 500
m:
    ref 10

boot:                       ; () <- {caps}
    msg 0                   ; {caps}
    push dev.debug_key      ; {caps} debug_key
    dict get                ; debug_dev
    msg 0                   ; debug_dev {caps}
    push dev.clock_key      ; debug_dev {caps} clock_key
    dict get                ; debug_dev clock_dev
    pair 1                  ; (clock_dev . debug_dev)
    push stopwatch          ; (clock_dev . debug_dev) stopwatch
    new -1                  ; log=stopwatch.(clock_dev . debug_dev)
    dup 1                   ; log log
    send 0                  ; log

    push n                  ; log n
    pair 1                  ; (n . log)
    push build              ; (n . log) build
    new -1                  ; first=build.(n . log)

    push m                  ; first m
    pick 2                  ; first m first
    pair 1                  ; first (first . m)
    roll 2                  ; (first . m) first
    ref std.send_msg

.export
    build
    boot
