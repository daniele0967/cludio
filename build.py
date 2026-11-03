#!/usr/bin/env python3
"""Costruisce dist/fauni.html (giocabile nel browser) e dist/FauniValcorona.js (per Scriptable)."""
import json, pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
html = (src / 'index.html').read_text()
for tag, f in [('SPRITES', 'sprites.js'), ('DATA', 'data.js'), ('ENGINE', 'engine.js'), ('WORLD', 'world.js')]:
    code = (src / f).read_text()
    assert '</script' not in code.lower(), f
    html = html.replace(f'/*__{tag}__*/', code)
out = root / 'dist'; out.mkdir(exist_ok=True)
(out / 'fauni.html').write_text(html)

RUNTIME = r"""
// ---- avvio di una pagina in una WebView, con salvataggio su file ----
async function avviaGioco(html, cartella, nomeFile) {
  let fm;
  try { fm = FileManager.iCloud(); fm.documentsDirectory(); } catch (e) { fm = FileManager.local(); }
  const dir = fm.joinPath(fm.documentsDirectory(), cartella || "FauniValcorona");
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  const savePath = fm.joinPath(dir, nomeFile || "salvataggio.json");
  let save = null;
  if (fm.fileExists(savePath)) {
    try { if (!fm.isFileDownloaded(savePath)) await fm.downloadFileFromiCloud(savePath); } catch (e) {}
    try { save = fm.readString(savePath); } catch (e) {}
  }
  const wv = new WebView();
  await wv.loadHTML(html.replace("/*__SAVE__*/null", () => JSON.stringify(save)));
  let aperto = true;
  const chiuso = wv.present(true).then(() => { aperto = false; });
  while (aperto) {
    let data = null;
    try {
      data = await Promise.race([
        wv.evaluateJavaScript("window.__waitSave(completion)", true),
        chiuso.then(() => null),
      ]);
    } catch (e) { await chiuso; break; }
    if (data) fm.writeString(savePath, data);
  }
}

async function mostraErrore(e) {
  const a = new Alert();
  a.title = "FAUNI: errore";
  a.message = String(e && e.stack ? e.message + "\n\n" + e.stack : e);
  a.addAction("OK");
  await a.present();
}
"""

HEADER = """// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: leaf;
"""

# --- script completo (offline): HTML spezzato in righe corte ---
def chunks(text, n=120):
    for i in range(0, len(text), n):
        yield text[i:i + n]
lines = ',\n'.join(json.dumps(c, ensure_ascii=True) for c in chunks(html))
full = HEADER + """// FAUNI - Le Sorgenti di Valcorona (versione completa, funziona offline)
// File generato da build.py: modifica i sorgenti in src/.
""" + RUNTIME + """
const PEZZI = [
""" + lines + """
];

try {
  await avviaGioco(PEZZI.join(""));
} catch (e) {
  await mostraErrore(e);
}
Script.complete();
"""
(out / 'FauniValcorona.js').write_text(full)

# --- installer corto: scarica il gioco da GitHub e lo tiene in cache ---
URL = 'https://raw.githubusercontent.com/daniele0967/cludio/claude/scriptable-pokemon-title-e3p0ow/dist/fauni.html'
loader = HEADER + """// FAUNI - Le Sorgenti di Valcorona + Lavagna Baseball5
// Script corto: scarica il gioco da GitHub (serve internet la prima volta,
// poi funziona anche offline con l'ultima versione scaricata).
const URL_GIOCO = "%s";
const URL_LAVAGNA = "https://raw.githubusercontent.com/daniele0967/cludio/claude/scriptable-pokemon-title-e3p0ow/b5/app.html";
""" % URL + RUNTIME + """
async function scarica(url, cacheName, controllo) {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.documentsDirectory(), cacheName);
  try {
    const req = new Request(url);
    req.timeoutInterval = 20;
    const html = await req.loadString();
    if (req.response && req.response.statusCode === 200 && html.includes(controllo)) {
      fm.writeString(cache, html);
      return html;
    }
  } catch (e) {}
  if (fm.fileExists(cache)) return fm.readString(cache);
  throw new Error("Non riesco a scaricare i file. Controlla la connessione internet e riprova.");
}

try {
  const menu = new Alert();
  menu.title = "Cosa vuoi aprire?";
  menu.addAction("Fauni (il gioco)");
  menu.addAction("Lavagna Baseball5");
  menu.addCancelAction("Annulla");
  const scelta = await menu.present();
  if (scelta === 0) {
    await avviaGioco(await scarica(URL_GIOCO, "fauni-cache.html", "FAUNI"), "FauniValcorona", "salvataggio.json");
  } else if (scelta === 1) {
    await avviaGioco(await scarica(URL_LAVAGNA, "lavagna-b5-cache.html", "Lavagna Baseball5"), "LavagnaB5", "dati.json");
  }
} catch (e) {
  await mostraErrore(e);
}
Script.complete();
"""
(out / 'Fauni.js').write_text(loader)
print('ok', len(html), 'bytes html')
