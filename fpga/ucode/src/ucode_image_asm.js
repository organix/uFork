// @ts-check js
/**
 * @use JSDoc
 * @overview This is the micro code image generator
 * @author Zarutian
 */

import { makeAssembler } from "../util/masm.js";
import { uFork } from "./uFork.js";

export const defineInstructionset = (asm) => {
  const { def } = asm;
  def("NOP",    0x0000);
  def("PLUS",   0x0001);
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
  def("QUAD_ISFULL",  0x001B);

  /* tbd: unlikely to be implemented at all
  fomu spefic
  def("GPIO@",        0x0038); // gpio@ ( -- pins )
  def("GPIO!",        0x0039); // gpio! ( pins -- )
  def("GPIO_config",  0x003A); // gpio_config ( pins_config -- )

  pins:
   [0xF]: gpio pad 4
   [0xE]: gpio pad 3
   [0xD]: gpio pad 2
   [0xC]: gpio pad 1
   [0x7]: usb D-
   [0x6]: usb D+
   [0x5]: usb pull up
   [0x4]: flash busy 
   [0x3]: spi chip select flash
   [0x2]: spi mclk
   [0x1]: spi mosi
   [0x0]: spi miso
  */
  def("DEBUG_LED",    0x003B); // led! ( colour -- )
  def("DEBUG_RX?",    0x003C); // rx? ( -- ready )
  def("DEBUG_RX@",    0x003D); // rx@ ( -- char )
  def("DEBUG_TX?",    0x003E); // tx? ( -- ready )
  def("DEBUG_TX!",    0x003F); // tx! ( char -- )
  
  def("+",   "PLUS");
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

  def("qallot",  "QUAD_ALLOCATE");
  def("qfree",   "QUAD_FREE");
  def("qgcstep", "QUAD_GCSTEP");
  def("qfull?",  "QUAD_ISFULL");
  
  return asm;
};

