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

## Primitives

There are several groups of _primitives_
the provide a minimal (or at least very small) set of concepts
on which very complex systems can be built.
For our purposes,
we find Actors, Lambda Calculus, and PEG Parsers
to be useful building-blocks.

### [Actors](http://www.dalnefre.com/wp/2020/01/requirements-for-an-actor-programming-language/)

We take a transactional view of _actors_,
where all the _effects_
caused by an actor's _behavior_
in response to an _event_
become visible at the same logical instant.

Actor primitives include:

  * SEND(_target_, _message_)
  * CREATE(_behavior_)
  * BECOME(_behavior_)
  * ABORT(_reason_)

### [Lambda-Calculus](http://www.dalnefre.com/wp/2010/08/evaluating-expressions-part-1-core-lambda-calculus/)

Technically, there is only one "type" in lambda-calculus, the _function_ type.
However, it is useful to think about lambda-calculus
in terms of primitive expressions.

Lambda-Calculus primitives include:

  * Constant
  * Variable
  * Lambda-Abstraction
  * Function-Application

#### [LISP/Scheme/Kernel](http://www.dalnefre.com/wp/2011/11/fexpr-the-ultimate-lambda/)

There is a long lineage of languages, starting with LISP,
that have a very lambda-calculus like feel to them.
Many of them depart from the pure-functional nature of lambda-calculus,
but the core evaluation scheme is functional,
based on a small set of primitives:

  * Constant (includes Nil)
  * Symbol
  * Pair

The mapping to lambda-calculus is fairly direct.
_Constants_ (any object that evaluates to itself) are obvious.
_Symbols_ normally represent _variables_,
although unevaluated they represent unique values.
_Pairs_ normally represent function-application,
where the head is the functional-abstraction to be applied
and the tail is the parameters to the function.
However, there are special-forms (like `lambda`) which,
when they appear in function-position,
operate on the unevaluated parameters.
This is how `lambda` is used to construct new functional-abstractions.

### [PEG Parsers](http://www.dalnefre.com/wp/2011/02/parsing-expression-grammars-part-1/)

_Parsing Expression Grammars_ (PEGs) are a powerful,
but simple, tool for describing unambiguous parsers.

PEG primitives include:

  * Empty
  * Fail
  * Match(_predicate_)
  * Or(_first_, _rest_)
  * And(_first_, _rest_)
  * Not(_pattern_)

A key feature of PEGs is that _Or_ implements _prioritized choice_,
which means that _rest_ is tried only if _first_ fails.
Suprisingly, there are no repetition expressions in the primitive set.
This is because they can be trivially defined in primitive terms.

Derived PEGs include:

  * Opt(_pattern_) = Or(And(_pattern_, Empty), Empty)
  * Plus(_pattern_) = And(_pattern_, Star(_pattern_))
  * Star(_pattern_) = Or(Plus(_pattern_), Empty)
  * Seq(_p_<sub>1</sub>, ..., _p_<sub>_n_</sub>) = And(_p_<sub>1</sub>, ... And(_p_<sub>_n_</sub>, Empty) ...)
  * Alt(_p_<sub>1</sub>, ..., _p_<sub>_n_</sub>) = Or(_p_<sub>1</sub>, ... Or(_p_<sub>_n_</sub>, Fail) ...)

It is clearly important to be able to express loops
(or recursive references) in the grammar.
This is also how references to non-terminals are supported,
usually via some late-bound named-reference.

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

### Lambda Compilation Test-Cases

```
(define par (lambda _))
(define zero (lambda _ 0))
(define nil (lambda _ ()))
(define ap (lambda x x))                        ; equivalent to _list_
(define id (lambda (x) x))
(define r1 (lambda (x . y) y))
(define i2 (lambda (x y) y))
(define r2 (lambda (x y . z) z))
(define i3 (lambda (x y z) z))
(define l3 (lambda (x y z) (list x y z)))
(define n1 (lambda (x) (car x)))                ; equivalent to _car_
(define n2 (lambda (x) (car (cdr x))))          ; equivalent to _cadr_
(define n3 (lambda (x) (car (cdr (cdr x)))))    ; equivalent to _caddr_
(define c (lambda (y) (lambda (x) (list y x))))
(define length (lambda (p) (if (pair? p) (+ (length (cdr p)) 1) 0)))
(define s2 (lambda (x y) x y))
(define abc (lambda (c) (let ((a 1) (b 2)) (list a b c))))
(define xyz (lambda (z) (let ((x 'a) (y 'b)) (current-env))))
(define 1st (lambda ((x . _)) x))               ; equivalent to _car_
(define 2nd (lambda ((_ . (x . _))) x))         ; equivalent to _cadr_
(define 3rd (lambda ((_ . (_ . (x . _)))) x))   ; equivalent to _caddr_
(define 1st+ (lambda ((_ . x)) x))              ; equivalent to _cdr_
(define 2nd+ (lambda ((_ . (_ . x))) x))        ; equivalent to _cddr_
(define 3rd+ (lambda ((_ . (_ . (_ . x)))) x))  ; equivalent to _cdddr_
```

### Execution Statistics Test-Case

```
((lambda (x) x) (list 1 2 3))                   ; => (1 2 3)
```

