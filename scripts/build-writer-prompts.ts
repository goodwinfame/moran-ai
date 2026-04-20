import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const WRITERS_DIR = join(import.meta.dirname, '..', 'agents', 'writers');

// Read shared base
const baseContent = readFileSync(join(WRITERS_DIR, '_base.md'), 'utf-8');

// Find all style files
const styleFiles = readdirSync(WRITERS_DIR).filter(f => f.endsWith('.style.md'));

for (const styleFile of styleFiles) {
  const stylePath = join(WRITERS_DIR, styleFile);
  const styleContent = readFileSync(stylePath, 'utf-8');

  // Parse frontmatter
  const fmMatch = styleContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    console.error(`Failed to parse frontmatter in ${styleFile}`);
    continue;
  }

  const frontmatter = fmMatch[1];
  const styleBody = fmMatch[2].trim();

  // Combine: frontmatter + style body + base
  const output = `---\n${frontmatter}\n---\n\n${styleBody}\n\n---\n\n${baseContent}`;

  // Write output
  const outName = basename(styleFile, '.style.md') + '.md';
  const outPath = join(WRITERS_DIR, outName);
  writeFileSync(outPath, output, 'utf-8');
  console.log(`Built: ${outName}`);
}

console.log(`\nDone. Built ${styleFiles.length} writer prompts.`);
