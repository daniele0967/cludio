#!/usr/bin/env python3
"""Costruisce dist/fauni.html (giocabile nel browser) e dist/FauniValcorona.js (per Scriptable)."""
import json, pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
html = (src / 'index.html').read_text()
for tag, f in [('DATA', 'data.js'), ('ENGINE', 'engine.js'), ('WORLD', 'world.js')]:
    code = (src / f).read_text()
    assert '</script' not in code.lower(), f
    html = html.replace(f'/*__{tag}__*/', code)
out = root / 'dist'; out.mkdir(exist_ok=True)
(out / 'fauni.html').write_text(html)

scriptable = """// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: leaf;
// ==========================================================
//  FAUNI — Le Sorgenti di Valcorona
//  Gioco di ruolo originale per Scriptable (iOS).
//  File generato da build.py: modifica i sorgenti in src/.
// ==========================================================

const HTML = %s;

function pickFM() {
  try { const f = FileManager.iCloud(); f.documentsDirectory(); return f; }
  catch (e) { return FileManager.local(); }
}
const fm = pickFM();
const dir = fm.joinPath(fm.documentsDirectory(), "FauniValcorona");
if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
const savePath = fm.joinPath(dir, "salvataggio.json");

let save = null;
if (fm.fileExists(savePath)) {
  try { if (!fm.isFileDownloaded(savePath)) await fm.downloadFileFromiCloud(savePath); } catch (e) {}
  save = fm.readString(savePath);
}

const wv = new WebView();
await wv.loadHTML(HTML.replace("/*__SAVE__*/null", () => JSON.stringify(save)));

let open = true;
const shown = wv.present(true).then(() => { open = false; });
while (open) {
  const data = await Promise.race([
    wv.evaluateJavaScript("window.__waitSave(completion)", true),
    shown.then(() => null),
  ]);
  if (data) fm.writeString(savePath, data);
}
Script.complete();
""" % json.dumps(html, ensure_ascii=False)
(out / 'FauniValcorona.js').write_text(scriptable)
print('ok', len(html), 'bytes html')
