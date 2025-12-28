//  USB 2.0 full speed receiver physical layer.
//  Written in verilog 2001

// PHY_RX module shall manage physical layer signaling of USB 2.0
//   full speed receiver (USB2.0 Chap. 7):
//   - Start-Of-Packet (SOP) and Sync Pattern detection.
//   - NRZI Data decoding.
//   - Bit Stuffing removal.
//   - End-Of-Packet (EOP) detection.
//   - Bus Reset detection.
// PHY_RX module shall convert bitstream from the USB bus physical receivers 
//   to 8-bit parallel data for the SIE module.
// PHY_RX module shall manage the 1.5kOhm pull-up resistor on dp line.

module phy_rx
  #(parameter BIT_SAMPLES = 'd4)
   (
    // ---- to/from SIE module ------------------------------------
    output [7:0] rx_data_o,
    // While rx_valid_o is high, the rx_data_o shall be valid and both
    //   rx_valid_o and rx_data_o shall not change until consumed.
    output       rx_valid_o,
    // When both rx_valid_o and rx_ready_o are high, rx_data_o shall be consumed by SIE module.
    // When clk_gate_i is high, rx_valid_o shall be updated.
    output       rx_err_o,
    // When both rx_err_o and rx_ready_o are high, PHY_RX module shall abort the
    //   current packet reception and SIE module shall manage the error condition.
    // When clk_gate_i is high, rx_err_o shall be updated.
    output       bus_reset_o,
    // When dp_rx_i/dn_rx_i change and stay in SE0 condition for 2.5us, bus_reset_o shall be high.
    // When dp_rx_i/dn_rx_i change from SE0 condition, bus_reset_o shall return low.
    // While usb_detach_i is high and a usb detach has started, bus_reset_o shall be high.
    // When clk_gate_i is high, bus_reset_o shall be updated.
    output       rx_ready_o,
    // rx_ready_o shall be high only for one clk_gate_i multi-cycle period.
    // While rx_valid_o and rx_err_o are both low, rx_ready_o shall be high to signal the
    //   end of packet (EOP).
    // When clk_gate_i is high, rx_ready_o shall be updated.
    input        clk_i,
    // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES.
    input        rstn_i,
    // While rstn_i is low (active low), the module shall be reset.
    input        clk_gate_i,
    // clk_gate_i shall be high for only one clk_i period within every BIT_SAMPLES clk_i periods.
    // When clk_gate_i is high, the registers that are gated by it shall be updated.
    input        rx_en_i,
    // While rx_en_i is low, the module shall be disabled.
    // When rx_en_i changes from low to high, the module shall start monitoring the dp/dn
    //   lines for the beginning of a new packet.
    // When clk_gate_i is high, rx_en_i shall be updated.
    input        usb_detach_i,
    // When usb_detach_i is high, a USB detach process shall be initiated.
    // When usb_detach_i changes from high to low, the attaching timing process shall begin.
    // When clk_gate_i is high, usb_detach_i shall be updated.

    // ---- to/from USB bus ------------------------------------------
    output       dp_pu_o,
    // While dp_pu_o is high, a 1.5KOhm resistor shall pull-up the dp line.
    // At power-on or when usb_detach_i is high, dp_pu_o shall be low.
    // After TSIGATT time from power-on or from usb_detach_i change to low, dp_pu_o shall be high.
    input        dp_rx_i,
    input        dn_rx_i
    );

   function integer ceil_log2;
      input [31:0] arg;
      integer      i;
      begin
         ceil_log2 = 0;
         for (i = 0; i < 32; i = i + 1) begin
            if (arg > (1 << i))
              ceil_log2 = ceil_log2 + 1;
         end
      end
   endfunction

   reg [2:0] dp_q, dn_q;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         dp_q <= 3'b000;
         dn_q <= 3'b000;
      end else begin
         dp_q <= {dp_rx_i, dp_q[2:1]};
         dn_q <= {dn_rx_i, dn_q[2:1]};
      end
   end

   localparam [1:0] SE0 = 2'd0,
                    DJ = 2'd1,
                    DK = 2'd2,
                    SE1 = 2'd3;
   reg [1:0]        nrzi;

   always @(/*AS*/dn_q or dp_q) begin
      if (dp_q[0] == 1'b1 && dn_q[0] == 1'b0)
        nrzi = DJ;
      else if (dp_q[0] == 1'b0 && dn_q[0] == 1'b1)
        nrzi = DK;
      else if (dp_q[0] == 1'b0 && dn_q[0] == 1'b0)
        nrzi = SE0;
      else // dp or dn at 1'bX too
        nrzi = SE1;
   end

   reg [ceil_log2(BIT_SAMPLES)-1:0] sample_cnt_q;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         sample_cnt_q <= 'd0;
      end else begin
         if (dp_q[1] == dp_q[0] && dn_q[1] == dn_q[0]) begin
            if ({1'b0, sample_cnt_q} == BIT_SAMPLES-1)
              sample_cnt_q <= 'd0;
            else
              sample_cnt_q <= sample_cnt_q + 1;
         end else begin // dp or dn at 1'bX too
            sample_cnt_q <= 'd0;
         end
      end
   end

   localparam       VALID_SAMPLES = BIT_SAMPLES/2; // consecutive valid samples

   reg [3:0]        nrzi_q;
   reg              se0_q;

   wire             sample_clk;

   assign sample_clk = ({1'b0, sample_cnt_q} == (VALID_SAMPLES-1)) ? 1'b1 : 1'b0;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         nrzi_q <= {SE0, SE0};
         se0_q <= 1'b0;
      end else begin
         if (sample_clk) begin
            nrzi_q <= {nrzi, nrzi_q[3:2]};
         end
         if (clk_gate_i) begin
            if (nrzi_q[1:0] == SE0 && nrzi_q[3:2] == SE0)
              se0_q <= 1'b1;
            else
              se0_q <= 1'b0;
         end
      end
   end

   localparam CNT_WIDTH = ceil_log2((2**14+1)*12);
   localparam [2:0] ST_RESET = 3'd0,
                    ST_DETACHED = 3'd1,
                    ST_ATTACHED = 3'd2,
                    ST_ENABLED = 3'd3,
                    ST_DETACH = 3'd4;

   reg [CNT_WIDTH-1:0] cnt_q, cnt_d;
   reg [2:0]           state_q, state_d;
   reg                 dp_pu_q, dp_pu_d;
   reg                 bus_reset_q, bus_reset_d;
   reg                 rx_en_q;

   assign dp_pu_o = dp_pu_q;
   assign bus_reset_o = bus_reset_q;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         cnt_q <= 'd0;
         state_q <= ST_RESET;
         dp_pu_q <= 1'b0;
         bus_reset_q <= 1'b0;
         rx_en_q <= 1'b0;
      end else begin
         if (clk_gate_i) begin
            cnt_q <= cnt_d;
            state_q <= state_d;
            dp_pu_q <= dp_pu_d;
            bus_reset_q <= bus_reset_d;
         end
         if (sample_clk) begin
            if (rx_en_i == 1'b1 && state_q == ST_ENABLED)
              rx_en_q <= 1'b1;
            else
              rx_en_q <= 1'b0;
         end
      end
   end
   
   always @(/*AS*/bus_reset_q or cnt_q or se0_q or state_q
            or usb_detach_i) begin
      cnt_d = 'd0;
      state_d = state_q;
      dp_pu_d = 1'b0;
      bus_reset_d = 1'b0;
      if (usb_detach_i == 1'b1 && state_q != ST_DETACH) begin
         state_d = ST_DETACH;
      end else begin
         case (state_q)
           ST_RESET : begin
              state_d = ST_DETACHED;
           end
           ST_DETACHED : begin
              cnt_d = cnt_q + 1;
              if (cnt_q[CNT_WIDTH-1 -:2] == 2'b11) // TSIGATT=16ms < 100ms (USB2.0 Tab.7-14 pag.188)
                state_d = ST_ATTACHED;
           end
           ST_ATTACHED : begin
              cnt_d = cnt_q + 1;
              dp_pu_d = 1'b1;
              if (cnt_q[CNT_WIDTH-1-8 -:2] == 2'b11) // 16ms + 64us
                state_d = ST_ENABLED;
           end
           ST_ENABLED : begin
              dp_pu_d = 1'b1;
              bus_reset_d = bus_reset_q & se0_q;
              if (se0_q) begin
                 cnt_d = cnt_q + 1;
                 if (cnt_q[5] == 1'b1) // 2.5us < TDETRST=2.67us < 10ms (USB2.0 Tab.7-14 pag.188)
                   bus_reset_d = 1'b1;
              end
           end
           ST_DETACH : begin
              bus_reset_d = 1'b1;
              if (~usb_detach_i)
                state_d = ST_DETACHED;
           end
           default : begin
              state_d = ST_RESET;
           end
         endcase
      end
   end

   localparam [2:0] ST_RX_IDLE = 3'd0,
                    ST_RX_SYNC = 3'd1,
                    ST_RX_DATA = 3'd2,
                    ST_RX_EOP = 3'd3,
                    ST_RX_ERR = 3'd4;

   reg [2:0]        rx_state_q, rx_state_d;
   reg [8:0]        shift_register_q, shift_register_d;
   reg [7:0]        rx_data_q, rx_data_d;
   reg [2:0]        stuffing_cnt_q, stuffing_cnt_d;

   assign rx_data_o = rx_data_q;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         rx_state_q <= ST_RX_IDLE;
         shift_register_q <= 9'b100000000;
         rx_data_q <= 8'd0;
         stuffing_cnt_q <= 3'd0;
      end else begin
         if (sample_clk) begin
            rx_state_q <= rx_state_d;
            shift_register_q <= shift_register_d;
            rx_data_q <= rx_data_d;
            stuffing_cnt_q <= stuffing_cnt_d;
         end
      end
   end

   reg rx_valid;
   reg rx_err;
   reg rx_eop;

   always @(/*AS*/nrzi_q or rx_data_q or rx_en_q or rx_state_q
            or shift_register_q or stuffing_cnt_q) begin
      rx_state_d = rx_state_q;
      shift_register_d = 9'b100000000;
      rx_data_d = rx_data_q;
      stuffing_cnt_d = 3'd0;
      rx_valid = 1'b0;
      rx_err = 1'b0;
      rx_eop = 1'b0;

      if (~rx_en_q) begin
         rx_state_d = ST_RX_IDLE;
      end else begin
         case (rx_state_q)
           ST_RX_IDLE : begin
              if (nrzi_q[1:0] == DJ && nrzi_q[3:2] == DK) begin
                 rx_state_d = ST_RX_SYNC;
              end
           end
           ST_RX_SYNC : begin
              if ((nrzi_q[3:2] == SE1) || (nrzi_q[3:2] == SE0)) begin
                 rx_state_d = ST_RX_IDLE;
              end else begin
                 if (nrzi_q[1:0] == nrzi_q[3:2]) begin
                    if (shift_register_q[8:3] == 6'b000000 && nrzi_q[3:2] == DK) begin
                       rx_state_d = ST_RX_DATA;
                       stuffing_cnt_d = stuffing_cnt_q + 1;
                    end else begin
                       rx_state_d = ST_RX_IDLE;
                    end
                 end else begin
                    shift_register_d = {1'b0, shift_register_q[8:1]};
                 end
              end
           end
           ST_RX_DATA : begin
              if (nrzi_q[3:2] == SE1) begin
                 rx_state_d = ST_RX_ERR;
              end else if (nrzi_q[3:2] == SE0) begin
                 // 1 or 2 SE0s for EOP: USB2.0 Tab.7-2 pag.145
                 // dribble bit: USB2.0 Fig.7-33 pag.158
                 if (shift_register_q == 9'b110000000) begin
                    rx_state_d = ST_RX_EOP;
                 end else if (shift_register_q[0] == 1'b1 && stuffing_cnt_q != 3'd6) begin
                    shift_register_d = 9'b110000000;
                    rx_data_d = shift_register_q[8:1];
                    rx_valid = 1'b1;
                 end else begin
                    rx_state_d = ST_RX_ERR;
                 end
              end else if (nrzi_q[1:0] == SE0) begin
                 rx_state_d = ST_RX_ERR;
              end else if (stuffing_cnt_q == 3'd6) begin
                 if (nrzi_q[1:0] == nrzi_q[3:2]) begin
                    rx_state_d = ST_RX_ERR;
                 end else begin
                    shift_register_d = shift_register_q;
                 end
              end else begin
                 if (nrzi_q[1:0] == nrzi_q[3:2]) begin
                    shift_register_d[8] = 1'b1;
                    stuffing_cnt_d = stuffing_cnt_q + 1;
                 end else begin
                    shift_register_d[8] = 1'b0;
                 end
                 if (shift_register_q[0] == 1'b1) begin
                    shift_register_d[7:0] = 8'b10000000;
                    rx_data_d = shift_register_q[8:1];
                    rx_valid = 1'b1;
                 end else begin
                    shift_register_d[7:0] = shift_register_q[8:1];
                 end
              end
           end
           ST_RX_EOP : begin
              if (nrzi_q[3:2] == DJ) begin
                 rx_state_d = ST_RX_IDLE;
                 rx_eop = 1'b1;
              end else begin
                 rx_state_d = ST_RX_ERR;
              end
           end
           ST_RX_ERR : begin
              rx_state_d = ST_RX_IDLE;
              rx_err = 1'b1;
           end
           default : begin
              rx_state_d = ST_RX_ERR;
           end
         endcase
      end
   end

   reg rx_valid_q, rx_valid_qq;
   reg rx_err_q, rx_err_qq;
   reg rx_eop_q, rx_eop_qq;

   assign rx_ready_o = rx_valid_qq | rx_err_qq | rx_eop_qq;
   assign rx_valid_o = rx_valid_qq;
   assign rx_err_o = rx_err_qq;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         rx_valid_q <= 1'b0;
         rx_err_q <= 1'b0;
         rx_eop_q <= 1'b0;
         rx_valid_qq <= 1'b0;
         rx_err_qq <= 1'b0;
         rx_eop_qq <= 1'b0;
      end else begin
         if (sample_clk) begin
            if (rx_valid)
              rx_valid_q <= 1'b1;
            if (rx_err)
              rx_err_q <= 1'b1;
            if (rx_eop)
              rx_eop_q <= 1'b1;
         end
         if (clk_gate_i) begin
            if ((rx_valid & sample_clk) | rx_valid_q) begin
               rx_valid_qq <= 1'b1;
               rx_valid_q <= 1'b0;
            end else begin
               rx_valid_qq <= 1'b0;
            end
            if ((rx_err & sample_clk) | rx_err_q) begin
               rx_err_qq <= 1'b1;
               rx_err_q <= 1'b0;
            end else begin
               rx_err_qq <= 1'b0;
            end
            if ((rx_eop & sample_clk) | rx_eop_q) begin
               rx_eop_qq <= 1'b1;
               rx_eop_q <= 1'b0;
            end else begin
               rx_eop_qq <= 1'b0;
            end
         end
      end
   end
endmodule
//  USB 2.0 full speed transmitter physical layer.
//  Written in verilog 2001

// PHY_TX module shall manage physical layer signaling of USB 2.0
//   full speed transmitter (USB2.0 Chap. 7):
//   - Start-Of-Packet (SOP) and Sync Pattern generation.
//   - NRZI Data encoding.
//   - Bit Stuffing insertion.
//   - End-Of-Packet (EOP) generation.
// PHY_TX module shall convert 8-bit parallel data from the SIE
//   module to bitstream for the USB bus physical transmitters.

module phy_tx
  (
   // ---- to USB bus physical transmitters ----------------------
   output      tx_en_o,
   output      dp_tx_o,
   output      dn_tx_o,
   // dp_tx_o and dn_tx_o shall have a negligible timing mismatch
   //   (< clk_i period /2).

   // ---- to/from SIE module ------------------------------------
   output      tx_ready_o,
   // tx_ready_o shall be high only for one clk_gate_i multi-cycle period.
   // When both tx_valid_i and tx_ready_o are high, the 8-bit tx_data_i shall be consumed.
   // When clk_gate_i is high, tx_ready_o shall be updated.
   input       clk_i,
   // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES.
   input       rstn_i,
   // While rstn_i is low (active low), the module shall be reset.
   input       clk_gate_i,
   // clk_gate_i shall be high for only one clk_i period within every BIT_SAMPLES clk_i periods.
   // When clk_gate_i is high, the registers that are gated by it shall be updated.
   input       tx_valid_i,
   // When tx_valid_i changes from low to high, PHY_TX shall start a
   //   new packet transmission as soon as possible (USB2.0 7.1.18.1).
   // When the last packet byte is consumed, tx_valid_i shall return low.
   // When clk_gate_i is high, tx_valid_i shall be updated.
   input [7:0] tx_data_i
   // While tx_valid_i is high, the tx_data_i shall be valid and both
   //   tx_valid_i and tx_data_i shall not change until consumed.
   );

   localparam [1:0] ST_IDLE = 2'd0,
                    ST_SYNC = 2'd1,
                    ST_DATA = 2'd2,
                    ST_EOP = 2'd3;

   reg [1:0]        tx_state_q, tx_state_d;
   reg [2:0]        bit_cnt_q, bit_cnt_d;
   reg [7:0]        data_q, data_d;
   reg [2:0]        stuffing_cnt_q, stuffing_cnt_d;
   reg              nrzi_q, nrzi_d;
   reg              tx_ready;

   assign tx_en_o = (tx_state_q == ST_IDLE) ? 1'b0 : 1'b1;
   assign dp_tx_o = (tx_state_q == ST_EOP && data_q[0] == 1'b0) ? 1'b0 : nrzi_q;
   assign dn_tx_o = (tx_state_q == ST_EOP && data_q[0] == 1'b0) ? 1'b0 : ~nrzi_q;
   assign tx_ready_o = tx_ready;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         tx_state_q <= ST_IDLE;
         bit_cnt_q <= 3'd7;
         data_q <= 8'b10000000;
         stuffing_cnt_q <= 3'd0;
         nrzi_q <= 1'b1;
      end else begin
         if (clk_gate_i) begin
            tx_state_q <= tx_state_d;
            bit_cnt_q <= bit_cnt_d;
            data_q <= data_d;
            stuffing_cnt_q <= stuffing_cnt_d;
            nrzi_q <= nrzi_d;
         end
      end
   end

   always @(/*AS*/bit_cnt_q or data_q or nrzi_q or stuffing_cnt_q
            or tx_data_i or tx_state_q or tx_valid_i) begin
      tx_state_d = tx_state_q;
      bit_cnt_d = bit_cnt_q;
      data_d = data_q;
      stuffing_cnt_d = stuffing_cnt_q;
      nrzi_d = nrzi_q;
      tx_ready = 1'b0;

      if (stuffing_cnt_q == 3'd6) begin
         stuffing_cnt_d = 3'd0;
         nrzi_d = ~nrzi_q;
      end else begin
         bit_cnt_d = bit_cnt_q - 1;
         data_d = (data_q >> 1);
         if (data_q[0] == 1'b1) begin
            stuffing_cnt_d = stuffing_cnt_q + 1;
         end else begin
            stuffing_cnt_d = 3'd0;
            nrzi_d = ~nrzi_q;
         end
         case (tx_state_q)
           ST_IDLE : begin
              if (tx_valid_i == 1'b1) begin
                 tx_state_d = ST_SYNC;
              end else begin
                 bit_cnt_d = 3'd7;
                 data_d = 8'b10000000;
                 nrzi_d = 1'b1;
              end
              stuffing_cnt_d = 3'd0;
           end
           ST_SYNC : begin
              if (bit_cnt_q == 3'd0) begin
                 if (tx_valid_i == 1'b1) begin
                    tx_state_d = ST_DATA;
                    bit_cnt_d = 3'd7;
                    data_d = tx_data_i;
                    tx_ready = 1'b1;
                 end else begin
                    tx_state_d = ST_IDLE;
                    bit_cnt_d = 3'd7;
                    data_d = 8'b10000000;
                    stuffing_cnt_d = 3'd0;
                    nrzi_d = 1'b1;
                 end
              end
           end
           ST_DATA : begin
              if (bit_cnt_q == 3'd0) begin
                 if (tx_valid_i == 1'b1) begin
                    bit_cnt_d = 3'd7;
                    data_d = tx_data_i;
                    tx_ready = 1'b1;
                 end else begin
                    tx_state_d = ST_EOP;
                    bit_cnt_d = 3'd3;
                    data_d = 8'b11111001;
                 end
              end
           end
           ST_EOP : begin
              if (bit_cnt_q == 3'd0) begin
                 tx_state_d = ST_IDLE;
                 bit_cnt_d = 3'd7;
                 data_d = 8'b10000000;
              end
              stuffing_cnt_d = 3'd0;
              nrzi_d = 1'b1;
           end
           default : begin
              tx_state_d = ST_IDLE;
              bit_cnt_d = 3'd7;
              data_d = 8'b10000000;
              stuffing_cnt_d = 3'd0;
              nrzi_d = 1'b1;
           end
         endcase
      end
   end
endmodule
//  USB 2.0 full speed Serial Interface Engine.
//  Written in verilog 2001

// SIE module shall manage physical and protocol layers of full
//   speed USB 2.0 (USB2.0 Chapters 7 and 8):
//   - Packet recognition, transaction sequencing.
//   - CRC generation and checking (Token and Data).
//   - Packet ID (PID) generation and checking/decoding.
//   And through PHY_RX and PHY_TX submodules:
//   - Start-Of-Packet (SOP) and Sync Pattern detection/generation.
//   - NRZI Data decoding/encoding.
//   - Bit Stuffing removal/insertion.
//   - End-Of-Packet (EOP) detection/generation.
//   - Bus Reset detection.
//   - Serial-Parallel/Parallel-Serial conversion.
//   - 1.5kOhm pull-up resistor on dp line management.

`define max(a,b) ((a) > (b) ? (a) : (b))

module sie
  #(parameter IN_CTRL_MAXPACKETSIZE = 'd8,
    parameter IN_BULK_MAXPACKETSIZE = 'd8,  // 8, 16, 32, 64
    parameter IN_INT_MAXPACKETSIZE = 'd8,  // <= 64
    parameter IN_ISO_MAXPACKETSIZE = 'd8,  // <= 1023
    parameter BIT_SAMPLES = 'd4)
   (
    // ---- to/from USB_CDC module ------------------------------------
    output [10:0] frame_o,
    // frame_o shall be last recognized frame number and shall be
    //   updated at the end of next valid Start-of-Frame token packet.
    // When clk_gate_i is high, frame_o shall be updated.
    input         clk_i,
    // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES.
    input         rstn_i,
    // While rstn_i is low (active low), the module shall be reset.
    input         clk_gate_i,
    // clk_gate_i shall be high for only one clk_i period within every BIT_SAMPLES clk_i periods.
    // When clk_gate_i is high, the registers that are gated by it shall be updated.

    // ---- to/from IN/OUT Endpoints ------------------------------------
    output        bus_reset_o,
    // When dp_rx_i/dn_rx_i change and stay in SE0 condition for 2.5us, bus_reset_o shall be high.
    // When dp_rx_i/dn_rx_i change from SE0 condition, bus_reset_o shall return low.
    // While usb_detach_i is high and a usb detach has started, bus_reset_o shall be high.
    // When clk_gate_i is high, bus_reset_o shall be updated.
    output [3:0]  endp_o,
    // endp_o shall be last recognized endpoint address and shall be
    //   updated at the end of next valid token packet.
    // When clk_gate_i is high, endp_o shall be updated.
    input         stall_i,
    // While a bulk, interrupt or control pipe is addressed and is in
    //   stall state, stall_i shall be high, otherwise shall be low.
    // When clk_gate_i is high, stall_i shall be updated.

    // ---- to/from OUT Endpoints ------------------------------------
    output [7:0]  out_data_o,
    output        out_valid_o,
    // While out_valid_o is high, the out_data_o shall be valid and both
    //   out_valid_o and out_data_o shall not change until consumed.
    // When clk_gate_i is high, out_valid_o shall be updated.
    output        out_err_o,
    // When both out_err_o and out_ready_o are high, SIE shall abort the
    //   current packet reception and OUT Endpoints shall manage the error
    //   condition.
    // When clk_gate_i is high, out_err_o shall be updated.
    output        setup_o,
    // While last correctly checked PID (USB2.0 8.3.1) is SETUP, setup_o shall
    //   be high, otherwise shall be low.
    // When clk_gate_i is high, setup_o shall be updated.
    output        out_ready_o,
    // When both out_valid_o and out_ready_o are high, the out_data_o shall
    //   be consumed.
    // When setup_o is high and out_ready_o is high, a new SETUP transaction shall be
    //   received.
    // When setup_o, out_valid_o and out_err_o are low and out_ready_o is high, the
    //   on-going OUT packet shall end (EOP).
    // out_ready_o shall be high only for one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, out_ready_o shall be updated.
    input         out_nak_i,
    // When out_nak_i is high at the end of an OUT packet, SIE shall send a NAK
    //   packet.
    // When clk_gate_i is high, out_nak_i shall be updated.

    // ---- to/from IN Endpoints -------------------------------------
    output        in_req_o,
    // When both in_req_o and in_ready_o are high, a new IN packet shall be requested.
    // When clk_gate_i is high, in_req_o shall be updated.
    output        in_ready_o,
    // When both in_ready_o and in_valid_i are high, in_data_i or zero length
    //   packet shall be consumed.
    // When in_data_i or zlp is consumed, in_ready_o shall be high only for
    //   one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, in_ready_o shall be updated.
    output        in_data_ack_o,
    // When in_data_ack_o is high and out_ready_o is high, an ACK packet shall be received.
    // When clk_gate_i is high, in_data_ack_o shall be updated.
    input         in_valid_i,
    // While IN Endpoints have data or zero length packet available, IN Endpoints
    //   shall put in_valid_i high.
    // When clk_gate_i is high, in_valid_i shall be updated.
    input [7:0]   in_data_i,
    // While in_valid_i is high and in_zlp_i is low, in_data_i shall be valid.
    input         in_zlp_i,
    // While IN Endpoints have zero length packet available, IN Endpoints
    //   shall put both in_zlp_i and in_valid_i high.
    // When clk_gate_i is high, in_zlp_i shall be updated.
    input         in_nak_i,
    // When in_nak_i is high at the start of an IN packet, SIE shall send a NAK
    //   packet.
    // When clk_gate_i is high, in_nak_i shall be updated.

    // ---- to/from CONTROL Endpoint ---------------------------------
    input         usb_en_i,
    // While usb_en_i is low, the phy_rx module shall be disabled.
    // When clk_gate_i is high, usb_en_i shall be updated.
    input         usb_detach_i,
    // When usb_detach_i is high, a usb detach shall be requested.
    // When clk_gate_i is high, usb_detach_i shall be updated.
    input [6:0]   addr_i,
    // addr_i shall be the device address.
    // addr_i shall be updated at the end of SET_ADDRESS control transfer.
    // When clk_gate_i is high, addr_i shall be updated.
    input [15:0]  in_bulk_endps_i,
    // While in_bulk_endps_i[i] is high, endp=i shall be enabled as IN bulk endpoint.
    //   endp=0 is reserved for IN control endpoint.
    // When clk_gate_i is high, in_bulk_endps_i shall be updated.
    input [15:0]  out_bulk_endps_i,
    // While out_bulk_endps_i[i] is high, endp=i shall be enabled as OUT bulk endpoint
    //   endp=0 is reserved for OUT control endpoint.
    // When clk_gate_i is high, out_bulk_endps_i shall be updated.
    input [15:0]  in_int_endps_i,
    // While in_int_endps_i[i] is high, endp=i shall be enabled as IN interrupt endpoint.
    //   endp=0 is reserved for IN control endpoint.
    // When clk_gate_i is high, in_int_endps_i shall be updated.
    input [15:0]  out_int_endps_i,
    // While out_int_endps_i[i] is high, endp=i shall be enabled as OUT interrupt endpoint
    //   endp=0 is reserved for OUT control endpoint.
    // When clk_gate_i is high, out_int_endps_i shall be updated.
    input [15:0]  in_iso_endps_i,
    // While in_iso_endps_i[i] is high, endp=i shall be enabled as IN isochronous endpoint.
    //   endp=0 is reserved for IN control endpoint.
    // When clk_gate_i is high, in_iso_endps_i shall be updated.
    input [15:0]  out_iso_endps_i,
    // While out_iso_endps_i[i] is high, endp=i shall be enabled as OUT isochronous endpoint
    //   endp=0 is reserved for OUT control endpoint.
    // When clk_gate_i is high, out_iso_endps_i shall be updated.
    input [15:0]  in_toggle_reset_i,
    // When in_toggle_reset_i[i] is high, data toggle synchronization of
    //   IN bulk/int pipe at endpoint=i shall be reset to DATA0.
    // When clk_gate_i is high, in_toggle_reset_i shall be updated.
    input [15:0]  out_toggle_reset_i,
    // When out_toggle_reset_i[i] is high, data toggle synchronization of
    //   OUT bulk/int pipe at endpoint=i shall be reset to DATA0.
    // When clk_gate_i is high, out_toggle_reset_i shall be updated.

    // ---- to/from USB bus physical transmitters/receivers ----------
    output        dp_pu_o,
    // While dp_pu_o is high, a 1.5KOhm resistor shall pull-up the dp line.
    // At power-on or when usb_detach_i is high, dp_pu_o shall be low.
    // After TSIGATT time from power-on or from usb_detach_i change to low, dp_pu_o shall be high.
    output        tx_en_o,
    output        dp_tx_o,
    output        dn_tx_o,
    input         dp_rx_i,
    input         dn_rx_i
    );

   function integer ceil_log2;
      input [31:0] arg;
      integer      i;
      begin
         ceil_log2 = 0;
         for (i = 0; i < 32; i = i + 1) begin
            if (arg > (1 << i))
              ceil_log2 = ceil_log2 + 1;
         end
      end
   endfunction

   function [4:0] crc5;
      input [10:0] data;
      localparam [4:0] POLY5 = 5'b00101;
      integer          i;
      begin
         crc5 = 5'b11111;
         for (i = 0; i <= 10; i = i + 1) begin
            if ((data[i] ^ crc5[4]) == 1'b1)
              crc5 = {crc5[3:0], 1'b0} ^ POLY5;
            else
              crc5 = {crc5[3:0], 1'b0};
         end
      end
   endfunction

   function [4:0] rev5;
      input [4:0] data;
      integer     i;
      begin
         for (i = 0; i <= 4; i = i + 1) begin
            rev5[i] = data[4-i];
         end
      end
   endfunction

   function [15:0] crc16;
      input [7:0] data;
      input [15:0] crc;
      localparam [15:0] POLY16 = 16'h8005;
      integer           i;
      begin
         crc16 = crc;
         for (i = 0; i <= 7; i = i + 1) begin
            if ((data[i] ^ crc16[15]) == 1'b1)
              crc16 = {crc16[14:0], 1'b0} ^ POLY16;
            else
              crc16 = {crc16[14:0], 1'b0};
         end
      end
   endfunction

   function [7:0] rev8;
      input [7:0] data;
      integer     i;
      begin
         for (i = 0; i <= 7; i = i + 1) begin
            rev8[i] = data[7-i];
         end
      end
   endfunction

   localparam [15:0] RESI16 = 16'h800D; // = rev16(~16'h4FFE)
   localparam [3:0]  ENDP_CTRL = 'd0;
   localparam [3:0]  PHY_IDLE = 4'd0,
                     PHY_RX_PID = 4'd1,
                     PHY_RX_ADDR = 4'd2,
                     PHY_RX_ENDP = 4'd3,
                     PHY_RX_DATA0 = 4'd4,
                     PHY_RX_DATA = 4'd5,
                     PHY_RX_WAIT_EOP = 4'd6,
                     PHY_TX_HANDSHAKE_PID = 4'd7,
                     PHY_TX_DATA_PID = 4'd8,
                     PHY_TX_DATA = 4'd9,
                     PHY_TX_CRC16_0 = 4'd10,
                     PHY_TX_CRC16_1 = 4'd11;
   localparam [3:0]  PID_RESERVED = 4'b0000,
                     PID_OUT = 4'b0001,
                     PID_IN = 4'b1001,
                     PID_SOF = 4'b0101,
                     PID_SETUP = 4'b1101,
                     PID_DATA0 = 4'b0011,
                     PID_DATA1 = 4'b1011,
                     PID_ACK = 4'b0010,
                     PID_NAK = 4'b1010,
                     PID_STALL = 4'b1110;
   localparam        IN_WIDTH = ceil_log2(1+`max(IN_CTRL_MAXPACKETSIZE,
                                                 `max(IN_BULK_MAXPACKETSIZE,
                                                      `max(IN_INT_MAXPACKETSIZE, IN_ISO_MAXPACKETSIZE))));

   reg [3:0]         phy_state_q, phy_state_d;
   reg [3:0]         pid_q, pid_d;
   reg [6:0]         addr_q, addr_d;
   reg [3:0]         endp_q, endp_d;
   reg [10:0]        frame_q, frame_d;
   reg [15:0]        data_q, data_d;
   reg [15:0]        crc16_q, crc16_d;
   reg [15:0]        in_toggle_q, in_toggle_d;
   reg [15:0]        out_toggle_q, out_toggle_d;
   reg [15:0]        in_zlp_q, in_zlp_d;
   reg [IN_WIDTH-1:0] in_byte_q, in_byte_d;
   reg                out_valid;
   reg                out_err;
   reg                out_eop;
   reg                in_data_ack;
   reg [7:0]          tx_data;
   reg                tx_valid;
   reg                in_ready;
   reg                in_req;
   reg [ceil_log2(8)-1:0] delay_cnt_q;
   reg                    out_err_q;
   reg                    out_eop_q;
   reg                    in_req_q;
   reg                    in_data_ack_q;

   wire [7:0]             rx_data;
   wire                   rx_valid;
   wire                   rx_err;
   wire                   bus_reset;
   wire                   rstn;
   wire                   rx_ready;
   wire                   tx_ready;
   wire                   delay_end;
   wire [15:0]            in_toggle_endps;
   wire [15:0]            out_toggle_endps;
   wire [15:0]            in_valid_endps;
   wire [15:0]            out_valid_endps;

   assign bus_reset_o = bus_reset;
   assign endp_o = endp_q;
   assign frame_o = frame_q;
   assign out_data_o = data_q[15:8];
   assign out_valid_o = out_valid;
   assign out_err_o = out_err_q;
   assign in_req_o = in_req_q;
   assign setup_o = (pid_q == PID_SETUP) ? 1'b1 : 1'b0;
   assign in_data_ack_o = in_data_ack_q;
   assign delay_end = (({1'b0, delay_cnt_q} == (8-1)) ? 1'b1 : 1'b0);
   assign out_ready_o = (rx_ready & out_valid) |
                        (delay_end & (out_err_q | out_eop_q));
   assign in_ready_o = (tx_ready & in_ready) | in_data_ack_q | in_req_q;

   assign rstn = rstn_i & ~bus_reset;

   always @(posedge clk_i or negedge rstn) begin
      if (~rstn) begin
         delay_cnt_q <= 'd0;
         out_err_q <= 1'b0;
         out_eop_q <= 1'b0;
         in_req_q <= 1'b0;
         in_data_ack_q <= 1'b0;
      end else begin
         if (clk_gate_i) begin
            in_req_q <= in_req & rx_ready;
            in_data_ack_q <= in_data_ack & (rx_ready | tx_ready);
            if (phy_state_q == PHY_RX_PID || phy_state_q == PHY_RX_ENDP ||
                phy_state_q == PHY_RX_DATA) begin
               delay_cnt_q <= 'd0;
               if (rx_ready) begin
                  if (phy_state_q == PHY_RX_DATA)
                    out_err_q <= out_err | out_err_q;
                  out_eop_q <= out_eop | out_eop_q;
               end
            end else if (!delay_end) begin
               delay_cnt_q <= delay_cnt_q + 1;
            end else begin
               out_err_q <= 1'b0;
               out_eop_q <= 1'b0;
            end
         end
      end
   end

   localparam [15:0] CTRL_ENDPS = 16'h01;

   assign in_toggle_endps = in_bulk_endps_i|in_int_endps_i|CTRL_ENDPS;
   assign out_toggle_endps = out_bulk_endps_i|out_int_endps_i|CTRL_ENDPS;
   assign in_valid_endps = in_bulk_endps_i|in_int_endps_i|in_iso_endps_i|CTRL_ENDPS;
   assign out_valid_endps = out_bulk_endps_i|out_int_endps_i|out_iso_endps_i|CTRL_ENDPS;

   integer i;

   always @(posedge clk_i or negedge rstn) begin
      if (~rstn) begin
         phy_state_q <= PHY_IDLE;
         pid_q <= PID_RESERVED;
         addr_q <= 7'd0;
         endp_q <= ENDP_CTRL;
         frame_q <= 11'd0;
         data_q <= 16'd0;
         crc16_q <= 16'd0;
         in_toggle_q <= 16'd0;
         out_toggle_q <= 16'd0;
         in_zlp_q <= 16'd0;
         in_byte_q <= 'd0;
      end else begin
         if (clk_gate_i) begin
            if (rx_ready | tx_ready) begin
               phy_state_q <= phy_state_d;
               pid_q <= pid_d;
               addr_q <= addr_d;
               endp_q <= endp_d;
               frame_q <= frame_d;
               data_q <= data_d;
               crc16_q <= crc16_d;
               in_toggle_q <= in_toggle_d & in_toggle_endps;
               out_toggle_q <= out_toggle_d & out_toggle_endps;
               in_zlp_q <= in_zlp_d & in_valid_endps;
               in_byte_q <= in_byte_d;
            end
            for (i = 0; i < 16; i = i + 1) begin
               if (in_toggle_reset_i[i] & in_toggle_endps[i] & ~CTRL_ENDPS[i])
                 in_toggle_q[i] <= 1'b0;
               if (out_toggle_reset_i[i] & out_toggle_endps[i] & ~CTRL_ENDPS[i])
                 out_toggle_q[i] <= 1'b0;
            end
         end
      end
   end

   always @(/*AS*/addr_i or addr_q or crc16_q or data_q or endp_q
            or frame_q or in_bulk_endps_i or in_byte_q or in_data_i
            or in_int_endps_i or in_iso_endps_i or in_nak_i
            or in_toggle_endps or in_toggle_q or in_valid_endps
            or in_valid_i or in_zlp_i or in_zlp_q or out_iso_endps_i
            or out_nak_i or out_toggle_endps or out_toggle_q
            or out_valid_endps or phy_state_q or pid_q or rx_data
            or rx_err or rx_valid or stall_i) begin
      phy_state_d = phy_state_q;
      pid_d = pid_q;
      addr_d = addr_q;
      endp_d = endp_q;
      frame_d = frame_q;
      data_d = {8'd0, rx_data};
      crc16_d = crc16_q;
      in_toggle_d = in_toggle_q;
      out_toggle_d = out_toggle_q;
      in_zlp_d = in_zlp_q;
      in_byte_d = 'd0;
      out_valid = 1'b0;
      out_err = 1'b0;
      out_eop = 1'b0;
      in_data_ack = 1'b0;
      tx_data = 8'd0;
      tx_valid = 1'b0;
      in_ready = 1'b0;
      in_req = 1'b0;

      if (rx_err == 1'b1) begin
         phy_state_d = PHY_IDLE;
         out_err = 1'b1;
      end else begin
         case (phy_state_q)
           PHY_RX_WAIT_EOP : begin
              if (rx_valid == 1'b0) begin
                 phy_state_d = PHY_IDLE;
              end
           end
           PHY_IDLE : begin
              if (rx_valid == 1'b1) begin
                 phy_state_d = PHY_RX_PID;
              end
           end
           PHY_RX_PID : begin
              pid_d = PID_RESERVED;
              if (data_q[7:4] == ~data_q[3:0]) begin
                 pid_d = data_q[3:0];
                 case (data_q[1:0])
                   2'b01 : begin // Token
                      if (rx_valid == 1'b1) begin
                         phy_state_d = PHY_RX_ADDR;
                      end else begin
                         phy_state_d = PHY_IDLE;
                      end
                   end
                   2'b11 : begin // Data
                      if (rx_valid == 1'b1) begin
                         if ((data_q[3:2] == PID_DATA0[3:2] || data_q[3:2] == PID_DATA1[3:2]) &&
                             (pid_q == PID_SETUP || pid_q == PID_OUT) &&
                             addr_q == addr_i && out_valid_endps[endp_q] == 1'b1) begin
                            phy_state_d = PHY_RX_DATA0;
                         end else begin
                            phy_state_d = PHY_RX_WAIT_EOP;
                         end
                      end else begin
                         phy_state_d = PHY_IDLE;
                      end
                   end
                   2'b10 : begin // Handshake
                      if (rx_valid == 1'b0) begin
                         phy_state_d = PHY_IDLE;
                         if (data_q[3:2] == PID_ACK[3:2] && addr_q == addr_i &&
                             in_toggle_endps[endp_q] == 1'b1) begin // ACK
                            in_toggle_d[endp_q] = ~in_toggle_q[endp_q];
                            in_data_ack = 1'b1;
                         end
                      end else begin
                         phy_state_d = PHY_RX_WAIT_EOP;
                      end
                   end
                   default : begin // Special -> Not valid
                      if (rx_valid == 1'b0) begin
                         phy_state_d = PHY_IDLE;
                      end else begin
                         phy_state_d = PHY_RX_WAIT_EOP;
                      end
                   end
                 endcase
              end else if (rx_valid == 1'b1) begin
                 phy_state_d = PHY_RX_WAIT_EOP;
              end else begin
                 phy_state_d = PHY_IDLE;
              end
              crc16_d = 16'hFFFF;
           end
           PHY_RX_ADDR : begin
              if (rx_valid == 1'b1) begin
                 phy_state_d = PHY_RX_ENDP;
              end else begin
                 phy_state_d = PHY_IDLE;
              end
              data_d[15:8] = data_q[7:0];
           end
           PHY_RX_ENDP : begin
              addr_d[0] = ~addr_i[0];  // to invalid addr_q in case of token error
              if (rx_valid == 1'b0) begin
                 phy_state_d = PHY_IDLE;
                 if (crc5({data_q[2:0], data_q[15:8]}) == rev5(~data_q[7:3])) begin
                    if (pid_q == PID_SOF) begin
                       frame_d = {data_q[2:0], data_q[15:8]};
                    end else begin
                       addr_d = data_q[14:8];
                       endp_d = {data_q[2:0], data_q[15]};
                       if (data_q[14:8] == addr_i) begin
                          if (pid_q == PID_IN) begin
                             phy_state_d = PHY_TX_DATA_PID;
                             in_req = 1'b1;
                          end else if (pid_q == PID_SETUP) begin
                             in_toggle_d[ENDP_CTRL] = 1'b1;
                             out_toggle_d[ENDP_CTRL] = 1'b0;
                             out_eop = 1'b1; // will be delayed for ctrl_enpd to capture new endp_q
                          end
                       end
                    end
                 end
              end else begin
                 phy_state_d = PHY_RX_WAIT_EOP;
              end
           end
           PHY_RX_DATA0 : begin
              if (rx_valid == 1'b1) begin
                 phy_state_d = PHY_RX_DATA;
              end else begin
                 phy_state_d = PHY_IDLE;
              end
              data_d[15:8] = data_q[7:0];
              crc16_d = crc16(data_q[7:0], crc16_q);
           end
           PHY_RX_DATA : begin
              if (rx_valid == 1'b1) begin
                 out_valid = 1'b1;
              end else begin
                 if (crc16(data_q[7:0], crc16_q) == RESI16) begin
                    if ((out_toggle_q[endp_q] == pid_q[3] && out_toggle_endps[endp_q] == 1'b1) ||
                        out_iso_endps_i[endp_q] == 1'b1) begin
                       out_toggle_d[endp_q] = ~out_toggle_q[endp_q];
                       out_eop = 1'b1;
                    end else begin
                       out_err = 1'b1;
                    end
                    if (out_toggle_endps[endp_q] == 1'b1)
                      phy_state_d = PHY_TX_HANDSHAKE_PID;
                    else
                      phy_state_d = PHY_IDLE;
                    if (stall_i == 1'b1) begin
                       pid_d = PID_STALL;
                    end else if (out_nak_i == 1'b1) begin
                       out_toggle_d[endp_q] = out_toggle_q[endp_q];
                       pid_d = PID_NAK;
                    end else begin
                       pid_d = PID_ACK;
                    end
                 end else begin
                    out_err = 1'b1;
                    phy_state_d = PHY_IDLE;
                 end
              end
              data_d[15:8] = data_q[7:0];
              crc16_d = crc16(data_q[7:0], crc16_q);
           end
           PHY_TX_HANDSHAKE_PID : begin
              tx_data = {~pid_q, pid_q};
              phy_state_d = PHY_IDLE;
              tx_valid = 1'b1;
           end
           PHY_TX_DATA_PID : begin
              tx_valid = 1'b1;
              if (in_valid_endps[endp_q] == 1'b0) begin // USB2.0 8.3.2 pag.197)
                 tx_valid = 1'b0;
                 phy_state_d = PHY_IDLE;
              end else if (stall_i == 1'b1) begin
                 if (in_toggle_endps[endp_q] == 1'b1) begin
                    pid_d = PID_STALL;
                    tx_data = {~PID_STALL, PID_STALL};
                 end else begin
                    tx_valid = 1'b0;
                 end
                 phy_state_d = PHY_IDLE;
              end else if ((in_nak_i == 1'b1) || (in_valid_i == 1'b0 && in_zlp_q[endp_q] == 1'b0)) begin
                 if (in_toggle_endps[endp_q] == 1'b1) begin
                    pid_d = PID_NAK;
                    tx_data = {~PID_NAK, PID_NAK};
                 end else begin
                    tx_valid = 1'b0;
                 end
                 phy_state_d = PHY_IDLE;
              end else begin
                 if (in_toggle_q[endp_q] == 1'b0) begin
                    pid_d = PID_DATA0;
                    tx_data = {~PID_DATA0, PID_DATA0};
                 end else begin
                    pid_d = PID_DATA1;
                    tx_data = {~PID_DATA1, PID_DATA1};
                 end
                 if ((in_valid_i == 1'b0) || (in_zlp_i == 1'b1)) begin
                    phy_state_d = PHY_TX_CRC16_0;
                 end else begin
                    in_ready = 1'b1;
                    phy_state_d = PHY_TX_DATA;
                 end
              end
              data_d[7:0] = in_data_i;
              crc16_d = 16'hFFFF;
              in_zlp_d[endp_q] = 1'b0;
           end
           PHY_TX_DATA : begin
              tx_data = data_q[7:0];
              if ((endp_q == ENDP_CTRL && in_byte_q == IN_CTRL_MAXPACKETSIZE[IN_WIDTH-1:0]-1) ||
                  (in_bulk_endps_i[endp_q] == 1'b1 && in_byte_q == IN_BULK_MAXPACKETSIZE[IN_WIDTH-1:0]-1) ||
                  (in_int_endps_i[endp_q] == 1'b1 && in_byte_q == IN_INT_MAXPACKETSIZE[IN_WIDTH-1:0]-1) ||
                  (in_iso_endps_i[endp_q] == 1'b1 && in_byte_q == IN_ISO_MAXPACKETSIZE[IN_WIDTH-1:0]-1)) begin
                 phy_state_d = PHY_TX_CRC16_0;
                 in_zlp_d[endp_q] = 1'b1;
              end else if (in_valid_i == 1'b0) begin
                 phy_state_d = PHY_TX_CRC16_0;
              end else begin
                 in_ready = 1'b1;
              end
              data_d[7:0] = in_data_i;
              crc16_d = crc16(data_q[7:0], crc16_q);
              tx_valid = 1'b1;
              in_byte_d = in_byte_q + 1;
           end
           PHY_TX_CRC16_0 : begin
              tx_data = rev8(~crc16_q[15:8]);
              phy_state_d = PHY_TX_CRC16_1;
              tx_valid = 1'b1;
           end
           PHY_TX_CRC16_1 : begin
              tx_data = rev8(~crc16_q[7:0]);
              phy_state_d = PHY_IDLE;
              tx_valid = 1'b1;
              if (in_iso_endps_i[endp_q] == 1'b1)
                in_data_ack = 1'b1;
           end
           default : begin
              phy_state_d = PHY_IDLE;
           end
         endcase
      end
   end

   wire tx_en;
   wire rx_en;

   assign tx_en_o = tx_en;
   assign rx_en = ~tx_en & usb_en_i;

   phy_rx #(.BIT_SAMPLES(BIT_SAMPLES))
   u_phy_rx (.rx_data_o(rx_data),
             .rx_valid_o(rx_valid),
             .rx_err_o(rx_err),
             .dp_pu_o(dp_pu_o),
             .bus_reset_o(bus_reset),
             .rx_ready_o(rx_ready),
             .clk_i(clk_i),
             .rstn_i(rstn_i),
             .clk_gate_i(clk_gate_i),
             .rx_en_i(rx_en),
             .usb_detach_i(usb_detach_i),
             .dp_rx_i(dp_rx_i),
             .dn_rx_i(dn_rx_i));

   phy_tx
     u_phy_tx (.tx_en_o(tx_en),
               .dp_tx_o(dp_tx_o),
               .dn_tx_o(dn_tx_o),
               .tx_ready_o(tx_ready),
               .clk_i(clk_i),
               .rstn_i(rstn),
               .clk_gate_i(clk_gate_i),
               .tx_valid_i(tx_valid),
               .tx_data_i(tx_data));
endmodule
//  USB 2.0 full speed IN FIFO.
//  Written in verilog 2001

// IN_FIFO module shall implement an IN FIFO interface.
// New app_in_data_i shall be inserted in the IN FIFO when both
//   app_in_valid_i and app_in_ready_o are high.
// in_data_o shall be sourced from the IN FIFO when both in_req_i
//   and in_data_ack_i are low and both in_ready_i and in_valid_o are high.
// Data that is sourced from the IN FIFO shall be removed when it has been
//   acknowledged by an ACK packet.

module in_fifo
  #(parameter IN_MAXPACKETSIZE = 'd8,
    parameter USE_APP_CLK = 0,
    parameter APP_CLK_FREQ = 12) // app_clk frequency in MHz
   (
    // ---- to/from Application ------------------------------------
    input        app_clk_i,
    input        app_rstn_i,
    // While app_rstn_i is low (active low), the app_clk_i'ed registers shall be reset
    input [7:0]  app_in_data_i,
    input        app_in_valid_i,
    // While app_in_valid_i is high, app_in_data_i shall be valid.
    output       app_in_ready_o,
    // When both app_in_ready_o and app_in_valid_i are high, app_in_data_i shall
    //   be consumed.

    // ---- from top module ---------------------------------------
    input        clk_i,
    // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES
    input        rstn_i,
    // While rstn_i is low (active low), the clk_i'ed registers shall be reset
    input        clk_gate_i,
    // clk_gate_i shall be high for only one clk_i period within every BIT_SAMPLES clk_i periods.
    // When clk_gate_i is high, the registers that are gated by it shall be updated.
    output       in_empty_o,
    // While the IN FIFO is empty and there is no unconfirmed data waiting for ACK packet,
    //   in_empty_o shall be high.
    // When clk_gate_i is high, in_empty_o shall be updated.
    output       in_full_o,
    // While the IN FIFO is full, including the presence of unconfirmed data waiting for ACK packet,
    //   in_full_o shall be high.
    // When clk_gate_i is high, in_full_o shall be updated.

    // ---- to/from SIE module ------------------------------------
    output [7:0] in_data_o,
    // While in_valid_o is high, in_data_o shall be valid.
    output       in_valid_o,
    // While the IN FIFO is not empty, in_valid_o shall be high.
    // When in_valid_o is low, either in_req_i or in_data_ack_i shall be high
    //   at next in_ready_i high.
    // When both in_ready_i and clk_gate_i are high, in_valid_o shall be updated.
    // When clk_gate_i is high, in_valid_o shall be updated.
    input        in_req_i,
    // When both in_req_i and in_ready_i are high, a new IN packet shall be requested.
    // When clk_gate_i is high, in_req_i shall be updated.
    input        in_ready_i,
    // When both in_req_i and in_data_ack_i are low and in_ready_i is high,
    //   in_valid_o shall be high and in_data_o shall be consumed.
    // in_ready_i shall be high only for one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, in_ready_i shall be updated.
    input        in_data_ack_i
    // When both in_data_ack_i and in_ready_i are high, an ACK packet shall be received.
    // When clk_gate_i is high, in_data_ack_i shall be updated.
    );

   function integer ceil_log2;
      input [31:0] arg;
      integer      i;
      begin
         ceil_log2 = 0;
         for (i = 0; i < 32; i = i + 1) begin
            if (arg > (1 << i))
              ceil_log2 = ceil_log2 + 1;
         end
      end
   endfunction

   localparam IN_LENGTH = IN_MAXPACKETSIZE + 'd1; // the contents of the last addressed byte is meaningless

   reg [ceil_log2(IN_LENGTH)-1:0] in_first_q, in_first_qq;
   reg [ceil_log2(IN_LENGTH)-1:0] in_last_q, in_last_qq;
   reg [8*IN_LENGTH-1:0]          in_fifo_q;

   assign in_data_o = in_fifo_q[{in_first_qq, 3'd0} +:8];
   assign in_valid_o = (in_first_qq == in_last_qq) ? 1'b0 : 1'b1;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         in_first_q <= 'd0;
         in_first_qq <= 'd0;
      end else begin
         if (clk_gate_i) begin
            if (in_ready_i) begin
               if (in_req_i) begin
                  in_first_qq <= in_first_q; // shall retry one more time if in_first_q wasn't updated
               end else if (in_data_ack_i) begin
                  in_first_q <= in_first_qq;
               end else begin
                  if (in_first_qq == IN_LENGTH-1)
                    in_first_qq <= 'd0;
                  else
                    in_first_qq <= in_first_qq + 1;
               end
            end
         end
      end
   end

   wire in_full, app_in_buffer_empty;

   assign in_full = (in_first_q == ((in_last_q == IN_LENGTH-1) ? 'd0 : in_last_q+1) ? 1'b1 : 1'b0);
   assign in_full_o = in_full;
   assign in_empty_o = ((in_first_q == in_last_q && app_in_buffer_empty == 1'b1) ? 1'b1 : 1'b0);

   generate
      if (USE_APP_CLK == 0) begin : u_sync_data
         reg [7:0] app_in_data_q;
         reg       app_in_valid_q, app_in_valid_qq;
         reg       app_in_ready_q;

         assign app_in_ready_o = app_in_ready_q;
         assign app_in_buffer_empty = ~app_in_valid_qq;

         always @(posedge clk_i or negedge rstn_i) begin
            if (~rstn_i) begin
               in_fifo_q <= {IN_LENGTH{8'd0}};
               in_last_q <= 'd0;
               in_last_qq <= 'd0;
               app_in_data_q <= 8'd0;
               app_in_valid_q <= 1'b0;
               app_in_valid_qq <= 1'b0;
               app_in_ready_q <= 1'b0;
            end else begin
               if (clk_gate_i) begin
                  in_fifo_q[{in_last_q, 3'd0} +:8] <= app_in_data_q;
                  app_in_valid_qq <= app_in_valid_q;
                  if (in_ready_i)
                    in_last_qq <= in_last_q;
                  if (~in_full & app_in_valid_qq) begin
                     app_in_valid_q <= 1'b0;
                     app_in_valid_qq <= 1'b0;
                     app_in_ready_q <= 1'b1;
                     if (in_last_q == IN_LENGTH-1) begin
                        in_last_q <= 'd0;
                        if (in_ready_i)
                          in_last_qq <= 'd0;
                     end else begin
                        in_last_q <= in_last_q + 1;
                        if (in_ready_i)
                          in_last_qq <= in_last_q + 1;
                     end
                  end
               end
               if (~app_in_valid_q)
                 app_in_ready_q <= 1'b1;
               if (app_in_valid_i & app_in_ready_q) begin
                  app_in_data_q <= app_in_data_i;
                  app_in_valid_q <= 1'b1;
                  if (clk_gate_i)
                    app_in_valid_qq <= 1'b1;
                  app_in_ready_q <= 1'b0;
               end
            end
         end
      end else if (APP_CLK_FREQ <= 12) begin : u_lte12mhz_async_data
         reg [2:0] app_clk_sq; // BIT_SAMPLES >= 4
         reg [15:0] app_in_data_q;
         reg [1:0]  app_in_valid_q, app_in_valid_qq, app_in_valid_qqq;
         reg        app_in_first_q, app_in_first_qq, app_in_first_qqq;
         reg [1:0]  app_in_consumed_q, app_in_consumed_qq;
         reg        app_in_ready_q;

         assign app_in_ready_o = app_in_ready_q;
         assign app_in_buffer_empty = ~|app_in_valid_qqq;

         always @(posedge clk_i or negedge rstn_i) begin
            if (~rstn_i) begin
               in_fifo_q <= {IN_LENGTH{8'd0}};
               in_last_q <= 'd0;
               in_last_qq <= 'd0;
               app_clk_sq <= 3'b000;
               app_in_valid_qq <= 2'b00;
               app_in_valid_qqq <= 2'b00;
               app_in_first_qq <= 1'b0;
               app_in_first_qqq <= 1'b0;
               app_in_consumed_q <= 2'b00;
               app_in_consumed_qq <= 2'b00;
               app_in_ready_q <= 1'b0;
            end else begin
               app_clk_sq <= {app_clk_i, app_clk_sq[2:1]};
               if (app_clk_sq[1:0] == 2'b10) begin
                  app_in_ready_q <= |(~(app_in_valid_q & ~app_in_consumed_q));
                  app_in_consumed_q <= 2'b00;
                  app_in_consumed_qq <= app_in_consumed_q;
                  app_in_valid_qq <= app_in_valid_q & ~app_in_consumed_q;
                  if (^app_in_consumed_q)
                    app_in_first_qq <= app_in_consumed_q[0];
                  else
                    app_in_first_qq <= app_in_first_q;
               end
               if (clk_gate_i) begin
                  if (app_in_first_qqq == 1'b0)
                    in_fifo_q[{in_last_q, 3'd0} +:8] <= app_in_data_q[7:0];
                  else
                    in_fifo_q[{in_last_q, 3'd0} +:8] <= app_in_data_q[15:8];
                  if (in_ready_i)
                    in_last_qq <= in_last_q;
                  app_in_valid_qqq <= app_in_valid_qq;
                  app_in_first_qqq <= app_in_first_qq;
                  if (app_clk_sq[1:0] == 2'b10) begin
                     app_in_valid_qqq <= app_in_valid_q & ~app_in_consumed_q;
                     if (^app_in_consumed_q)
                       app_in_first_qqq <= app_in_consumed_q[0];
                     else
                       app_in_first_qqq <= app_in_first_q;
                  end
                  if (~in_full & |app_in_valid_qqq) begin
                     if (app_in_first_qqq == 1'b0) begin
                        app_in_valid_qq[0] <= 1'b0;
                        app_in_valid_qqq[0] <= 1'b0;
                        app_in_first_qq <= 1'b1;
                        app_in_first_qqq <= 1'b1;
                        app_in_consumed_q[0] <= 1'b1;
                     end else begin
                        app_in_valid_qq[1] <= 1'b0;
                        app_in_valid_qqq[1] <= 1'b0;
                        app_in_first_qq <= 1'b0;
                        app_in_first_qqq <= 1'b0;
                        app_in_consumed_q[1] <= 1'b1;
                     end
                     if (in_last_q == IN_LENGTH-1) begin
                        in_last_q <= 'd0;
                        if (in_ready_i)
                          in_last_qq <= 'd0;
                     end else begin
                        in_last_q <= in_last_q + 1;
                        if (in_ready_i)
                          in_last_qq <= in_last_q + 1;
                     end
                  end
               end
            end
         end

         always @(posedge app_clk_i or negedge app_rstn_i) begin
            if (~app_rstn_i) begin
               app_in_data_q <= 16'd0;
               app_in_valid_q <= 2'b00;
               app_in_first_q <= 1'b0;
            end else begin
               app_in_valid_q <= app_in_valid_q & ~app_in_consumed_qq;
               if (^app_in_consumed_qq)
                 app_in_first_q <= app_in_consumed_qq[0];
               if (app_in_valid_i & app_in_ready_q) begin
                  if (~(app_in_valid_q[0] & ~app_in_consumed_qq[0])) begin
                     app_in_data_q[7:0] <= app_in_data_i;
                     app_in_valid_q[0] <= 1'b1;
                     app_in_first_q <= app_in_valid_q[1] & ~app_in_consumed_qq[1];
                  end else if (~(app_in_valid_q[1] & ~app_in_consumed_qq[1])) begin
                     app_in_data_q[15:8] <= app_in_data_i;
                     app_in_valid_q[1] <= 1'b1;
                     app_in_first_q <= ~(app_in_valid_q[0] & ~app_in_consumed_qq[0]);
                  end
               end
            end
         end
      end else begin : u_gt12mhz_async_data
         reg [1:0] app_in_valid_sq;
         reg [7:0] app_in_data_q;
         reg       app_in_valid_q, app_in_valid_qq;
         reg       app_in_ready_q;

         assign app_in_buffer_empty = ~app_in_valid_qq;

         always @(posedge clk_i or negedge rstn_i) begin
            if (~rstn_i) begin
               in_fifo_q <= {IN_LENGTH{8'd0}};
               in_last_q <= 'd0;
               app_in_valid_sq <= 2'd0;
               app_in_valid_qq <= 1'b0;
               app_in_ready_q <= 1'b0;
            end else begin
               app_in_valid_sq <= {app_in_valid_q, app_in_valid_sq[1]};
               if (~app_in_valid_sq[0])
                 app_in_ready_q <= 1'b1;
               if (clk_gate_i) begin
                  in_fifo_q[{in_last_q, 3'd0} +:8] <= app_in_data_q;
                  app_in_valid_qq <= app_in_valid_sq[0] & app_in_ready_q;
                  if (in_ready_i)
                    in_last_qq <= in_last_q;
                  if (~in_full & app_in_valid_qq) begin
                     app_in_valid_qq <= 1'b0;
                     app_in_ready_q <= 1'b0;
                     if (in_last_q == IN_LENGTH-1) begin
                        in_last_q <= 'd0;
                        if (in_ready_i)
                          in_last_qq <= 'd0;
                     end else begin
                        in_last_q <= in_last_q + 1;
                        if (in_ready_i)
                          in_last_qq <= in_last_q + 1;
                     end
                  end
               end
            end
         end

         reg [1:0] app_in_ready_sq;

         assign app_in_ready_o = app_in_ready_sq[0] & ~app_in_valid_q;

         always @(posedge app_clk_i or negedge app_rstn_i) begin
            if (~app_rstn_i) begin
               app_in_data_q <= 8'd0;
               app_in_valid_q <= 1'b0;
               app_in_ready_sq <= 2'b00;
            end else begin
               app_in_ready_sq <= {app_in_ready_q, app_in_ready_sq[1]};
               if (~app_in_ready_sq[0])
                 app_in_valid_q <= 1'b0;
               else if (app_in_valid_i & ~app_in_valid_q) begin
                  app_in_data_q <= app_in_data_i;
                  app_in_valid_q <= 1'b1;
               end
            end
         end
      end
   endgenerate
endmodule
//  USB 2.0 full speed OUT FIFO.
//  Written in verilog 2001

// OUT_FIFO module shall implement an OUT FIFO interface.
// New out_data_i shall be inserted in the OUT FIFO when the FIFO is not
//   full, out_err_i is low and both out_valid_i and out_ready_i are high.
// Data that is inserted in the OUT FIFO shall be confirmed by EOP signaled
//   when out_valid_i and out_err_i are low and out_ready_i is high.
// app_out_data_o shall be sourced and removed from the OUT FIFO when both
//   app_out_valid_o and app_out_ready_i are high.

module out_fifo
  #(parameter OUT_MAXPACKETSIZE = 'd8,
    parameter USE_APP_CLK = 0,
    parameter APP_CLK_FREQ = 12) // app_clk frequency in MHz
   (
    // ---- to/from Application ------------------------------------
    input        app_clk_i,
    input        app_rstn_i,
    // While app_rstn_i is low (active low), the app_clk_i'ed registers shall be reset
    output [7:0] app_out_data_o,
    output       app_out_valid_o,
    // While app_out_valid_o is high, the app_out_data_o shall be valid and both
    //   app_out_valid_o and app_out_data_o shall not change until consumed.
    input        app_out_ready_i,
    // When both app_out_valid_o and app_out_ready_i are high, the app_out_data_o shall
    //   be consumed.

    // ---- from top module ---------------------------------------
    input        clk_i,
    // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES
    input        rstn_i,
    // While rstn_i is low (active low), the clk_i'ed registers shall be reset
    input        clk_gate_i,
    // clk_gate_i shall be high for only one clk_i period within every BIT_SAMPLES clk_i periods.
    // When clk_gate_i is high, the registers that are gated by it shall be updated.
    output       out_empty_o,
    // While the OUT FIFO is empty out_empty_o shall be high. Unconfirmed data is not condidered.
    // When clk_gate_i is high, out_empty_o shall be updated.
    output       out_full_o,
    // While the OUT FIFO is full, including the presence of unconfirmed data waiting for EOP,
    //   in_full_o shall be high.
    // When clk_gate_i is high, out_full_o shall be updated.

    // ---- to/from SIE module ------------------------------------
    output       out_nak_o,
    // While out_valid_i is high, when OUT FIFO is full, out_nak_o shall be
    //   latched high.
    // When either out_valid_i or out_err_i is low and out_ready_i is high,
    //   out_nak_o shall be low.
    // When clk_gate_i is high, out_nak_o shall be updated.
    input [7:0]  out_data_i,
    input        out_valid_i,
    // While out_valid_i is high, the out_data_i shall be valid and both
    //   out_valid_i and out_data_i shall not change until consumed.
    // When clk_gate_i is high, out_valid_i shall be updated.
    input        out_err_i,
    // When both out_err_i and out_ready_i are high, SIE shall abort the
    //   current packet reception and OUT FIFO shall manage the error condition.
    // When clk_gate_i is high, out_err_i shall be updated.
    input        out_ready_i
    // When both out_valid_i and out_ready_i are high, the out_data_i shall
    //   be consumed.
    // When out_valid_i and out_err_i are low and out_ready_i is high, the
    //   on-going OUT packet shall end (EOP).
    // out_ready_i shall be high only for one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, out_ready_i shall be updated.
    );

   function integer ceil_log2;
      input [31:0] arg;
      integer      i;
      begin
         ceil_log2 = 0;
         for (i = 0; i < 32; i = i + 1) begin
            if (arg > (1 << i))
              ceil_log2 = ceil_log2 + 1;
         end
      end
   endfunction

   localparam OUT_LENGTH = OUT_MAXPACKETSIZE + 'd1; // the contents of the last addressed byte is meaningless

   reg [8*OUT_LENGTH-1:0] out_fifo_q;
   reg [ceil_log2(OUT_LENGTH)-1:0] out_first_q;
   reg [ceil_log2(OUT_LENGTH)-1:0] out_last_q, out_last_d;
   reg [ceil_log2(OUT_LENGTH)-1:0] out_last_qq, out_last_dd;
   reg                             out_nak_q, out_nak_d;

   wire                            out_full;

   assign out_full = (out_first_q == ((out_last_qq == OUT_LENGTH-1) ? 'd0 : out_last_qq+1) ? 1'b1 : 1'b0);
   assign out_full_o = out_full;
   assign out_nak_o = out_nak_q;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         out_fifo_q <= {OUT_LENGTH{8'd0}};
         out_last_q <= 'd0;
         out_last_qq <= 'd0;
         out_nak_q <= 1'b0;
      end else begin
         if (clk_gate_i) begin
            out_fifo_q[{out_last_qq, 3'd0} +:8] <= out_data_i;
            if (out_ready_i) begin
               out_last_q <= out_last_d;
               out_last_qq <= out_last_dd;
               out_nak_q <= out_nak_d;
            end
         end
      end
   end

   always @(/*AS*/out_err_i or out_full or out_last_q or out_last_qq
            or out_nak_q or out_valid_i) begin
      out_last_d = out_last_q;
      out_last_dd = out_last_qq;
      out_nak_d = 1'b0;

      if (out_err_i) begin
         out_last_dd = out_last_q;
      end else if (~out_valid_i) begin
         if (out_nak_q == 1'b1)
           out_last_dd = out_last_q;
         else
           out_last_d = out_last_qq;
      end else if (out_full | out_nak_q) begin
         out_nak_d = 1'b1;
      end else begin
         if (out_last_qq == OUT_LENGTH-1)
           out_last_dd = 'd0;
         else
           out_last_dd = out_last_qq + 1;
      end
   end

   wire [7:0] app_out_data;
   wire       out_empty;
   wire       app_out_buffer_empty;

   assign app_out_data = out_fifo_q[{out_first_q, 3'd0} +:8];
   assign out_empty = ((out_first_q == out_last_q) ? 1'b1 : 1'b0);
   assign out_empty_o = out_empty && app_out_buffer_empty;

   generate
      if (USE_APP_CLK == 0) begin : u_sync_data
         reg [7:0] app_out_data_q;
         reg       app_out_valid_q, app_out_valid_qq;

         assign app_out_data_o = app_out_data_q;
         assign app_out_valid_o = app_out_valid_q;
         assign app_out_buffer_empty = ~app_out_valid_qq;

         always @(posedge clk_i or negedge rstn_i) begin
            if (~rstn_i) begin
               out_first_q <= 'd0;
               app_out_data_q <= 8'd0;
               app_out_valid_q <= 1'b0;
               app_out_valid_qq <= 1'b0;
            end else begin
               if (app_out_ready_i & app_out_valid_q)
                 app_out_valid_q <= 1'b0;
               if (clk_gate_i) begin
                  app_out_valid_qq <= app_out_valid_q;
                  if (~out_empty) begin
                     if (~app_out_valid_q | (app_out_ready_i & app_out_valid_q)) begin
                        app_out_data_q <= app_out_data;
                        app_out_valid_q <= 1'b1;
                        app_out_valid_qq <= 1'b1;
                        if (out_first_q == OUT_LENGTH-1)
                          out_first_q <= 'd0;
                        else
                          out_first_q <= out_first_q + 1;
                     end
                  end
               end
            end
         end
      end else if (APP_CLK_FREQ <= 12) begin : u_lte12mhz_async_data
         reg [15:0] app_out_data_q;
         reg [1:0]  app_out_valid_q;
         reg        app_out_valid_qq, app_out_valid_qqq;
         reg        app_out_consumed_q;
         reg [2:0]  app_clk_sq; // BIT_SAMPLES >= 4

         assign app_out_data_o = app_out_data_q[7:0];
         assign app_out_valid_o = app_out_valid_qq;
         assign app_out_buffer_empty = ~app_out_valid_qqq;

         always @(posedge clk_i or negedge rstn_i) begin
            if (~rstn_i) begin
               out_first_q <= 'd0;
               app_out_data_q <= 16'd0;
               app_out_valid_q <= 2'b00;
               app_out_valid_qq <= 1'b0;
               app_out_valid_qqq <= 1'b0;
               app_clk_sq <= 3'b000;
            end else begin
               app_clk_sq <= {app_clk_i, app_clk_sq[2:1]};
               if (app_clk_sq[1:0] == 2'b10) begin
                  app_out_valid_qq <= app_out_valid_q[0];
                  if (app_out_consumed_q) begin
                     if (app_out_valid_q[1]) begin
                        app_out_data_q[7:0] <= app_out_data_q[15:8];
                        app_out_valid_q <= 2'b01;
                        app_out_valid_qq <= 1'b1;
                     end else begin
                        app_out_valid_q <= 2'b00;
                        app_out_valid_qq <= 1'b0;
                     end
                  end
               end
               if (clk_gate_i) begin
                  app_out_valid_qqq <= |app_out_valid_q;
                  if (~out_empty) begin
                     if (app_out_valid_q != 2'b11 ||
                         (app_clk_sq[1:0] == 2'b10 && app_out_consumed_q == 1'b1)) begin
                        if (app_out_valid_q[1] == 1'b1 &&
                            (app_clk_sq[1:0] == 2'b10 && app_out_consumed_q == 1'b1)) begin
                           app_out_data_q[15:8] <= app_out_data;
                           app_out_valid_q[1] <= 1'b1;
                           app_out_valid_qqq <= 1'b1;
                        end else if (app_out_valid_q[0] == 1'b0 ||
                            (app_clk_sq[1:0] == 2'b10 && app_out_consumed_q == 1'b1)) begin
                           app_out_data_q[7:0] <= app_out_data;
                           app_out_valid_q[0] <= 1'b1;
                           app_out_valid_qqq <= 1'b1;
                        end else begin
                           app_out_data_q[15:8] <= app_out_data;
                           app_out_valid_q[1] <= 1'b1;
                           app_out_valid_qqq <= 1'b1;
                        end
                        if (out_first_q == OUT_LENGTH-1)
                          out_first_q <= 'd0;
                        else
                          out_first_q <= out_first_q + 1;
                     end
                  end
               end
            end
         end

         always @(posedge app_clk_i or negedge app_rstn_i) begin
            if (~app_rstn_i) begin
               app_out_consumed_q <= 1'b0;
            end else begin
               app_out_consumed_q <= app_out_ready_i & app_out_valid_qq;
            end
         end
      end else begin : u_gt12mhz_async_data
         reg [1:0] app_out_consumed_sq;
         reg [7:0] app_out_data_q;
         reg       app_out_valid_q;
         reg       app_out_consumed_q;

         assign app_out_buffer_empty = ~app_out_valid_q;

         always @(posedge clk_i or negedge rstn_i) begin
            if (~rstn_i) begin
               out_first_q <= 'd0;
               app_out_data_q <= 8'd0;
               app_out_valid_q <= 1'b0;
               app_out_consumed_sq <= 2'b00;
            end else begin
               app_out_consumed_sq <= {app_out_consumed_q, app_out_consumed_sq[1]};
               if (clk_gate_i) begin
                  if (app_out_consumed_sq[0])
                    app_out_valid_q <= 1'b0;
                  else if (~out_empty & ~app_out_valid_q) begin
                     app_out_data_q <= app_out_data;
                     app_out_valid_q <= 1'b1;
                     if (out_first_q == OUT_LENGTH-1)
                       out_first_q <= 'd0;
                     else
                       out_first_q <= out_first_q + 1;
                  end
               end
            end
         end

         reg [1:0] out_valid_sq;

         assign app_out_data_o = app_out_data_q;
         assign app_out_valid_o = out_valid_sq[0] & ~app_out_consumed_q;

         always @(posedge app_clk_i or negedge app_rstn_i) begin
            if (~app_rstn_i) begin
               out_valid_sq <= 2'b00;
               app_out_consumed_q <= 1'b0;
            end else begin
               out_valid_sq <= {app_out_valid_q, out_valid_sq[1]};
               if (~out_valid_sq[0])
                 app_out_consumed_q <= 1'b0;
               else if (app_out_ready_i & ~app_out_consumed_q)
                 app_out_consumed_q <= 1'b1;
            end
         end
      end
   endgenerate
endmodule
//  USB 2.0 full speed IN/OUT Control Endpoints.
//  Written in verilog 2001

// CTRL_ENDP module shall implement IN/OUT Control Endpoint.
// CTRL_ENDP shall manage control transfers:
//   - Provide device information.
//   - Keep device states (Default, Address and Configured).
//   - Keep and provide to SIE the device address.
//   - Respond to standard device requests:
//       - GET_STATUS (00h)
//       - CLEAR_FEATURE (01h)
//       - SET_ADDRESS (05h)
//       - GET_DESCRIPTOR (DEVICE, CONFIGURATION and STRING) (06h)
//       - GET_CONFIGURATION (08h)
//       - SET_CONFIGURATION (09h)
//       - GET_INTERFACE (0Ah)
//   - Respond to Abstract Control Model (ACM) subclass requests:
//       - SET_LINE_CODING (20h)
//       - GET_LINE_CODING (21h)
//       - SET_CONTROL_LINE_STATE (22h)
//       - SEND_BREAK (23h)

`define max(a,b) ((a) > (b) ? (a) : (b))
`define min(a,b) ((a) < (b) ? (a) : (b))

module ctrl_endp
  #(parameter VENDORID = 16'h0000,
    parameter PRODUCTID = 16'h0000,
    parameter CHANNELS = 'd1,
    parameter CTRL_MAXPACKETSIZE = 'd8,
    parameter IN_BULK_MAXPACKETSIZE = 'd8,
    parameter OUT_BULK_MAXPACKETSIZE = 'd8)
   (
    // ---- to/from USB_CDC module ---------------------------------
    input         clk_i,
    // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES.
    input         rstn_i,
    // While rstn_i is low (active low), the module shall be reset.
    input         clk_gate_i,
    // clk_gate_i shall be high for only one clk_i period within every BIT_SAMPLES clk_i periods.
    // When clk_gate_i is high, the registers that are gated by it shall be updated.
    output        configured_o,
    // While USB_CDC is in configured state, configured_o shall be high.
    // When clk_gate_i is high, configured_o shall be updated.

    // ---- to/from SIE module ------------------------------------
    input         bus_reset_i,
    // While bus_reset_i is high, the module shall be reset.
    // When bus_reset_i is high, the device shall be in DEFAULT_STATE
    // When clk_gate_i is high, bus_reset_i shall be updated.
    output        usb_en_o,
    // While device is in POWERED_STATE and bus_reset_i is low, usb_en_o shall be low.
    // When clk_gate_i is high, usb_en_o shall be updated.
    output [6:0]  addr_o,
    // addr_o shall be the device address.
    // addr_o shall be updated at the end of SET_ADDRESS control transfer.
    // When clk_gate_i is high, addr_o shall be updated.
    output        stall_o,
    // While control pipe is addressed and is in stall state, stall_o shall
    //   be high, otherwise shall be low.
    // When clk_gate_i is high, stall_o shall be updated.
    output [15:0] in_bulk_endps_o,
    // While in_bulk_endps_o[i] is high, endp=i shall be enabled as IN bulk endpoint.
    //   endp=0 is reserved for IN control endpoint.
    // When clk_gate_i is high, in_bulk_endps_o shall be updated.
    output [15:0] out_bulk_endps_o,
    // While out_bulk_endps_o[i] is high, endp=i shall be enabled as OUT bulk endpoint
    //   endp=0 is reserved for OUT control endpoint.
    // When clk_gate_i is high, out_bulk_endps_o shall be updated.
    output [15:0] in_int_endps_o,
    // While in_int_endps_o[i] is high, endp=i shall be enabled as IN interrupt endpoint.
    //   endp=0 is reserved for IN control endpoint.
    // When clk_gate_i is high, in_int_endps_o shall be updated.
    output [15:0] out_int_endps_o,
    // While out_int_endps_i[i] is high, endp=i shall be enabled as OUT interrupt endpoint
    //   endp=0 is reserved for OUT control endpoint.
    // When clk_gate_i is high, out_int_endps_o shall be updated.
    output [15:0] out_toggle_reset_o,
    // When out_toggle_reset_o[i] is high, data toggle synchronization of
    //   OUT bulk pipe at endpoint=i shall be reset to DATA0.
    // When clk_gate_i is high, out_toggle_reset_o shall be updated.
    output [15:0] in_toggle_reset_o,
    // When in_toggle_reset_o[i] is high, data toggle synchronization of
    //   IN bulk pipe at endpoint=i shall be reset to DATA0.
    // When clk_gate_i is high, in_toggle_reset_o shall be updated.
    output [7:0]  in_data_o,
    // While in_valid_o is high and in_zlp_o is low, in_data_o shall be valid.
    output        in_zlp_o,
    // While IN Control Endpoint have to reply with zero length packet,
    //   IN Control Endpoint shall put both in_zlp_o and in_valid_o high.
    // When clk_gate_i is high, in_zlp_o shall be updated.
    output        in_valid_o,
    // While IN Control Endpoint have data or zero length packet available,
    //   IN Control Endpoint shall put in_valid_o high.
    // When clk_gate_i is high, in_valid_o shall be updated.
    input         in_req_i,
    // When both in_req_i and in_ready_i are high, a new IN packet shall be requested.
    // When clk_gate_i is high, in_req_i shall be updated.
    input         in_ready_i,
    // When both in_ready_i and in_valid_o are high, in_data_o or zero length
    //   packet shall be consumed.
    // When in_data_o or zlp is consumed, in_ready_i shall be high only for
    //   one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, in_ready_i shall be updated.
    input         setup_i,
    // While last correctly checked PID (USB2.0 8.3.1) is SETUP, setup_i shall
    //   be high, otherwise shall be low.
    // When clk_gate_i is high, setup_i shall be updated.
    input         in_data_ack_i,
    // When in_data_ack_i is high and out_ready_i is high, an ACK packet shall be received.
    // When clk_gate_i is high, in_data_ack_i shall be updated.
    input [7:0]   out_data_i,
    input         out_valid_i,
    // While out_valid_i is high, the out_data_i shall be valid and both
    //   out_valid_i and out_data_i shall not change until consumed.
    // When clk_gate_i is high, out_valid_i shall be updated.
    input         out_err_i,
    // When both out_err_i and out_ready_i are high, SIE shall abort the
    //   current packet reception and OUT Control Endpoint shall manage the error
    //   condition.
    // When clk_gate_i is high, out_err_i shall be updated.
    input         out_ready_i
    // When both out_valid_i and out_ready_i are high, the out_data_i shall
    //   be consumed.
    // When setup_i is high and out_ready_i is high, a new SETUP transaction shall be
    //   received.
    // When setup_i, out_valid_i and out_err_i are low and out_ready_i is high, the
    //   on-going OUT packet shall end (EOP).
    // out_ready_i shall be high only for one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, out_ready_i shall be updated.
    );

   function integer ceil_log2;
      input [31:0] arg;
      integer      i;
      begin
         ceil_log2 = 0;
         for (i = 0; i < 32; i = i + 1) begin
            if (arg > (1 << i))
              ceil_log2 = ceil_log2 + 1;
         end
      end
   endfunction

   function [7:0] master_interface;
      input integer channel;
      begin
         master_interface = 2*channel[6:0];
      end
   endfunction

   function [7:0] slave_interface;
      input integer channel;
      begin
         slave_interface = 2*channel[6:0]+1;
      end
   endfunction

   function [3:0] bulk_endp;
      input integer channel;
      begin
         bulk_endp = 2*channel[2:0]+1;
      end
   endfunction

   function [3:0] int_endp;
      input integer channel;
      begin
         int_endp = 2*channel[2:0]+2;
      end
   endfunction

   function [15:0] bulk_endps;
      input integer channels;
      integer       i;
      begin
         bulk_endps = 16'b0;
         for (i = 0; i < channels; i = i+1) begin
            bulk_endps[bulk_endp(i)] = 1'b1;
         end
      end
   endfunction

   function [15:0] int_endps;
      input integer channels;
      integer       i;
      begin
         int_endps = 16'b0;
         for (i = 0; i < channels; i = i+1) begin
            int_endps[int_endp(i)] = 1'b1;
         end
      end
   endfunction

   localparam [15:0] IN_BULK_ENDPS = bulk_endps(CHANNELS);
   localparam [15:0] OUT_BULK_ENDPS = bulk_endps(CHANNELS);
   localparam [15:0] IN_INT_ENDPS = int_endps(CHANNELS);
   localparam [15:0] OUT_INT_ENDPS = 16'b0;

   function [7:0] string_index;
      input integer channel;
      begin
         string_index = channel[7:0]+8'd1;
      end
   endfunction

   // String Descriptor Zero (in reverse order)
   localparam [8*'h4-1:0] STRING_DESCR_00 = {8'h04, // wLANGID[1] (US English)
                                             8'h09, // wLANGID[0]
                                             8'h03, // bDescriptorType (STRING)
                                             8'h04 // bLength
                                             }; // String Descriptor Zero, USB2.0 9.6.7, page 273-274, Table 9-15

   localparam             SDL = 'h0A; // STRING_DESCR_XX Length
   // String Descriptor (in reverse order)
   localparam [8*SDL-1:0] STRING_DESCR_XX = {8'h00, "0",
                                             8'h00, "C",
                                             8'h00, "D",
                                             8'h00, "C",
                                             8'h03, // bDescriptorType (STRING)
                                             SDL[7:0] // bLength
                                             }; // UNICODE String Descriptor, USB2.0 9.6.7, page 273-274, Table 9-16

   // Device Descriptor (in reverse order)
   localparam [8*'h12-1:0] DEV_DESCR = {8'h01, // bNumConfigurations
                                        8'h00, // iSerialNumber (no string)
                                        8'h00, // iProduct (no string)
                                        8'h00, // iManufacturer (no string)
                                        8'h01, // bcdDevice[1] (1.10)
                                        8'h10, // bcdDevice[0]
                                        PRODUCTID[15:8], // idProduct[1]
                                        PRODUCTID[7:0], // idProduct[0]
                                        VENDORID[15:8], // idVendor[1]
                                        VENDORID[7:0], // idVendor[0]
                                        CTRL_MAXPACKETSIZE[7:0], // bMaxPacketSize0
                                        (CHANNELS>1) ? {
                                                        8'h01, // bDeviceProtocol (Interface Association Descriptor)
                                                        8'h02, // bDeviceSubClass (Common Class)
                                                        8'hEF // bDeviceClass (Miscellaneous Device Class)
                                                        } : {
                                                             8'h00, // bDeviceProtocol (specified at interface level)
                                                             8'h00, // bDeviceSubClass (specified at interface level)
                                                             8'h02 // bDeviceClass (Communications Device Class)
                                                             },
                                        8'h02, // bcdUSB[1] (2.00)
                                        8'h00, // bcdUSB[0]
                                        8'h01, // bDescriptorType (DEVICE)
                                        8'h12 // bLength
                                        }; // Standard Device Descriptor, USB2.0 9.6.1, page 261-263, Table 9-8

   function [8*'h3A-1:0] cdc_descr;
      input integer i;
      begin
         // CDC Interfaces Descriptor (in reverse order)
         cdc_descr = {8'h00, // bInterval
                      8'h00, // wMaxPacketSize[1]
                      IN_BULK_MAXPACKETSIZE[7:0], // wMaxPacketSize[0]
                      8'h02, // bmAttributes (bulk)
                      8'h80+{4'd0, bulk_endp(i)}, // bEndpointAddress (1 IN)
                      8'h05, // bDescriptorType (ENDPOINT)
                      8'h07, // bLength
                      // Standard Endpoint Descriptor, USB2.0 9.6.6, page 269-271, Table 9-13

                      8'h00, // bInterval
                      8'h00, // wMaxPacketSize[1]
                      OUT_BULK_MAXPACKETSIZE[7:0], // wMaxPacketSize[0]
                      8'h02, // bmAttributes (bulk)
                      8'h00+{4'd0, bulk_endp(i)}, // bEndpointAddress (1 OUT)
                      8'h05, // bDescriptorType (ENDPOINT)
                      8'h07, // bLength
                      // Standard Endpoint Descriptor, USB2.0 9.6.6, page 269-271, Table 9-13

                      8'h00, // iInterface (no string)
                      8'h00, // bInterfaceProtocol
                      8'h00, // bInterfaceSubClass
                      8'h0A, // bInterfaceClass (CDC-Data)
                      8'h02, // bNumEndpoints
                      8'h00, // bAlternateSetting
                      slave_interface(i), // bInterfaceNumber
                      8'h04, // bDescriptorType (INTERFACE)
                      8'h09, // bLength
                      // Standard Interface Descriptor, USB2.0 9.6.5, page 267-269, Table 9-12

                      8'hFF, // bInterval (255 ms)
                      8'h00, // wMaxPacketSize[1]
                      8'h08, // wMaxPacketSize[0]
                      8'h03, // bmAttributes (interrupt)
                      8'h80+{4'd0, int_endp(i)}, // bEndpointAddress (2 IN)
                      8'h05, // bDescriptorType (ENDPOINT)
                      8'h07, // bLength
                      // Standard Endpoint Descriptor, USB2.0 9.6.6, page 269-271, Table 9-13

                      slave_interface(i), // bSlaveInterface0
                      master_interface(i), // bMasterInterface
                      8'h06, // bDescriptorSubtype (Union Functional)
                      8'h24, // bDescriptorType (CS_INTERFACE)
                      8'h05, // bFunctionLength
                      // Union Functional Descriptor, CDC1.1 5.2.3.8, Table 33

                      8'h00, // bmCapabilities (none)
                      8'h02, // bDescriptorSubtype (Abstract Control Management Functional)
                      8'h24, // bDescriptorType (CS_INTERFACE)
                      8'h04, // bFunctionLength
                      // Abstract Control Management Functional Descriptor, CDC1.1 5.2.3.3, Table 28

                      8'h01, // bDataInterface
                      8'h00, // bmCapabilities (no call mgmnt)
                      8'h01, // bDescriptorSubtype (Call Management Functional)
                      8'h24, // bDescriptorType (CS_INTERFACE)
                      8'h05, // bFunctionLength
                      // Call Management Functional Descriptor, CDC1.1 5.2.3.2, Table 27

                      8'h01, // bcdCDC[1] (1.1)
                      8'h10, // bcdCDC[0]
                      8'h00, // bDescriptorSubtype (Header Functional)
                      8'h24, // bDescriptorType (CS_INTERFACE)
                      8'h05, // bFunctionLength
                      // Header Functional Descriptor, CDC1.1 5.2.3.1, Table 26

                      (CHANNELS>1) ? string_index(i) : 8'h00, // iInterface (string / no string)
                      8'h01, // bInterfaceProtocol (AT Commands in ITU V.25ter)
                      8'h02, // bInterfaceSubClass (Abstract Control Model)
                      8'h02, // bInterfaceClass (Communications Device Class)
                      8'h01, // bNumEndpoints
                      8'h00, // bAlternateSetting
                      master_interface(i), // bInterfaceNumber
                      8'h04, // bDescriptorType (INTERFACE)
                      8'h09 // bLength
                      }; // Standard Interface Descriptor, USB2.0 9.6.5, page 267-269, Table 9-12
      end
   endfunction

   function [8*'h08-1:0] ia_descr;
      input integer i;
      begin
         // Interfaces Association Descriptor (in reverse order)
         ia_descr = {8'h00, // iFunction (no string)
                     8'h01, // bFunctionProtocol (AT Commands in ITU V.25ter)
                     8'h02, // bFunctionSubClass (Abstract Control Model)
                     8'h02, // bFunctionClass (Communications Device Class)
                     8'h02, // bInterfaceCount
                     master_interface(i), // bFirstInterface
                     8'h0B, // bDescriptorType (INTERFACE ASSOCIATION)
                     8'h08 // bLength
                     }; // Interface Association Descriptor, USB2.0 ECN 9.X.Y, page 4-5, Table 9-Z
      end
   endfunction

   localparam CDL = (CHANNELS>1) ? ('h3A+'h08)*CHANNELS+'h09 : 'h3A+'h09; // CONF_DESCR Length
   function [8*CDL-1:0] conf_descr;
      input dummy;
      integer i;
      begin
         conf_descr[0 +:8*'h09] = {8'h32, // bMaxPower (100mA)
                                   8'h80, // bmAttributes (bus powered, no remote wakeup)
                                   8'h00, // iConfiguration (no string)
                                   8'h01, // bConfigurationValue
                                   8'd2*CHANNELS[7:0], // bNumInterfaces
                                   CDL[15:8], // wTotalLength[1]
                                   CDL[7:0], // wTotalLength[0]
                                   8'h02, // bDescriptorType (CONFIGURATION)
                                   8'h09 // bLength
                                   }; // Standard Configuration Descriptor, USB2.0 9.6.3, page 264-266, Table 9-10

         if (CHANNELS>1) begin
            for (i = 0; i < CHANNELS; i = i+1) begin
               conf_descr[i*8*('h3A+'h08)+8*'h09 +:8*('h3A+'h08)] = {cdc_descr(i), ia_descr(i)};
            end
         end else begin
            conf_descr[8*'h09 +:8*'h3A] = cdc_descr('d0);
         end
      end
   endfunction

   // Configuration Descriptor (in reverse order)
   localparam [8*CDL-1:0] CONF_DESCR = conf_descr(0);

   localparam [2:0]       ST_IDLE = 3'd0,
                          ST_STALL = 3'd1,
                          ST_SETUP = 3'd2,
                          ST_IN_DATA = 3'd3,
                          ST_OUT_DATA = 3'd4,
                          ST_PRE_IN_STATUS = 3'd5,
                          ST_IN_STATUS = 3'd6,
                          ST_OUT_STATUS = 3'd7;
   localparam [1:0]       REC_DEVICE = 2'd0,
                          REC_INTERFACE = 2'd1,
                          REC_ENDPOINT = 2'd2;
   // Supported Standard Requests
   localparam [7:0]       STD_REQ_GET_STATUS = 'd0,
                          STD_REQ_CLEAR_FEATURE = 'd1,
                          STD_REQ_SET_ADDRESS = 'd5,
                          STD_REQ_GET_DESCRIPTOR = 'd6,
                          STD_REQ_GET_CONFIGURATION = 'd8,
                          STD_REQ_SET_CONFIGURATION = 'd9,
                          STD_REQ_GET_INTERFACE = 'd10;
   // Supported ACM Class Requests
   localparam [7:0]       ACM_REQ_SET_LINE_CODING = 'h20,
                          ACM_REQ_GET_LINE_CODING = 'h21,
                          ACM_REQ_SET_CONTROL_LINE_STATE = 'h22,
                          ACM_REQ_SEND_BREAK = 'h23;
   localparam [3:0]       REQ_NONE = 4'd0,
                          REQ_CLEAR_FEATURE = 4'd1,
                          REQ_GET_CONFIGURATION = 4'd2,
                          REQ_GET_DESCRIPTOR = 4'd3,
                          REQ_GET_DESCRIPTOR_DEVICE = 4'd4,
                          REQ_GET_DESCRIPTOR_CONFIGURATION = 4'd5,
                          REQ_GET_DESCRIPTOR_STRING = 4'd6,
                          REQ_GET_INTERFACE = 4'd7,
                          REQ_GET_STATUS = 4'd8,
                          REQ_SET_ADDRESS = 4'd9,
                          REQ_SET_CONFIGURATION = 4'd10,
                          REQ_DUMMY = 4'd11,
                          REQ_UNSUPPORTED = 4'd12;
   localparam [1:0]       POWERED_STATE = 2'd0,
                          DEFAULT_STATE = 2'd1,
                          ADDRESS_STATE = 2'd2,
                          CONFIGURED_STATE = 2'd3;

   localparam             BC_WIDTH = ceil_log2(1+`max('h12, `max(CDL, (CHANNELS>1) ? SDL : 0)));
   localparam [15:0]      CTRL_ENDPS = 16'h01;

   reg [2:0]              state_q, state_d;
   reg [BC_WIDTH-1:0]     byte_cnt_q, byte_cnt_d;
   reg [BC_WIDTH-1:0]     max_length_q, max_length_d;
   reg                    in_dir_q, in_dir_d;
   reg                    class_q, class_d;
   reg [1:0]              rec_q, rec_d;
   reg [3:0]              req_q, req_d;
   reg [7:0]              string_index_q, string_index_d;
   reg [1:0]              dev_state_q, dev_state_d;
   reg [1:0]              dev_state_qq, dev_state_dd;
   reg [6:0]              addr_q, addr_d;
   reg [6:0]              addr_qq, addr_dd;
   reg                    in_endp_q, in_endp_d;
   reg [3:0]              endp_q, endp_d;
   reg [7:0]              in_data;
   reg                    in_zlp;
   reg                    in_valid;
   reg [15:0]             in_toggle_reset, out_toggle_reset;

   wire                   rstn;
   wire [15:0]            in_toggle_endps, out_toggle_endps;

   assign configured_o = (dev_state_qq == CONFIGURED_STATE) ? 1'b1 : 1'b0;
   assign addr_o = addr_qq;
   assign stall_o = (state_q == ST_STALL) ? 1'b1 : 1'b0;
   assign in_data_o = in_data;
   assign in_zlp_o = in_zlp;
   assign in_valid_o = in_valid;
   assign in_bulk_endps_o = IN_BULK_ENDPS;
   assign out_bulk_endps_o = OUT_BULK_ENDPS;
   assign in_int_endps_o = IN_INT_ENDPS;
   assign out_int_endps_o = OUT_INT_ENDPS;
   assign in_toggle_reset_o = in_toggle_reset;
   assign out_toggle_reset_o = out_toggle_reset;
   assign in_toggle_endps = IN_BULK_ENDPS|IN_INT_ENDPS|CTRL_ENDPS;
   assign out_toggle_endps = OUT_BULK_ENDPS|OUT_INT_ENDPS|CTRL_ENDPS;

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         dev_state_qq <= POWERED_STATE;
      end else begin
         if (clk_gate_i) begin
            if (bus_reset_i)
              dev_state_qq <= DEFAULT_STATE;
            else if (in_ready_i | out_ready_i)
              dev_state_qq <= dev_state_dd;
         end
      end
   end

   assign usb_en_o = (dev_state_qq == POWERED_STATE) ? 1'b0 : 1'b1;
   assign rstn = rstn_i & ~bus_reset_i;

   always @(posedge clk_i or negedge rstn) begin
      if (~rstn) begin
         state_q <= ST_IDLE;
         byte_cnt_q <= 'd0;
         max_length_q <= 'd0;
         in_dir_q <= 1'b0;
         class_q <= 1'b0;
         rec_q <= REC_DEVICE;
         req_q <= REQ_NONE;
         string_index_q <= 'd0;
         dev_state_q <= DEFAULT_STATE;
         addr_q <= 7'd0;
         addr_qq <= 7'd0;
         in_endp_q <= 1'b0;
         endp_q <= 4'b0;
      end else begin
         if (clk_gate_i) begin
            if (in_ready_i | out_ready_i) begin
               byte_cnt_q <= 'd0;
               if (out_ready_i & out_err_i) begin
                  if (state_q != ST_STALL)
                    state_q <= ST_IDLE;
               end else if (out_ready_i & setup_i) begin
                  state_q <= ST_SETUP;
               end else if ((in_ready_i == 1'b1 &&
                             ((state_q == ST_SETUP) ||
                              (state_q == ST_OUT_DATA && in_req_i == 1'b0) ||
                              (state_q == ST_PRE_IN_STATUS && in_req_i == 1'b0) ||
                              (state_q == ST_IN_STATUS && in_data_ack_i == 1'b0) ||
                              (state_q == ST_OUT_STATUS && in_req_i == 1'b0 && in_data_ack_i == 1'b0))) ||
                            (out_ready_i == 1'b1 &&
                             ((state_q == ST_IN_DATA) ||
                              (state_q == ST_PRE_IN_STATUS) ||
                              (state_q == ST_IN_STATUS) ||
                              (state_q == ST_OUT_STATUS && out_valid_i == 1'b1)))) begin
                  state_q <= ST_STALL;
               end else begin
                  state_q <= state_d;
                  byte_cnt_q <= byte_cnt_d;
                  max_length_q <= max_length_d;
                  in_dir_q <= in_dir_d;
                  class_q <= class_d;
                  rec_q <= rec_d;
                  req_q <= req_d;
                  string_index_q <= (CHANNELS>1) ? string_index_d : 8'd0;
                  dev_state_q <= dev_state_d;
                  addr_q <= addr_d;
                  addr_qq <= addr_dd;
                  in_endp_q <= in_endp_d;
                  endp_q <= endp_d;
               end
            end
         end
      end
   end

   always @(/*AS*/addr_q or addr_qq or byte_cnt_q or class_q
            or dev_state_q or dev_state_qq or endp_q or in_data_ack_i
            or in_dir_q or in_endp_q or in_req_i or in_toggle_endps
            or max_length_q or out_data_i or out_toggle_endps
            or out_valid_i or rec_q or req_q or state_q
            or string_index_q) begin
      state_d = state_q;
      byte_cnt_d = 'd0;
      max_length_d = max_length_q;
      in_dir_d = in_dir_q;
      class_d = class_q;
      rec_d = rec_q;
      req_d = req_q;
      string_index_d = string_index_q;
      dev_state_d = dev_state_q;
      dev_state_dd = dev_state_qq;
      addr_d = addr_q;
      addr_dd = addr_qq;
      in_endp_d = in_endp_q;
      endp_d = endp_q;
      in_data = 8'd0;
      in_zlp = 1'b0;
      in_valid = 1'b0;
      in_toggle_reset = 16'b0;
      out_toggle_reset = 16'b0;

      case (state_q)
        ST_IDLE, ST_STALL : begin
        end
        ST_SETUP : begin
           if (out_valid_i) begin
              byte_cnt_d = byte_cnt_q + 1;
              case (byte_cnt_q)
                'd0 : begin // bmRequestType
                   in_dir_d = out_data_i[7];
                   class_d = out_data_i[5];
                   rec_d = out_data_i[1:0];
                   if (out_data_i[6] == 1'b1 || |out_data_i[4:2] != 1'b0 || out_data_i[1:0] == 2'b11)
                     req_d = REQ_UNSUPPORTED;
                   else
                     req_d = REQ_NONE;
                end
                'd1 : begin // bRequest
                   req_d = REQ_UNSUPPORTED;
                   if (req_q == REQ_NONE) begin
                      if (class_q == 1'b0) begin
                         case (out_data_i)
                           STD_REQ_CLEAR_FEATURE : begin
                              if (in_dir_q == 1'b0 && dev_state_qq != DEFAULT_STATE)
                                req_d = REQ_CLEAR_FEATURE;
                           end
                           STD_REQ_GET_CONFIGURATION : begin
                              if (in_dir_q == 1'b1 && rec_q == REC_DEVICE && dev_state_qq != DEFAULT_STATE)
                                req_d = REQ_GET_CONFIGURATION;
                           end
                           STD_REQ_GET_DESCRIPTOR : begin
                              if (in_dir_q == 1'b1 && rec_q == REC_DEVICE)
                                req_d = REQ_GET_DESCRIPTOR;
                           end
                           STD_REQ_GET_INTERFACE : begin
                              if (in_dir_q == 1'b1 && rec_q == REC_INTERFACE && dev_state_qq == CONFIGURED_STATE)
                                req_d = REQ_GET_INTERFACE;
                           end
                           STD_REQ_GET_STATUS : begin
                              if (in_dir_q == 1'b1 && dev_state_qq != DEFAULT_STATE)
                                req_d = REQ_GET_STATUS;
                           end
                           STD_REQ_SET_ADDRESS : begin
                              if (in_dir_q == 1'b0 && rec_q == REC_DEVICE)
                                req_d = REQ_SET_ADDRESS;
                           end
                           STD_REQ_SET_CONFIGURATION : begin
                              if (in_dir_q == 1'b0 && rec_q == REC_DEVICE && dev_state_qq != DEFAULT_STATE)
                                req_d = REQ_SET_CONFIGURATION;
                           end
                           default : begin
                           end
                         endcase
                      end else begin
                         if (dev_state_qq == CONFIGURED_STATE &&
                             ((out_data_i == ACM_REQ_SET_LINE_CODING) ||
                              (out_data_i == ACM_REQ_GET_LINE_CODING) ||
                              (out_data_i == ACM_REQ_SET_CONTROL_LINE_STATE) ||
                              (out_data_i == ACM_REQ_SEND_BREAK)))
                           req_d = REQ_DUMMY;
                      end
                   end
                end
                'd2 : begin // wValue LSB
                   case (req_q)
                     REQ_CLEAR_FEATURE : begin // ENDPOINT_HALT
                        if (!(rec_q == REC_ENDPOINT && |out_data_i == 1'b0))
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR : begin
                        if (CHANNELS > 1 && out_data_i <= CHANNELS)
                          string_index_d = out_data_i;
                        else if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_INTERFACE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_STATUS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_ADDRESS : begin
                        if (out_data_i[7] == 1'b0)
                          addr_d = out_data_i[6:0];
                        else
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_CONFIGURATION : begin
                        if (out_data_i == 8'd0)
                          dev_state_d = ADDRESS_STATE;
                        else if (out_data_i == 8'd1)
                          dev_state_d = CONFIGURED_STATE;
                        else
                          req_d = REQ_UNSUPPORTED;
                     end
                     default : begin
                     end
                   endcase
                end
                'd3 : begin // wValue MSB
                   case (req_q)
                     REQ_CLEAR_FEATURE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR : begin
                        if (out_data_i == 8'd1 && |string_index_q == 1'b0)
                          req_d = REQ_GET_DESCRIPTOR_DEVICE;
                        else if (out_data_i == 8'd2 && |string_index_q == 1'b0)
                          req_d = REQ_GET_DESCRIPTOR_CONFIGURATION;
                        else if (CHANNELS > 1 && out_data_i == 8'd3)
                          req_d = REQ_GET_DESCRIPTOR_STRING;
                        else
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_INTERFACE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_STATUS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_ADDRESS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     default : begin
                     end
                   endcase
                end
                'd4 : begin // wIndex LSB
                   in_endp_d = out_data_i[7];
                   endp_d = out_data_i[3:0];
                   case (req_q)
                     REQ_CLEAR_FEATURE : begin
                        if (!((rec_q == REC_ENDPOINT) &&
                              ((out_data_i[7] == 1'b1 && in_toggle_endps[out_data_i[3:0]] == 1'b1) ||
                               (out_data_i[7] == 1'b0 && out_toggle_endps[out_data_i[3:0]] == 1'b1))))
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR_DEVICE, REQ_GET_DESCRIPTOR_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR_STRING : begin
                     end
                     REQ_GET_INTERFACE : begin
                        if (!(out_data_i < 2*CHANNELS))
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_STATUS : begin
                        if (!(((rec_q == REC_DEVICE) && (|out_data_i == 1'b0)) ||
                              ((rec_q == REC_INTERFACE) && (out_data_i < 2*CHANNELS)) ||
                              ((rec_q == REC_ENDPOINT) &&
                               ((out_data_i[7] == 1'b1 && in_toggle_endps[out_data_i[3:0]] == 1'b1) ||
                                (out_data_i[7] == 1'b0 && out_toggle_endps[out_data_i[3:0]] == 1'b1)))))
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_ADDRESS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     default : begin
                     end
                   endcase
                end
                'd5 : begin // wIndex MSB
                   case (req_q)
                     REQ_CLEAR_FEATURE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR_DEVICE, REQ_GET_DESCRIPTOR_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR_STRING : begin
                     end
                     REQ_GET_INTERFACE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_STATUS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_ADDRESS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     default : begin
                     end
                   endcase
                end
                'd6 : begin // wLength LSB
                   max_length_d[`min(BC_WIDTH-1, 7):0] = out_data_i[`min(BC_WIDTH-1, 7):0];
                   case (req_q)
                     REQ_CLEAR_FEATURE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_CONFIGURATION : begin
                        if (out_data_i != 8'd1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR_DEVICE, REQ_GET_DESCRIPTOR_CONFIGURATION, REQ_GET_DESCRIPTOR_STRING : begin
                        if (BC_WIDTH < 8 && |out_data_i[7:`min(BC_WIDTH, 7)] == 1'b1)
                          max_length_d = {BC_WIDTH{1'b1}};
                     end
                     REQ_GET_INTERFACE : begin
                        if (out_data_i != 8'd1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_STATUS : begin
                        if (out_data_i != 8'd2)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_ADDRESS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     default : begin
                     end
                   endcase
                end
                'd7 : begin // wLength MSB
                   if (BC_WIDTH > 8)
                     max_length_d[BC_WIDTH-1:`min(8, BC_WIDTH-1)] = out_data_i[BC_WIDTH-1-`min(8, BC_WIDTH-1):0];
                   case (req_q)
                     REQ_CLEAR_FEATURE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_DESCRIPTOR_DEVICE, REQ_GET_DESCRIPTOR_CONFIGURATION, REQ_GET_DESCRIPTOR_STRING : begin
                        if (BC_WIDTH < 16 && |out_data_i[7:`min(`max(BC_WIDTH-8, 0), 7)] == 1'b1)
                          max_length_d = {BC_WIDTH{1'b1}};
                     end
                     REQ_GET_INTERFACE : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_GET_STATUS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_ADDRESS : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     REQ_SET_CONFIGURATION : begin
                        if (|out_data_i == 1'b1)
                          req_d = REQ_UNSUPPORTED;
                     end
                     default : begin
                     end
                   endcase
                end
                default : begin
                end
              endcase
           end else begin // Setup Stage EOP
              if (byte_cnt_q == 'd8) begin
                 if (req_q == REQ_UNSUPPORTED)
                   state_d = ST_STALL;
                 else if (in_dir_q == 1'b1) begin // Control Read Data Stage
                    state_d = ST_IN_DATA;
                 end else begin
                    if (max_length_q == 'd0) begin // No-data Control Status Stage
                       state_d = ST_PRE_IN_STATUS;
                    end else begin // Control Write Data Stage
                       state_d = ST_OUT_DATA;
                    end
                 end
              end else
                state_d = ST_STALL;
           end
        end
        ST_IN_DATA : begin
           byte_cnt_d = byte_cnt_q;
           if (byte_cnt_q == max_length_q ||
               (byte_cnt_q == 'h12 && req_q == REQ_GET_DESCRIPTOR_DEVICE) ||
               (byte_cnt_q == CDL[BC_WIDTH-1:0] && req_q == REQ_GET_DESCRIPTOR_CONFIGURATION) ||
               (byte_cnt_q == 'h04 && req_q == REQ_GET_DESCRIPTOR_STRING && CHANNELS > 1 && string_index_q == 'h00) ||
               (byte_cnt_q == SDL[BC_WIDTH-1:0] && req_q == REQ_GET_DESCRIPTOR_STRING && CHANNELS > 1 && string_index_q != 'h00 && string_index_q <= CHANNELS)) begin
              if (in_data_ack_i) // Control Read Status Stage
                state_d = ST_OUT_STATUS;
              else if (~in_req_i)
                state_d = ST_STALL;
           end else begin
              if (~in_req_i & ~in_data_ack_i)
                byte_cnt_d = byte_cnt_q + 1;
              case (req_q)
                REQ_GET_CONFIGURATION : begin
                   if (dev_state_qq == ADDRESS_STATE) begin
                      in_data = 8'd0;
                      in_valid = 1'b1;
                   end else if (dev_state_qq == CONFIGURED_STATE) begin
                      in_data = 8'd1;
                      in_valid = 1'b1;
                   end
                end
                REQ_GET_DESCRIPTOR_DEVICE : begin
                   in_data = DEV_DESCR[{byte_cnt_q[ceil_log2('h12)-1:0], 3'd0} +:8];
                   in_valid = 1'b1;
                end
                REQ_GET_DESCRIPTOR_CONFIGURATION : begin
                   in_data = CONF_DESCR[{byte_cnt_q[ceil_log2(CDL)-1:0], 3'd0} +:8];
                   in_valid = 1'b1;
                end
                REQ_GET_DESCRIPTOR_STRING : begin
                   if(CHANNELS > 1 ) begin
                      if (string_index_q == 8'd0) begin
                         in_data = STRING_DESCR_00[{byte_cnt_q[ceil_log2('h4)-1:0], 3'd0} +:8];
                         in_valid = 1'b1;
                      end else if (string_index_q <= CHANNELS) begin
                         if (byte_cnt_q == SDL-2) begin
                            in_data = STRING_DESCR_XX[{byte_cnt_q[ceil_log2(SDL)-1:0], 3'd0} +:8] + string_index_q;
                            in_valid = 1'b1;
                         end else if (byte_cnt_q <= SDL-1) begin
                            in_data = STRING_DESCR_XX[{byte_cnt_q[ceil_log2(SDL)-1:0], 3'd0} +:8];
                            in_valid = 1'b1;
                         end
                      end
                   end
                end
                REQ_GET_INTERFACE : begin
                   in_data = 8'd0;
                   in_valid = 1'b1;
                end
                REQ_GET_STATUS : begin
                   in_data = 8'd0;
                   in_valid = 1'b1;
                end
                default : begin
                   in_data = 8'd0;
                   in_valid = 1'b1;
                end
              endcase
           end
        end
        ST_OUT_DATA : begin
           if (in_req_i) // Control Write Status Stage
             state_d = ST_IN_STATUS;
        end
        ST_PRE_IN_STATUS : begin
           state_d = ST_IN_STATUS;
        end
        ST_IN_STATUS : begin
           byte_cnt_d = byte_cnt_q;
           in_zlp = 1'b1;
           in_valid = 1'b1;
           state_d = ST_IDLE; // Status Stage ACK
           case (req_q)
             REQ_SET_ADDRESS : begin
                addr_dd = addr_q;
                if (addr_q == 7'd0)
                  dev_state_dd = DEFAULT_STATE;
                else
                  dev_state_dd = ADDRESS_STATE;
             end
             REQ_CLEAR_FEATURE : begin
                if (in_endp_q == 1'b1)
                  in_toggle_reset[endp_q] = 1'b1;
                else
                  out_toggle_reset[endp_q] = 1'b1;
             end
             REQ_SET_CONFIGURATION : begin
                dev_state_dd = dev_state_q;
                in_toggle_reset = 16'hFFFF;
                out_toggle_reset = 16'hFFFF;
             end
             default : begin
             end
           endcase
        end
        ST_OUT_STATUS : begin
           if (~in_req_i & ~in_data_ack_i) begin // Status Stage EOP
              state_d = ST_IDLE;
           end
        end
        default : begin
           state_d = ST_IDLE;
        end
      endcase
   end
endmodule
//  USB 2.0 full speed IN/OUT BULK Endpoints.
//  Written in verilog 2001

// BULK_ENDP module shall implement IN/OUT Bulk Endpoints and
//   FIFO interface of USB_CDC module.
// While IN FIFO is not empty, when required by in_req_i, BULK_ENDP
//   shall source IN data.
// While OUT FIFO is not full, when OUT data is available, BULK_ENDP
//   shall sink OUT data.

module bulk_endp
  #(parameter IN_BULK_MAXPACKETSIZE = 'd8,
    parameter OUT_BULK_MAXPACKETSIZE = 'd8,
    parameter USE_APP_CLK = 0,
    parameter APP_CLK_FREQ = 12) // app_clk frequency in MHz
   (
    // ---- to/from Application ------------------------------------
    input        app_clk_i,
    input [7:0]  app_in_data_i,
    input        app_in_valid_i,
    // While app_in_valid_i is high, app_in_data_i shall be valid.
    output       app_in_ready_o,
    // When both app_in_ready_o and app_in_valid_i are high, app_in_data_i shall
    //   be consumed.
    output [7:0] app_out_data_o,
    output       app_out_valid_o,
    // While app_out_valid_o is high, the app_out_data_o shall be valid and both
    //   app_out_valid_o and app_out_data_o shall not change until consumed.
    input        app_out_ready_i,
    // When both app_out_valid_o and app_out_ready_i are high, the app_out_data_o shall
    //   be consumed.

    // ---- from USB_CDC module ------------------------------------
    input        clk_i,
    // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES
    input        rstn_i,
    // While rstn_i is low (active low), the module shall be reset
    input        clk_gate_i,
    // clk_gate_i shall be high for only one clk_i period within every BIT_SAMPLES clk_i periods.
    // When clk_gate_i is high, the registers that are gated by it shall be updated.
    input        bus_reset_i,
    // While bus_reset_i is high, the module shall be reset
    // When clk_gate_i is high, bus_reset_i shall be updated.

    // ---- to/from SIE module ------------------------------------
    output [7:0] in_data_o,
    // While in_valid_o is high, in_data_o shall be valid.
    output       in_valid_o,
    // While IN FIFO is not empty, in_valid_o shall be high.
    // When clk_gate_i is high, in_valid_o shall be updated.
    input        in_req_i,
    // When both in_req_i and in_ready_i are high, a new IN packet shall be requested.
    // When clk_gate_i is high, in_req_i shall be updated.
    input        in_ready_i,
    // When both in_ready_i and in_valid_o are high, in_data_o shall be consumed.
    // in_ready_i shall be high only for one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, in_ready_i shall be updated.
    input        in_data_ack_i,
    // When both in_data_ack_i and in_ready_i are high, an ACK packet shall be received.
    // When clk_gate_i is high, in_data_ack_i shall be updated.
    output       out_nak_o,
    // While out_valid_i is high, when OUT FIFO is full, out_nak_o shall be
    //   latched high.
    // When either out_valid_i or out_err_i is low and out_ready_i is high,
    //   out_nak_o shall be low.
    // When clk_gate_i is high, out_nak_o shall be updated.
    input [7:0]  out_data_i,
    input        out_valid_i,
    // While out_valid_i is high, the out_data_i shall be valid and both
    //   out_valid_i and out_data_i shall not change until consumed.
    // When clk_gate_i is high, out_valid_i shall be updated.
    input        out_err_i,
    // When both out_err_i and out_ready_i are high, SIE shall abort the
    //   current packet reception and OUT Bulk Endpoint shall manage the error
    //   condition.
    // When clk_gate_i is high, out_err_i shall be updated.
    input        out_ready_i
    // When both out_valid_i and out_ready_i are high, the out_data_i shall
    //   be consumed.
    // When out_valid_i and out_err_i are low and out_ready_i is high, the
    //   on-going OUT packet shall end (EOP).
    // out_ready_i shall be high only for one clk_gate_i multi-cycle period.
    // When clk_gate_i is high, out_ready_i shall be updated.
    );

   wire          rstn;
   wire          app_rstn;

   assign rstn = rstn_i & ~bus_reset_i;

   generate
      if (USE_APP_CLK == 0) begin : u_sync_app_rstn
         assign app_rstn = 1'b0;
      end else begin : u_async_app_rstn
         reg [1:0]     app_rstn_sq;

         assign app_rstn = app_rstn_sq[0];

         always @(posedge app_clk_i or negedge rstn) begin
            if (~rstn) begin
               app_rstn_sq <= 2'd0;
            end else begin
               app_rstn_sq <= {1'b1, app_rstn_sq[1]};
            end
         end
      end
   endgenerate

   in_fifo #(.IN_MAXPACKETSIZE(IN_BULK_MAXPACKETSIZE),
             .USE_APP_CLK(USE_APP_CLK),
             .APP_CLK_FREQ(APP_CLK_FREQ))
   u_in_fifo (.in_empty_o(),
              .in_full_o(),
              .in_data_o(in_data_o),
              .in_valid_o(in_valid_o),
              .app_in_ready_o(app_in_ready_o),
              .clk_i(clk_i),
              .app_clk_i(app_clk_i),
              .rstn_i(rstn),
              .app_rstn_i(app_rstn),
              .clk_gate_i(clk_gate_i),
              .in_req_i(in_req_i),
              .in_data_ack_i(in_data_ack_i),
              .app_in_data_i(app_in_data_i),
              .app_in_valid_i(app_in_valid_i),
              .in_ready_i(in_ready_i));

   out_fifo #(.OUT_MAXPACKETSIZE(OUT_BULK_MAXPACKETSIZE),
              .USE_APP_CLK(USE_APP_CLK),
              .APP_CLK_FREQ(APP_CLK_FREQ))
   u_out_fifo (.out_empty_o(),
               .out_full_o(),
               .out_nak_o(out_nak_o),
               .app_out_valid_o(app_out_valid_o),
               .app_out_data_o(app_out_data_o),
               .clk_i(clk_i),
               .app_clk_i(app_clk_i),
               .rstn_i(rstn),
               .app_rstn_i(app_rstn),
               .clk_gate_i(clk_gate_i),
               .out_data_i(out_data_i),
               .out_valid_i(out_valid_i),
               .out_err_i(out_err_i),
               .out_ready_i(out_ready_i),
               .app_out_ready_i(app_out_ready_i));

endmodule
//  USB 2.0 full speed Communications Device Class.
//  Written in verilog 2001

// USB_CDC module shall implement Full Speed (12Mbit/s) USB communications device
//   class (or USB CDC class) and Abstract Control Model (ACM) subclass.
// USB_CDC shall implement IN/OUT FIFO interface between USB and external APP module.

module usb_cdc
  #(parameter VENDORID = 16'h0000,
    parameter PRODUCTID = 16'h0000,
    parameter CHANNELS = 'd1,
    parameter IN_BULK_MAXPACKETSIZE = 'd8,
    parameter OUT_BULK_MAXPACKETSIZE = 'd8,
    parameter BIT_SAMPLES = 'd4,
    parameter USE_APP_CLK = 0,
    parameter APP_CLK_FREQ = 12) // app_clk frequency in MHz
   (
    input                   clk_i,
    // clk_i clock shall have a frequency of 12MHz*BIT_SAMPLES
    input                   rstn_i,
    // While rstn_i is low (active low), the module shall be reset

    // ---- to/from Application ------------------------------------
    input                   app_clk_i,
    output [8*CHANNELS-1:0] out_data_o,
    output [CHANNELS-1:0]   out_valid_o,
    // While out_valid_o is high, the out_data_o shall be valid and both
    //   out_valid_o and out_data_o shall not change until consumed.
    input [CHANNELS-1:0]    out_ready_i,
    // When both out_valid_o and out_ready_i are high, the out_data_o shall
    //   be consumed.
    input [8*CHANNELS-1:0]  in_data_i,
    input [CHANNELS-1:0]    in_valid_i,
    // While in_valid_i is high, in_data_i shall be valid.
    output [CHANNELS-1:0]   in_ready_o,
    // When both in_ready_o and in_valid_i are high, in_data_i shall
    //   be consumed.
    output [10:0]           frame_o,
    // frame_o shall be last recognized USB frame number sent by USB host.
    output                  configured_o,
    // While USB_CDC is in configured state, configured_o shall be high.

    // ---- to USB bus physical transmitters/receivers --------------
    output                  dp_pu_o,
    output                  tx_en_o,
    output                  dp_tx_o,
    output                  dn_tx_o,
    input                   dp_rx_i,
    input                   dn_rx_i
    );

   function integer ceil_log2;
      input [31:0] arg;
      integer      i;
      begin
         ceil_log2 = 0;
         for (i = 0; i < 32; i = i + 1) begin
            if (arg > (1 << i))
              ceil_log2 = ceil_log2 + 1;
         end
      end
   endfunction

   reg [1:0]        rstn_sq;

   wire             rstn;

   assign rstn = rstn_sq[0];

   always @(posedge clk_i or negedge rstn_i) begin
      if (~rstn_i) begin
         rstn_sq <= 2'd0;
      end else begin
         rstn_sq <= {1'b1, rstn_sq[1]};
      end
   end

   reg [ceil_log2(BIT_SAMPLES)-1:0] clk_cnt_q;
   reg                              clk_gate_q;

   always @(posedge clk_i or negedge rstn) begin
      if (~rstn) begin
         clk_cnt_q <= 'd0;
         clk_gate_q <= 1'b0;
      end else begin
         if ({1'b0, clk_cnt_q} == BIT_SAMPLES-1) begin
            clk_cnt_q <= 'd0;
            clk_gate_q <= 1'b1;
         end else begin
            clk_cnt_q <= clk_cnt_q + 1;
            clk_gate_q <= 1'b0;
         end
      end
   end

   localparam    CTRL_MAXPACKETSIZE = 'd8;
   localparam [3:0] ENDP_CTRL = 'd0;

   reg [7:0]        sie2i_in_data;
   reg              sie2i_in_valid, sie2i_out_nak;

   wire [3:0]       endp;
   wire [7:0]       ctrl_in_data;
   wire [8*CHANNELS-1:0] bulk_in_data;
   wire                  ctrl_in_valid;
   wire [CHANNELS-1:0]   bulk_in_valid;
   wire [CHANNELS-1:0]   bulk_out_nak;

   always @(/*AS*/bulk_in_data or bulk_in_valid or bulk_out_nak
            or ctrl_in_data or ctrl_in_valid or endp) begin : u_mux
      integer j;

      sie2i_in_data = ctrl_in_data;
      sie2i_in_valid = (endp == ENDP_CTRL) ? ctrl_in_valid : 1'b0;
      sie2i_out_nak = 1'b0;
      for (j = 0; j < CHANNELS; j = j+1) begin
         if (endp == 2*j[2:0]+1) begin
            sie2i_in_data = bulk_in_data[8*j +:8];
            sie2i_in_valid = bulk_in_valid[j];
            sie2i_out_nak = bulk_out_nak[j];
         end
      end
   end

   wire [6:0] addr;
   wire [7:0] sie_out_data;
   wire       sie_out_valid;
   wire       sie_in_req;
   wire       sie_out_err;
   wire       setup;
   wire [15:0] in_bulk_endps;
   wire [15:0] out_bulk_endps;
   wire [15:0] in_int_endps;
   wire [15:0] out_int_endps;
   wire [15:0] in_toggle_reset;
   wire [15:0] out_toggle_reset;
   wire        bus_reset;
   wire        sie_in_ready;
   wire        sie_in_data_ack;
   wire        sie_out_ready;
   wire        usb_en;
   wire        sie2i_in_zlp, ctrl_in_zlp;
   wire        sie2i_in_nak;
   wire        sie2i_stall, ctrl_stall;

   assign sie2i_in_zlp = (endp == ENDP_CTRL) ? ctrl_in_zlp : 1'b0;
   assign sie2i_in_nak = in_int_endps[endp];
   assign sie2i_stall = (endp == ENDP_CTRL) ? ctrl_stall : 1'b0;

   sie #(.IN_CTRL_MAXPACKETSIZE(CTRL_MAXPACKETSIZE),
         .IN_BULK_MAXPACKETSIZE(IN_BULK_MAXPACKETSIZE),
         .BIT_SAMPLES(BIT_SAMPLES))
   u_sie (.bus_reset_o(bus_reset),
          .dp_pu_o(dp_pu_o),
          .tx_en_o(tx_en_o),
          .dp_tx_o(dp_tx_o),
          .dn_tx_o(dn_tx_o),
          .endp_o(endp),
          .frame_o(frame_o),
          .out_data_o(sie_out_data),
          .out_valid_o(sie_out_valid),
          .out_err_o(sie_out_err),
          .in_req_o(sie_in_req),
          .setup_o(setup),
          .out_ready_o(sie_out_ready),
          .in_ready_o(sie_in_ready),
          .in_data_ack_o(sie_in_data_ack),
          .in_bulk_endps_i(in_bulk_endps),
          .out_bulk_endps_i(out_bulk_endps),
          .in_int_endps_i(in_int_endps),
          .out_int_endps_i(out_int_endps),
          .in_iso_endps_i(16'b0),
          .out_iso_endps_i(16'b0),
          .clk_i(clk_i),
          .rstn_i(rstn),
          .clk_gate_i(clk_gate_q),
          .usb_en_i(usb_en),
          .usb_detach_i(1'b0),
          .dp_rx_i(dp_rx_i),
          .dn_rx_i(dn_rx_i),
          .addr_i(addr),
          .in_valid_i(sie2i_in_valid),
          .in_data_i(sie2i_in_data),
          .in_zlp_i(sie2i_in_zlp),
          .out_nak_i(sie2i_out_nak),
          .in_nak_i(sie2i_in_nak),
          .stall_i(sie2i_stall),
          .in_toggle_reset_i(in_toggle_reset),
          .out_toggle_reset_i(out_toggle_reset));

   wire ctrl2i_in_req, ctrl2i_out_ready, ctrl2i_in_ready;

   assign ctrl2i_in_req = (endp == ENDP_CTRL) ? sie_in_req : 1'b0;
   assign ctrl2i_out_ready = (endp == ENDP_CTRL) ? sie_out_ready : 1'b0;
   assign ctrl2i_in_ready = (endp == ENDP_CTRL) ? sie_in_ready : 1'b0;

   ctrl_endp #(.VENDORID(VENDORID),
               .PRODUCTID(PRODUCTID),
               .CHANNELS(CHANNELS),
               .CTRL_MAXPACKETSIZE(CTRL_MAXPACKETSIZE),
               .IN_BULK_MAXPACKETSIZE(IN_BULK_MAXPACKETSIZE),
               .OUT_BULK_MAXPACKETSIZE(OUT_BULK_MAXPACKETSIZE))
   u_ctrl_endp (.configured_o(configured_o),
                .usb_en_o(usb_en),
                .addr_o(addr),
                .in_data_o(ctrl_in_data),
                .in_zlp_o(ctrl_in_zlp),
                .in_valid_o(ctrl_in_valid),
                .stall_o(ctrl_stall),
                .in_bulk_endps_o(in_bulk_endps),
                .out_bulk_endps_o(out_bulk_endps),
                .in_int_endps_o(in_int_endps),
                .out_int_endps_o(out_int_endps),
                .in_toggle_reset_o(in_toggle_reset),
                .out_toggle_reset_o(out_toggle_reset),
                .clk_i(clk_i),
                .rstn_i(rstn),
                .clk_gate_i(clk_gate_q),
                .bus_reset_i(bus_reset),
                .out_data_i(sie_out_data),
                .out_valid_i(sie_out_valid),
                .out_err_i(sie_out_err),
                .in_req_i(ctrl2i_in_req),
                .setup_i(setup),
                .in_data_ack_i(sie_in_data_ack),
                .out_ready_i(ctrl2i_out_ready),
                .in_ready_i(ctrl2i_in_ready));

   genvar i;

   generate
      for (i = 0; i < CHANNELS; i = i+1) begin : u_bulk_endps
         wire bulk2i_in_req, bulk2i_out_ready, bulk2i_in_ready;

         assign bulk2i_in_req = (endp == 2*i+1) ? sie_in_req : 1'b0;
         assign bulk2i_out_ready = (endp == 2*i+1) ? sie_out_ready : 1'b0;
         assign bulk2i_in_ready = (endp == 2*i+1) ? sie_in_ready : 1'b0;

         bulk_endp #(.IN_BULK_MAXPACKETSIZE(IN_BULK_MAXPACKETSIZE),
                     .OUT_BULK_MAXPACKETSIZE(OUT_BULK_MAXPACKETSIZE),
                     .USE_APP_CLK(USE_APP_CLK),
                     .APP_CLK_FREQ(APP_CLK_FREQ))
         u_bulk_endp (.in_data_o(bulk_in_data[8*i +:8]),
                      .in_valid_o(bulk_in_valid[i]),
                      .app_in_ready_o(in_ready_o[i]),
                      .out_nak_o(bulk_out_nak[i]),
                      .app_out_valid_o(out_valid_o[i]),
                      .app_out_data_o(out_data_o[8*i +:8]),
                      .clk_i(clk_i),
                      .app_clk_i(app_clk_i),
                      .rstn_i(rstn),
                      .clk_gate_i(clk_gate_q),
                      .bus_reset_i(bus_reset),
                      .out_data_i(sie_out_data),
                      .out_valid_i(sie_out_valid),
                      .out_err_i(sie_out_err),
                      .in_req_i(bulk2i_in_req),
                      .in_data_ack_i(sie_in_data_ack),
                      .app_in_data_i(in_data_i[8*i +:8]),
                      .app_in_valid_i(in_valid_i[i]),
                      .out_ready_i(bulk2i_out_ready),
                      .in_ready_i(bulk2i_in_ready),
                      .app_out_ready_i(out_ready_i[i]));
      end
   endgenerate
endmodule
