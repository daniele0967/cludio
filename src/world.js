// ============================================================
//  FAUNI DI VALCORONA — mappe e storia (Capitolo 1)
// ============================================================

const MAPS = {};

// ---------- interni riutilizzabili ----------
const HOUSE_ROWS = [
  '##########',
  '#bb__x__k#',
  '#________#',
  '#__tt____#',
  '#__tt____#',
  '#________#',
  '#x______x#',
  '####mm####',
];
const CENTER_ROWS = [
  '############',
  '#x________p#',
  '#___cccc___#',
  '#__________#',
  '#t________t#',
  '#__________#',
  '#x________x#',
  '#####mm#####',
];
const SHOP_ROWS = [
  '##########',
  '#bbb__bbb#',
  '#________#',
  '#cc_____x#',
  '#________#',
  '#__tt____#',
  '#________#',
  '####mm####',
];

function house(id, exit, npcs, name) { MAPS[id] = {name: name || 'Casa', indoor: true, rows: HOUSE_ROWS, exit, npcs}; }
function center(id, exit, extra = []) {
  MAPS[id] = {name: 'Centro Cura', indoor: true, rows: CENTER_ROWS, exit, pc: true, npcs: [
    {id: 'nurse', x: 5, y: 1, look: 'nurse', talk: nurse},
    ...extra,
  ]};
}
function bottega(id, exit, items, extra = []) {
  MAPS[id] = {name: 'Bottega', indoor: true, rows: SHOP_ROWS, exit, npcs: [
    {id: 'clerk', x: 1, y: 2, look: 'clerk', talk: () => shop(items)},
    ...extra,
  ]};
}

// ============================================================
//  BORGO AURORA
// ============================================================
MAPS.borgo = {
  name: 'Borgo Aurora',
  rows: [
    'TTTTTTTTT..TTTTTTTTT',
    'T,,......==.......,T',
    'T.RRRR...==...RRRR.T',
    'T.WwDW...==...WwDW.T',
    'T........==........T',
    'T.fff..S.==...fff..T',
    'T........==........T',
    'T...RRRRRRRRRRR....T',
    'T...RRRRRRRRRRR....T',
    'T...WwwwwDwwwwW....T',
    'T........=.........T',
    'T.ff.....=.....ff..T',
    'T........=......S..T',
    'T~~~~~~~~~~~~~~~~~~T',
    '~~~~~~~~~~~~~~~~~~~~',
  ],
  doors: {'4,3': 'casa_p', '16,3': 'casa_t', '9,9': 'lab'},
  links: {up: {to: 'sentiero1'}},
  signs: [
    {x: 7, y: 5, text: 'BORGO AURORA|Dove ogni viaggio prende il largo.'},
    {x: 16, y: 12, text: 'LABORATORIO VENTURA|Studi sulle SORGENTI e sui FAUNI di VALCORONA.'},
  ],
  npcs: [
    {id: 'fisher', x: 13, y: 11, look: 'old', dir: 'down', text: 'Stanotte il mare ha portato a riva di tutto: alghe, conchiglie... e qualcosa che brillava.|La PROF è corsa in spiaggia prima dell\'alba.'},
    {id: 'girl', x: 5, y: 6, look: 'girl', dir: 'right', text: 'Da grande voglio un FAUNO che voli! Così vado a scuola dall\'alto.'},
  ],
  triggers: [
    {x: 9, y: 1, w: 2, when: () => !F('starter'), run: async () => {
      player.dir = 'up';
      await say('Una voce ti chiama da dietro: "{NAME}! Non andare nell\'erba alta senza un FAUNO!"');
      await say('È meglio passare prima dal LABORATORIO della PROF.');
      await playerWalk(['down']);
    }},
  ],
};

house('casa_p', {to: 'borgo', x: 4, y: 4}, [
  {id: 'mom', x: 5, y: 3, look: 'mom', dir: 'left', talk: async () => {
    if (!F('starter')) {
      await say('Buongiorno! Hai sentito la tempesta stanotte? Il mare ha portato di tutto sulla spiaggia.');
      await say('La PROF è passata presto: ti aspetta al LABORATORIO, qui sotto. Non farla aspettare!');
    } else {
      await say('Il tuo primo FAUNO! Che emozione... Riposatevi un momento.');
      healParty();
      await say('Ecco fatto! Siete in perfetta forma. Fai attenzione là fuori, d\'accordo?');
    }
  }},
], 'Casa di {NAME}');
MAPS.casa_p.signs = [{x: 1, y: 1, text: 'Una libreria piena di fumetti. Ce n\'è uno con una SORGENTE in copertina.'}];

