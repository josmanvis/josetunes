#!/usr/bin/env node
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION = require('../package.json').version;
const GITHUB_REPO = 'josmanvis/josetunes';

const PLATFORM_MAP = {
  'darwin-arm64': {
    file: `josetunes_${VERSION}_aarch64.dmg`,
    label: 'macOS (Apple Silicon)'
  },
  'darwin-x64': {
    file: `josetunes_${VERSION}_x64.dmg`,
    label: 'macOS (Intel)'
  },
  'linux-x64': {
    file: `josetunes_${VERSION}_amd64.deb`,
    label: 'Linux (Debian/Ubuntu)'
  },
  'win32-x64': {
    file: `josetunes_${VERSION}_x64-setup.exe`,
    label: 'Windows'
  }
};

// ---------------------------------------------------------------------------
// Platform check
// ---------------------------------------------------------------------------

const platformKey = `${process.platform}-${process.arch}`;
const platform = PLATFORM_MAP[platformKey];

if (!platform) {
  console.error(`\n  Unsupported platform: ${platformKey}`);
  console.error(`\n  Supported platforms:`);
  Object.entries(PLATFORM_MAP).forEach(([key, val]) => {
    console.error(`    - ${key} (${val.label})`);
  });
  console.error(`\n  Download manually:`);
  console.error(`    https://github.com/${GITHUB_REPO}/releases/latest\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Download with redirect following
// ---------------------------------------------------------------------------

function download(url, dest, redirectCount) {
  if (redirectCount === undefined) redirectCount = 0;
  if (redirectCount > 5) {
    return Promise.reject(new Error('Too many redirects'));
  }

  return new Promise(function (resolve, reject) {
    var options = {
      headers: { 'User-Agent': 'josetunes-npm' }
    };

    var parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      reject(new Error('Invalid URL: ' + url));
      return;
    }

    var protocol = parsedUrl.protocol === 'https:' ? https : require('http');

    protocol.get(url, options, function (response) {
      var statusCode = response.statusCode;

      // Handle redirects (301, 302, 303, 307, 308)
      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        var redirectUrl = response.headers.location;
        // Handle relative redirects
        if (redirectUrl.startsWith('/')) {
          redirectUrl = parsedUrl.protocol + '//' + parsedUrl.host + redirectUrl;
        }
        response.resume(); // Consume response to free memory
        resolve(download(redirectUrl, dest, redirectCount + 1));
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error('Download failed with status ' + statusCode));
        return;
      }

      var totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      var downloadedBytes = 0;

      var fileStream = fs.createWriteStream(dest);

      response.on('data', function (chunk) {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          var percent = Math.round((downloadedBytes / totalBytes) * 100);
          process.stdout.write('\r  Downloading... ' + percent + '%');
        } else {
          var mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
          process.stdout.write('\r  Downloading... ' + mb + ' MB');
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', function () {
        fileStream.close();
        process.stdout.write('\r  Downloading... done!     \n');
        resolve(dest);
      });

      fileStream.on('error', function (err) {
        fs.unlink(dest, function () {}); // Clean up partial file
        reject(err);
      });
    }).on('error', function (err) {
      reject(err);
    });
  });
}

// ---------------------------------------------------------------------------
// Checksum verification
// ---------------------------------------------------------------------------

function verifyChecksum(filePath, expectedHash) {
  var fileBuffer = fs.readFileSync(filePath);
  var hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  return hash === expectedHash.toLowerCase();
}

function getExpectedChecksum(version, filename) {
  var url = 'https://github.com/' + GITHUB_REPO + '/releases/download/v' + version + '/SHA256SUMS.txt';

  return new Promise(function (resolve) {
    downloadText(url, 0).then(function (text) {
      var lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        // Format: hash  filename (two spaces between)
        var parts = line.split(/\s+/);
        if (parts.length >= 2 && parts[1] === filename) {
          resolve(parts[0]);
          return;
        }
      }
      resolve(null);
    }).catch(function () {
      // Checksum verification is best-effort
      resolve(null);
    });
  });
}

function downloadText(url, redirectCount) {
  if (redirectCount === undefined) redirectCount = 0;
  if (redirectCount > 5) {
    return Promise.reject(new Error('Too many redirects'));
  }

  return new Promise(function (resolve, reject) {
    var options = {
      headers: { 'User-Agent': 'josetunes-npm' }
    };

    var protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, options, function (response) {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        var redirectUrl = response.headers.location;
        if (redirectUrl.startsWith('/')) {
          var parsed = new URL(url);
          redirectUrl = parsed.protocol + '//' + parsed.host + redirectUrl;
        }
        response.resume();
        resolve(downloadText(redirectUrl, redirectCount + 1));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error('HTTP ' + response.statusCode));
        return;
      }

      var data = '';
      response.on('data', function (chunk) { data += chunk; });
      response.on('end', function () { resolve(data); });
      response.on('error', reject);
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Installer launch
// ---------------------------------------------------------------------------

function launchInstaller(filePath) {
  switch (process.platform) {
    case 'darwin':
      execSync('open "' + filePath + '"');
      console.log('\n  DMG opened! Drag JoseTunes to your Applications folder.');
      break;

    case 'win32':
      spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
      console.log('\n  Installer launched! Follow the installation wizard.');
      break;

    case 'linux':
      console.log('\n  To install, run:');
      console.log('    sudo dpkg -i "' + filePath + '"');
      console.log('\n  If there are dependency issues, run:');
      console.log('    sudo apt-get install -f');
      break;

    default:
      console.log('\n  Downloaded to: ' + filePath);
      console.log('  Please install manually.');
      break;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n  JoseTunes v' + VERSION + ' Installer');
  console.log('  Platform: ' + platform.label + ' (' + platformKey + ')');
  console.log('');

  var assetUrl = 'https://github.com/' + GITHUB_REPO + '/releases/download/v' + VERSION + '/' + platform.file;
  var destPath = path.join(os.tmpdir(), platform.file);

  try {
    // Download the installer
    console.log('  Fetching ' + platform.file + '...');
    await download(assetUrl, destPath);

    // Verify checksum (best-effort)
    console.log('  Verifying checksum...');
    var expectedHash = await getExpectedChecksum(VERSION, platform.file);
    if (expectedHash) {
      var valid = verifyChecksum(destPath, expectedHash);
      if (valid) {
        console.log('  Checksum verified (SHA256).');
      } else {
        console.warn('  WARNING: Checksum mismatch! File may be corrupted.');
        console.warn('  Expected: ' + expectedHash);
        console.warn('  Continuing anyway...');
      }
    } else {
      console.log('  Checksum file not available, skipping verification.');
    }

    // Launch the installer
    launchInstaller(destPath);

    console.log('\n  Done!\n');
  } catch (err) {
    console.error('\n  Error: ' + (err.message || err));
    console.error('\n  Download manually:');
    console.error('    https://github.com/' + GITHUB_REPO + '/releases/latest\n');
    process.exit(1);
  }
}

main();