Date       | Events | Instructions | Description
-----------|--------|--------------|-------------
2022-05-17 |   1609 |        16435 | baseline measurement
2022-05-18 |   1279 |        15005 | XLAT in G_SEXPR_X
2022-05-18 |   1159 |        14485 | XLAT in G_SEXPR_X and G_LIST_X
2022-05-18 |   1173 |        14676 | XLAT in G_FIXNUM and G_SYMBOL
2022-05-18 |   1117 |        13869 | replace SEQ with AND in G_SEXPR
2022-05-18 |   1203 |        15029 | parse QUOTE -> CONST_BEH
2022-05-21 |   1205 |        15039 | delegate to GLOBAL_ENV
2022-05-22 |   1205 |        15030 | lambda interpreter
2022-05-25 |   1040 |        12911 | enhanced built-in parser
2022-05-30 |   1228 |        15259 | full-featured built-in parser
2022-06-03 |   1194 |        15062 | meta-circular interpreter
2022-06-04 |   1226 |        14986 | set SP in BECOME
2022-06-04 |   1226 |        14170 | set SP in CREATE
2022-06-05 |   1226 |        13867 | use RELEASE and RELEASE_0

#### Bootstrap Library

Start-up overhead to reach the interactive REPL.

Date       | Events | Instructions | Description
-----------|--------|--------------|-------------
2022-06-07 |   7123 |        82277 | baseline measurement
2022-06-09 |   7083 |        82342 | M_EVAL pruned `apply`
2022-06-10 |   9360 |       108706 | M_EVAL pruned `eval`
2022-06-11 |   9697 |       113301 | parse "\_" as Symbol_T
2022-06-12 |   9697 |       113301 | `lambda` body is `seq`
2022-06-12 |  10351 |       120910 | `evlis` is `par`
2022-06-13 |  14918 |       174403 | implement `vau` and `macro`
2022-06-14 |  34819 |       407735 | Quasi-Quotation with `vau`
2022-06-15 |  55936 |       655106 | `define` mutates local bindings
2022-06-16 |  55926 |       655174 | `zip` matches parameter-trees
2022-06-20 |  69640 |       816774 | inline `apply` combination
2022-06-24 |  78718 |       934417 | Meta-Actor Facilities
2022-06-26 |  81381 |       966101 | gc_safepoint policy

Parsing and execution of the test-case expression `((lambda (x) x) (list 1 2 3))`

Date       | Events | Instructions | Description
-----------|--------|--------------|-------------
2022-06-07 |   1151 |        13092 | (testcase - baseline)
2022-06-09 |   1127 |        13057 | M_EVAL pruned `apply`
2022-06-10 |   1133 |        13055 | M_EVAL pruned `eval`
2022-06-11 |   1175 |        13629 | parse "\_" as Symbol_T
2022-06-12 |   1177 |        13652 | `lambda` body is `seq`
2022-06-12 |   1201 |        13842 | `evlis` is `par`
2022-06-13 |   1177 |        13652 | implement `vau` and `macro`
2022-06-14 |   1177 |        13652 | Quasi-Quotation with `vau`
2022-06-15 |   1167 |        13654 | `define` mutates local bindings
2022-06-16 |   1177 |        13674 | `zip` matches parameter-trees
2022-06-20 |   1171 |        13627 | inline `apply` combination
2022-06-24 |   1268 |        14876 | Meta-Actor Facilities
2022-06-26 |   1268 |        14876 | gc_safepoint policy

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

### PEG Test-Cases