house('casa_t', {to: 'borgo', x: 16, y: 4}, [
  {id: 'dad', x: 6, y: 3, look: 'dad', dir: 'down', text: [
    'Sono il guardiano del faro, il padre di {RIVAL}.',
    '{RIVAL} è uscito all\'alba. Diceva che oggi ti avrebbe battuto "una volta per tutte". Lo dice da quando avevate cinque anni.',
  ]},
], 'Casa di {RIVAL}');

// ---------- LABORATORIO ----------
MAPS.lab = {
  name: 'Laboratorio', indoor: true,
  rows: [
    '############',
    '#bbbb__bbbb#',
    '#__________#',
    '#____ttt___#',
    '#__________#',
    '#p________x#',
    '#__________#',
    '#x________x#',
    '#__________#',
    '#####mm#####',
  ],
  exit: {to: 'borgo', x: 9, y: 10},
  pc: true,
  npcs: [
    {id: 'prof', x: 6, y: 2, look: 'prof', dir: 'down', talk: async () => {
      if (!F('starter')) await say('Sono tutti e tre in quelle SFERE sul tavolo. Prenditi il tempo che ti serve.');
      else if (!F('rival1')) await say('Avanti, conosci meglio il tuo nuovo compagno!');
      else await say('Il BOSCO SUSSURRO è a nord di TORREVENTO. Fai attenzione, {NAME}. E registra tutto nel FAUNARIO!');
    }},
    {id: 'rival', x: 9, y: 4, look: 'rival', dir: 'left', show: () => !F('rival_left'), talk: async () => {
      if (!F('starter')) await say('Dai, scegli! Io ho già deciso... più o meno.');
      else await say('Il mio FAUNO è chiaramente il migliore. Vuoi una prova?');
    }},
    {id: 'aide', x: 2, y: 6, look: 'man', dir: 'right', text: 'Sono l\'assistente della PROF. Analizzo i campioni di LINFA delle SORGENTI.|Ultimamente sono sempre più deboli. Nessuno sa perché.'},
    ...['fogliotto', 'fiammolo', 'gocciolo'].map((sp, i) => ({
      id: 'ball_' + sp, x: 5 + i, y: 3, look: 'ball', noTurn: true,
      show: () => G.starter !== sp && G.rivalStarter !== sp,
      talk: () => pickStarter(sp),
    })),
  ],
  triggers: [
    {x: 1, y: 8, w: 10, when: () => !F('starter') && F('lab_intro'), run: async () => {
      await say('PROF: Ehi, non andartene! Scegli prima il tuo FAUNO.');
      await playerWalk(['up']);
    }},
    {x: 1, y: 7, w: 10, when: () => F('starter') && !F('rival1'), run: rivalBattle1},
  ],
  onEnter: async () => {
    if (F('lab_intro')) return;
    setF('lab_intro');
    {
      await playerWalk(['up', 'up', 'up', 'up']);
      const rival = NPCS.find(n => n.id === 'rival');
      face(rival, 'left');
      await say('{RIVAL}: Era ora, {NAME}! La PROF non voleva dirmi niente finché non arrivavi.');
      await say('PROF: Eccoti! Stanotte la tempesta ha spinto a riva tre giovani FAUNI, lontani dalla loro SORGENTE.');
      await say('PROF: Li ho curati tutta la notte. Stanno bene, ma hanno bisogno di qualcuno che resti con loro.');
      await say('PROF: Ognuno di voi due ne prenderà uno. Sono in quelle SFERE sul tavolo.|{NAME}, scegli tu per primo.');
      await say('{RIVAL}: Cosa?! Perché sempre prima {NAME}?');
      await say('PROF: Perché tu stamattina ti sei mangiato il mio budino, {RIVAL}.');
      await say('{RIVAL}: ...Era un esperimento scientifico.');
    }
  },
};

const STARTER_INFO = {
  fogliotto: 'È FOGLIOTTO, un FAUNO di tipo PIANTA. Dorme con le foglie al sole.',
  fiammolo: 'È FIAMMOLO, un FAUNO di tipo FUOCO. Tiene sempre in bocca una piccola brace.',
  gocciolo: 'È GOCCIOLO, un FAUNO di tipo ACQUA. Per metà è fatto di acqua di mare.',
};
const RIVAL_PICK = {fogliotto: 'fiammolo', fiammolo: 'gocciolo', gocciolo: 'fogliotto'};

