# uFork LISP/Scheme Dialect

A LISP/Scheme dialect is implemented
as a surface-syntax for **uFork** programs.
It handles both "interpreted" and "compiled" code.

## Ground Environment

  * `peg-lang`  ; REPL grammar
  * `empty-env`
  * `global-env`
  * `(quote `_expr_`)`
  * `(eval `_expr_` . `_optenv_`)`
  * `(apply `_proc_` `_args_` . `_optenv_`)`
  * `(list . `_values_`)`
  * `(list* `_value_` . `_values_`)`
  * `(lambda `_formal_` . `_body_`)`
  * `(vau `_formal_` `_evar_` . `_body_`)`
  * `(macro `_formal_` . `_body_`)`
  * `(par .  `_exprs_`)`
  * `(seq . `_body_`)`
  * `(define `_formal_` `_value_`)`
  * `(zip `_formal_` `_value_` `_env_`)`
  * `(cons `_head_` `_tail_`)`
  * `(car `_list_`)`
  * `(cdr `_list_`)`
  * `(cadr `_list_`)`
  * `(caar `_list_`)`
  * `(cdar `_list_`)`
  * `(cddr `_list_`)`
  * `(caddr `_list_`)`
  * `(cadar `_list_`)`
  * `(cadddr `_list_`)`
  * `(nth `_index_` `_list_`)`
  * `(null? . `_values_`)`
  * `(pair? . `_values_`)`
  * `(boolean? . `_values_`)`
  * `(number? . `_values_`)`
  * `(symbol? . `_values_`)`
  * `(actor? . `_values_`)`
  * `(if `_test_` `_consequence_` `_alternative_`)`
  * `(cond (`_test_` . `_body_`) . `_clauses_`)`
  * `(eq? . `_values_`)`
  * `(equal? `_value_` `_value_`)`
  * `(= . `_numbers_`)`
  * `(< . `_numbers_`)`
  * `(<= . `_numbers_`)`
  * `(>= . `_numbers_`)`
  * `(> . `_numbers_`)`
  * `(not `_bool_`)`
  * `(and . `_bool_`)`
  * `(or . `_bool_`)`
  * `(+ . `_numbers_`)`
  * `(- . `_numbers_`)`
  * `(* . `_numbers_`)`
  * `(length `_list_`)`
  * `(append . `_lists_`)`
  * `(filter `_pred_` `_list_`)`
  * `(reduce `_binop_` `_zero_` `_list_`)`
  * `(foldl `_binop_` `_zero_` `_list_`)`
  * `(foldr `_binop_` `_zero_` `_list_`)`
  * `(map `_proc_` . `_lists_`)`
  * `(reverse `_list_`)`
  * `(let ((`_var_` `_val_`) . `_bindings_`) . `_body_`)`
  * `(current-env)`
  * `(gensym)`
  * `(print . `_values_`)`
  * `a-print`
  * `(quit)`

### Meta-Actor Facilities

  * `(CREATE `_behavior_`)`
  * `(SEND `_actor_` `_message_`)`
  * `(BECOME `_behavior_`)`
  * `SELF`
  * `(BEH `_formal_` . `_body_`)`
  * `(CALL `_actor_` `_args_`)`

#### Examples

