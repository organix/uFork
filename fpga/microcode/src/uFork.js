// @ts-check js
/**
 * @use JSDoc
 * @overview Implements the uFork instructionset in microcode
 * @author Zarutian
 */
// using uFork/docs/vm.md as reference

export const uFork_instrHandling = (asm, opts) => {
  opts = (opts == undefined) ? {} : opts ;
  const eventQueueAndContQueue_qaddr = (opts.eventQueueAndContQueue_qaddr == undefined ) ? 0x4001 ;
  
  def("uFork_doOneSnú"); // ( -- ) 
  dat("uFork_dispatchOneEvent");
  dat("uFork_doOneInstrOfContinuation");
  dat("EXIT");

  def("uFork_eventQueueAndContQueue");
  dat("(CONST)", eventQueueAndContQueue_qaddr);

  def("uFork_#?");
  dat("(CONST)", 0x0000);

  def("uFork_enqueueCont"); // ( kont -- )
  dat("uFork_eventQueueAndContQueue", "qz@"); // ( kont k_tail )
  dat("2DUP", "qz!", "DROP");
  dat("uFork_eventQueueAndContQueue", "qz!"); // ( )
  dat("EXIT");
  
  def("uFork_doOneInstrOfContinuation"); // ( -- )
  dat("uFork_eventQueueAndContQueue", "qy@"); // ( k_head )
  dat("DUP", "qz@");    // ( k_head k_next )
  dat("uFork_eventQueueAndContQueue", "qy!"); // ( k_head )
  dat("DUP", "uFork_fetchAndExec");
  dat("DUP", "uFork_enqueueCont"); // ( k_head )
  dat("EXIT");

  def("uFork_fetchAndExec"); // ( kont -- )
  dat("DUP", "qt@");         // ( kont ip )
  dat("DUP", "qx@");         // ( kont ip opcode )
  // dat("(JMP)", "uFork_doInstr"); fallthrough
  def("uFork_doInstr"); // ( opcode -- )
  dat("(JMPTBL)");
  dat(31); // number of base instructions
  dat("uFork_instr_nop");
  dat("uFork_instr_push");
  dat("uFork_instr_dup");
  dat("uFork_instr_drop");
  dat("uFork_instr_pick");
  dat("uFork_instr_roll");
  dat("uFork_instr_alu");
  dat("uFork_instr_typeq");
  dat("uFork_instr_eq");
  dat("uFork_instr_cmp");
  dat("uFork_instr_if");
  dat("uFork_instr_jump");
  dat("uFork_instr_pair");
  dat("uFork_instr_part");
  dat("uFork_instr_nth");
  dat("uFork_instr_dict");
  dat("uFork_instr_deque");
  dat("uFork_instr_quad");
  dat("uFork_instr_msg");
  dat("uFork_instr_state");
  dat("uFork_instr_my");
  dat("uFork_instr_send");
  dat("uFork_instr_signal");
  dat("uFork_instr_new");
  dat("uFork_instr_beh");
  dat("uFork_instr_end");
  dat("uFork_instr_sponsor");
  dat("uFork_instr_assert");
  dat("uFork_instr_debug");
  dat("uFork_instr__subroutine_call");
  dat("uFork_instr__subroutine_exit");
  // todo: cause a error signal
  dat("EXIT");

  def("uFork_instr_nop"); // ( kont ip opcode -- )
  dat("DROP");            // ( kont ip )
  def("uFork_instr__common_tail");
  dat("qz@", "SWAP", "qt!");
  dat("EXIT");
  
  return asm;
};

export default {
  uFork_instrHandling
};
