// One source of truth for who The Graphikk is, used for structured data on
// every page (scripts/build-blog.mjs and scripts/site-seo.mjs). Search engines
// and AI assistants match the business across the web by these details, so
// keep them identical to the Google Business Profile and other listings.
export const SITE = 'https://thegraphikk.com';
export const AUTHOR = 'Kavin Arulraj';

// Official profiles. Add Instagram, Facebook, YouTube, Behance, the Google
// Business Profile share link, Clutch etc. here as they are confirmed.
export const MAPS_URL = 'https://maps.google.com/?cid=16866634370633899827'; // Google Business Profile
export const SAME_AS = [
  MAPS_URL,
  'https://in.linkedin.com/company/the-graphikk',
];

export const FOUNDER = {
  '@type': 'Person', '@id': `${SITE}/#founder`, name: AUTHOR,
  jobTitle: 'Founder, designer and developer', url: `${SITE}/about`,
  worksFor: { '@id': `${SITE}/#business` },
  knowsAbout: ['Web design', 'Web development', 'Shopify', 'Technical SEO', 'Local SEO'],
};

export const ORG = {
  '@type': 'ProfessionalService', '@id': `${SITE}/#business`, name: 'The Graphikk', url: SITE + '/',
  logo: `${SITE}/assets/img/logo.png`, image: `${SITE}/assets/img/og-site.jpg`,
  description: 'Web design and development company in Chennai building fast, SEO-ready websites and online stores for businesses across India.',
  slogan: 'Websites that look sharp and actually sell',
  // No public phone number: customers contact the studio by WhatsApp chat or email.
  email: 'thegraphikk@gmail.com', priceRange: '₹20,000+',
  address: { '@type': 'PostalAddress', addressLocality: 'Chennai', addressRegion: 'Tamil Nadu', addressCountry: 'IN' },
  areaServed: [{ '@type': 'City', name: 'Chennai' }, { '@type': 'State', name: 'Tamil Nadu' }, { '@type': 'Country', name: 'India' }],
  founder: { '@id': `${SITE}/#founder` },
  sameAs: SAME_AS,
  hasMap: MAPS_URL,
  knowsLanguage: ['en', 'ta'],
  currenciesAccepted: 'INR',
  contactPoint: {
    '@type': 'ContactPoint', contactType: 'sales', email: 'thegraphikk@gmail.com',
    url: `${SITE}/contact`,
    areaServed: 'IN', availableLanguage: ['English', 'Tamil'],
  },
  knowsAbout: ['Web design', 'Web development', 'E-commerce websites', 'Shopify', 'WooCommerce', 'Search engine optimisation', 'Local SEO', 'Google Business Profile', 'Core Web Vitals'],
  hasOfferCatalog: {
    '@type': 'OfferCatalog', name: 'Website design and development packages',
    itemListElement: [
      ['Business website', 40000], ['E-commerce website', 50000], ['Landing page', 20000],
      ['Portfolio website', 20000], ['SEO', 35000, 'per month'], ['Google and Meta ads management', 30000, 'per month'],
    ].map(([name, minPrice, unitText]) => ({
      '@type': 'Offer', itemOffered: { '@type': 'Service', name },
      priceSpecification: { '@type': 'PriceSpecification', minPrice, priceCurrency: 'INR', ...(unitText ? { unitText } : {}) },
    })),
  },
};

export const WEBSITE = {
  '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'The Graphikk', url: SITE + '/',
  publisher: { '@id': `${SITE}/#business` }, inLanguage: 'en-IN',
};
