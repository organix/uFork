// uFork disassembler.

// Transforms uFork intermediate representation
// to uFork assembly-language text.

// The intermediate representation is described in `ir.md`.
// The assembly-language is described in `asm.md`.

function chain_to_list(chain) {
    let list = [];
    while (chain?.kind === "instr") {
        if ((chain.op === "if") || (chain.op === "jump")) {
            return;  // branching breaks the chain
        }
        list.push(chain);
        chain = chain.k;
    }
    return list;
}

function join_instr_chains(t_chain, f_chain, j_label) {
    return;  // disable code sharing!
/*
    let t_list = chain_to_list(t_chain);
    if (!t_list) {
        return;
    }
    let f_list = chain_to_list(f_chain);
    if (!f_list) {
        return;
    }
    while (t_list.length > 0 && f_list.length > 0) {
        t_chain = t_list.pop();
        f_chain = f_list.pop();
        if (t_chain.op !== f_chain.op
        || !equal_to(t_chain.imm, f_chain.imm)) {
            break;
        }
    }
    const join = t_chain.k;
    const j_ref = new_ref(undefined, j_label);
    t_chain.k = j_ref;
    f_chain.k = j_ref;
    return join;
*/
}

function disassemble(ir) {
    let asm_label = 0;  // sequence number for generating unique labels
    /*
    prefixes {a, d, f, i, j, k, n, t, v, x, y}
        if: t, f, j
        instr: i, k
        quad: x, y
        pair: a, d
        dict: v, n
    */

    function is_asm_leaf(ast) {
        if (typeof ast === "object") {
            const kind = ast?.kind;
            if (kind === "literal" || kind === "ref") {
                return true;
            }
            if (kind === "type") {
                return (typeof ast.arity !== "number");
            }
            return false;
        }
        return true;
    }

    function to_asm(ast) {
        if (ast?.error) {
            return JSON.stringify(ast, undefined, 2);
        }
        if (typeof ast === "string") {
            return ast;
        }
        if (typeof ast === "number") {
            return String(ast);
        }
        let s = "";
        const kind = ast?.kind;
        if (kind === "module") {
            let imports = ast?.import;
            if (imports) {
                const entries = Object.entries(imports);
                if (entries.length > 0) {
                    s += ".import\n";
                    for (const [name, value] of entries) {
                        s += "    " + name + ": ";
                        s += JSON.stringify(value) + "\n";
                    }
                }
            }
            asm_label = 1;
            for (const [name, value] of Object.entries(ast.define)) {
                s += '"' + name + '"' + ":\n";
                if (is_asm_leaf(value)) {
                    s += "    ref " + to_asm(value) + "\n";
                } else {
                    s += to_asm(value);
                }
            }
            let exports = ast?.export;
            if (Array.isArray(exports) && exports.length > 0) {
                s += ".export\n";
                for (const name of exports) {
                    s += "    " + '"' + name + '"' + "\n";
                }
            }
        } else if (kind === "instr") {
            s += "    " + ast.op;
            if (ast.op === "if") {
                // generate labels for branch targets
                let t_label = '"' + "t~" + asm_label + '"';
                let f_label = '"' + "f~" + asm_label + '"';
                let j_label = '"' + "j~" + asm_label + '"';
                asm_label += 1;
                s += " " + (ast.t.kind === "ref" ? to_asm(ast.t) : t_label);
                s += " " + (ast.f.kind === "ref" ? to_asm(ast.f) : f_label);
                s += "\n";
                const join = join_instr_chains(ast.t, ast.f, j_label);
                if (ast.t.kind !== "ref") {
                    s += t_label + ":\n";
                    s += to_asm(ast.t);
                }
                if (ast.f.kind !== "ref") {
                    s += f_label + ":\n";
                    s += to_asm(ast.f);
                }
                if (join) {
                    s += j_label + ":\n";
                    s += to_asm(join);
                }
                return s;
            }
            if (ast.op !== "debug" && ast.op !== "jump") {
                if (is_asm_leaf(ast.imm)) {
                    s += " " + to_asm(ast.imm);
                } else {
                    // generate labels for immediate data
                    let i_label = "i~" + asm_label;
                    let k_label = "k~" + asm_label;
                    asm_label += 1;
                    s += " " + '"' + i_label + '"';
                    s += " " + '"' + k_label + '"' + "\n";
                    s += '"' + i_label + '"' + ":\n";
                    s += to_asm(ast.imm);
                    s += '"' + k_label + '"' + ":\n";
                    s += to_asm(ast.k);
                    return s;
                }
            }
            s += "\n";
            if (ast.op !== "end" && ast.op !== "jump") {
                if (is_asm_leaf(ast.k)) {
                    s += "    ref " + to_asm(ast.k) + "\n";
                } else {
                    s += to_asm(ast.k);
                }
            }
        } else if (kind === "symbol") {
            if (ast.module) {
                s += ast.module + ".";
            }
            s += ast.name;
        } else if (kind === "literal") {
            const name = ast.value;
            if (name === "undef") {
                return "#?";
            } else if (name === "nil") {
                return "#nil";
            } else if (name === "false") {
                return "#f";
            } else if (name === "true") {
                return "#t";
            } else {
                return "#unknown";
            }
        } else if (kind === "type") {
            const arity = ast.arity;
            if (typeof arity === "number") {
                s += "    type_t " + arity + "\n";
            } else {
                const name = ast.name;
                if (typeof name === "string") {
                    s += "#" + name + "_t";
                } else {
                    s += "#unknown_t";
                }
            }
        } else if (kind === "pair") {
            s += "    pair_t ";
            if (is_asm_leaf(ast.head)) {
                s += to_asm(ast.head) + "\n";
                if (is_asm_leaf(ast.tail)) {
                    s += "    ref " + to_asm(ast.tail) + "\n";
                } else {
                    s += to_asm(ast.tail);
                }
            } else {
                // generate labels for complex data
                let a_label = "a~" + asm_label;
                let d_label = "d~" + asm_label;
                asm_label += 1;
                s += '"' + a_label + '"' + " ";
                s += '"' + d_label + '"' + "\n";
                s += '"' + a_label + '"' + ":\n";
                s += to_asm(ast.head);
                s += '"' + d_label + '"' + ":\n";
                s += to_asm(ast.tail);
                return s;
            }
        } else if (kind === "dict") {
            s += "    dict_t ";
            if (!is_asm_leaf(ast.key)) {
                return {
                    error: "dict key must be asm leaf",
                    ast: ast
                };
            }
            s += to_asm(ast.key) + " ";
            if (is_asm_leaf(ast.value)) {
                s += to_asm(ast.value) + "\n";
                if (is_asm_leaf(ast.next)) {
                    s += "    ref " + to_asm(ast.next) + "\n";
                } else {
                    s += to_asm(ast.next);
                }
            } else {
                // generate labels for complex data
                let v_label = "v~" + asm_label;
                let n_label = "n~" + asm_label;
                asm_label += 1;
                s += '"' + v_label + '"' + " ";
                s += '"' + n_label + '"' + "\n";
                s += '"' + v_label + '"' + ":\n";
                s += to_asm(ast.value);
                s += '"' + n_label + '"' + ":\n";
                s += to_asm(ast.next);
                return s;
            }
        } else if (kind === "ref") {
            const name = ast.name;
            const module = ast.module;
            if (typeof module === "string") {
                s += module + "." + name;
            } else {
                s += '"' + ast.name + '"';
            }
        } else if (kind === "quad") {
            let arity = (ast.z === undefined)
                ? (ast.y === undefined)
                    ? (ast.x === undefined)
                        ? 0
                        : 1
                    : 2
                : 3;
            let x_is_leaf = is_asm_leaf(ast.x);
            let y_is_leaf = is_asm_leaf(ast.y);
            let z_is_leaf = is_asm_leaf(ast.z);
            // generate labels for quad data fields
            let x_label = "x~" + asm_label;
            let y_label = "y~" + asm_label;
            let s = "    quad_" + (arity + 1) + " ";
            s += to_asm(ast.t);
            let eos = "\n";
            if (arity === 1) {
                if (x_is_leaf) {
                    s += " " + to_asm(ast.x);
                } else {
                    eos += to_asm(ast.x);
                    x_is_leaf = true;
                }
            } else if (arity === 2) {
                if (x_is_leaf) {
                    s += " " + to_asm(ast.x);
                } else {
                    s += ' "' + x_label + '"';
                }
                if (y_is_leaf) {
                    s += " " + to_asm(ast.y);
                } else {
                    eos += to_asm(ast.y);
                    y_is_leaf = true;
                }
            } else if (arity === 3) {
                if (x_is_leaf) {
                    s += " " + to_asm(ast.x);
                } else {
                    s += ' "' + x_label + '"';
                }
                if (y_is_leaf) {
                    s += " " + to_asm(ast.y);
                } else {
                    s += ' "' + y_label + '"';
                }
                if (z_is_leaf) {
                    s += " " + to_asm(ast.z);
                } else {
                    eos += to_asm(ast.z);
                }
            }
            s += eos;
            if (!x_is_leaf || !y_is_leaf) {  // all leaves? no labels.
                asm_label += 1;
            }
            if (!x_is_leaf) {
                s += '"' + x_label + '"' + ":\n";
                s += to_asm(ast.x);
            }
            if (!y_is_leaf) {
                s += '"' + y_label + '"' + ":\n";
                s += to_asm(ast.y);
            }
            return s;
        } else {
            return {
                error: "unknown asm",
                ast: ast
            }
        }
        return s;
    }
    if (ir?.lang !== "uFork") {
        throw new Error("uFork IR expected");
    }
    return to_asm(ir.ast);
}

export default Object.freeze(disassemble);
