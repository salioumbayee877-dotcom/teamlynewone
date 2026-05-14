"use strict";

// Base géographique du Sénégal — utilisée pour extraire la ville depuis une
// adresse brute (Shopify/Woo/YouCan) quand le champ `city` est absent ou
// ambigu (ex: "-", "ND", quartier au lieu de la ville).

const SENEGAL_CITIES = [
  // DAKAR
  {city:"Dakar",region:"Dakar"},{city:"Plateau",region:"Dakar"},
  {city:"Medina",region:"Dakar"},{city:"Fann",region:"Dakar"},
  {city:"Almadies",region:"Dakar"},{city:"Ouakam",region:"Dakar"},
  {city:"Ngor",region:"Dakar"},{city:"Yoff",region:"Dakar"},
  {city:"Grand Dakar",region:"Dakar"},{city:"Biscuiterie",region:"Dakar"},
  {city:"HLM",region:"Dakar"},{city:"Mermoz",region:"Dakar"},
  {city:"Sacre Coeur",region:"Dakar"},{city:"Sicap",region:"Dakar"},
  {city:"Liberte",region:"Dakar"},{city:"Point E",region:"Dakar"},
  {city:"Hann",region:"Dakar"},{city:"Patte d'Oie",region:"Dakar"},
  {city:"Parcelles Assainies",region:"Dakar"},{city:"Camberene",region:"Dakar"},
  {city:"Grand Yoff",region:"Dakar"},
  {city:"Pikine",region:"Dakar"},{city:"Pikine Nord",region:"Dakar"},
  {city:"Pikine Est",region:"Dakar"},{city:"Pikine Ouest",region:"Dakar"},
  {city:"Thiaroye",region:"Dakar"},{city:"Thiaroye sur Mer",region:"Dakar"},
  {city:"Yeumbeul",region:"Dakar"},{city:"Yeumbeul Nord",region:"Dakar"},
  {city:"Yeumbeul Sud",region:"Dakar"},{city:"Diamaguene Sicap Mbao",region:"Dakar"},
  {city:"Mbao",region:"Dakar"},
  {city:"Keur Massar",region:"Dakar"},{city:"Jaxaay",region:"Dakar"},
  {city:"Malika",region:"Dakar"},{city:"Sangalkam",region:"Dakar"},
  {city:"Guediawaye",region:"Dakar"},{city:"Golf Sud",region:"Dakar"},
  {city:"Medina Gounass",region:"Dakar"},{city:"Ndiare Limamoulaye",region:"Dakar"},
  {city:"Sam Notaire",region:"Dakar"},{city:"Wakhinane",region:"Dakar"},
  {city:"Rufisque",region:"Dakar"},{city:"Rufisque Est",region:"Dakar"},
  {city:"Rufisque Nord",region:"Dakar"},{city:"Rufisque Ouest",region:"Dakar"},
  {city:"Bargny",region:"Dakar"},{city:"Diamniadio",region:"Dakar"},
  {city:"Sebikotane",region:"Dakar"},{city:"Sendou",region:"Dakar"},
  {city:"Yene",region:"Dakar"},{city:"Bambilor",region:"Dakar"},

  // THIES
  {city:"Thies",region:"Thies"},{city:"Thies Nord",region:"Thies"},
  {city:"Thies Est",region:"Thies"},{city:"Thies Ouest",region:"Thies"},
  {city:"Fandene",region:"Thies"},{city:"Keur Moussa",region:"Thies"},
  {city:"Notto Gouye Diama",region:"Thies"},{city:"Ngoundiane",region:"Thies"},
  {city:"Mbour",region:"Thies"},{city:"Saly",region:"Thies"},
  {city:"Saly Portudal",region:"Thies"},{city:"Joal-Fadiouth",region:"Thies"},
  {city:"Joal",region:"Thies"},{city:"Nguekokh",region:"Thies"},
  {city:"Sindia",region:"Thies"},{city:"Malicounda",region:"Thies"},
  {city:"Popenguine",region:"Thies"},{city:"Ngaparou",region:"Thies"},
  {city:"Somone",region:"Thies"},
  {city:"Tivaouane",region:"Thies"},{city:"Mekhe",region:"Thies"},
  {city:"Pout",region:"Thies"},{city:"Kayar",region:"Thies"},
  {city:"Khombole",region:"Thies"},{city:"Mboro",region:"Thies"},

  // DIOURBEL
  {city:"Diourbel",region:"Diourbel"},{city:"Bambey",region:"Diourbel"},
  {city:"Touba",region:"Diourbel"},{city:"Mbacke",region:"Diourbel"},
  {city:"Ndame",region:"Diourbel"},{city:"Ndoulo",region:"Diourbel"},
  {city:"Ndindy",region:"Diourbel"},

  // FATICK
  {city:"Fatick",region:"Fatick"},{city:"Foundiougne",region:"Fatick"},
  {city:"Gossas",region:"Fatick"},{city:"Sokone",region:"Fatick"},
  {city:"Passy",region:"Fatick"},{city:"Dioffior",region:"Fatick"},

  // KAOLACK
  {city:"Kaolack",region:"Kaolack"},{city:"Guinguineo",region:"Kaolack"},
  {city:"Nioro du Rip",region:"Kaolack"},{city:"Ndoffane",region:"Kaolack"},
  {city:"Kahone",region:"Kaolack"},{city:"Gandiaye",region:"Kaolack"},

  // KAFFRINE
  {city:"Kaffrine",region:"Kaffrine"},{city:"Birkilane",region:"Kaffrine"},
  {city:"Koungheul",region:"Kaffrine"},{city:"Malem-Hodar",region:"Kaffrine"},

  // SAINT-LOUIS
  {city:"Saint-Louis",region:"Saint-Louis"},{city:"Saint Louis",region:"Saint-Louis"},
  {city:"Dagana",region:"Saint-Louis"},{city:"Podor",region:"Saint-Louis"},
  {city:"Richard Toll",region:"Saint-Louis"},{city:"Richard-Toll",region:"Saint-Louis"},
  {city:"Rosso",region:"Saint-Louis"},{city:"Ndioum",region:"Saint-Louis"},

  // LOUGA
  {city:"Louga",region:"Louga"},{city:"Kebemer",region:"Louga"},
  {city:"Linguere",region:"Louga"},{city:"Dahra",region:"Louga"},
  {city:"Coki",region:"Louga"},

  // MATAM
  {city:"Matam",region:"Matam"},{city:"Kanel",region:"Matam"},
  {city:"Ranerou",region:"Matam"},{city:"Ourossogui",region:"Matam"},
  {city:"Thilogne",region:"Matam"},

  // TAMBACOUNDA
  {city:"Tambacounda",region:"Tambacounda"},{city:"Bakel",region:"Tambacounda"},
  {city:"Goudiry",region:"Tambacounda"},{city:"Koumpentoum",region:"Tambacounda"},
  {city:"Kidira",region:"Tambacounda"},

  // KEDOUGOU
  {city:"Kedougou",region:"Kedougou"},{city:"Saraya",region:"Kedougou"},
  {city:"Salemata",region:"Kedougou"},

  // KOLDA
  {city:"Kolda",region:"Kolda"},{city:"Medina Yoro Foulah",region:"Kolda"},
  {city:"Velingara",region:"Kolda"},{city:"Dabo",region:"Kolda"},

  // SEDHIOU
  {city:"Sedhiou",region:"Sedhiou"},{city:"Bounkiling",region:"Sedhiou"},
  {city:"Goudomp",region:"Sedhiou"},

  // ZIGUINCHOR
  {city:"Ziguinchor",region:"Ziguinchor"},{city:"Bignona",region:"Ziguinchor"},
  {city:"Oussouye",region:"Ziguinchor"},{city:"Cap Skirring",region:"Ziguinchor"},
  {city:"Diouloulou",region:"Ziguinchor"},{city:"Kafountine",region:"Ziguinchor"},
];

