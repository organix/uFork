;;;
;;; examples.scm (tutorial examples)
;;;

(define w (lambda (f) (f f)))  ; self-application
(define Y  ; applicative Y-combinator (recursive fixed-point)
	(lambda (f) 
		((lambda (g) 
			(g g)) 
			(lambda (h) 
				(lambda (x) 
					((f (h h)) x))))))

(define fact  ; recursive factorial (inefficient)
  (lambda (n)
    (if (> n 1)
      (* n (fact (- n 1)))
      1)))
;(define fact (lambda (n) (if (< n 2) 1 (* n (fact (- n 1))))))

(define fib  ; O(n^3) performance?
  (lambda (n)
    (if (< n 2)
      n
      (+ (fib (- n 1)) (fib (- n 2))))))
(define fib  ; exercise local `let` bindings
  (lambda (n)
    (if (< n 2)
      n
      (let ((x (fib (- n 1)))
            (y (fib (- n 2))))
        (+ x y)) )))
(define fib  ; exercise local `define` bindings
  (lambda (n)
    (if (< n 2)
      n
      (seq
        (define x (fib (- n 1)))
        (define y (fib (- n 2)))
        (+ x y)) )))

;; mutual recursion example (very inefficient)
(define even?
  (lambda (n)
    (if (= n 0)
      #t
      (odd? (- n 1)) )))
(define odd?
  (lambda (n)
    (if (= n 0)
      #f
      (even? (- n 1)) )))

;; Ackermann function
(define ack
  (lambda (n m)
    (cond
      ((eq? n 0)
        (+ m 1))
      ((eq? m 0)
        (ack (- n 1) 1))
      (#t
        (ack (- n 1) (ack n (- m 1)))) )))

;; TAKeuchi function
(define tak
  (lambda (x y z)
    (if (< y z)
      (tak (tak (- x 1) y z)
           (tak (- y 1) z x)
           (tak (- z 1) x y))
      z)))

