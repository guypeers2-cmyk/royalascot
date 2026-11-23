# Long Course · keuringskaart van Station 07

**Hoe lees je een veld van zes paarden, plaats je zes tickets en vind je veertig uitslagen terug op een telefoon van 320 pixels breed?** Niet door een bureaublad te verkleinen. De console toont op klein glas één taak per keer. De bladzijden wisselen; de inzetknoppen blijven staan.

Deze kaart beschrijft de uitgevoerde wijzigingen aan de speelbare kast. De twintig onderstaande disciplines zijn **virtuele beoordelingsrollen**: geen ingehuurde personen, keurmerk of claim van bekroningen.

## Van de startbox tot de meetlijn

- Elk recht stuk is **3,40 modelmeter**, voorheen 2,10. Daardoor is een ronde langs het midden van de piste **9,94 m** in plaats van 7,34 m. De totale breedte van de zes banen blijft 0,5964 m. Start en finish liggen op de overgang van het rechte stuk naar de rechterbocht. Het gaat om de maten van dit spel, niet om een opmeting van een originele machine.
- Met **Start race** staan de zes miniaturen meteen in hun box. Gedurende **3,000 seconden** blijven voeten, slede en deuren stil. Bij automatisch sluiten van de inzet is er eerst zeven seconden aanloop. Bij de release gaan de deuren open; als het geluid aanstaat klinkt dan ook de bel. De keuze van de speler blijft gelden. Zonder handmatige keuze is *Rail close-up* het koersbeeld. Er is geen verplichte frontcamera meer.
- Onderweg volgt de pas de **werkelijk afgelegde afstand per baan**, ook op de buitenbocht en bij versnellen. Een aparte belaste stand voorkomt dat een wachtend paard er uitziet als een stilgezette galopsprong. Bij verminderde beweging blijven de paarden hun echte baanposities volgen, met minder animatie.
- In **Satellite floor** zitten zeven afgebeelde spelers aan de overzijde. In **Cabinet orbit** hebben tien van de zestien satellieten een zittende speler. Dat is aankleding van de kast; het deelnemersveld blijft zes paarden en het spel blijft lokaal voor één speler.

## Twintig beslissingen over de layout

| Nr. | Perspectief | Beslissing aan de kast |
|---:|---|---|
| 01 | Lay-outregie | Eén station voor venster én volledig scherm. Een half ingevuld ticket, de geselecteerde paarden en het saldo verhuizen niet naar een kopie. |
| 02 | CSS-grid | De baan krijgt de overblijvende ruimte. Statusstrook en bediening hebben een eigen rij; bij een breed scherm komt de monitor naast de baan. |
| 03 | Containermaatvoering | De beschikbare glasbreedte, hoogte en lettermaat bepalen of veld, dossier en tickets naast elkaar passen. Een lage tablet met grote letters krijgt bladzijden vóór de annuleerknop in de knel komt. |
| 04 | Smalle portretstand | Op het kleinste inzetglas maakt de onderste balk plaats. Het menuknopje bovenaan houdt koerskaart, tickets, geschiedenis en hulp bereikbaar. |
| 05 | Lage landschapsstand | Slip en kassa staan naast het leesvlak. Op het korte glas staat bijvoorbeeld **#6 + #4**; beide namen blijven op de koerskaart en het ticket leesbaar. |
| 06 | Typografie | Paardennaam en prijs zijn apart gezet. Een langere naam mag afbreken; een volgende regel vergroot de rij in plaats van achter een andere rij te verdwijnen. |
| 07 | Informatiehiërarchie | Onder elk miniatuur staan FIT, STA, SPR en PAC met hun **getal**. Het dossier geeft de volledige betekenis: conditie, startstamina, sprintsnelheid en tempo. |
| 08 | Datakleur | Scores en percentages delen de schaal **0 rood → 50 oranje → 100 groen**. Het cijfer blijft staan. Niet opgenomen gegevens krijgen een streepje, geen misleidende nul. |
| 09 | Veld- en koerskaarten | De zes paarden blijven via echte paginaknoppen bereikbaar. De foto behoudt haar verhoudingen en verdringt de naam of selectie niet. |
| 10 | Formulierontwerp | Het bekijken of uitvergroten van het tweede paard van een Quinella verandert de gekozen combinatie, prijs of inzet niet. |
| 11 | Kassabediening | Inzet, annulering en terugbetaling delen één saldo. Een inzetbevestiging verschijnt in de titelregel van het inzetglas, niet als tekstblok boven de laatste rij of de plaatsknop. |
| 12 | Paginering | Een bladzijde wordt samengesteld uit de **gemeten, volledige rijen**. Ook tickets met twee paarden krijgen hun natuurlijke hoogte. Een verborgen schuifbalk geldt niet als oplossing. |
| 13 | Koersmonitor | Volgorde, commentaar, tickets en paardenbestanden hebben eigen knoppen. Elke helft van een paarticket kan apart worden gevolgd; stamina toont een getal én een balk. |
| 14 | Rondetelling | **LAP n / 4** volgt de leider van de eerste tot de laatste ronde. De monitor behoudt de telling op korte schermen; een individueel dossier toont de ronde van dat paard. |
| 15 | Uitslagontwerp | De uitslag vermeldt echte plaats, tijd, splits, ratings bij de start en betaalde tickets. De winstkans van vóór de start verdwijnt. *Station win rate* en *Ticket win rate* zijn behaalde percentages met een teller en noemer. |
| 16 | Archief en dialogen | Een volle lijst van veertig koersen krijgt pagina’s. Vanuit een koers ga je rechtstreeks naar foto, klassering, ratings, splits, stamina of tickets. Terug brengt je naar de vorige archiefpagina. |
| 17 | Aanraakinteractie | Lang indrukken inspecteert zonder te wedden. Op een gewone telefoon blijven de twee knoppen van een live dubbel ticket afzonderlijke doelwitten. |
| 18 | Toetsenbord en focus | Enter, pijltjes, Home en End bedienen het cameramenu. Na het sluiten van een dialoog kan de speler verder op de bedieningsplek waar die begon. Het station erachter is niet tegelijk actief. |
| 19 | Camerakader en beeldverhouding | Het overzicht en de finishfoto worden niet uitgerekt om een staand scherm te vullen. De bedieningsknoppen staan buiten de getekende paarden; het fotoarchief gebruikt het oorspronkelijke kader. |
| 20 | Integratiecontrole | De eindcontrole combineert volle lijsten, vergrote tekst, handmatige camerakeuze, de vier rondewissels, volledig scherm en afrekenen. Een passende lege kaart is niet voldoende. |

