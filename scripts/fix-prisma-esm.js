const fs = require('fs');
const path = require('path');

const prismaPackageJsonPath = path.join(__dirname, '../src/generated/prisma/package.json');

if (fs.existsSync(prismaPackageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(prismaPackageJsonPath, 'utf8'));
  
  if (!packageJson.type) {
    packageJson.type = 'module';
    fs.writeFileSync(prismaPackageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✓ Added "type": "module" to Prisma generated package.json');
  }
} else {
  console.warn('⚠ Prisma package.json not found, skipping fix');
}