async function pickStarter(sp) {
  if (F('starter')) { await say('È l\'ultimo FAUNO rimasto alla PROF. Sembra che si sia appena addormentato.'); return; }
  overlay = {type: 'mon', sp};
  const yes = await ask(STARTER_INFO[sp] + '|Scegli ' + SPECIES[sp].name + '?');
  overlay = null;
  if (!yes) return;
  G.starter = sp; setF('starter');
  const m = makeMon(sp, 5, G.name); addMon(m);
  await say(`{NAME} riceve ${SPECIES[sp].name}!`);
  await say(`PROF: Ottima scelta. ${SPECIES[sp].name} sembra già fidarsi di te.`);
  const rs = RIVAL_PICK[sp]; G.rivalStarter = rs;
  await say(`{RIVAL}: Allora io prendo questo! ${SPECIES[rs].name}, sei con me!`);
  await say(`{RIVAL} riceve ${SPECIES[rs].name}!`);
  await say('PROF: Prendete anche questi. Sono FAUNARI: registrano ogni FAUNO che incontrate.');
  setF('faunario');
  await say('{NAME} riceve il FAUNARIO!');
  await say('PROF: E queste SFERE servono a stringere amicizia con i FAUNI selvatici. Indeboliscili prima di lanciarle!');
  await give('sfera', 5);
  await say('Premi START per aprire il menu: FAUNARIO, squadra, BORSA e salvataggio sono tutti lì.');
}

async function rivalBattle1() {
  const rival = NPCS.find(n => n.id === 'rival');
  player.dir = 'up';
  await say('{RIVAL}: Aspetta, {NAME}! Vediamo subito chi ha scelto meglio!');
  const res = await battle({canLose: true, trainer: {look: 'rival', cls: 'RIVALE', name: G.rival, team: [[G.rivalStarter, 5]], money: 80,
    lose: '{RIVAL}: Cosa?! Stavo solo... scaldando i motori.'}});
  if (res === 'lose') await say('{RIVAL}: Visto? Sono nato per questo!');
  setF('rival1');
  healParty();
  await say('PROF: Bella lotta, tutti e due. Ecco, vi rimetto in forma i FAUNI.');
  await say('PROF: Ora ascoltatemi. Da qualche settimana le SORGENTI della valle si stanno spegnendo, una dopo l\'altra.');
  await say('PROF: Senza la LINFA delle SORGENTI i FAUNI si indeboliscono, e i più giovani si perdono. Come i vostri tre, stanotte.');
  await say('PROF: La più vicina è nel BOSCO SUSSURRO, oltre TORREVENTO. Andate a vedere cosa succede.');
  await say('PROF: E lungo la strada registrate più FAUNI che potete. Ogni dato mi aiuta a capire.');
  await say('{RIVAL}: Ci arriverò prima io! Ci vediamo, {NAME}!');
  setF('rival_left');
}

// ============================================================
//  SENTIERO 1
// ============================================================
MAPS.sentiero1 = {
  name: 'Sentiero 1',
  rows: [
    'TTTTTTTTT..TTTTTTTTT',
    'T,,,,....==....,,,,T',
    'T,,,,....==....,,,,T',
    'T........==........T',
    'TTTTT....==....TTTTT',
    'T,,,,,,..==........T',
    'T,,,,,,..==..rr....T',
    'T,,,,,,..==........T',
    'Tvvvvvvvv..vvvvvvvvT',
    'T........==....,,,,T',
    'T..TT....==....,,,,T',
    'T..TT....==....,,,,T',
    'T........==........T',
    'T,,,,,,,,==,,,,,,,,T',
    'T,,,,,,,,==,,,,,,,,T',
    'T........==..S.....T',
    'TTTTTTTTT..TTTTTTTTT',
  ],
  links: {down: {to: 'borgo'}, up: {to: 'torrevento'}},
  signs: [{x: 13, y: 15, text: 'SENTIERO 1|BORGO AURORA ↓   ↑ TORREVENTO'}],
  wild: {rate: 0.12, list: [['topino', 2, 4, 4], ['passerillo', 2, 4, 4], ['bruchetto', 3, 4, 2]]},
  npcs: [
    {id: 'walker', x: 11, y: 10, look: 'woman', dir: 'left', talk: async () => {
      if (!F('s1_gift')) {
        await say('Ciao! Sei un allenatore alle prime armi, vero? Si vede da come tieni il FAUNARIO.');
        setF('s1_gift');
        await give('tonico', 2);
        await say('Un TONICO rimette in sesto un FAUNO stanco. Usalo dalla BORSA, anche durante la lotta.');
      } else await say('A TORREVENTO c\'è un CENTRO CURA. Lì curano i FAUNI gratis.');
    }},
    {id: 'jumper', x: 4, y: 9, look: 'kid', dir: 'up', text: 'Vedi quei gradini di terra? Puoi saltarli verso sud, ma non risalirli. È una scorciatoia per tornare a casa!'},
  ],
};

