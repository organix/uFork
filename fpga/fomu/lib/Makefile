#
# Makefile
#

ALL =	led_freq.vcd \
	serial_tx.vcd \
	serial_rx.vcd \
	serial_rx+tx.vcd \
	lifo8x8.vcd

all: $(ALL)

clean:
	rm -f *.sim *.vcd *.json *.log *.asc *.bit *.dfu abc.history

%.sim: %_tb.v
	iverilog -o $@ $^

%.vcd: %.sim
	./$<

%.json: %_top.v
	yosys -p 'synth_ice40 -json $@' $^ >yosys.log

%.asc: %.json
	nextpnr-ice40 --up5k --package uwg30 --freq 48 --pcf pins.pcf --json $< --asc $@

%.bit: %.asc
	icepack $< $@

%.dfu: %.bit
	cp $< $@
	dfu-suffix -v 1209 -p 70b1 -a $@
	dfu-util -D $@
