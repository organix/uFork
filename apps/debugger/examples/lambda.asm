;;;
;;; Lambda Calculus (pure-function evaluator)
;;;

.import
    std: "https://ufork.org/lib/std.asm"

; Constant values do not depend on the environment.

;;  DEF constant(value) AS \(cust, _).[ SEND value TO cust ]
constant:                   ; value <- (cust . _)
    state 0                 ; value
    ref std.cust_send

; Variables represent values in an expression
; that are dependent on the evaluation environment.

;;  DEF variable AS \(cust, env).[ SEND (cust, SELF) TO env ]
variable:                   ; _ <- (cust . env)
    my self                 ; SELF
    msg 1                   ; SELF cust
    pair 1                  ; (cust . SELF)
    msg -1                  ; (cust . SELF) env
    ref std.send_msg

; An environment is a collection of bindings.
; The empty environment has no bindings,
; so any attempted lookup yields "undefined".

;;  DEF empty_env AS \(cust, _).[ SEND #? TO cust ]
empty_env:                  ; _ <- (cust . _)
    ref std.rv_undef

; A binding is a mapping from a variable to a value.
; A lookup matching the variable yields the value.
; Bindings form an environment delegation chain.

;;  DEF binding(var, value, next) AS \msg.[
;;      CASE msg OF
;;      (cust, $var) : [ SEND value TO cust ]
;;      _ : [ SEND msg TO next ]
;;      END
;;  ]
binding:                    ; ({var:value} . next) <- (cust . var)
    state 1                 ; {var:value}
    msg -1                  ; {var:value} var
    dict get                ; value?
    dup 1                   ; value? value?
    eq #?                   ; value? value?==#?
    if_not std.cust_send
    msg 0                   ; ... (cust . var)
    state -1                ; ... (cust . var) next
    ref std.send_msg

; Lambda expressions are constructors for applicative functions.
; They capture a _body_ expression and the definition environment,
; creating a closure that may be _applied_ later.

;;  DEF lambda(var, body) AS \(cust, env).[
;;      SEND NEW closure(env, var, body) TO cust
;;  ]
lambda:                     ; (var . body) <- (cust . env)
    state 0                 ; (var . body)
    msg -1                  ; (var . body) env
    pair 1                  ; (env var . body)
    push closure            ; (env var . body) closure
    actor create            ; closure.(env var . body)
    ref std.cust_send

; Application expressions apply a function to the result
; of evaluating a parameter expression.

;;  DEF application(lambda, param) AS \(cust, env).[
;;      CREATE appl WITH applicative(param, cust, env)
;;      SEND (appl, env) TO lambda
;;  ]
application:                ; (lambda . param) <- (cust . env)
    msg -1                  ; env
    msg 0                   ; env (cust . env)
    state -1                ; env (cust . env) param
    pair 1                  ; env (param cust . env)
    push applicative        ; env (param cust . env) applicative
    actor create            ; env appl=applicative.(param cust . env)
    pair 1                  ; (appl . env)
    state 1                 ; (appl . env) lambda
    ref std.send_msg

;;  DEF applicative(param, cust, env) AS \closure.[
;;      BECOME operative(closure, cust, env)
;;      SEND (SELF, env) TO param
;;  ]
applicative:                ; (param cust . env) <- closure
    state -1                ; (cust . env)
    msg 0                   ; (cust . env) closure
    pair 1                  ; (closure cust . env)
    push operative          ; (closure cust . env) operative
    actor become            ; --
    state -2                ; env
    my self                 ; env SELF
    pair 1                  ; (SELF . env)
    state 1                 ; (SELF . env) param
    ref std.send_msg

;;  DEF operative(closure, cust, env) AS \arg.[
;;      SEND (arg, cust, env) TO closure
;;  ]
operative:                  ; (closure cust . env) <- arg
    state -1                ; (cust . env)
    msg 0                   ; (cust . env) arg
    pair 1                  ; (arg cust . env)
    state 1                 ; (arg cust . env) closure
    ref std.send_msg

;;  DEF closure(env, var, body) AS \(arg, cust, _).[
;;      CREATE env' WITH binding(var, arg, env)
;;      SEND (cust, env') TO body
;;  ]
closure:                    ; (env var . body) <- (arg cust . _)
    state 1                 ; next=env
    push #nil               ; next ()
    state 2                 ; next () var
    msg 1                   ; next () var value=arg
    dict add                ; next {var:value}
    pair 1                  ; ({var:value} . next)
    push binding            ; ({var:value} . next) binding
    actor create            ; env'=binding.({var:value} . next)
    msg 2                   ; env' cust
    pair 1                  ; (cust . env')
    state -2                ; (cust . env') body
    ref std.send_msg

; unit test suite
boot:                       ; _ <- {caps}
    push #?                 ; #?
    push #?                 ; #? #?
    push test_const         ; #? #? test_const
    actor create            ; #? test_const.#?
    actor send              ; --

    push #?                 ; #?
    push #?                 ; #? #?
    push test_var           ; #? #? test_var
    actor create            ; #? test_var.#?
    actor send              ; --

    push #?                 ; #?
    push #?                 ; #? #?
    push test_identity      ; #? #? test_identity
    actor create            ; #? test_identity.#?
    actor send              ; --

    ref std.commit

; eval[42, {}] => 42
test_const:                 ; _ <- _
    push #?                 ; #?
    push empty_env          ; #? empty_env
    actor create            ; env=empty_env.#?

    push 42                 ; env 42
    push assert_beh         ; env 42 assert_beh
    actor create            ; env cust=assert_beh.42
    pair 1                  ; (cust . env)

    push 42                 ; (cust . env) 42
    push constant           ; (cust . env) 42 constant
    actor create            ; (cust . env) constant.42
    ref std.send_msg

; eval[x, {x:13}] => 13
test_var:                   ; _ <- _
    push #?                 ; #?
    push empty_env          ; #? empty_env
    actor create            ; env=empty_env.#?

    push #nil               ; next ()
    push #?                 ; next () #?
    push variable           ; next () #? variable
    actor create            ; next () var=variable.#?
    dup 1                   ; next () var var
    roll -4                 ; var next () var
    push 13                 ; var next () var value=13
    dict add                ; var next {var:value}
    pair 1                  ; var ({var:value} . next)
    push binding            ; var ({var:value} . next) binding
    actor create            ; var env=binding.({var:value} . next)

    push 13                 ; var env 13
    push assert_beh         ; var env 13 assert_beh
    actor create            ; var env cust=assert_beh.13
    pair 1                  ; var (cust . env)

    roll 2                  ; (cust . env) var
    ref std.send_msg

; eval[(\x.x)(-77), {}] => -77
test_identity:
    push #?                 ; #?
    push empty_env          ; #? empty_env
    actor create            ; env=empty_env.#?

    push -77                ; env -77
    push assert_beh         ; env -77 assert_beh
    actor create            ; env cust=assert_beh.-77
    pair 1                  ; (cust . env)

    push #?                 ; (cust . env) #?
    push variable           ; (cust . env) #? variable
    actor create            ; (cust . env) _x_=variable.#?
    dup 1                   ; (cust . env) _x_ _x_
    pair 1                  ; (cust . env) (_x_ . _x_)
    push lambda             ; (cust . env) (_x_ . _x_) lambda
    actor create            ; (cust . env) lambda.(_x_ . _x_)

    push -77                ; (cust . env) lambda -77
    push constant           ; (cust . env) lambda -77 constant
    actor create            ; (cust . env) lambda param=constant.-77
    roll 2                  ; (cust . env) param lambda
    pair 1                  ; (cust . env) (lambda . param)
    push application        ; (cust . env) (lambda . param) application
    actor create            ; (cust . env) application.(lambda . param)
    ref std.send_msg

assert_beh:                 ; expect <- actual
    state 0                 ; expect
    msg 0                   ; expect actual
    cmp eq                  ; expect==actual
    assert #t               ; assert(expect==actual)
    ref std.commit

;;  #
;;  # pure-functional conditional test-case
;;  #
;;
;;  # DEF fn_true AS \cnsq.\altn.cnsq
;;  CREATE fn_true
;;      WITH b_closure(#cnsq,
;;          NEW b_lambda(#altn,
;;              NEW b_variable(#cnsq)),
;;          a_empty_env)
;;  # DEF fn_false AS \cnsq.\altn.altn
;;  CREATE fn_false
;;      WITH b_closure(#cnsq,
;;          NEW b_lambda(#altn,
;;              NEW b_variable(#altn)),
;;          a_empty_env)
;;  # DEF fn_if AS \pred.\cnsq.\altn.(pred(cnsq))(altn)
;;  CREATE fn_if
;;      WITH b_closure(#pred,
;;          NEW b_lambda(#cnsq,
;;              NEW b_lambda(#altn,
;;                  NEW b_application(
;;                      NEW b_application(
;;                          NEW b_variable(#pred),
;;                          NEW b_variable(#cnsq)
;;                      ),
;;                      NEW b_variable(#altn)
;;                  )
;;              )
;;          ),
;;          a_empty_env)
;;  # ((if(true))(#a))(#b) -> #a
;;  SEND (println, #eval, a_empty_env) TO
;;      NEW b_application(
;;          NEW b_application(
;;              NEW b_application(
;;                  NEW b_literal(fn_if),
;;                  NEW b_literal(fn_true)),
;;              NEW b_literal(#a)),
;;          NEW b_literal(#b))

.export
    empty_env
    binding
    constant
    variable
    lambda
    application
    boot
