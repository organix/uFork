// @ts-check js
/**
 * @use JSDoc
 * @overview This is the micro code image
 * @author Zarutian
 */

import { makeAssembler } from "../util/masm.js";

export const defineInstructionset = (asm) => {
  const { def } = asm;
  def("NOP",    0x0000);
  def("UMPLUS", 0x0001);
  def("AND",    0x0002);
  def("XOR",    0x0003);
  def("1LBR",   0x0004);
  def("INCR",   0x0005);
  def("FETCH",  0x0006);
  def("STORE",  0x0007);
  def("DUP",    0x0008);
  def("DROP",   0x0009);
  def("SWAP",   0x000A);
  def("SKZ",    0x000B);
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
  
  def("UM+", "UMPLUS");
  def("&",   "AND");
  def("⊕",   "XOR");
  def("1+",  "INCR");
  def("@",   "FETCH");
  def("!",   "STORE");
  def(">R",  "TO_R");
  def("R>",  "R_FROM");

  def("qt@", "QUAD_T_FETCH");
  def("qx@", "QUAD_X_FETCH");
  def("qy@", "QUAD_Y_FETCH");
  def("qz@", "QUAD_Z_FETCH");
  def("qt!", "QUAD_T_STORE");
  def("qx!", "QUAD_X_STORE");
  def("qy!", "QUAD_Y_STORE");
  def("qz!", "QUAD_Z_STORE");
  
  return asm;
};

export const makeUcodeImage = (opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const asm = makeAssembler(opts.assemblerOpts);
  defineInstructionset(asm);
};

export default {
  makeUcodeImage,
};
