// ============================================================
//  FAUNI DI VALCORONA — dati di gioco (tipi, mosse, specie, strumenti)
// ============================================================

const TYPES = ['NORMALE','FUOCO','ACQUA','PIANTA','ELETTRO','ROCCIA','VENTO','OMBRA','MENTE','INSETTO','VELENO'];
const SPECIAL_TYPES = new Set(['FUOCO','ACQUA','PIANTA','ELETTRO','MENTE']);

// efficacia [attacco][difesa]; valori assenti = 1
const CHART = {
  NORMALE: {ROCCIA:.5, OMBRA:0},
  FUOCO:   {PIANTA:2, INSETTO:2, FUOCO:.5, ACQUA:.5, ROCCIA:.5},
  ACQUA:   {FUOCO:2, ROCCIA:2, ACQUA:.5, PIANTA:.5},
  PIANTA:  {ACQUA:2, ROCCIA:2, FUOCO:.5, PIANTA:.5, VENTO:.5, INSETTO:.5, VELENO:.5},
  ELETTRO: {ACQUA:2, VENTO:2, ELETTRO:.5, PIANTA:.5, ROCCIA:0},
  ROCCIA:  {FUOCO:2, ELETTRO:2, VENTO:2, INSETTO:2, PIANTA:.5},
  VENTO:   {PIANTA:2, INSETTO:2, ELETTRO:.5, ROCCIA:.5},
  OMBRA:   {MENTE:2, OMBRA:2, NORMALE:0},
  MENTE:   {VELENO:2, MENTE:.5},
  INSETTO: {PIANTA:2, MENTE:2, FUOCO:.5, VENTO:.5, VELENO:.5},
  VELENO:  {PIANTA:2, VELENO:.5, ROCCIA:.5, OMBRA:.5},
};

