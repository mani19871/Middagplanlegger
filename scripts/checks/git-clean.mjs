// Feiler hvis det finnes kildefiler som ikke er i git: usporede (??) eller ignorerte (!!) filer under src/, server/,
// scripts/ og public/. Fanger en fil som er glemt eller skjult av .gitignore (som src/data/ bak et for vidt «data/»-mønster),
// før en commit som virker lokalt, men ikke i en ren klon, blir pushet. Kjør før push: npm run check:git
import { execFileSync } from 'node:child_process';

const dirs = ['src', 'server', 'scripts', 'public'];
const out = execFileSync('git', ['status', '--porcelain', '--ignored', '--untracked-files=all', '--', ...dirs], { encoding: 'utf8' });
const bad = out.split('\n').filter((l) => l.startsWith('??') || l.startsWith('!!'));
if (bad.length > 0) {
  console.error(`FEIL ${bad.length} fil(er) under ${dirs.join(', ')} er ikke i git (?? usporet, !! ignorert):\n${bad.join('\n')}`);
  console.error('Legg dem til (git add), eller rett .gitignore. En ren klon av repoet mangler dem ellers.');
  process.exit(1);
}
console.log(`ok   ingen usporede eller ignorerte filer under ${dirs.join(', ')}`);
