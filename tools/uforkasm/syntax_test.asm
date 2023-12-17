# SYNTAX TEST "Packages/uforkasm/uforkasm.sublime-syntax"
# <- source.uforkasm

; My test module
# <- punctuation.definition.comment.uforkasm
# ^^^^^^^^^^^^^^ comment.line.uforkasm

.import
# <- support.function.directive.uforkasm
    std: "./std.asm"
#   ^^^ entity.name.namespace.uforkasm
#      ^ punctuation.separator.uforkasm
#        ^^^^^^^^^^^ string.quoted.double.uforkasm
#        ^ punctuation.definition.string.begin.uforkasm
#                  ^ punctuation.definition.string.end.uforkasm
    ; comment
#   ^^^^^^^^^ comment.line.uforkasm
    lib: "../lib.asm" ; comment
#                     ^^^^^^^^^ comment.line.uforkasm

decimal:
# <- entity.name.type.constant.uforkasm
#      ^ punctuation.separator.uforkasm
    ref 0
literal:
    ref 'u'
#       ^^^ constant.numeric.integer.other.uforkasm
emoji:
    ref '😀'
#       ^^^ constant.numeric.integer.other.uforkasm
escape:
    ref '\n'
#       ^^^^ constant.numeric.integer.other.uforkasm
quad:
    quad_2 2#0011011 16#DEAF123
#   ^^^^^^ storage.type.uforkasm
#          ^^^^^^^^^ constant.numeric.integer.uforkasm
#           ^ punctuation.separator.uforkasm
#                    ^^^^^^^^^^ constant.numeric.integer.uforkasm

beh:
# <- entity.name.type.constant.uforkasm
#  ^ punctuation.separator.uforkasm
race_beh:               ; (requestors throttle) <- request
# <- entity.name.type.constant.uforkasm
#                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ comment.line.uforkasm

; The work of handling the request is deferred to a dedicated "runner" actor,
; freeing up the race requestor to accept additional requests.
# <- comment.line.uforkasm

    msg -2              ; value
#   ^^^ keyword.operator.word.uforkasm
#       ^^ constant.numeric.integer.uforkasm
#                       ^^^^^^^ comment.line.uforkasm

    push #nil           ; value callback queue running=()
#        ^^^^ constant.language.uforkasm
    push runner_beh     ; value callback queue running runner_beh
#        ^^^^^^^^^^ entity.name.type.constant.uforkasm
    typeq #actor_t      ; runner cap?(to_cancel)
#         ^^^^^^^^ constant.language.uforkasm
    if_not std.commit   ; runner
#          ^^^ entity.name.namespace.uforkasm
#             ^ punctuation.accessor.uforkasm
#              ^^^^^^ variable.other.member.uforkasm
    cmp eq #t
#          ^^ constant.language.uforkasm
    dict has
#   ^^^^ keyword.operator.word.uforkasm
#        ^^^ keyword.operator.word.uforkasm
    ref std.commit

    ; Provide a cancel capability.
#   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ comment.line.uforkasm

.export
# <- support.function.directive.uforkasm
    beh
#   ^^^ entity.name.type.constant.uforkasm
    quad
#   ^^^^ entity.name.type.constant.uforkasm
