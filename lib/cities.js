// Small and mid-sized US cities (≈25k–250k inhabitants) for location targeting.
// Population in thousands, 2020 US Census, rounded. Cities ≥100k are checked against the
// census table on Wikipedia's "List of United States cities by population"; smaller ones are
// approximate. Suburbs of large metros are left out on purpose: their businesses compete
// with the whole metro area, so they rarely have the "old local website" profile.

const DATA = {
  // ---------------- Midwest
  OH: [['Akron', 190], ['Dayton', 138], ['Canton', 71], ['Lorain', 65], ['Hamilton', 63], ['Youngstown', 60], ['Springfield', 59], ['Elyria', 53], ['Middletown', 51], ['Mansfield', 48], ['Findlay', 40], ['Marion', 36], ['Lima', 36], ['Sandusky', 25]],
  MI: [['Lansing', 113], ['Flint', 81], ['Kalamazoo', 74], ['Battle Creek', 53], ['Saginaw', 44], ['Midland', 43], ['Muskegon', 38], ['Bay City', 33], ['Jackson', 31]],
  IN: [['Evansville', 117], ['South Bend', 103], ['Bloomington', 79], ['Lafayette', 71], ['Gary', 69], ['Muncie', 65], ['Kokomo', 60], ['Terre Haute', 58], ['Anderson', 55], ['Elkhart', 54], ['Columbus', 50]],
  IL: [['Rockford', 149], ['Springfield', 114], ['Peoria', 113], ['Champaign', 88], ['Bloomington', 79], ['Decatur', 71], ['Moline', 43], ['Quincy', 39], ['Danville', 29]],
  WI: [['Green Bay', 107], ['Kenosha', 100], ['Racine', 78], ['Appleton', 76], ['Eau Claire', 69], ['Oshkosh', 67], ['Janesville', 66], ['La Crosse', 53], ['Sheboygan', 50], ['Wausau', 40]],
  IA: [['Cedar Rapids', 138], ['Davenport', 102], ['Sioux City', 86], ['Iowa City', 75], ['Waterloo', 67], ['Ames', 66], ['Dubuque', 60]],
  MN: [['Rochester', 121], ['Duluth', 87], ['St. Cloud', 69], ['Mankato', 44]],
  MO: [['Springfield', 169], ['Columbia', 126], ['St. Joseph', 72], ['Joplin', 52], ['Jefferson City', 43], ['Cape Girardeau', 40]],
  KS: [['Topeka', 127], ['Lawrence', 95], ['Manhattan', 54], ['Salina', 47], ['Hutchinson', 40]],
  NE: [['Grand Island', 53], ['Kearney', 34]],
  SD: [['Sioux Falls', 193], ['Rapid City', 75]],
  ND: [['Fargo', 126], ['Bismarck', 74]],
  // ---------------- South
  AL: [['Huntsville', 215], ['Montgomery', 201], ['Mobile', 187], ['Tuscaloosa', 100], ['Auburn', 76], ['Dothan', 71], ['Decatur', 58], ['Florence', 40], ['Gadsden', 34]],
  MS: [['Jackson', 154], ['Gulfport', 73], ['Biloxi', 49], ['Hattiesburg', 49], ['Tupelo', 38], ['Meridian', 35]],
  LA: [['Shreveport', 188], ['Lafayette', 121], ['Lake Charles', 85], ['Monroe', 48], ['Alexandria', 45], ['Houma', 33]],
  AR: [['Little Rock', 203], ['Fayetteville', 94], ['Fort Smith', 89], ['Jonesboro', 79], ['Pine Bluff', 41]],
  TN: [['Knoxville', 191], ['Chattanooga', 181], ['Clarksville', 167], ['Murfreesboro', 153], ['Johnson City', 71], ['Jackson', 68], ['Kingsport', 55], ['Cleveland', 47]],
  KY: [['Bowling Green', 72], ['Owensboro', 60], ['Elizabethtown', 31], ['Paducah', 27]],
  GA: [['Columbus', 207], ['Augusta', 202], ['Macon', 157], ['Savannah', 148], ['Athens', 127], ['Warner Robins', 80], ['Albany', 70], ['Valdosta', 55], ['Rome', 38]],
  SC: [['Charleston', 150], ['Columbia', 137], ['Rock Hill', 74], ['Greenville', 71], ['Sumter', 43], ['Florence', 40], ['Spartanburg', 39]],
  NC: [['Fayetteville', 209], ['Wilmington', 115], ['High Point', 114], ['Asheville', 95], ['Greenville', 88], ['Jacksonville', 73], ['Rocky Mount', 54], ['Hickory', 43]],
  VA: [['Roanoke', 100], ['Lynchburg', 79], ['Charlottesville', 47], ['Danville', 43]],
  WV: [['Charleston', 49], ['Huntington', 47], ['Morgantown', 30], ['Parkersburg', 30], ['Wheeling', 27]],
  TX: [['Waco', 138], ['Midland', 133], ['Abilene', 125], ['Beaumont', 115], ['Odessa', 114], ['Tyler', 106], ['Wichita Falls', 102], ['San Angelo', 100], ['Bryan', 84], ['Temple', 82], ['Longview', 82], ['Victoria', 66], ['Sherman', 44], ['Texarkana', 36]],
  OK: [['Norman', 128], ['Lawton', 90], ['Enid', 51], ['Stillwater', 48], ['Muskogee', 37]],
  FL: [['Gainesville', 141], ['Lakeland', 113], ['Fort Myers', 86], ['Daytona Beach', 73], ['Ocala', 64], ['Sarasota', 55], ['Pensacola', 54], ['Panama City', 33]],
  // ---------------- Northeast
  PA: [['Allentown', 126], ['Reading', 95], ['Erie', 95], ['Scranton', 76], ['Lancaster', 58], ['Harrisburg', 50], ['York', 45], ['Wilkes-Barre', 44], ['Altoona', 44], ['State College', 41], ['Williamsport', 28]],
  NY: [['Syracuse', 149], ['Schenectady', 67], ['Utica', 65], ['Binghamton', 48], ['Elmira', 27]],
  NH: [['Manchester', 116]],
  ME: [['Portland', 68], ['Bangor', 32]],
  VT: [['Burlington', 45]],
  // ---------------- West
  ID: [['Boise', 236], ['Idaho Falls', 65], ['Pocatello', 56]],
  WA: [['Spokane', 229], ['Yakima', 97], ['Kennewick', 84]],
  OR: [['Eugene', 177], ['Salem', 176], ['Medford', 86]],
  MT: [['Billings', 117], ['Missoula', 73], ['Great Falls', 60]],
  CO: [['Pueblo', 112], ['Grand Junction', 66]],
  NM: [['Las Cruces', 111]],
  AZ: [['Yuma', 96], ['Flagstaff', 77]],
  UT: [['St. George', 95], ['Ogden', 87]],
  CA: [['Redding', 94]],
  WY: [['Cheyenne', 65], ['Casper', 59]],
};

