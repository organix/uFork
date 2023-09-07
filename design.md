# uFork Design Notes

This document is a catch-all
for ideas relating to
The [**uFork**](ufork.md) Actor Virtual Machine.

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
although unevaluated they represent unique (constant) values.
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


## LISP/Scheme

A [LISP/Scheme dialect](c_src/scheme.md) is implemented
as a surface-syntax for **uFork** programs.

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

[Start-up overhead](c_src/boot.asm) to reach the interactive REPL.

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

## PEG Parsing

A [PEG parsing toolkit](c_src/peg.asm)
is implemented in **uFork** machine-code.
A [LISP/Scheme REPL](c_src/scheme.md)
uses this toolkit for parse
input from the console.

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