// ============================================================
//  TORREVENTO
// ============================================================
MAPS.torrevento = {
  name: 'Torrevento',
  rows: [
    'TTTTTTTTT..TTTTTTTTT',
    'T........==........T',
    'T.RRRR...==...MMMM.T',
    'T.WwDW...==...WwDW.T',
    'T........==........T',
    'T..S.....==.....YY.T',
    'T........==.....YY.T',
    'T.CCCC...==........T',
    'T.WwDW...==...RRRR.T',
    'T........==...WDwW.T',
    'T.ff.....==........T',
    'T........==....ff..T',
    'TTTTTTTTT..TTTTTTTTT',
  ],
  doors: {'4,3': 'tv_casa1', '16,3': 'tv_bottega', '4,8': 'tv_centro', '15,9': 'tv_casa2'},
  links: {down: {to: 'sentiero1'}, up: {to: 'sentiero2'}},
  signs: [{x: 3, y: 5, text: 'TORREVENTO|La città dei mulini, dove il vento non dorme mai.'}],
  npcs: [
    {id: 'miller', x: 15, y: 6, look: 'old', dir: 'down', text: 'I mulini girano da trecento anni. Ma da un mese il vento ha uno strano odore... di ferro.'},
    {id: 'woman', x: 12, y: 4, look: 'woman', dir: 'left', text: 'Sono passati degli uomini in giacca grigia. Hanno comprato tutte le SFERE della BOTTEGA!|Per fortuna stamattina è arrivato un carico nuovo.'},
    {id: 'kid', x: 6, y: 10, look: 'kid', dir: 'up', text: 'Il CENTRO CURA è quello col tetto a croce. I FAUNI escono di lì pieni di energia!'},
  ],
};
center('tv_centro', {to: 'torrevento', x: 4, y: 9}, [
  {id: 'trav', x: 2, y: 4, look: 'hiker', dir: 'right', text: 'Il PC nell\'angolo serve a depositare i FAUNI in più. Puoi portarne con te al massimo sei.'},
]);
bottega('tv_bottega', {to: 'torrevento', x: 16, y: 4}, ['sfera', 'tonico', 'antidoto', 'scioglinervi', 'campanella'], [
  {id: 'cust', x: 6, y: 5, look: 'man', dir: 'up', text: 'Un consiglio: porta sempre un ANTIDOTO. Nel BOSCO SUSSURRO ci sono FAUNI velenosi.'},
]);
house('tv_casa1', {to: 'torrevento', x: 4, y: 4}, [
  {id: 'grandma', x: 5, y: 3, look: 'oldw', dir: 'down', text: 'Quando ero giovane, la SORGENTE del bosco si vedeva brillare fin da qui, di notte.|Ora c\'è solo buio.'},
]);
house('tv_casa2', {to: 'torrevento', x: 15, y: 10}, [
  {id: 'teacher', x: 4, y: 2, look: 'man', dir: 'down', text: [
    'Sono il maestro di TORREVENTO. Ecco la lezione di oggi!',
    'L\'ACQUA spegne il FUOCO. Il FUOCO brucia le PIANTE. Le PIANTE bevono l\'ACQUA.',
    'E la ROCCIA? Teme l\'ACQUA e le PIANTE, e l\'ELETTRO non le fa nemmeno il solletico.',
  ]},
]);

