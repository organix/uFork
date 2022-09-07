# uFork (Actor Virtual Machine)

The **uFork** Actor Virtual Machine performs
interleaved execution of threaded instruction streams.
Instruction streams are not assumed to be
arranged in consecutive memory locations.
Instead, each instruction contains a "pointer"
to the subsequent instruction,
or multiple pointers in the case of conditionals, etc.

This is combined with a lightweight computational context
(such as IP+SP) that makes it efficient
to enqueue the context after each instruction.
Then the next context can be dequeued and executed.
Thus an arbitrary number of instruction streams can be executed,
interleaved at the instruction level.

This interleaved instruction execution engine
is used to service an actor message-event queue.
If the target of the event at the head of the queue
is not already busy handling a prior event,
a new computational context (continuation, or "thread")
is created (and added to the continuation queue)
to execute instructions in the target actor's behavior.
If the event target is busy,
the event is recycled to the tail of the queue.
Since asynchronous actor messages may be arbitrarily delayed,
this does not change the semantics.

Effects caused by an actor's behavior (send, create, and become)
are applied to the system in an all-or-nothing transaction.
The instruction stream defining the actor's behavior
will end with a "commit" or "abort" instruction,
at which time transactional effects will either be applied or discarded.
Since these instructions have no "next instruction" field,
there is nothing to put on the continuation queue
and the stream ends (the "thread" dies).

The blog post
"[Memory Safety Simplifies Microprocessor Design](http://www.dalnefre.com/wp/2022/08/memory-safety-simplifies-microprocessor-design/)"
describes this architecture,
and the rationale behind it.

## Representation

The quad-cell is the primary internal data-structure in **uFork**.
It consists of four integers (current compile options are 16, 32, and 64 bits).

 t        | x        | y        | z
----------|----------|----------|----------
type/proc | head/car | tail/cdr | link/next

The integers in each field encode three basic types of value,
based on their 2 most-significant bits (MSBs).
The 1st MSB is {0=indirect-reference, 1=direct-value}
The 2nd MSB is {0=transparent, 1=opaque},
and only applies to references.

2-MSB | Interpretation
------|---------------
2#00  | quad-cell reference (with fields {_t_, _x_, _y_, _z_})
2#01  | capability (opaque reference value)
2#10  | positive direct integer (fixnum)
2#11  | negative direct integer (fixnum)

Direct integer values (fixnums) are stored in 2's-complement representation,
where the 2nd MSB is the sign bit of the integer value.

### Virtual Machine

The **uFork** _virtual machine_ is designed to support machine-level actors.
All instructions execute within the context of an actor handling a message-event.
There is no support for procedure/function call/return.
Instead actors are used to implement procedure/function abstractions.
There is no support for address arithmatic or load/store of arbitrary memory.
Mutation is always local to an actor's private state.
Immutable values are passed between actors via message-events.
External events (such as "interrupts")
are turned into message-events.

#### Data Structures

Quad-cells are used to encode most of the important data-structures in uFork.

 Structure                              | Description
----------------------------------------|---------------------------------
{t:Event_T, x:target, y:msg, z:next}    | actor event queue entry
{t:IP, x:SP, y:EP, z:next}              | continuation queue entry
{t:Opcode_T, x:opcode, y:data, z:next}  | machine instruction (typical)
{t:Symbol_T, x:hash, y:string, z:value} | immutable symbolic-name
{t:Pair_T, x:head, y:tail}              | pair-lists of user data (cons)
{t:Pair_T, x:item, y:rest}              | stack entry holding _item_
{t:Actor_T, x:beh, y:sp, z:?}           | idle actor
{t:Actor_T, x:beh', y:sp', z:events}    | busy actor, intially {z:()}
{t:Fexpr_T, x:actor, y:?, z:?}          | interpreter (cust ast env)
{t:Fexpr_T, x:self, y:msgs, z:beh}      | meta-actor transaction
{t:Free_T, z:next}                      | cell in the free-list

#### Instructions

The uFork instruction execution engine implements a linked-stack machine,
however the stack is only used for local state in a computation.
The _input_ for each instruction is taken from the stack
and the _output_ is placed back onto the stack.
Instructions all have a `t` field containing `Opcode_T` type marker.
The operation code is carried in the `x` field of the instruction.
Many instructions also have an immediate value,
usually carried in the `y` field of the instruction.
For the typical case of a instruction with a single continuation,
the "next instruction" is carried in the `z` field of the instruction.

 Input            | Instruction                   | Output   | Description