```
(define src (peg-source (list 45 52 50 48)))  ; "-420"
(peg-start peg-any src)
(peg-start (peg-and peg-any peg-empty) src)
(peg-start (peg-or (peg-eq 45) peg-empty) src)
(peg-start (peg-and (peg-or (peg-eq 45) peg-empty) peg-any) src)
(peg-start (peg-and (peg-or (peg-eq 45) peg-empty) (peg-and peg-any peg-empty)) src)
(define peg-digit (peg-class DGT))
(peg-start (peg-and (peg-or (peg-eq 45) peg-empty) (peg-and peg-digit peg-empty)) src)
(define peg-all (peg-or (peg-and peg-any (peg-call peg-all)) peg-empty))
(peg-start peg-all src)
(define peg-digits (peg-or (peg-and peg-digit (peg-call peg-digits)) peg-empty))
(define peg-number (peg-and (peg-or (peg-eq 45) peg-empty) peg-digits))
(peg-start peg-number src)

(define src (peg-source (list 70 111 111 10)))  ; "Foo\n"
(define peg-alnum (peg-plus (peg-class UPR LWR)))
(peg-start peg-alnum src)
(peg-start (peg-and (peg-opt (peg-eq 45)) (peg-star (peg-class DGT))) (peg-source (list 45 52 50 48 10)))

(define sxp-optws (peg-star (peg-alt (peg-eq 9) (peg-eq 10) (peg-eq 13) (peg-eq 32))))
(define sxp-atom (peg-and sxp-optws (peg-plus (peg-class UPR LWR DGT SYM))))
(define sxp-list (peg-seq (peg-eq 40) (peg-star sxp-atom) sxp-optws (peg-eq 41)))
(define src (peg-source (list 40 76 73 83 84 32 49 50 51 32 55 56 57 48 41 13 10)))  ; "(LIST 123 7890)"
;(define src (peg-source (list 40 67 65 82 32 40 32 76 73 83 84 32 48 32 49 41 9 41)))  ; "(CAR ( LIST 0 1)\t)"
(peg-start sxp-list src)

(define scm-pos (peg-xform list->number (peg-plus (peg-class DGT))))
(define scm-neg (peg-xform list->number (peg-and (peg-eq 45) (peg-plus (peg-class DGT)))))
;(define scm-num (peg-xform car (peg-and (peg-or scm-neg scm-pos) (peg-eq 10))))
;(define scm-num (peg-xform car (peg-and (peg-or scm-neg scm-pos) (peg-not peg-any))))
;(define scm-num (peg-xform car (peg-and (peg-or scm-neg scm-pos) (peg-class UPR LWR SYM))))
(define scm-num (peg-xform car (peg-and (peg-or scm-neg scm-pos) (peg-not (peg-class UPR LWR SYM)))))
;(define scm-num (peg-xform car (peg-and (peg-plus (peg-class DGT)) (peg-not (peg-class UPR LWR SYM)))))
;(define scm-num (peg-xform car (peg-and (peg-plus (peg-class DGT)) (peg-not (peg-class LWR)))))
;(define scm-num (peg-xform car (peg-and (peg-plus (peg-class DGT)) (peg-not (peg-class WSP)))))
;(define scm-num (peg-and (peg-plus (peg-class DGT)) (peg-not (peg-class WSP))))
;(define scm-num (peg-and (peg-plus (peg-class DGT)) (peg-not (peg-eq 10))))
;(define scm-num (peg-and (peg-class DGT) (peg-not (peg-eq 10))))
;(define scm-num (peg-and (peg-eq 48) (peg-not (peg-eq 10))))
(peg-start scm-num (peg-source (list 49 115 116 10)))  ; "1st\n"
;(peg-start (peg-pred number? scm-num) (peg-source (list 48 10)))  ; "0\n"
(peg-start scm-num (peg-source (list 48 10)))  ; "0\n"
;(peg-start (peg-and (peg-eq 48) (peg-eq 10)) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) (peg-eq 13)) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) peg-any) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) peg-empty) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) peg-fail) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) (peg-not peg-any)) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) (peg-not peg-empty)) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) (peg-not peg-fail)) (peg-source (list 48 10)))
;(peg-start (peg-and (peg-eq 48) (peg-not (peg-eq 13))) (peg-source (list 48 10)))
(peg-start (peg-and (peg-eq 48) (peg-not (peg-eq 10))) (peg-source (list 48 10)))
;(peg-start (peg-not (peg-eq 13)) (peg-source (list 48 10)))
;(peg-start (peg-not (peg-eq 48)) (peg-source (list 48 10)))

(peg-start peg-end (peg-source (list)))
(peg-start peg-end (peg-source (list 32)))
(peg-start peg-end (peg-source (list 10)))
(peg-start peg-end (peg-source (list 32 10)))

(peg-start peg-any (peg-source (list)))
(peg-start peg-any (peg-source (list 32)))
(peg-start peg-any (peg-source (list 10)))
(peg-start peg-any (peg-source (list 32 10)))

(peg-start (peg-eq 32) (peg-source (list)))
(peg-start (peg-eq 32) (peg-source (list 32)))
(peg-start (peg-eq 32) (peg-source (list 10)))
(peg-start (peg-eq 32) (peg-source (list 32 10)))

(peg-start (peg-not (peg-eq 32)) (peg-source (list)))
(peg-start (peg-not (peg-eq 32)) (peg-source (list 32)))
(peg-start (peg-not (peg-eq 32)) (peg-source (list 10)))
(peg-start (peg-not (peg-eq 32)) (peg-source (list 32 10)))

(peg-start (peg-peek (peg-eq 32)) (peg-source (list)))
(peg-start (peg-peek (peg-eq 32)) (peg-source (list 32)))
(peg-start (peg-peek (peg-eq 32)) (peg-source (list 10)))
(peg-start (peg-peek (peg-eq 32)) (peg-source (list 32 10)))

(define src (peg-source (list 57 13 10)))  ; "9\r\n"
(peg-start (peg-and (peg-class DGT) (peg-class WSP)) (peg-chain peg-any src))

(define src (peg-source (list 9 32 49 32 50 51 32 52 53 54 32 55 56 57 48 13 10)))  ; "\t 1 23 456 7890\r\n"
;(define wsp-number (peg-xform cdr (peg-and (peg-star (peg-class WSP)) (peg-plus (peg-class DGT))) ))
;(peg-start (peg-plus (peg-xform list->number wsp-number)) src)
;(define lang-numbers (peg-plus (peg-xform list->number peg-any)))
(define wsp-token (peg-xform cdr
  (peg-and (peg-star (peg-class CTL WSP)) (peg-or (peg-class DLM) (peg-plus (peg-class DGT UPR LWR SYM)))) ))
(define lang-tokens (peg-plus peg-any))
;(peg-start lang-numbers (peg-chain wsp-number src))
(peg-start lang-tokens (peg-chain wsp-token src))
```

