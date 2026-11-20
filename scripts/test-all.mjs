import { execSync } from 'node:child_process';

console.log('[test-all] Running SHAN test suite...\n');
execSync('node scripts/verify-isolation.mjs', { stdio: 'inherit' });
execSync('node scripts/test-media-resolution.mjs', { stdio: 'inherit' });
execSync('node scripts/test-image-pipeline.mjs', { stdio: 'inherit' });
execSync('node scripts/test-media-publisher.mjs', { stdio: 'inherit' });
execSync('node scripts/test-site-build.mjs', { stdio: 'inherit' });
execSync('node scripts/test-deploy.mjs', { stdio: 'inherit' });
console.log('\n[test-all] ALL VERIFICATION SUITES COMPLETED SUCCESSFULLY! ✓');