## Wat is er getest?

**Negen vensters in Chromium**, in CSS-pixels. 125% betekent hier een basisletter van 20 in plaats van 16 px. Dat is een test van tekstvergroting, niet van iedere browserzoom of alle combinaties van systeemletters.

| Staand | Liggend en desktop |
|---|---|
| 320 × 568 · 125% | 568 × 320 · 125% |
| 390 × 844 · 100% | 667 × 375 · 100% |
| 768 × 1024 · 100% | 812 × 375 · 125% |
| | 1024 × 600 · 125% |
| | 1366 × 768 · 100% |
| | 1920 × 1080 · 100% |

`tests/long-course.browser.cjs` opent pagina’s met de echte knoppen, tot en met paard zes, ticket zes en archiefkoers veertig. Het vergelijkt inhoudsmaat met paneelmaat en controleert of zichtbare bediening binnen venster en afsnijdende panelen valt. Aanvullende tests bedienen het spel met toetsen, muis en een gesimuleerde lange aanraking, draaien het scherm en volgen vanuit dezelfde stoel een volledige ronde. Volledig scherm is zowel als browserfunctie als in de ingebouwde terugvalstand getest.

**Drie afzonderlijke controles:**

1. **Model en kassa.** 46 automatische model- en regressietests, inclusief de start op 2,9999 s, herladen tijdens het wachten, de afstand per pas en oude betaalde races. De balansproef met 6.000 openingsvelden geeft eerste aankomsten tussen **127,46 en 138,52 s** na de release. Langere rechte stukken verlengen het wedstrijdschema dus niet.
2. **Finishfoto.** In de vaste proefkoers met seed 126 wint Waregem Flyer op **135,364518 s**, 0,17 s voor Silver Birch. Met dezelfde meetmarkering zijn de RGBA-pixels van het livebeeld en het gereconstrueerde beeld op 1280 × 720 identiek. Een versie-1-opname in de nieuwe kijker geeft ook exact dezelfde pixels als in de vorige versie. Een oude koers zónder opname krijgt geen bedachte foto.
3. **Aflevering.** De zelfstandige HTML bevat de afbeeldingen, lettertypen, code en geluidssynthese. De offlineproef blokkeert HTTP(S) in een iframe zonder opslagrechten. De uploadproef laadt uitgepakte bestanden onder een subpad, opent de echte WebGL-kast, herlaadt tijdens de koers en controleert na de uitslag opnieuw het saldo. Vier proeftickets: **500 → 455** na inzetten, **250** bruto terug, **705** eindstand, ook na herladen.

**Reikwijdte.** Deze controles zijn geen apparaatcertificering of volledige toegankelijkheidsaudit. Er is niet op een fysieke iPhone, met iedere schermlezer of in iedere browser getest. WebGL kan op een toestel ontbreken: de baankaart blijft dan beschikbaar. Zonder opslagrechten blijft de speelsessie werken, maar kan de volgende sessie de vorige niet terughalen. Er is niets op afstand gepubliceerd.