```
(define sink-beh (BEH _))
(define a-sink (CREATE sink-beh))

(define fwd-beh
  (lambda (delegate)
    (BEH message
      (SEND delegate message))))
;(SEND (CREATE (fwd-beh a-print)) '(1 2 3))

(define once-beh
  (lambda (delegate)
    (BEH message
      (SEND delegate message)
      (BECOME sink-beh))))
;(define once (CREATE (once-beh a-print)))
;(par (SEND once 1) (SEND once 2) (SEND once 3))

(define label-beh
  (lambda (cust label)
    (BEH msg
      (SEND cust (cons label msg)))))
;(define b (label-beh a-print 'foo))
;(define a (CREATE b))
;(SEND a '(bar baz))

(define tag-beh
  (lambda (cust)
    (BEH msg
      (SEND cust (cons SELF msg)))))

(define a-crowd
  (CREATE
    (BEH (cust count)
      (if (<= count 0)
        (SEND cust SELF)
        (seq
          (SEND SELF (list cust (- count 1)))
          (SEND SELF (list cust (- count 1)))) ))))
;(SEND a-crowd (list a-print 3))

(define broadcast-beh
  (lambda (value)
    (BEH actors
      (if (pair? actors)
        (seq
          (SEND (car actors) value)
          (SEND SELF (cdr actors))) ))))
;(define a (CREATE (tag-beh a-print)))
;(define b (CREATE (tag-beh a-print)))
;(define c (CREATE (tag-beh a-print)))
;(SEND (CREATE (broadcast-beh 42)) (list a b c))
```

## PEG Tools

  * `(peg-source `_list_`)`
  * `(peg-start `_peg_` `_src_`)`
  * `(peg-chain `_peg_` `_src_`)`
  * `peg-empty`
  * `peg-fail`
  * `peg-any`
  * `(peg-eq `_token_`)`
  * `(peg-or `_first_` `_rest_`)`
  * `(peg-and `_first_` `_rest_`)`
  * `(peg-not `_peg_`)`
  * `(peg-class . `_classes_`)`
  * `(peg-opt `_peg_`)`
  * `(peg-plus `_peg_`)`
  * `(peg-star `_peg_`)`
  * `(peg-alt . `_pegs_`)`
  * `(peg-seq . `_pegs_`)`
  * `(peg-call `_name_`)`
  * `(peg-pred `_pred_` `_peg_`)`
  * `(peg-xform `_func_` `_peg_`)`
  * `(list->number `_chars_`)`
  * `(list->symbol `_chars_`)`

### PEG Derivations

  * `(define peg-end (peg-not peg-any))  ; end of input`
  * `(define peg-peek (lambda (ptrn) (peg-not (peg-not ptrn))))  ; positive lookahead`
  * `(define peg-ok? (lambda (x) (if (pair? x) (if (actor? (cdr x)) #f #t) #f)))`
  * `(define peg-value (lambda (x) (if (pair? x) (if (actor? (cdr x)) #? (car x)) #?)))`

### PEG Structures

Message to Grammar:
```
                                      NIL (on end-of-stream)
--->[custs,context]--->[accum,in]--->  or
      |                  |           [token,next]--->
      v                  v             |
    [ok,fail]                          v
     /    \
    v      v
```

Reply to _ok_ customer:
```
                   NIL (on end-of-stream)
--->[accum,in]--->  or
      |           [token,next]--->
      v             |
                    v
```

Reply to _fail_ customer:
```
     NIL (on end-of-stream)
--->  or
    [token,next]--->
      |
      v
```

### LISP/Scheme Grammar

```
(define lex-eol (peg-eq 10))  ; end of line
(define lex-optwsp (peg-star (peg-class WSP)))
(define scm-to-eol (peg-or lex-eol (peg-and peg-any (peg-call scm-to-eol))))
(define scm-comment (peg-and (peg-eq 59) scm-to-eol))
(define scm-optwsp (peg-star (peg-or scm-comment (peg-class WSP))))
(define lex-eot (peg-not (peg-class DGT UPR LWR SYM)))  ; end of token
```

```
(define lex-sign (peg-or (peg-eq 45) (peg-eq 43)))  ; [-+]
(define lex-digit (peg-or (peg-class DGT) (peg-eq 95)))  ; [0-9_]
(define lex-digits (peg-xform car (peg-and (peg-plus lex-digit) lex-eot)))
(define lex-number (peg-xform list->number (peg-or (peg-and lex-sign lex-digits) lex-digits)))
```