```
(define src (peg-source (list 9 32 59 32 120 13 10 121)))  ; "\t ; x\r\n y"
(define not-eol (lambda (x) (if (eq? x 10) #f #t)))
(define scm-comment (peg-seq (peg-eq 59) (peg-star (peg-pred not-eol peg-any)) (peg-eq 10)))
(define scm-wsp (peg-star (peg-or scm-comment (peg-class WSP)) ))
(define scm-symbol (peg-xform list->symbol (peg-plus (peg-class UPR LWR DGT SYM)) ))
(define scm-sexpr (peg-xform cdr (peg-and scm-wsp scm-symbol)))
(peg-start scm-sexpr src)
```

```
(define src (peg-source (list 39 97 98 10)))  ; "'ab\n"
(define scm-quote
  (peg-xform (lambda (x) (list (quote quote) (cdr x)))
    (peg-and (peg-eq 39) (peg-call scm-expr)) ))
(define scm-expr (peg-xform list->symbol (peg-plus (peg-class UPR LWR DGT SYM))))
(peg-start scm-quote src)
```

```
(define src (peg-source (list 40 97 32 46 32 98 41 10)))  ; "(a . b)\n"
(define scm-wsp (peg-star (peg-class WSP)))
(define scm-symbol (peg-xform list->symbol (peg-plus (peg-class UPR LWR DGT SYM))))
;(define scm-tail (peg-alt (peg-and (peg-call scm-sexpr) (peg-call scm-tail)) peg-empty))
(define scm-tail (peg-alt
  (peg-xform (lambda (x) (cons (nth 1 x) (nth 5 x)))
    (peg-seq (peg-call scm-sexpr) scm-wsp (peg-eq 46) scm-wsp (peg-call scm-sexpr)))
  (peg-and (peg-call scm-sexpr) (peg-call scm-tail))
  peg-empty))
(define scm-list (peg-xform cadr (peg-seq (peg-eq 40) (peg-call scm-tail) scm-wsp (peg-eq 41))))
(define scm-expr (peg-alt scm-list scm-symbol))
(define scm-sexpr (peg-xform cdr (peg-and scm-wsp scm-expr)))
(peg-start scm-sexpr src)
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


## Meta-circular LISP Interpreter

The `META_EVALUATE` compile-time feature switch
enables an assembly-coded implementation
of a McCarthy-style meta-circular LISP interpreter.
The algorithm is based on the listing on page 13 of
"The LISP 1.5 Programmer's Manual".

```
eval[e;a] =
    [atom[e] → cdr[assoc[e;a]];
     atom[car[e]] →
             [eq[car[e];QUOTE] → cadr[e];
              eq[car[e];COND] → evcon[cdr[e];a];
              T → apply[car[e];evlis[cdr[e];a];a]];
     T → apply[car[e];evlis[cdr[e];a];a]] 
apply[fn;x;a] =
     [atom[fn] → [eq[fn;CAR] → caar[x];
                  eq[fn;CDR] → cdar[x];
                  eq[fn;CONS] → cons[car[x];cadr[x]];
                  eq[fn;ATOM] → atom[car[x]];
                  eq[fn;EQ] → eq[car[x];cadr[x]];
                  T → apply[eval[fn;a];x;a]];
      eq[car[fn];LAMBDA] →
                  eval[caddr[fn];pairlis[cadr[fn];x;a]];
      eq[car[fn];LABEL] →
                  apply[caddr[fn];x;cons[cons[cadr[fn];caddr[fn]];a]]]
