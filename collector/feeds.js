// Fuentes RSS por pilar. Para añadir una, copia una línea y cambia url/source/pillar.
// Pilares: global, ultima, economia, geopolitica, tecnologia, emprendimiento, deporte
export const FEEDS = [
  // 🌍 Problemas globales (clima, crisis, humanitario)
  { pillar: "global", source: "ONU Noticias", url: "https://news.un.org/feed/subscribe/es/news/all/rss.xml" },
  { pillar: "global", source: "Carbon Brief", url: "https://www.carbonbrief.org/feed/" },
  { pillar: "global", source: "The Guardian Clima", url: "https://www.theguardian.com/environment/climate-crisis/rss" },
  { pillar: "global", source: "BBC Ciencia y Medio Ambiente", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { pillar: "global", source: "El País Clima", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/clima-y-medio-ambiente/portada" },
  { pillar: "global", source: "Inside Climate News", url: "https://insideclimatenews.org/feed/" },

  // ⚡ Última hora / mundo
  { pillar: "ultima", source: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
  { pillar: "ultima", source: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { pillar: "ultima", source: "El País", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
  { pillar: "ultima", source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { pillar: "ultima", source: "Europa Press", url: "https://www.europapress.es/rss/rss.aspx" },
  { pillar: "ultima", source: "France 24 ES", url: "https://www.france24.com/es/rss" },

  // 💶 Economía
  { pillar: "economia", source: "Cinco Días", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada" },
  { pillar: "economia", source: "El País Economía", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada" },
  { pillar: "economia", source: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { pillar: "economia", source: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { pillar: "economia", source: "Europa Press Economía", url: "https://www.europapress.es/rss/rss.aspx?ch=00136" },

  // 🌐 Geopolítica
  { pillar: "geopolitica", source: "El País Internacional", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada" },
  { pillar: "geopolitica", source: "Foreign Policy", url: "https://foreignpolicy.com/feed/" },
  { pillar: "geopolitica", source: "The Guardian World", url: "https://www.theguardian.com/world/rss" },
  { pillar: "geopolitica", source: "DW Español", url: "https://rss.dw.com/rdf/rss-sp-all" },

  // 💻 Tecnología
  { pillar: "tecnologia", source: "Xataka", url: "https://www.xataka.com/feedburner.xml" },
  { pillar: "tecnologia", source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { pillar: "tecnologia", source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { pillar: "tecnologia", source: "MIT Technology Review", url: "https://www.technologyreview.com/feed/" },

  // 🚀 Emprendimiento
  { pillar: "emprendimiento", source: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { pillar: "emprendimiento", source: "El Referente", url: "https://www.elreferente.es/feed" },
  { pillar: "emprendimiento", source: "Sifted", url: "https://sifted.eu/feed" },
  { pillar: "emprendimiento", source: "El Español Invertia", url: "https://www.elespanol.com/rss/invertia/" },
  { pillar: "emprendimiento", source: "Crunchbase News", url: "https://news.crunchbase.com/feed/" },
  { pillar: "emprendimiento", source: "Hacker News", url: "https://hnrss.org/frontpage?points=200" },

  // ⚽ Deporte
  { pillar: "deporte", source: "El País Deportes", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada" },
  { pillar: "deporte", source: "Mundo Deportivo", url: "https://www.mundodeportivo.com/rss/home.xml" },
  { pillar: "deporte", source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
];
