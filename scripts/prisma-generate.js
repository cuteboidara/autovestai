const { execSync } = require('child_process');
execSync('npx prisma generate', { stdio: 'inherit' });
