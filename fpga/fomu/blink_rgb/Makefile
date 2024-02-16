#
# Makefile
#

TOP	= top

all: $(TOP).dfu

install: $(TOP).dfu
	dfu-util -D $<

clean:
	rm -f *.sim *.vcd *.json *.log *.asc *.bit *.dfu

%.sim: %_tb.v
	iverilog -o $@ $^

%.vcd: %.sim
	./$<

$(TOP).json: top.v
	yosys -p 'synth_ice40 -json $@' $^ >$(TOP).log

%.asc: %.json
	nextpnr-ice40 --up5k --package uwg30 --freq 48 --pcf pins.pcf --json $< --asc $@

%.bit: %.asc
	icepack $< $@

%.dfu: %.bit
	cp $< $@
	dfu-suffix -v 1209 -p 70b1 -a $@
