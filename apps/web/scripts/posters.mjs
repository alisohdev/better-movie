import { readFile, mkdir, writeFile } from 'node:fs/promises';

const fixture = JSON.parse(await readFile(new URL('../../../catalog/movies.json', import.meta.url), 'utf8'));
const output = new URL('../public/posters/', import.meta.url);
await mkdir(output, { recursive: true });
const palettes = [
  ['#e7c9aa', '#bc594e', '#253945'], ['#142b35', '#e8bf73', '#47767e'], ['#94bcb5', '#154b53', '#ed9e7b'],
  ['#b85b45', '#222b40', '#ebd2a0'], ['#e6b46f', '#d3683d', '#254b40'], ['#d2ccb5', '#243b50', '#bf694f'],
  ['#a8c2c9', '#ee805e', '#f5e4bd'], ['#a3a6b7', '#364b67', '#e1ba95'], ['#d7b87d', '#33727b', '#ecdfbb'],
  ['#98aba0', '#254c4e', '#df7456'], ['#c2afc8', '#d65445', '#38364c'], ['#e5d9bf', '#354f53', '#ba6246'],
];
const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function titleLines(title) {
  const lines = []; let line = '';
  for (const word of title.toUpperCase().split(' ')) {
    if (`${line} ${word}`.trim().length > 18 && line) { lines.push(line); line = word; }
    else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}
function artwork(index, ink, accent) {
  const kinds = [
    `<path d="M50 295V105a100 100 0 0 1 200 0v190h-45V108a55 55 0 0 0-110 0v187Z" fill="${ink}"/><path d="m0 281 300-98v87L0 365Z" fill="${accent}"/><circle cx="108" cy="222" r="12" fill="${ink}"/><path d="m94 239 28-2 13 63h-50Z" fill="${ink}"/><circle cx="198" cy="183" r="10" fill="${ink}"/><path d="m187 199 23-2 10 57h-41Z" fill="${ink}"/>`,
    `<path d="m150 40-135 261h270Z" fill="${accent}" opacity=".8"/><path d="M47 291 137 82h26l90 209Z" fill="${ink}"/><path d="m114 110-45 180m117-180 45 180" stroke="${accent}" stroke-width="3"/><path d="m66 310 45-107h78l45 107Z" fill="${accent}"/><rect x="123" y="215" width="54" height="45" rx="5" fill="${ink}"/><path d="M100 298h100" stroke="${ink}" stroke-width="5"/><circle cx="114" cy="280" r="5" fill="${ink}"/><circle cx="186" cy="280" r="5" fill="${ink}"/>`,
    `<circle cx="199" cy="119" r="54" fill="${accent}"/><path d="M0 178h300v145H0Z" fill="${ink}"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${-20 + i * 7} ${200 + i * 15}q80-20 160 0t180 0" fill="none" stroke="${accent}" stroke-width="2" opacity="${0.7 - i * .06}"/>`).join('')}<path d="m100 217 37-42 45 42Z" fill="${accent}"/><path d="M138 178v-63" stroke="${ink}" stroke-width="3"/>`,
    `<circle cx="150" cy="178" r="84" fill="${ink}"/><ellipse cx="150" cy="178" rx="147" ry="40" fill="none" stroke="${accent}" stroke-width="9" transform="rotate(-32 150 178)"/><circle cx="67" cy="81" r="7" fill="${accent}"/><circle cx="238" cy="276" r="11" fill="${ink}"/><path d="m80 73 6-23 23 7" fill="none" stroke="${ink}" stroke-width="3"/>`,
    `<path d="M150 327V115m0 80-66-58m66 108 78-65" stroke="${ink}" stroke-width="9"/>${[[90,113,41],[148,86,46],[211,125,44],[104,192,39],[205,212,49],[144,155,47]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>`).join('')}<circle cx="112" cy="105" r="18" fill="${accent}"/><circle cx="205" cy="138" r="21" fill="${accent}"/><circle cx="131" cy="190" r="17" fill="${accent}"/>`,
    `${Array.from({ length: 8 }, (_, i) => `<path d="M${-50 + i * 18} 320Q${150 - i * 10} ${160 - i * 16} ${50 + i * 27} 10" fill="none" stroke="${ink}" stroke-width="${i % 2 ? 2 : 4}" opacity=".65"/>`).join('')}<circle cx="188" cy="132" r="34" fill="${accent}"/><path d="m188 105 7 20 20 7-20 7-7 20-7-20-20-7 20-7Z" fill="${ink}"/>`,
    `<circle cx="200" cy="100" r="44" fill="${accent}" opacity=".8"/><path d="m22 180 244-42-123 157-26-82Z" fill="${accent}"/><path d="m22 180 95 33 149-75-128 51Z" fill="${ink}"/><path d="m117 213 26 82-5-106Z" fill="${ink}" opacity=".65"/><path d="m30 259 55-9-31 40-5-20Z" fill="${ink}"/>`,
    `<path d="M60 65h180v249H60Z" fill="${ink}"/><path d="M77 83h146v213H77Z" fill="${accent}"/><path d="M150 83v213M77 187h146" stroke="${ink}" stroke-width="9"/>${Array.from({length:16},(_,i)=>`<path d="m${25+(i%5)*57} ${30+Math.floor(i/5)*77} -10 29" stroke="${ink}" stroke-width="2" opacity=".5"/>`).join('')}<path d="m50 314 200 16v10H50Z" fill="${ink}"/>`,
    `<circle cx="93" cy="97" r="36" fill="${accent}"/><path d="M0 185Q90 129 173 207t127-15v130H0Z" fill="${ink}"/><path d="M0 245q90-56 173 22t127-22" fill="none" stroke="${accent}" stroke-width="14"/><path d="m0 287 300-90v26L0 321Z" fill="${accent}" opacity=".7"/>`,
    `<path d="m102 320 48-220 48 220M124 220h52M113 269h74" fill="none" stroke="${ink}" stroke-width="6"/><circle cx="150" cy="108" r="12" fill="${accent}"/>${[36,66,96].map(r=>`<path d="M${150-r} 108a${r} ${r} 0 0 1 ${r*2} 0" fill="none" stroke="${ink}" stroke-width="5"/>`).join('')}<circle cx="150" cy="108" r="4" fill="${ink}"/>`,
    `<path d="M35 314v-43h50v-48h50v-48h50v-48h80v187Z" fill="${ink}"/><path d="m65 207 67-100 10 33 69-58-15 65-45 29-8-25-48 73Z" fill="${accent}"/><circle cx="66" cy="98" r="24" fill="${accent}"/>`,
    `<path d="M145 325V88m0 81-62-58m62 106 77-74m-77 127-86-71m86-55 48-48" stroke="${ink}" stroke-width="6"/><path d="M39 318h220" stroke="${ink}" stroke-width="4"/>${[[80,103],[216,139],[54,194],[189,91]].map(([x,y])=>`<path d="m${x} ${y} 14-11 14 11-14 11Z" fill="${accent}"/>`).join('')}<circle cx="223" cy="65" r="23" fill="${accent}"/>`,
  ];
  return kinds[index % kinds.length];
}
for (const [index, movie] of fixture.movies.entries()) {
  const [paper, ink, accent] = palettes[index % palettes.length];
  const lines = titleLines(movie.titleEn);
  const title = lines.map((line, i) => `<tspan x="24" y="${377 + i * 22}">${esc(line)}</tspan>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450" role="img" aria-labelledby="title"><title id="title">Original geometric artwork for ${esc(movie.titleEn)}</title><rect width="300" height="450" fill="${paper}"/><g>${artwork(index, ink, accent)}</g><text x="24" y="31" fill="${ink}" font-family="Arial,sans-serif" font-size="9" letter-spacing="2">FRAME · FICTIONAL FILM</text><rect y="347" width="300" height="103" fill="${paper}"/><text fill="${ink}" font-family="Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="-.6">${title}</text><text x="24" y="434" fill="${ink}" font-family="Arial,sans-serif" font-size="9" letter-spacing="1.2">${movie.year ?? 'UNDATED'} / SYNTHETIC STUDIO</text></svg>`;
  await writeFile(new URL(`${movie.id}.svg`, output), svg);
}
