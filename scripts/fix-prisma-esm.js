const fs = require("fs");
const path = require("path");

const prismaPackageJsonPath = path.join(
  __dirname,
  "../src/generated/prisma/package.json",
);

if (fs.existsSync(prismaPackageJsonPath)) {
  const packageJson = JSON.parse(
    fs.readFileSync(prismaPackageJsonPath, "utf8"),
  );

  // Remove type: module to allow CommonJS client.js to work
  if (packageJson.type === "module") {
    delete packageJson.type;
    fs.writeFileSync(
      prismaPackageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n",
    );
    console.log(
      '✓ Removed "type": "module" from Prisma generated package.json for CommonJS compatibility',
    );
  }
} else {
  console.warn("⚠ Prisma package.json not found, skipping fix");
}
