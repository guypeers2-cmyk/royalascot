# Ascot · WebGL & 3D-renderstudio

**Opdracht:** één station met vier beeldstanden. Verschillen mogen zichtbaar zijn in belichting en detail, nooit in de zes deelnemers, de koersklok, kansen, tickets of uitbetaling. Het werkboek opent met dit werkpatroon. Het bevat rollen en overdraagbare opdrachten; het start zelf geen andere modellen en verstuurt niets.

| Eigenaar | Ontwerpbesluit | Waar je het controleert |
|---|---|---|
| 21 · Ontwerper startinstallaties | Scheid dragend staal van zachte panelen. Maak van de voorkant een lichte V met open bovenrooster; maak de achterdeuren korter. Gebruik geen nagebouwde sponsorwand. | `CREDITS.md` in de spelbron bevat de drie bronnen en hun afzonderlijke invloed. De vorm is voor het schaalmodel, niet opgemeten in Ascot. |
| 22 · WebGL- & materiaalingenieur | Deel één stel scharnieren en dezelfde zes vakken tussen projecties. Per draaipunt één batch voor de staalprofielen en één voor het vinyl. Het bestaande signaal opent alle voordeuren tegelijk. | `js/start-gate.js`, `js/orbit.js`, `js/scene.js`; controleer gesloten, halfopen, open en ingetrokken. |
| 23 · Camera- & compositieontwerper | Rail volgt met één vaste lens per schermindeling, ook bij laden of volgen van een gekozen paard. De finish heeft een aparte lens op 1,20×; Action houdt zijn eigen bewegende camera. Detecteer bij film de silhouetten, niet hun hele rechthoek. Bij WebGL telt de geprojecteerde driehoeksgeometrie. | `js/field-cameras.js`, `js/panel-glass.js`, `js/seat-pov.js`. Controleer de hele overlay op 80% bij overlap, 100% vrij en 100% in het dock. |
| 24 · Renderbudget- & framepacingspecialist | Low: contactschaduw; Medium: statische ruimteschaduw; High: rijkere materialen en dynamische cabinetschaduw. Auto schakelt op gemeten beeldtijd en kan na aanhoudende ruimte terug omhoog. Een geforceerde stand is geen automatische stand. | `js/render-quality.js`. `tools/action_audit.cjs` meet een werkelijk bewegende Action-camera. Kies één apparaat, dezelfde opgeslagen race en dezelfde camera. Test software-WebGL apart van uitgeschakelde WebGL. |

**Onafhankelijke toets (19).** Start vier keer met hetzelfde veld. Leg de 64 sectoren per paard, de afzonderlijke FIT/STA-lezingen, de finishfoto en de afrekening naast elkaar. Verander tijdens één andere race ook tussendoor de stand. Een toevallig gelijke winnaar op zichzelf is geen bewijs. Test eerder uitgegeven kaarten en een reeds betaalde bon afzonderlijk.

**Overdracht (20).** Het spel, de upload-zip en dit werkboek moeten lokaal bruikbaar blijven. Metingen op software-WebGL zijn geen FPS-belofte voor fysieke GPU’s. Een nieuwe release publiceren naar een externe dienst is een aparte beslissing.

### Opnieuw uitvoeren vanuit de spelbron

```sh
npm test
# Met Playwright/Chromium en de lokale spelserver:
node tests/picture-desk.browser.cjs
node tests/parterre.browser.cjs
ASCOT_ORBIT=1 node tests/picture-desk.browser.cjs
ASCOT_OFFLINE=/pad/naar/royal-ascot.html node tests/picture-desk.browser.cjs
node tests/field-optics.browser.cjs
```

### Gecontroleerd met deze uitgave

De eerdere Stewards-veldproef gebruikte één verliezende en één winnende inzet van elk 10. Alle vier standen leverden dezelfde zes tijdreeksen, FIT/STA-lezingen, finishfoto en 600 eindcredits (500 − 20 + 120). De vloer-, stoel- en 3D-projectie toonden 80% boven een gecontroleerd paardenpixel en 100% op vrije ruimte. In 280 Rail-beelden bleven minstens vier volledige paarden in beeld. Zeven checkpoints uit de vorige uitgave bleven bij herhalen gelijk.

Een aparte proef hield de Action-camera niet stil: dezelfde opgeslagen race vanaf seconde 12, 1050 × 740, geluid uit, 18,5 seconden bewegend beeld na opwarming. Deze lokale metingen zijn geen referentie voor een fysieke GPU.

| Browserpad (Auto) | Beeldpad | Frames/s | Mediaan / p95 per beeld | Eindraster |
|---|---|---:|---:|---:|
| software | film | 15 | 34.9 / 181.3 ms | 512 × 283 |
| disabled | film | 59.2 | 16.7 / 20.1 ms | 749 × 414 |
