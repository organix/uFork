#
# Makefile
#

ALL =	phy_rx.v \
	phy_tx.v \
	sie.v \
	in_fifo.v \
	out_fifo.v \
	ctrl_endp.v \
	bulk_endp.v \
	usb_cdc.v

LIB =	usb_lib.v

all: $(LIB)

clean:
	rm -f $(LIB) *.sim

test: $(LIB)
	iverilog -o usb_lib.sim $(ALL)

usb_lib.v: $(ALL)
	cat $(ALL) >usb_lib.v
