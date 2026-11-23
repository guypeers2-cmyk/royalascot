# De twee vrije stroken · uitgave 17

De scheidslijnen en de voeten van de rails zijn twee verschillende dingen. Van binnen naar buiten ligt er nu **½ + 1 + 1 + 1 + 1 + 1 + 1 + ½ baan**. Alleen de zes hele banen zijn genummerd. Het zijn dus geen acht startplaatsen. Van de rand van baan 1 naar de binnenrail en van de rand van baan 6 naar de buitenrail ligt telkens **4,715 cm** op de speeltafel. De stroken lopen door over de finish en rond beide koppen van de ovaal. Een baan is 9,429 cm, zes banen zijn samen 56,575 cm, en de totale breedte tussen de raildatums is 66,005 cm. De 3,40 m lange rechte stukken en de buitenmaat van de kast veranderen niet.

## Wat de camera doet

- **Rail panorama** gebruikt een vaste brandpuntsafstand per beschikbare kijkruimte. Een pin verschuift het accent, niet de lens. Kadrering gebeurt op de gedrukte silhouetten van alle zes combinaties, rekening houdend met het koersbord, de tickets en de bediening. Slepen is begrensd. Waar de foto niet tot de rand van het scherm reikt, komt er een donkere lijst, geen uitgerekte tweede piste.
- **Long-side seat** houdt vanuit dezelfde zitplaats beide bochten in het overzicht. Bij een pin draait het hoofd gedeeltelijk naar de gekozen draver; de andere dravers blijven de kadrering begrenzen. Vrij rondkijken blijft een bewuste handeling. De achtergrond, de figuren en de klikposities gebruiken dezelfde projectie.
- **Action cam** kiest op basis van gemeten koersposities een duel of uitval. De 3D-lens richt op een punt **langs de baan**, ook bij de overgang van ronde vier naar de uitloop. Ze kijkt schuin van opzij in plaats van vóór het span de bocht uit te schieten. De fotografische variant gebruikt de echte voet- en wieluitsneden. De klok en de aankomstvolgorde zijn onafhankelijk van de camera.
- De **kaart** toont de twee randen van het racegedeelte én de twee rails. De stip en het spoor volgen de gereden lijn; leesbare nummerplaatjes mogen wijken, de paarden niet. **Orbit** blijft de vrij draaibare maquette. Het rennende **Console**-overzicht, de **Satellite floor**, de zes boxen en de aparte officiële finishlens gebruiken ook de nieuwe baanregistratie. De finishfoto blijft een vaste dwarsopname en neemt de gekozen camera niet over.

## Bocht, draf en tuig

De getekende baanrand blijft een ovaal. De rijdende figuren gaan geleidelijk van de rechte lijn naar een gebogen traject; snelheid en richting springen niet op de raakpunten. De achteras loopt op dezelfde lijn, op een **vaste koordlengte** achter het paard. Wielomwenteling en draf zijn gekoppeld aan de werkelijk afgelegde weg in de eigen baan. Paard en menner hellen in 3D licht mee met de bocht. De zijfilm vereffent ook de snelheid tussen de afzonderlijk gekalibreerde delen van de foto; aangrenzende draaiopnamen worden aan hetzelfde paardpunt geregistreerd.

Linksvoor en rechtsachter doorlopen nu dezelfde hoefbaan ten opzichte van hun eigen aanzet; rechtsvoor en linksachter doen dat een halve cyclus later. Reikwijdte, zweefhoogte, afrollen en terugnemen worden gedeeld. Alleen de correctie voor de vorm van het hoefijzer verschilt. **Niet de rugwaartse sprong omkeren**: de achterknie en sprong vormen een andere keten dan schouder en voorknie. De stap naar de box en het stilstaan blijven aparte bewegingen.

Op de nieuwe opnamen zitten een hoofdstel met bakstukken en bitringen, een rugkussen en staartstuk, gespen, twee leidsels en de snelkoppeling van de bomen. Die details zitten op de maquette, niet op een HUD. De zes paardenfiches, de stap en de nieuwe drafopnamen komen uit dezelfde studio als de 3D-figuren.

## Referenties en controle

- [USTA, *Planning a Five-Eighths-Mile Track*](https://cds.ustrotting.com/www/fairs/documents/TrackSpecsFiveEighths.pdf): uniforme baanbreedte en geleidelijke overgang naar de bocht. Onderbouwing voor de beweging; de speeltafel is geen reglementaire hippodroom.
- [Clayton & Van Weeren, *Performance in equestrian sports*](https://veteriankey.com/performance-in-equestrian-sports/): de diagonale draf en de verschillende anatomische aanzetten. Het exact delen van de hoefbaan is hier een keuze voor de gevraagde animatie, geen anatomische gelijkstelling.
- [Standardbred Canada, *Trainer Guide — Equipment*](https://standardbredcanada.ca/sites/default/files/sc-trainer-guide-equipment.pdf): hoofdstel, bit, tuig, crupper en quick hitch. [USTA, *Equipped for racing*](https://fanguide.ustrotting.com/equipped-for-racing.cfm): positie en uitrusting van een koerscombinatie. De modellen en filmstroken zijn eigen werk; geen foto is overgenomen.

`tests/apron.test.cjs` meet strookbreedten, raakpuntsnelheid, koordlengte en diagonale hoeven. `tests/racebike.test.cjs` controleert het **gemodelleerde** wielstel op 1.537 posities per baan. `tests/field-optics.browser.cjs` meet projecties in de uiteindelijke browser en trekt zichtbare panelen af. `tests/negative.browser.cjs` kan de geregistreerde pixels vergelijken met een echte oudere bronboom. Oudere biljetten behouden hun eigen koerswet en afdruk; een nieuw spel gebruikt filmstock 17.