(define member?
  (lambda (x xs)
    (if (pair? xs)
      (or (eq? x (car xs)) (member? x (cdr xs)))
      #f)))

;;;
;;; macro helpers
;;;

;(define expand-with-gensyms
;  (lambda (syms . body)
(define with-gensyms
  (macro (syms . body)
    (define defsym (lambda (s) `(define ,s (gensym))))
    `(seq ,@(map defsym syms) ,@body) ))

;;;
;;; sealer/unsealer examples
;;;

;;
;; [https://community.spritely.institute/t/rights-amplification-term-alternate/141/28]
;;
; const makeSealerAndUnseler = (brandmark) => {
;   let cell = undefined;
;   const sealer = (specimen) => {
;     const box = () => {
;       cell = specimen;
;       return undefined;
;     };
;     return box;
;   };
;   const unsealer = (box) => {
;     try {
;       box();
;       const specimen = cell;
;       cell = undefined;
;       return specimen;
;     } catch (err) {
;       throw new Error(“unsuccessfull unsealing”);
;     }
;   };
;   return [sealer, unsealer];
; }
;;
;; [https://community.spritely.institute/t/rights-amplification-term-alternate/141/29]
;;
;; This is just constructed to be a unique value, eq? to nothing,
;; which can be compared by a user to see if the unsealing failed.
;; The sealer and unsealer do not themselves use it.
; (define the-nothing (cons '*the* '*nothing*))
; 
; (define (make-sealer-and-unsealer)
;   (define cell the-nothing)    ; Shared, temp private register
;   (define (sealer specimen)    ; Sealer procedure
;     (define (box run-me)       ; New sealed box procedure
;       (set! cell specimen))    ; Set to temp register
;     box)                       ; Return procedure
;   (define (unsealer box)       ; Unsealer procedure
;     (set! cell the-nothing)    ; Clear the register
;     (box)                      ; Move sealed val to register
;     cell)                      ; Return value from register
;   (values sealer unsealer))    ; Return sealer, unsealer


;;;
;;; encapsulated (sealed) data-types
;;;

(define new-seal
  (lambda ()
    (define brand (gensym))
    (define seal
      (lambda (payload)
        (cell brand payload)))
    (define unseal
      (lambda (sealed)
        (if (eq? (get-t sealed) brand)
          (get-x sealed)
          #?)))
    (define sealed?
      (lambda objs
        (if (pair? objs)
          (if (eq? (get-t (car objs)) brand)
            (apply sealed? (cdr objs))
            #f)
          #t)))
    (list seal unseal sealed?)))

;;;
;;; secure immutable polymorphic abstract data-types
;;;

(define new-adt
  (lambda (dispatch)
    (define new
      (lambda (x y z)
        (cell dispatch x y z)))
    (define adt?
      (lambda objs
        (if (pair? objs)
          (if (eq? (get-t (car objs)) dispatch)
            (apply adt? (cdr objs))
            #f)
          #t)))
    (define fields
      (lambda (adt)
        (if (eq? (get-t adt) dispatch)
          (list (get-x adt) (get-y adt) (get-z adt))
          #?)))
    (list new adt? fields) ))
(define adt-call
  (lambda (adt . method)
    ;(print 'adt-call: (get-t adt) (get-x adt) (get-y adt) (get-z adt) (cons adt method))  ;; tracing...
    (if (actor? (get-t adt))
      (CALL (get-t adt) (cons adt method))
      #?)))

;; dict = { t:dict-dispatch, x:key, y:value, z:next }
(define dict-dispatch
  (lambda (this selector . args)
    (let (((key value next) (dict-fields this)))
      ;(print 'dict-dispatch: this (cons selector args) key value next)  ;; tracing...
      (cond
        ((eq? selector 'get)                                  ; (get <key>)
          (if (eq? key (car args))
            value
            (if (dict? next)
              (adt-call next 'get (car args))
              #?)))
        ((eq? selector 'has)                                  ; (has <key>)
          (if (eq? key (car args))
            #t
            (if (dict? next)
              (adt-call next 'has (car args))
              #f)))
        ((eq? selector 'set)                                  ; (set <key> <value>)
          (if (adt-call this 'has (car args))
            (new-dict (car args) (cadr args) (adt-call this 'delete (car args)))
            (new-dict (car args) (cadr args) this) ))
        ((eq? selector 'delete)                               ; (delete <key>)
          (if (eq? key (car args))
            next
            (if (dict? next)
              (new-dict key value (adt-call next 'delete (car args)))
              this)))
        ((eq? selector 'zip)                                  ; (zip)
          (if (dict? next)
            (cons (cons key value) (adt-call next 'zip))
            (cons (cons key value) next) ))
        (#t
          #?) )) ))
(define (new-dict dict? dict-fields) (new-adt dict-dispatch))
;> (define d0 (new-dict 'foo 123 ()))
;==> #unit
;> (dict? d0)
;==> #t
;> (adt-call d0 'has 'foo)
;==> #t
;> (adt-call d0 'has 'bar)
;==> #f
;> (adt-call d0 'get 'foo)
;==> +123
;> (adt-call d0 'get 'bar)
;==> #?
;> (adt-call d0 'delete 'foo)
;==> ()
;> (eq? (adt-call d0 'delete 'bar) d0)
;==> #t
;> (define d1 (adt-call d0 'set 'bar 456))
;==> #unit
;> (dict? d1)
;==> #t
;> (adt-call d1 'get 'foo)
;==> +123
;> (adt-call d1 'get 'bar)
;==> +456
;> (list d0 d1)
;==> (^6453 ^10641)
;> (list (get-t d0) (get-x d0) (get-y d0) (get-z d0))
;==> (#actor@5038 foo +123 ())
;> (list (get-t d1) (get-x d1) (get-y d1) (get-z d1))
;==> (#actor@5038 bar +456 ^6453)
;> (eq? (caddr (dict-fields d1)) d0)
;==> #t

;;;
;;; actor idioms
;;;

(define sink-beh (BEH _))
(define a-sink (CREATE sink-beh))

(define a-printer
  (CREATE
    (BEH msg
      (seq (print msg) (newline))
    )))

(define fwd-beh
  (lambda (rcvr)
    (BEH msg
      (SEND rcvr msg)
    )))

(define once-beh
  (lambda (rcvr)
    (BEH msg
      (SEND rcvr msg)
      (BECOME sink-beh)
    )))

(define label-beh
  (lambda (rcvr label)
    (BEH msg
      (SEND rcvr (cons label msg))
    )))

(define tag-beh
  (lambda (rcvr)
    (BEH msg
      (SEND rcvr (cons SELF msg))
    )))

(define once-tag-beh  ;; FIXME: find a better name for this...
  (lambda (rcvr)
    (BEH msg
      (SEND rcvr (cons SELF msg))
      (BECOME sink-beh)
    )))

(define a-testcase
  (CREATE
    (BEH _
      ;(seq (print 'SELF) (debug-print SELF) (newline))
      (define a-fwd (CREATE (fwd-beh a-printer)))
      (define a-label (CREATE (label-beh a-fwd 'tag)))
      (define a-once (CREATE (once-beh a-label)))
      (SEND a-fwd '(1 2 3))
      (SEND a-once '(a b c))
      (SEND a-once '(x y z))
    )))

;(define a-testfail (CREATE (BEH _ (SEND a-printer 'foo) (FAIL 420) (SEND a-printer 'bar))))