```
(define scm-ignore (peg-xform (lambda _ '_) (peg-and (peg-plus (peg-eq 95)) lex-eot)))
(define scm-const (peg-xform cadr (peg-seq
  (peg-eq 35)
  (peg-alt
    (peg-xform (lambda _ #f) (peg-eq 102))
    (peg-xform (lambda _ #t) (peg-eq 116))
    (peg-xform (lambda _ #?) (peg-eq 63))
    (peg-xform (lambda _ #unit) (peg-seq (peg-eq 117) (peg-eq 110) (peg-eq 105) (peg-eq 116))))
  lex-eot)))
```

```
(define scm-symbol (peg-xform list->symbol (peg-plus (peg-class DGT UPR LWR SYM))))
(define scm-quoted (peg-alt
  (peg-xform (lambda (x) (list 'quote (cdr x)))
    (peg-and (peg-eq 39) (peg-call scm-expr)))
  (peg-xform (lambda (x) (list 'quasiquote (cdr x)))
    (peg-and (peg-eq 96) (peg-call scm-expr)))
  (peg-xform (lambda (x) (list 'unquote-splicing (cddr x)))
    (peg-and (peg-eq 44) (peg-and (peg-eq 64) (peg-call scm-expr))))
  (peg-xform (lambda (x) (list 'unquote (cdr x)))
    (peg-and (peg-eq 44) (peg-call scm-expr)))
  (peg-xform (lambda (x) (list 'placeholder (cdr x)))
    (peg-and (peg-eq 63) (peg-call scm-expr)))
  ))
```

```
(define scm-dotted (peg-xform caddr
  (peg-seq scm-optwsp (peg-eq 46) (peg-call scm-sexpr) scm-optwsp (peg-eq 41))))
(define scm-tail (peg-xform cdr (peg-and
  scm-optwsp
  (peg-or
    (peg-xform (lambda _ ()) (peg-eq 41))
    (peg-and
      (peg-call scm-expr)
      (peg-or scm-dotted (peg-call scm-tail)) )) )))
(define scm-list (peg-xform cdr (peg-and (peg-eq 40) scm-tail)))
(define scm-expr (peg-alt scm-list scm-ignore scm-const lex-number scm-quoted scm-symbol))
(define scm-sexpr (peg-xform cdr (peg-and scm-optwsp scm-expr)))

;(define src (peg-source '(9 40 97 32 46 32 98 41 10)))  ; "\t(a . b)\n"
;(define rv (peg-start scm-sexpr src))
```

### Meta-Actor Execution

```
;
; meta-actor transaction = {t:Fexpr_T, x:self, y:outbox, z:beh}
;

(define meta-actor-beh
  (lambda (beh)
    (BEH msg
      (define txn (cell Fexpr_T SELF () beh))
      (SEND beh (cons txn msg))
      (BECOME (meta-busy-beh txn ())) )))

(define meta-busy-beh
  (lambda (txn pending)
    (BEH msg
      (cond
        ((eq? msg txn)                                        ; end txn
          (define beh (get-z msg))
          (define outbox (get-y msg))
          (map (lambda (x) (SEND (car x) (cdr x))) outbox)    ; (send-msgs outbox)
          (cond
            ((pair? pending)
              (define txn (cell Fexpr_T SELF () beh))
              (SEND beh (cons txn (car pending)))
              (BECOME (meta-busy-beh txn (cdr pending))))
            (#t
              (BECOME (meta-actor-beh beh)))))
        (#t
          (BECOME (meta-busy-beh txn (cons msg pending)))) ))))

(define meta-CREATE                                           ; (CREATE behavior)
  (CREATE
    (BEH (cust . args)
      (SEND cust (CREATE (meta-actor-beh (car args)))) )))

(define meta-SEND                                             ; (SEND actor message)
  (lambda (txn)
    (lambda (actor msg)
      (set-y txn (cons (cons actor msg) (get-y txn))) )))

(define meta-BECOME                                           ; (BECOME behavior)
  (lambda (txn)
    (lambda (beh)
      (set-z txn beh) )))

(define actor-env                                             ; extend environment with actor primitives
  (lambda (txn env)
    (zip
      '(SEND BECOME SELF)
      ((CREATE (meta-SEND txn)) (CREATE (meta-BECOME txn)) (get-x txn))
      env)))
(define a-meta-beh                                            ; actor meta-behavior
  (lambda (frml body env)
    (BEH (txn . msg)
      (define aenv (scope (actor-env txn env)))
      (evbody #unit body (zip frml msg aenv))
      (SEND (get-x txn) txn) )))
(define meta-BEH                                              ; (BEH <frml> . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (CREATE (a-meta-beh (car opnds) (cdr opnds) env))) )))
```

