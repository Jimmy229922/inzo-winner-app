const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // NEW: Import crypto for hashing

const basePath = 'frontend';
const distPath = path.join(basePath, 'dist');

// CSS files in order
const cssFiles = [
    'assets/css/base.css',
    'assets/css/style.css',
    'css/styles.css',
    'assets/css/navbar.css',
    'assets/css/components.css',
    'assets/css/home.css',
    'assets/css/agents.css',
    'assets/css/profile.css',
    'assets/css/profile-redesign.css',
    'assets/css/competitions.css',
    'assets/css/calendar.css',
    'assets/css/top-agents.css',
    'assets/css/top-agents-custom.css',
    'assets/css/top-agents-features.css',
    'assets/css/activity-log.css',
    'assets/css/analytics.css',
    'assets/css/day-competitions.css',
    'assets/css/logs.css',
    'assets/css/statistics.css',
    'assets/css/winner-roulette.css'
].map(f => path.join(basePath, f));

// JS files in order
const jsFiles = [
    'js/pages/taskStore.js',
    'js/pages/home.js',
    'js/pages/agents.js',
    'js/pages/competitions.js',
    'js/pages/templates.js',
    'js/pages/calendar.js',
    'js/pages/topAgents.js',
    'js/pages/profile.js',
    'js/pages/users.js',
    'js/pages/tasks.js',
    'js/pages/addAgent.js',
    'js/pages/activityLog.js',
    'js/pages/analytics.js',
    'js/pages/winner-roulette.js',
    'js/pages/question-suggestions.js',
    'js/pages/admin-question-suggestions.js',
    // 'js/utils.js' is intentionally excluded because build.js injects a small utilities block
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
        await fs.promises.writeFile(cssBundlePath, cssContent, { encoding: 'utf8' });
        console.log(`CSS bundle created at: ${cssBundlePath}`);

        // --- Bundle JS ---
        console.log('Bundling JS files...');
        // Start with an IIFE wrapper
        let jsContent = '(function(window) {\n\n';

        // Add the initialization check function
        jsContent += `
    // Ensure dependencies are loaded
    function ensureDependency(name) {
        if (typeof window[name] === 'undefined') {
            console.error(name + ' is not loaded. Please make sure all required scripts are included.');
            return false;
        }
        return true;
    }

    // Initialize utilities right away
    const utils = {
        async authedFetch(url, options = {}) {
            const token = localStorage.getItem('authToken');
            const headers = new Headers(options.headers || {});
            if (token) {
                headers.set('Authorization', 'Bearer ' + token);
            }
            return fetch(url, Object.assign({}, options, { headers: headers }));
        },
        showToast(message, type = 'info') {
            const container = document.getElementById('toast-container');
            if (!container) return;
        
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            
            const icons = {
                success: '<i class="fas fa-check-circle"></i>',
                error: '<i class="fas fa-exclamation-circle"></i>',
                warning: '<i class="fas fa-exclamation-triangle"></i>',
                info: '<i class="fas fa-info-circle"></i>',
                cancelled: '<i class="fas fa-ban"></i>'
            };

            const titles = {
                success: 'نجاح',
                error: 'خطأ',
                warning: 'تنبيه',
                info: 'معلومة',
                cancelled: 'إلغاء'
            };

            toast.innerHTML = 
                '<div class="toast-icon">' + (icons[type] || icons.info) + '</div>' +
                '<div class="toast-content">' +
                    '<div class="toast-title">' + (titles[type] || 'إشعار') + '</div>' +
                    '<div class="toast-message">' + message + '</div>' +
                '</div>' +
                '<div class="toast-close" onclick="this.parentElement.remove()">&times;</div>';
            
            container.appendChild(toast);
        
            setTimeout(function() {
                toast.remove();
            }, 5000);
        }
    };

    // Make utilities globally available immediately
    window.utils = utils;
    window.authedFetch = utils.authedFetch;  // Direct global access for compatibility
    window.showToast = utils.showToast;      // Direct global access for compatibility\n\n`;

        // Process each file
        for (const file of jsFiles) {
            if (fs.existsSync(file)) {
                let content = await fs.promises.readFile(file, 'utf8');
                // Replace export async function authedFetch with window.authedFetch = async function authedFetch
                content = content.replace(/^\s*export\s+async\s+function\s+authedFetch/gm, 'window.authedFetch = async function authedFetch');
                // Strip `export` keyword while keeping the declaration (so braces stay balanced)
                content = content.replace(/^\s*export\s+(?=(async\s+)?function|const|let|var|class)/gm, '');
                // Remove any remaining import statements
                content = content.replace(/^\s*import\s+.*?[;\n]/gm, '');
                    jsContent += `// == ${path.basename(file)} ==\n${content}\n\n`;
            } else {
                console.warn(`Warning: JS file not found, skipping: ${file}`);
            }
        }
        
        // Close the IIFE
        jsContent += '})(window);\n';
        const jsBundlePath = path.join(distPath, 'bundle.js');
        await fs.promises.writeFile(jsBundlePath, jsContent, { encoding: 'utf8' });
        console.log(`JS bundle created at: ${jsBundlePath}`);

        // --- NEW: Auto-update version in index.html using Content Hash ---
        const indexHtmlPath = path.join(basePath, 'index.html');
        try {
            let htmlContent = await fs.promises.readFile(indexHtmlPath, 'utf8');
            
            // Calculate MD5 hash of the JS bundle
            const jsHash = crypto.createHash('md5').update(jsContent).digest('hex').substring(0, 8);
            
            // Calculate MD5 hash of the CSS bundle
            const cssHash = crypto.createHash('md5').update(cssContent).digest('hex').substring(0, 8);
            
            // Update bundle.js version with its specific hash
            htmlContent = htmlContent.replace(/(\/dist\/bundle\.js)(\?v=[a-zA-Z0-9]+)?/g, `$1?v=${jsHash}`);
            
            // Update bundle.css version with its specific hash
            htmlContent = htmlContent.replace(/(\/dist\/bundle\.css)(\?v=[a-zA-Z0-9]+)?/g, `$1?v=${cssHash}`);
            
            await fs.promises.writeFile(indexHtmlPath, htmlContent, 'utf8');
            console.log(`Updated index.html with new versions - JS: ${jsHash}, CSS: ${cssHash}`);
        } catch (err) {
            console.error('Failed to update index.html version:', err);
        }

        console.log('\nBuild complete!');

    } catch (error) {
        console.error('An error occurred during the build process:', error);
        process.exit(1);
    }
}

bundle();
