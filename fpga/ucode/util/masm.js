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
  asm.symbols.define = (sym, val = undefined) => { };
  asm.symbols.lookup = (sym) => { };
  asm.symbols.isDefined = (sym) => { };
  asm.symbols.redefine  = (sym, val = undefined) => { };

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
    
  };

  asm.done = () => { };

  
  return asm;
}
export default {
  makeAssembler,
}