------------------|-------------------------------|----------|------------------------------
_v_               | {x:VM_typeq, y:_T_, z:_K_}    | _bool_   | `TRUE` if _v_ has type _T_, otherwise `FALSE`
_T_               | {x:VM_cell, y:1, z:_K_}       | _cell_   | create cell {t:_T_}
_T_ _X_           | {x:VM_cell, y:2, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_}
_T_ _X_ _Y_       | {x:VM_cell, y:3, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_, y:_Y_}
_T_ _X_ _Y_ _Z_   | {x:VM_cell, y:4, z:_K_}       | _cell_   | create cell {t:_T_, x:_X_, y:_Y_, z:_Z_}
_cell_            | {x:VM_get, y:T, z:_K_}        | _t_      | get _t_ from _cell_
_cell_            | {x:VM_get, y:X, z:_K_}        | _x_      | get _x_ from _cell_
_cell_            | {x:VM_get, y:Y, z:_K_}        | _y_      | get _y_ from _cell_
_cell_            | {x:VM_get, y:Z, z:_K_}        | _z_      | get _z_ from _cell_
_cell_ _T_        | {x:VM_set, y:T, z:_K_}        | _cell'_  | set _t_ to _T_ in _cell_
_cell_ _X_        | {x:VM_set, y:X, z:_K_}        | _cell'_  | set _x_ to _X_ in _cell_
_cell_ _Y_        | {x:VM_set, y:Y, z:_K_}        | _cell'_  | set _y_ to _Y_ in _cell_
_cell_ _Z_        | {x:VM_set, y:Z, z:_K_}        | _cell'_  | set _z_ to _Z_ in _cell_
... _tail_ _head_ | {x:VM_pair, y:_n_, z:_K_}     | _pair_   | create {t:Pair_T, x:_head_, y:_tail_} (_n_ times)
_pair_            | {x:VM_part, y:_n_, z:_K_}     | ... _tail_ _head_ | split _pair_ into _head_ and _tail_ (_n_ times)
_pair_            | {x:VM_nth, y:_n_, z:_K_}      | _item_<sub>_n_</sub> | extract item _n_ from a _pair_ list
_pair_            | {x:VM_nth, y:-_n_, z:_K_}     | _tail_<sub>_n_</sub> | extract tail _n_ from a _pair_ list
&mdash;           | {x:VM_push, y:_value_, z:_K_} | _value_  | push literal _value_ on stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_depth, z:_K_} | _v_<sub>_n_</sub> ... _v_<sub>1</sub> _n_ | count items on stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_drop, y:_n_, z:_K_} | &mdash; | remove _n_ items from stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_pick, y:_n_, z:_K_} | _v_<sub>_n_</sub> ... _v_<sub>1</sub> _v_<sub>_n_</sub> | copy item _n_ to top of stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_dup, y:_n_, z:_K_} |_v_<sub>_n_</sub> ... _v_<sub>1</sub> _v_<sub>_n_</sub> ... _v_<sub>1</sub> | duplicate _n_ items on stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_roll, y:_n_, z:_K_} | _v_<sub>_n_-1</sub> ... _v_<sub>1</sub> _v_<sub>_n_</sub> | roll item _n_ to top of stack
_v_<sub>_n_</sub> ... _v_<sub>1</sub> | {x:VM_roll, y:-_n_, z:_K_} | _v_<sub>1</sub> _v_<sub>_n_</sub> ... _v_<sub>2</sub> | roll top of stack to item _n_
_n_               | {x:VM_alu, y:NOT, z:_K_}      | ~_n_     | bitwise not _n_
_n_ _m_           | {x:VM_alu, y:AND, z:_K_}      | _n_&_m_  | bitwise _n_ and _m_
_n_ _m_           | {x:VM_alu, y:OR, z:_K_}       | _n_\|_m_ | bitwise _n_ or _m_
_n_ _m_           | {x:VM_alu, y:XOR, z:_K_}      | _n_^_m_  | bitwise _n_ exclusive-or _m_
_n_ _m_           | {x:VM_alu, y:ADD, z:_K_}      | _n_+_m_  | sum of _n_ and _m_
_n_ _m_           | {x:VM_alu, y:SUB, z:_K_}      | _n_-_m_  | difference of _n_ and _m_
_n_ _m_           | {x:VM_alu, y:MUL, z:_K_}      | _n_\*_m_ | product of _n_ and _m_
_m_               | {x:VM_eq, y:_n_, z:_K_}       | _bool_   | `TRUE` if _n_ == _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:EQ, z:_K_}       | _bool_   | `TRUE` if _n_ == _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:GE, z:_K_}       | _bool_   | `TRUE` if _n_ >= _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:GT, z:_K_}       | _bool_   | `TRUE` if _n_ > _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:LT, z:_K_}       | _bool_   | `TRUE` if _n_ < _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:LE, z:_K_}       | _bool_   | `TRUE` if _n_ <= _m_, otherwise `FALSE`
_n_ _m_           | {x:VM_cmp, y:NE, z:_K_}       | _bool_   | `TRUE` if _n_ != _m_, otherwise `FALSE`
_n_ _c_           | {x:VM_cmp, y:CLS, z:_K_}      | _bool_   | `TRUE` if _n_ in _c_, otherwise `FALSE`
_bool_            | {x:VM_if, y:_T_, z:_F_}       | &mdash;  | continue _F_ if `FALSE`, otherwise continue _T_
&mdash;           | {x:VM_msg, y:0, z:_K_}        | _msg_    | copy event message to stack
&mdash;           | {x:VM_msg, y:_n_, z:_K_}      | _msg_<sub>_n_</sub> | copy message item _n_ to stack
&mdash;           | {x:VM_msg, y:-_n_, z:_K_}     | _tail_<sub>_n_</sub> | copy message tail _n_ to stack
&mdash;           | {x:VM_self, z:_K_}            | _actor_  | push current _actor_ on stack
_msg_ _actor_     | {x:VM_send, y:0, z:_K_}       | &mdash;  | send _msg_ to _actor_
_m_<sub>_n_</sub> ... _m_<sub>1</sub> _actor_ | {x:VM_send, y:_n_, z:_K_}   | &mdash; | send (_m_<sub>1</sub> ... _m_<sub>_n_</sub>) to _actor_
_beh_             | {x:VM_new, y:0, z:_K_}        | _actor_  | create new _actor_ with behavior _beh_
_v_<sub>1</sub> ... _v_<sub>_n_</sub> _beh_ | {x:VM_new, y:_n_, z:_K_} | _actor_ | create new _actor_ with (_v_<sub>1</sub> ... _v_<sub>_n_</sub> . _beh_)
_beh_             | {x:VM_beh, y:0, z:_K_}        | &mdash;  | replace behavior with _beh_
_v_<sub>1</sub> ... _v_<sub>_n_</sub> _beh_ | {x:VM_beh, y:_n_, z:_K_} | &mdash; | replace behavior with (_v_<sub>1</sub> ... _v_<sub>_n_</sub> . _beh_)
_reason_          | {x:VM_end, y:ABORT}           | &mdash;  | abort actor transaction with _reason_
&mdash;           | {x:VM_end, y:STOP}            | &mdash;  | stop current continuation (thread)
&mdash;           | {x:VM_end, y:COMMIT}          | &mdash;  | commit actor transaction
&mdash;           | {x:VM_end, y:RELEASE}         | &mdash;  | commit transaction and free actor
_chars_           | {x:VM_cvt, y:LST_NUM, z:_K_}  | _fixnum_ | convert _chars_ to _fixnum_
_chars_           | {x:VM_cvt, y:LST_SYM, z:_K_}  | _symbol_ | convert _chars_ to _symbol_
_char_            | {x:VM_putc, z:_K_}            | &mdash;  | write _char_ to console
&mdash;           | {x:VM_getc, z:_K_}            | _char_   | read _char_ from console
_value_           | {x:VM_debug, y:_tag_, z:_K_}  | &mdash;  | debug_print _tag_: _value_ to console

