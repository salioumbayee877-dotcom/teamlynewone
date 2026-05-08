// Shared geo + delivery-zone helpers — extracted from App.jsx so component
// files can import them without depending on App's closure.

export const WA_ZONES = [
  // ── Sénégal ─────────────────────────────────────────────────────────────
  {key:"sn_dakar",  country:"SN", flag:"🇸🇳", label:"Dakar / Banlieue",   price:1500,  prepaid:false, color:"#22C55E",
   kw:["dakar","medina","medine","plateau","almadies","yoff","ngor","ouakam","mermoz","fann","hlm","liberte","pikine","guediawaye","rufisque","bargny","keur massar","malika","thiaroye","mbao","grand yoff","parcelles","sicap","camberene","dalifort","niayes","hann","biscuiterie","gueule tapee","point e","fass","colobane","rebeuss","usine","patte d'oie","sotrac","kip","dakar plateau"]},
  {key:"sn_centre", country:"SN", flag:"🇸🇳", label:"Sénégal (Centre)",   price:3000,  prepaid:false, color:"#F59E0B",
   kw:["thies","mbour","kaolack","diourbel","touba","fatick","saly","joal","tivaouane","bambey","gossas","mbacke","mboro","khombole","ngaparou","somone","popenguine","pout","sindia","saint-louis","louga","kebemer","linguere","ndioum","richard-toll"]},
  {key:"sn_remote", country:"SN", flag:"🇸🇳", label:"Sénégal (Sud/Est)",  price:5000,  prepaid:false, color:"#F97316",
   kw:["ziguinchor","kolda","tambacounda","matam","kedougou","sedhiou","velingara","saraya","kaffrine","kidira","bakel","goudiry","koungheul","bignona","oussouye","mlomp","kafountine","medina yoro foulah"]},
  // ── International CEDEAO ────────────────────────────────────────────────
  {key:"ml", country:"ML", flag:"🇲🇱", label:"Mali",           price:9000,  prepaid:true, color:"#DC2626",
   kw:["mali","bamako","sikasso","segou","kayes","mopti","gao","tombouctou","kidal","koulikoro","bougouni","san","markala","niono"]},
  {key:"ci", country:"CI", flag:"🇨🇮", label:"Côte d'Ivoire",  price:11000, prepaid:true, color:"#DC2626",
   kw:["côte d'ivoire","cote d'ivoire","cote divoire","abidjan","bouake","bouaké","yamoussoukro","korhogo","daloa","san pedro","man","gagnoa","divo","agboville","abengourou","bondoukou","odienne"]},
  {key:"tg", country:"TG", flag:"🇹🇬", label:"Togo",           price:11000, prepaid:true, color:"#DC2626",
   kw:["togo","lomé","lome","kpalimé","kpalime","atakpame","atakpamé","sokode","kara","dapaong","tsevie","anecho","vogan","mango"]},
  {key:"bf", country:"BF", flag:"🇧🇫", label:"Burkina Faso",   price:10000, prepaid:true, color:"#DC2626",
   kw:["burkina","ouagadougou","ouaga","bobo-dioulasso","bobo dioulasso","koudougou","banfora","ouahigouya","dedougou","fada ngourma","tenkodogo","kaya","leo"]},
  {key:"bj", country:"BJ", flag:"🇧🇯", label:"Bénin",          price:11000, prepaid:true, color:"#DC2626",
   kw:["benin","bénin","cotonou","porto-novo","porto novo","parakou","abomey","natitingou","lokossa","ouidah","bohicon","kandi","djougou"]},
];

export const _nz       = s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
export const detectZone = addr => WA_ZONES.find(z => z.kw.some(k => _nz(addr).includes(k))) || WA_ZONES[0];

