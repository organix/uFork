
Please note that this is mostly in Icelandic. It will be translated.

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
