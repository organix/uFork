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

  def("DEBUG_LED",    0x003C);
  def("DEBUG_RX?",    0x003D);
  def("DEBUG_TX?",    0x003E);
  def("DEBUG_TX!",    0x003F);
  
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

export const minicore = (asm, opts) => {
  const { def, dat } = asm;

  def("(JMP)"); // JuMP
  dat("R>", "@");
  def("EXECUTE");
  dat(">R", "EXIT");

  def("?:"); // ( alt conseq cond -- conseq | alt )
  dat("SKZ", "SWAP", "DROP", "EXIT");

  def("(CONST)"); // ( -- constant )
  dat("R>", "@", "EXIT");

  def("TRUE");
  dat("(CONST)", 0xFFFF);

  def("FALSE");
  dat("(CONST)", 0x0000);

  def("0x8000");
  dat("(CONST)", 0x8000);

  def("CLEAN_BOOL");
  dat(">R", "FALSE", "TRUE", "R>", "?:", "EXIT");
  
  def("INVERT");
  dat("TRUE", "XOR", "EXIT");

  def("OR");   // ( a b -- a|b )
  dat("INVERT", "SWAP", "INVERT");
  def("NAND"); // ( a b -- not(a & b)
  dat("&", "INVERT", "EXIT");

  def("(BRNZ)");
  dat("CLEAN_BOOL", "INVERT");
  def("(BRZ)"); // BRanch if Zero ( bool -- )
  dat("R>", "SWAP", ">R"); // ( raddr ) R:( bool )
  dat("DUP", "@", "SWAP"); // ( dest raddr ) R:( bool )
  dat("1+", "R>", "?:");   // ( raddr ) R:( )
  dat(">R", "EXIT");

  def("(LIT)"); // literal ( -- item )
  dat("R>", "DUP", "1+", ">R", "@", "EXIT");

  def("OVER"); // ( a b -- a b a )
  dat(">R", "DUP", "R>", "SWAP", "EXIT");

  def("2DUP"); // ( a b -- a b a b )
  dat("OVER", "OVER", "EXIT");

  def("2DROP");
  dat("DROP", "DROP", "EXIT");

  def("+"); // ( a b -- sum )
  dat("UM+");
  def("(DROP)");
  dat("DROP", "EXIT");

  def("NEGATE");
  dat("INVERT", "1+", "EXIT");

  def("1-");
  dat("NEGATE", "1+", "NEGATE", "EXIT");

  def("-"); // ( a b -- a-b )
  dat("NEGATE", "+", "EXIT");

  def("="); // ( a b -- bool )
  dat("XOR", "CLEAN_BOOL", "INVERT", "EXIT");

  def("0<"); // ( num -- bool )
  dat("0x8000", "&", "CLEAN_BOOL", "EXIT");

  def("<"); // ( a b -- bool )
  dat("-", "0<", "EXIT");

  def("<="); // ( a b -- bool )
  dat("2DUP", "<", ">R", "=", "R>", "OR", "EXIT");

  def("MAX"); // ( a b -- a | b )
  dat("2DUP", "<", "?:", "EXIT");
  
  def("TX!"); // ( char -- )
  dat("DEBUG_TX?", "(BRZ)", "TX!");
  dat("DEBUG_TX!", "EXIT");

  def("RX?", "DEBUG_RX?");
  def("EMIT", "TX!");

  def("RX"); // ( -- chr )
  dat("RX?", "(BRZ)", "RX", "EXIT");

  def("(.chr)"); // emitts a char from the cell following the call
  dat(">R", "DUP", "1+", ">R", "@", "EMIT", "EXIT");

  def("(CRLF.)";
  dat("(.chr)", 0x13, "(.chr)", 0x0D, "EXIT");
  
  return asm;
};

export const wozmon = (asm, opts) => {
  // inspired by Wozniacs Monitor (see https://gist.github.com/zarutian/7074f12ea3ed5a44ee2c58e8fcf6d7ae for example )
  // not as small though
  opts = (opts == undefined) ? {} : opts ;
  const linebuffer_start = (opts.linebuffer_start) ? 0x0200 : opts.linebuffer_start ;
  const linebuffer_max   = (opts.linebuffer_max)   ? 0x0250 : opts.linebuffer_max ;
  const mode_var_addr    = (opts.mode_var_addr)    ? 0x0251 : opts.mode_var_addr ;
  const xam_var_addr     = (opts.xam_var_addr)     ? 0x0252 : opts.xam_var_addr ;
  const tmp_var_addr     = (opts.tmp_var_addr)     ? 0x0253 : opts.tmp_var_addr ;
  const { def, dat } = asm;

  def("wozmon");
  dat("(.chr)", 0x5C, "(CRLF.)");
  def("wozmon_getline"); // ( )
  dat("wozmon_linebuffer_start");
  def("wozmon_notcr");   // ( buff_addr )
  dat("RX");             // ( buff_addr chr )
  dat("DUP", "(LIT)", 0x1B, "=", "(BRNZ)", "wozmon_escape");
  dat("DUP", "(LIT)", 0x08, "=", "(BRNZ)", "wozmon_backspace");
  dat("DUP", "EMIT");    // echo the character
  dat("SWAP", "2DUP", "!", "1+"); // store char to buffer and incr buffer ptr
  dat("DUP", "(LIT)", linebuffer_max, "<", "(BRZ)", "wozmon_escape");
  dat("SWAP");
  dat("(LIT)", 0x0D, "=", "(BRNZ)", "wozmon_notcr");
  dat("DROP", "wozmon_linebuffer_start"); // reset text index
  dat("FALSE", "wozmon_mode", "!");       // reset mode
  def("wozmon_nextitem");
  
  def("wozmon_escape"); // ( buff_addr chr -- )
  dat("2DROP", "(JMP)", "wozmon");
  def("wozmon_backspace"); // ( buff_addr chr -- buff_addr )
  dat("DROP", "1-", "wozmon_linebuffer_start", "MAX", "(JMP)", "wozmon_notcr");
  
  def("wozmon_linebuffer_start");
  dat("(CONST)", linebuffer_start);
  def("wozmon_mode");
  dat("(CONST)", mode_var_addr);
  def("wozmon_xam");
  dat("(CONST)", xam_var_addr);
  def("wozmon_st"):
  dat("(CONST)", st_var_addr);
  def("wozmon_tmp");
  dat("(CONST)", tmp_var_addr);


  return asm;
};

export const makeUcodeImage = (opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const asm = makeAssembler(opts.assemblerOpts);
  defineInstructionset(asm);
  minicore(asm);
  wozmon(asm);
};

export default {
  makeUcodeImage,
};
