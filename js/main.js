/* ============================================================
   KONFIGURATION
   ============================================================ */
let LOCS={
  1:{name:"KH \xB7 Location 1",short:"KH",color:"#f5a623"},
  2:{name:"H39 \xB7 Location 2",short:"H39",color:"#22d4a4"},
  3:{name:"Sunny \xB7 Location 3",short:"SR",color:"#e05aff"},
  4:{name:"OH \xB7 Location 4",   short:"OH",color:"#ff6b6b"},
};
const DAYS =["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
const MONS =["Jan","Feb","M\u00e4r","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

/* ============================================================
   DATENMODELL
   Zeitberechnung Bar-Personal:
     Position 1 & 2 -> startGastro
     Position 3     -> startGastro + 30 Min
     Position 4+    -> startGastro + 60 Min
   Falls startOverride gesetzt -> gilt dieser Wert.
   ============================================================ */
let EVENTS=[];

/* April 2026 – Location 1 (KH) */
[
  {id:"e01",date:"2026-04-01",location:1,event:"SIND",notes:"von H39 in KH verlegt",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Anna",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Henry",pos:1,ov:null,miss:false},{name:"Igor",pos:2,ov:null,miss:false},{name:"Lucas",pos:3,ov:null,miss:false}]},
  {id:"e02",date:"2026-04-05",location:1,event:"Katzenclub",notes:"Get In Basti 14\u201319 \xB7 Ostersonntag",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Lena",startTime:"19:00"},startGastro:"18:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Gabi",pos:1,ov:null,miss:false},{name:"Laura",pos:2,ov:null,miss:false},
             {name:"Richard",pos:3,ov:"21:00",miss:false},{name:"Dominic",pos:4,ov:"23:00",miss:false},
             {name:"Lucas",pos:1,ov:"18:00",miss:false}]},
  {id:"e03",date:"2026-04-08",location:1,event:"Dark Suns",notes:"Hohl F. Probearbeit",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Bruce",startTime:"14:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Felix",pos:1,ov:null,miss:false},{name:"Bonnie",pos:2,ov:null,miss:false},
             {name:"Hohl Felix",pos:3,ov:"18:00",miss:false},{name:"Lucas",pos:4,ov:"18:00",miss:false}]},
  {id:"e04",date:"2026-04-09",location:1,event:"Skuth",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Pauline",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Claudio",pos:1,ov:"18:00",miss:false},{name:"Gabi",pos:2,ov:null,miss:false},
             {name:"Bonnie",pos:3,ov:"18:00",miss:false},{name:"Lucas",pos:4,ov:null,miss:false}]},
  {id:"e05",date:"2026-04-13",location:1,event:"Vincent Lima",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Lena",startTime:"15:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Igor",pos:1,ov:null,miss:false},{name:"Felix",pos:2,ov:null,miss:false}]},
  {id:"e06",date:"2026-04-14",location:1,event:"Nite",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Anna",startTime:"15:30"},startGastro:"19:00",schlussShow:"23:00",belegungsende:"00:30",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false},{name:"Igor",pos:2,ov:null,miss:false}]},
  {id:"e07",date:"2026-04-15",location:1,event:"Bella | Katharina",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Luise",startTime:"14:30"},startGastro:"18:30",schlussShow:"23:00",belegungsende:"01:00",
   barStaff:[{name:"Laura",pos:1,ov:null,miss:false},{name:"Bonnie",pos:2,ov:null,miss:false}]},
  {id:"e08",date:"2026-04-16",location:1,event:"Rikas",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Bruce",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"02:00",
   barStaff:[{name:"Henry",pos:1,ov:null,miss:false},{name:"Gabi",pos:2,ov:null,miss:false}]},
  {id:"e09",date:"2026-04-17",location:1,event:"Luca Noel",notes:"Hohl F. Probearbeit",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Marlon",startTime:"14:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Lucia",pos:1,ov:"18:30",miss:false},{name:"Felix Hohl",pos:2,ov:"18:00",miss:false},
             {name:"Lucas",pos:3,ov:"18:00",miss:false}]},
  {id:"e10",date:"2026-04-18",location:1,event:"Klangraumfestival",notes:"Get In Lena 12\u201317",
   plastik:true,missingStaff:true,kundenkarte:"Agentur",
   prodL:{name:"Anna",startTime:"17:00"},startGastro:"17:30",schlussShow:"00:00",belegungsende:"03:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false},{name:"Gabi",pos:2,ov:null,miss:false},
             {name:"",pos:3,ov:null,miss:true}]},
  {id:"e11",date:"2026-04-19",location:1,event:"The Zen Circus",notes:"tbc",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Anna",startTime:"15:00"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Lucia",pos:1,ov:null,miss:false},{name:"Gabi",pos:2,ov:null,miss:false}]},
  {id:"e12",date:"2026-04-21",location:1,event:"Ben Caplan",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Pauline",startTime:"15:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Henry",pos:1,ov:null,miss:false},{name:"Jonathan",pos:2,ov:null,miss:false}]},
  {id:"e13",date:"2026-04-24",location:1,event:"Tyler Hilton",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Lena",startTime:"14:30"},startGastro:"18:30",schlussShow:"22:15",belegungsende:"01:00",
   barStaff:[{name:"Lucia",pos:1,ov:null,miss:false},{name:"Bonnie",pos:2,ov:null,miss:false}]},
  {id:"e14",date:"2026-04-25",location:1,event:"Zestival",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Marlon",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Galia",pos:1,ov:"18:00",miss:false},{name:"Jonathan",pos:2,ov:"18:00",miss:false},
             {name:"Franzi",pos:3,ov:null,miss:false}]},
  {id:"e15",date:"2026-04-27",location:1,event:"FSP Demo Listening",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Bruce",startTime:"17:00"},startGastro:"17:30",schlussShow:"23:00",belegungsende:"00:00",
   barStaff:[{name:"Igor",pos:1,ov:null,miss:false}]},
  {id:"e16",date:"2026-04-28",location:1,event:"Cosmic Psychos",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Lena",startTime:"14:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Felix",pos:1,ov:null,miss:false},{name:"Jonathan",pos:2,ov:null,miss:false},
             {name:"Igor",pos:3,ov:null,miss:false}]},
  {id:"e17",date:"2026-04-29",location:1,event:"Jessica Baio",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Pauline",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Lucia",pos:1,ov:null,miss:false},{name:"Jonathan",pos:2,ov:null,miss:false}]},
  {id:"e18",date:"2026-04-30",location:1,event:"MoreCore",notes:"",
   plastik:true,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Marlon",startTime:"20:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Felix",pos:1,ov:"22:00",miss:false},{name:"Claudio",pos:2,ov:null,miss:false},
             {name:"Dominic",pos:3,ov:null,miss:false},{name:"Lucia",pos:4,ov:null,miss:false},
             {name:"Franzi",pos:1,ov:"22:00",miss:false}]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   APRIL 2026 – LOCATION 2 (H39)
   Quelle: hochgeladener Screenshot des Thekenplans H39.
   ============================================================ */
