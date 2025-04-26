const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Recursive function to copy directories
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Files and directories to copy
const filesToCopy = ['README.md', 'content.js', 'manifest.json'];
const dirsToCopy = ['assets'];

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

// Copy each directory
dirsToCopy.forEach((dir) => {
  const sourcePath = path.join(__dirname, '..', dir);
  const destPath = path.join(distDir, dir);

  try {
    copyDir(sourcePath, destPath);
    console.log(`✓ Copied ${dir}/ directory to dist/`);
  } catch (err) {
    console.error(`✗ Error copying ${dir}/ directory:`, err.message);
  }
});

console.log(
  '\nBuild complete! Files and directories copied to dist/ directory.'
);
