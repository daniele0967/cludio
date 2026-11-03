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
