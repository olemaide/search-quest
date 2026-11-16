// Built-in building blocks, templates, city lists and settings.
// Default items have stable ids ("d-…" / "t-…") so "Restore defaults" can merge them back.

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function blocks(cat, slot, values) {
  return values.map((v) => {
    const [value, label] = Array.isArray(v) ? v : [v, v];
    return { id: 'd-' + slug(cat + '-' + value), cat, slot, value, label };
  });
}

const years = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => 'Copyright ' + (a + i));

export const DEFAULT_BLOCKS = [
  ...blocks('Niche · US', 'profession', [
    'funeral home', 'mortuary', 'funeral director', 'roofing contractor', 'roofer', 'roofing company',
    'plumber', 'plumbing', 'heating and cooling', 'HVAC', 'air conditioning repair', 'family dentistry',
    'dental office', 'DDS', 'chiropractic', 'chiropractor', 'attorney at law', 'law office', 'law firm',
    'CPA', 'tax preparation', 'accounting firm', 'auto repair', 'auto body', 'collision repair',
    'animal hospital', 'veterinary clinic', 'landscaping', 'lawn care', 'landscape company',
    'electrician', 'painting contractor', 'pest control', 'insurance agency', 'florist',
  ]),
  ...blocks('Beruf · DE', 'profession', [
    'Dachdecker', 'Elektriker', 'Malerbetrieb', 'Heizung Sanitär', 'Bestatter', 'Bestattungen', 'Schreinerei',
    'Tischlerei', 'Zahnarzt', 'Steuerberater', 'Rechtsanwalt', 'Friseur', 'Kfz-Werkstatt',
    'Garten- und Landschaftsbau', 'Physiotherapie', 'Metzgerei', 'Bäckerei', 'Fahrschule',
  ]),
  ...blocks('Location · US examples', 'location', [
    'Dayton, OH', 'Tulsa, OK', 'Wichita, KS', 'Fort Wayne, IN', 'Springfield, MO', 'Toledo, OH',
    'Akron, OH', 'Omaha, NE', 'Peoria, IL', 'Knoxville, TN', 'Ohio', 'Montgomery County',
  ]),
  ...blocks('Ort · DE Beispiele', 'location', [
    'Bielefeld', 'Münster', 'Paderborn', 'Osnabrück', 'Ostwestfalen', 'Kreis Gütersloh', '33602', '33604', '33605',
  ]),
  ...blocks('Copyright years', 'signals', years(2006, 2019)),
  ...blocks('Old builders · US', 'signals', [
    'Powered by Homestead', 'Created with Homestead', 'Powered by Weebly',
    'designed with the Wix.com website builder', 'Yahoo! Small Business', 'Yahoo! Web Hosting',
    'Microsoft FrontPage', 'Powered by Vistaprint', 'Powered by GoDaddy', 'Proudly powered by WordPress',
  ]),
  ...blocks('Baukasten · DE', 'signals', [
    'Erstellt mit Jimdo', 'powered by Joomla', 'Website erstellt mit WebsiteBaker', 'MyWebsite',
    '1&1 Homepage', 'STRATO Homepage-Baukasten', 'Erstellt mit Zeta Producer', 'NetObjects Fusion', 'webnode',
  ]),
  ...blocks('Old-site traces · US', 'signals', [
    'best viewed in Internet Explorer', 'best viewed at 800x600', 'you are visitor number',
    'sign our guestbook', 'under construction', 'get Adobe Flash Player', 'last updated',
  ]),
  ...blocks('Alte Website · DE', 'signals', [
    'Sie sind Besucher Nr', 'Besucherzähler', 'Gästebuch', 'optimiert für Internet Explorer',
    'Bildschirmauflösung 1024x768', 'letzte Aktualisierung', 'Adobe Flash Player',
  ]),
  ...blocks('Free subdomains', 'site', [
    ['weebly.com', 'site:weebly.com'], ['wixsite.com', 'site:wixsite.com'],
    ['godaddysites.com', 'site:godaddysites.com'], ['jimdofree.com', 'site:jimdofree.com'],
    ['jimdosite.com', 'site:jimdosite.com'], ['.de', 'site:.de'],
  ]),
  ...blocks('Operators', 'extra', [
    ['inurl:"index.php?option=com_content"', 'old Joomla URL'],
    ['inurl:http:// -inurl:https', 'no HTTPS (rough)'],
  ]),
  ...blocks('Exclude · common', 'excludes', [
    'yelp.com', 'facebook.com', 'yellowpages.com', 'bbb.org', 'linkedin.com', 'instagram.com', 'manta.com', 'mapquest.com',
  ]),
  ...blocks('Exclude · home services', 'excludes', ['angi.com', 'homeadvisor.com', 'thumbtack.com', 'houzz.com', 'porch.com']),
  ...blocks('Exclude · health', 'excludes', ['healthgrades.com', 'zocdoc.com', 'vitals.com', 'webmd.com', 'vetratingz.com']),
  ...blocks('Exclude · legal', 'excludes', ['avvo.com', 'justia.com', 'findlaw.com', 'martindale.com', 'lawyers.com']),
  ...blocks('Exclude · auto', 'excludes', ['repairpal.com', 'carfax.com']),
  ...blocks('Exclude · funeral', 'excludes', ['legacy.com', 'findagrave.com', 'dignitymemorial.com', 'echovita.com', 'tributearchive.com']),
  ...blocks('Exclude · DE', 'excludes', [
    'gelbeseiten.de', '11880.com', 'dasoertliche.de', 'facebook.com', 'werkenntdenbesten.de',
    'my-hammer.de', 'yelp.de', 'branchenbuch.de', 'cylex.de', 'golocal.de',
  ]),
];