[
  /* Mi.01.04 – SIND in die KH verlegt */
  {id:"h01",date:"2026-04-01",location:2,event:"SIND",
   notes:"In die KH verlegt \u2192 siehe Location 1",
   plastik:false,missingStaff:false,kundenkarte:"Agentur",relocated:"KH \xB7 Location 1",
   prodL:null,startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",barStaff:[]},

  /* Di.07.04 – Casey */
  {id:"h02",date:"2026-04-07",location:2,event:"Casey",notes:"Plastik",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Luise",startTime:"14:00"},startGastro:"19:00",schlussShow:"23:00",belegungsende:"01:00",
   barStaff:[
     {name:"Richard",pos:1,ov:null,miss:false},{name:"Gabi",pos:2,ov:null,miss:false},
     {name:"Jonathan",pos:3,ov:null,miss:false},{name:"Igor",pos:4,ov:null,miss:false},
     {name:"Dominic",pos:1,ov:null,miss:false},
   ]},

  /* Fr.10.04 – Black Opera */
  {id:"h03",date:"2026-04-10",location:2,event:"Black Opera",notes:"Probearbeiten Franzi",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"20:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Laura",pos:1,ov:"21:00",miss:false},{name:"Franzi",pos:1,ov:"21:00",miss:false},
     {name:"Galia",pos:2,ov:null,miss:false},
     {name:"Felix",pos:3,ov:"22:00",miss:false},{name:"Claudio",pos:4,ov:"23:00",miss:false},
   ]},

  /* Sa.11.04 – High Fade */
  {id:"h04",date:"2026-04-11",location:2,event:"High Fade",notes:"Plastik \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Luise",startTime:"14:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Galia",pos:1,ov:"18:00",miss:false},{name:"Bonnie",pos:2,ov:"18:00",miss:false},
     {name:"Ines",pos:3,ov:null,miss:false},
   ]},

  /* Mo.13.04 – Jay Buchanan (ABGESAGT) */
  {id:"h05",date:"2026-04-13",location:2,event:"Jay Buchanan",notes:"Abgesagt",
   plastik:false,missingStaff:false,kundenkarte:"",cancelled:true,
   prodL:{name:"Pauline",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Felix",pos:1,ov:"18:00",miss:false},{name:"Gabi",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:"18:00",miss:false},
   ]},

  /* Mi.15.04 – Inji verlegt ins OH */
  {id:"h06",date:"2026-04-15",location:2,event:"Inji",notes:"Verlegt ins OH",
   plastik:false,missingStaff:false,kundenkarte:"Agentur",relocated:"OH \xB7 Location 4",
   prodL:null,startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",barStaff:[]},

  /* Do.16.04 – Vicky */
  {id:"h07",date:"2026-04-16",location:2,event:"Vicky",notes:"Plastik \xB7 Get In Basti 10:30\u201314:00",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Marlon",startTime:"14:00"},startGastro:"18:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Laura",pos:1,ov:null,miss:false},{name:"Felix",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:"18:00",miss:false},{name:"Ines",pos:4,ov:"19:00",miss:false},
   ]},

  /* Fr.17.04 – Tide Lines */
  {id:"h08",date:"2026-04-17",location:2,event:"Tide Lines",notes:"Plastik \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Bruce",startTime:"14:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Ines",pos:1,ov:null,miss:false},{name:"Gabi",pos:2,ov:null,miss:false},
     {name:"Galia",pos:3,ov:null,miss:false},
   ]},

  /* Sa.18.04 – Vicky (FEHLENDE BESETZUNG Bar 3 + 4) */
  {id:"h09",date:"2026-04-18",location:2,event:"Vicky",notes:"Plastik",
   plastik:true,missingStaff:true,kundenkarte:"Agentur",
   prodL:{name:"Luise",startTime:"14:00"},startGastro:"18:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Galia",pos:1,ov:null,miss:false},{name:"Henry",pos:2,ov:null,miss:false},
     {name:"",pos:3,ov:null,miss:true},{name:"",pos:4,ov:null,miss:true},
   ]},

  /* Mo.20.04 – Full Of Hell */
  {id:"h10",date:"2026-04-20",location:2,event:"Full Of Hell",
   notes:"Plastik \u2013 nur Saal \xB7 Get In Basti 11:30\u201314:00",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Bruce",startTime:"14:00"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Claudio",pos:1,ov:"18:30",miss:false},{name:"Henry",pos:2,ov:null,miss:false},
     {name:"Ines",pos:3,ov:"18:30",miss:false},{name:"Franzi",pos:4,ov:null,miss:false},
   ]},

  /* Di.21.04 – Imarhan */
  {id:"h11",date:"2026-04-21",location:2,event:"Imarhan",notes:"Plastik \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Marlon",startTime:"15:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Felix",pos:1,ov:null,miss:false},{name:"Igor",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:null,miss:false},
   ]},

  /* Mi.22.04 – Solence */
  {id:"h12",date:"2026-04-22",location:2,event:"Solence",
   notes:"Plastik \u2013 nur Saal \xB7 Get In Lisa 11:15\u201314:00",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Lena",startTime:"14:00"},startGastro:"18:30",schlussShow:"22:50",belegungsende:"01:00",
   barStaff:[
     {name:"Laura",pos:1,ov:null,miss:false},{name:"Ines",pos:2,ov:null,miss:false},
     {name:"Igor",pos:3,ov:null,miss:false},{name:"Felix",pos:4,ov:null,miss:false},
   ]},

  /* Do.23.04 – DYSE */
  {id:"h13",date:"2026-04-23",location:2,event:"DY\u0308SE",notes:"Plastik \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Lena",startTime:"15:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Laura",pos:1,ov:null,miss:false},{name:"Jonathan",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:null,miss:false},
   ]},

  /* Fr.24.04 – Paktofonika (FEHLENDE BESETZUNG Bar 2) */
  {id:"h14",date:"2026-04-24",location:2,event:"Paktofonika",notes:"Plastik \u2013 nur Saal",
   plastik:true,missingStaff:true,kundenkarte:"Agentur",
   prodL:{name:"Luise",startTime:"16:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Dominic",pos:1,ov:null,miss:false},
     {name:"",pos:2,ov:null,miss:true},
     {name:"Galia",pos:3,ov:null,miss:false},
   ]},

  /* Sa.25.04 – 4X4-Team (ABGESAGT) */
  {id:"h15",date:"2026-04-25",location:2,event:"4X4-Team",notes:"Abgesagt \xB7 Plastik",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",cancelled:true,
   prodL:{name:"Anna",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Lucia",pos:1,ov:null,miss:false},{name:"Dominic",pos:2,ov:null,miss:false},
     {name:"Henry",pos:3,ov:null,miss:false},
   ]},

  /* Mo.27.04 – Grade 2 */
  {id:"h16",date:"2026-04-27",location:2,event:"Grade 2",notes:"Plastik \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Luise",startTime:"15:30"},startGastro:"18:30",schlussShow:"22:00",belegungsende:"01:00",
   barStaff:[
     {name:"Claudio",pos:1,ov:null,miss:false},{name:"Felix",pos:2,ov:null,miss:false},
     {name:"Jonathan",pos:3,ov:null,miss:false},
   ]},

  /* Do.30.04 – MoreCore */
  {id:"h17",date:"2026-04-30",location:2,event:"MoreCore",notes:"nur Saal",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"20:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Henry",pos:1,ov:null,miss:false},{name:"Jonathan",pos:2,ov:null,miss:false},
     {name:"Galia",pos:3,ov:null,miss:false},
   ]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   APRIL 2026 – LOCATION 3 (Sunny / SR)
   Quelle: hochgeladener Screenshot.
   Hinweis: Sunny betreibt meist nur Bar 1 (kleinere Location).
   ============================================================ */
