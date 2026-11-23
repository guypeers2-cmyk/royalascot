# Koerssulky · uitgave 16

**Opgevolgd door [Panorama · v17](panorama.md):** identieke zes baanbreedtes, met een halve extra baan aan weerszijden. Onderstaande maten en fotoverwijzingen beschrijven v16.

De menner zit achter de draver, met de rug achterover en de hakken vooruit. De knieën blijven licht gebogen: het onderbeen loopt naar de voetensteun, niet naar de grond. De laarzen steunen **binnen** de beide lamoenbomen; ze blijven op hun steun wanneer de schouders iets meeveren. De handen houden twee afzonderlijke leidsels vast.

## Wat is nagekeken?

- [Harness Racing Australia · Sulky & Sulky Wheel Standard, §§3–8](https://hra.harness.org.au/hra/sulky-standard.pdf): symmetrische tweewieler met stoel, twee bomen en voetensteunen aan de binnenzijde. Daar geldt 1,20–1,30 m totale breedte en 600–645 mm wieldiameter; spaakwielen hebben aan weerszijden een afdekking. De verhouding wieldiameter/buitenbreedte in deze maquette is 0,487. Het is een speelmodel, geen wedstrijdkeuring.
- [Maryland · COMAR 09.10.02.36](https://regs.maryland.gov/us/md/exec/comar/09.10.02.36): boog, twee vorken, vaste beklede zit en stijgbeugels. Het kleine hoogteverschil tussen haksteun en zitvlak is een nuttige referentie voor een gestrekte zithouding. Regionale maatvoorschriften zijn niet identiek.
- [Finntack · R6 QH main frame](https://finntack.com/eu/carts/finntack-r6-qh-sulky-main-frame-for-steel-shafts): zit en zitbescherming, zijbuizen tussen wielen en bomen, verschillende framehoogten en boomlengten. [Zijaanzicht in koers](https://equineinfoexchange.com/articles/harness-racing) als controle op houding en silhouet. Dit model is zelf gebouwd; geen foto is als textuur overgenomen.

De twee gevorkte wielsteunen verbinden de naaf met een gebogen bovenstuk. Een paar zijbuizen en diagonale schoren sluiten aan op de dubbele bomen en het borsttuig. Aan elke kant zitten band, velg, zestien spaken, een naafkap en twee transparante schijven. De voetensteunen zitten met beugels aan de bomen, niet aan een onzichtbare dwarsas. De wielen rollen op afgelegde afstand. Voor de echte spelaanzichten zijn nieuwe opnamen gemaakt: zes fiches, zes stilstaande stellen, stap naar het vertrek, 28 kijkrichtingen × 12 drafstanden en twee HD-flanken.

## Gemeten op de speeltafel

| Grootheid | Meting |
|---|---:|
| Sulky, buitenkant naaf tot buitenkant naaf | 7,858 cm |
| Elk van de zes banen | 9,429 cm = 1,2 × sulky |
| Vrij links én rechts op de rechte baan | 0,786 cm per kant |
| Zes banen samen | 56,575 cm |
| Hoogte middenveldbord, bovenkant zonder afwerklijst | 11,5 cm (was 26,8 cm) |

Alle nieuwe startkaarten gebruiken de exacte baanmiddens. De as volgt de bocht op dezelfde lijn als het paard, op een vaste koordlengte. Over 1.537 posities per baan blijft zelfs de conservatieve rechthoek rond band **én** naaf meer dan 5 mm van de baanrand. De twee steunwielen van ieder buitenframe van het starthek blijven achter de meetlijn. Het bord draagt zes cijfers, van links naar rechts op werkelijke doorkomst. De satellietschermen, de racemonitor en de officiële lijst blijven afzonderlijke informatiedragers.

Nieuwe sprintseconden kosten **één procentpunt FIT**; sparen kost nog 0,025. STA heeft zijn eigen rekening: drie punten per sprintseconde. Beide stoppen bij de individuele finish. Voor reeds verkochte kaarten en hun finishfoto blijft de oude wet gelden. De resultaten van de balansproef staan in het [spelhandboek](../README.md#play-the-sulky-edition).

**Reproductie.** `node --test tests/racebike.test.cjs tests/sulky-bays.test.cjs tests/stewards.test.cjs` meet het gerenderde frame, de wielen, stilstand en bocht, de zichtlijn en beide klokken. `node tools/check_balance.cjs` vergelijkt stijlen en ritmes op gelijke formeloten. `tools/bake_carriers.cjs` en `tools/bake_mattes.py` maken de figuurfilms; `python tools/harness_track.py /pad/naar/v15/assets` drukt in een volledige werkkopie de nieuwe baanplaten uit de oorspronkelijke studiobronnen. `tests/negative.browser.cjs` vergelijkt de nieuwe passage en de oude ontwikkelde foto op beeldpixels.
