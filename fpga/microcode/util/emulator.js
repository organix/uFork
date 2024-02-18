// @ts-check
/**
 * @overview This is the instruction level emulator for testing the microcode image
 * @author Zarutian
 */

export const makeEmulator = (opts) => {
  const emu = {};
  const memory = new Map();
  let pc = 0x0100;
  const dstack = makeStack();
  const rstack = makeStack();
  emu.doOneInstruction = () => {
    const instr = memory.get(pc);
    pc = incr(pc);
    switch (instr) {
    }
  }
  
  return emu;
};

export default {
  makeEmulator,
};
