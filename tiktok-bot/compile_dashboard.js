const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlPath = path.join(__dirname, 'public/index.html');
const srcHtmlPath = path.join(__dirname, 'public/index.src.html');

console.log('--- Zero FM Dashboard Compiler ---');

if (!fs.existsSync(srcHtmlPath)) {
    console.error(`❌ Error: Source file not found: ${srcHtmlPath}`);
    process.exit(1);
}

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
    // Run npx babel to compile the jsx file with react preset
    execSync(`npx babel "${tempJsxPath}" --out-file "${outputJsPath}" --presets=@babel/preset-react --no-babelrc`, { stdio: 'inherit' });

    // Clean up temporary file
    if (fs.existsSync(tempJsxPath)) {
        fs.unlinkSync(tempJsxPath);
    }

    // Replace the Babel block with standard script call
    let optimizedHtml = htmlContent.substring(0, startIndex) + '<script src="dashboard.js"></script>' + htmlContent.substring(endIndex + endTag.length);

    // Remove the Babel Standalone CDN script tag if exists
    optimizedHtml = optimizedHtml.replace(/<script\s+src="https:\/\/unpkg\.com\/babel-standalone@[^/]+\/babel\.min\.js"[^>]*><\/script>/gi, '');

    // Save the optimized HTML
    fs.writeFileSync(htmlPath, optimizedHtml);
    console.log('✅ Successfully compiled! Created optimized index.html and public/dashboard.js.');

} catch (error) {
    console.error('❌ Compilation failed:', error.message);
    process.exit(1);
}