### Object Graph

The diagram below shows a typical graph of quad-cells
representing the contents of the `e_queue` (event queue)
and the `k_queue` (continuation queue).
These two queues, plus the global symbol table,
and the interrupt-handling actors,
form the root-set of objects for garbage-collection.

```
e_queue: [head,tail]--------------------------+
          |                                   V
          +-->[Event,to,msg,next]---> ... -->[Event,to,msg,NIL]
                     |  |
                     |  +--> actor message content
                     V
                    [Actor,beh,sp,?]
                           |   |
                           |   +--> actor state (initial SP)
                           |
                           +--> actor behavior (initial IP)

k_queue: [head,tail]--------------------+
          |                             V
          +-->[ip,sp,ep,kp]---> ... -->[ip,sp,ep,NIL]
               |  |  |
               |  |  +-->[Event,to,msg,NIL]
               |  |             |  |
               |  |             |  +--> ...
               |  |             V
               |  |            [Actor,beh',sp',events]---> ... -->[Event,to,msg,NIL]
               |  V
               | [Pair,car,cdr,?]
               |       |   |
               |       |   +--> ... -->[Pair,car,NIL,?]
               |       V
               |      item
               V
              [Op,EQ,0,k]
                       |
                       +--> [Op,IF,t,f]
                                   | |
                                   | +--> ...
                                   V
                                   ...
```

