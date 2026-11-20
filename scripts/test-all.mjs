import { execSync } from 'node:child_process';

console.log('[test-all] Running complete test suite...');
execSync('node scripts/verify-isolation.mjs', { stdio: 'inherit' });
execSync('node scripts/test-phase1.mjs', { stdio: 'inherit' });
execSync('node scripts/test-phase2.mjs', { stdio: 'inherit' });
execSync('node scripts/test-phase3b4.mjs', { stdio: 'inherit' });
execSync('node scripts/test-phase3b6.mjs', { stdio: 'inherit' });
execSync('node scripts/test-phase4b1-resolution.mjs', { stdio: 'inherit' });
execSync('node scripts/test-phase4b3-scoped.mjs', { stdio: 'inherit' });
console.log('\n[test-all] ALL VERIFICATION SUITES COMPLETED SUCCESSFULLY! ✓');
