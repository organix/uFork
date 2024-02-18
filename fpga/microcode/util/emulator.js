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
      // UMPLUS
      case 0x0001:
      // AND
      case 0x0002:
      // XOR
      case 0x0003:
      // 1LBR
      case 0x0004:
      // INCR
      case 0x0005:
      // FETCH
      case 0x0006:
      // STORE
      case 0x0007:
      // DUP
      case 0x0008:
      // DROP
      case 0x0009:
      // SWAP
      case 0x000A:
      // SKZ
      case 0x000B:
  def("TO_R",   0x000C);
  def("R_FROM", 0x000D);
  def("EXT",    0x000E);
  def("EXIT",   0x000F);

  def("QUAD_T_FETCH", 0x0010);
  def("QUAD_X_FETCH", 0x0011);
  def("QUAD_Y_FETCH", 0x0012);
  def("QUAD_Z_FETCH", 0x0013);
  def("QUAD_T_STORE", 0x0014);
  def("QUAD_X_STORE", 0x0015);
  def("QUAD_Y_STORE", 0x0016);
  def("QUAD_Z_STORE", 0x0017);
  def("QUAD_ALLOCATE", 0x0018);
  def("QUAD_FREE",    0x0019);
  def("QUAD_GCSTEP",  0x001A);

  def("DEBUG_LED",    0x003C);
  def("DEBUG_RX?",    0x003D);
  def("DEBUG_TX?",    0x003E);
  def("DEBUG_TX!",    0x003F);
    }
  }
  
  return emu;
};

export default {
  makeEmulator,
};
