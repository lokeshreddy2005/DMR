const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'client', 'src');

function traverseAndReplace(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            traverseAndReplace(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            if (fullPath.includes('AuthContext.jsx') || fullPath.includes('api.js') || fullPath.includes('cn.js')) continue;

            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes("import axios from 'axios';")) {
                // Determine the relative path to api.js
                // api.js is in client/src/utils/api.js
                const apiPath = path.join(srcDir, 'utils', 'api.js');
                let relativePath = path.relative(path.dirname(fullPath), apiPath);
                
                // Remove the .js extension and format it properly
                relativePath = relativePath.replace(/\\/g, '/').replace('.js', '');
                if (!relativePath.startsWith('.')) {
                    relativePath = './' + relativePath;
                }

                content = content.replace("import axios from 'axios';", `import api from '${relativePath}';`);
                
                // Replace axios.get, axios.post, axios.put, axios.delete, axios.isCancel
                content = content.replace(/axios\.get/g, 'api.get');
                content = content.replace(/axios\.post/g, 'api.post');
                content = content.replace(/axios\.put/g, 'api.put');
                content = content.replace(/axios\.delete/g, 'api.delete');
                content = content.replace(/axios\.isCancel/g, 'api.isCancel');

                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

traverseAndReplace(srcDir);
console.log("Done.");