export const minicore = (asm, opts) => {
  const { def, dat } = asm;

  def("(JMP)"); // JuMP
  dat("R>");
  def("@EXECUTE");
  dat("@");
  def("EXECUTE");
  dat(">R", "EXIT");

  def("?:"); // ( alt conseq cond -- conseq | alt )
  dat("SKZ", "SWAP");
  def("(DROP)");
  dat("DROP", "EXIT");

  def("(CONST)"); // ( -- constant )
  dat("R>", "@", "EXIT");

  def("TRUE");
  def("-1");
  dat("(CONST)", 0xFFFF);

  def("FALSE");
  def("0x0000");
  def("ZERO");
  dat("(CONST)", 0x0000);

  def("0x0A");
  dat("(CONST)", 0x0A);

  def("0x0F");
  dat("(CONST)", 0x0F);

  def("0x30");
  dat("(CONST)", 0x30);

  def("0x41")
  dat("(CONST)", 0x41);

  def("0x4000");
  dat("(CONST)", 0x4000);

  def("0x8000");
  dat("(CONST)", 0x8000);

  def("0x7FFF");
  dat("(CONST)", 0x7FFF);

  def("0xFFFE");
  dat("(CONST)", 0xFFFE);

  def("0x4000_&");
  dat("0x4000");
  def("(&)");
  dat("&", "EXIT");

  def("0x7FFF_&");
  dat("0x7FFF", "&", "EXIT");

  def("0x8000_&");
  dat("0x8000", "&", "EXIT");

  def("0x8000_OR");
  dat("0x8000", "OR", "EXIT");

  def("CLEAN_BOOL");
  dat(">R", "FALSE", "TRUE", "R>", "?:", "EXIT");
  
  def("INVERT");
  dat("TRUE");
  def("(XOR)");
  dat("XOR", "EXIT");

  def("OR");   // ( a b -- a|b )
  dat("INVERT", "SWAP", "INVERT");
  def("NAND"); // ( a b -- not(a & b)
  dat("&", "INVERT", "EXIT");

  def("(BRNZ)"); // BRanch if Not Zero ( bool -- )
  dat("CLEAN_BOOL", "INVERT");
  def("(BRZ)"); // BRanch if Zero ( bool -- )
  dat("R>", "SWAP", ">R"); // ( raddr ) R:( bool )
  dat("DUP", "@", "SWAP"); // ( dest raddr ) R:( bool )
  dat("1+", "R>", "?:");   // ( raddr ) R:( )
  dat(">R", "EXIT");

  def("(JMPTBL)"); // ( idx -- idx ) note: default case is after the table
  dat("R>");       // ( idx raddr )
  dat("2DUP");     // ( idx raddr idx raddr )
  dat("@");        // ( idx raddr idx nrOfEntries )
  dat("<");        // ( idx raddr bool )
  dat("(BRZ)", "(JMPTBL)_l0"); // ( idx raddr )
  dat("1+", "OVER", "+", "@", ">R", "EXIT");
  def("(JMPTBL)_l0"); // ( idx raddr )
  dat("DUP", "@", "+", "1+", ">R", "EXIT");

  def("(NEXT)"); // ( ) R:( count raddr -- )
  dat("R>", "R>", "DUP", "(BRZ)", "(NEXT)_l0"); // ( raddr count )
  dat("1-", ">R", "@", ">R", "EXIT");
  def("(NEXT)_l0");
  dat("DROP", "1+", ">R", "EXIT");

  def("(BREXIT)"); // ( bool -- ) exit caller early if bool is true
  dat("(BRZ)", "(BREXIT)_l0"); // ( )
  dat("R>", "DROP");
  def("(BREXIT)_l0");
  dat("EXIT");
  

  def("(LIT)"); // literal ( -- item )
  dat("R>", "DUP", "1+", ">R", "@", "EXIT");

  def("OVER"); // ( a b -- a b a )
  dat(">R", "DUP", "R>", "SWAP", "EXIT");

  def("ROT"); // ( a b c -- b c a )
  dat(">R", "SWAP", "R>", "SWAP", "EXIT");

  def("-ROT"); // ( a b c -- c a b )
  dat("SWAP", ">R", "SWAP", "R>", "EXIT");

  def("2DUP"); // ( a b -- a b a b )
  dat("OVER", "OVER", "EXIT");

  def("2DROP");
  dat("DROP", "DROP", "EXIT");

  def("NIP"); // ( a b c -- a c )
  dat("SWAP", "DROP", "EXIT");

  def("R@"); // ( -- a ) R:( a ra -- a )
  dat("R>", "R>", "DUP", ">R", "SWAP", ">R", "EXIT");

  def("RDROP"); // ( -- ) R:( x ra -- ra )
  dat("R>", "R>", "DROP", ">R", "EXIT");

  /*
  def("+"); // ( a b -- sum )
  dat("UM+");
  def("(DROP)");
  dat("DROP", "EXIT");
  */

  def("UM+");      // ( a b -- sum carry )
  dat("2DUP");     // ( a b a b )
  dat("0x7FFF_&"); // ( a b a b_masked )
  dat("SWAP");     // ( a b b_masked a )
  dat("0x7FFF_&"); // ( a b b_masked a_masked )
  dat("+");        // ( a b sum1 )
  dat("DUP");      // ( a b sum1 sum1 )
  dat("0x7FFF_&"); // ( a b sum1 sum1_masked )
  dat(">R");       // ( a b sum1 ) R:( sum1_masked )
  dat("15>>");     // ( a b sum1Carry ) R:( sum1_masked )
  dat("SWAP");     // ( a sum1Carry b ) R:( sum1_masked )
  dat("15>>");     // ( a sum1Carry b[15] ) R:( sum1_masked )
  dat("+");        // ( a sum2 ) R:( sum1_masked )
  dat("SWAP");     // ( sum2 a ) R:( sum1_masked )
  dat("15>>");     // ( sum2 a[15] ) R:( sum1_masked )
  dat("+");        // ( sum3 ) R:( sum1_masked )
  dat("DUP");      // ( sum3 sum3 ) R:( sum1_masked )
  dat("15<<");     // ( sum3 sum3[15]<<15 ) R:( sum1_masked )
  dat("R>");       // ( sum3 sum3[15]<<15 sum1_masked ) R:( )
  dat("OR");       // ( sum3 final_sum )
  dat("SWAP");     // ( final_sum sum3 )
  dat("1>>");      // ( final_sum c )
  dat("EXIT");

  def("NEGATE");
  dat("INVERT", "1+", "EXIT");

  def("1-");
  dat("NEGATE", "1+", "NEGATE", "EXIT");

  def("-"); // ( a b -- a-b )
  dat("NEGATE", "+", "EXIT");

  def("<<"); // ( u n -- u<<n )  doing the lazy way for now
  dat("0x0F_&");
  dat(">R", "(JMP)", "<<_l1");
  def("<<_l0");
  dat("1<<");
  def("<<_l1");
  dat("(NEXT)", "<<_l0");
  dat("EXIT");

  def("15<<");
  dat("0x0F", "<<", "EXIT");

  def(">>"); // ( u n -- u>>n )  same lazy way
  dat("0x0F_&");
  dat(">R", "(JMP)", ">>_l1");
  def(">>_l0");
  dat("1>>");
  def(">>_l1");
  dat("(NEXT)", ">>_l0", "EXIT");

  def("15>>");
  dat("0x0F", ">>", "EXIT");

  def("LBR"); // ( u n -- u<<>n )  same lazy way
  def("<<>");
  dat("0x0F_&");
  dat(">R", "(JMP)", "LBR_l1");
  def("LBR_l0");
  dat("1LBR");
  def("LBR_l1");
  dat("(NEXT)", "LBR_l0", "EXIT");

  def("RBR"); // ( u n -- u<>>n )  same lazy way
  def("<>>");
  dat("0x0F_&");
  dat(">R", "(JMP)", "RBR_l1");
  def("RBR_l0");
  dat("1RBR");
  def("RBR_l1");
  dat("(NEXT)", "RBR_l0", "EXIT");

  def("*"); // ( n m -- n*m )  using the lazy way here, need to find the old eForth impl
  dat(">R", "ZERO");
  dat("(JMP)", "*_l1");
  def("*_l0");
  dat("OVER", "+");
  def("*_l1");
  dat("(NEXT)", "*_l0");
  dat("NIP", "EXIT");

  def("4<<"); // ( a -- a<<4 )
  dat("2<<");
  def("2<<"); // ( a -- a<<2 )
  dat("1<<");
  def("1<<"); // ( a -- a<<1 )
  dat("1LBR");
  dat("0xFFFE", "&", "EXIT");

  def("15LBR"); def("1RBR");
  dat("1LBR");
  def("14LBR");
  dat("2LBR");
  def("12LBR");
  dat("4LBR");
  def("8LBR");
  dat("4LBR");
  def("4LBR");
  dat("2LBR");
  def("2LBR");
  dat("1LBR", "1LBR", "EXIT");

  def("1>>"); // ( a -- a>>1 )
  dat("1RBR", "0x7FFF_&", "EXIT");

  def("0x0F_&");
  dat("0x0F", "&", "EXIT");

  def("="); // ( a b -- bool )
  dat("XOR", "CLEAN_BOOL", "INVERT", "EXIT");

  def("0<"); // ( num -- bool )
  dat("0x8000", "&", "CLEAN_BOOL", "EXIT");

  def("<"); // ( a b -- bool )
  dat("-", "0<", "EXIT");

  def("<="); // ( a b -- bool )
  dat("2DUP", "<", ">R", "=", "R>", "OR", "EXIT");

  def(">");
  dat("SWAP", "(JMP)", "<");

  def(">=");
  dat("SWAP", "(JMP)", "<=");

  def("MAX"); // ( a b -- a | b )
  dat("2DUP", "<", "?:", "EXIT");
  
  def("TX!"); // ( char -- )
  dat("DEBUG_TX?", "(BRZ)", "TX!");
  dat("DEBUG_TX!", "EXIT");

  def("RX?"); // ( -- char T | F )
  dat("DEBUG_RX?", "DUP", "(BRZ)", "RX?_l0");
  dat("DEBUG_RX@", "SWAP");
  def("RX?_l0");
  dat("EXIT");
  
  def("EMIT", "TX!");

  def("RX"); // ( -- chr )
  dat("RX?", "(BRZ)", "RX", "EXIT");

  def("(.chr)"); // emitts a char from the cell following the call
  dat(">R", "DUP", "1+", ">R", "@", "EMIT", "EXIT");

  def("(CRLF.)");
  dat("(.chr)", 0x13, "(.chr)", 0x0D, "EXIT");

  def("(BL.)");
  dat("(.chr)", 0x20, "EXIT");

  def("EMIT_HEXCHR"); // ( hex -- )
  dat("0x0F_&");
  dat("DUP", "0x0A", "<", "(BRZ)", "EMIT_HEXCHR_NOTDIGIT");
  dat("0x30", "OR", "(JMP)", "EMIT");
  def("EMIT_HEXCHR_NOTDIGIT");
  dat("0x0A", "-", "0x41", "+", "(JMP)", "EMIT");

  def("EMIT_HEXWORD");
  dat("4LBR", "EMIT_HEXCHR");
  dat("4LBR", "EMIT_HEXCHR");
  dat("4LBR", "EMIT_HEXCHR");
  dat("4LBR", "EMIT_HEXCHR");
  dat("EXIT");

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
  const st_var_addr      = (opts.st_var_addr)      ? 0x0253 : opts.st_var_addr ;
  const tmp_var_addr     = (opts.tmp_var_addr)     ? 0x0254 : opts.tmp_var_addr ;
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
  dat("FALSE", "wozmon_mode", "!");       // reset mode
  dat("DROP", "wozmon_linebuffer_start"); // reset text index
  dat("1-");
  def("wozmon_nextitem");  // ( buff_addr )
  dat("1+");               // ( ba+1 )
  dat("DUP", "@");         // ( ba+1 char )
  dat("DUP", "(LIT)", 0x0D, "=", "(BRZ)", "wozmon_l0");
  dat("2DROP", "(JMP)", "wozmon_getline"); // done the line, get the next one
  def("wozmon_l0");        // ( ba+1 char )
  dat("DUP", "(LIT)", 0x2E, "=", "(BRZ)", "wozmon_l1");
  dat("(LIT)", 0xB8);      // set mode as BLOCK XAM
  def("wozmon_setmode");
  dat("wozmon_mode", "!", "DROP", "(JMP)", "wozmon_nextitem");
  def("wozmon_l1");        // ( ba+1 char )
  dat("DUP", "(LIT)", 0x3A, "=", "(BRZ)", "wozmon_l2");
  dat("(LIT)", 0x74);      // set mode as store
  dat("(JMP)", "wozmon_setmode");
  def("wozmon_l2");
  dat("DUP", "(LIT)", 0x52, "=", "(BRNZ)", "wozmon_run");
  dat(       "(LIT)", 0x51, "=", "(BRNZ)", "wozmon_quit");
  
  def("wozmon_nexthex"); // ( ba )
  dat("DUP", "@");       // get char ( ba chr )
  dat("(LIT)", 0x30, "XOR"); // map digits to 0-9 ( ba digit )
  dat("DUP", "(LIT)", 0x0A, "<", "(BRNZ)", "wozmon_dig");
  dat("(LIT)", 0x88, "+");   // map letter "A"-"F" to $FA-FF
  dat("DUP", "(LIT)", 0xFA, "<", "(BRNZ)", "wozmon_nothex");
  def("wozmon_dig");
  dat("0x0F_&");
  dat("wozmon_tmp", "@", "4<<", "OR", "wozmon_tmp", "!");
  dat("1+", "(JMP)", "wozmon_nexthex");
  
  def("wozmon_nothex");  // ( ba char )
  dat("2DROP");
  dat("wozmon_tmp", "@", "wozmon_st", "@", "OR", "(BRZ)", "wozmon");
  dat("(LIT)", 0x74, "wozmon_mode", "@", "=", "(BRZ)", "wozmon_notstore");
  dat("wozmon_tmp", "@", "wozmon_st", "@", "!");
  dat("wozmon_st",  "@", "1+", "wozmon_st", "!");
  dat("(JMP)", "wozmon_nextitem");

  def("wozmon_notstore"); // ( )
  dat("FALSE", "wozmon_mode", "@", "=", "(BRZ)", "wozmon_xamnext");
  dat("wozmon_tmp", "@", "DUP", "wozmon_st", "!", "wozmon_xam", "!");

  def("wozmon_nxtprnt");
  dat("wozmon_xam", "@", "(LIT)", 0x07, "&");
  dat("(BRNZ)", "wozmon_prdata");
  dat("(CRLF.)");
  dat("wozmon_xam", "@", "EMIT_HEXWORD");
  dat("(LIT)", 0x3A, "EMIT");

  def("wozmon_prdata");
  dat("(BL.)");
  dat("wozmon_xam", "@", "@");
  dat("EMIT_HEXWORD");

  def("wozmon_xamnext");
  dat("FALSE", "wozmon_mode", "!");
  dat("wozmon_xam", "@", "wozmon_tmp", "@", "<", "(BRZ)", "wozmon_nextitem");
  dat("wozmon_xam", "@", "1+", "wozmon_xam", "!");
  dat("(JMP)", "wozmon_nxtprnt");
  
  def("wozmon_escape"); // ( buff_addr chr -- )
  dat("2DROP", "(JMP)", "wozmon");
  def("wozmon_backspace"); // ( buff_addr chr -- buff_addr )
  dat("DROP", "1-", "wozmon_linebuffer_start", "MAX", "(JMP)", "wozmon_notcr");
  def("wozmon_run"); // ( ba chr )
  dat("2DROP", "wozmon_xam", "@", "EXECUTE", "(JMP)", "wozmon");
  def("wozmon_quit"); // ( ba )
  dat("(JMP)", "(DROP)");
  
  def("wozmon_linebuffer_start");
  dat("(CONST)", linebuffer_start);
  def("wozmon_mode");
  dat("(CONST)", mode_var_addr);
  def("wozmon_xam");
  dat("(CONST)", xam_var_addr);
  def("wozmon_st");
  dat("(CONST)", st_var_addr);
  def("wozmon_tmp");
  dat("(CONST)", tmp_var_addr);

  return asm;
};

export const makeUcodeImage = (opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const asm = makeAssembler(opts.assemblerOpts);
  defineInstructionset(asm);
  asm.org(0x0080);
  minicore(asm); // always required as lot of subsequent assemblies relie on definitions there in
  if (opts.wozmon != undefined) {
    wozmon(asm, opts.wozmon);
  }
  if (opts.uFork != undefined) {
    uFork(asm, opts.uFork);
  }

  asm.org(0x0040); // default start address
  if (opts.wozmon != undefined) {
    const startInWozmon = opts.wozmon.startInWozmon;
    if ((startInWozmon != undefined) || (startInWozmon != false)) {
      asm.dat("wozmon", "(JMP)", 0x0040); // start in wozmon, and stay in it if it was quitted
    }
  }
  if (opts.uFork != undefined) {
    const startIn_uFork_runLoop = opts.uFork.startInRunLoop;
    if ((startIn_uFork_runLoop != undefined) || (startIn_uFork_runLoop != false)) {
      asm.dat("uFork_runLoop", "(JMP)", 0x40);
    }
  }
  asm.done();
  return asm.whenDone();
};

export default {
  makeUcodeImage,
};
