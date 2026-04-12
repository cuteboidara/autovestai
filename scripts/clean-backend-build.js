const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const pathsToRemove = [
  path.join(projectRoot, 'dist'),
  path.join(projectRoot, 'tsconfig.tsbuildinfo'),
  path.join(projectRoot, 'tsconfig.build.tsbuildinfo'),
];

for (const targetPath of pathsToRemove) {
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to remove ${targetPath}: ${message}`);
  }
}