const DE_EX = ['gelbeseiten.de', '11880.com', 'dasoertliche.de', 'facebook.com'];
const US_EX = ['yelp.com', 'facebook.com', 'yellowpages.com', 'bbb.org'];
const OLD_US = ['Copyright 2012', 'Copyright 2014', 'Copyright 2016', 'Powered by Homestead', 'Powered by Weebly', 'Yahoo! Small Business', 'you are visitor number'];

const tpl = (id, name, region, description, state) => ({
  id: 't-' + id, name, region, description, builtin: true,
  state: { profession: [], intitle: false, location: [], signals: [], required: [], site: '', excludes: [], extra: '', ...state },
});

const niche = (id, name, profession, city, excludes) =>
  tpl('us-' + id, name + ' · old sites', 'US', `Old-site signals for ${name.toLowerCase()} in a mid-sized city. Swap the city, or save as a quest and add a city list.`,
    { profession, location: [city], signals: OLD_US, excludes });

export const DEFAULT_TEMPLATES = [
  tpl('de-basic', 'Dachdecker · Copyright-Jahr', 'DE', 'Basic template: profession + town + an old copyright year, directories excluded.',
    { profession: ['Dachdecker'], location: ['Bielefeld'], signals: ['Copyright 2015'], excludes: DE_EX }),
  tpl('de-years', 'Elektriker · mehrere Jahre', 'DE', 'Several copyright years at once via OR.',
    { profession: ['Elektriker'], location: ['Münster'], signals: ['Copyright 2012', 'Copyright 2014', 'Copyright 2016', 'Copyright 2018'] }),
  tpl('de-jimdo', 'Heizung Sanitär · Jimdo', 'DE', 'Old Jimdo sites.',
    { profession: ['Heizung Sanitär'], location: ['Paderborn'], signals: ['Erstellt mit Jimdo'] }),
  tpl('de-traces', 'Malerbetrieb · alte Spuren', 'DE', 'Visitor counters and guestbooks.',
    { profession: ['Malerbetrieb'], location: ['Osnabrück'], signals: ['Sie sind Besucher Nr', 'Gästebuch', 'Besucherzähler'] }),
  tpl('de-full', 'Dachdecker · volle Kombination', 'DE', 'intitle + ZIP codes + mixed signals + exclusions.',
    { profession: ['Dachdecker'], intitle: true, location: ['33602', '33604', '33605'], signals: ['Copyright 2013', 'Copyright 2015', 'Erstellt mit Jimdo', 'Besucher Nr'], excludes: DE_EX }),
  tpl('us-funeral-years', 'Funeral homes · old copyright', 'US', 'Funeral home / mortuary / funeral director with an old copyright year. Excludes obituary sites and the Dignity Memorial chain.',
    { profession: ['funeral home', 'mortuary', 'funeral director'], location: ['Dayton, OH'], signals: ['Copyright 2012', 'Copyright 2014', 'Copyright 2016'], excludes: ['legacy.com', 'yelp.com', 'yellowpages.com', 'facebook.com', 'findagrave.com', 'dignitymemorial.com'] }),
  tpl('us-funeral-builders', 'Funeral homes · old builders', 'US', 'Homestead, Weebly, Yahoo and FrontPage credits, statewide.',
    { profession: ['funeral home'], intitle: true, location: ['Ohio'], signals: ['Powered by Homestead', 'Powered by Weebly', 'Yahoo! Small Business', 'Microsoft FrontPage'] }),
  tpl('us-funeral-traces', 'Funeral homes · very old signs', 'US', 'Visitor counters, guestbooks, "best viewed in".',
    { profession: ['funeral home'], location: ['Tulsa'], signals: ['you are visitor number', 'sign our guestbook', 'best viewed in'] }),
  niche('roofers', 'Roofers', ['roofing contractor', 'roofer', 'roofing company'], 'Dayton, OH', ['yelp.com', 'facebook.com', 'angi.com', 'homeadvisor.com']),
  niche('plumbers', 'Plumbers', ['plumber', 'plumbing'], 'Tulsa, OK', ['yelp.com', 'facebook.com', 'angi.com', 'thumbtack.com']),
  niche('hvac', 'HVAC', ['heating and cooling', 'HVAC', 'air conditioning repair'], 'Wichita, KS', ['yelp.com', 'facebook.com', 'homeadvisor.com']),
  niche('dentists', 'Dentists', ['family dentistry', 'dental office', 'DDS'], 'Fort Wayne, IN', ['yelp.com', 'healthgrades.com', 'zocdoc.com', 'facebook.com']),
  niche('chiro', 'Chiropractors', ['chiropractic', 'chiropractor'], 'Springfield, MO', ['yelp.com', 'healthgrades.com', 'facebook.com']),
  niche('law', 'Law firms', ['attorney at law', 'law office', 'law firm'], 'Toledo, OH', ['avvo.com', 'justia.com', 'findlaw.com', 'martindale.com', 'yelp.com']),
  niche('cpa', 'Accountants', ['CPA', 'tax preparation', 'accounting firm'], 'Akron, OH', ['yelp.com', 'facebook.com', 'bbb.org']),
  niche('auto', 'Auto repair', ['auto repair', 'auto body', 'collision repair'], 'Omaha, NE', ['yelp.com', 'facebook.com', 'repairpal.com', 'carfax.com']),
  niche('vets', 'Veterinarians', ['animal hospital', 'veterinary clinic'], 'Peoria, IL', ['yelp.com', 'facebook.com', 'vetratingz.com']),
  niche('landscapers', 'Landscapers', ['landscaping', 'lawn care', 'landscape company'], 'Knoxville, TN', ['yelp.com', 'facebook.com', 'angi.com', 'houzz.com']),
  tpl('any-weebly', 'Free subdomain · Weebly', 'Any', 'Businesses that never bought their own domain.',
    { profession: ['plumbing'], location: ['Ohio'], site: 'weebly.com' }),
  tpl('any-wix', 'Free subdomain · Wix', 'Any', 'Free wixsite.com sites.',
    { profession: ['roofing'], location: ['Texas'], site: 'wixsite.com' }),
  tpl('any-godaddy', 'Free subdomain · GoDaddy', 'Any', 'Free godaddysites.com sites.',
    { profession: ['dental'], location: ['Florida'], site: 'godaddysites.com' }),
  tpl('any-nohttps', 'No HTTPS (rough)', 'Any', 'Very mixed results, use only as a supplement.',
    { profession: ['roofing'], location: ['Ohio'], extra: 'inurl:http:// -inurl:https' }),
];