// Order address formatter — combine the quartier (o.address) with the ville
// (o.city), avoiding duplication when the address already contains the city
// (e.g. Shopify webhooks that join address1+city+province).
export const fullAddr = (o) => {
  const parts = [];
  const addr  = (o?.address||"").trim();
  const city  = (o?.city||"").trim();
  if (addr) parts.push(addr);
  if (city && !_nz(addr).includes(_nz(city))) parts.push(city);
  return parts.join(", ") || "—";
};

// ── Zone de livraison configurable ─────────────────────────────────────────
export const _normCity  = s => (s||"").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
export const _parseCity = s => { const idx=(s||"").lastIndexOf("|"); return idx===-1?{name:s||"",price:null}:{name:s.slice(0,idx),price:parseInt(s.slice(idx+1))||null}; };

// ── Base géographique complète du Sénégal ────────────────────────────────────
export const SENEGAL_CITIES = [
  // DAKAR
  {city:"Dakar",department:"Dakar",region:"Dakar"},{city:"Plateau",department:"Dakar",region:"Dakar"},
  {city:"Medina",department:"Dakar",region:"Dakar"},{city:"Fann",department:"Dakar",region:"Dakar"},
  {city:"Almadies",department:"Dakar",region:"Dakar"},{city:"Ouakam",department:"Dakar",region:"Dakar"},
  {city:"Ngor",department:"Dakar",region:"Dakar"},{city:"Yoff",department:"Dakar",region:"Dakar"},
  {city:"Grand Dakar",department:"Dakar",region:"Dakar"},{city:"Biscuiterie",department:"Dakar",region:"Dakar"},
  {city:"HLM",department:"Dakar",region:"Dakar"},{city:"Pikine",department:"Pikine",region:"Dakar"},
  {city:"Pikine Nord",department:"Pikine",region:"Dakar"},{city:"Pikine Est",department:"Pikine",region:"Dakar"},
  {city:"Pikine Ouest",department:"Pikine",region:"Dakar"},{city:"Thiaroye",department:"Pikine",region:"Dakar"},
  {city:"Thiaroye sur Mer",department:"Pikine",region:"Dakar"},{city:"Yeumbeul Nord",department:"Pikine",region:"Dakar"},
  {city:"Yeumbeul Sud",department:"Pikine",region:"Dakar"},{city:"Diamaguene Sicap Mbao",department:"Pikine",region:"Dakar"},
  {city:"Mbao",department:"Pikine",region:"Dakar"},{city:"Keur Massar",department:"Keur Massar",region:"Dakar"},
  {city:"Jaxaay",department:"Keur Massar",region:"Dakar"},{city:"Malika",department:"Keur Massar",region:"Dakar"},
  {city:"Sangalkam",department:"Keur Massar",region:"Dakar"},{city:"Guediawaye",department:"Guediawaye",region:"Dakar"},
  {city:"Golf Sud",department:"Guediawaye",region:"Dakar"},{city:"Medina Gounass",department:"Guediawaye",region:"Dakar"},
  {city:"Ndiare Limamoulaye",department:"Guediawaye",region:"Dakar"},{city:"Sam Notaire",department:"Guediawaye",region:"Dakar"},
  {city:"Rufisque",department:"Rufisque",region:"Dakar"},{city:"Rufisque Est",department:"Rufisque",region:"Dakar"},
  {city:"Rufisque Nord",department:"Rufisque",region:"Dakar"},{city:"Rufisque Ouest",department:"Rufisque",region:"Dakar"},
  {city:"Bargny",department:"Rufisque",region:"Dakar"},{city:"Diamniadio",department:"Rufisque",region:"Dakar"},
  {city:"Sebikotane",department:"Rufisque",region:"Dakar"},{city:"Sendou",department:"Rufisque",region:"Dakar"},
  // THIES
  {city:"Thies",department:"Thies",region:"Thies"},{city:"Thies Nord",department:"Thies",region:"Thies"},
  {city:"Thies Est",department:"Thies",region:"Thies"},{city:"Thies Ouest",department:"Thies",region:"Thies"},
  {city:"Fandene",department:"Thies",region:"Thies"},{city:"Keur Moussa",department:"Thies",region:"Thies"},
  {city:"Notto Gouye Diama",department:"Thies",region:"Thies"},{city:"Ngoundiane",department:"Thies",region:"Thies"},
  {city:"Mbour",department:"Mbour",region:"Thies"},{city:"Saly",department:"Mbour",region:"Thies"},
  {city:"Saly Portudal",department:"Mbour",region:"Thies"},{city:"Joal-Fadiouth",department:"Mbour",region:"Thies"},
  {city:"Joal",department:"Mbour",region:"Thies"},{city:"Nguekokh",department:"Mbour",region:"Thies"},
  {city:"Sindia",department:"Mbour",region:"Thies"},{city:"Malicounda",department:"Mbour",region:"Thies"},
  {city:"Popenguine",department:"Mbour",region:"Thies"},{city:"Tivaouane",department:"Tivaouane",region:"Thies"},
  {city:"Mekhe",department:"Tivaouane",region:"Thies"},{city:"Pout",department:"Tivaouane",region:"Thies"},
  {city:"Kayar",department:"Tivaouane",region:"Thies"},{city:"Khombole",department:"Tivaouane",region:"Thies"},
  // DIOURBEL
  {city:"Diourbel",department:"Diourbel",region:"Diourbel"},{city:"Bambey",department:"Bambey",region:"Diourbel"},
  {city:"Touba",department:"Mbacke",region:"Diourbel"},{city:"Mbacke",department:"Mbacke",region:"Diourbel"},
  {city:"Ndame",department:"Diourbel",region:"Diourbel"},{city:"Ndoulo",department:"Diourbel",region:"Diourbel"},
  {city:"Ndindy",department:"Bambey",region:"Diourbel"},
  // FATICK
  {city:"Fatick",department:"Fatick",region:"Fatick"},{city:"Foundiougne",department:"Foundiougne",region:"Fatick"},
  {city:"Gossas",department:"Gossas",region:"Fatick"},{city:"Sokone",department:"Foundiougne",region:"Fatick"},
  {city:"Passy",department:"Fatick",region:"Fatick"},{city:"Dioffior",department:"Fatick",region:"Fatick"},
  // KAOLACK
  {city:"Kaolack",department:"Kaolack",region:"Kaolack"},{city:"Guinguineo",department:"Guinguineo",region:"Kaolack"},
  {city:"Nioro du Rip",department:"Nioro du Rip",region:"Kaolack"},{city:"Ndoffane",department:"Guinguineo",region:"Kaolack"},
  {city:"Kahone",department:"Kaolack",region:"Kaolack"},{city:"Gandiaye",department:"Kaolack",region:"Kaolack"},
  // KAFFRINE
  {city:"Kaffrine",department:"Kaffrine",region:"Kaffrine"},{city:"Birkilane",department:"Birkilane",region:"Kaffrine"},
  {city:"Koungheul",department:"Koungheul",region:"Kaffrine"},{city:"Malem-Hodar",department:"Malem-Hodar",region:"Kaffrine"},
  // SAINT-LOUIS
  {city:"Saint-Louis",department:"Saint-Louis",region:"Saint-Louis"},{city:"Dagana",department:"Dagana",region:"Saint-Louis"},
  {city:"Podor",department:"Podor",region:"Saint-Louis"},{city:"Richard Toll",department:"Dagana",region:"Saint-Louis"},
  {city:"Rosso",department:"Dagana",region:"Saint-Louis"},{city:"Ndioum",department:"Podor",region:"Saint-Louis"},
  // LOUGA
  {city:"Louga",department:"Louga",region:"Louga"},{city:"Kebemer",department:"Kebemer",region:"Louga"},
  {city:"Linguere",department:"Linguere",region:"Louga"},{city:"Dahra",department:"Linguere",region:"Louga"},
  {city:"Coki",department:"Kebemer",region:"Louga"},
  // MATAM
  {city:"Matam",department:"Matam",region:"Matam"},{city:"Kanel",department:"Kanel",region:"Matam"},
  {city:"Ranerou",department:"Ranerou Ferlo",region:"Matam"},{city:"Ourossogui",department:"Matam",region:"Matam"},
  {city:"Thilogne",department:"Matam",region:"Matam"},
  // TAMBACOUNDA
  {city:"Tambacounda",department:"Tambacounda",region:"Tambacounda"},{city:"Bakel",department:"Bakel",region:"Tambacounda"},
  {city:"Goudiry",department:"Goudiry",region:"Tambacounda"},{city:"Koumpentoum",department:"Koumpentoum",region:"Tambacounda"},
  {city:"Kidira",department:"Bakel",region:"Tambacounda"},
  // KEDOUGOU
  {city:"Kedougou",department:"Kedougou",region:"Kedougou"},{city:"Saraya",department:"Saraya",region:"Kedougou"},
  {city:"Salemata",department:"Salemata",region:"Kedougou"},
  // KOLDA
  {city:"Kolda",department:"Kolda",region:"Kolda"},{city:"Medina Yoro Foulah",department:"Medina Yoro Foulah",region:"Kolda"},
  {city:"Velingara",department:"Velingara",region:"Kolda"},{city:"Dabo",department:"Kolda",region:"Kolda"},
  // SEDHIOU
  {city:"Sedhiou",department:"Sedhiou",region:"Sedhiou"},{city:"Bounkiling",department:"Bounkiling",region:"Sedhiou"},
  {city:"Goudomp",department:"Goudomp",region:"Sedhiou"},
  // ZIGUINCHOR
  {city:"Ziguinchor",department:"Ziguinchor",region:"Ziguinchor"},{city:"Bignona",department:"Bignona",region:"Ziguinchor"},
  {city:"Oussouye",department:"Oussouye",region:"Ziguinchor"},{city:"Cap Skirring",department:"Oussouye",region:"Ziguinchor"},
  {city:"Diouloulou",department:"Bignona",region:"Ziguinchor"},{city:"Kafountine",department:"Bignona",region:"Ziguinchor"},
];

