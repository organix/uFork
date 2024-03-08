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
            tmp.resolve(val);
            syms.set(sym, val);
          } else {
            throw new Error(`the symbol ${sym} is already defined as ${tmp}`);
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
              // asume it is an record with promise
              return val.promise;
          }
        } else {
          // console.log(`merkill 4`);
          // console.dir(syms);
          const tmp = makePromise();
          syms.set(sym, tmp);
          return tmp.promise;
        }
      },
      isDefined: (sym) => {
        return syms.has(sym);
      },
    }
  asm.allot = (amount = 1) => {
    curr_addr = (curr_addr + amount) & fullcellBitmask;
    return curr_addr;
  };
  const datum = (item) => {
    let val = item;
    switch (typeof val) {
      case "undefined": val = 0; break;
      case "string": val = asm.symbols.lookup(val); break;
      case "bigint": val = BigInt.asUintN(cellsize, val); // fallthrough
      case "number": val = Math.trunc(val) & fullcellBitmask; break;
      case "boolean": val = (val ? fullcellBitmask : 0); break;
      case "object":
        if (val == null) {
          val = 0;
        } else if (val instanceof Promise) {
          const captured_addrsss = curr_addr;
          val.then((result) => {
            image.set(captured_address, result);
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
        }
        break;
    }
    image.set(curr_addr, val);
    asm.allot(1);
  };
  asm.data = (...datums) => Array.prototype.forEach.call(datums, datum);
  asm.origin = (new_addr) => {
    const tmp = curr_addr;
    curr_addr = new_addr;
    return tmp;
  };
  asm.def = asm.symbols.define;
  asm.org = asm.origin;
  asm.dat = asm.data;
  asm.whenDone = () => done_promise;
  asm.done = () => {
    // iterate through the symbols, looking for promise packs
    makeArrayFromIterator(syms.entries()).forEach(([sym, val]) => {
      if ((typeof val) == "object") {
        console.log(`villuleit: '${sym}' er '${val}'`);
        if (val.promise != undefined) {
          done_reject(new Error(`symbol ${sym} is not defined`));
        }
      }
    });
    // iterate through the image, looking for promises
    makeArrayFromIterator(image.entries()).forEach(([addr, val]) => {
      if ((typeof val) == "object") {
        if (val.promise != undefined) {
          done_reject(new Error(`addr ${addr} has a promise an no concrete value`));
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