export const REGIONS = {
  Midwest: ['OH', 'MI', 'IN', 'IL', 'WI', 'IA', 'MN', 'MO', 'KS', 'NE', 'SD', 'ND'],
  South: ['AL', 'MS', 'LA', 'AR', 'TN', 'KY', 'GA', 'SC', 'NC', 'VA', 'WV', 'TX', 'OK', 'FL'],
  Northeast: ['PA', 'NY', 'NH', 'ME', 'VT'],
  West: ['ID', 'WA', 'OR', 'MT', 'CO', 'NM', 'AZ', 'UT', 'CA', 'WY'],
};

/**
 * Suggested starting points: independent regional hubs of roughly 60k–250k people in the
 * Midwest and South. These have many long-established local businesses and less local-SEO
 * competition than big metros. This is a heuristic, so test a few searches before you commit.
 */
export const TOP_PICKS = [
  'Dayton, OH', 'Akron, OH', 'Canton, OH', 'Youngstown, OH', 'Peoria, IL', 'Springfield, IL', 'Rockford, IL',
  'Evansville, IN', 'South Bend, IN', 'Springfield, MO', 'Topeka, KS', 'Cedar Rapids, IA', 'Davenport, IA',
  'Green Bay, WI', 'Knoxville, TN', 'Chattanooga, TN', 'Shreveport, LA', 'Montgomery, AL', 'Jackson, MS', 'Waco, TX',
];

const regionOf = Object.fromEntries(Object.entries(REGIONS).flatMap(([r, sts]) => sts.map((s) => [s, r])));
const top = new Set(TOP_PICKS);

/** [{ label: "Dayton, OH", name, st, k (population in thousands), region, top }] sorted by state then size. */
export const US_CITIES = Object.entries(DATA).flatMap(([st, list]) =>
  list.map(([name, k]) => {
    const label = `${name}, ${st}`;
    return { label, name, st, k, region: regionOf[st], top: top.has(label) };
  }));

export const SIZE_BANDS = [
  ['25-50', '25k–50k', 25, 50],
  ['50-100', '50k–100k', 50, 100],
  ['100-250', '100k–250k', 100, 250],
];
