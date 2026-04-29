// Hand-curated seed list.
// - `query`     → OFF text search
// - `brand`     → required brand match for OFF
// - `barcode`   → preferred over search (when set, picked by EAN)
// - `wikiTitle` → Wikipedia DE article title (used for canonical image)
// - `nameMust`  → tokens that MUST appear in OFF product_name to accept (avoids
//                 the "Snickers Hi-Protein" / "Twix Crisp" / wrong-product trap)

export type SeedCandy = {
  name: string;
  brand: string;
  query: string;
  barcode?: string;
  wikiTitle?: string;
  nameMust: string[]; // case-insensitive substrings (for OFF nutrition match)
  imageOverride?: string; // hand-curated Wikimedia Commons URL
};

export const CANDY_LIST: SeedCandy[] = [
  // Schoko-Riegel / Tafeln
  { name: "Kinder Schokolade", brand: "Ferrero", query: "Kinder Schokolade", wikiTitle: "Kinder_Schokolade", nameMust: ["kinder", "schokolade"] },
  { name: "Kinder Bueno", brand: "Ferrero", query: "Kinder Bueno", wikiTitle: "Kinder_Bueno", nameMust: ["bueno"] },
  { name: "Kinder Country", brand: "Ferrero", query: "Kinder Country", wikiTitle: "Kinder_Country", nameMust: ["country"] },
  { name: "Kinder Pingui", brand: "Ferrero", query: "Kinder Pingui", wikiTitle: "Kinder_Pingui", nameMust: ["pingui"] },
  { name: "Duplo", brand: "Ferrero", query: "Duplo Ferrero", wikiTitle: "Duplo_(Süßware)", nameMust: ["duplo"] },
  { name: "Hanuta", brand: "Ferrero", query: "Hanuta", wikiTitle: "Hanuta", nameMust: ["hanuta"] },
  { name: "Knoppers", brand: "Storck", query: "Knoppers", wikiTitle: "Knoppers", nameMust: ["knoppers"] },
  { name: "Knoppers NussRiegel", brand: "Storck", query: "Knoppers NussRiegel", wikiTitle: "Knoppers", nameMust: ["knoppers", "riegel"] },
  { name: "Milka Alpenmilch", brand: "Milka", query: "Milka Alpenmilch", barcode: "7622210449283", wikiTitle: "Milka_(Marke)", nameMust: ["milka", "alpenmilch"] },
  { name: "Ritter Sport Voll-Nuss", brand: "Ritter Sport", query: "Ritter Sport Voll-Nuss", wikiTitle: "Ritter_Sport", nameMust: ["ritter", "voll-nuss"] },
  { name: "Ritter Sport Knusperflakes", brand: "Ritter Sport", query: "Ritter Sport Knusperflakes", wikiTitle: "Ritter_Sport", nameMust: ["ritter", "knusper"] },
  { name: "Snickers", brand: "Mars", query: "Snickers", barcode: "5000159461122", wikiTitle: "Snickers", nameMust: ["snickers"] },
  { name: "Mars", brand: "Mars", query: "Mars Riegel", wikiTitle: "Mars_(Schokoriegel)", nameMust: ["mars"] },
  { name: "Bounty", brand: "Mars", query: "Bounty Riegel", wikiTitle: "Bounty_(Schokoriegel)", nameMust: ["bounty"] },
  { name: "Twix", brand: "Mars", query: "Twix", wikiTitle: "Twix", nameMust: ["twix"] },
  { name: "Lion", brand: "Nestlé", query: "Lion Riegel", wikiTitle: "Lion_(Schokoriegel)", nameMust: ["lion"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Lion-Bar-Split.jpg?width=600" },
  { name: "KitKat", brand: "Nestlé", query: "KitKat", wikiTitle: "KitKat", nameMust: ["kitkat", "kit kat"] },
  { name: "Yogurette", brand: "Ferrero", query: "Yogurette", wikiTitle: "Yogurette", nameMust: ["yogurette"] },
  { name: "Pickup Choco", brand: "Bahlsen", query: "Pick Up Choco Bahlsen", wikiTitle: "Pick_Up!", nameMust: ["pick", "up"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Leibniz_Pick-Up_1.jpg?width=600" },

  // Pralinen / Kugeln
  { name: "Ferrero Küsschen", brand: "Ferrero", query: "Ferrero Küsschen", wikiTitle: "Ferrero_Küsschen", nameMust: ["küsschen", "kuesschen", "kuss"] },
  { name: "Raffaello", brand: "Ferrero", query: "Raffaello", wikiTitle: "Raffaello_(Süßware)", nameMust: ["raffaello"] },
  { name: "Mon Chéri", brand: "Ferrero", query: "Mon Chéri", wikiTitle: "Mon_Chéri", nameMust: ["mon", "cheri", "chéri"] },
  { name: "Toffifee", brand: "Storck", query: "Toffifee", wikiTitle: "Toffifee", nameMust: ["toffifee"] },
  { name: "Merci", brand: "Storck", query: "Merci Schokolade", wikiTitle: "Merci_(Süßigkeit)", nameMust: ["merci"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Merci_-_Milk_Selection-6326.jpg?width=600" },
  { name: "Lindt Lindor", brand: "Lindt", query: "Lindt Lindor", wikiTitle: "Lindt_&_Sprüngli", nameMust: ["lindor"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Lindor_balls_(1).jpg?width=600" },

  // Fruchtgummi / Bonbons
  { name: "Haribo Goldbären", brand: "Haribo", query: "Haribo Goldbären", wikiTitle: "Goldbär", nameMust: ["goldbär", "goldbaer"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Gummi_bears_in_a_row.jpg?width=600" },
  { name: "Haribo Color-Rado", brand: "Haribo", query: "Haribo Color-Rado", wikiTitle: "Haribo", nameMust: ["color", "rado"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/German_sweets_and_liquorice_confectionery.jpg?width=600" },
  { name: "Haribo Pico-Balla", brand: "Haribo", query: "Haribo Pico-Balla", wikiTitle: "Haribo", nameMust: ["pico", "balla"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Haribo_Pico-Balla-1305.jpg?width=600" },
  { name: "Haribo Tropi-Frutti", brand: "Haribo", query: "Haribo Tropi-Frutti", wikiTitle: "Haribo", nameMust: ["tropi"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Haribo_Tropifrutti-7420.jpg?width=600" },
  { name: "Maoam", brand: "Haribo", query: "Maoam", wikiTitle: "Maoam", nameMust: ["maoam"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Vyrazka_Haribo_Maoam.jpg?width=600" },
  { name: "Mamba", brand: "Storck", query: "Mamba Kaubonbon", wikiTitle: "Mamba_(Kaubonbon)", nameMust: ["mamba"] },
  { name: "Nimm2", brand: "Storck", query: "Nimm 2 Bonbon", wikiTitle: "Nimm2", nameMust: ["nimm"] },
  { name: "Nimm2 Lachgummi", brand: "Storck", query: "Nimm 2 Lachgummi", wikiTitle: "Nimm2", nameMust: ["lachgummi"] },
  { name: "Nimm2 Soft", brand: "Storck", query: "Nimm 2 Soft", wikiTitle: "Nimm2", nameMust: ["nimm", "soft"] },
  { name: "Werther's Echte", brand: "Storck", query: "Werthers Original Echte", wikiTitle: "Werther's_Original", nameMust: ["werther"] },
  { name: "Em-eukal", brand: "Em-eukal", query: "Em-eukal", wikiTitle: "Em-eukal", nameMust: ["em-eukal", "em eukal", "eukal"] },
  { name: "Ricola", brand: "Ricola", query: "Ricola Kräuterbonbon", wikiTitle: "Ricola", nameMust: ["ricola"] },

  // Lakritz / Sauer
  { name: "Haribo Lakritz-Schnecken", brand: "Haribo", query: "Haribo Lakritz Schnecken", wikiTitle: "Haribo", nameMust: ["lakritz", "schnecke"] },
  { name: "Katjes Salzige Heringe", brand: "Katjes", query: "Katjes Salzige Heringe", wikiTitle: "Katjes", nameMust: ["salzig", "hering"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Katjes_Salzige_Heringe-6295.jpg?width=600" },
  { name: "Katjes Yoghurt-Gums", brand: "Katjes", query: "Katjes Yoghurt Gums", wikiTitle: "Katjes", nameMust: ["yoghurt", "joghurt"], imageOverride: "https://commons.wikimedia.org/wiki/Special:FilePath/Katjes_Joghurt-Gums_(0877).jpg?width=600" },

  // Klassiker
  { name: "Milky Way", brand: "Mars", query: "Milky Way", wikiTitle: "Milky_Way_(Schokoriegel)", nameMust: ["milky", "way"] },
  { name: "Smarties", brand: "Nestlé", query: "Smarties Nestle", wikiTitle: "Smarties", nameMust: ["smarties"] },
  { name: "M&Ms", brand: "Mars", query: "M&Ms Peanut", wikiTitle: "M&M's", nameMust: ["m&m"] },
  { name: "After Eight", brand: "Nestlé", query: "After Eight", wikiTitle: "After_Eight", nameMust: ["after", "eight"] },
  { name: "Mozartkugel", brand: "Reber", query: "Mozartkugel Reber", wikiTitle: "Mozartkugel", nameMust: ["mozart"] },
  { name: "Lindt Goldhase", brand: "Lindt", query: "Lindt Goldhase", wikiTitle: "Goldhase", nameMust: ["goldhase"] },
  { name: "Kinder Schoko-Bons", brand: "Ferrero", query: "Kinder Schoko-Bons", wikiTitle: "Kinder_Schoko-Bons", nameMust: ["schoko-bons", "schoko bons"] },
  { name: "Kinder Überraschungs-Ei", brand: "Ferrero", query: "Kinder Überraschung", wikiTitle: "Überraschungsei", nameMust: ["überraschung", "ueberraschung", "kinder"] },
  { name: "Lakritz-Konfekt", brand: "Haribo", query: "Haribo Lakritz Konfekt", wikiTitle: "Haribo", nameMust: ["lakritz", "konfekt"] },
  { name: "Ahoj-Brause Brausepulver", brand: "Ahoj-Brause", query: "Ahoj Brause Brausepulver", wikiTitle: "Ahoj-Brause", nameMust: ["ahoj", "brausepulver"] },
  { name: "Center Shock", brand: "Center Shock", query: "Center Shock", wikiTitle: "Center_Shock", nameMust: ["center", "shock"] },
  { name: "Ahoj-Brause", brand: "Ahoj-Brause", query: "Ahoj Brause", wikiTitle: "Ahoj-Brause", nameMust: ["ahoj"] },
  { name: "PEZ", brand: "PEZ", query: "PEZ Bonbon", wikiTitle: "PEZ", nameMust: ["pez"] },

  // Kekse
  { name: "Leibniz Butterkeks", brand: "Bahlsen", query: "Leibniz Butterkeks", wikiTitle: "Leibniz-Keks", nameMust: ["leibniz", "butterkeks"] },
  { name: "Prinzenrolle", brand: "DeBeukelaer", query: "Prinzenrolle", wikiTitle: "Prinzenrolle", nameMust: ["prinzenrolle", "prinzen rolle"] },
  { name: "Hobbits", brand: "Bahlsen", query: "Hobbits Bahlsen", wikiTitle: "Hobbits_(Keks)", nameMust: ["hobbit"] },
  { name: "Choco Crossies", brand: "Nestlé", query: "Choco Crossies", wikiTitle: "Choco_Crossies", nameMust: ["choco", "crossies"] },
];
