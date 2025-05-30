const fs      = require('fs');
const axios   = require('axios');
const cheerio = require('cheerio');
const JSON5   = require('json5');   // website uses JSON5 format for objects

// Helper function, originally tried (/var\s+obj\s*=\s*({[\s\S]*?});/)
// before realizing that there was a closed brace before it pulled the whole object
function extractJson(txt) {
  const start = txt.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < txt.length; i++) {
    // Building a depth counter to find the matching closing braces
    // Then return the content between the first opening brace and the matching closing brace
    if (txt[i] === '{') depth++;
    else if (txt[i] === '}') {
      depth--;
      if (depth === 0) return txt.slice(start, i + 1);
    }
  }
  return null;
}

(async () => {
    // Done asyncronously to avoid blocking while taking in the HTML
  const { data: html } = await axios.get('https://denverpioneers.com/index.aspx');
  const $ = cheerio.load(html);

  const objects = $('script')
    .toArray()
    .map(el => $(el).html())
    // Clean the script for the json
    .filter(t => t && t.includes('var obj ='))
    .map(extractJson)
    .filter(Boolean)
    // convert to JSON5 objects
    .map(lit => {
      try { return JSON5.parse(lit); }
      catch { return null; }
    })

  const eventsBlock = objects.find(o => o.type === 'events');
  if (!eventsBlock) throw new Error('Events block not found – site layout may have changed.');

  // Looks for relevant data in each event block
  const parsed = eventsBlock.data.map(evt => ({
    duTeam  : evt.sport?.title    ?? 'N/A',
    opponent: evt.opponent?.title ?? 'N/A',
    date    : evt.date            ?? 'N/A'
  }));

  fs.writeFileSync('results/athletic_events.json', JSON.stringify(parsed, null, 2));
  // If it worked you should see this
  console.log(`Wrote ${parsed.length} events to games.json`);
})();