### Assembly-language Tools

#### Values

  * literals: `UNDEF`, `NIL`, `FALSE`, `TRUE`, `UNIT`
  * type-ids: `Literal_T`, `Type_T`, `Event_T`, `Instr_T`, `Actor_T`, `Fixnum_T`, `Symbol_T`, `Pair_T`, `Fexpr_T`, `Free_T`
  * op-codes: `VM_typeq`, `VM_cell`, `VM_get`, `VM_set`, `VM_pair`, `VM_part`, `VM_nth`, `VM_push`, `VM_depth`, `VM_drop`, `VM_pick`, `VM_dup`, `VM_roll`, `VM_alu`, `VM_eq`, `VM_cmp`, `VM_if`, `VM_msg`, `VM_self`, `VM_send`, `VM_new`, `VM_beh`, `VM_end`, `VM_cvt`, `VM_putc`, `VM_getc`, `VM_debug`
  * `VM_get`, `VM_set`: `FLD_T`, `FLD_X`, `FLD_Y`, `FLD_Z`
  * `VM_alu`: `ALU_NOT`, `ALU_AND`, `ALU_OR`, `ALU_XOR`, `ALU_ADD`, `ALU_SUB`, `ALU_MUL`
  * `VM_cmp`: `CMP_EQ`, `CMP_GE`, `CMP_GT`, `CMP_LT`, `CMP_LE`, `CMP_NE`, `CMP_CLS`
  * classes: `CTL`, `DGT`, `UPR`, `LWR`, `DLM`, `SYM`, `HEX`, `WSP`
  * `VM_end`: `END_ABORT`, `END_STOP`, `END_COMMIT`, `END_RELEASE`
  * `VM_cvt`: `CVT_LST_NUM`, `CVT_LST_SYM`
  * continuations: `RV_SELF`, `CUST_SEND`, `SEND_0`, `COMMIT`, `RESEND`, `RELEASE_0`, `RELEASE`, `RV_FALSE`, `RV_TRUE`, `RV_NIL`, `RV_UNDEF`, `RV_UNIT`, `RV_ZERO`, `RV_ONE`

#### Procedures

  * `(cell `_T_` `_X_` `_Y_` `_Z_`)`
  * `(get-t `_cell_`)`
  * `(get-x `_cell_`)`
  * `(get-y `_cell_`)`
  * `(get-z `_cell_`)`
  * `(set-t `_cell_` `_T_`)` **--DEPRECATED--**
  * `(set-x `_cell_` `_X_`)` **--DEPRECATED--**
  * `(set-y `_cell_` `_Y_`)` **--DEPRECATED--**
  * `(set-z `_cell_` `_Z_`)` **--DEPRECATED--**

#### Examples

```
(define print
  (cell Actor_T  ; --DEPRECATED--
    (cell Instr_T VM_msg 1
      (cell Instr_T VM_push a-print
        (cell Instr_T VM_send 0
          RV_UNIT)))
    ()))

(define gensym
  (lambda ()
    (cell Symbol_T (get-x '_) (get-y '_))))

(define disasm
  (lambda (ip)
    (list (get-t ip) (get-x ip) (get-y ip) (get-z ip))))
```