// p = potenza, a = precisione (0 = non manca mai), pp, fx = effetti
const MOVES = {
  botta:       {n:'BOTTA', t:'NORMALE', p:40, a:100, pp:35},
  graffio:     {n:'GRAFFIO', t:'NORMALE', p:40, a:100, pp:35},
  ringhio:     {n:'RINGHIO', t:'NORMALE', p:0, a:100, pp:40, fx:{stat:'atk', d:-1, foe:1}},
  sguardo:     {n:'SGUARDO TORVO', t:'NORMALE', p:0, a:100, pp:30, fx:{stat:'def', d:-1, foe:1}},
  sabbia:      {n:'PUGNO DI SABBIA', t:'ROCCIA', p:0, a:100, pp:15, fx:{stat:'acc', d:-1, foe:1}},
  zuffa:       {n:'ZUFFA', t:'NORMALE', p:70, a:100, pp:20},
  rapido:      {n:'SCATTO', t:'NORMALE', p:40, a:100, pp:30, prio:1},
  brace:       {n:'BRACE', t:'FUOCO', p:40, a:100, pp:25, fx:{st:'brn', ch:.1}},
  fiammata:    {n:'FIAMMATA', t:'FUOCO', p:70, a:100, pp:15, fx:{st:'brn', ch:.1}},
  rogo:        {n:'ROGO', t:'FUOCO', p:95, a:100, pp:15, fx:{st:'brn', ch:.1}},
  spruzzo:     {n:'SPRUZZO', t:'ACQUA', p:40, a:100, pp:25},
  getto:       {n:"GETTO D'ACQUA", t:'ACQUA', p:65, a:100, pp:20},
  maroso:      {n:'MAROSO', t:'ACQUA', p:95, a:100, pp:15},
  frustata:    {n:'FRUSTA FOGLIA', t:'PIANTA', p:45, a:100, pp:25},
  assorbi:     {n:'SORSO DI LINFA', t:'PIANTA', p:30, a:100, pp:20, fx:{drain:.5}},
  lamafoglia:  {n:'LAMA FOGLIA', t:'PIANTA', p:70, a:95, pp:15},
  sonnifero:   {n:'POLLINE SONNIFERO', t:'PIANTA', p:0, a:75, pp:15, fx:{st:'slp', ch:1}},
  crescita:    {n:'GERMOGLIO', t:'PIANTA', p:0, a:0, pp:20, fx:{stat:'atk', d:1}},
  velenpolvere:{n:'POLVERE TOSSICA', t:'VELENO', p:0, a:75, pp:30, fx:{st:'psn', ch:1}},
  pungiglione: {n:'PUNGIGLIONE', t:'VELENO', p:20, a:100, pp:35, fx:{st:'psn', ch:.3}},
  acido:       {n:'ACIDO', t:'VELENO', p:45, a:100, pp:30, fx:{stat:'def', d:-1, foe:1, ch:.1}},
  raffica:     {n:'RAFFICA', t:'VENTO', p:40, a:100, pp:35},
  beccata:     {n:'BECCATA', t:'VENTO', p:35, a:100, pp:35},
  picchiata:   {n:'PICCHIATA', t:'VENTO', p:75, a:95, pp:15},
  scossa:      {n:'SCOSSA', t:'ELETTRO', p:40, a:100, pp:30, fx:{st:'par', ch:.1}},
  ondavolt:    {n:'ONDA VOLT', t:'ELETTRO', p:0, a:100, pp:20, fx:{st:'par', ch:1}},
  saetta:      {n:'SAETTA', t:'ELETTRO', p:90, a:100, pp:15, fx:{st:'par', ch:.1}},
  sassata:     {n:'SASSATA', t:'ROCCIA', p:50, a:90, pp:20},
  frana:       {n:'FRANA', t:'ROCCIA', p:75, a:90, pp:10},
  indurisci:   {n:'INDURIMENTO', t:'NORMALE', p:0, a:0, pp:30, fx:{stat:'def', d:1}},
  agilita:     {n:'AGILITÀ', t:'MENTE', p:0, a:0, pp:30, fx:{stat:'spd', d:2}},
  pensiero:    {n:'PENSIERO', t:'MENTE', p:50, a:100, pp:25},
  psicoonda:   {n:'PSICOONDA', t:'MENTE', p:85, a:100, pp:10},
  leccata:     {n:'LECCATA', t:'OMBRA', p:30, a:100, pp:30, fx:{st:'par', ch:.3}},
  morso:       {n:'MORSO', t:'OMBRA', p:60, a:100, pp:25},
  tenebra:     {n:'TENEBRA', t:'OMBRA', p:80, a:100, pp:15},
  filo:        {n:'FILO DI SETA', t:'INSETTO', p:0, a:95, pp:40, fx:{stat:'spd', d:-1, foe:1}},
  mandibola:   {n:'MANDIBOLA', t:'INSETTO', p:50, a:100, pp:20},
  riposo:      {n:'RIPOSINO', t:'NORMALE', p:0, a:0, pp:10, fx:{heal:.5}},
};

