# Continuous coverage · meetnotities

**De speler regisseert de finish.** De laatste bocht is geen cameragebeurtenis meer. De keuze, de bedieningsknoppen, de satellietmonitoren en een eventuele volgselectie blijven werkzaam. De uitgeschakelde overname heeft geen verborgen draaiboek, lens, download of canvaslaag meer. De gemeten eerste passage levert nog steeds de officiële loodrechte foto op. Na de laatste passage volgt het uitslagenbord met alle zes paarden.

Bij het bekijken van de oude uitsnede waren vooral de abrupte wissel van gezichtspunt en het harde, bijna zwarte vlak buiten de plaat zichtbaar. In de behouden Rail-opname zijn de aankomstlijn, de lopers, de beplanting en de actuele totalisator geregistreerd op dezelfde foto. Waar de volledige Floor- of Console-plaat het venster niet vult, kleurt een rustige, uit de bovenkant van de salon bemonsterde rand mee. Het circuit wordt niet uitgerekt en er verschijnen geen tweede horizon, paarden of rails in de rand.

## Glas en bediening

De extra ruimte gaat uitsluitend naar de kolom **Race monitor**, niet naar de letters of de bonnetjes. De schaal van de inhoud volgt de bestaande tekstinstelling. Bij tien rechtstreekse metingen tegen Parterre (5 vensters × overlay/dock, dezelfde opgeslagen race) lag de toename tussen **4,993% en 5,027%**. Het grootste gemeten verschil bij *My bets* was 1/64 CSS-pixel. Voorbeelden in CSS-pixels:

| Venster | Plaats | Vorige monitor | Huidige monitor |
|---|---|---:|---:|
| 1366 × 820 | Overlay | 344,25 | 361,48 |
| 1366 × 820 | Dock | 225,89 | 237,19 |
| 390 × 844 | Overlay | 158,95 | 166,91 |
| 390 × 844 | Dock | 159,80 | 167,78 |

De knop met de schuifregelaars staat onmiddellijk links van fullscreen, ook op de telefoon. **Auto / High / Medium / Low** gebruiken dezelfde voorkeur als de Picture desk. Het menu toont bij Auto ook het effectieve niveau. Een keuze verandert geen inzet, koers of klok; de aparte keuze *Action camera picture* blijft onafhankelijk. De bediening is ook met de pijltjestoetsen, Enter en Escape te gebruiken.

## WebGL: minder werk voor hetzelfde beeld

- Bij een stilstaande Orbit-camera blijft de werkelijk gerenderde kleur- **en** dieptebuffer behouden. De CRT- en bordvlakken en het gebied van oude én nieuwe posities, inclusief slagschaduwen, worden ververst. Draaien, zoomen, laden, de poortbeweging, een andere kwaliteit of venstergrootte leiden tot een volledige belichting. Bij de bewegende Action-camera wordt geen oud achtergrondbeeld hergebruikt.
- Het volle model (11.134 hoekpunten per paard), de fysieke materialen, multisampling, de afmetingen van de tekenbuffer en de schaduwniveaus blijven bestaan. Alle zes figuren delen één 64-fasenpalet voor hun actuele stap of galop. De presentatie interpoleert continu; bankhoek en contact met de grond worden nog steeds per beeld bepaald. De exacte solver blijft in gebruik bij veranderende startinspanning en in de fotostudio. High Orbit heeft geen vaste begrenzing op 31 beelden/s meer.
- Ondoorzichtige oppervlakken schermen achterliggende lagen eerder af. Bij WebGL 2 worden de brede reflecties van **hetzelfde** PMREM-kamerlicht met native cubemapfiltering ontwikkeld. De scherpe chroomreflectie en de WebGL 1-route houden de oorspronkelijke lichtbron. Er is geen verlaging van High naar Medium of film in deze vergelijking.

**Gecontroleerde 3D-meting tegen `0219fe0`.** Zelfde browser, SwiftShader WebGL 2, 1050 × 740 venster, **995 × 550** echte GL-buffer, dezelfde bewaarde race en 20 opeenvolgende bewegende beelden na 8 opwarmbeelden. Auto en fotografische Action stonden uit. Dezelfde dertig tijdstappen per simulatieseconde sturen de zes paarden; het echte paneel van elke versie blijft in beeld. `readPixels` na elke opname wacht de GPU af. Dit meet rendertijd, geen 30-fps-belofte en geen meting op een fysieke videokaart.

| High camera | Mediaan voltooid, oud → nieuw | 95e percentiel, oud → nieuw | Mediaan indienen door browser, oud → nieuw |
|---|---:|---:|---:|
| Cabinet orbit | 2583,0 → **664,3 ms** | 4333,0 → **768,2 ms** | 18,1 → **5,1 ms** |
| Action, expliciet 3D | 3103,4 → **2188,5 ms** | 3288,9 → **2333,6 ms** | 16,9 → **7,2 ms** |

Een tweede, seriële proef liet High Action 38 seconden vrij lopen, vanaf 22 s op dezelfde koers en zonder een andere browserproef ernaast. De mediane tijd tussen aangeboden beelden ging van 3795,4 naar 3153,9 ms (11 respectievelijk 12 beelden; p95 8330,4 → 7524,5 ms). Dit is een zware software-renderer, **geen** realtime High-demonstratie. Op een toestel zonder grafische versnelling blijft Auto met fotografische Action de praktischere keuze.

Bij zes andere koersstanden is de hergebruikte Orbit-buffer rechtstreeks vergeleken met een volledige hertekening: **nul verschillende kleurwaarden**. Bij dezelfde laatste stand, met de oorspronkelijke lichtatlas in plaats van het native filter, was het maximale verschil één stap op een 8-bits kleurkanaal (RMS 0,0865).

**Herhalen:** `npm test`; met Playwright/Chromium `tests/quick-quality.browser.cjs`, `tests/finish-post.browser.cjs`, `tests/live-controls.browser.cjs` en `tests/picture-desk.browser.cjs` (`ASCOT_ORBIT=1` voor 3D). Met `ASCOT_SITE`, `ASCOT_VIEW=3` of `6`, `ASCOT_FRAMES=20` draait `node tools/gl_trace.cjs` dezelfde meetreeks op twee bronbomen. Zonder extra invoer genereert `tools/trace_card.cjs` de vaste testkoers. Met `ASCOT_CHECKPOINT` kan ook dezelfde eerder geëxporteerde checkpoint voor beide runs worden opgegeven. `ASCOT_PROVE=1` vergelijkt op de huidige Orbit ook het echte eindbeeld. `tools/gl_pacing.cjs` is de afzonderlijke, vrijlopende RAF-proef zonder vaste simulatietijdstap.