// ============================================================
//  SENTIERO 2
// ============================================================
MAPS.sentiero2 = {
  name: 'Sentiero 2',
  rows: [
    'TTTTTTTTT..TTTTTTTTT',
    'T,,,,,...==...,,,,,T',
    'T,,,,,...==...,,,,,T',
    'T.....TT.==.TT.....T',
    'T.rr..TT.==.TT..rr.T',
    'T........==........T',
    'TTTTT....==....TTTTT',
    'T,,,,,,,.==.,,,,,,,T',
    'T,,,,,,,.==.,,,,,,,T',
    'T........==........T',
    'T..S.....==...TTT..T',
    'T........==...TTT..T',
    'Tvvvvvvv.==.vvvvvvvT',
    'T........==........T',
    'T,,,,,...==....,,,,T',
    'T,,,,,...==....,,,,T',
    'T........==........T',
    'TTTTTTTTT..TTTTTTTTT',
  ],
  links: {down: {to: 'torrevento'}, up: {to: 'bosco'}},
  signs: [{x: 3, y: 10, text: 'SENTIERO 2|↑ BOSCO SUSSURRO'}],
  wild: {rate: 0.12, list: [['topino', 3, 5, 3], ['passerillo', 3, 5, 3], ['bruchetto', 3, 5, 2], ['serpillo', 4, 5, 1], ['lucciolo', 4, 5, 1]]},
  npcs: [
    {id: 'dario', x: 7, y: 5, look: 'kid', dir: 'right', trainer: {cls: 'RAGAZZINO', name: 'DARIO', sight: 4, team: [['topino', 4], ['topino', 5]], money: 60,
      intro: 'Ehi! I nostri sguardi si sono incrociati. Si lotta!',
      lose: 'Non vale! Il mio TOPINO aveva fame.',
      after: 'Allenati nell\'erba alta: i FAUNI si rafforzano solo lottando.'}},
    {id: 'elisa', x: 12, y: 9, look: 'scout', dir: 'left', trainer: {cls: 'ESPLORATRICE', name: 'ELISA', sight: 4, team: [['bruchetto', 5], ['bozzolino', 5]], money: 70,
      intro: 'Gli insetti sono i FAUNI più sottovalutati di VALCORONA! Te lo dimostro!',
      lose: 'Ok... forse qualche motivo per sottovalutarli c\'è.',
      after: 'BRUCHETTO diventa un bozzolo prestissimo. E poi... aspetta e vedrai!'}},
    {id: 'it1', x: 1, y: 9, look: 'ball', item: 'tonico', show: () => !F('I:sentiero2:it1')},
  ],
};

// ============================================================
//  BOSCO SUSSURRO
// ============================================================
MAPS.bosco = {
  name: 'Bosco Sussurro',
  spring: 'sorgente1',
  rows: [
    'TTTTTTTT..TTTTTTTTTT',
    'TTTTTTTT..TTTTTTTTTT',
    'TTTTTTTTT.TTTTTTTTTT',
    'TTTTTT.....TTTTTTTTT',
    'TTTTT..OO...TTTTTTTT',
    'TTTTT..OO...TTTTTTTT',
    'TTTTT.......,,,,TTTT',
    'TT,,,,.......,,,,TTT',
    'TT,,,,TTT..TTT,,,TTT',
    'TT,,,,TTT..TTT,,,TTT',
    'TT......T..T.....TTT',
    'TTTTT...T..T...TTTTT',
    'TTTTT,,,,..,,,,,TTTT',
    'TT,,,,,,,..,,,,,,,TT',
    'TT,,TTTTT..TTTTT,,TT',
    'TT,,T.........T.,,TT',
    'TT..T.TTTTTTT.T...TT',
    'TT..T.T,,,,,T.T...TT',
    'TT....T,,,,,T.....TT',
    'TTTTTTT.....TTTT..TT',
    'TT.......TTTTT....TT',
    'TT.....,,,,,,.....TT',
    'TTTTTTTTT..TTTTTTTTT',
    'TTTTTTTTT..TTTTTTTTT',
  ],
  links: {down: {to: 'sentiero2'}, up: {to: 'pietrafonda', d: 0}},
  wild: {rate: 0.14, list: [['bruchetto', 4, 6, 3], ['bozzolino', 5, 6, 2], ['lucciolo', 5, 7, 2], ['funghetto', 5, 7, 2], ['pipistrino', 5, 7, 2], ['ombretto', 6, 7, 1]]},
  signs: [],
  npcs: [
    {id: 'nino', x: 2, y: 10, look: 'kid', dir: 'right', trainer: {cls: 'CACCIABRUCHI', name: 'NINO', sight: 5, team: [['bruchetto', 6], ['bozzolino', 6]], money: 70,
      intro: 'Shhh! Stavo per prendere un LUCCIOLO! Adesso me la paghi!',
      lose: 'Il LUCCIOLO è scappato E ho perso. Giornata no.',
      after: 'Di notte il bosco brillava di LUCCIOLI. Da quando la SORGENTE si è spenta ne vedo pochissimi.'}},
    {id: 'rita', x: 15, y: 15, look: 'woman', dir: 'left', trainer: {cls: 'ESCURSIONISTA', name: 'RITA', sight: 4, team: [['funghetto', 7]], money: 90,
      intro: 'Ti sei perso? Tranquillo, dopo la lotta ti indico la strada!',
      lose: 'Bene, almeno non ti sei perso nella lotta.',
      after: 'La SORGENTE è a nord. Ho visto gente vestita di grigio armeggiare là intorno.'}},
    {id: 'it1', x: 2, y: 13, look: 'ball', item: 'antidoto', show: () => !F('I:bosco:it1')},
    {id: 'it2', x: 17, y: 20, look: 'ball', item: 'sfera', n: 2, show: () => !F('I:bosco:it2')},
    {id: 'grigio', x: 9, y: 2, look: 'grigio', dir: 'down', show: () => !F('sorgente1'), talk: () => springScene()},
    {id: 'rival', x: 6, y: 4, look: 'rival', dir: 'right', show: () => F('rival_bosco') && !F('rival_bosco_left'), text: '{RIVAL}: Alla PALESTRA di PIETRAFONDA vinco io. Tienilo a mente!'},
  ],
  triggers: [
    {x: 6, y: 3, w: 5, when: () => !F('sorgente1'), run: () => springScene()},
  ],
};

