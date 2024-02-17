// @ts-check js
// @use JSDoc
/**
 * @overview This is a small macro assembler for the uFork microcode
 * @author Zarutian
 */

const makePromise = () => {
  let resolve = undefined;
  let reject  = undefined;
  let prom    = new Promise((res, rej) => {
    [resolve, reject] = [res, rej];
  });
  return { promise: prom, resolve, reject };
};

const makeBitmask = (width) => {
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
  
  const asm = {
    get addr: () => curr_addr,
    set addr: (val) => asm.origin(val),
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
          symbols.set(symb, tmp);
          return tmp.promise;
        }
      },
    }
  asm.allot = (amount = 1) => {
    curr_addr = (curr_addr + amount) & fullcellBitmask;
    return curr_addr;
  };
  const datum = (item) => {
    let val = undefined;
    switch (typeof item) {
      case "string": val = asm.symbols.lookup(item); break;
    }
  };
  asm.data = (...datums) => Array.prototype.forEach(datum);
  asm.origin = (new_addr) => {
    const tmp = curr_addr;
    curr_addr = new_addr;
    return tmp;
  };
  asm.def = asm.symbols.define;
  asm.org = asm.origin;
  asm.dat = asm.data;
  
  return asm;
};

export default {
  makeAssembler,
}
