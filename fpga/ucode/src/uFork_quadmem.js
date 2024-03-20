// @ts-check js
/**
 * @use JSDoc
 * @overview Here is implemented the software fallbacks for both quad memory and its garbage collection.
 * @author Zarutian
 **/

export const uFork_quadmem_and_gc = (asm) => {
  const { def, dat, isDefined } = asm;

  const hwImplOfQuadMemory =           isDefined("instrset_w/qmem");
  const hwImplOfQuadMemoryGC =         isDefined("instrset_w/hwgc");
  const hwImplOfQuadAllotAndFree =     hwImplOfQuadMemoryGC;

  if (!hwImplOfQuadMemory || !hwImplOfQuadMemoryGC) {
    def("uFork_quaddrInRam"); // ( quad_addr -- quad_addr bool )
    dat("DUP", "uFork_isRamQuad?", "EXIT");
  }
  if (!hwImplOfQuadMemory) {
    if (asm.isDefined("instrset_uFork_SM2") && asm.isDefined("platform_fomu")) {
      def("qram_base");
      dat("(CONST)", 0x4000);

      def("qrom_base");
      dat("(CONST)", 0x8000);

      def("qrom"); // ( quad_addr -- addr )
      dat("4*", "qrom_base", "+", "EXIT");

      def("qramt", "qram");
      def("qramx"); dat("qram", "1+", "EXIT");
      def("qramy"); dat("qram", "2+", "EXIT");
      def("qramz"); dat("qram", "3+", "EXIT");

      def("qram"); // ( quad_addr -- addr )
      dat("DUP", "0x6000_&", "SWAP", "4*", "OR", "qram_base", "+", "EXIT");

      def("qrom"); // ( quad_addr -- addr )
      dat("4*", "qrom_base", "+", "EXIT");

      def("qramt", "qram");
      def("qramx"); dat("qram", "1+", "EXIT");
      def("qramy"); dat("qram", "2+", "EXIT");
      def("qramz"); dat("qram", "3+", "EXIT");
      
      def("qramt@"); // ( qaddr -- item )
      dat("qramt", "@", "EXIT");
      
      def("qramx@"); dat("qramx", "@", "EXIT");
      def("qramy@"); dat("qramy", "@", "EXIT");
      def("qramz@"); dat("qramz", "@", "EXIT");
      def("qramt!"); dat("qramt", "!", "EXIT");
      def("qramx!"); dat("qramx", "!", "EXIT");
      def("qramy!"); dat("qramy", "!", "EXIT");
      def("qramz!"); dat("qramz", "!", "EXIT");
      def("qromt@"); dat("qrom", "@", "EXIT");
      def("qromx@"); dat("qrom", "1+", "@", "EXIT");
      def("qromy@"); dat("qrom", "2+", "@", "EXIT");
      def("qromz@"); dat("qrom", "3+", "@", "EXIT");
    } else {
      if (!(asm.isDefined("spram@")) && !(asm.isDefined("spram!"))) {
        const quadMemSize_in_cells = quadMemSize_in_quads * 4;
        def("uFork_quadMem_baseAddr");
        dat("(CONST)", hereBeyondEnd);
        hereBeyondEnd = asm.incr(hereBeyondEnd, quadMemSize_in_cells);
      }

      def("uFork_quaddr2addr"); // ( quad_addr -- cell_addr )
      if (!(asm.isDefined("spram@")) && !(asm.isDefined("spram!"))) {
        dat("4*", "uFork_quadMem_baseAddr", "+", "EXIT");
        
        def("spram@", "@");
        def("spram!", "!");
      } else {
        dat("4*", "EXIT");
      }

      def("qramt"); dat("uFork_quaddr2addr", "EXIT");
      def("qramx"); dat("uFork_quaddr2addr", "1+", "EXIT");
      def("qramy"); dat("uFork_quaddr2addr", "2+", "EXIT");
      def("qramz"); dat("uFork_quaddr2addr", "3+", "EXIT");

      def("qramt@"); dat("qramt", "spram@", "EXIT");
      def("qramx@"); dat("qramx", "spram@", "EXIT");
      def("qramy@"); dat("qramy", "spram@", "EXIT");
      def("qramz@"); dat("qramz", "spram@", "EXIT");

      def("qramt!"); dat("qramt", "spram!", "EXIT");
      def("qramx!"); dat("qramx", "spram!", "EXIT");
      def("qramy!"); dat("qramy", "spram!", "EXIT");
      def("qramz!"); dat("qramz", "spram!", "EXIT");

      if (asm.isDefined("spi_flash@")) {
      } else {
        def("qromt@", "qramt@");
        def("qromx@", "qramx@");
        def("qromy@", "qramy@");
        def("qromz@", "qramz@");
      }
    } 

    asm.symbols.redefine("qt@"); // ( quad_addr -- t_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromt@", "(JMP)", "qramt@");
    asm.symbols.redefine("qx@"); // ( quad_addr -- x_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromx@", "(JMP)", "qramx@");
    asm.symbols.redefine("qy@"); // ( quad_addr -- y_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromy@", "(JMP)", "qramy@");
    asm.symbols.redefine("qz@"); // ( quad_addr -- z_field )
    dat("uFork_quaddrInRam", "(BRZ)", "qromz@", "(JMP)", "qramz@");

    // attempted writes to ROM are just silently discarded here
    asm.symbols.redefine("qt!"); // ( t_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramt!");
    asm.symbols.redefine("qx!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramx!");
    asm.symbols.redefine("qy!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramy!");
    asm.symbols.redefine("qz!"); // ( x_field quad_addr -- )
    dat("uFork_quaddrInRam", "(BRZ)", "2DROP", "(JMP)", "qramz!");
  }
  return asm;
};