async function springScene() {
  const g = NPCS.find(n => n.id === 'grigio');
  await say('???: Ehi, tu! Zona chiusa. Lavori del CONSORZIO GRIGIO.');
  if (player.x !== 9) await npcWalk(g, ['down']); // il Grigio scende verso di te
  faceEachOther(g);
  await say('RECLUTA GRIGIA: Questa SORGENTE adesso è proprietà del CONSORZIO. La LINFA vale oro, e noi la imbottigliamo.');
  await say('RECLUTA GRIGIA: Hai visto la VALVOLA che ho montato? Un capolavoro. Neanche una goccia va sprecata.');
  await say('RECLUTA GRIGIA: Non ti piace? Allora fatti da parte... o te ne faccio pentire!');
  const res = await battle({trainer: {look: 'grigio', cls: 'RECLUTA', name: 'GRIGIA', team: [['pipistrino', 7], ['topino', 8]], money: 150,
    lose: 'Che cosa?! Un ragazzino mi ha messo al tappeto?'}});
  if (res !== 'win') return;
  await say('RECLUTA GRIGIA: Va bene, va bene! Me ne vado... ma il DIRETTORE CENERI non ne sarà contento.');
  await say('RECLUTA GRIGIA: E la VALVOLA... tienila pure. Ne abbiamo a centinaia!');
  setF('sorgente1');
  screenEl.classList.add('flash'); await sleep(800); screenEl.classList.remove('flash');
  await say('{NAME} stacca la VALVOLA GRIGIA. La SORGENTE torna a brillare!');
  await say('Una goccia di LINFA si condensa sul bordo della pietra e cade in una fiala vuota abbandonata dal CONSORZIO.');
  addItem('fiala', 1);
  await say('{NAME} riceve la FIALA DI LINFA!');
  healParty();
  await say('La luce della SORGENTE avvolge i tuoi FAUNI. Sono in piena forma!');
  // arriva il rivale
  setF('rival_bosco');
  const r = NPCS.find(n => n.id === 'rival');
  faceEachOther(r);
  await say('{RIVAL}: Ehi! Ma... l\'hai riaccesa tu?');
  await say('{RIVAL}: Ho visto scappare uno vestito di grigio. Il CONSORZIO GRIGIO, eh? Mio padre dice che stanno comprando mezza valle.');
  await say('{RIVAL}: Va bene, stavolta mi hai battuto sul tempo. Ma alla PALESTRA di PIETRAFONDA, qui a nord, vinco io!');
  setF('rival_bosco_left');
}

