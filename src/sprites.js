// ============================================================
//  FAUNI DI VALCORONA — pixel art delle creature (originali)
//  Griglia 24x24. "h" = metà sinistra (12 colonne) specchiata;
//  "f" = riga intera da 24. Lettere: a d w y = colori della specie,
//  e = bianco occhi, k = nero, . = vuoto. Contorno e ombre automatici.
// ============================================================
const ART = {
  fogliotto: {c: {a: '#7cc850', d: '#3f9a3a', w: '#f4efc0'}, h: [
    '', '', '......dd....', '.....dddd...', '....dddddd..', '.....dddd.d.', '..........d.',
    '......aaaaaa', '....aaaaaaaa', '...aaaaaaaaa', '..aaaaaaaaaa', '..aaaekaaaaa', '.aaaakkaaaaa',
    '.aaaakkaaaaa', '.aaaaaaaaaaw', '.aaaaaawwwww', '.aaaaawwwwww', '..aaaawwwwww', '..aaaaawwwww',
    '...aaaaaaaaa', '....aaaaaaaa', '....aaa..aaa', '....aaa..aaa']},
  rovetto: {c: {a: '#5aa64a', d: '#a64a92', w: '#eee8b8'}, h: [
    '', '........d...', '.......ddd..', '...d...ddd..', '...dd..aaaaa', '....daaaaaaa', '...aaaaaaaaa',
    '.d.aaaaaaaaa', '.ddaaaaaaaaa', '..aaaekaaaaa', '..aaakkaaaaa', '.daaakkaaaaa', 'ddaaaaaaaaaw',
    '.daaaaaawwww', '..aaaaawwwww', '.aaaaaawwwww', '.aaaaaaawwww', 'daaaaaaaaaaa', '.aaaaaaaaaaa',
    '..aaaaaaaaaa', '..aaaa...aaa', '..aaaa...aaa', '..aaa....aaa']},
  selvarco: {c: {a: '#8b6a42', d: '#48a648', w: '#c8a070'}, h: [
    '...dddd.....', '.dddddddd.dd', 'dddddddddddd', 'dddddddddddd', '.dddddddddd.', '..ddddaadddd',
    '....aaaaaaaa', '...aaaaaaaaa', '...aaekaaaaa', '...aakkaaaaa', '...aakkaaaaa', '...aaaaaaaaa',
    '.ddaaaaakkkk', 'dddaaaaaaaaa', 'dd.aaawwaaaa', '...aaawwaaaa', '...aaaaaaaaa', '...aaaaaaaaa',
    '..aaaaaaaaaa', '..aaa..aaaaa', '.aaaa..aaaa.', '.aaaa..aaaa.', 'aaaaa.aaaaa.']},

  fiammolo: {c: {a: '#f28a3a', y: '#ffd23a', w: '#fbe3b4'}, h: [
    '', '', '', '...a........', '...aa.......', '...aaa......', '...aaaa...yy', '...aaaaa.yyy',
    '...aaaaaaaya', '..aaaaaaaaaa', '..aaaaaaaaaa', '..aaekaaaaaa', '..aakkaaaaaa', '..aakkaaawww',
    '...aaaaawwwk', '....aaawwwww', '....aaaaaaaa', '...aaaawwwww', '...aaawwwwww', '...aaawwwwww',
    '....aaaaaaaa', '....aa..aa..', '....aa..aa..']},
  braciore: {c: {a: '#e8602e', y: '#ffc83a', w: '#fbe0b0'}, h: [
    '', '..a.........', '..aa....yy..', '..aaa..yyyy.', '..aaaaayyyyy', '..aaaaaaayyy', '.yaaaaaaaaaa',
    'yyaaekaaaaaa', 'yyaakkaaaaaa', 'yyaakkaaaaaa', '.yaaaaaaaaak', '.yyaaaawwwww', '..yyaaaawwww',
    '..yyyaaaaaaa', '...yaaaaaaaa', '...aaaawwwww', '..aaaaawwwww', '..aaaaawwwww', '..aaaaaaaaaa',
    '..aaa...aaa.', '..aaa...aaa.', '.aaaa..aaaa.']},
  vulcanide: {c: {a: '#c8482a', d: '#6a6262', y: '#ffb52e'}, h: [
    '......d.....', '.....ddd..d.', '..d..ddd.ddd', '.ddd.ddddddd', '.dddddaaaddd', '..ddaaaaaaaa',
    '...aaaaaaaaa', '..aaakeaaaaa', '..aaakkaaaaa', '..aaaaaaaaaa', '.daaaaaaykky', 'ddaaaaaayyyy',
    'ddaaaaaaaaaa', 'dddaaaaayyyy', '.ddaaaaayyyy', '.daaaaaayyyy', '..aaaaaaaaaa', '.aaaaaaaaaaa',
    'daaaa.aaaaaa', 'daaa..aaaaa.', 'dddd..aaaa..', '.....dddd...']},

  gocciolo: {c: {a: '#5aa8f2', w: '#dcf2ff'}, h: [
    '', '...........a', '..........aa', '.........aaa', '........aaaa', '.......aaaaa', '......aaaaaa',
    '.....aaaaaaa', '....aaaaaaaa', '...aaaaaaaaa', '...aaekaaaaa', '..aaakkaaaaa', '..aaakkaaaaa',
    '..aaaaaaaaaa', '..aaaaaaawww', '..aaaaaawwww', '..aaaaawwwww', '..aaaaawwwww', '...aaaaawwww',
    '....aaaaaaaa', '.....aaaaaaa', '......aa..aa']},
  ondalo: {c: {a: '#4a90e2', d: '#e8d08a', w: '#d8eeff'}, h: [
    '', '', '.......aaaaa', '.....aaaaaaa', '....aaaaaaaa', '...aaaaaaaaa', '..a.aekaaaaa',
    '.aa.akkaaaaa', '.aaaakkaaaaa', '..aaaaaaaaaa', '...aaaaaaakk', '..dddaaaaaaa', '.ddddddwwwww',
    'ddddddwwwwww', 'ddddddwwwwww', 'ddddddwwwwww', 'dddddddwwwww', '.ddddddddddd', '..aaaddddddd',
    '..aaa....aaa', '..aaa....aaa']},
  abissaldo: {c: {a: '#3060b8', d: '#5ad0e0', w: '#cfe6ff'}, h: [
    '...........d', '..........dd', '.........aaa', '.......aaaaa', '.....aaaaaaa', '....aaaaaaaa',
    '...aaekaaaaa', '..aaakkaaaaa', '..aaaaaaaaaa', '..daaaaaaaaa', '.ddaaaaawwww', 'dddaaaawwwww',
    'dd.aaaawwwww', 'd..aaaawwwww', '..aaaaaawwww', '.aaaaaaawwww', 'aaaadaaawwww', 'aaa.daaaaaaa',
    'aa..aaaaaaaa', '....aaaa.aaa', '...aaaaa.aaa', '...aaaa..aaa']},

  bruchetto: {c: {a: '#94d244', d: '#f2c232'}, f: [
    '', '', '', '', '', '', '',
    '................d..d....', '.................dd.....', '................aaaa....', '...............aaaaaa...',
    '..............aaaaekaa..', '..............aaaakkaa..', '...aaa..aaa..aaaaaaaaa..', '..aaaaaaaaaaaaaaaaaaaa..',
    '.aadaaadaaaadaaaaaaaa...', '.aaaaaaaaaaaaaaaaaaa....', '..aaaaaaaaaaaaaaaaa.....', '..a.a..a.a..a.a..a......']},
  bozzolino: {c: {a: '#aab85a', d: '#76883a'}, h: [
    '...........d', '...........d', '...........d', '.........aaa', '........aaaa', '.......aaaaa',
    '......aaaaaa', '......adaaaa', '.....aaddaaa', '.....aaekaaa', '.....aakkaaa', '.....aaaaaaa',
    '.....adddddd', '.....aaaaaaa', '.....aaaaaaa', '.....adddddd', '......aaaaaa', '......aaaaaa',
    '.......aaaaa', '........aaaa', '.........aaa', '..........aa']},
  farfalia: {c: {a: '#5a5a7a', d: '#f282c2', w: '#ffffff', y: '#f8e060'}, h: [
    '', '.dddd.......', 'dddddd....a.', 'ddwwddd...a.', 'ddwwdddd..a.', 'dddddddd.aaa', 'dddyddddaaka',
    '.ddddddddaaa', '..dddddddaaa', '...ddddddaaa', '..ddddddaaaa', '.dddddddaaaa', 'ddddwwddaaaa',
    'ddddwwdd.aaa', '.dddddd..aaa', '..dddd....aa', '..........a.']},

  passerillo: {c: {a: '#a47a52', w: '#f2e2c2', y: '#f2a232'}, h: [
    '', '', '', '', '.........aaa', '........aaaa', '.......aaaaa', '......aaaaaa', '......aekaaa',
    '......akkaay', '.....aaaaayy', '.....aaaaaay', '...a.aaaawww', '..aa.aaawwww', '.aaa.aaawwww',
    '.aaaaaaawwww', '..aaaaaawwww', '...aaaaaawww', '....aaaaaaaa', '......aaaaaa', '.......y..y.',
    '......yy.yy.']},
  falcastro: {c: {a: '#82603e', d: '#d6b682', w: '#f0e4cc', y: '#f2b032'}, h: [
    '', '..........aa', '.........aaa', '........aaaa', '........akaa', '........aayy', 'aa......aaay',
    'daaa...aaaaa', 'ddaaaa.aawww', '.dddaaaaawww', '..dddaaaawww', '...dddaaawww', '....ddaaawww',
    '.....daaaaww', '......aaaaaa', '......aaaaaa', '.......aaaaa', '........aa.a', '.......aaa.a',
    '........y...', '.......yy...']},

  topino: {c: {a: '#b2a2c4', d: '#f4a6b6', w: '#f4eef8'}, h: [
    '', '', '', '..aaa.......', '.aaaaa......', '.adddaa.....', '.adddaa.....', '.aaddaaaaaaa',
    '..aaaaaaaaaa', '....aaaaaaaa', '...aaekaaaaa', '...aakkaaaaa', '...aaaaaaaak', '....aaaaaaaa',
    '.....aaaawww', '....aaaawwww', '....aaaawwww', '....aaaaawww', '.....aaaaaaa', '.....aa...aa',
    '....aaa...a.']},
  rosicone: {c: {a: '#8c7262', d: '#dcc4a2', w: '#ffffff'}, h: [
    '', '', '..a.........', '.aaa........', '.aaaa.......', '.adaaa.aaaaa', '..aaaaaaaaaa',
    '...aaaaaaaaa', '..aaakeaaaaa', '..aaakkaaaaa', '..aaaaaaaaak', '...aaaaaaaaw', '....aaaaaaaw',
    '...aaaaaaddd', '..aaaaaadddd', '.aaaaaaadddd', '.aaaaaaadddd', 'aa.aaaaaaddd', 'a..aaaaaaaaa',
    '...aaa...aaa', '..aaaa...aaa']},

  lucciolo: {c: {a: '#62629a', y: '#fff04a', w: '#dcf2ff'}, h: [
    '', '', '', '..........a.', '.........a..', '.........aaa', '........aaaa', '........akaa',
    '........aaaa', '..ww.....aaa', '.wwww...aaaa', 'wwwwww.aaaaa', '.wwwwwwaaaaa', '..wwwwaaaaaa',
    '......aaaaaa', '......yyyyyy', '.....yyyyyyy', '.....yyyyyyy', '......yyyyyy', '.......yyyyy',
    '..........yy']},
  fulgella: {c: {a: '#424a84', y: '#ffe442', w: '#cce8ff', d: '#f8a022'}, h: [
    '', '........a...', '.........a..', 'w........aaa', 'ww......aaaa', 'wwww....akaa', 'wwwwww..aaaa',
    '.wwwwwwwaaaa', '..wwwwwwaaaa', '...wwwwaaaaa', 'wwwwwwwaaaaa', 'wwwwwwyaaaaa', '.wwwwyyyyyyy',
    '..wwyyyyyyyy', '....yyyyyyyy', '.....yyyyyyy', '.....ddddddd', '......yyyyyy', '......dddddd',
    '.......yyyyy', '........dddd', '.........yyy', '..........yy']},

  sassolo: {c: {a: '#a29a8a', d: '#78705e'}, h: [
    '', '', '', '', '', '......aaaaaa', '....aaaaaaaa', '...aadaaaaaa', '..aaddaaaaaa', '..aaaaaaaaaa',
    '.aaaakeaaaaa', '.aaaakkaaaaa', '.aaaaaaaaaaa', '.aaaaaaaakkk', '.aaaaaaaaaaa', 'aa.aaaaadaaa',
    'aa..aaaaaaaa', 'a....aaaaaaa', '.....aaaaaaa', '......aaaaaa', '.......aaaaa']},
  macigno: {c: {a: '#8e8678', d: '#5e5a52'}, h: [
    '', '.....aaaaaaa', '...aaaaaaaaa', '..aaadaaaaaa', '.aaaddaaaaaa', '.aaaaaaaaaaa', 'aaaakeaaaaaa',
    'aaaakkaaaaaa', 'aaaaaaaaaaaa', 'aaaaaakkkkkk', 'aaaaaaaaaaaa', 'aaadaaaaaaaa', '.aaddaaaadaa',
    'aa.aaaaaaaaa', 'aaa.aaaaaaaa', 'aaa..aaaaaaa', 'aa...aaaaaaa', '.....aaa.aaa', '....aaaa.aaa',
    '....aaaa.aaa']},

  ombretto: {c: {a: '#544a7c', d: '#8c7ccc', y: '#ffe452'}, h: [
    '', '', '', '..........aa', '.........aaa', '........aaaa', '.......aaaaa', '......aaaaaa',
    '.....aaaaaaa', '.....ayyaaaa', '.....ayyaaaa', '.....aaaaaaa', '....aaaaaddd', '...aaaaaaaaa',
    '..aaaaaaaaaa', '.aaaaaaaaaaa', '.aaaaaaaaaaa', '..aaa.aaa.aa', '...a...a...a']},
  spettrillo: {c: {a: '#6a3a8c', d: '#5ac85a', y: '#ffe452'}, h: [
    '', '', '..d.........', '..dd......aa', '...dd...aaaa', '....ddaaaaaa', '.....aaaaaaa', '....aaaaaaaa',
    '....ayyyaaaa', '....aayyaaaa', '....aaaaaaaa', '....aaaddddd', '....aaaaaaaa', '...aaaaaaaaa',
    'dd.aaaaaaaaa', '.ddaaaaaaaaa', '..aaaaaaaaaa', '...aaaaaaaaa', '...aaaa.aaaa', '....aa...aaa',
    '.........aa.']},

  funghetto: {c: {a: '#da4a4a', d: '#f2dab2', w: '#ffffff'}, h: [
    '', '', '', '', '.......aaaaa', '.....aaaaaaa', '....aawwaaaa', '...aaawwaaaa', '..aaaaaaaaww',
    '..aaaaaaaaww', '.awwaaaaaaaa', '.awwaaaaaaaa', 'aaaaaaaaaaaa', '..dddddddddd', '....ddekdddd',
    '....ddkkdddd', '....dddddddd', '....dddddddd', '.....ddddddd', '.....dd...dd', '....ddd..ddd']},
  fungone: {c: {a: '#9a42aa', d: '#ead2aa', w: '#ffffff'}, h: [
    '', '.......aaaaa', '.....aaaaaaa', '...aaawwaaaa', '..aaaawwaaaa', '.aaaaaaaaaww', '.aawwaaaaaww',
    'aaawwaaaaaaa', 'aaaaaaaaaaaa', 'aaaaaaaaaaaa', 'aaaaaaaaaaaa', '...ddddddddd', '...ddekddddd',
    '...ddkkddddd', '..dddddddddd', '.ddddddddkkk', 'dd.ddddddddd', 'd..ddddddddd', '...ddddddddd',
    '...dddd..ddd', '..ddddd..ddd']},

  pipistrino: {c: {a: '#625aa2', d: '#8a7ac2', w: '#ffffff'}, h: [
    '', '', '', '', '', '........a...', '........aa..', '........aaaa', 'd.......akaa', 'dd......aaaa',
    'ddd....aaaaw', 'dddd...aaaaa', 'ddddd.aaaaaa', 'dddddddaaaaa', 'ddddddddaaaa', 'd.dd.ddaaaaa',
    '....d.d.aaaa', '.........aa.']},
  notturlo: {c: {a: '#3a3a72', d: '#6a6aba', y: '#ffd442', w: '#f2e2b2'}, h: [
    '', '', '......a.....', '......aa....', '......aaaaaa', '.....aaaaaaa', '.....ayyyaaa', '.....aykyaaa',
    '.....ayyyaaa', '.....aaaaaaw', 'd....aaaaaaw', 'dd..aaaaaaaa', 'dddaaaaadaaa', 'dddddaaaaaaa',
    'ddddddaadaaa', '.dddddaaaaaa', '..ddddaaaaaa', '....d.aaaaaa', '.......aaaaa', '.......w..w.',
    '......ww.ww.']},

  ranocchio: {c: {a: '#4abaa2', w: '#e2f8d2'}, h: [
    '', '', '', '', '', '', '.....aaa....', '....aaeka...', '....aakka...', '....aaaaaaaa', '...aaaaaaaaa',
    '...aaaaaaaaa', '...aakkkkkkk', '...aaaaaaaaa', '..aaaaawwwww', '.aaaaaawwwww', '.aaaaaawwwww',
    'aaaaaaaawwww', 'aa.aaaaaaaaa', 'aa..aaa..aaa', '.a.aaaa..aaa']},
  ranone: {c: {a: '#3a92b2', d: '#e252a2', w: '#e2f2ff'}, h: [
    '', '', '', '....aaa.....', '...aaeka....', '...aakkaaaaa', '...aaaaaaadd', '..aaaaaaaadd',
    '..aaaaaaaaaa', '..aakkkkkkkk', '..aaaaaaaaaa', '...aaaaaaaaa', '.aa.aaaawwww', 'aa..aaawwwww',
    'a..aaaawwwww', '..aaaaawwwww', '.aaaaaawwwww', 'aaaaaaaaaaaa', 'aaaaaaaaaaaa', '.aaaaa..aaaa',
    '..aaa..aaaaa']},

  serpillo: {c: {a: '#a25ac2', d: '#eac262'}, h: [
    '', '', '', '........aaaa', '.......aaaaa', '.......aekaa', '.......aaaaa', '........aaaa',
    '.........add', '.........add', '........aadd', '......aaaaaa', '....aaaaaaaa', '...aaddddddd',
    '..aaaaaaaaaa', '..aaaaaaaaaa', '.aaddddddddd', '.aaaaaaaaaaa', '..aaaaaaaaaa', '....aaaaaaaa']},
  serpentano: {c: {a: '#723aa2', d: '#eab242', w: '#f2e2c2'}, h: [
    '', '........aaaa', '......aaaaaa', '.....aaaaaaa', '....aaaaaaaa', '...aadaaakaa', '..aaddaaaaaa',
    '..aaddaaaaaa', '..aaadaaawww', '...aaaaaawww', '....aaaaawww', '.....aaaawww', '......aaawww',
    '.......aawww', '.......aawww', '....aaaaaaaa', '..aaaaaaaaaa', '.aaaaaaaaaaa', 'aaaaaaaaaaaa',
    '.aaaaaaaaaaa', '...aaaaaaa..']},
};