### Common Code Structures

Many instruction streams end with a common suffix.
These immutable continuation sequences are available
to be shared by many behaviors.

```
K_CALL:     [MSG,+0,k]---+
                         |
                         |
RESEND:     [MSG,+0,k]   |
                    |    |
                    v    |
            [SELF,?,k]---+
                         |
                         |
RV_SELF:    [SELF,?,k]   |
                    |    |
                    v    |
CUST_SEND:  [MSG,+1,k]   |
                    |    |
                    v    |
SEND_0:     [SEND,0,k]<--+    RELEASE_0:  [SEND,0,k]
                    |                             |
                    v                             v
COMMIT:     [END,+1,?]        RELEASE:    [END,+2,?]
```


## LISP/Scheme Ground Environment

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

### Assembly-language Tools

#### Values

  * literals: `UNDEF`, `NIL`, `FALSE`, `TRUE`, `UNIT`
  * type-ids: `Literal_T`, `Type_T`, `Event_T`, `Opcode_T`, `Actor_T`, `Fixnum_T`, `Symbol_T`, `Pair_T`, `Fexpr_T`, `Free_T`
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
  * `(set-t `_cell_` `_T_`)`
  * `(set-x `_cell_` `_X_`)`
  * `(set-y `_cell_` `_Y_`)`
  * `(set-z `_cell_` `_Z_`)`

#### Examples

```
(define print
  (cell Actor_T  ; ---DEPRECATED---
    (cell Opcode_T VM_msg 1
      (cell Opcode_T VM_push a-print
        (cell Opcode_T VM_send 0
          RV_UNIT)))
    ()))

(define gensym
  (lambda ()
    (cell Symbol_T (get-x '_) (get-y '_))))

(define disasm
  (lambda (ip)
    (list (get-t ip) (get-x ip) (get-y ip) (get-z ip))))
```

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
--->[custs,context]--->[accum,in]---> NIL or --->[token,next]--->
      |                  |                         |
      v                  v                         v
    [ok,fail]
     /    \
    v      v
```

Reply to _ok_ customer:
```
--->[accum,in]---> NIL or --->[token,next]--->
      |                         |
      v                         v
```

Reply to _fail_ customer:
```
NIL or --->[token,next]--->
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

### Character Classes

The `{x:VM_cmp, y:CLS}` instruction
produces `TRUE` if a character value
is part of the specified class,
or `FALSE` otherwise.
The class is defined as a union
of the named classes:

  * `CTL` Control Character
  * `DGT` Decimal Digit
  * `UPR` Uppercase Letter
  * `LWR` Lowercase Letter
  * `DLM` Delimiter
  * `SYM` Name Symbol
  * `HEX` Hexadecimal Digit
  * `WSP` Whitespace