```

A LISP rendition of the assembly-coded implementation
(with a few enhancements)
might look like this:

```
(define eval
  (lambda (form env)
    (cond
      ((symbol? form)                                         ; bound variable
        (lookup form env))
      ((pair? form)
        (cond
          ((eq? (car form) 'quote)                            ; (quote <form>)
            (cadr form))
          ((eq? (car form) 'if)                               ; (if <pred> <cnsq> <altn>)
            (evalif (eval (cadr form) env) (caddr form) (cadddr form) env))
          (#t                                                 ; procedure call
            (apply (car form) (evlis (cdr form) env) env)) ))
      (#t                                                     ; self-evaluating form
        form) )))

(define apply
  (lambda (fn args env)
    (cond
      ((symbol? fn)
        (cond
          ((eq? fn 'cons)                                     ; (cons <first> <rest>)
            (cons (car args) (cadr args)))
          ((eq? fn 'car)                                      ; (car <pair>)
            (caar args))
          ((eq? fn 'cdr)                                      ; (cdr <pair>)
            (cdar args))
          ((eq? fn 'eq?)                                      ; (eq? <left> <right>)
            (eq? (car args) (cadr args)))
          ((eq? fn 'pair?)                                    ; (pair? <value>)
            (pair? (car args)))
          ((eq? fn 'symbol?)                                  ; (symbol? <value>)
            (symbol? (car args)))
          (#t                                                 ; look up function in environment
            (apply (lookup fn env) args env)) ))
      ((pair? fn)
        (cond
          ((eq? (car fn) 'lambda)                             ; ((lambda <frml> <body>) <args>)
            (eval (caddr fn) (zip (cadr fn) args env)))
          (#t                                                 ; expression in function position
            (apply (eval fn env) args env)) ))
      (#t                                                     ; not applicable
        #?) )))

(define lookup                                                ; look up variable binding in environment
  (lambda (key alist)
    (if (pair? alist)
        (if (eq? (caar alist) key)
            (cdar alist)
            (lookup key (cdr alist)))
        #?)))                                                 ; binding not found

(define evalif                                                ; if `test` is #f, evaluate `altn`,
  (lambda (test cnsq altn env)                                ; otherwise evaluate `cnsq`.
    (if test
        (eval cnsq env)
        (eval altn env) )))

(define evlis                                                 ; map `eval` over a list of operands
  (lambda (opnds env)
    (if (pair? opnds)
        (cons (eval (car opnds) env) (evlis (cdr opnds) env))
        () )))                                                ; value is NIL

(define zip
  (lambda (xs ys env)
    (if (pair? xs)
        (cons (cons (car xs) (car ys)) (zip (cdr xs) (cdr ys) env))
        env)))
```

### Meta-circular Evolution

A series of evolutionary steps
take the meta-circular evaluator above
and enhance it with various new features.
The features implemented here are:

  * Match dotted-tail in `lambda` parameters
  * Lexical scope in `lambda` definition and evaluation
  * Implement `define` for top-level symbol binding

The hybrid reference-implementation looks like this:

```
(define eval
  (lambda (form env)
    (cond
      ((symbol? form)                                         ; bound variable
        (lookup form env))
      ((pair? form)
        (cond
          ((eq? (car form) 'quote)                            ; (quote <form>)
            (cadr form))
          ((eq? (car form) 'if)                               ; (if <pred> <cnsq> <altn>)
            (evalif (eval (cadr form) env) (caddr form) (cadddr form) env))
          ((eq? (car form) 'lambda)                           ; (lambda <frml> <body>)
            (CREATE (closure-beh (cadr form) (caddr form) env)))
          ((eq? (car form) 'define)                           ; (define <symbol> <expr>)
            (set-z (cadr form) (eval (caddr form) env)))
          (#t                                                 ; procedure call
            (apply (car form) (evlis (cdr form) env) env)) ))
      (#t                                                     ; self-evaluating form
        form) )))

(define apply
  (lambda (fn args env)
    (cond
      ((symbol? fn)
        (cond
          ((eq? fn 'list)                                     ; (list . <args>)
            args)
          ((eq? fn 'cons)                                     ; (cons <first> <rest>)
            (cons (car args) (cadr args)))
          ((eq? fn 'car)                                      ; (car <pair>)
            (caar args))
          ((eq? fn 'cdr)                                      ; (cdr <pair>)
            (cdar args))
          ((eq? fn 'eq?)                                      ; (eq? <left> <right>)
            (eq? (car args) (cadr args)))
          ((eq? fn 'pair?)                                    ; (pair? <value>)
            (pair? (car args)))
          ((eq? fn 'symbol?)                                  ; (symbol? <value>)
            (symbol? (car args)))
          (#t                                                 ; look up function in environment
            (apply (lookup fn env) args env)) ))
      ((pair? fn)
        (cond
          ((eq? (car fn) 'lambda)                             ; ((lambda <frml> <body>) <args>)
            (eval (caddr fn) (zip (cadr fn) args env)))
          (#t                                                 ; expression in function position
            (apply (eval fn env) args env)) ))
      ((actor? fn)                                            ; delegate to "functional" actor
        (CALL fn args))
      (#t                                                     ; not applicable
        #?) )))

(define lookup                                                ; look up variable binding in environment
  (lambda (key alist)
    (cond
      ((pair? alist)
        (if (eq? (caar alist) key)                            ; if key matches,
            (cdar alist)                                      ;   get binding value
            (lookup key (cdr alist))))                        ;   else, keep looking
      ((symbol? key)                                          ; get top-level binding
        (get-z key))
      (#t                                                     ; value is undefined
        #?) )))

(define evalif                                                ; if `test` is #f, evaluate `altn`,
  (lambda (test cnsq altn env)                                ; otherwise evaluate `cnsq`.
    (if test
        (eval cnsq env)
        (eval altn env) )))

(define evlis                                                 ; map `eval` over a list of operands
  (lambda (opnds env)
    (if (pair? opnds)
        (cons (eval (car opnds) env) (evlis (cdr opnds) env))
        () )))                                                ; value is NIL

(define zip
  (lambda (xs ys env)
    (cond
      ((pair? xs)
        (cons (cons (car xs) (car ys)) (zip (cdr xs) (cdr ys) env)))
      ((symbol? xs)                                           ; dotted-tail binds to &rest
        (cons (cons xs ys) env))
      (#t
        env) )))

(define closure-beh
  (lambda (frml body env)
    (BEH (cust . args)
      (eval body (zip frml args env)))))
```

By moving the normal applicative functions
into the global environment,
the implementation of `apply` is greatly simplified.
Additional features implemented here are:

  * Replace special-cases in `apply` with environment bindings
  * Remove literal match for `lambda` in `apply`
  * Add `cond` special-form, equipotent to `if`
  * Allow delegation to actor environments

The current reference-implementation looks like this:

```
(define eval
  (lambda (form env)
    (cond
      ((symbol? form)                                         ; bound variable
        (lookup form env))
      ((pair? form)
        (cond
          ((eq? (car form) 'quote)                            ; (quote <form>)
            (cadr form))
          ((eq? (car form) 'if)                               ; (if <pred> <cnsq> <altn>)
            (evalif (eval (cadr form) env) (caddr form) (cadddr form) env))
          ((eq? (car form) 'cond)                             ; (cond (<test> <expr>) . <clauses>)
            (evcon (cdr form) env))
          ((eq? (car form) 'lambda)                           ; (lambda <frml> <body>)
            (CREATE (closure-beh (cadr form) (caddr form) env)))
          ((eq? (car form) 'define)                           ; (define <symbol> <expr>)
            (set-z (cadr form) (eval (caddr form) env)))
          (#t                                                 ; procedure call
            (apply (car form) (evlis (cdr form) env) env)) ))
      (#t                                                     ; self-evaluating form
        form) )))

(define apply
  (lambda (fn args env)
    (cond
      ((symbol? fn)                                           ; look up function in environment
        (apply (lookup fn env) args env))
      ((pair? fn)                                             ; expression in function position
        (apply (eval fn env) args env))
      ((actor? fn)                                            ; delegate to "functional" actor
        (CALL fn args))
      (#t                                                     ; not applicable
        #?) )))

(define lookup                                                ; look up variable binding in environment
  (lambda (key env)
    (cond
      ((pair? env)                                            ; association list
        (if (eq? (caar env) key)                              ; if key matches,
            (cdar env)                                        ;   get binding value
            (lookup key (cdr env))))                          ;   else, keep looking
      ((actor? env)                                           ; delegate to actor environment
        (CALL env key))
      ((symbol? key)                                          ; get top-level binding
        (get-z key))
      (#t                                                     ; value is undefined
        #?) )))

(define evalif                                                ; if `test` is #f, evaluate `altn`,
  (lambda (test cnsq altn env)                                ; otherwise evaluate `cnsq`.
    (if test
        (eval cnsq env)
        (eval altn env) )))

(define evcon                                                 ; (cond (<test> <expr>) . <clauses>)
  (lambda (clauses env)
    ((lambda (clause)
      (if (pair? clause)
          (if (eval (car clause) env)
              (eval (cadr clause) env)
              (evcon (cdr clauses) env))
          #?))
    (car clauses)) ))

(define evlis                                                 ; map `eval` over a list of operands
  (lambda (opnds env)
    (if (pair? opnds)
        (cons (eval (car opnds) env) (evlis (cdr opnds) env))
        () )))                                                ; value is NIL

(define zip                                                   ; extend `env` by binding
  (lambda (xs ys env)                                         ; names `xs` to values `ys`
    (cond
      ((pair? xs)
        (cons (cons (car xs) (car ys)) (zip (cdr xs) (cdr ys) env)))
      ((symbol? xs)                                           ; dotted-tail binds to &rest
        (cons (cons xs ys) env))
      (#t
        env) )))

(define closure-beh
  (lambda (frml body env)
    (BEH (cust . args)
      (eval body (zip frml args env)))))
```

Moving operatives (special forms) into the environment,
and making it possible to define new ones,
requires a refactoring of the basic meta-circular interpreter.
The key idea is that we can't decide if the operands should be evaluated
until we know if the function is applicative or operative.
However, the traditional `apply` takes a list of arguments (already evaluated).
Instead, we have `eval` call `invoke`,
which evaluates the operands for applicatives only.

Additional features implemented here are:

  * Introduce `Fexpr_T` for operative interpreters
  * `eval`/`invoke`/`apply` distinguish applicatives/operatives
  * Replace special-cases in `eval` with environment bindings
  * `lambda` body is `seq`
  * `evlis` is `par`

The refactored reference-implementation looks like this:

```
(define eval
  (lambda (form env)
    (cond
      ((symbol? form)                                         ; bound variable
        (lookup form env))
      ((pair? form)                                           ; procedure call
        (invoke (eval (car form) env) (cdr form) env))
      (#t                                                     ; self-evaluating form
        form) )))

(define invoke
  (lambda (fn opnds env)
    (if (actor? fn)                                           ; if _applicative_
        (apply fn (CALL op-par (list opnds env)) env)         ;   parallel (apply fn (evlis opnds env) env)
        (apply fn opnds env) )))                              ;   else, apply _combiner_

(define apply
  (lambda (fn args env)
    (cond
      ((actor? fn)                                            ; _applicative_ combiner
        (CALL fn args))
      ((fexpr? fn)                                            ; _operative_ combiner
        (CALL (get-x fn) (list args env)))
      (#t                                                     ; not applicable
        #?) )))

(define lookup                                                ; look up variable binding in environment
  (lambda (key env)
    (cond
      ((pair? env)                                            ; association list
        (if (eq? (caar env) key)                              ; if key matches,
            (cdar env)                                        ;   get binding value
            (lookup key (cdr env))))                          ;   else, keep looking
      ((actor? env)                                           ; delegate to actor environment
        (CALL env key))
      ((symbol? key)                                          ; get top-level binding
        (get-z key))
      (#t                                                     ; value is undefined
        #?) )))

(define evlis                                                 ; map `eval` over a list of operands
  (lambda (opnds env)
    (if (pair? opnds)
        (cons (eval (car opnds) env) (evlis (cdr opnds) env))
        () )))                                                ; value is NIL

(define op-par                                                ; (par . <exprs>)
  (CREATE
    (BEH (cust opnds env)
      (if (pair? opnds)
          (SEND
            (CREATE (fork-beh cust eval op-par))
            (list ((car opnds) env) ((cdr opnds) env)))
          (SEND cust ()) ))))

(define zip                                                   ; extend `env` by binding
  (lambda (xs ys env)                                         ; names `xs` to values `ys`
    (cond
      ((pair? xs)
        (cons (cons (car xs) (car ys)) (zip (cdr xs) (cdr ys) env)))
      ((symbol? xs)                                           ; dotted-tail binds to &rest
        (cons (cons xs ys) env))
      (#t
        env) )))

(define closure-beh                                           ; lexically-bound applicative function
  (lambda (frml body env)
    (BEH (cust . args)
      (SEND cust (evbody #unit body (zip frml args env))) )))

(define op-quote                                              ; (quote <form>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust (car opnds)) )))

(define op-lambda                                             ; (lambda <frml> . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (CREATE (closure-beh (car opnds) (cdr opnds) env))) )))

(define op-define                                             ; (define <symbol> <expr>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (set-z (car opnds) (eval (cadr opnds) env))) )))

(define evalif                                                ; if `test` is #f, evaluate `altn`,
  (lambda (test cnsq altn env)                                ; otherwise evaluate `cnsq`.
    (if test
        (eval cnsq env)
        (eval altn env) )))

(define op-if                                                 ; (if <pred> <cnsq> <altn>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (evalif (eval (car opnds) env) (cadr opnds) (caddr opnds) env)) )))

(define op-cond                                               ; (cond (<test> <expr>) . <clauses>)
  (CREATE
    (BEH (cust opnds env)
      (if (pair? (car opnds))
          (if (eval (caar opnds) env)
              (SEND cust (eval (cadar opnds) env))
              (SEND SELF (list cust (cdr opnds) env)))
          (SEND cust #?)) )))

(define evbody                                                ; evaluate a list of expressions,
  (lambda (value body env)                                    ; returning the value of the last.
    (if (pair? body)
        (evbody (eval (car body) env) (cdr body) env)
        value)))

(define k-seq-beh
  (lambda (cust body env)
    (BEH value
      (if (pair? body)
          (SEND
            (CREATE (k-seq-beh cust (cdr body) env))
            (eval (car body) env))
          (SEND cust value)) )))
(define op-seq                                                ; (seq . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND (CREATE (k-seq-beh cust opnds env)) #unit) )))    ; (SEND cust (evbody #unit opnds env))
```

We now have a fully-functional interpreter implementation.
Its structure is significantly different that McCarthy's original,
but it establishes a solid foundation.
Building on this foundation,
we add extensions to enhance modularity and flexibility.

Additional features implemented here are:

  * Inline `invoke`/`apply` combination
  * `zip` matches parameter-trees (used by `lambda`, et. al.)
  * `define` uses `zip` to bind multiple variables
  * `define` mutates local bindings (not just top-level globals)
  * General operative constructor `vau`
  * More useful `macro` operative constructor
  * `quasiquote`, et. al. for ease of use

The extended reference-implementation looks like this:

```
(define eval
  (lambda (form env)
    (cond
      ((symbol? form)                                         ; bound variable
        (lookup form env))
      ((pair? form)                                           ; combination
        (let ((fn    (eval (car form) env))
              (opnds (cdr form)))
          (cond
            ((actor? fn)                                      ; _applicative_
              (CALL fn (evlis opnds env)))
            ((fexpr? fn)                                      ; _operative_
              (CALL (get-x fn) (list opnds env)))
            (#t                                               ; not applicable
              #?)) ))
      (#t                                                     ; self-evaluating form
        form) )))

(define apply
  (lambda (fn args env)
    (cond
      ((actor? fn)                                            ; _compiled_
        (CALL fn args))
      ((fexpr? fn)                                            ; _interpreted_
        (CALL (get-x fn) (list args env)))
      (#t                                                     ; not applicable
        #?) )))

(define lookup                                                ; look up variable binding in environment
  (lambda (key env)
    (cond
      ((pair? env)                                            ; association list
        (if (eq? (caar env) key)                              ; if key matches,
            (cdar env)                                        ;   get binding value
            (lookup key (cdr env))))                          ;   else, keep looking
      ((actor? env)                                           ; delegate to actor environment
        (CALL env key))
      ((symbol? key)                                          ; get top-level binding
        (get-z key))
      (#t                                                     ; value is undefined
        #?) )))

(define bind-env                                              ; update (mutate) binding in environment
  (lambda (key val env)
    (cond
      ((pair? env)                                            ; association list
        (cond
          ((eq? (caar env) '_)                                ; insert new binding
            (set-cdr env (cons (car env) (cdr env)))
            (set-car env (cons key val)))
          ((eq? (caar env) key)                               ; mutate binding
            (set-cdr (car env) val))
          (#t                                                 ; keep searching for binding
            (bind-env key val (cdr env))) ))
      ((symbol? key)                                          ; set top-level binding
        (set-z key val)))
    #unit))                                                   ; value is UNIT

(define evlis                                                 ; map `eval` over a list of operands
  (lambda (opnds env)
    (if (pair? opnds)
        (cons (eval (car opnds) env) (evlis (cdr opnds) env))
        () )))                                                ; value is NIL

(define op-par                                                ; (par . <exprs>)
  (CREATE
    (BEH (cust opnds env)
      (if (pair? opnds)
          (SEND
            (CREATE (fork-beh cust eval op-par))
            (list ((car opnds) env) ((cdr opnds) env)))
          (SEND cust ()) ))))

(define var-name?                                             ; valid variable name?
  (lambda (x)
    (if (eq? x '_)
        #f
        (symbol? x) )))
(define zip-it                                                ; extend `env` by binding
  (lambda (x y xs ys env)                                     ; names `x` to values `y`
    (cond
      ((pair? x)
        (if (null? (cdr x))
            (zip-it (car x) (car y) xs ys env)
            (zip-it (car x) (car y) (cons (cdr x) xs) (cons (cdr y) ys) env)))
      ((var-name? x)
        (zip-it xs ys () () (cons (cons x y) env)))
      ((null? xs)
        env)
      (#t
        (zip-it xs ys () () env))
    )))
(define zip                                                   ; extend `env` by binding
  (lambda (x y env)                                           ; names `x` to values `y`
    (zip-it x y () () env)))

(define scope (lambda (env) (cons (cons '_ #?) env)))         ; delimit local scope (inline function)

(define closure-beh                                           ; lexically-bound applicative procedure
  (lambda (frml body env)
    (BEH (cust . args)
      (SEND cust (evbody #unit body (zip frml args (scope env)))) )))

(define fexpr-beh                                             ; lexically-bound operative procedure
  (lambda (frml body denv)
    (BEH (cust opnds senv)
      (SEND cust (evbody #unit body (zip frml (cons denv opnds) (scope senv)))) )))

(define op-quote                                              ; (quote <form>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust (car opnds)) )))

(define op-lambda                                             ; (lambda <frml> . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (CREATE (closure-beh (car opnds) (cdr opnds) env))) )))

(define op-vau                                                ; (vau <frml> <evar> . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (cell Fexpr_T
          (CREATE (fexpr-beh (cons (cadr opnds) (car opnds)) (cddr opnds) env)) )) )))

(define bind-each
  (lambda (alist env)
    (cond
      ((pair? alist)
        (bind-env (caar alist) (cdar alist) env)
        (bind-each (cdr alist) env))
      (#t
        #unit) )))
(define op-define                                             ; (define <frml> <expr>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (bind-each (zip (car opnds) (eval (cadr opnds) env) ()) env)) )))

(define evalif                                                ; if `test` is #f, evaluate `altn`,
  (lambda (test cnsq altn env)                                ; otherwise evaluate `cnsq`.
    (if test
        (eval cnsq env)
        (eval altn env) )))

(define op-if                                                 ; (if <pred> <cnsq> <altn>)
  (CREATE
    (BEH (cust opnds env)
      (SEND cust
        (evalif (eval (car opnds) env) (cadr opnds) (caddr opnds) env)) )))

(define op-cond                                               ; (cond (<test> <expr>) . <clauses>)
  (CREATE
    (BEH (cust opnds env)
      (if (pair? (car opnds))
          (if (eval (caar opnds) env)
              (SEND cust (eval (cadar opnds) env))
              (SEND SELF (list cust (cdr opnds) env)))
          (SEND cust #?)) )))

(define evbody                                                ; evaluate a list of expressions,
  (lambda (value body env)                                    ; returning the value of the last.
    (if (pair? body)
        (evbody (eval (car body) env) (cdr body) env)
        value)))

(define k-seq-beh
  (lambda (cust body env)
    (BEH value
      (if (pair? body)
          (SEND
            (CREATE (k-seq-beh cust (cdr body) env))
            (eval (car body) env))
          (SEND cust value)) )))
(define op-seq                                                ; (seq . <body>)
  (CREATE
    (BEH (cust opnds env)
      (SEND (CREATE (k-seq-beh cust opnds env)) #unit) )))    ; (SEND cust (evbody #unit opnds env))

(define macro                                                 ; (macro <frml> . <body>)
  (vau (frml . body) env
    (eval
      (list vau frml '_env_
        (list eval (cons seq body) '_env_))
      env)))

(define quasiquote
  (vau (x) e
    (if (pair? x)
        (if (eq? (car x) 'unquote)
            (eval (cadr x) e)
            (quasi-list x))
        x)))
(define quasi-list
  (lambda (x)
    (if (pair? x)
        (if (pair? (car x))
            (if (eq? (caar x) 'unquote-splicing)
                (append (eval (cadar x) e) (quasi-list (cdr x)))
                (cons (apply quasiquote (car x) e) (quasi-list (cdr x))))
            (cons (car x) (quasi-list (cdr x))))
        x)))

(define gensym
  (lambda ()
    (cell Symbol_T (get-x '_) (get-y '_)) ))

;;; alternative definition using quasiquote, et. al.
(define macro                                                 ; (macro <frml> . <body>)
  (vau (frml . body) env
    (eval
      ((lambda (evar)
          `(vau ,frml ,evar (eval (seq ,@body) ,evar)))
        (gensym))
      env)))
```

#### Test-Cases

```
(eval '(cons (car '(a b c)) (cdr '(x y z))))
(eval '(lambda (x) x))
(eval '((lambda (x) x) (list 1 2 3)))
(eval '((lambda (x) x) '(lambda (x) x)))
(eval '((lambda (f) (f 42)) '(lambda (x) x)))
(eval '((lambda (f) (f 42)) (lambda (x) x)))
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