// b = statistiche base [ps, att, dif, vel, spe]
// fam = famiglia (stesso seme grafico), st = stadio evolutivo
// evo = [livello, specie], cr = tasso di cattura, xp = esperienza ceduta
const SPECIES_LIST = [
  ['fogliotto','FOGLIOTTO',['PIANTA'],[45,49,49,45,65],{fam:'fog',st:1,evo:[16,'rovetto'],cr:45,xp:64,
    learn:[[1,'botta'],[1,'ringhio'],[7,'assorbi'],[12,'velenpolvere'],[15,'frustata'],[20,'sonnifero'],[27,'lamafoglia']],
    d:'Nasce dai semi portati dal mare. Dorme con le foglie rivolte al sole e si sveglia solo quando ha sete.'}],
  ['rovetto','ROVETTO',['PIANTA','VELENO'],[60,62,63,60,80],{fam:'fog',st:2,evo:[32,'selvarco'],cr:45,xp:141,
    learn:[[1,'botta'],[1,'ringhio'],[7,'assorbi'],[12,'velenpolvere'],[15,'frustata'],[20,'sonnifero'],[30,'lamafoglia'],[36,'crescita']],
    d:'Le spine sulla schiena crescono di notte. Chi lo accarezza contropelo se ne pente per giorni.'}],
  ['selvarco','SELVARCO',['PIANTA','VELENO'],[80,82,83,80,100],{fam:'fog',st:3,cr:45,xp:208,
    learn:[[1,'botta'],[1,'velenpolvere'],[1,'frustata'],[20,'sonnifero'],[30,'lamafoglia'],[36,'crescita']],
    d:'Una piccola foresta che cammina. Gli uccelli vi fanno il nido senza che lui se ne accorga.'}],

  ['fiammolo','FIAMMOLO',['FUOCO'],[39,52,43,65,50],{fam:'fia',st:1,evo:[16,'braciore'],cr:45,xp:65,
    learn:[[1,'graffio'],[1,'ringhio'],[7,'brace'],[13,'sguardo'],[17,'rapido'],[22,'fiammata'],[38,'rogo']],
    d:'Tiene sempre in bocca una piccola brace. Se la perde, piange finché non la riaccende.'}],
  ['braciore','BRACIORE',['FUOCO'],[58,64,58,80,65],{fam:'fia',st:2,evo:[36,'vulcanide'],cr:45,xp:142,
    learn:[[1,'graffio'],[1,'brace'],[13,'sguardo'],[17,'rapido'],[24,'fiammata'],[40,'rogo']],
    d:'Il suo pelo scintilla come carbone acceso. Quando è nervoso, l\'aria intorno trema per il calore.'}],
  ['vulcanide','VULCANIDE',['FUOCO','ROCCIA'],[78,84,78,100,85],{fam:'fia',st:3,cr:45,xp:209,
    learn:[[1,'graffio'],[1,'brace'],[1,'fiammata'],[36,'frana'],[44,'rogo']],
    d:'Sul dorso porta una cresta di roccia fusa. Dove si addormenta, il terreno resta caldo per una settimana.'}],

  ['gocciolo','GOCCIOLO',['ACQUA'],[44,48,65,43,50],{fam:'goc',st:1,evo:[16,'ondalo'],cr:45,xp:66,
    learn:[[1,'botta'],[1,'sguardo'],[7,'spruzzo'],[13,'morso'],[18,'getto'],[24,'indurisci'],[38,'maroso']],
    d:'Il suo corpo è per metà acqua di mare. Se si secca, rotola fino alla pozzanghera più vicina.'}],
  ['ondalo','ONDALO',['ACQUA'],[59,63,80,58,65],{fam:'goc',st:2,evo:[36,'abissaldo'],cr:45,xp:143,
    learn:[[1,'botta'],[1,'spruzzo'],[13,'morso'],[19,'getto'],[25,'indurisci'],[42,'maroso']],
    d:'Nuota controcorrente per allenarsi. Il suo guscio risuona come una conchiglia.'}],
  ['abissaldo','ABISSALDO',['ACQUA'],[79,83,100,78,85],{fam:'goc',st:3,cr:45,xp:210,
    learn:[[1,'botta'],[1,'spruzzo'],[1,'getto'],[25,'indurisci'],[46,'maroso']],
    d:'Riposa sui fondali più profondi. Quando emerge, il livello del mare si alza di un palmo.'}],

  ['bruchetto','BRUCHETTO',['INSETTO'],[45,30,35,45,20],{fam:'bru',st:1,evo:[7,'bozzolino'],cr:255,xp:53,
    learn:[[1,'botta'],[1,'filo']],
    d:'Mangia il doppio del suo peso in foglie ogni giorno. Ha sempre l\'aria soddisfatta.'}],
  ['bozzolino','BOZZOLINO',['INSETTO'],[50,20,55,30,25],{fam:'bru',st:2,evo:[10,'farfalia'],cr:120,xp:72,
    learn:[[1,'indurisci']],
    d:'Resta immobile appeso ai rami. Dentro il bozzolo si sente un ronzio leggero.'}],
  ['farfalia','FARFALIA',['INSETTO','VENTO'],[60,45,50,70,80],{fam:'bru',st:3,cr:45,xp:160,
    learn:[[1,'raffica'],[12,'sonnifero'],[15,'pensiero'],[18,'velenpolvere'],[26,'picchiata']],
    d:'Le sue ali lasciano una scia di polvere colorata. Le notti di luna piena danza sui laghi.'}],

  ['passerillo','PASSERILLO',['NORMALE','VENTO'],[40,45,40,56,35],{fam:'pas',st:1,evo:[18,'falcastro'],cr:255,xp:55,
    learn:[[1,'beccata'],[5,'sabbia'],[12,'rapido'],[19,'raffica']],
    d:'Si posa sui fili dei mulini e chiacchiera tutto il giorno con i suoi simili.'}],
  ['falcastro','FALCASTRO',['NORMALE','VENTO'],[63,60,55,71,50],{fam:'pas',st:2,cr:120,xp:113,
    learn:[[1,'beccata'],[1,'sabbia'],[12,'rapido'],[21,'raffica'],[28,'picchiata']],
    d:'Plana per ore senza battere le ali. Dall\'alto riconosce un bruco a cento metri.'}],

  ['topino','TOPINO',['NORMALE'],[30,56,35,72,25],{fam:'top',st:1,evo:[20,'rosicone'],cr:255,xp:57,
    learn:[[1,'botta'],[1,'ringhio'],[7,'rapido'],[14,'morso'],[23,'zuffa']],
    d:'Rosicchia qualsiasi cosa per tenere a bada i denti, che non smettono mai di crescere.'}],
  ['rosicone','ROSICONE',['NORMALE'],[55,81,60,97,50],{fam:'top',st:2,cr:90,xp:116,
    learn:[[1,'botta'],[1,'ringhio'],[7,'rapido'],[14,'morso'],[27,'zuffa']],
    d:'Scava tane con dieci uscite diverse. Se ne chiudi una, ne apre altre due.'}],

  ['lucciolo','LUCCIOLO',['INSETTO','ELETTRO'],[40,35,40,60,55],{fam:'luc',st:1,evo:[22,'fulgella'],cr:190,xp:62,
    learn:[[1,'scossa'],[1,'filo'],[9,'ondavolt'],[14,'mandibola']],
    d:'La sua coda si illumina quando è felice. Nei boschi, gruppi di LUCCIOLO sembrano stelle cadute.'}],
  ['fulgella','FULGELLA',['INSETTO','ELETTRO'],[65,55,60,90,85],{fam:'luc',st:2,cr:75,xp:150,
    learn:[[1,'scossa'],[1,'ondavolt'],[14,'mandibola'],[30,'saetta']],
    d:'Accumula elettricità durante i temporali e la rilascia in lampi accecanti.'}],

  ['sassolo','SASSOLO',['ROCCIA'],[40,80,100,20,30],{fam:'sas',st:1,evo:[25,'macigno'],cr:255,xp:73,
    learn:[[1,'botta'],[1,'indurisci'],[6,'sabbia'],[11,'sassata'],[26,'frana']],
    d:'Passa giornate intere fermo nelle cave. I minatori lo scambiano spesso per un sasso qualunque.'}],
  ['macigno','MACIGNO',['ROCCIA'],[55,95,115,35,45],{fam:'sas',st:2,cr:120,xp:134,
    learn:[[1,'botta'],[1,'indurisci'],[6,'sabbia'],[11,'sassata'],[29,'frana']],
    d:'Rotola giù dai pendii per spostarsi. Non frena mai: sono gli ostacoli a spostarsi.'}],

  ['ombretto','OMBRETTO',['OMBRA'],[30,35,30,80,100],{fam:'omb',st:1,evo:[25,'spettrillo'],cr:190,xp:95,
    learn:[[1,'leccata'],[1,'sguardo'],[12,'morso'],[29,'tenebra']],
    d:'Vive nell\'ombra dei vecchi alberi. Se lo guardi fisso, sparisce e riappare alle tue spalle.'}],
  ['spettrillo','SPETTRILLO',['OMBRA','VELENO'],[45,50,45,95,115],{fam:'omb',st:2,cr:90,xp:126,
    learn:[[1,'leccata'],[1,'sguardo'],[12,'morso'],[29,'tenebra']],
    d:'Ride sottovoce nelle notti senza luna. La sua risata fa appassire i fiori.'}],

  ['funghetto','FUNGHETTO',['PIANTA','VELENO'],[35,70,55,25,55],{fam:'fun',st:1,evo:[24,'fungone'],cr:190,xp:70,
    learn:[[1,'graffio'],[1,'velenpolvere'],[8,'assorbi'],[13,'sonnifero'],[20,'mandibola']],
    d:'Cresce ai piedi delle querce. Le spore del suo cappello fanno starnutire per ore.'}],
  ['fungone','FUNGONE',['PIANTA','VELENO'],[60,95,80,30,80],{fam:'fun',st:2,cr:75,xp:128,
    learn:[[1,'graffio'],[1,'velenpolvere'],[8,'assorbi'],[13,'sonnifero'],[20,'mandibola'],[30,'lamafoglia']],
    d:'Il cappello è così grande che ci si ripara sotto quando piove.'}],

  ['pipistrino','PIPISTRINO',['VENTO','OMBRA'],[40,45,35,55,40],{fam:'pip',st:1,evo:[22,'notturlo'],cr:255,xp:54,
    learn:[[1,'leccata'],[6,'raffica'],[10,'morso'],[22,'picchiata']],
    d:'Dorme a testa in giù nelle grotte. Si orienta col suono e non sbatte mai contro niente.'}],
  ['notturlo','NOTTURLO',['VENTO','OMBRA'],[75,80,70,90,75],{fam:'pip',st:2,cr:90,xp:171,
    learn:[[1,'leccata'],[6,'raffica'],[10,'morso'],[26,'picchiata'],[34,'tenebra']],
    d:'Caccia solo nelle notti senza vento. Le sue ali non fanno alcun rumore.'}],

  ['ranocchio','RANOCCHIO',['ACQUA'],[40,50,40,90,40],{fam:'ran',st:1,evo:[25,'ranone'],cr:225,xp:58,
    learn:[[1,'spruzzo'],[5,'rapido'],[15,'getto']],
    d:'Salta da una ninfea all\'altra senza bagnarsi le zampe. Gracida solo quando piove.'}],
  ['ranone','RANONE',['ACQUA','MENTE'],[65,65,65,90,85],{fam:'ran',st:2,cr:75,xp:140,
    learn:[[1,'spruzzo'],[5,'rapido'],[15,'getto'],[25,'pensiero'],[34,'psicoonda']],
    d:'Medita sulle rive dei laghi. Si dice che preveda i temporali con tre giorni d\'anticipo.'}],

  ['serpillo','SERPILLO',['VELENO'],[35,60,44,55,40],{fam:'ser',st:1,evo:[22,'serpentano'],cr:255,xp:62,
    learn:[[1,'morso'],[1,'sguardo'],[9,'pungiglione'],[17,'acido']],
    d:'Si arrotola sui sassi caldi per digerire. Il sibilo che emette ricorda una teiera.'}],
  ['serpentano','SERPENTANO',['VELENO'],[60,85,69,80,65],{fam:'ser',st:2,cr:90,xp:147,
    learn:[[1,'morso'],[1,'sguardo'],[9,'pungiglione'],[17,'acido'],[30,'zuffa']],
    d:'I disegni sulle sue squame cambiano da valle a valle. Nessuno ne ha mai visti due uguali.'}],
];

