// @ts-check
/**
 * @overview This is a small macro assembler
 * @author Zarutian
 **/

export const makeAssembler = (opts) => {
  opts = (opts == undefined) ? {} : opts;
  const cellsize = (opts.cellsize == undefined) ? 16 : opts.cellsize ;
  const fullcellBitmask = makeBitmask(cellsize);
  const syms = (opts.symbols == undefined) ? new Map() : opts.symbols ;
  let curr_addr = (opts.origin  == undefined) ? 0x0000 : opts.origin ;
  const image = (opts.image == undefined) ? new Map() : opts.image ;

  const asm = {
    get addr() { return curr_addr },
  };
  
  asm.symbols = {};
  asm.symbols.define =    (sym, val = undefined) => {
    if (val == undefined) {
      val = curr_addr;
    }
    if (syms.has(sym)) {
      throw new Error(`the symbol ${sym} is already defined as ${syms.get(sym)}`);
    }
    syms.set(sym, val);
    return val;
  };
  asm.symbols.lookup =    (sym) => { return syms.get(sym); };
  asm.symbols.isDefined = (sym) => { return syms.has(sym); };
  asm.symbols.redefine  = (sym, val = undefined) => {
    syms.delete(sym);
    asm.symbols.define(sym, val);
  };

  asm.allot = (amount = 1) => {
    curr_addr = (curr_addr + amount) & fullcellBitmask;
    return curr_addr;
  };
  asm.origin = (new_addr) => {
    const tmp = curr_addr;
    curr_addr = new_addr;
    return tmp;
  };

  asm.datum = (item) => {
    image.set(curr_addr, item);
    asm.allot(1);
  };

  const resolveImage = () => {
    const snapshot = new Map(image.entries());
    snapshot.forEach((item, addr) => {
      switch (typeof item) {
        case "string":
          if (!(asm.symbols.isDefined(item))) {
            throw new Error(`encountered undefined symbol ${item} during image resolvement`);
          }
          item = asm.symbols.lookup(item);
          break;
        case "function":
          item = item(asm, addr);
          break;
      }
      image.set(addr, item);
    });
  };

  asm.done = () => {
    resolveImage();
    return Promise.resolve({ image, symbols: syms });
  };
  
  return asm;
}
export default {
  makeAssembler,
}
