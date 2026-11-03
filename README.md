# FAUNI — Le Sorgenti di Valcorona

Gioco di ruolo originale in stile portatile anni '90 (4 tonalità di verde, movimento a griglia, lotte a turni), per **Scriptable** su iPhone e iPad.

## Come giocare su iPhone
1. Installa [Scriptable](https://scriptable.app) dall'App Store.
2. Apri `dist/FauniValcorona.js`, copia tutto il contenuto, crea un nuovo script in Scriptable e incollalo.
3. Avvia lo script. Il salvataggio (menu START → SALVA) finisce in `Scriptable/FauniValcorona/salvataggio.json` su iCloud.

## Come giocare sul computer
Apri `dist/fauni.html` nel browser. Comandi: frecce, **Z** = A, **X** = B, **Invio** = START.

## Contenuti
- **Capitolo 1 completo**: Borgo Aurora → Sentiero 1 → Torrevento → Sentiero 2 → Bosco Sussurro → Pietrafonda (prima palestra).
- 30 specie di Fauni con evoluzioni, 11 tipi, 40 mosse, stati alterati, cattura, Faunario, squadra e BOX, borsa, negozi, Centro Cura.
- La storia completa, con tutte le 40 zone, è in [`docs/STORIA.md`](docs/STORIA.md).

## Sviluppo
I sorgenti sono in `src/` (`data.js` dati, `engine.js` motore, `world.js` mappe e storia, `index.html` interfaccia).
Dopo ogni modifica:
```
python3 build.py
```
