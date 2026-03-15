import fs from 'fs';

const extractUIPatterns = (htmlFile) => {
  const html = fs.readFileSync(htmlFile, 'utf8');
  
  const patterns = {
    cssVariables: {},
    colorScheme: {},
    spacing: new Set(),
    borderRadius: new Set(),
    typography: new Set(),
    components: {},
    animations: new Set(),
    layout: {}
  };

  // Extract CSS variables from style attribute
  const styleMatch = html.match(/style="([^"]*--[^"]*)"/);
  if (styleMatch) {
    const vars = styleMatch[1].match(/--[\w-]+:\s*[^;]+/g);
    if (vars) {
      vars.forEach(v => {
        const [key, value] = v.split(':').map(s => s.trim());
        patterns.cssVariables[key] = value;
      });
    }
  }

  // Extract common class patterns
  const classMatches = html.match(/class="[^"]+"/g) || [];
  
  // Analyze spacing patterns (gap, p-, m-, etc)
  classMatches.forEach(match => {
    const classes = match.match(/gap-\[[^\]]+\]|p[xytblr]?-\[[^\]]+\]|m[xytblr]?-\[[^\]]+\]/g);
    if (classes) classes.forEach(c => patterns.spacing.add(c));
    
    const rounded = match.match(/rounded-\[[^\]]+\]|rounded-\w+/g);
    if (rounded) rounded.forEach(r => patterns.borderRadius.add(r));
    
    const text = match.match(/text-\[[^\]]+\]|text-\w+/g);
    if (text) text.forEach(t => patterns.typography.add(t));
    
    const transitions = match.match(/transition-\w+|duration-\[[^\]]+\]|ease-\[[^\]]+\]/g);
    if (transitions) transitions.forEach(t => patterns.animations.add(t));
  });

  // Extract color scheme from CSS variables
  if (patterns.cssVariables) {
    Object.entries(patterns.cssVariables).forEach(([key, value]) => {
      if (key.includes('color') || key.includes('background') || key.includes('text') || 
          key.includes('stroke') || key.includes('border')) {
        patterns.colorScheme[key] = value;
      }
    });
  }

  // Find leaderboard card structure
  const cardMatch = html.match(/<div class="[^"]*flex[^"]*w-full[^"]*rounded[^"]*"[^>]*>[\s\S]{100,1000}?<\/div>/);
  if (cardMatch) {
    patterns.components.leaderboardCard = cardMatch[0].substring(0, 500);
  }

  // Find table/list structure
  const tableMatch = html.match(/Rank.*?Trader.*?PNL.*?Win Rate/);
  if (tableMatch) {
    patterns.layout.hasTable = true;
  }

  return patterns;
};

console.log('=== AXIOM LEADERBOARD UI/UX ANALYSIS ===\n');

console.log('Analyzing A.html (KOL Cards View)...\n');
const patternsA = extractUIPatterns('A.html');

console.log('Analyzing B.html (Full Page)...\n');
const patternsB = extractUIPatterns('B.html');

console.log('\n=== COLOR SCHEME ===');
console.log(JSON.stringify(patternsB.colorScheme, null, 2));

console.log('\n=== SPACING PATTERNS ===');
console.log([...patternsA.spacing].slice(0, 20).join(', '));

console.log('\n=== BORDER RADIUS ===');
console.log([...patternsA.borderRadius].slice(0, 10).join(', '));

console.log('\n=== TYPOGRAPHY ===');
console.log([...patternsA.typography].slice(0, 15).join(', '));

console.log('\n=== ANIMATIONS/TRANSITIONS ===');
console.log([...patternsA.animations].slice(0, 15).join(', '));

console.log('\n=== CSS VARIABLES ===');
console.log(JSON.stringify(patternsB.cssVariables, null, 2));

// Save full analysis
const analysis = {
  colorScheme: patternsB.colorScheme,
  cssVariables: patternsB.cssVariables,
  spacing: [...patternsA.spacing],
  borderRadius: [...patternsA.borderRadius],
  typography: [...patternsA.typography],
  animations: [...patternsA.animations],
  layout: patternsB.layout
};

fs.writeFileSync('axiom-ui-analysis.json', JSON.stringify(analysis, null, 2));
console.log('\n✅ Full analysis saved to axiom-ui-analysis.json');