[
  /* Mi.01.04 – Reggae Jam */
  {id:"sr01",date:"2026-04-01",location:3,event:"Reggae Jam",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Luise",startTime:"18:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Lucia",pos:1,ov:null,miss:false}]},

  /* Sa.04.04 – Schandmaul Filmdreh (Karsamstag, Tagbetrieb) */
  {id:"sr02",date:"2026-04-04",location:3,event:"Schandmaul Filmdreh",notes:"Karsamstag \u2013 Filmproduktion",
   plastik:false,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Marlon",startTime:"07:30"},startGastro:"07:30",schlussShow:"16:00",belegungsende:"17:00",
   barStaff:[]},

  /* Sa.04.04 – Dubtown (verlegt von So.05.04) */
  {id:"sr03",date:"2026-04-04",location:3,event:"Dubtown",notes:"Verlegt von So. 05.04.",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Luise",startTime:"21:00"},startGastro:"23:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* So.05.04 – Dubtown verlegt auf Sa.04.04 */
  {id:"sr04",date:"2026-04-05",location:3,event:"Dubtown",notes:"Verlegt auf Sa. 04.04.",
   plastik:false,missingStaff:false,kundenkarte:"Marken",relocated:"Sa. 04.04.",
   prodL:{name:"Luise",startTime:"20:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Fr.10.04 – Eisbach Callin */
  {id:"sr05",date:"2026-04-10",location:3,event:"Eisbach Callin",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Lena",startTime:"19:00"},startGastro:"21:30",schlussShow:"04:00",belegungsende:"05:30",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Sa.11.04 – Kettenrasseln Vol. 2 */
  {id:"sr06",date:"2026-04-11",location:3,event:"Kettenrasseln Vol. 2",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"16:30"},startGastro:"19:00",schlussShow:"02:00",belegungsende:"03:30",
   barStaff:[{name:"Dominic",pos:1,ov:null,miss:false}]},

  /* Fr.17.04 – Break It Down */
  {id:"sr07",date:"2026-04-17",location:3,event:"Break It Down",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Anna",startTime:"21:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Sa.18.04 – Omega Dub Circle */
  {id:"sr08",date:"2026-04-18",location:3,event:"Omega Dub Circle",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Pauline",startTime:"20:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Claudio",pos:1,ov:null,miss:false}]},

  /* Di.21.04 – CoreChaos */
  {id:"sr09",date:"2026-04-21",location:3,event:"CoreChaos",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"16:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Dominic",pos:1,ov:null,miss:false}]},

  /* Do.23.04 – Bergfest (ABGESAGT) */
  {id:"sr10",date:"2026-04-23",location:3,event:"Bergfest",notes:"Abgesagt",
   plastik:false,missingStaff:false,kundenkarte:"",cancelled:true,
   prodL:{name:"Luise",startTime:"16:30"},startGastro:"18:30",schlussShow:"22:30",belegungsende:"00:00",
   barStaff:[]},

  /* Fr.24.04 – Sacred Bones */
  {id:"sr11",date:"2026-04-24",location:3,event:"Sacred Bones",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Anna",startTime:"21:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"06:30",
   barStaff:[{name:"Claudio",pos:1,ov:null,miss:false}]},

  /* Sa.25.04 – Schlecht & Schwindlig */
  {id:"sr12",date:"2026-04-25",location:3,event:"Schlecht & Schwindlig",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Anna",startTime:"17:00"},startGastro:"19:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Felix",pos:1,ov:null,miss:false}]},

  /* Do.30.04 – Zombie Sessions */
  {id:"sr13",date:"2026-04-30",location:3,event:"Zombie Sessions",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Pauline",startTime:"18:00"},startGastro:"19:30",schlussShow:"00:00",belegungsende:"01:00",
   barStaff:[{name:"Ines",pos:1,ov:null,miss:false}]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   APRIL 2026 – LOCATION 4 (OH)
   Quelle: hochgeladener Screenshot.
   Hinweis: Inji (Mi.15.04) wurde von H39 ins OH verlegt.
   ============================================================ */
[
  /* So.12.04 – Sonntags Cafe */
  {id:"oh01",date:"2026-04-12",location:4,event:"Sonntags Cafe",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:"13:30",schlussShow:"18:00",belegungsende:"19:00",
   barStaff:[{name:"Aline",pos:1,ov:null,miss:false}]},

  /* Di.14.04 – Luisa */
  {id:"oh02",date:"2026-04-14",location:4,event:"Luisa",notes:"Plastik ?",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Luise",startTime:"15:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Lucia",pos:1,ov:null,miss:false}]},

  /* Mi.15.04 – Inji (von H39 verlegt) */
  {id:"oh03",date:"2026-04-15",location:4,event:"Inji",notes:"Plastik ? \xB7 verlegt von H39",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Pauline",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Felix",pos:1,ov:null,miss:false},
     {name:"Jonathan",pos:2,ov:null,miss:false},
   ]},

  /* Do.16.04 – Mamoré */
  {id:"oh04",date:"2026-04-16",location:4,event:"Mamoré",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Luise",startTime:"15:30"},startGastro:"19:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Claudio",pos:1,ov:null,miss:false}]},

  /* Fr.17.04 – Aufbau FW Sessions Azubi (kein Barbetrieb) */
  {id:"oh05",date:"2026-04-17",location:4,event:"Aufbau FW Sessions Azubi",
   notes:"Aufbau \u2013 kein Barbetrieb",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:null,schlussShow:null,belegungsende:"00:00",
   barStaff:[]},

  /* Sa.18.04 – Feierwerk Sessions */
  {id:"oh06",date:"2026-04-18",location:4,event:"Feierwerk Sessions",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Basti",startTime:"15:00"},startGastro:"18:30",schlussShow:"22:00",belegungsende:"00:00",
   barStaff:[{name:"Ines",pos:1,ov:null,miss:false}]},

  /* So.19.04 – Sonntags Cafe */
  {id:"oh07",date:"2026-04-19",location:4,event:"Sonntags Cafe",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:"13:30",schlussShow:"18:00",belegungsende:"19:00",
   barStaff:[{name:"Aline",pos:1,ov:null,miss:false}]},

  /* So.26.04 – Sonntags Cafe (FEHLENDE BESETZUNG Bar 1) */
  {id:"oh08",date:"2026-04-26",location:4,event:"Sonntags Cafe",notes:"",
   plastik:false,missingStaff:true,kundenkarte:"",
   prodL:null,startGastro:"13:30",schlussShow:"18:00",belegungsende:"19:00",
   barStaff:[{name:"",pos:1,ov:null,miss:true}]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   MAI 2026 – LOCATION 1 (KH)
   ============================================================ */
[
  /* So.10.05 – Turnusreinigung GEMEINSAM (alle Locations, Treffen KH) */
  {id:"tr0510",date:"2026-05-10",location:1,event:"Turnusreinigung",
   notes:"Gemeinsames Meeting aller Locations \xB7 Treffen 10 Uhr KH",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:"10:00",schlussShow:"17:00",belegungsende:"18:00",
   barStaff:[
     /* KH */ {name:"Lucas",pos:1,ov:null,miss:false},{name:"Dominic",pos:2,ov:null,miss:false},
              {name:"Felix",pos:3,ov:null,miss:false},{name:"Galia",pos:4,ov:null,miss:false},
     /* H39 */ {name:"Laura",pos:1,ov:null,miss:false},{name:"Franzi",pos:2,ov:null,miss:false},
               {name:"Richard",pos:3,ov:null,miss:false},{name:"Lucia",pos:4,ov:null,miss:false},
     /* OH */  {name:"Bonnie",pos:1,ov:null,miss:false},{name:"Claudio",pos:2,ov:null,miss:false},
               {name:"Ines",pos:4,ov:null,miss:false},
     /* SR */  {name:"Igor",pos:1,ov:null,miss:false},
   ]},

  /* Sa.02.05 – Black Opera (2 PLs: Anna 17:30, Marlon ab 21:00) */
  {id:"kh_m01",date:"2026-05-02",location:1,event:"Black Opera",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Anna",startTime:"17:30"},prodL2:{name:"Marlon",startTime:"21:00"},
   startGastro:"21:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Lucas",pos:1,ov:null,miss:false},
     {name:"Henry",pos:2,ov:null,miss:false},
     {name:"Lucia",pos:3,ov:null,miss:false},
   ]},

  /* Mo.04.05 – Svalbard */
  {id:"kh_m02",date:"2026-05-04",location:1,event:"Svalbard",notes:"Plastik",
   plastik:true,missingStaff:true,kundenkarte:"Intern",
   prodL:{name:"Luise",startTime:"15:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Laura",pos:1,ov:null,miss:false},
     {name:"Franzi",pos:2,ov:null,miss:false},
     {name:"Igor",pos:3,ov:null,miss:false},
     {name:"",pos:4,ov:null,miss:true},
   ]},

  /* Sa.09.05 – Tyna */
  {id:"kh_m03",date:"2026-05-09",location:1,event:"Tyna",notes:"Plastik?",
   plastik:true,missingStaff:true,kundenkarte:"",
   prodL:{name:"Marlon",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Dominic",pos:1,ov:null,miss:false},
     {name:"Bonnie",pos:2,ov:null,miss:false},
     {name:"",pos:3,ov:null,miss:true},
   ]},

  /* Mi.13.05 – Rummelsnuff */
  {id:"kh_m04",date:"2026-05-13",location:1,event:"Rummelsnuff",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Marlon",startTime:"15:00"},startGastro:"19:00",schlussShow:"23:00",belegungsende:"00:30",
   barStaff:[
     {name:"Bonnie",pos:1,ov:null,miss:false},
     {name:"Dominic",pos:2,ov:null,miss:false},
   ]},

  /* Fr.15.05 – Mittelstufenparty */
  {id:"kh_m05",date:"2026-05-15",location:1,event:"Mittelstufenparty",
   notes:"Plastik \u2013 kein Alk, afg billiger",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Marlon",startTime:"16:30"},startGastro:"17:00",schlussShow:"22:00",belegungsende:"00:00",
   barStaff:[
     {name:"Lucia",pos:1,ov:null,miss:false},
     {name:"Jonathan",pos:2,ov:null,miss:false},
   ]},

  /* Sa.16.05 – Freude */
  {id:"kh_m06",date:"2026-05-16",location:1,event:"Freude",notes:"Plastik?",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Bruce",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Galia",pos:1,ov:null,miss:false},
     {name:"Bonnie",pos:2,ov:null,miss:false},
   ]},

  /* Do.21.05 – NoMBe */
  {id:"kh_m07",date:"2026-05-21",location:1,event:"NoMBe",notes:"Plastik?",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Pauline",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Jonathan",pos:1,ov:null,miss:false},
     {name:"Bonnie",pos:2,ov:null,miss:false},
   ]},

  /* Fr.22.05 – Telekoma */
  {id:"kh_m08",date:"2026-05-22",location:1,event:"Telekoma",notes:"Plastik",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Luise",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Richard",pos:1,ov:null,miss:false},
     {name:"Ines",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:null,miss:false},
   ]},

  /* Sa.23.05 – Kaizoku */
  {id:"kh_m09",date:"2026-05-23",location:1,event:"Kaizoku",
   notes:"Get In Basti 17:45\u201320 \xB7 Special Getränke",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Marlon",startTime:"20:00"},startGastro:"20:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Richard",pos:1,ov:"20:15",miss:false},
     {name:"Felix",pos:2,ov:"20:15",miss:false},
     {name:"Bonnie",pos:3,ov:"21:00",miss:false},
     {name:"Lucas",pos:4,ov:"21:30",miss:false},
     {name:"Lucia",pos:1,ov:"22:30",miss:false},
   ]},

  /* Mi.27.05 – High Desert Queen */
  {id:"kh_m10",date:"2026-05-27",location:1,event:"High Desert Queen",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Luise",startTime:"15:00"},startGastro:"19:00",schlussShow:"23:00",belegungsende:"00:30",
   barStaff:[
     {name:"Felix",pos:1,ov:null,miss:false},
     {name:"Igor",pos:2,ov:null,miss:false},
   ]},

  /* Fr.29.05 – Deer Park Avenue */
  {id:"kh_m11",date:"2026-05-29",location:1,event:"Deer Park Avenue",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Bruce",startTime:"15:00"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Galia",pos:1,ov:null,miss:false},
     {name:"Franzi",pos:2,ov:null,miss:false},
     {name:"Lucia",pos:3,ov:null,miss:false},
   ]},

  /* Sa.30.05 – Nuketekk */
  {id:"kh_m12",date:"2026-05-30",location:1,event:"Nuketekk",
   notes:"Get In Basti 17\u201320 \xB7 Plastik",
   plastik:true,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Marlon",startTime:"20:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"07:30",
   barStaff:[
     {name:"Bonnie",pos:1,ov:null,miss:false},
     {name:"Felix",pos:2,ov:null,miss:false},
     {name:"Lucia",pos:3,ov:null,miss:false},
   ]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   MAI 2026 – LOCATION 2 (H39)
   ============================================================ */
[
  /* Sa.02.05 – Black Opera (PL von KH, Bar3 fehlt) */
  {id:"h39_m01",date:"2026-05-02",location:2,event:"Black Opera",
   notes:"PL: s. KH \xB7 Bar 1 bis ca. 2/3 Uhr",
   plastik:false,missingStaff:true,kundenkarte:"Marken",
   prodL:{name:"s. KH",startTime:"20:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Igor",pos:1,ov:null,miss:false},
     {name:"Galia",pos:2,ov:null,miss:false},
     {name:"",pos:3,ov:null,miss:true},
   ]},

  /* Do.07.05 – Los Invasores de Nuevo León */
  {id:"h39_m02",date:"2026-05-07",location:2,event:"Los Invasores de Nuevo Le\xF3n",
   notes:"Plastik? \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Anna",startTime:"15:30"},startGastro:"18:30",schlussShow:"22:45",belegungsende:"01:00",
   barStaff:[
     {name:"Claudio",pos:1,ov:null,miss:false},
     {name:"Jonathan",pos:2,ov:null,miss:false},
     {name:"Franzi",pos:3,ov:"18:30",miss:false},
   ]},

  /* Fr.08.05 – PTK (Plastik, nur Saal) */
  {id:"h39_m03",date:"2026-05-08",location:2,event:"PTK",notes:"Plastik \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Marlon",startTime:"14:30"},startGastro:"19:30",schlussShow:"23:30",belegungsende:"01:30",
   barStaff:[
     {name:"Galia",pos:1,ov:null,miss:false},
     {name:"Lucas",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:null,miss:false},
   ]},

  /* Fr.15.05 – Mittelstufenparty */
  {id:"h39_m04",date:"2026-05-15",location:2,event:"Mittelstufenparty",
   notes:"ab 19 Uhr offen \xB7 aus KH ggf. Unterst\u00fctzung \xB7 Plastik kein Alk, afg billiger",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Lena",startTime:"14:30"},startGastro:"17:00",schlussShow:"22:00",belegungsende:"00:00",
   barStaff:[
     {name:"Laura",pos:1,ov:"18:30",miss:false},
   ]},

  /* Sa.16.05 – Lunatica Noctis */
  {id:"h39_m05",date:"2026-05-16",location:2,event:"Lunatica Noctis",
   notes:"Special Getr\u00e4nk Met \u2013 nur Saal",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Pauline",startTime:"20:00"},startGastro:"20:30",schlussShow:"04:00",belegungsende:"06:00",
   barStaff:[
     {name:"Laura",pos:1,ov:"20:15",miss:false},
     {name:"Claudio",pos:2,ov:"21:00",miss:false},
   ]},

  /* Mo.18.05 – Paledusk */
  {id:"h39_m06",date:"2026-05-18",location:2,event:"Paledusk",notes:"Plastik",
   plastik:true,missingStaff:true,kundenkarte:"Intern",
   prodL:{name:"Luise",startTime:"12:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Dominic",pos:1,ov:null,miss:false},
     {name:"Ines",pos:2,ov:null,miss:false},
     {name:"",pos:3,ov:null,miss:true},
   ]},

  /* Mi.20.05 – Noveria */
  {id:"h39_m07",date:"2026-05-20",location:2,event:"Noveria",notes:"Plastik",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Anna",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Felix",pos:1,ov:null,miss:false},
     {name:"Ines",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:null,miss:false},
     {name:"Flo Hohl",pos:4,ov:null,miss:false},
   ]},

  /* Fr.22.05 – Kuult */
  {id:"h39_m08",date:"2026-05-22",location:2,event:"Kuult",notes:"Plastik? \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Marlon",startTime:"14:00"},startGastro:"18:30",schlussShow:"22:30",belegungsende:"01:00",
   barStaff:[
     {name:"Dominic",pos:1,ov:null,miss:false},
     {name:"Henry",pos:2,ov:null,miss:false},
     {name:"Claudio",pos:3,ov:"19:00",miss:false},
   ]},

  /* Sa.23.05 – Kaizoku */
  {id:"h39_m09",date:"2026-05-23",location:2,event:"Kaizoku",
   notes:"Get In Basti 17:45\u201320 \xB7 Special Getr\u00e4nke \u2013 nur Saal",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Lena",startTime:"20:00"},startGastro:"20:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Igor",pos:1,ov:"20:15",miss:false},
     {name:"Laura",pos:2,ov:"20:15",miss:false},
     {name:"Galia",pos:3,ov:"21:00",miss:false},
   ]},

  /* Sa.30.05 – Nuketekk */
  {id:"h39_m10",date:"2026-05-30",location:2,event:"Nuketekk",
   notes:"Get In Basti 17\u201320 \xB7 Plastik \u2013 nur Saal",
   plastik:true,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"20:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"07:30",
   barStaff:[
     {name:"Jonathan",pos:1,ov:"21:30",miss:false},
     {name:"Henry",pos:2,ov:null,miss:false},
     {name:"Franzi",pos:3,ov:null,miss:false},
   ]},

  /* So.31.05 – Noise and Needles Festival */
  {id:"h39_m11",date:"2026-05-31",location:2,event:"Noise and Needles Festival",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Luise",startTime:"14:00"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Laura",pos:1,ov:null,miss:false},
     {name:"Igor",pos:2,ov:null,miss:false},
     {name:"Jonathan",pos:3,ov:null,miss:false},
   ]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   MAI 2026 – LOCATION 3 (Sunny / SR)
   ============================================================ */
