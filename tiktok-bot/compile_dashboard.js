const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const htmlPath = path.join(__dirname, 'public/index.html');
const srcHtmlPath = path.join(__dirname, 'public/index.src.html');
const jsDir = path.join(__dirname, 'public/js');

console.log('--- Bot Zero Dashboard Compiler ---');

if (!fs.existsSync(srcHtmlPath)) {
    console.error(`❌ Error: Source file not found: ${srcHtmlPath}`);
    process.exit(1);
}

// Download file helper (handles 301/302 redirects, supports relative paths)
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        let redirectUrl = response.headers.location;
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          const baseUrl = new URL(url);
          redirectUrl = new URL(redirectUrl, baseUrl.origin).href;
        }
        downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

const assets = [
  { url: 'https://unpkg.com/react@18/umd/react.production.min.js', name: 'react.production.min.js' },
  { url: 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', name: 'react-dom.production.min.js' },
  { url: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js', name: 'lucide.min.js' }
];

async function ensureLocalAssets() {
  console.log('⏳ Checking local JS dependencies...');
  for (const asset of assets) {
    const destPath = path.join(jsDir, asset.name);
    if (!fs.existsSync(destPath)) {
      console.log(`  Downloading ${asset.name} from unpkg CDN...`);
      try {
        await downloadFile(asset.url, destPath);
        console.log(`  ✅ Successfully downloaded ${asset.name}`);
      } catch (e) {
        console.error(`  ❌ Failed to download ${asset.name}: ${e.message}`);
      }
    } else {
      console.log(`  ✅ ${asset.name} already cached locally.`);
    }
  }
}

// Sync root overlay files to public directory
function syncRootOverlays() {
  console.log('⏳ Syncing root overlays to public directory...');
  const filesToSync = [
    'alerts_overlay.html',
    'goal_overlay.html',
    'welcome_overlay.html',
    'topgifter_overlay.html',
    'topliker_overlay.html',
    'youtube_player_overlay.html',
    'stats_ticker_widget.html',
    'overlay.html',
    'overlay.js',
    'overlay.css',
    'queue_overlay.html',
    'queue.js',
    'queue.css',
    'roulette_overlay.html',
    'roulette.js',
    'roulette.css',
    'particles.js',
    'tops.html',
    'firebase-config.js',
    'regalos.html',
    'lista.html',
    'lista.js',
    'lista.css',
    'styles.css'
  ];

  const rootDir = path.dirname(__dirname); // La raíz es el padre de compile_dashboard.js
  const publicDir = path.join(__dirname, 'public');

  for (const file of filesToSync) {
    let srcPath = path.join(rootDir, file);
    const destPath = path.join(publicDir, file);

    if (file === 'firebase-config.js') {
      const activeProfileJson = path.join(__dirname, 'profiles', 'active_profile.json');
      if (fs.existsSync(activeProfileJson)) {
        try {
          const activeProfile = JSON.parse(fs.readFileSync(activeProfileJson, 'utf8')).activeProfile;
          const profileFbConfig = path.join(__dirname, 'profiles', activeProfile, 'firebase-config.js');
          if (fs.existsSync(profileFbConfig)) {
            srcPath = profileFbConfig;
          }
        } catch (_) {}
      }
    }

    if (fs.existsSync(srcPath)) {
      try {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✅ Synced: ${file}`);
      } catch (e) {
        console.error(`  ❌ Failed to sync ${file}: ${e.message}`);
      }
    } else {
      console.warn(`  ⚠️ Source not found for syncing: ${file}`);
    }
  }

  // Sincronizar index.html (formulario de peticiones pública) como pedir.html en public/
  try {
    const srcIndexHtml = path.join(rootDir, 'index.html');
    const destPedirHtml = path.join(publicDir, 'pedir.html');
    if (fs.existsSync(srcIndexHtml)) {
      fs.copyFileSync(srcIndexHtml, destPedirHtml);
      console.log('  ✅ Synced root index.html to public/pedir.html');
    }
  } catch (e) {
    console.error('  ❌ Failed to sync root index.html to public/pedir.html:', e.message);
  }
}

async function run() {
  // Sincronizar primero
  syncRootOverlays();

  await ensureLocalAssets();

  try {
    const htmlContent = fs.readFileSync(srcHtmlPath, 'utf8');

    // Extract Babel script content
    const startTag = '<script type="text/babel">';
    const endTag = '</script>';

    const startIndex = htmlContent.indexOf(startTag);
    if (startIndex === -1) {
        console.error('❌ Error: Start tag <script type="text/babel"> not found in index.src.html!');
        process.exit(1);
    }
    
    const endIndex = htmlContent.indexOf(endTag, startIndex);
    if (endIndex === -1) {
        console.error('❌ Error: Closing tag </script> not found after the start tag!');
        process.exit(1);
    }

    const babelCode = htmlContent.substring(startIndex + startTag.length, endIndex);

    // Save Babel code to temporary file
    const tempJsxPath = path.join(__dirname, 'temp_dashboard.jsx');
    fs.writeFileSync(tempJsxPath, babelCode);

    // Output target path
    const outputJsPath = path.join(__dirname, 'public/dashboard.js');

    console.log('⏳ Compiling React JSX to public/dashboard.js using local Babel CLI...');
    execSync(`npx babel "${tempJsxPath}" --out-file "${outputJsPath}" --presets=@babel/preset-react --no-babelrc`, { stdio: 'inherit' });

    // Clean up temporary file
    if (fs.existsSync(tempJsxPath)) {
        fs.unlinkSync(tempJsxPath);
    }

    // Replace the Babel block with standard script call
    let optimizedHtml = htmlContent.substring(0, startIndex) + '<script src="dashboard.js?v=' + Date.now() + '"></script>' + htmlContent.substring(endIndex + endTag.length);

    // Remove the Babel Standalone CDN script tag if exists
    optimizedHtml = optimizedHtml.replace(/<script\s+src="https:\/\/unpkg\.com\/babel-standalone@[^/]+\/babel\.min\.js"[^>]*><\/script>/gi, '');

    // Replace CDN script tags with local versions in index.html
    optimizedHtml = optimizedHtml
      .replace('https://unpkg.com/react@18/umd/react.production.min.js', 'js/react.production.min.js')
      .replace('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', 'js/react-dom.production.min.js')
      .replace('https://unpkg.com/lucide@latest', 'js/lucide.min.js');

    // Save the optimized HTML
    fs.writeFileSync(htmlPath, optimizedHtml);
    console.log('✅ Successfully compiled! Created optimized index.html and public/dashboard.js.');

  } catch (error) {
    console.error('❌ Compilation failed:', error.message);
    process.exit(1);
  }
}

run();
