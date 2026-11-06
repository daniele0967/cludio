#!/usr/bin/env python3
"""Costruisce Powder Run 3D (snow/powder.html) dai sorgenti in snow3d/ e gli script Scriptable.

- PowderRun.js         script corto: scarica il gioco da GitHub e lo tiene in cache
- PowderRunCompleto.js versione completa con il gioco dentro (funziona offline)
"""
import base64, json, pathlib, re
here = pathlib.Path(__file__).parent
src3d = here.parent / 'snow3d'
ORDER = ['core.js', 'world.js', 'tricks.js', 'physics.js', 'render.js', 'park.js', 'rider.js', 'audio.js', 'ui.js', 'main.js']
html = (src3d / 'index.html').read_text()
three = (src3d / 'vendor' / 'three.min.js').read_text()
# il file r160 apre con un avviso in console sul formato "build/three.min.js": non serve
three = re.sub(r'^console\.warn\([^;]*?\)(?=,)', 'void 0', three, count=1)
game = '(function () {\n' + '\n'.join((src3d / 'js' / f).read_text() for f in ORDER) + '\n})();\n'
for name, code in [('three', three), ('game', game)]:
    assert '</script' not in code.lower(), name
rider = base64.b64encode((src3d / 'assets' / 'rider.bin').read_bytes()).decode()
html = html.replace('/*__THREE__*/', three, 1).replace('/*__GAME__*/', game, 1).replace('/*__RIDER__*/', rider, 1)
assert '/*__SAVE__*/null' in html
(here / 'powder.html').write_text(html)

HEADER = """// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: snowflake;
"""

RUNTIME = r"""
// ---- apre il gioco in una WebView a tutto schermo e salva record e impostazioni su file ----
async function avviaGioco(html) {
  let fm;
  try { fm = FileManager.iCloud(); fm.documentsDirectory(); } catch (e) { fm = FileManager.local(); }
  const dir = fm.joinPath(fm.documentsDirectory(), "PowderRun");
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  const savePath = fm.joinPath(dir, "record.json");
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
  a.title = "Powder Run: errore";
  a.message = String(e && e.message ? e.message : e);
  a.addAction("OK");
  await a.present();
}
"""

def chunks(text, n=120):
    for i in range(0, len(text), n):
        yield text[i:i + n]

lines = ',\n'.join(json.dumps(c, ensure_ascii=True) for c in chunks(html))
full = HEADER + """// POWDER RUN - snowboard infinito (versione completa, funziona offline)
// File generato da snow/build.py: modifica i sorgenti in snow3d/.
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
(here / 'PowderRunCompleto.js').write_text(full)

URL = 'https://raw.githubusercontent.com/daniele0967/cludio/claude/scriptable-pokemon-title-e3p0ow/snow/powder.html'
loader = HEADER + """// POWDER RUN - snowboard infinito
// Script corto: scarica il gioco da GitHub (serve internet la prima volta,
// poi funziona anche offline con l'ultima versione scaricata).
const URL_GIOCO = "%s";
""" % URL + RUNTIME + """
async function scarica() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.documentsDirectory(), "powderrun-cache.html");
  try {
    const req = new Request(URL_GIOCO);
    req.timeoutInterval = 20;
    const html = await req.loadString();
    if (req.response && req.response.statusCode === 200 && html.includes("Powder Run")) {
      fm.writeString(cache, html);
      return html;
    }
  } catch (e) {}
  if (fm.fileExists(cache)) return fm.readString(cache);
  throw new Error("Non riesco a scaricare il gioco. Controlla la connessione internet e riprova.");
}

try {
  await avviaGioco(await scarica());
} catch (e) {
  await mostraErrore(e);
}
Script.complete();
"""
(here / 'PowderRun.js').write_text(loader)
print('ok', len(html), 'byte html,', full.count('\n'), 'righe nella versione completa')
