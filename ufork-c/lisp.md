# uFork LISP/Scheme Derivation

A LISP/Scheme dialect is [implemented](scheme.md)
as a surface-syntax for **uFork** programs.
It handles both "interpreted" and "compiled" code.
The semantics of this dialect
are derived from LISP 1.5 (over several incremental steps).
Important features include:

  * Mostly-functional semantics, with controlled mutability
  * Lexical scope in `lambda` definition and evaluation (ala Scheme)
  * General destructuring bindings and multi-value returns
  * Explicit-evaluation operative definition with `vau` (ala Kernel)
  * Classical `macro` definition with `quasiquote` support
  * Smoothly-interoperable Actor primitives

## Meta-circular LISP Interpreter

The assembly-coded implementation
is a McCarthy-style meta-circular LISP interpreter.
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
        () )))                                                ; value is NIL -- FIXME: maybe this should be `opnds`?

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
  (lambda (frml body senv)
    (BEH (cust opnds denv)
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
            (quasi-list x e))
        x)))
(define quasi-list
  (lambda (x e)
    (if (pair? x)
        (if (pair? (car x))
            (if (eq? (caar x) 'unquote-splicing)
                (append (eval (cadar x) e) (quasi-list (cdr x) e))
                (cons (apply quasiquote (car x) e) (quasi-list (cdr x) e)))
            (cons (car x) (quasi-list (cdr x) e)))
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
