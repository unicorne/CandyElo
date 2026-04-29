// Hand-curated seed list. `query` is what we send to Open Food Facts;
// `brand` filters results so we don't pick up the wrong product.
// `barcode` is an optional fallback when a search keyword is too generic
// (or, in our case, when the OFF search API is rate-limited / down).

export type SeedCandy = {
  name: string;
  brand: string;
  query: string;
  barcode?: string;
};

export const CANDY_LIST: SeedCandy[] = [
  // Schoko-Riegel / Tafeln
  { name: "Kinder Schokolade", brand: "Ferrero", query: "Kinder Schokolade", barcode: "8000500037560" },
  { name: "Kinder Bueno", brand: "Ferrero", query: "Kinder Bueno", barcode: "8000500137505" },
  { name: "Kinder Country", brand: "Ferrero", query: "Kinder Country", barcode: "4008400310145" },
  { name: "Kinder Pingui", brand: "Ferrero", query: "Kinder Pingui" },
  { name: "Duplo", brand: "Ferrero", query: "Duplo Ferrero", barcode: "4008400301129" },
  { name: "Hanuta", brand: "Ferrero", query: "Hanuta" },
  { name: "Knoppers", brand: "Storck", query: "Knoppers", barcode: "4014400900330" },
  { name: "Knoppers NussRiegel", brand: "Storck", query: "Knoppers NussRiegel" },
  { name: "Milka Alpenmilch", brand: "Milka", query: "Milka Alpenmilch", barcode: "7622210449283" },
  { name: "Ritter Sport Voll-Nuss", brand: "Ritter Sport", query: "Ritter Sport Voll-Nuss" },
  { name: "Ritter Sport Knusperflakes", brand: "Ritter Sport", query: "Ritter Sport Knusperflakes", barcode: "4000417025111" },
  { name: "Snickers", brand: "Mars", query: "Snickers", barcode: "5000159461122" },
  { name: "Mars", brand: "Mars", query: "Mars Riegel", barcode: "5000159407236" },
  { name: "Bounty", brand: "Mars", query: "Bounty Riegel" },
  { name: "Twix", brand: "Mars", query: "Twix", barcode: "5000159486187" },
  { name: "Lion", brand: "Nestlé", query: "Lion Riegel", barcode: "7613036033800" },
  { name: "KitKat", brand: "Nestlé", query: "KitKat", barcode: "7613034626844" },
  { name: "Yogurette", brand: "Ferrero", query: "Yogurette", barcode: "4008400290492" },
  { name: "Pickup Choco", brand: "Bahlsen", query: "Pick Up Choco Bahlsen", barcode: "4017100007187" },

  // Pralinen / Kugeln
  { name: "Ferrero Küsschen", brand: "Ferrero", query: "Ferrero Küsschen" },
  { name: "Raffaello", brand: "Ferrero", query: "Raffaello" },
  { name: "Mon Chéri", brand: "Ferrero", query: "Mon Chéri", barcode: "4008400362212" },
  { name: "Toffifee", brand: "Storck", query: "Toffifee", barcode: "4014400121957" },
  { name: "Merci", brand: "Storck", query: "Merci Schokolade" },
  { name: "Lindt Lindor", brand: "Lindt", query: "Lindt Lindor", barcode: "8003340062518" },

  // Fruchtgummi / Bonbons
  { name: "Haribo Goldbären", brand: "Haribo", query: "Haribo Goldbären" },
  { name: "Haribo Color-Rado", brand: "Haribo", query: "Haribo Color-Rado" },
  { name: "Haribo Pico-Balla", brand: "Haribo", query: "Haribo Pico-Balla" },
  { name: "Haribo Tropi-Frutti", brand: "Haribo", query: "Haribo Tropi-Frutti", barcode: "4001686326107" },
  { name: "Maoam", brand: "Haribo", query: "Maoam", barcode: "4001686310101" },
  { name: "Mamba", brand: "Storck", query: "Mamba Kaubonbon" },
  { name: "Nimm2", brand: "Storck", query: "Nimm 2 Bonbon", barcode: "4014400900224" },
  { name: "Nimm2 Lachgummi", brand: "Storck", query: "Nimm 2 Lachgummi", barcode: "4014400900859" },
  { name: "Nimm2 Soft", brand: "Storck", query: "Nimm 2 Soft" },
  { name: "Werther's Echte", brand: "Storck", query: "Werthers Original Echte", barcode: "4014400900057" },
  { name: "Em-eukal", brand: "Em-eukal", query: "Em-eukal" },
  { name: "Ricola", brand: "Ricola", query: "Ricola Kräuterbonbon", barcode: "7610700860816" },

  // Lakritz / Sauer
  { name: "Haribo Lakritz-Schnecken", brand: "Haribo", query: "Haribo Lakritz Schnecken", barcode: "4001686300077" },
  { name: "Katjes Salzige Heringe", brand: "Katjes", query: "Katjes Salzige Heringe" },
  { name: "Katjes Yoghurt-Gums", brand: "Katjes", query: "Katjes Yoghurt Gums" },

  // Klassiker
  { name: "Milky Way", brand: "Mars", query: "Milky Way", barcode: "5000159403030" },
  { name: "Smarties", brand: "Nestlé", query: "Smarties Nestle" },
  { name: "M&Ms", brand: "Mars", query: "M&Ms Peanut", barcode: "5000159419680" },
  { name: "After Eight", brand: "Nestlé", query: "After Eight" },
  { name: "Mozartkugel", brand: "Reber", query: "Mozartkugel Reber" },
  { name: "Lindt Goldhase", brand: "Lindt", query: "Lindt Goldhase", barcode: "7610400077736" },
  { name: "Kinder Schoko-Bons", brand: "Ferrero", query: "Kinder Schoko-Bons" },
  { name: "Kinder Überraschungs-Ei", brand: "Ferrero", query: "Kinder Überraschung", barcode: "8000500179529" },
  { name: "Lakritz-Konfekt", brand: "Haribo", query: "Haribo Lakritz Konfekt", barcode: "4001686325117" },
  { name: "Ahoj-Brause Brausepulver", brand: "Ahoj-Brause", query: "Ahoj Brause Brausepulver" },
  { name: "Center Shock", brand: "Center Shock", query: "Center Shock", barcode: "4017101000059" },
  { name: "Ahoj-Brause", brand: "Ahoj-Brause", query: "Ahoj Brause" },
  { name: "PEZ", brand: "PEZ", query: "PEZ Bonbon", barcode: "4011600102014" },

  // Kekse
  { name: "Leibniz Butterkeks", brand: "Bahlsen", query: "Leibniz Butterkeks", barcode: "4017100100741" },
  { name: "Prinzenrolle", brand: "DeBeukelaer", query: "Prinzenrolle" },
  { name: "Hobbits", brand: "Bahlsen", query: "Hobbits Bahlsen", barcode: "4017100118041" },
  { name: "Choco Crossies", brand: "Nestlé", query: "Choco Crossies", barcode: "4005500250017" },
];
