# FAUNI — Le Sorgenti di Valcorona

Gioco di ruolo originale in stile portatile a colori anni 2000 (pixel art, movimento a griglia, lotte a turni animate), per **Scriptable** su iPhone e iPad.

## Come giocare su iPhone
1. Installa [Scriptable](https://scriptable.app) dall'App Store.
2. In Scriptable tocca **+**, incolla il contenuto di [`dist/Fauni.js`](dist/Fauni.js) (circa 60 righe) e avvia.
   Alla prima apertura scarica il gioco da GitHub (serve internet). Dopo funziona anche offline.
3. Alternativa senza internet: incolla [`dist/FauniValcorona.js`](dist/FauniValcorona.js), la versione completa (circa 1000 righe).
4. Il salvataggio (menu START → SALVA) finisce in `Scriptable/FauniValcorona/salvataggio.json`.
   Se qualcosa va storto, lo script mostra un avviso con l'errore.

## Come giocare sul computer
Apri `dist/fauni.html` nel browser. Comandi: frecce, **Z** = A, **X** = B, **Invio** = START.

## Contenuti
- **Capitolo 1 completo**: Borgo Aurora → Sentiero 1 → Torrevento → Sentiero 2 → Bosco Sussurro → Pietrafonda (prima palestra).
- 30 specie di Fauni originali disegnate in pixel art, con evoluzioni, 11 tipi, 40 mosse, stati alterati, cattura, Faunario, squadra e BOX, borsa, negozi, Centro Cura.
- La storia completa, con tutte le 40 zone, è in [`docs/STORIA.md`](docs/STORIA.md).

- Animazioni di lotta: transizione d'ingresso, lancio della sfera, attacchi diversi per ogni tipo, colpi superefficaci che scuotono lo schermo, cattura con la sfera che dondola, salita di livello, evoluzione.

## Sviluppo
I sorgenti sono in `src/` (`sprites.js` pixel art delle creature, `data.js` dati, `engine.js` motore, `world.js` mappe e storia, `index.html` interfaccia).
Dopo ogni modifica:
```
python3 build.py
```

---

# POWDER RUN — snowpark infinito (Free Ride)

Gioco di snowboard originale in **3D** (Three.js) per **Scriptable** e browser, rifatto da zero: valle alpina con montagne lontane, foschia, sole basso e ombre, neve battuta con le righe del gatto e i brillantini, boschi innevati, seggiovia che gira, park con kicker, rail e box generati all'infinito. Il rider ha uno scheletro vero (modello Xbot degli esempi di Three.js, di origine Mixamo) vestito con giacca, pantaloni larghi, casco e maschera; le pose sono calcolate in tempo reale (IK di gambe e braccia, grab con la mano sulla tavola, caduta con ragdoll).

## Novità
- **Neve fresca ovunque**: superficie polverosa con dune e cumuli, solchi profondi della tavola, nuvole di polvere in curva e negli atterraggi, abeti carichi di neve.
- **Effetti di camera** (sui telefoni che li reggono): bagliore della neve al sole, sfocatura ai bordi in velocità, vignetta, antialiasing. Si spengono da soli se il telefono fatica.
- **Tre camere** (tasto in alto a destra): Classica, Video (bassa e di lato), Lontana. **Replay al rallentatore** dopo un bel trick, e in pausa "Rivedi l'ultimo trick".
- **Trick dal vivo**: mentre sei in aria vedi rotazione, flip e grab che stai facendo.
- **Terreno**: cielo e montagne lontane si disegnano in un passaggio separato (niente terreno che sparisce sui telefoni con poca precisione di profondità); se il telefono rifiuta lo shader della neve si usa quello standard. In Impostazioni c'è una voce **Diagnostica** da mandare se qualcosa non si vede.

## Modalità
- **Free Run**: salti e rail all'infinito, si fanno trick e combo; 3 cadute e la corsa finisce. Sempre una **sfida** attiva (es. "Atterra un 540", "Grinda 14 m"): completarla dà punti e una vita.
- **Zen**: stessa montagna, senza limite di cadute.
- **Tutorial**: 11 passi guidati, da sterzare fino alle combo.

## Comandi (telefono, in orizzontale)
- **Pollice sinistro** in qualsiasi punto della metà sinistra: lo stick appare sotto il dito. ← → curvi, ↑ posizione raccolta (più veloce), ↓ freni di traverso.
- **Pollice destro**: tieni premuto per caricare, lascia per saltare. Sui kicker lascia sul bordo (lip) per il "Pop!". Se tieni premuto oltre il lip, salta da solo.
- **Spin**: in aria stick ← →. **Pre-carica**: tieni lo stick di lato mentre carichi il salto. **Flip**: stick ↑ (frontflip) / ↓ (backflip). In diagonale: Cork, Rodeo, Misty, anche doppi.
- **Grab**: in aria tocca a destra e **trascina**: ↑ Nose, ↗ Mute, → Indy, ↘ Japan, ↓ Tail, ↙ Stalefish, ← Melon, ↖ Method. Tenuto a lungo diventa "Tweaked". Si può cambiare grab trascinando altrove. Trucco: tieni il salto oltre il lip e trascina subito, è un solo gesto.
- **Rail e box**: nessuna calamita. Ci si aggancia solo se la tavola ci finisce davvero sopra (aiuto di 6 cm); un puntino verde sul rail dice che la traiettoria è giusta. Sul rail: stick ← → gira la tavola (50-50, Boardslide, Lipslide), trascina a destra ↑ ↓ per Nose/Tail Press, tocca per saltare via (180 Out, 360 Out…).
- **Press e butter**: a terra trascina a destra ↑ o ↓ e tieni; con lo stick fai girare la tavola sulla neve (Nose Butter 180, 360…).
- **Atterraggio**: Perfetto (×1,25), Pulito, Sporco (punti a metà). Troppo storto, sulla testa, di traverso o col grab in mano dopo un salto grosso: caduta. Il cerchio a terra dice dove atterri (verde ok, giallo al limite, rosso cadi).
- Impostazioni: Regular/Goofy, aiuto all'atterraggio (Pro, Normale, Facile), sensibilità, flip invertiti, luce (mattina, pomeriggio, tramonto, neve), qualità grafica (automatica), audio e musica. Nel menu **Rider** si scelgono completo e tavola.
- Sul computer: frecce/WASD = stick, Spazio = salto, 1–8 = grab (E = Indy, Q = Melon), R/F = press, P = pausa.

## Come giocare su iPhone
1. In Scriptable incolla [`snow/PowderRun.js`](snow/PowderRun.js) (circa 70 righe) e avvia: scarica sempre l'ultima versione da GitHub (circa 2 MB), poi funziona anche offline. Chi aveva già lo script lo ritrova aggiornato da solo.
2. Alternativa senza internet: [`snow/PowderRunCompleto.js`](snow/PowderRunCompleto.js).
3. Record e impostazioni: `Scriptable/PowderRun/record.json`.

## Sviluppo
Sorgenti in `snow3d/`: `js/core.js` (servizi, salvataggio), `js/world.js` (pista, kicker progettati sulle traiettorie, rail, alberi), `js/tricks.js` (nomi e punti), `js/physics.js` (fisica a 120 Hz, salti, rotazioni, rail, butter, cadute), `js/render.js`, `js/park.js` e `js/post.js` (grafica ed effetti), `js/rider.js` (modello, vestiti, pose, ragdoll), `js/audio.js` (suoni e musica sintetizzati), `js/ui.js` e `js/main.js` (comandi, HUD, menu, camera), `index.html`. `assets/rider.bin` si rigenera con `python3 snow3d/tools/extract_rider.py`.
Dopo ogni modifica: `python3 snow/build.py`. Test senza grafica: `node snow3d/test/ride.js`, `tricks.js`, `rails.js`, `butter.js`; nel browser: `snow3d/test/scenes.js`, `touch.js`, `tut.js`.
La prima versione 2D è ancora in `snow/powder2d.html`.

---

# PLAYMAKER — basket a enigmi in 3D

Gioco di basket a enigmi in **3D** (Three.js) per **Scriptable** e browser, con le meccaniche di Score Hero (grafica, squadre e livelli sono originali). Il tempo si ferma quando hai la palla: **o passi o tiri**, non si palleggia. 50 livelli già impegnativi dal primo, in 5 ambientazioni (Playground, Spiaggia al tramonto, Palestra del liceo, Rooftop notturno, Arena delle finali), con punteggio, cronometro e 3 stelle.

- Su iPhone: in Scriptable incolla [`basket/Playmaker.js`](basket/Playmaker.js) (scarica il gioco da GitHub, circa 4,7 MB la prima volta) oppure [`basket/PlaymakerCompleto.js`](basket/PlaymakerCompleto.js) (offline). La carriera si salva in `Scriptable/Playmaker/carriera.json`.
- Nel browser: apri `basket/playmaker.html`. La vecchia versione 2D è in `basket/playmaker2d.html`.
- Comandi: trascina dal giocatore con la palla a un compagno per passare (anche con traiettoria curva). Per tirare trascina verso il canestro: il punto in cui finisce il dito è la mira, e se è fuori dal ferro la palla va fuori. Una curva verso l'alto alza la parabola. Passando vicino al compagno sotto canestro: alley-oop.
- Ogni livello ha un **pivot** che protegge il ferro come il portiere di Score Hero: salta e stoppa i tiri che gli passano vicino. Gli altri difensori contestano il tiro e restringono la zona buona.
- Sorgenti in `basket3d/`: `sim.js` (simulazione, livelli e risolutore, senza grafica), `game3d.js` (grafica e animazioni), `index.html` (interfaccia), `vendor/three-bundle.min.js` (Three.js con GLTFLoader e SkeletonUtils, licenza MIT), `assets/Xbot.glb` (modello umano con animazioni dagli esempi di Three.js, di origine Mixamo). Dopo ogni modifica: `python3 basket3d/build.py`. Ogni livello è verificato dal risolutore, che usa le stesse regole del gioco.
