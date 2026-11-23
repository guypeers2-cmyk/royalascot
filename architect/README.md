# @architect · Sessieboek

Een overdraagbare werkmethode voor chatbotverbetering. Vierentwintig **virtuele specialismen**, geen gelijktijdig draaiende modellen of ingehuurde mensen. De planner helpt vooral bij de vraag **wanneer niet te paralleliseren**. Het spel Royal Ascot is een ingevuld voorbeeld; de methode heeft geen spelcode nodig.

## Vandaag gebruiken

1. Open `index.html` (ook offline). Het standaardpatroon *Ascot · WebGL & 3D-renderstudio* koppelt vier nieuwe vakrollen (21–24) aan bronnenonderzoek, materialen, camera/paneel en renderbudget. De onafhankelijke toetser en release-eigenaar bewaken de races en de offline oplevering. Of kies *Chatbot sneller maken*, *Onderzoek vergelijken*, *Direct antwoord* of *Ascot: deelblokkade*.
2. Vervang het doel, stel een sessie- en aanroepenlimiet in, bewerk desgewenst de taken. Geef ieder product één eigenaar en één toets. Een afhankelijkheid is een benodigde input, niet “ik wil eerst iedereen horen”.
3. Kopieer de briefing naar je eigen chatbot, of verdeel de werkpakketten met de hand. Zonder echte sessie-API gebruik je de rollen **sequentieel**. Het werkboek roept niets aan. In een preview zonder klembordrechten: selecteer de briefing en kopieer handmatig.
4. Exporteer het plan om het te bewaren. De pagina slaat je werk niet op en verstuurt geen tekst. Open het blad *Meetplan* voor het productie-experiment. De cijfers van de lokale proef gaan niet over modelkwaliteit of een live dienst.

## Lokale referentieregie (Python 3.10+, geen afhankelijkheden)

```sh
python dispatch.py --check architect-plan.json   # valideer alleen een geëxporteerd plan
python dispatch.py --demo onderzoek              # alleen de vaste testadapter
python dispatch.py --demo ascot                  # één geblokkeerde tak, onafhankelijke taken gaan door
python dispatch.py --bench 24                    # lokale gepaarde proef als JSON
python -m unittest -v test_dispatch.py
python build.py                                  # reproduceer index.html uit template en JSON
```

`roles.json`: opdrachten, opleverstukken en toetsen voor 24 rollen. `presets.json`: vijf werkpatronen, inclusief de Ascot-renderstudio. `bench.json`: echte monotone tijden van de **kunstmatige wachttijdproef**, inclusief alle ruwe runs. `workbook.tmpl`: bron van het zelfstandig HTML-werkboek. Herbouw na een wijziging in de gegevens.

## Grens van de referentie

`await run(plan, adapter)` is een echte begrensde async-regisseur. Hij valideert de taakgraaf, unieke outputs, limieten en voorgangers, geeft voorrang aan de langste resterende keten (optioneel `estimate_ms`, anders gelijke gewichten), start vanaf de eerste beschikbare plek en laat afhankelijke taken wachten op hun eigen inputs (geen groepsbarrière). Een vereiste fout blokkeert de tak; een optionele input geeft zijn status door aan de samenvoeger. Toestemming/`approval` wordt niet uitgevoerd. De standaardadapter wacht kunstmatig en maakt een deterministische vingerafdruk, **geen inhoudelijk antwoord**. Taken exporteren naar een echte provider vereist eigen toegangsrechten en een aparte adapter; er is geen platformwijziging, modeltraining of hosted agentdienst geïnstalleerd.

De adapter ontvangt `{id, role, mode, goal, out, check, objective, inputs}`. Geef een **korte tekst met bewijsverwijzingen** terug, niet de hele conversatie. Vertaal alleen aantoonbaar tijdelijke, leesbare fouten naar `TransientRead`. `out` is een productsleutel, geen pad dat de dispatcher opent. Werk binnen het toegewezen product, respecteer annulering en breng per tool de benodigde autorisatie aan. Een terugkerende tekst is geen bewijs van semantische juistheid: de acceptatietoets hoort bij de evaluator. De trace registreert ID, duur en status, niet het verzoek. De resultaten zelf kunnen privé zijn; sla of verzend ze alleen met de juiste toestemming.

**Productie vóór aansluiting:** voeg per gebruiker privacy-isolatie, versiesleutels, geautoriseerde invoer, provider-quota, harde token-/geldmaxima en persistentie van goedgekeurde overdrachten toe. Maak toolwrites idempotent, laat ze afzonderlijk bevestigen en controleer de status na een onduidelijke fout. De referentie voert geen echte tools uit, slaat geen sessies duurzaam op en biedt geen garantie dat een niet-coöperatieve externe API na annuleren stopt. Er is geen productiecache en geen automatische publicatie.

## Meetprotocol voor de eigen chatbot

- Leg vóór A/B vast: huidige versie, gewenste verbetering, toegestane kwaliteitsmarge, kostenplafond, ernstige fouten die altijd blokkeren. Gebruik echte, toegestane vragen of synthetische varianten met vergelijkbare moeilijkheid. Maak vooraf een blinde rubric (0/1 per noodzakelijk feit, bron en afgeronde actie).
- Neem per taaktype gepaarde runs in afwisselende volgorde. Houd model/temperature, toolantwoord, gelijktijdige belasting, regio en promptversie bij. Splits koude en warme cache. Gebruik een onafhankelijke hold-out; deel de antwoorden niet met de uitvoerders.
- Log `request_id`, `variant`, `class`, monotone `arrived`, `first_useful`, `done`, queue/tool/model/merge-duur, tokens, toolcalls, kosten, geslaagd/geweigerd/timeout. **TTFU** = first_useful − arrived, niet de eerste beleefdheidszin. Kosten per succes = alle kosten, inclusief mislukte pogingen, gedeeld door geaccepteerde uitkomsten. Rapporteer timeouts apart én als mislukking, geen survivor bias.
- Toon n, p50/p95 en onzekerheid per klasse; bootstrap gepaarde verzoeken in plaats van losse tokens. p95 met weinig gevallen is instabiel. Bij geen significante beslisruimte méér meten, niet de beste losse run uitkiezen. Test herstel, privégrenzen en weigeringen apart. Pas na een geslaagde proef een kleine, geautoriseerde canary met terugrol starten.

## Wat de ingebouwde vergelijking daadwerkelijk meet

Twee onafhankelijke proeflezingen (65 en 55 ms) → toets (15 ms) → antwoord (10 ms). Met cap 1 is de ideale wachttijd 145 ms; met cap 2 is het kritieke pad 90 ms. Een opwarmingspaar telt niet mee; daarna 24 A/B-paren, afwisselende volgorde, dezelfde vingerafdruk en exact vier adapteraanroepen per run. `bench.json` bevat zowel spreiding als p50/p95. Modelcalls: **nul**. Dit controleert aansturingsgedrag, niet het aantal antwoorden per seconde van een echte chatbot.

**Renderstudio:** [rolverdeling, ontwerpkeuzes en acceptatieproef](renderstudio.md). `renderstudio` is een zelfstandig exporteerbaar plan met vier vakrollen, onafhankelijke toets en overdracht.