// ============================================================
//  PIETRAFONDA
// ============================================================
MAPS.pietrafonda = {
  name: 'Pietrafonda',
  rows: [
    'TTTTTTTTTTTTTTTTTTTT',
    'Tr......rrr......rrT',
    'T..GGGGGG....RRRR..T',
    'T..GGGGGG....WwDW..T',
    'T..WwwDwW..........T',
    'T.......=..........T',
    'T.S.....=.......S..T',
    'T.......============',
    'T..CCCC.=....MMMM..T',
    'T..WwDW.=....WwDW..T',
    'T.......=........r.T',
    'T.rr....=......rr..T',
    'T.......=..........T',
    'TTTTTTTT..TTTTTTTTTT',
  ],
  doors: {'6,4': 'pf_palestra', '15,3': 'pf_casa', '5,9': 'pf_centro', '15,9': 'pf_bottega'},
  links: {down: {to: 'bosco'}},
  signs: [
    {x: 2, y: 6, text: 'PIETRAFONDA|Scolpita nella roccia, fondata sulla pazienza.'},
    {x: 16, y: 6, text: 'PASSO DEL GUFO →|Chiuso per frana.'},
  ],
  npcs: [
    {id: 'worker', x: 18, y: 7, look: 'worker', dir: 'left', text: 'Alt! Il PASSO DEL GUFO è chiuso: c\'è stata una frana.|Strano, però... Non pioveva da settimane.|(Il viaggio continua nel CAPITOLO 2.)'},
    {id: 'miner', x: 11, y: 11, look: 'miner', dir: 'left', text: 'Le cave di PIETRAFONDA sono le più antiche della valle. Ci vivono un sacco di SASSOLO.|Attento a dove metti i piedi: a volte ti guardano.'},
    {id: 'gymguy', x: 9, y: 5, look: 'man', dir: 'down', text: 'La capopalestra BRUNA è un muro. Nessuno l\'ha mai vista arretrare di un passo.'},
    {id: 'rival', x: 7, y: 6, look: 'rival', dir: 'up', show: () => F('badge1') && !F('ch1_end'), text: '...'},
  ],
  onEnter: async () => { if (F('badge1') && !F('ch1_end')) await chapterEnd(); },
};
center('pf_centro', {to: 'pietrafonda', x: 5, y: 10}, [
  {id: 'girl', x: 8, y: 4, look: 'girl', dir: 'left', text: 'Ho sentito che i FAUNI di tipo ELETTRO non riescono proprio a scalfire quelli di ROCCIA. Poverini!'},
]);
bottega('pf_bottega', {to: 'pietrafonda', x: 15, y: 10}, ['sfera', 'tonico', 'supertonico', 'antidoto', 'scioglinervi', 'campanella', 'unguento']);
house('pf_casa', {to: 'pietrafonda', x: 15, y: 4}, [
  {id: 'old', x: 6, y: 3, look: 'old', dir: 'left', text: [
    'Anche sotto le cave c\'è una SORGENTE. Da qualche giorno l\'acqua del pozzo sa di metallo.',
    'Il CONSORZIO GRIGIO è venuto a fare "sondaggi geologici". Sì, sì... sondaggi.',
  ]},
]);

