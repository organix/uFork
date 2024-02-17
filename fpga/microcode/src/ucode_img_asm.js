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

  def("UM+", "UMPLUS");
  def("&",   "AND");
  def("⊕",   "XOR");
  def("1+",  "INCR");
  def("@",   "FETCH");
  def("!",   "STORE");
  def(">R",  "TO_R");
  def("R>",  "R_FROM");
  
  return asm;
};

export const makeUcodeImage = (opts) => {
};

export default {
  makeUcodeImage,
};