export const CITY_LISTS = {
  'US · mid-sized Midwest & South': [
    'Dayton, OH', 'Tulsa, OK', 'Wichita, KS', 'Fort Wayne, IN', 'Springfield, MO', 'Toledo, OH', 'Akron, OH',
    'Omaha, NE', 'Peoria, IL', 'Knoxville, TN', 'Lexington, KY', 'Little Rock, AR', 'Des Moines, IA',
    'Evansville, IN', 'Chattanooga, TN', 'Montgomery, AL', 'Shreveport, LA', 'Jackson, MS', 'Topeka, KS',
    'Rockford, IL', 'Cedar Rapids, IA', 'Lincoln, NE', 'Springfield, IL', 'Lansing, MI', 'Grand Rapids, MI',
    'Columbia, MO', 'Huntsville, AL', 'Mobile, AL', 'Lafayette, LA', 'Amarillo, TX', 'Lubbock, TX', 'Waco, TX',
  ],
  'US · Ohio': ['Dayton, OH', 'Toledo, OH', 'Akron, OH', 'Canton, OH', 'Youngstown, OH', 'Springfield, OH', 'Lima, OH', 'Mansfield, OH', 'Zanesville, OH', 'Findlay, OH'],
  'DE · Ostwestfalen-Lippe': ['Bielefeld', 'Paderborn', 'Gütersloh', 'Herford', 'Minden', 'Detmold', 'Lemgo', 'Bad Oeynhausen', 'Höxter', 'Bünde', 'Lübbecke', 'Rheda-Wiedenbrück', 'Bad Salzuflen'],
  'DE · Münsterland & Osnabrück': ['Münster', 'Osnabrück', 'Rheine', 'Coesfeld', 'Warendorf', 'Steinfurt', 'Ibbenbüren', 'Borken', 'Bocholt', 'Ahlen'],
};

export const DEFAULT_SETTINGS = {
  googleDomain: 'google.com',
  hl: '',
  gl: '',
  openIn: 'tab',
  minGapSec: 20,
  dedupeByDomain: true,
  autoScan: true,
  scanMaxPages: 4,
  scanConcurrency: 3,
};

export const GOOGLE_DOMAINS = [
  'google.com', 'google.de', 'google.at', 'google.ch', 'google.co.uk', 'google.ca', 'google.com.au',
  'google.ie', 'google.co.nz', 'google.fr', 'google.es', 'google.it', 'google.nl', 'google.be', 'google.pl',
];

export const STATUSES = [
  ['new', 'New'], ['qualified', 'Qualified'], ['contacted', 'Contacted'],
  ['replied', 'Replied'], ['won', 'Won'], ['rejected', 'Rejected'],
];
