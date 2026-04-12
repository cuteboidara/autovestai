const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const env = { ...process.env };
delete env.PRISMA_GENERATE_NO_ENGINE;

const result =
  process.platform === 'win32'
    ? spawnSync(
        env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', '.\\node_modules\\.bin\\prisma.cmd generate'],
        {
          cwd: projectRoot,
          env,
          stdio: 'inherit',
        },
      )
    : spawnSync(path.join(projectRoot, 'node_modules', '.bin', 'prisma'), ['generate'], {
        cwd: projectRoot,
        env,
        stdio: 'inherit',
      });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
