/**
 * Brands suggested before the closet holds one of them.
 *
 * Spelled the way each brand spells itself, since whatever is picked from
 * here becomes the stored string. Weighted to what this closet actually
 * holds — denim, workwear, basics, outerwear — rather than trying to be
 * every label there is; anything missing is typed once and is then
 * suggested from the closet forever after. Order does not matter:
 * suggestions are ranked by match.
 */
export const STARTER_BRANDS: readonly string[] = [
  // Denim
  "3sixteen",
  "A.P.C.",
  "Agolde",
  "Big John",
  "Diesel",
  "Edwin",
  "Evisu",
  "Flat Head",
  "Full Count",
  "Iron Heart",
  "Japan Blue Jeans",
  "Kapital",
  "Lee",
  "Levi's",
  "Momotaro",
  "Naked & Famous",
  "Nudie Jeans",
  "Pure Blue Japan",
  "Samurai Jeans",
  "Warehouse & Co.",
  "Wrangler",

  // Workwear and heritage
  "Buzz Rickson's",
  "Carhartt",
  "Carhartt WIP",
  "Dickies",
  "Engineered Garments",
  "Filson",
  "Pendleton",
  "Real McCoy's",
  "Red Wing",
  "Schott NYC",
  "Stan Ray",
  "Standard & Strange",
  "Universal Works",

  // Basics and high street
  "& Other Stories",
  "Abercrombie & Fitch",
  "American Eagle",
  "Arket",
  "Banana Republic",
  "COS",
  "Everlane",
  "Gap",
  "H&M",
  "Hanes",
  "J.Crew",
  "Mango",
  "Massimo Dutti",
  "Muji",
  "Old Navy",
  "Reigning Champ",
  "Uniqlo",
  "Zara",

  // Classic menswear
  "Brooks Brothers",
  "Barbour",
  "Burberry",
  "Hugo Boss",
  "Lacoste",
  "Polo Ralph Lauren",
  "Ralph Lauren",
  "Sunspel",
  "Todd Snyder",
  "Tommy Hilfiger",
  "Fred Perry",

  // Designer and contemporary
  "Acne Studios",
  "Ami Paris",
  "Auralee",
  "Bode",
  "Comme des Garçons",
  "Lemaire",
  "Our Legacy",
  "Margaret Howell",
  "Maison Kitsuné",
  "Norse Projects",
  "Visvim",
  "Wacko Maria",
  "Needles",
  "Nanamica",
  "Beams Plus",
  "Story mfg.",
  "YMC",

  // Streetwear
  "Ader Error",
  "Aimé Leon Dore",
  "Bape",
  "Fear of God",
  "Essentials",
  "Kith",
  "Noah",
  "Palace",
  "Stüssy",
  "Supreme",
  "Yeezy",

  // Outdoor and technical
  "Arc'teryx",
  "Canada Goose",
  "Columbia",
  "Fjällräven",
  "Helly Hansen",
  "L.L.Bean",
  "Mammut",
  "Marmot",
  "Montbell",
  "Patagonia",
  "Snow Peak",
  "The North Face",

  // Sport
  "Adidas",
  "Asics",
  "Champion",
  "New Balance",
  "Nike",
  "Puma",
  "Salomon",
  "Vans",
  "Converse",

  // Footwear and hats
  "Birkenstock",
  "Blundstone",
  "Clarks",
  "Dr. Martens",
  "Paraboot",
  "Timberland",
  "New Era",
];
