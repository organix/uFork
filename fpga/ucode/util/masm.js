// @ts-check js
// @use JSDoc
/**
 * @overview This is a small macro assembler for the uFork microcode
 * @author Zarutian
 */

import { makeArrayFromIterator, makePromise, makeBitmask } from "./util_funcs.js";

export const makeAssembler = (opts) => {
  opts = (opts == undefined) ? {} : opts;
  const cellsize = (opts.cellsize == undefined) ? 16 : opts.cellsize ;
  const fullcellBitmask = makeBitmask(cellsize);
  const syms = (opts.symbols == undefined) ? new Map() : opts.symbols ;
  let curr_addr = (opts.origin  == undefined) ? 0x0000 : opts.origin ;
  const image = (opts.image == undefined) ? new Map() : opts.image ;

  const {
    promise: done_promise,
    resolve: done_resolve,
    reject:  done_reject,
  } = makePromise();

  let toString_recursion_depth = 0;
  
  const asm = {
    get addr() { return curr_addr },
  };
  asm.symbols = {
      define: (sym, val = undefined) => {
        if (val == undefined) {
          val = curr_addr;
        }
        // next line is debug only
        // console.log(`defining symbol '${sym}' as '${val}'`);
        if (typeof val == "string") {
          val = asm.symbols.lookup(val);
        }
        if (syms.has(sym)) {
          // next line is debug only
          // console.log("merkill 1");
          const tmp = syms.get(sym);
          if (typeof tmp == "object") {
            // next line is debug only
            // console.log("merkill 2");
            if ((typeof tmp.resolve) == "function") {
              tmp.resolve(val);
              syms.set(sym, val);
            } else {
              console.dir(tmp);
              throw new Error(`the symbol ${sym} is already defined as ${tmp} (2)`);
            }
          } else {
            throw new Error(`the symbol ${sym} is already defined as ${tmp} (1)`);
          }
        } else {
          syms.set(sym, val);
        }
        return syms.get(sym);
      },
      lookup: (sym) => {
        // next line is debug only
        // console.log(`looking up symbol '${sym}'`);
        if (syms.has(sym)) {
          let val = syms.get(sym);
          // console.log(`merkill 3: '${sym}' er '${val}'`);
          switch (typeof val) {
            case "string": return asm.symbols.lookup(val);
            case "bigint": val = BigInt.asUintN(cellsize, val); // fallthrough
            case "number": return Math.trunc(val) & fullcellBitmask;
            case "boolean": return (val ? fullcellBitmask : 0);
            case "object":
              // assume it is an record with promise
              return val.promise;
          }
          return val;
        } else {
          // console.dir(syms);
          const tmp = makePromise();
          // console.log(`asm.symbols.lookup("${sym}"): ${tmp.promise}`);
           const t1 = tmp.promise.toString();
           tmp.promise.toString = () => `${t1.slice(0, -1)} from lookup of "${sym}"]`;
          syms.set(sym, tmp);
          return tmp.promise;
        }
      },
      isDefined: (sym) => {
        const t1 = syms.has(sym);
        if (t1) {
          const t2 = (typeof syms.get(sym));
          return ((t2 == "number") || (t2 == "function"));
        } else {
          return false;
        }
      },
      redefine: (sym, val = undefined) => {
        syms.delete(sym);
        return asm.symbols.define(sym, val);
      },
    }
  asm.allot = (amount = 1) => {
    curr_addr = (curr_addr + amount) & fullcellBitmask;
    return curr_addr;
  };
  const datum = (item) => {
    let val = item;
    switch (typeof val) {
      case "undefined": return;
      case "string": return datum(asm.symbols.lookup(val)); break;
      case "bigint": val = BigInt.asUintN(cellsize, val); // fallthrough
      case "number": val = Math.trunc(val) & fullcellBitmask; break;
      case "boolean": val = (val ? fullcellBitmask : 0); break;
      case "function": return datum(val(asm)); break;
      case "object":
        if (val == null) {
          val = 0;
        } else if (val instanceof Promise) {
          const captured_address = curr_addr;
          val.then((result) => {
            const old_addr = curr_addr;
            asm.undatum(captured_address);
            asm.origin(captured_address);
            datum(result);
            asm.origin(old_addr);
          });
        } else if (val instanceof Array) {
          Array.prototype.forEach.call(val, datum);
          return;
        } else if (val[Symbol.iterator] != undefined) {
          const it = val[Symbol.iterator].call(val);
          let nextObj = {};
          nextObj.done = false;
          nextObj.value = undefined;
          while (!(nextObj.done)) {
            nextObj = it.next(curr_addr);
            if (nextObj.value != undefined) {
              datum(nextObj.value);
            }
          }
          return;
        } else if (val instanceof Function) {
          datum(val(asm));
          return;
        }
        break;
    }
    if (image.has(curr_addr)) {
      const prev_val = image.get(curr_addr);
      if ((typeof prev_val) == "object") { // assume its a promise pack
        if (prev_val.resolve != undefined) {
          image.delete(curr_addr);
          prev_val.resolve([curr_addr, val]);
        } else {
          throw new Error("fallmerkill1");
        }
      } else {
        // console.dir(val);
        throw new Error(`image address 0x${curr_addr.toString(16).padStart(4, "0")} already has ${prev_val.toString(16).padStart(4, "0")} assigned to it whilist ${val.toString(16).padStart(4, "0")} was attempted to be assigned to it`);
      }
    }
    if ((typeof val) == "function") {
      throw new Error("fallmerkill2");
    }
    // console.log(` here: 0x${curr_addr.toString(16)}`);
    image.set(curr_addr, val);
    asm.allot(1);
  };
  asm.datum = datum;
  asm.undatum = (address) => {
    image.delete(address);
  };
  asm.datumAt = (address) => {
    if (image.has(address)) {
      const val = image.get(address);
      if ((typeof val) == "object") {
        if (!(val instanceof Promise)) { // assume its a promise pack
          return val.promise;
        }
      }
      return val;
    } else {
      // image cell at address yet to be assigned a value
      const val = makePromise();
      image.set(address, val);
      return val.promise;
    }
  };
  asm.data = (...datums) => Array.prototype.forEach.call(datums, datum);
  asm.deferedOp = {};
  const deferedOp_common = (a, b, op) => {
    if ((typeof a) == "string") {
      a = asm.symbols.lookup(a);
    }
    if ((typeof b) == "string") {
      b = asm.symbols.lookup(b);
    }
    if (((typeof a) == "number") && ((typeof b) == "number")) {
      const r = Promise.resolve(op(a, b));
      r.toString = () => `[Promise from (${op.toString()})(${a},${b});`;
      return r;
    }
    if (((typeof a) == "function") || ((typeof b) == "function")) {
      throw new Error("not yet implemented!");
    }
    const a2 = (a instanceof Promise) ? a : Promise.resolve(a);
    const a2_oldToString = a2.toString;
    a2.toString = () => {
      if (toString_recursion_depth < 10) {
        toString_recursion_depth += 1;
        const result = `[Promise of ${a}]`
        toString_recursion_depth -= 1;
        return result;
      } else {
        // return `[Promise of [..recursion limit..]]`;
        return a2_oldToString();
      }
    };
    const b2 = (b instanceof Promise) ? b : Promise.resolve(b);
    const b2_oldToString = b2.toString;
    b2.toString = () => {
      if (toString_recursion_depth < 10) {
        toString_recursion_depth += 1;
        const result = `[Promise of ${b}]`
        toString_recursion_depth -= 1;
        return result;
      } else {
        // return `[Promise of [..recursion limit..]]`;
        return b2_oldToString();
      }
    };
    const r = Promise.all([a2, b2]).then(([a_real, b_real]) => op(a_real, b_real));
    r.toString = () => `[Promise from (${op.toString()})(${a},${b})]`;
    return r;
  };
  asm.deferedOp.or    = (a, b) => deferedOp_common(a, b, (a, b) => (a | b));
  asm.deferedOp.and   = (a, b) => deferedOp_common(a, b, (a, b) => (a & b));
  asm.deferedOp.incr  = (a, b) => deferedOp_common(a, b, (a, b) => (a + b));
  asm.deferedOp.plus  = asm.deferedOp.incr;
  asm.deferedOp.minus = (a, b) => deferedOp_common(a, b, (a, b) => (a - b));
  asm.deferedOp.decr  = asm.deferedOp.minus;
  asm.deferedOp.equal = (a, b) => {
    // console.log(`deferedOp.equal(${a},${b})`);
    if (((typeof a) == "string") && ((typeof b) == "string")) {
      if (a == b) {
        return Promise.resolve(true);
      }
    }
    return deferedOp_common(a, b, (a, b) => (a == b));
  };
  asm.deferedOp.intDivide = (divident, divisor) => deferedOp_common(divident, divisor, (a, b) => (Math.ceil(a / b)));
  asm.deferedOp.multiply  = (a, b) => deferedOp_common(a, b, (a, b) => (a * b));
  asm.incr = asm.deferedOp.incr;
  asm.origin = (new_addr) => {
    const tmp = curr_addr;
    curr_addr = new_addr;
    return tmp;
  };
  asm.def = asm.symbols.define;
  asm.isDefined = asm.symbols.isDefined;
  asm.org = asm.origin;
  asm.dat = asm.data;
  asm.whenDone = () => done_promise;
  asm.done = () => {
    // iterate through the symbols, looking for promise packs
    const errs = makeArrayFromIterator(syms.entries()).reduce((acc, [sym, val]) => {
      if ((typeof val) == "object") {
        if (val.promise != undefined) {
          console.log(`villuleit: '${sym}' er '${val}'`);
          // console.dir(val);
          acc.push(new Error(`symbol ${sym} is not defined`));
        }
      }
      return acc;
    }, []);
    if (errs.length > 0) {
      done_reject(errs.map((item) => Promise.reject(item)));
    }
    // iterate through the image, looking for promises
    image.forEach((val, addr) => {
      if ((typeof val) == "object") {
        if (val.promise != undefined) {
          val.promise.then((resolved) => image.set(addr, resolved));
        }
        if (val instanceof Promise) {
          // done_reject(new Error(`addr ${addr} has a promise and no concrete value`));
          val.then((resolved) => image.set(addr, resolved));
        }
      }
    });
    done_resolve({ symbols: syms, image });
  };

  asm.ascii = (str) => {
    str.split("").forEach((char) => {
      datum(char.charCodeAt(0));
    });
  };
  
  return asm;
};

export default {
  makeAssembler,
}
