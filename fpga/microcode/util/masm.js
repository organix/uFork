// @ts-check js
// @use JSDoc
/**
 * @overview This is a small macro assembler for the uFork microcode
 * @author Zarutian
 */

export const makeAssembler = (opts) => {
  const symbols = new Map();
  let curr_addr = 0x0000;
  
  const asm = {
    symbols: {
      define: (sym, val = undefined) => {
        if (val == undefined) {
          val = curr_addr;
        }
        if (symbols.has(sym)) {
          throw new Error(`the symbol ${sym} is already defined as ${symbols.get(sym)}`);
        }
      },
      lookup: (sym) => {
      },
    },
    get addr: () => curr_addr,
    origin: (new_addr) => {
      const tmp = curr_addr;
      curr_addr = new_addr;
      return tmp;
    },
    set addr: asm.origin,
  };
  asm.def = asm.symbols.define;
  
  return asm;
};

export default {
  makeAssembler,
}
