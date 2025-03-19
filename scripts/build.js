const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Files to copy
const filesToCopy = ['README.md', 'content.js', 'manifest.json'];

// Copy each file
filesToCopy.forEach((file) => {
  const sourcePath = path.join(__dirname, '..', file);
  const destPath = path.join(distDir, file);

  try {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✓ Copied ${file} to dist/`);
  } catch (err) {
    console.error(`✗ Error copying ${file}:`, err.message);
  }
});

console.log('\nBuild complete! Files copied to dist/ directory.');