MAPS.pf_palestra = {
  name: 'Palestra di Pietrafonda', indoor: true,
  rows: [
    '############',
    '#r___oo___r#',
    '#__________#',
    '#rr______rr#',
    '#__________#',
    '#____rr____#',
    '#__________#',
    '#rr______rr#',
    '#__________#',
    '#o________o#',
    '#__________#',
    '#####mm#####',
  ],
  exit: {to: 'pietrafonda', x: 6, y: 5},
  npcs: [
    {id: 'guide', x: 3, y: 10, look: 'man', dir: 'right', talk: async () => {
      if (!F('badge1')) {
        await say('Ciao, sfidante! Un consiglio gratis: la ROCCIA teme ACQUA e PIANTE.');
        await say('I colpi di tipo ELETTRO, invece, lasciali a casa: qui non servono a niente.');
      } else await say('Ce l\'hai fatta! La prima MEDAGLIA non si scorda mai.');
    }},
    {id: 'gino', x: 8, y: 6, look: 'miner', dir: 'left', trainer: {cls: 'MINATORE', name: 'GINO', sight: 4, team: [['sassolo', 8], ['topino', 9]], money: 130,
      intro: 'Prima di arrivare da BRUNA devi scavare attraverso di me!',
      lose: 'Sono rimasto senza piccone!',
      after: 'BRUNA usa INDURIMENTO. Non lasciarle il tempo di rafforzarsi!'}},
    {id: 'bruna', x: 5, y: 2, look: 'leader', dir: 'down', talk: async (n) => {
      if (F('badge1')) {
        await say('BRUNA: Anche qui sotto la cava la SORGENTE si sta spegnendo. Il CONSORZIO è venuto a "sondare" il terreno.');
        await say('BRUNA: Se vai verso il PASSO DEL GUFO, tieni gli occhi aperti. Quella frana non mi convince.');
        return;
      }
      await say('BRUNA: Sono BRUNA, capopalestra di PIETRAFONDA.');
      await say('BRUNA: La roccia non si muove, non si piega e non si arrende. I miei FAUNI sono uguali.');
      await say('BRUNA: Vediamo se hai la pazienza di scalfirli!');
      const res = await battle({trainer: {look: 'leader', cls: 'CAPOPALESTRA', name: 'BRUNA', team: [['sassolo', 10], ['macigno', 12]], money: 600,
        lose: 'BRUNA: Una crepa... poi una frana. Hai vinto tu.'}});
      if (res !== 'win') return;
      G.badges.push(1); setF('badge1');
      await say('BRUNA: Ecco la MEDAGLIA CIOTTOLO. Dimostra che hai superato la palestra di PIETRAFONDA.');
      await say('{NAME} riceve la MEDAGLIA CIOTTOLO!');
      await say('BRUNA: Con questa i FAUNI fino al livello 20 ti obbediranno anche se li ricevi da altri.');
      await say('BRUNA: E prendi questi. Sulla strada ti serviranno più di quanto pensi.');
      await give('supertonico', 2);
    }},
  ],
};

async function chapterEnd() {
  const r = NPCS.find(n => n.id === 'rival');
  faceEachOther(r);
  await say('{RIVAL}: {NAME}! Già fatto anche tu? Guarda qua!');
  await say('{RIVAL} ti mostra con orgoglio una MEDAGLIA CIOTTOLO tutta lucida.');
  await say('{RIVAL}: L\'ho vinta un\'ora fa. Quindi tecnicamente sono arrivato primo. Tecnicamente.');
  await say('{RIVAL}: Ho parlato con BRUNA. Pensa che la frana al PASSO DEL GUFO non sia un incidente. C\'entra il CONSORZIO GRIGIO.');
  await say('{RIVAL}: Appena riaprono il passo vado a vedere. E stavolta arrivo prima io, sul serio!');
  setF('ch1_end');
  await say('— FINE DEL CAPITOLO 1 —|Il viaggio continua nel prossimo aggiornamento: il PASSO DEL GUFO, LAGOPIANO e la seconda SORGENTE.');
  await say('Ricordati di salvare dal menu START!');
}

// ============================================================
//  INTRODUZIONE
// ============================================================
async function introScene() {
  mode = 'intro';
  introPic = 'prof';
  await say('Ciao! Benvenuto nella valle di VALCORONA!');
  await say('Mi chiamo ILARIA VENTURA, ma qui tutti mi chiamano semplicemente la PROF.');
  introPic = 'lucciolo';
  await say('Questa terra è abitata da creature chiamate FAUNI.');
  await say('Nascono dalla LINFA, l\'energia che scorre sotto le colline e affiora nelle SORGENTI.');
  await say('C\'è chi li alleva, chi lotta insieme a loro, chi li dipinge... Io studio il legame tra i FAUNI e le SORGENTI.');
  introPic = 'player';
  await say('Ma parliamo di te. Come ti chiami?', {keep: true});
  const names = ['ALE', 'SAM', 'NICO', 'VALE'];
  const i = await choose(names, {x: 104, y: 40, w: 56, cancel: false});
  G.name = names[i]; hideTextBox();
  await say('{NAME}! Che bel nome.');
  introPic = 'rival';
  await say('E lui è il figlio del guardiano del faro. Come si chiamava...?', {keep: true});
  const rn = ['TEO', 'IVO', 'LEO', 'MAX'];
  const j = await choose(rn, {x: 104, y: 40, w: 56, cancel: false});
  G.rival = rn[j]; hideTextBox();
  await say('Giusto, {RIVAL}! Siete cresciuti insieme, e da sempre fate a gara su tutto.');
  introPic = 'player';
  await say('{NAME}, la tua storia con i FAUNI sta per cominciare. Ti aspetto al LABORATORIO!');
  introPic = null;
  await fadeOut();
  mode = 'world';
  loadMap('casa_p', 3, 4, 'down');
  await fadeIn();
}
