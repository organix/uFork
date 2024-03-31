
Please note that this is mostly in Icelandic. It will be translated.

forkmon samskiptastaðall yfir serial gagnatengingu:

```
V>F frá vél til fpga
F>V frá fpga til vélar

-- fpga úr reset og búinn að hlaða inn bitstream frá spi flash --
F>V: uFork1V0\n
     uFork útgáfa 1.0 -- verður líklega breytt með hverri útgáfu
     seigir eignig til um hvaða útgáfu af forkmon samskiptastaðli er í notkun
F>V: <fjagra stafa hextala><bil><önnur slík>\n
     seigir til um stærðir quad minnis RAM og ROM í þessari röð
F>V: ~
     skipanna prompt, forkmon tilbúinn til að taka við skipunum

```

Skipanasett:

 Skipun | Samskiptamynd | Lýsing 
--------|---------------|--------
 setja t part af quad | t<bil><hextala 4 stafir><bil><hextala 4 stafir>\n | fyrri talan er gildið og sú seinni quad vistfangið |

