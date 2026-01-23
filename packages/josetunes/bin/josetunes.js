#!/usr/bin/env node
'use strict';

// JoseTunes installer CLI
// Downloads and launches the correct platform installer from GitHub Releases

const VERSION = require('../package.json').version;

console.log(`\n  JoseTunes v${VERSION} Installer`);
console.log(`  Platform: ${process.platform}-${process.arch}`);
console.log(`\n  Full implementation pending.\n`);

process.exit(0);