The tables below define which characters are included in each class.

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| ^@ |   0 |  00 |  x  |     |     |     |     |     |     |     |
| ^A |   1 |  01 |  x  |     |     |     |     |     |     |     |
| ^B |   2 |  02 |  x  |     |     |     |     |     |     |     |
| ^C |   3 |  03 |  x  |     |     |     |     |     |     |     |
| ^D |   4 |  04 |  x  |     |     |     |     |     |     |     |
| ^E |   5 |  05 |  x  |     |     |     |     |     |     |     |
| ^F |   6 |  06 |  x  |     |     |     |     |     |     |     |
| ^G |   7 |  07 |  x  |     |     |     |     |     |     |     |
| ^H |   8 |  08 |  x  |     |     |     |     |     |     |     |
| ^I |   9 |  09 |  x  |     |     |     |     |     |     |  x  |
| ^J |  10 |  0a |  x  |     |     |     |     |     |     |  x  |
| ^K |  11 |  0b |  x  |     |     |     |     |     |     |  x  |
| ^L |  12 |  0c |  x  |     |     |     |     |     |     |  x  |
| ^M |  13 |  0d |  x  |     |     |     |     |     |     |  x  |
| ^N |  14 |  0e |  x  |     |     |     |     |     |     |     |
| ^O |  15 |  0f |  x  |     |     |     |     |     |     |     |
| ^P |  16 |  10 |  x  |     |     |     |     |     |     |     |
| ^Q |  17 |  11 |  x  |     |     |     |     |     |     |     |
| ^R |  18 |  12 |  x  |     |     |     |     |     |     |     |
| ^S |  19 |  13 |  x  |     |     |     |     |     |     |     |
| ^T |  20 |  14 |  x  |     |     |     |     |     |     |     |
| ^U |  21 |  15 |  x  |     |     |     |     |     |     |     |
| ^V |  22 |  16 |  x  |     |     |     |     |     |     |     |
| ^W |  23 |  17 |  x  |     |     |     |     |     |     |     |
| ^X |  24 |  18 |  x  |     |     |     |     |     |     |     |
| ^Y |  25 |  19 |  x  |     |     |     |     |     |     |     |
| ^Z |  26 |  1a |  x  |     |     |     |     |     |     |     |
| ^[ |  27 |  1b |  x  |     |     |     |     |     |     |     |
| ^\ |  28 |  1c |  x  |     |     |     |     |     |     |     |
| ^] |  29 |  1d |  x  |     |     |     |     |     |     |     |
| ^^ |  30 |  1e |  x  |     |     |     |     |     |     |     |
| ^_ |  31 |  1f |  x  |     |     |     |     |     |     |     |

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
|    |  32 |  20 |     |     |     |     |     |     |     |  x  |
| !  |  33 |  21 |     |     |     |     |     |  x  |     |     |
| "  |  34 |  22 |     |     |     |     |  x  |     |     |     |
| #  |  35 |  23 |     |     |     |     |     |  x  |     |     |
| $  |  36 |  24 |     |     |     |     |     |  x  |     |     |
| %  |  37 |  25 |     |     |     |     |     |  x  |     |     |
| &  |  38 |  26 |     |     |     |     |     |  x  |     |     |
| '  |  39 |  27 |     |     |     |     |  x  |     |     |     |
| (  |  40 |  28 |     |     |     |     |  x  |     |     |     |
| )  |  41 |  29 |     |     |     |     |  x  |     |     |     |
| \* |  42 |  2a |     |     |     |     |     |  x  |     |     |
| +  |  43 |  2b |     |     |     |     |     |  x  |     |     |
| ,  |  44 |  2c |     |     |     |     |  x  |     |     |     |
| -  |  45 |  2d |     |     |     |     |     |  x  |     |     |
| .  |  46 |  2e |     |     |     |     |     |  x  |     |     |
| /  |  47 |  2f |     |     |     |     |     |  x  |     |     |
| 0  |  48 |  30 |     |  x  |     |     |     |     |  x  |     |
| 1  |  49 |  31 |     |  x  |     |     |     |     |  x  |     |
| 2  |  50 |  32 |     |  x  |     |     |     |     |  x  |     |
| 3  |  51 |  33 |     |  x  |     |     |     |     |  x  |     |
| 4  |  52 |  34 |     |  x  |     |     |     |     |  x  |     |
| 5  |  53 |  35 |     |  x  |     |     |     |     |  x  |     |
| 6  |  54 |  36 |     |  x  |     |     |     |     |  x  |     |
| 7  |  55 |  37 |     |  x  |     |     |     |     |  x  |     |
| 8  |  56 |  38 |     |  x  |     |     |     |     |  x  |     |
| 9  |  57 |  39 |     |  x  |     |     |     |     |  x  |     |
| :  |  58 |  3a |     |     |     |     |     |  x  |     |     |
| ;  |  59 |  3b |     |     |     |     |  x  |     |     |     |
| <  |  60 |  3c |     |     |     |     |     |  x  |     |     |
| =  |  61 |  3d |     |     |     |     |     |  x  |     |     |
| >  |  62 |  3e |     |     |     |     |     |  x  |     |     |
| ?  |  63 |  3f |     |     |     |     |     |  x  |     |     |

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| @  |  64 |  40 |     |     |     |     |     |  x  |     |     |
| A  |  65 |  41 |     |     |  x  |     |     |     |  x  |     |
| B  |  66 |  42 |     |     |  x  |     |     |     |  x  |     |
| C  |  67 |  43 |     |     |  x  |     |     |     |  x  |     |
| D  |  68 |  44 |     |     |  x  |     |     |     |  x  |     |
| E  |  69 |  45 |     |     |  x  |     |     |     |  x  |     |
| F  |  70 |  46 |     |     |  x  |     |     |     |  x  |     |
| G  |  71 |  47 |     |     |  x  |     |     |     |     |     |
| H  |  72 |  48 |     |     |  x  |     |     |     |     |     |
| I  |  73 |  49 |     |     |  x  |     |     |     |     |     |
| J  |  74 |  4a |     |     |  x  |     |     |     |     |     |
| K  |  75 |  4b |     |     |  x  |     |     |     |     |     |
| L  |  76 |  4c |     |     |  x  |     |     |     |     |     |
| M  |  77 |  4d |     |     |  x  |     |     |     |     |     |
| N  |  78 |  4e |     |     |  x  |     |     |     |     |     |
| O  |  79 |  4f |     |     |  x  |     |     |     |     |     |
| P  |  80 |  50 |     |     |  x  |     |     |     |     |     |
| Q  |  81 |  51 |     |     |  x  |     |     |     |     |     |
| R  |  82 |  52 |     |     |  x  |     |     |     |     |     |
| S  |  83 |  53 |     |     |  x  |     |     |     |     |     |
| T  |  84 |  54 |     |     |  x  |     |     |     |     |     |
| U  |  85 |  55 |     |     |  x  |     |     |     |     |     |
| V  |  86 |  56 |     |     |  x  |     |     |     |     |     |
| W  |  87 |  57 |     |     |  x  |     |     |     |     |     |
| X  |  88 |  58 |     |     |  x  |     |     |     |     |     |
| Y  |  89 |  59 |     |     |  x  |     |     |     |     |     |
| Z  |  90 |  5a |     |     |  x  |     |     |     |     |     |
| [  |  91 |  5b |     |     |     |     |  x  |     |     |     |
| \\ |  92 |  5c |     |     |     |     |     |  x  |     |     |
| ]  |  93 |  5d |     |     |     |     |  x  |     |     |     |
| ^  |  94 |  5e |     |     |     |     |     |  x  |     |     |
| \_ |  95 |  5f |     |     |     |     |     |  x  |     |     |