const norm = s => (s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Pre-compute sorted list (longest names first) so "Keur Massar" wins over "Keur".
const CITIES_SORTED = SENEGAL_CITIES
  .map(c => ({ ...c, _norm: norm(c.city) }))
  .filter(c => c._norm.length >= 3)
  .sort((a, b) => b._norm.length - a._norm.length);

/**
 * Extract a Sénégal city from a raw address string.
 * Tries: substring match against the known city catalogue (longest first),
 * then word-by-word lookup as a fallback.
 *
 * @param {string} rawAddress  raw address (any concatenation of city/region/address fields)
 * @returns {{ city: string, region: string, isDakar: boolean } | null}
 */
function extractCityFromAddress(rawAddress) {
  const t = norm(rawAddress);
  if (!t) return null;

  // 1. Substring match (handles "Touba, -", "Quartier Médina Dakar", etc.)
  for (const c of CITIES_SORTED) {
    const re = new RegExp(`(^|\\s)${c._norm.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\s|$)`);
    if (re.test(t)) return { city: c.city, region: c.region, isDakar: c.region === "Dakar" };
  }

  // 2. Word-token fallback (single-token equality, e.g. "TOUBA")
  const tokens = t.split(" ");
  for (const tok of tokens) {
    if (tok.length < 3) continue;
    const hit = CITIES_SORTED.find(c => c._norm === tok);
    if (hit) return { city: hit.city, region: hit.region, isDakar: hit.region === "Dakar" };
  }

  return null;
}

module.exports = { SENEGAL_CITIES, extractCityFromAddress, norm };
