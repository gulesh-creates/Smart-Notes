const fs = require('fs');
const html = fs.readFileSync('D:/Smart Notes/packages/client/android/build/reports/problems/problems-report.html', 'utf8');
const scriptMatches = html.match(/<script id="total-problems"[^>]*>([\s\S]*?)<\/script>/) ||
  html.match(/<script id="problems-report-data"[^>]*>([\s\S]*?)<\/script>/) ||
  html.match(/window\.__DATA__\s*=\s*(\{[\s\S]*?\});/);

if (scriptMatches) {
  console.log(scriptMatches[1]);
} else {
  // Search for JSON in scripts
  const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const s of scripts) {
    if (s.includes('problem') && s.length < 50000) {
      console.log('Script block:');
      console.log(s.slice(0, 1500));
    }
  }
}

