
forkmon protocol over serial datalink:

```
H>F  from host to fpga
F>H  from fpga to host

--- fpga out of reset and has loaded in bitstream from spi flash
F>H: uFork0V1\n
     uFork version 0.1 -- will probably changed with every version
F>H: <four digit hexnumber><space><another such>\n
     tells about how big quad memories, RAM and ROM respectively, are
F>H: ~
     command prompt, forkmon ready to accept commands

```

Commandset (from host to fpga):

 Command | Commpicture | Description
---------|-------------|--------------
 set t part of quad | H>F: t<hexnumber 4 digits><space><hexnumber 4 digits>\n | former number is the value and the latter is the quad address
 set x part of quad | H>F: x<hexnumber 4 digits><space><hexnumber 4 digits>\n | same
 set y part of quad | H>F: y<hexnumber 4 digits><space><hexnumber 4 digits>\n | same
 set z part of quad | H>F: z<hexnumber 4 digits><space><hexnumber 4 digits>\n | same
 step uFork runloop x many iterations onward | s<hexnumber 4 digits>\n | the number tells how many iterations of the loop should be run
 input for io device | H>F: i<henumber 4 digits>\n | datacell for input of uFork io device
 call wozmon | H>F: w\n | Call into wozmon if its part of the ucode image. Further serial comms will be with wozmon until it is quit

Eventset (from fpga to host):

 Event | Commpicture | Description
-------|-------------|-------------
 t part of quad set as value | F>H: t<hexnumber 4 digits><space><hexnumber 4 digits>\n | former number is the value and the latter is the quad address
 x part of quad set as value | F>H: x<hexnumber 4 digits><space><hexnumber 4 digits>\n | same
 y part of quad set as value | F>H: y<hexnumber 4 digits><space><hexnumber 4 digits>\n | same
 z part of quad set as value | F>H: z<hexnumber 4 digits><space><hexnumber 4 digits>\n | same
 uFork runloop iteration done | F>H: s\n | 
 output from uFork io device | F>H: o<hecnumber 4 digits>\n | the number is the datacell outputed by the uFork io device
 output from uFork debug device | F>H: d<hexnumber 4 digits>\n | the number is the datacell outputed by the uFork debug device
 ucode error occured | F>H: V<hexnumber 4 digits>\n | the number is the errorcode
 command prompt | F>H: ~ | forkmon ready for further commands
 
=====================================

Please note that the original following is mostly in Icelandic

forkmon samskiptastaðall yfir serial gagnatengingu:

```
V>F frá vél til fpga
F>V frá fpga til vélar

-- fpga úr reset og búinn að hlaða inn bitstream frá spi flash --
F>V: uFork0V1\n
     uFork útgáfa 0.1 -- verður líklega breytt með hverri útgáfu
     seigir eignig til um hvaða útgáfu af forkmon samskiptastaðli er í notkun
F>V: <fjagra stafa hextala><bil><önnur slík>\n
     seigir til um stærðir quad minnis RAM og ROM í þessari röð
F>V: ~
     skipanna prompt, forkmon tilbúinn til að taka við skipunum

```

Skipanasett (frá vél til fpga):

 Skipun | Samskiptamynd | Lýsing 
--------|---------------|--------
 setja t part af quad | V>F: t<hextala 4 stafir><bil><hextala 4 stafir>\n | fyrri talan er gildið og sú seinni quad vistfangið 
 setja x part af quad | V>F: x<hextala 4 stafir><bil><hextala 4 stafir>\n | sama
 setja y part af quad | V>F: y<hextala 4 stafir><bil><hextala 4 stafir>\n | sama
 setja z part af quad | V>F: z<hextala 4 stafir><bil><hextala 4 stafir>\n | sama
 skrefa uFork keyrslulykkju x margar ítranir áfram | V>F: s<hextala 4 stafir>\n | talan seigir til um hve margar ítranir á að keyra
 inntak fyrir io tæki | V>F: i<hextala 4 stafir>\n | gagnasella fyrir inntak uFork io tækis.
 ákalla wozmon | w\n | ef wozmon er hluti af ucode myndinni þá skipta yfir í hann með ákalli. Serial samskipti eru þá eftirleiðis við wozmon þar til hætt er í honum.

Atburðasett (frá fpga til vélar):

 Atburður | Samskiptamynd | Lýsing
----------|---------------|--------
 t partur af quad settur sem gildi | F>V: t<hextala 4 stafir><bil><hextala 4 stafir>\n | fyrri talan er gildið og sú seinni quad vistfangið 
 x partur af quad settur sem gildi | F>V: x<hextala 4 stafir><bil><hextala 4 stafir>\n | sama
 y partur af quad settur sem gildi | F>V: y<hextala 4 stafir><bil><hextala 4 stafir>\n | sama
 z partur af quad settur sem gildi | F>V: z<hextala 4 stafir><bil><hextala 4 stafir>\n | sama
 uFork keyrslulykkjuítrun lokið    | F>V: s\n |
 úttak frá uFork io tækinu         | F>V: o<hextala 4 stafir>\n | talan er gagnasellan sem útsett af uFork io tækinu
 úttak frá uFork debug io tækinu   | F>V: d<hextala 4 stafir>\n | talan er gagnasellan útsett af uFork debug tækinu
 ucode villa kom upp               | F>V: V<hextala 4 stafir>\n | talan er villukóðinn
 skipanna prompt                   | F>V: ~ | forkmon tilbúinn til að taka við frekari skipunum