const SPECIES = {};
const DEX_ORDER = [];
SPECIES_LIST.forEach(([id,name,types,b,o],i)=>{
  SPECIES[id] = Object.assign({id, name, types, b, num:i+1}, o);
  DEX_ORDER.push(id);
});

const ITEMS = {
  tonico:      {n:'TONICO', price:200, heal:20, d:'Ridà 20 PS a un FAUNO.'},
  supertonico: {n:'SUPERTONICO', price:700, heal:50, d:'Ridà 50 PS a un FAUNO.'},
  antidoto:    {n:'ANTIDOTO', price:100, cure:'psn', d:'Cura l\'avvelenamento.'},
  scioglinervi:{n:'SCIOGLINERVI', price:200, cure:'par', d:'Cura la paralisi.'},
  campanella:  {n:'CAMPANELLA', price:250, cure:'slp', d:'Sveglia un FAUNO addormentato.'},
  unguento:    {n:'UNGUENTO', price:250, cure:'brn', d:'Cura le scottature.'},
  sfera:       {n:'SFERA', price:200, ball:1, d:'Serve a catturare FAUNI selvatici.'},
  sferaforte:  {n:'SFERA FORTE', price:600, ball:1.5, d:'Una SFERA più efficace.'},
  fiala:       {n:'FIALA DI LINFA', key:1, d:'LINFA pura della SORGENTE del BOSCO SUSSURRO. Brilla debolmente.'},
};

const STATUS_LABEL = {psn:'VEL', par:'PAR', slp:'SON', brn:'SCO'};
const STAT_LABEL = {atk:'ATTACCO', def:'DIFESA', spd:'VELOCITÀ', spc:'SPECIALE', acc:'PRECISIONE'};