| ch | dec | hex | CTL | DGT | UPR | LWR | DLM | SYM | HEX | WSP |
|----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| \` |  96 |  60 |     |     |     |     |  x  |     |     |     |
| a  |  97 |  61 |     |     |     |  x  |     |     |  x  |     |
| b  |  98 |  62 |     |     |     |  x  |     |     |  x  |     |
| c  |  99 |  63 |     |     |     |  x  |     |     |  x  |     |
| d  | 100 |  64 |     |     |     |  x  |     |     |  x  |     |
| e  | 101 |  65 |     |     |     |  x  |     |     |  x  |     |
| f  | 102 |  66 |     |     |     |  x  |     |     |  x  |     |
| g  | 103 |  67 |     |     |     |  x  |     |     |     |     |
| h  | 104 |  68 |     |     |     |  x  |     |     |     |     |
| i  | 105 |  69 |     |     |     |  x  |     |     |     |     |
| j  | 106 |  6a |     |     |     |  x  |     |     |     |     |
| k  | 107 |  6b |     |     |     |  x  |     |     |     |     |
| l  | 108 |  6c |     |     |     |  x  |     |     |     |     |
| m  | 109 |  6d |     |     |     |  x  |     |     |     |     |
| n  | 110 |  6e |     |     |     |  x  |     |     |     |     |
| o  | 111 |  6f |     |     |     |  x  |     |     |     |     |
| p  | 112 |  70 |     |     |     |  x  |     |     |     |     |
| q  | 113 |  71 |     |     |     |  x  |     |     |     |     |
| r  | 114 |  72 |     |     |     |  x  |     |     |     |     |
| s  | 115 |  73 |     |     |     |  x  |     |     |     |     |
| t  | 116 |  74 |     |     |     |  x  |     |     |     |     |
| u  | 117 |  75 |     |     |     |  x  |     |     |     |     |
| v  | 118 |  76 |     |     |     |  x  |     |     |     |     |
| w  | 119 |  77 |     |     |     |  x  |     |     |     |     |
| x  | 120 |  78 |     |     |     |  x  |     |     |     |     |
| y  | 121 |  79 |     |     |     |  x  |     |     |     |     |
| z  | 122 |  7a |     |     |     |  x  |     |     |     |     |
| {  | 123 |  7b |     |     |     |     |  x  |     |     |     |
| \| | 124 |  7c |     |     |     |     |  x  |     |     |     |
| }  | 125 |  7d |     |     |     |     |  x  |     |     |     |
| ~  | 126 |  7e |     |     |     |     |     |  x  |     |     |
| ^? | 127 |  7f |  x  |     |     |     |     |     |     |     |

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


## Garbage Collection

Cell memory (quads) are subject to machine-level garbage collection.
The garbage-collected _heap_ ranges from `START` up to (not including) `cell_top`.
The floor (currently `START`) may be moved upward to include additional "reserved" cells.
The ceiling (held in the variable `cell_top`) is extended upward
to expand the pool of available memory,
up to a limit of `CELL_MAX`.
The bootstrap image initially occupies cells up to `CELL_BASE`,
which determines the initial value of `cell_top`.

The garbage-collector maintains a _mark_ for each cell in the heap.
The mark can have one of four possible values:

  * `GC_GENX`: This cell is in use as of Generation X
  * `GC_GENY`: This cell is in use as of Generation Y
  * `GC_SCAN`: This cell is in use, but has not been scanned
  * `GC_FREE`: This cell is in the free-cell chain {t:Free_T}

The _current generation_ alternates between `GC_GENX` and `GC_GENY`.
Cells in the range \[`START`, `CELL_BASE`\) are initially marked `GC_GENX`.

### GC Algorithm

Garbage collection is concurrent with allocation and mutation.
An increment of the garbage collector algortihm runs between each instruction execution cycle.
The overall algorithm is roughly the following:

1. Swap generations (`GC_GENX` <--> `GC_GENY`)
2. Mark each cell in the root-set with `GC_SCAN`
    1. If a new cell is added to the root-set, mark it with `GC_SCAN`
3. Mark each newly-allocated cell with `GC_SCAN`
4. While there are cells marked `GC_SCAN`:
    1. Mark a cell with the _current_ generation
    2. Scan the cell, for each field of the cell:
        1. If it points to the heap, and is marked with the _previous_ generation, mark it `GC_SCAN`
5. For each cell marked with the _previous_ generation,
    1. Mark the cell `GC_FREE` and add it to the free-cell chain


## Inspiration

  * [Parsing Expression Grammars: A Recognition-Based Syntactic Foundation](https://bford.info/pub/lang/peg.pdf)
    * [OMeta: an Object-Oriented Language for Pattern Matching](http://www.vpri.org/pdf/tr2007003_ometa.pdf)
    * [PEG-based transformer provides front-, middle and back-end stages in a simple compiler](http://www.vpri.org/pdf/tr2010003_PEG.pdf)
  * [The LISP 1.5 Programmer's Manual](https://www.softwarepreservation.org/projects/LISP/book/LISP%201.5%20Programmers%20Manual.pdf)
  * [SectorLISP](http://justine.lol/sectorlisp2/)
  * [Ribbit](https://github.com/udem-dlteam/ribbit)
    * [A Small Scheme VM, Compiler and REPL in 4K](https://www.youtube.com/watch?v=A3r0cYRwrSs)
  * [Schism](https://github.com/schism-lang/schism)
  * [A Simple Scheme Compiler](https://www.cs.rpi.edu/academics/courses/fall00/ai/scheme/reference/schintro-v14/schintro_142.html#SEC271)
