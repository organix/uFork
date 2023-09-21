# uFork LISP/Scheme Dialect

A LISP/Scheme dialect is implemented
as a surface-syntax for **uFork** programs.
A compiler (written in JavaScript)
generates loadable [CRLF](crlf.md)
just like [ASM](asm.md) does.

Since this dialect is focused on expressing actor behaviors,
it is a mostly-pure functional expression language.
Most data-structures (including _pairs_) are immutable,
and mutation features (e.g.: `set!`) are not supported.
The language is extended with actor primitives.
It is expected that mutation generally will be confined
to the state of actors, managed with `BECOME`.

## Literal Values

  * `#?` — undefined value
  * `#nil` — empty list, abbreviated `()`
  * `#f` — boolean **false**
  * `#t` — boolean **true**
  * `#unit` — inert result
  * `#literal_t` — type of literal values
  * `#type_t` — type of types
  * `#fixnum_t` — type of _fixnums_ (31-bit signed integers)
  * `#actor_t` — type of actor reference/capabilities
  * `#instr_t` — type of machine instructions
  * `#pair_t` — type of _pairs_ (`cons` cells)
  * `#dict_t` — type of dictionary entries
  * _fixnums_ (31-bit signed integers)

## Built-In Facilities

  * `(import `<_prefix_>` `<_URL_>`)`
  * `(define `<_symbol_>` `<_expr_>`)`
  * `(quote `<_expr_>`)` — abbreviated `'`<_expr_>
  * `(lambda `<_formal_>`  .  `<_body_>`)`
  * `(let ((`<_var_>` `<_val_>`) . `<_bindings_>`) . `<_body_>`)`
  * `(seq . `<_body_>`)`
  * `(list . `_values_`)`
  * `(cons `_head_` `_tail_`)`
  * `(car `_pair_`)`
  * `(cdr `_pair_`)`
  * `(cadr `_pair_`)`
  * `(caar `_pair_`)`
  * `(cdar `_pair_`)`
  * `(cddr `_pair_`)`
  * `(caddr `_pair_`)`
  * `(cadar `_pair_`)`
  * `(cdddr `_pair_`)`
  * `(cadddr `_pair_`)`
  * `(eq? `_value_` `_value_`)`
  * `(null? `_value_`)`
  * `(pair? `_value_`)`
  * `(boolean? `_value_`)`
  * `(number? `_value_`)`
  * `(actor? `_value_`)`
  * `(symbol? `_value_`)`
  * `(procedure? `_value_`)`
  * `(behavior? `_value_`)`
  * `(if `<_test_>` `<_t_expr_>` `<_f_expr_>`)`
  * `(cond (`<_test_>`  .  `<_body_>`) . `<_clauses_>`)`
  * `(not `_bool_`)`
  * `(+ `_number_` `_number_`)`
  * `(- `_number_` `_number_`)`
  * `(* `_number_` `_number_`)`
  * `(< `_number_` `_number_`)`
  * `(<= `_number_` `_number_`)`
  * `(= `_number_` `_number_`)`
  * `(>= `_number_` `_number_`)`
  * `(> `_number_` `_number_`)`
  * `(export . `<_symbols_>`)`

## Planned Facilities

  * `(nth `_index_` `_pair_`)`
  * `(equal? `_value_` `_value_`)`
  * `(and . `<_exprs_>`)`
  * `(or . `<_exprs_>`)`
  * `(append . `_lists_`)`
  * `(length `_list_`)`
  * `(filter `_pred_` `_list_`)`
  * `(reduce `_binop_` `_zero_` `_list_`)`
  * `(foldl `_binop_` `_zero_` `_list_`)`
  * `(foldr `_binop_` `_zero_` `_list_`)`
  * `(map `_proc_`  .  `_lists_`)`
  * `(reverse `_list_`)`
  * `(letrec ((`<_var_>` `<_val_>`) . `<_bindings_>`) . `<_body_>`)`
  * `(current-env)`
  * `(print . `_values_`)`

## Meta-Actor Facilities

  * `(CREATE `_behavior_`)`
  * `(SEND `_actor_` `_message_`)`
  * `(BECOME `_behavior_`)`
  * `SELF`
  * `(BEH `<_formal_>`  .  `<_body_>`)`
  * `(CALL `_actor_` `_args_`)`
  * `(DEVICE `_id_`)`

## Possible Future Features
  * `(par .  `<_exprs_>`)`
  * `(zip `_formal_` `_value_` `_env_`)`
  * `(gensym)`
  * `a-print`
