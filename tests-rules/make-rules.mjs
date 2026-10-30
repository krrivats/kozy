// Copies ../firestore.rules for the emulator (the rules use real emails only for the two legacy family accounts).
import { readFileSync, writeFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
writeFileSync(new URL('./rules.emulator.rules', import.meta.url), rules);
console.log('rules.emulator.rules written');
