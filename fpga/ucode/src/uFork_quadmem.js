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
  
  return asm;
};
