// Copies ../firestore.rules with test emails filled in, for the emulator (the real file keeps its placeholders).
import { readFileSync, writeFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  .replace(/'krrish@krrivats\.app'/g, "'me@test.com'")
  .replace(/'preeti@krrivats\.app'/g, "'wife@test.com'")
  .replace(/'VIEWER_EMAIL'/g, "'papa@test.com'");
writeFileSync(new URL('./rules.emulator.rules', import.meta.url), rules);
console.log('rules.emulator.rules written');