export const _findSenCity = t => SENEGAL_CITIES.find(c=>_normCity(c.city)===t);

export const detectDeliveryZone = (city, mainZone, others, defaultPrice=3500) => {
  const t = _normCity(city);
  if(!t) return {type:"unknown",price:defaultPrice};
  // 1. Configured main zone
  if(mainZone?.cities?.length) { for(const cs of mainZone.cities) { const {name,price}=_parseCity(cs); if(_normCity(name)===t) return {type:"main",name:mainZone.name,cityName:name,price:price??mainZone.price??defaultPrice}; } }
  // 2. Configured other regions
  for(const r of (others||[])) {
    const itb = r.interurbain_price||0;
    if(_normCity(r.name)===t) return {type:"other",name:r.name,cityName:r.name,price:(r.price??defaultPrice)+itb,fraisLocale:r.price??defaultPrice,interurbain:itb};
    if(r.cities?.length) { for(const cs of r.cities) { const {name,price}=_parseCity(cs); if(_normCity(name)===t) return {type:"other",name:r.name,cityName:name,price:(price??r.price??defaultPrice)+itb,fraisLocale:price??r.price??defaultPrice,interurbain:itb}; } }
  }
  // 3. Sénégal geographic database — never treat known cities as unknown
  const sc = _findSenCity(t);
  if(sc) {
    const mainNorm = _normCity(mainZone?.name||"");
    const regNorm  = _normCity(sc.region);
    const isMain   = mainNorm && (regNorm===mainNorm || regNorm.includes(mainNorm) || mainNorm.includes(regNorm));
    if(isMain) return {type:"main",name:sc.region,cityName:sc.city,price:mainZone?.price??defaultPrice};
    return {type:"senegal",name:sc.region,cityName:sc.city,department:sc.department,price:defaultPrice};
  }
  return {type:"unknown",price:defaultPrice};
};
