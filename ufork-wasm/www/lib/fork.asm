;;;
;;; fork/join concurrency pattern
;;;

.import
    std: "./std.asm"
    lib: "./lib.asm"

;;  LET fork_beh(cust, h_svc, t_svc) = \(h_req, t_req).[
;;      CREATE t_tag WITH tag_beh(SELF)
;;      CREATE h_tag WITH tag_beh(SELF)
;;      SEND (t_tag, t_req) TO t_svc
;;      SEND (h_tag, h_req) TO h_svc
;;      BECOME join_beh(cust, h_tag, t_tag)
;;  ]
beh:
fork_beh:               ; (cust h_svc t_svc) <- (h_req . t_req)
    my self             ; SELF
    push lib.tag_beh    ; SELF tag_beh
    new 1               ; t_tag=tag.(SELF)

    my self             ; t_tag SELF
    push lib.tag_beh    ; t_tag SELF tag_beh
    new 1               ; t_tag h_tag=tag.(SELF)

    msg -1              ; t_tag h_tag t_req
    pick 3              ; t_tag h_tag t_req t_tag
    pair 1              ; t_tag h_tag (t_tag . t_req)
    state 3             ; t_tag h_tag (t_tag . t_req) t_svc
    send -1             ; t_tag h_tag

    msg 1               ; t_tag h_tag h_req
    pick 2              ; t_tag h_tag h_req h_tag
    pair 1              ; t_tag h_tag (h_tag . h_req)
    state 2             ; t_tag h_tag (h_tag . h_req) h_svc
    send -1             ; t_tag h_tag

    state 1             ; t_tag h_tag cust
    push join_beh       ; t_tag h_tag cust join_beh
    beh 3               ; --
    ref std.commit

;;  LET join_beh(cust, h_tag, t_tag) = \msg.[
;;      CASE msg OF
;;      ($h_tag, head) : [
;;          BECOME \($t_tag, tail).[
;;              SEND (head, tail) TO cust
;;          ]
;;      ]
;;      ($t_tag, tail) : [
;;          BECOME \($h_tag, head).[
;;              SEND (head, tail) TO cust
;;          ]
;;      ]
;;      END
;;  ]
join_beh:               ; (cust h_tag t_tag) <- (tag . res)
    msg 1               ; tag
    state 2             ; h_tag
    cmp eq              ; tag==h_tag
    if_not join_1       ; --

    state 0             ; (cust h_tag t_tag)
    msg -1              ; (cust h_tag t_tag) head=res
    pair 1              ; (head cust h_tag t_tag)
    push join_t         ; (head cust h_tag t_tag) join_t
    beh -1              ; --
    ref std.commit

join_1:                 ; --
    msg 1               ; tag
    state 3             ; t_tag
    cmp eq              ; tag==t_tag
    if_not std.stop     ; --

    state 0             ; (cust h_tag t_tag)
    msg -1              ; (cust h_tag t_tag) tail=res
    pair 1              ; (tail cust h_tag t_tag)
    push join_h         ; (tail cust h_tag t_tag) join_h
    beh -1              ; --
    ref std.commit

join_h:                 ; (tail cust h_tag t_tag) <- (tag . head)
    msg 1               ; tag
    state 3             ; tag h_tag
    cmp eq              ; tag==h_tag
    if_not std.stop     ; --

    state 1             ; tail
    msg -1 join_2       ; tail head

join_t:                 ; (head cust h_tag t_tag) <- (tag . tail)
    msg 1               ; tag
    state 4             ; tag t_tag
    cmp eq              ; tag==t_tag
    if_not std.stop     ; --

    msg -1              ; tail
    state 1 join_2      ; tail head

join_2:                 ; tail head
    pair 1              ; (head . tail)
    state 2             ; (head . tail) cust
    ref std.send_msg

; unit test suite
boot:                   ; () <- {caps}
    push -42            ; -42
    push lib.const_beh  ; -42 const_beh
    new -1              ; t_svc=const.-42

    push 42             ; t_svc 42
    push lib.memo_beh   ; t_svc 1 memo_beh
    new 1               ; t_svc h_svc=memo.(42)

    push verify         ; t_svc h_svc verify
    new 0               ; t_svc h_svc cust=verify.()

    push fork_beh       ; t_svc h_svc cust fork_beh
    new 3               ; fork.(cust h_svc t_svc)
    push #nil           ; fork ()
    push #nil           ; fork () ()
    pair 1              ; fork (() . ())
    roll 2              ; (() . ()) fork
    ref std.send_msg

verify:                 ; () <- (42 . -42)
    msg 1               ; 42
    assert 42           ; --
    msg -1              ; -42
    assert -42          ; --
    ref std.commit

.export
    beh
    boot
