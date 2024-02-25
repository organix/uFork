// @ts-check js
// @use JSDoc
/**
 * @overview This is a small macro assembler for the uFork microcode
 * @author Zarutian
 */

export const makePromise = () => {
  let resolve = undefined;
  let reject  = undefined;
  let prom    = new Promise((res, rej) => {
    [resolve, reject] = [res, rej];
  });
  return { promise: prom, resolve, reject };
};

export const makeBitmask = (width) => {
  let result = 0;
  for (let count = 0; count < width; count++) {
    result = (result << 1) | 1;
  }
  return result;
}

export const makeAssembler = (opts) => {
  opts = (opts == undefined) ? {} : opts;
  const cellsize = (opts.cellsize == undefined) ? 16 : opts.cellsize ;
  const fullcellBitmask = makeBitmask(cellsize);
  const symbols = (opts.symbols == undefined) ? new Map() : opts.symbols ;
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
        if (typeof val == "string") {
          val = asm.symbols.lookup(val);
        }
        if (symbols.has(sym)) {
          const tmp = symbols.get(sym);
          if (typeof tmp == "object") {
            tmp.resolve(val);
            symbols.set(sym, val);
          } else {
            throw new Error(`the symbol ${sym} is already defined as ${tmp}`);
          }
        }
        return symbols.get(sym);
      },
      lookup: (sym) => {
        if (symbols.has(sym)) {
          let val = symbols.get(sym);
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
          const tmp = makePromise();
          symbols.set(sym, tmp);
          return tmp.promise;
        }
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
          let done = false;
          let value = undefined;
          while (!done) {
            { done, value } = it.next(curr_addr);
            if (value != undefined) {
              datum(value);
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
    (new Array(symbols.entries()).forEach(([sym, val]) => {
      if ((typeof val) == "object") {
        if (val.promise != undefined) {
          done_reject(new Error(`symbol ${sym} is not defined`));
        }
      }
    });
    // iterate through the image, looking for promises
    (new Array(image.entries()).forEach(([addr, val]) => {
      if ((typeof val) == "object") {
        if (val.promise != undefined) {
          done_reject(new Error(`addr ${addr} has a promise an no concrete value`));
        }
      }
    });
    done_resolve({ symbols, image });
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
