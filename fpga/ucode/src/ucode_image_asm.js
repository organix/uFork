// @ts-check js
/**
 * @use JSDoc
 * @overview This is the micro code image generator
 * @author Zarutian
 */

import { makeAssembler } from "../util/masm.js";
import { uFork } from "./uFork.js";
import { defineInstructionset } from "./instruction_set.js";

export const minicore = (asm, opts) => {
  const { def, dat, isDefined } = asm;

  if (!isDefined("(JMP)")) {
    def("(JMP)"); // JuMP
    dat("R>");
  }
  def("@EXECUTE");
  dat("@");
  def("EXECUTE");
  if (isDefined("instrset_uFork_SM2") || isDefined("instrset_uFork_SM2.1")) {
    dat("0x0FFF_&");
  }
  dat(">R");
  def("(EXIT)");
  dat("EXIT");

  def("?:"); // ( alt conseq cond -- conseq | alt )
  dat("SKZ", "SWAP");
  def("(DROP)");
  dat("DROP", "EXIT");

  def("(VAR)");
  dat("R>", "EXIT");

  if (!isDefined("(CONST)")) {
    def("(CONST)"); // ( -- constant )
    dat("R>", "@", "EXIT");
  }

  def("-15");
  def("-0xF");
  def("0xFFF1");
  dat("(CONST)", 0xFFF1);

  def("-14");
  def("-0xE");
  def("0xFFF2");
  dat("(CONST)", 0xFFF2);

  def("-13");
  def("-0xD");
  def("0xFFF3");
  dat("(CONST)", 0xFFF3);

  def("-12");
  def("-0xC");
  def("0xFFF4");
  dat("(CONST)", 0xFFF4);

  def("-11");
  def("-0xB");
  def("0xFFF5");
  dat("(CONST)", 0xFFF5);
  
  def("-10");
  def("-0xA");
  def("0xFFF6");
  dat("(CONST)", 0xFFF6);

  def("-9");
  def("0xFFF7");
  dat("(CONST)", 0xFFF7);

  def("-8");
  def("0xFFF8");
  dat("(CONST)", 0xFFF8);

  def("-7");
  def("0xFFF9");
  dat("(CONST)", 0xFFF9);

  def("-6");
  def("0xFFFA");
  dat("(CONST)", 0xFFFA);

  def("-5");
  def("0xFFFB");
  dat("(CONST)", 0xFFFB);

  def("-4");
  def("0xFFFC");
  dat("(CONST)", 0xFFFC);

  def("-3");
  def("0xFFFD");
  dat("(CONST)", 0xFFFD);

  def("-2");
  def("0xFFFE");
  dat("(CONST)", 0xFFFE);

  def("TRUE");
  def("-1");
  if (isDefined("(TRUE)")) {
    dat("(TRUE)", "EXIT");
  } else {
    dat("(CONST)", 0xFFFF);
  }

  def("FALSE");
  def("0x0000");
  def("ZERO");
  def("0");
  if (isDefined("(FALSE)")) {
    dat("(FALSE)", "EXIT");
  } else {
    dat("(CONST)", 0x0000);
  }

  if (!isDefined("1")) {
    def("1");
    dat("(CONST)", 0x0001);
  }
  def("0x01", "1");
  def("0x0001", "1");
  def("ONE", "1");

  if (!isDefined("2")) {
    def("2");
    dat("(CONST)", 0x0002);
  }
  def("0x02", "2");
  def("0x0002", "2");
  def("TWO", "2");

  if (!isDefined("3")) {
    def("3");
    dat("(CONST)", 0x0003);
  }
  def("0x03", "3");
  def("0x0003", "3");
  def("THREE", "3");

  def("4");
  dat("(CONST)", 0x0004);

  def("5");
  dat("(CONST)", 0x0005);

  def("6");
  dat("(CONST)", 0x0006);

  def("7");
  dat("(CONST)", 0x0007);

  def("8");
  dat("(CONST)", 0x0008);

  def("9");
  dat("(CONST)", 0x0009);

  def("10");
  def("0xA");
  def("0x0A");
  dat("(CONST)", 0x000A);

  def("11");
  def("0xB");
  def("0x0B");
  dat("(CONST)", 0x000B);

  def("12");
  def("0xC");
  def("0x0C");
  dat("(CONST)", 0x000C);

  def("13");
  def("0xD");
  def("0x0D");
  dat("(CONST)", 0x000D);

  def("14");
  def("0xE");
  def("0x0E");
  dat("(CONST)", 0x000E);

  def("15");
  def("0xF");
  def("0x0F");
  dat("(CONST)", 0x000F);

  def("0x30");
  dat("(CONST)", 0x30);

  def("0x41")
  dat("(CONST)", 0x41);

  def("0xFF");
  dat("(CONST)", 0xFF);

  def("0x0FFF");
  dat("(CONST)", 0x0FFF);

  def("0x1FFF");
  dat("(CONST)", 0x1FFF);

  def("0x3FFF");
  dat("(CONST)", 0x3FFF);

  def("0x4000");
  dat("(CONST)", 0x4000);

  def("0x7FFF");
  dat("(CONST)", 0x7FFF);
  
  if (!isDefined("0x8000")) {
    def("0x8000");
    dat("(CONST)", 0x8000);
  }

  if (!isDefined("1_&")) {
    def("1_&");
    dat("1", "&", "EXIT");
  }
  def("1&", "1_&");

  def("3_&");
  dat("3", "&", "EXIT");
  
  def("4&");
  def("4_&");
  dat("4", "&", "EXIT");

  def("7_&");
  dat("7", "&", "EXIT");

  def("0x0F_&");
  dat("0x0F", "&", "EXIT");

  def("0xFF_&");
  dat("0xFF", "&", "EXIT");

  def("0x0FFF_&");
  dat("0x0FFF", "&", "EXIT");

  def("0x1FFF_&");
  dat("0x1FFF", "&", "EXIT");

  def("0x3FFF_&");
  dat("0x3FFF", "&", "EXIT");
  
  def("0x4000_&");
  dat("0x4000");
  def("(&)");
  dat("&", "EXIT");

  def("0x7FFF_&");
  dat("0x7FFF", "&", "EXIT");

  def("0x8000_&");
  dat("0x8000", "&", "EXIT");

  def("0x8000_OR");
  dat("0x8000");
  def("(OR)");
  dat("OR", "EXIT");

  def("CLEAN_BOOL");
  dat(">R", "FALSE", "TRUE", "R>", "?:", "EXIT");

  if (!isDefined("INVERT")) {
    def("INVERT");
    dat("TRUE");
  }
  def("(XOR)");
  dat("XOR", "EXIT");

  if (!isDefined("OR")) {
    def("OR");   // ( a b -- a|b )
    dat("INVERT", "SWAP", "INVERT");
  }
  def("NAND"); // ( a b -- not(a & b)
  dat("&", "INVERT", "EXIT");

  def("(BRNZ)"); // BRanch if Not Zero ( bool -- )
  dat("CLEAN_BOOL", "INVERT");
  // deliberate fall through
  if (!isDefined("(BRZ)")) {
    def("(BRZ)"); // BRanch if Zero ( bool -- )
  }
  def("(BRZ)_alt");
  dat("R>");
  if (isDefined("instrset_uFork_SM2")) {
    dat("0x0FFF_&");
  }
  dat("SWAP", ">R"); // ( raddr ) R:( bool )
  dat("DUP", "@", "SWAP"); // ( dest raddr ) R:( bool )
  dat("1+", "R>", "?:");   // ( raddr ) R:( )
  dat(">R", "EXIT");

  def("(BREQ)"); // ( a b -- )
  dat("=", "(JMP)", "(BRNZ)");

  def("(BRNE)"); // ( a b -- )
  dat("=", "(JMP)", "(BRZ)_alt");

  def("(JMPTBL)"); // ( idx -- idx ) note: default case is after the table
  dat("R>");       // ( idx raddr )
  dat("2DUP");     // ( idx raddr idx raddr )
  dat("@");        // ( idx raddr idx nrOfEntries )
  dat("<");        // ( idx raddr bool )
  dat("(BRZ)", "(JMPTBL)_l0"); // ( idx raddr )
  dat("1+", "OVER", "+", "@");
  if (isDefined("instrset_uFork_SM2")) {
    dat("0x0FFF_&");
  }
  dat(">R", "EXIT");
  def("(JMPTBL)_l0"); // ( idx raddr )
  dat("DUP", "@", "+", "1+");
  if (isDefined("instrset_uFork_SM2")) {
    dat("0x0FFF_&");
  }
  dat(">R", "EXIT");
  
  if (!isDefined("(NEXT)")) {
    def("(NEXT)"); // ( ) R:( count raddr -- )
    dat("R>", "R>", "DUP", "(BRZ)", "(NEXT)_l0"); // ( raddr count )
    dat("1-", ">R", "@");
    if (isDefined("instrset_uFork_SM2")) {
      dat("0x0FFF_&");
    }
    dat(">R", "EXIT");
    def("(NEXT)_l0");
    dat("DROP", "1+");
    if (isDefined("instrset_uFork_SM2")) {
      dat("0x0FFF_&");
    }
    dat(">R", "EXIT");
  }

  def("(BREXIT)"); // ( bool -- ) exit caller early if bool is true
  dat("(BRZ)", "(BREXIT)_l0"); // ( )
  dat("R>", "DROP");
  def("(BREXIT)_l0");
  dat("EXIT");
  
  if (!isDefined("(LIT)")) {
    def("(LIT)"); // literal ( -- item )
    dat("R>", "DUP", "1+", ">R", "@", "EXIT");
  }

  if (!isDefined("OVER")) {
    def("OVER"); // ( a b -- a b a )
    dat(">R", "DUP", "R>", "SWAP", "EXIT");
  }

  if (!isDefined("ROT")) {
    def("ROT"); // ( a b c -- b c a )
    dat(">R", "SWAP", "R>", "SWAP", "EXIT");
  }

  if (!isDefined("-ROT")) {
    def("-ROT"); // ( a b c -- c a b )
    dat("SWAP", ">R", "SWAP", "R>", "EXIT");
  }

  if (!isDefined("2DUP")) {
    def("2DUP"); // ( a b -- a b a b )
    dat("OVER", "OVER", "EXIT");
  }

  if (!isDefined("2DROP")) {
    def("2DROP");
    dat("DROP", "DROP", "EXIT");
  }

  if (!isDefined("NIP")) {
    def("NIP"); // ( a b c -- a c )
    dat("SWAP", "DROP", "EXIT");
  }

  if (!isDefined("TUCK")) {
    def("TUCK"); // ( a b -- b a b )
    dat("SWAP", "OVER", "EXIT");
  }

  if (!isDefined("R@")) {
    def("R@"); // ( -- a ) R:( a ra -- a )
    dat("R>", "R>", "DUP", ">R", "SWAP", ">R", "EXIT");
  }

  if (!isDefined("RDROP")) {
    def("RDROP"); // ( -- ) R:( x ra -- ra )
    dat("R>", "R>", "DROP", ">R", "EXIT");
  }

  if ((!isDefined("+")) && (!isDefined("UM+")) && isDefined("1+")) {
    def("+"); // ( a b -- sum )
    dat("0=", "(BRNZ)", "(DROP)");
    dat("1-", "SWAP", "1+", "SWAP");
    dat("(JMP)", "+");
  }

  if ((!isDefined("+")) && isDefined("UM+")) {
    def("+"); // ( a b -- sum )
    dat("UM+","DROP", "EXIT");
  }
  
  if ((!isDefined("UM+")) && isDefined("+")) {
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
  }

  if (!isDefined("NEGATE")) {
    def("NEGATE");
    dat("INVERT", "1+", "EXIT");
  }

  if (!isDefined("1-")) {
    def("1-");
    dat("NEGATE", "1+", "NEGATE", "EXIT");
  }

  if (!isDefined("-")) {
    def("-"); // ( a b -- a-b )
    dat("NEGATE", "+", "EXIT");
  }

  def("<<"); // ( u n -- u<<n )  doing the lazy way for now
  dat("0x0F_&");
  dat(">R", "(JMP)", "<<_l1");
  def("<<_l0");
  dat("1<<");
  def("<<_l1");
  dat("(NEXT)", "<<_l0");
  dat("EXIT");

  def("15<<");
  dat("1_&", "1RBR", "EXIT");

  def("8/");
  def("3>>");
  dat("3LBR", "0x1FFF_&", "EXIT");

  def(">>"); // ( u n -- u>>n )  same lazy way
  dat("0x0F_&");
  dat(">R", "(JMP)", ">>_l1");
  def(">>_l0");
  dat("1>>");
  def(">>_l1");
  dat("(NEXT)", ">>_l0", "EXIT");

  def(">>>"); // ( number times -- result )
  dat("OVER", "0x8000_&", ">R", ">>", "R>", "OR", "EXIT");

  def("15>>");
  dat("1_&", "1LBR", "EXIT");
  
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

  if (!isDefined("*")) {
    def("*"); // ( n m -- n*m )  using the lazy way here, need to find the old eForth impl
    dat(">R", "ZERO");
    dat("(JMP)", "*_l1");
    def("*_l0");
    dat("OVER", "+");
    def("*_l1");
    dat("(NEXT)", "*_l0");
    dat("NIP", "EXIT");
  }

  def("4<<"); // ( a -- a<<4 )
  dat("2<<");
  def("4*");
  def("2<<"); // ( a -- a<<2 )
  dat("1<<");
  if (isDefined("2*")) {
    dat("2*", "EXIT");
    def("1<<", "2*");
  } else {
    def("2*");
    def("1<<"); // ( a -- a<<1 )
    dat("1LBR");
    dat("0xFFFE", "&", "EXIT");
  }

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

  def("3LBR");
  dat("2LBR", "1LBR", "EXIT");

  def("3+");
  dat("1+");
  def("2+");
  dat("1+");
  dat("1+");
  dat("EXIT");

  def("1>>"); // ( a -- a>>1 )
  dat("1RBR", "0x7FFF_&", "EXIT");

  if (!isDefined("=")) {
    def("="); // ( a b -- bool )
    dat("XOR", "CLEAN_BOOL", "INVERT", "EXIT");
  }

  if (!isDefined("0=")) {
    def("0=");
    dat("CLEAN_BOOL", "INVERT", "EXIT");
  }

  def("0<"); // ( num -- bool )
  dat("0x8000", "&", "CLEAN_BOOL", "EXIT");

  if (!isDefined("<")) {
    def("<"); // ( a b -- bool )
    dat("-", "0<", "EXIT");
  }

  def("<="); // ( a b -- bool )
  dat("2DUP", "<", ">R", "=", "R>", "OR", "EXIT");

  def("WITHIN"); // ( n min max -- )
  dat(">R");     // ( n min ) R:( max )
  dat("OVER");   // ( n min n ) R:( max )
  dat("<=");     // ( n bool1 ) R:( max )
  dat("R>");     // ( n bool1 max ) R:( )
  dat("SWAP");   // ( n max bool1 ) R:( )
  dat(">R");     // ( n max ) R:( bool1 )
  dat("<=");     // ( bool2 ) R:( bool1 )
  dat("R>");     // ( bool2 bool1 ) R:( )
  dat("&");      // ( bool )
  dat("EXIT");   //

  def(">");
  dat("SWAP", "(JMP)", "<");

  def(">=");
  dat("SWAP", "(JMP)", "<=");

  def("MAX"); // ( a b -- a | b )
  dat("2DUP", "<", "?:", "EXIT");

  def("ABSOLUTE"); // ( n | -n -- n )
  def("ABS");
  dat("DUP");      // ( n n )
  dat("NEGATE");   // ( n -n )
  dat("OVER");     // ( n -n n )
  dat("0<");       // ( n -n bool )
  dat("?:");       // ( n )
  dat("EXIT");

  if (!isDefined("DEBUG_TX?") ||
      !isDefined("DEBUG_TX!") ||
      !isDefined("DEBUG_RX?") ||
      !isDefined("DEBUG_RX@")) {
    if (isDefined("instrset_FCPU-16")) {
      def("DEBUG_comms");
      dat("(VAR)", 0);

      def("DEBUG_commsport");
      dat("(CONST)", 0xFFFD);

      def("DEBUG_TX!"); // ( char -- )
      dat("0xFF_&", "DEBUG_commsport", "!", "EXIT");

      def("DEBUG_TX?", "TRUE"); // ( -- T )

      def("DEBUG_RX?"); // ( -- bool )
      dat("DEBUG_comms", "@", "0x10", "&");
      dat("CLEAN_BOOL");
      dat("DUP", "(BRNZ)", "DEBUG_RX?_l0");
      def("DEBUG_comms_common");
      dat("DEBUG_commsport", "@", "DEBUG_comms", "!");
      def("DEBUG_RX?_l0");
      dat("EXIT");

      def("DEBUG_RX@"); // ( -- char )
      dat("DEBUG_comms", "@", "0xFF_&", "(JMP)", "DEBUG_comms_common");
    }
    if (isDefined("instrset_excamera_J1a")) {
      def("DEBUG_RX?"); // ( -- bool )
      dat("(LIT)", 0x2000, "io@", "2", "&", "CLEAN_BOOL", "EXIT");

      def("DEBUG_TX?"); // ( -- bool )
      dat("(LIT)", 0x2000, "io@", "1", "&", "CLEAN_BOOL", "EXIT");

      def("DEBUG_RX@"); // ( -- char )
      dat("(LIT)", 0x1000, "io@", "0xFF_&", "EXIT");

      def("DEBUG_TX!"); // ( char -- )
      dat("0xFF_&", "(LIT)", 0x1000, "io!", "EXIT");
    }
    if (isDefined("instrset_uFork_SM2")) {
      // 0x3F00 is TX?, 0x3F01 is TX!, 0x3F02 is RX?, and 0x3F03 is RX@
      def("DEBUG_RX?"); // ( -- bool )
      dat("(LIT)", 0x3F02, "@", "CLEAN_BOOL", "EXIT");

      def("DEBUG_TX?"); // ( -- bool )
      dat("(LIT)", 0x3F00, "@", "CLEAN_BOOL", "EXIT");

      def("DEBUG_RX@"); // ( -- char )
      dat("(LIT)", 0x3F03, "@", "0xFF_&", "EXIT");

      def("DEBUG_TX!"); // ( char -- )
      dat("0xFF_&", "(LIT)", 0x3F01, "!", "EXIT");
    }
    if (isDefined("instrset_uFork_SM2.1")) {
      def("DEBUG_TX?"); // ( -- bool )
      dat("(LIT)", 0x00, "io@", "CLEAN_BOOL", "EXIT");

      def("DEBUG_TX!"); // ( char -- )
      dat("0xFF_&", "(LIT)", 0x01, "io!", "EXIT");

      def("DEBUG_RX?"); // ( -- bool )
      dat("(LIT)", 0x02, "io@", "CLEAN_BOOL", "EXIT");

      def("DEBUG_RX@"); // ( -- char )
      dat("(LIT)", 0x03, "io@", "0xFF_&", "EXIT");
    }
  }

  if (isDefined("platform_fomu")) {
    if (isDefined("instrset_uFork_SM2")) {
      // addresses 0x3F04-5 is the Lattice ICE 40 UltraPlus 5K system bus
      // 0x3F04 is the system bus address, only lower byte (mask 0x00FF) used
      // 0x3F05 is the system bus data,    only lower byte (mask 0x00FF) used
      //   only reads from and writes to 0x3F03 cause activity from uFork_CSM core
      //   to lattice system bus
      def("fomu_sysbus@"); // ( sysbus_addrbyte -- sysbus_databyte )
      dat("0xFF_&", "(LIT)", 0x3F04, "!", "(LIT)", 0x3F05, "@", "0xFF_&", "EXIT");

      def("fomu_sysbus!"); // ( sysbus_databyte sysbus_addrbyte -- )
      dat("0xFF_&", "SWAP", "0xFF_&", "SWAP");
      dat("(LIT)", 0x3F04, "!", "(LIT)", 0x3F05, "!", "EXIT");
    } else if (isDefined("instrset_uFork_SM2.1")) {
      def("fomu_sysbus@"); // ( sysbus_addrbyte -- sysbus_databyte )
      dat("0xFF_&", "(LIT)", 0x010, "io!", "(LIT)", 0x0011, "io@", "0xFF_&", "EXIT");

      def("fomu_sysbus!"); // ( sysbus_databyte sysbus_addrbyte -- )
      dat("0xFF_&", "SWAP", "0xFF_&", "SWAP");
      dat("(LIT)", 0x0010, "io!", "(LIT)", 0x0011, "io!", "0xFF_&", "EXIT");
    }
    if (isDefined("instrset_uFork_SM2") || isDefined("instrset_uFork_SM2.1")) {
      def("spi1_start"); // ( SlaveSelectMask -- )
      // asuming that the spi flash eeprom is connected to spi 1 hard block
      dat("(LIT)", 0xFF, "(LIT)", 0x19, "fomu_sysbus!"); // SPIRC0 = 0b11_111_111
                                                         //   most waits
      dat("(LIT)", 0x80, "(LIT)", 0x1A, "fomu_sysbus!"); // SPIRC1 = 0b1_0000000
                                                         // spi enabled
      dat("(LIT)", 0x86, "(LIT)", 0x1B, "fomu_sysbus!"); // SPIRC2
                                                         // fpga is master
                                                         // spi mode is 3
                                                         // most significant bit first
      dat("(LIT)", 0x3D, "(LIT)", 0x1C, "fomu_sysbus!"); // SPIBR = nearly slowest
                                                         // 12 MHz / 60 = 200 KHz
      dat("0xF_&", "(LIT)", 0x1F, "fomu_sysbus!");       // SPICSR
      dat("EXIT");

      def("spi1_wait_if_busy"); // ( -- )
      dat("(LIT)", 0x1C, "fomu_sysbus@"); // ( status_byte )
      dat("(LIT)", 0xC0, "&");            // ( dirty_busy_flag )
      dat("(BRNZ)", "spi1_wait_if_busy");
      dat("EXIT");

      def("spi1_wait_if_writebyte_not_ready"); // ( -- )
      dat("(LIT)", 0x1C, "fomu_sysbus@");     // ( status_byte )
      dat("(LIT)", 0x10, "&");
      dat("(BRNZ)", "spi1_wait_if_writebyte_not_ready");
      dat("EXIT");

      def("spi1_wait_if_readbyte_not_ready"); // ( -- )
      dat("(LIT)", 0x1C, "fomu_sysbus@");     // ( status_byte )
      dat("(LIT)", 0x08, "&");
      dat("(BRNZ)", "spi1_wait_if_readbyte_not_ready");
      dat("EXIT");
      
      def("spi1_readbyte"); // ( -- byte ) blocking read of incomming byte
      dat("spi1_wait_if_busy");
      dat("spi1_wait_if_readbyte_not_ready");
      dat("(LIT)", 0x1E, "fomu_sysbus@");
      dat("EXIT");
      
      def("spi1_writebyte"); // ( byte -- )
      dat("spi1_wait_if_busy");
      dat("spi1_wait_if_writebyte_not_ready");
      dat("(LIT)", 0x1D, "fomu_sysbus!");
      dat("EXIT");
      
      def("spi1_end");
      dat("0x0000", "(LIT)", 0x1F, "fomu_sysbus!"); // deselect slave
      dat("0x0000", "(LIT)", 0x1A, "fomu_sysbus!"); // disable spi
      dat("EXIT");
    }
    if (isDefined("instrset_uFork_SM2")) {
      def("spi_flash_fastread"); // ( flash_upper_addr flash_lower_addr ucode_addr cells )
      dat(">R", ">R");           // ( flash_upper_addr flash_lower_addr ) R:( cells ucode_addr )
      dat("SWAP", "0xFF_&");     // ( flash_lower_addr flash_upper_addr ) R:( cells ucode_addr )
      dat("1", "spi1_start");    // assume that spi flash is at slave 0
      dat("(LIT)", 0xAB, "spi1_writebyte"); // wake the spi flash out of low power mode
      dat("spi1_end");
      dat("1", "spi1_start");
      dat("(LIT)", 0x0B, "spi1_writebyte"); // JEDEC std fast read
      dat("spi1_writebyte");     // first byte of flash address ( flash_lower_addr ) R:( cells ucode_addr  )
      dat("DUP", "8LBR", "spi1_writebyte"); // second byte of flash address ( flash_lower_addr ) R:( cells ucode_addr )
      dat("spi1_writebyte");     // third byte of flash address ( ) R:( cells ucode_addr )
      dat("spi1_readbyte", "DROP"); // read dummy byte ( ) R:( cells ucode_addr )
      dat("R>");                 // ( ucode_addr ) R:( cells )
      dat("(JMP)", "spi_flash_fastread_l1");
      def("spi_flash_fastread_l0");
      dat("spi1_readbyte", "8LBR", "spi1_readbyte", "OR", "OVER", "!");
      dat("1+");
      def("spi_flash_fastread_l1");
      dat("(NEXT)", "spi_flash_fastread_l0");
      dat("DROP");
      dat("spi1_end");
      dat("1", "spi1_start");
      dat("(LIT)", 0xB9, "spi1_writebyte"); // tell flash to into deep power down
      dat("spi1_end");
      dat("EXIT");
    }
    if (isDefined("instrset_uFork_SM2.1")) {
      def("spi1_readcell"); // ( -- cell )
      dat("spi1_readbyte", "8LBR", "spi1_readbyte", "OR", "EXIT");

      def("spi_flash_wakeup");   // ( -- )
      dat("1", "spi1_start");    // assume that spi flash is at slave 0
      dat("(LIT)", 0xAB, "spi1_writebyte"); // wake the spi flash out of low power mode
      dat("spi1_end", "EXIT");

      def("spi_flash_deepsleep"); // ( -- )
      dat("1", "spi1_start");
      dat("(LIT)", 0xB9, "spi1_writebyte"); // tell flash to into deep power down
      dat("spi1_end");
      dat("EXIT");

      /*
      I am looking at https://github.com/im-tomu/foboot/blob/master/doc/FLASHLAYOUT.md and I am guessing that the uFork fpga bitstream starts at 0x01a000 in the spi flash
      bitstream for the ice40up5k is 104250 bytes, so assume uFork rom+ram image start at 0x01a000 + 0x01973A ?
      0x03373A if my addition is right
      */
      def("spi_flash_fastread_into_quads"); // ( flash_hi_addr flash_lo_addr start_quaddr nrOfQuads -- )
      dat(">R", ">R");                      // ( flash_hi_addr flash_lo_addr ) R:( nrOfQuads start_quaddr )
      dat("SWAP", "0xFF_&");                // ( flash_lo_addr flash_hi_dr ) R:( nrOfQuads start_quaddr )
      dat("spi_flash_wakeup");
      dat("(LIT)", 0x0B, "spi1_writebyte"); // JEDEC std fast read
      dat("spi1_writebyte");     // first byte of flash address ( flash_lo_addr ) R:( nrOfQuads start_quaddr  )
      dat("DUP", "8LBR", "spi1_writebyte"); // second byte of flash address ( flash_lo_addr ) R:( nrOfQuads start_quaddr )
      dat("spi1_writebyte");     // third byte of flash address ( ) R:( nrOfQuads start_quaddr )
      dat("spi1_readbyte", "DROP"); // read dummy byte ( ) R:( nrOfQuads start_quaddr )
      dat("R>");                 // ( start_quaddr ) R:( nrOfQuads )
      dat("(JMP)", "spi_flash_fastread_into_quads_l1");
      def("spi_flash_fastread_into_quads_l0"); // ( quaddr ) R:( nrofQuads )
      dat("spi1_readcell", "OVER", "qt!");
      dat("spi1_readcell", "OVER", "qx!");
      dat("spi1_readcell", "OVER", "qy!");
      dat("spi1_readcell", "OVER", "qz!");
      dat("1+");
      def("spi_flash_fastread_into_quads_l1");
      dat("(NEXT)", "spi_flash_fastread_into_quads_l0");
      dat("DROP", "spi1_end");
      dat("spi_flash_deepsleep");
      dat("EXIT");
    }
  }
  
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
  dat("(.chr)", 0x0D, "(.chr)", 0x0A, "EXIT");

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
  const linebuffer_start = (opts.linebuffer_start == undefined) ? 0x0300 : opts.linebuffer_start ;
  const linebuffer_max   = (opts.linebuffer_max   == undefined) ? 0x0350 : opts.linebuffer_max ;
  const mode_var_addr    = (opts.mode_var_addr    == undefined) ? 0x0351 : opts.mode_var_addr ;
  const xam_var_addr     = (opts.xam_var_addr     == undefined) ? 0x0352 : opts.xam_var_addr ;
  const st_var_addr      = (opts.st_var_addr      == undefined) ? 0x0353 : opts.st_var_addr ;
  const tmp_var_addr     = (opts.tmp_var_addr     == undefined) ? 0x0354 : opts.tmp_var_addr ;
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
  let asm = makeAssembler(opts.assemblerOpts);
  asm = defineInstructionset(asm);
  asm.org(0x0010);
  asm = minicore(asm); // always required as lot of subsequent assemblies relie on definitions there in
  if (opts.wozmon != undefined) {
    asm = wozmon(asm, opts.wozmon);
  }
  if (opts.uFork != undefined) {
    asm.symbols.define("uFork_gc_algo1", 1);
    asm = uFork(asm, opts.uFork);
  }

  asm.org(0x0000); // default start address
  if (opts.wozmon != undefined) {
    const startInWozmon = opts.wozmon.startInWozmon;
    if ((startInWozmon != undefined) || (startInWozmon != false)) {
      asm.dat("wozmon", "(JMP)", 0x0000); // start in wozmon, and stay in it if it was quitted
    }
  }
  if (opts.uFork != undefined) {
    const startIn_uFork_runLoop = opts.uFork.startInRunLoop;
    if ((startIn_uFork_runLoop != undefined) || (startIn_uFork_runLoop != false)) {
      asm.dat("uFork_runLoop", "(JMP)", 0x0000);
    }
  }
  asm.done();
  return asm.whenDone();
};

export default {
  makeUcodeImage,
};