[
  /* Fr.01.05 – Be Together (Feiertag) */
  {id:"sr_m01",date:"2026-05-01",location:3,event:"Be Together",notes:"Feiertag",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"20:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Sa.02.05 – Dubtown */
  {id:"sr_m02",date:"2026-05-02",location:3,event:"Dubtown",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Pauline",startTime:"20:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Mi.06.05 – Reggae Jam */
  {id:"sr_m03",date:"2026-05-06",location:3,event:"Reggae Jam",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"16:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Ines",pos:1,ov:null,miss:false}]},

  /* Fr.08.05 – Chaos Blast */
  {id:"sr_m04",date:"2026-05-08",location:3,event:"Chaos Blast",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Lena",startTime:"16:30"},startGastro:"19:30",schlussShow:"03:00",belegungsende:"04:30",
   barStaff:[{name:"Claudio",pos:1,ov:null,miss:false}]},

  /* Sa.09.05 – Unterwelt */
  {id:"sr_m05",date:"2026-05-09",location:3,event:"Unterwelt",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"20:00"},startGastro:"21:30",schlussShow:"04:00",belegungsende:"06:00",
   barStaff:[{name:"Henry",pos:1,ov:null,miss:false}]},

  /* Mi.13.05 – Turnusreinigung SR (Putz-Event Sunny) */
  {id:"sr_m06",date:"2026-05-13",location:3,event:"Turnusreinigung SR",notes:"Putztermin Sunny",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:"12:00",schlussShow:"18:30",belegungsende:"19:30",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Mi.13.05 – Black Rat */
  {id:"sr_m07",date:"2026-05-13",location:3,event:"Black Rat",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Anna",startTime:"16:30"},startGastro:"19:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Lucas",pos:1,ov:null,miss:false}]},

  /* Do.14.05 – Venerea (Christi Himmelfahrt) */
  {id:"sr_m08",date:"2026-05-14",location:3,event:"Venerea",notes:"Christi Himmelfahrt",
   plastik:false,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Lena",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Fr.15.05 – Tyrolean Death Alliance Tour */
  {id:"sr_m09",date:"2026-05-15",location:3,event:"Tyrolean Death Alliance Tour",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Bruce",startTime:"16:00"},startGastro:"19:00",schlussShow:"23:00",belegungsende:"00:30",
   barStaff:[{name:"Dominic",pos:1,ov:null,miss:false}]},

  /* Sa.16.05 – Break It Down */
  {id:"sr_m10",date:"2026-05-16",location:3,event:"Break It Down",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Luise",startTime:"20:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"06:30",
   barStaff:[{name:"Richard",pos:1,ov:null,miss:false}]},

  /* Sa.23.05 – Sorry I'm late */
  {id:"sr_m11",date:"2026-05-23",location:3,event:"Sorry I'm late",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Basti",startTime:"17:00"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Fr.29.05 – Lostclub */
  {id:"sr_m12",date:"2026-05-29",location:3,event:"Lostclub",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Anna",startTime:"20:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"07:30",
   barStaff:[{name:"Claudio",pos:1,ov:null,miss:false}]},

  /* Sa.30.05 – Black Hole Crumble */
  {id:"sr_m13",date:"2026-05-30",location:3,event:"Black Hole Crumble",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Luise",startTime:"16:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Dominic",pos:1,ov:null,miss:false}]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   MAI 2026 – LOCATION 4 (OH)
   ============================================================ */
[
  /* Sa.02.05 – PHANTA$Y & CHRIS RAIN (Bar1 fehlt) */
  {id:"oh_m01",date:"2026-05-02",location:4,event:"PHANTA\$Y & CHRIS RAIN",notes:"Plastik?",
   plastik:true,missingStaff:true,kundenkarte:"Agentur",
   prodL:{name:"Luise",startTime:"14:30"},startGastro:"17:30",schlussShow:"22:30",belegungsende:"01:00",
   barStaff:[
     {name:"",pos:1,ov:null,miss:true},
     {name:"Ines",pos:2,ov:null,miss:false},
   ]},

  /* Fr.08.05 – PTK verlegt in H39 */
  {id:"oh_m02",date:"2026-05-08",location:4,event:"PTK",
   notes:"Verlegt in die H39",
   plastik:false,missingStaff:false,kundenkarte:"",relocated:"H39 \xB7 Location 2",
   prodL:null,startGastro:"19:30",schlussShow:"23:30",belegungsende:"01:30",
   barStaff:[]},

  /* Sa.09.05 – Malummi ABGESAGT */
  {id:"oh_m03",date:"2026-05-09",location:4,event:"Malummi",notes:"Abgesagt",
   plastik:false,missingStaff:false,kundenkarte:"Intern",cancelled:true,
   prodL:{name:"Mady",startTime:"15:30"},startGastro:"19:30",schlussShow:"22:30",belegungsende:"00:30",
   barStaff:[
     {name:"Felix",pos:1,ov:null,miss:false},
     {name:"Franzi",pos:2,ov:null,miss:false},
     {name:"Lena",pos:4,ov:null,miss:false},
   ]},

  /* Di.12.05 – jaschu */
  {id:"oh_m04",date:"2026-05-12",location:4,event:"jaschu",notes:"Plastik?",
   plastik:true,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Bruce",startTime:"15:00"},startGastro:"19:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Lucas",pos:1,ov:null,miss:false},
     {name:"Richard",pos:2,ov:null,miss:false},
   ]},

  /* Fr.15.05 – Jutta Koller Geburtstag */
  {id:"oh_m05",date:"2026-05-15",location:4,event:"Jutta Koller Geburtstag",
   notes:"Externer Caterer",
   plastik:false,missingStaff:false,kundenkarte:"Kunde",
   prodL:{name:"Pauline",startTime:"16:30"},startGastro:"17:30",schlussShow:"00:00",belegungsende:"01:30",
   barStaff:[
     {name:"Henry",pos:1,ov:null,miss:false},
   ]},

  /* Sa.16.05 – Feierwerk Sessions */
  {id:"oh_m06",date:"2026-05-16",location:4,event:"Feierwerk Sessions",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Intern",
   prodL:{name:"Mady",startTime:"15:00"},startGastro:"18:30",schlussShow:"22:30",belegungsende:"00:00",
   barStaff:[
     {name:"Ines",pos:1,ov:null,miss:false},
   ]},

  /* So.17.05 – Angel Du$t */
  {id:"oh_m07",date:"2026-05-17",location:4,event:"Angel Du\$t",notes:"Plastik",
   plastik:true,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Lena",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Jonathan",pos:1,ov:null,miss:false},
     {name:"Richard",pos:2,ov:null,miss:false},
   ]},

  /* Fr.22.05 – Wallner & die Rax Band (Bar2 fehlt) */
  {id:"oh_m08",date:"2026-05-22",location:4,event:"Wallner & die Rax Band",notes:"",
   plastik:false,missingStaff:true,kundenkarte:"Agentur",
   prodL:{name:"Pauline",startTime:"15:30"},startGastro:"18:30",schlussShow:"00:00",belegungsende:"01:00",
   barStaff:[
     {name:"Jonathan",pos:1,ov:null,miss:false},
     {name:"",pos:2,ov:null,miss:true},
   ]},

  /* Di.26.05 – Munich Grand Slam */
  {id:"oh_m09",date:"2026-05-26",location:4,event:"Munich Grand Slam",notes:"",
   plastik:false,missingStaff:false,kundenkarte:"Agentur",
   prodL:{name:"Anna",startTime:"15:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Igor",pos:1,ov:"18:00",miss:false},
     {name:"Franzi",pos:2,ov:"18:00",miss:false},
   ]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   JULI 2026 – LOCATION 1 (KH)
   Quelle: hochgeladener Screenshot des Thekenplans KH.
   Hinweis: Kasse/Garderobe existieren nicht als eigenes Feld
   und stehen daher als Text in den Notizen.
   ============================================================ */
[
  /* Fr.03.07 – School of Rock */
  {id:"kh_jul01",date:"2026-07-03",location:1,event:"School of Rock",
   notes:"Plastik ? · Kasse: Sascha",veranstaltungsnummer:"26070320KH",
   plastik:true,missingStaff:false,kundenkarte:"",
   prodL:{name:"Mady",startTime:"14:30"},startGastro:"16:30",schlussShow:"22:00",belegungsende:"00:30",
   barStaff:[
     {name:"Lucia",pos:1,ov:null,miss:false},
     {name:"Bonnie",pos:2,ov:null,miss:false},
   ]},

  /* Sa.11.07 – Katzenclub */
  {id:"kh_jul02",date:"2026-07-11",location:1,event:"Katzenclub",
   notes:"Get In tba",veranstaltungsnummer:"26071120KH",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Marlon",startTime:"15:00"},startGastro:"19:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Felix Hölter",pos:1,ov:null,miss:false},
     {name:"Henry",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:null,miss:false},
     {name:"Igor",pos:4,ov:null,miss:false},
   ]},

  /* Mo.13.07 – PL Treffen (alle Locations, Treffen KH Cafe) */
  {id:"kh_jul03",date:"2026-07-13",location:1,event:"PL Treffen",
   notes:"KH Cafe",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"alle",startTime:"16:00"},startGastro:"16:00",schlussShow:"19:00",belegungsende:"19:00",
   barStaff:[]},

  /* Mi.15.07 – House of Protection */
  {id:"kh_jul04",date:"2026-07-15",location:1,event:"House of Protection",
   notes:"Plastik ? · Garderobe: Kostja",veranstaltungsnummer:"26071520KH",
   plastik:true,missingStaff:false,kundenkarte:"",
   prodL:{name:"Luise",startTime:"13:30"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Jonathan",pos:1,ov:null,miss:false},
     {name:"Felix Hohl",pos:2,ov:null,miss:false},
   ]},

  /* Do.16.07 – Jubiläumsfeier Kinderschutz (Get In Bar 17:00) */
  {id:"kh_jul05",date:"2026-07-16",location:1,event:"Jubiläumsfeier Kinderschutz",
   notes:"externes Catering · Kein Schnaps, Kein Aperol · Kein Pfand",veranstaltungsnummer:"26071613KH",
   plastik:false,missingStaff:false,kundenkarte:"Kunde",
   prodL:{name:"Lena",startTime:"14:00"},startGastro:"17:00",schlussShow:"23:00",belegungsende:"01:00",
   barStaff:[
     {name:"Bonnie",pos:1,ov:"17:00",miss:false},
     {name:"Claudio",pos:2,ov:"17:00",miss:false},
     {name:"Dominic",pos:3,ov:"17:00",miss:false},
     {name:"Tim",pos:4,ov:"17:00",miss:false},
   ]},

  /* Sa.18.07 – MoreCore (Bar 4 unbesetzt) */
  {id:"kh_jul06",date:"2026-07-18",location:1,event:"MoreCore",
   notes:"Garderobe: Sascha",veranstaltungsnummer:"26071823KH",
   plastik:false,missingStaff:true,kundenkarte:"",
   prodL:{name:"Lena",startTime:"20:30"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Galia",pos:1,ov:null,miss:false},
     {name:"Laura",pos:2,ov:null,miss:false},
     {name:"Felix Hohl",pos:3,ov:null,miss:false},
     {name:"",pos:4,ov:null,miss:true},
   ]},

  /* So.26.07 – geblockt wg. DP-Sommerfest */
  {id:"kh_jul07",date:"2026-07-26",location:1,event:"geblockt wg. DP-Sommerfest",
   notes:"Sperrtermin – kein Barbetrieb",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:null,schlussShow:null,belegungsende:null,barStaff:[]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   JULI 2026 – LOCATION 2 (H39)
   Quelle: hochgeladener Screenshot des Thekenplans H39.
   ============================================================ */
[
  /* Fr.03.07 – Black Opera */
  {id:"h39_jul01",date:"2026-07-03",location:2,event:"Black Opera",
   notes:"",veranstaltungsnummer:"26070322H39",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Anna",startTime:"20:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"06:30",
   barStaff:[
     {name:"Jonathan",pos:1,ov:null,miss:false},
     {name:"Henry",pos:2,ov:null,miss:false},
     {name:"Galia",pos:3,ov:null,miss:false},
     {name:"Tim",pos:4,ov:null,miss:false},
   ]},

  /* Mo.13.07 – PL Treffen */
  {id:"h39_jul02",date:"2026-07-13",location:2,event:"PL Treffen",
   notes:"KH Cafe",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"alle",startTime:"16:00"},startGastro:"16:00",schlussShow:"19:00",belegungsende:"19:00",
   barStaff:[]},

  /* Do.16.07 – Jubiläumsfeier Kinderschutz */
  {id:"h39_jul03",date:"2026-07-16",location:2,event:"Jubiläumsfeier Kinderschutz",
   notes:"",veranstaltungsnummer:"26071617H39",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Bruce",startTime:"14:00"},startGastro:"14:30",schlussShow:"23:00",belegungsende:"01:00",
   barStaff:[]},

  /* Sa.18.07 – MoreCore (nur Saal · Fr.17.07 in H38 bis 3 Uhr) */
  {id:"h39_jul04",date:"2026-07-18",location:2,event:"MoreCore",
   notes:"nur Saal · Fr.17.07 (H38) bis 3 Uhr",veranstaltungsnummer:"26071823H39",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Marlon",startTime:"20:30"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[
     {name:"Claudio",pos:1,ov:null,miss:false},
     {name:"Igor",pos:2,ov:null,miss:false},
     {name:"Tim",pos:3,ov:null,miss:false},
   ]},

  /* Di.21.07 – Voivod */
  {id:"h39_jul05",date:"2026-07-21",location:2,event:"Voivod",
   notes:"Plastik – nur Saal · Garderobe: Kostja",veranstaltungsnummer:"26072120H39",
   plastik:true,missingStaff:false,kundenkarte:"",
   prodL:{name:"Luise",startTime:"14:00"},startGastro:"18:30",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Dominic",pos:1,ov:null,miss:false},
     {name:"Jonathan",pos:2,ov:null,miss:false},
     {name:"Ines",pos:3,ov:null,miss:false},
   ]},

  /* Sa.25.07 – Aufbau Sommerfest Dschungelpalast */
  {id:"h39_jul06",date:"2026-07-25",location:2,event:"Aufbau Sommerfest Dschungelpalast",
   notes:"Aufbau – kein Barbetrieb",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:null,schlussShow:null,belegungsende:"00:00",barStaff:[]},

  /* So.26.07 – Sommerfest Dschungel */
  {id:"h39_jul07",date:"2026-07-26",location:2,event:"Sommerfest Dschungel",
   notes:"Details siehe OH",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:null,schlussShow:null,belegungsende:null,barStaff:[]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   JULI 2026 – LOCATION 3 (Sunny / SR)
   Quelle: hochgeladener Screenshot.
   Hinweis: Sa.18.07 "Thomas Gögi" war durchgestrichen (abgesagt)
   und wurde daher nicht übernommen.
   ============================================================ */
[
  /* Mi.01.07 – Reggae Jam */
  {id:"sr_jul01",date:"2026-07-01",location:3,event:"Reggae Jam",
   notes:"",veranstaltungsnummer:"26070120SR",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Marlon",startTime:"18:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Igor",pos:1,ov:null,miss:false}]},

  /* Fr.03.07 – Zombie Sessions */
  {id:"sr_jul02",date:"2026-07-03",location:3,event:"Zombie Sessions",
   notes:"",veranstaltungsnummer:"26070321SR",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Marlon",startTime:"18:00"},startGastro:"19:30",schlussShow:"00:00",belegungsende:"01:00",
   barStaff:[{name:"Ines",pos:1,ov:null,miss:false}]},

  /* Sa.04.07 – Dubtown */
  {id:"sr_jul03",date:"2026-07-04",location:3,event:"Dubtown",
   notes:"",veranstaltungsnummer:"26070423SR",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Luise",startTime:"21:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* Mi.08.07 – Bold */
  {id:"sr_jul04",date:"2026-07-08",location:3,event:"Bold",
   notes:"",veranstaltungsnummer:"26070820SR",
   plastik:false,missingStaff:false,kundenkarte:"Marken",
   prodL:{name:"Luise",startTime:"16:00"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[{name:"Laura",pos:1,ov:null,miss:false}]},

  /* Mo.13.07 – PL Treffen */
  {id:"sr_jul05",date:"2026-07-13",location:3,event:"PL Treffen",
   notes:"KH Cafe",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"alle",startTime:"16:00"},startGastro:"16:00",schlussShow:"19:00",belegungsende:"19:00",
   barStaff:[]},

  /* Do.16.07 – Black Rat */
  {id:"sr_jul06",date:"2026-07-16",location:3,event:"Black Rat",
   notes:"",veranstaltungsnummer:"26071620SR",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Luise",startTime:"18:00"},startGastro:"19:30",schlussShow:"00:00",belegungsende:"01:00",
   barStaff:[{name:"Henry",pos:1,ov:null,miss:false}]},

  /* Fr.17.07 – Technoparty */
  {id:"sr_jul07",date:"2026-07-17",location:3,event:"Technoparty",
   notes:"",veranstaltungsnummer:"26071723SR",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Luise",startTime:"20:00"},startGastro:"22:30",schlussShow:"05:00",belegungsende:"07:00",
   barStaff:[{name:"Felix Hölter",pos:1,ov:null,miss:false}]},

  /* Fr.24.07 – Sacred Bones */
  {id:"sr_jul08",date:"2026-07-24",location:3,event:"Sacred Bones",
   notes:"",veranstaltungsnummer:"26072422SR",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Anna",startTime:"21:00"},startGastro:"21:30",schlussShow:"05:00",belegungsende:"06:30",
   barStaff:[{name:"Jonathan",pos:1,ov:null,miss:false}]},

  /* So.26.07 – geblockt wegen DP Sommerfest */
  {id:"sr_jul09",date:"2026-07-26",location:3,event:"geblockt wegen DP Sommerfest",
   notes:"Sperrtermin – kein Barbetrieb",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:null,schlussShow:null,belegungsende:null,barStaff:[]},
].forEach(e=>EVENTS.push(e));

/* ============================================================
   JULI 2026 – LOCATION 4 (OH)
   Quelle: hochgeladener Screenshot.
   ============================================================ */
[
  /* Fr.03.07 – A Thousand Horses */
  {id:"oh_jul01",date:"2026-07-03",location:4,event:"A Thousand Horses",
   notes:"Plastik · Garderobe: Dave Crew",veranstaltungsnummer:"26070320OH",
   plastik:true,missingStaff:false,kundenkarte:"",
   prodL:{name:"Luise",startTime:"14:30"},startGastro:"19:00",schlussShow:"23:30",belegungsende:"01:00",
   barStaff:[
     {name:"Richard",pos:1,ov:null,miss:false},
     {name:"Franzi",pos:2,ov:null,miss:false},
   ]},

  /* Sa.04.07 – Valeria Erhardt Abiball Afterparty */
  {id:"oh_jul02",date:"2026-07-04",location:4,event:"Valeria Erhardt Abiball Afterparty",
   notes:"",veranstaltungsnummer:"26070419OH",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Marlon",startTime:"22:00"},startGastro:"22:00",schlussShow:"04:00",belegungsende:"05:00",
   barStaff:[
     {name:"Franzi",pos:1,ov:null,miss:false},
     {name:"Gabi",pos:2,ov:null,miss:false},
   ]},

  /* Do.09.07 – Münchner Trichter (Prod L / Gastro noch offen) */
  {id:"oh_jul03",date:"2026-07-09",location:4,event:"Münchner Trichter",
   notes:"Prod L / Start Gastro noch offen",veranstaltungsnummer:"26070912OH",
   plastik:false,missingStaff:true,kundenkarte:"",
   prodL:null,startGastro:null,schlussShow:"18:00",belegungsende:"20:00",barStaff:[]},

  /* Sa.11.07 – Daniel Prümers Geburtstagsfeier */
  {id:"oh_jul04",date:"2026-07-11",location:4,event:"Daniel Prümers Geburtstagsfeier",
   notes:"",veranstaltungsnummer:"26071119OH",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Lena",startTime:"16:30"},startGastro:"18:30",schlussShow:"03:00",belegungsende:"04:30",
   barStaff:[
     {name:"Gabi",pos:1,ov:null,miss:false},
     {name:"Richard",pos:2,ov:null,miss:false},
   ]},

  /* Mo.13.07 – PL Treffen */
  {id:"oh_jul05",date:"2026-07-13",location:4,event:"PL Treffen",
   notes:"KH Cafe",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"alle",startTime:"16:00"},startGastro:"16:00",schlussShow:"19:00",belegungsende:"19:00",
   barStaff:[]},

  /* Sa.25.07 – Aufbau Sommerfest Dschungelpalast */
  {id:"oh_jul06",date:"2026-07-25",location:4,event:"Aufbau Sommerfest Dschungelpalast",
   notes:"Aufbau – kein Barbetrieb",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:null,startGastro:null,schlussShow:null,belegungsende:"00:00",barStaff:[]},

  /* So.26.07 – Dschungelpalast Sommerfest */
  {id:"oh_jul07",date:"2026-07-26",location:4,event:"Dschungelpalast Sommerfest",
   notes:"Booker: szenkne",veranstaltungsnummer:"26072612OH",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Luise",startTime:"10:30"},startGastro:"11:30",schlussShow:"18:00",belegungsende:"19:00",
   barStaff:[
     {name:"Gabi",pos:1,ov:null,miss:false},
     {name:"Igor",pos:2,ov:null,miss:false},
     {name:"Bonnie",pos:3,ov:null,miss:false},
     {name:"Felix Hohl",pos:4,ov:null,miss:false},
   ]},

  /* Di.28.07 – Mitarbeiter*innen-Sommerfest */
  {id:"oh_jul08",date:"2026-07-28",location:4,event:"Mitarbeiter*innen-Sommerfest",
   notes:"",
   plastik:false,missingStaff:false,kundenkarte:"",
   prodL:{name:"Anna",startTime:"14:00"},startGastro:"14:00",schlussShow:"00:00",belegungsende:"01:00",
   barStaff:[{name:"Tim",pos:1,ov:null,miss:false}]},
].forEach(e=>EVENTS.push(e));

/* Snapshot der eingebauten Standarddaten (für "Zurücksetzen") */
const DEFAULT_EVENTS = JSON.stringify(EVENTS);
