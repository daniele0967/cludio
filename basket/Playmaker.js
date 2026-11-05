// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: basketball-ball;
// PLAYMAKER - basket a enigmi
// Scarica il gioco da GitHub (serve internet la prima volta, poi funziona anche offline).
const URL_GIOCO = "https://raw.githubusercontent.com/daniele0967/cludio/claude/scriptable-pokemon-title-e3p0ow/basket/playmaker.html";

async function avviaGioco(html) {
  let fm;
  try { fm = FileManager.iCloud(); fm.documentsDirectory(); } catch (e) { fm = FileManager.local(); }
  const dir = fm.joinPath(fm.documentsDirectory(), "Playmaker");
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  const savePath = fm.joinPath(dir, "carriera.json");
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
      data = await Promise.race([wv.evaluateJavaScript("window.__waitSave(completion)", true), chiuso.then(() => null)]);
    } catch (e) { await chiuso; break; }
    if (data) fm.writeString(savePath, data);
  }
}
async function mostraErrore(e) { const a = new Alert(); a.title = "Playmaker: errore"; a.message = String(e && e.message ? e.message : e); a.addAction("OK"); await a.present(); }

async function scarica() {
  const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), "playmaker-cache.html");
  try {
    const req = new Request(URL_GIOCO); req.timeoutInterval = 20;
    const html = await req.loadString();
    if (req.response && req.response.statusCode === 200 && html.includes("Playmaker")) { fm.writeString(cache, html); return html; }
  } catch (e) {}
  if (fm.fileExists(cache)) return fm.readString(cache);
  throw new Error("Non riesco a scaricare il gioco. Controlla la connessione internet e riprova.");
}
try { await avviaGioco(await scarica()); } catch (e) { await mostraErrore(e); }
Script.complete();
