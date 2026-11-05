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

# POWDER RUN 3D — snowboard infinito

Gioco di snowboard originale in **3D** (Three.js) per **Scriptable**: camera alle spalle del rider, pista infinita generata al volo con kicker, salti nel vuoto, rail e box, dossi, sassi e alberi, e una valanga che ti insegue.

## Come giocare su iPhone
1. In Scriptable tocca **+**, incolla il contenuto di [`snow/PowderRun.js`](snow/PowderRun.js) (circa 70 righe) e avvia.
   Alla prima apertura scarica il gioco da GitHub (serve internet), poi funziona anche offline. Lo script scarica sempre l'ultima versione.
2. Alternativa senza internet: incolla [`snow/PowderRunCompleto.js`](snow/PowderRunCompleto.js), la versione completa (circa 800 KB, contiene anche il motore 3D).
3. Record e impostazioni finiscono in `Scriptable/PowderRun/record.json`.

## Comandi
- **Tieni premuto a sinistra / a destra**: curvi.
- **Tocco veloce** o **swipe in su**: salto. Saltare sul bordo di un kicker dà una spinta in più.
- **In aria, tieni premuto a sinistra / a destra**: giri (180, 360, 540…). Lascia prima di atterrare.
- **In aria, swipe in su / in giù**: backflip / frontflip (ripeti lo swipe per il doppio).
- **In aria, swipe a sinistra / a destra**: Method / Indy grab, finché tieni il dito.
- Il cerchio a terra mostra dove atterri: verde se l'atterraggio va bene, rosso se cadi.
- Sul computer: frecce ← → = curva e spin, Spazio = salto, ↑ ↓ = flip, A / D = grab, P = pausa.

## Sviluppo
Sorgenti in `snow3d/` (`index.html` interfaccia, `game.js` gioco, `vendor/three.min.js` motore 3D, licenza MIT).
Dopo ogni modifica:
```
python3 snow/build.py
```
che crea `snow/powder.html` (si apre anche nel browser) e i due script Scriptable.
La prima versione 2D è ancora in `snow/powder2d.html`.
