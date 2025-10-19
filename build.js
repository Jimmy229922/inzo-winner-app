const fs = require('fs');
const path = require('path');

const basePath = 'frontend';
const distPath = path.join(basePath, 'dist');

// CSS files in order
const cssFiles = [
    'assets/css/base.css',
    'assets/css/style.css',
    'assets/css/navbar.css',
    'assets/css/components.css',
    'assets/css/home.css',
    'assets/css/agents.css',
    'assets/css/profile.css',
    'assets/css/competitions.css',
    'assets/css/calendar.css',
    'assets/css/top-agents.css'
].map(f => path.join(basePath, f));

// JS files in order
const jsFiles = [
    'js/pages/taskStore.js',
    'js/pages/home.js',
    'js/pages/agents.js',
    'js/pages/competitions.js',
    'js/pages/calendar.js',
    'js/pages/topAgents.js',
    'js/pages/profile.js',
    'js/pages/users.js',
    'js/pages/tasks.js',
    'js/pages/addAgent.js',
    'js/pages/activityLog.js',
    'js/utils.js',
    'js/main.js'
].map(f => path.join(basePath, f));

async function bundle() {
    try {
        // Create dist directory if it doesn't exist
        if (!fs.existsSync(distPath)) {
            fs.mkdirSync(distPath, { recursive: true });
            console.log(`Created directory: ${distPath}`);
        }

        // --- Bundle CSS ---
        console.log('Bundling CSS files...');
        let cssContent = '';
        for (const file of cssFiles) {
            if (fs.existsSync(file)) {
                const content = await fs.promises.readFile(file, 'utf8');
                cssContent += `/* == ${path.basename(file)} == */\n` + content + '\n\n';
            } else {
                console.warn(`Warning: CSS file not found, skipping: ${file}`);
            }
        }
        const cssBundlePath = path.join(distPath, 'bundle.css');
        await fs.promises.writeFile(cssBundlePath, cssContent);
        console.log(`CSS bundle created at: ${cssBundlePath}`);

        // --- Bundle JS ---
        console.log('Bundling JS files...');
        let jsContent = '';
        for (const file of jsFiles) {
            // Check if file exists before reading
            if (fs.existsSync(file)) {
                const content = await fs.promises.readFile(file, 'utf8');
                jsContent += `// == ${path.basename(file)} ==\n` + content + '\n\n';
            } else {
                console.warn(`Warning: JS file not found, skipping: ${file}`);
            }
        }
        const jsBundlePath = path.join(distPath, 'bundle.js');
        await fs.promises.writeFile(jsBundlePath, jsContent);
        console.log(`JS bundle created at: ${jsBundlePath}`);

        console.log('\nBuild complete! Now update your index.html to use the new bundles.');

    } catch (error) {
        console.error('An error occurred during the build process:', error);
        process.exit(1);
    }
}

bundle();