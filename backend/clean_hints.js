const fs = require('fs');
let code = fs.readFileSync('src/services/seedSyllabus.ts', 'utf8');

const regex = /hintText:\s*"((?:[^"\\]|\\.)*)"/g;

code = code.replace(regex, (match, hintStr) => {
    let replaced = hintStr;
    const toRemove = [
        /: ls -la/,
        /: ls/,
        /using:? file.*?$/,
        /using:? cat.*?$/,
        /grep 'critical'.*?$/,
        /find \. -type f.*?$/,
        /: cat.*?$/,
        /: echo.*?$/,
        /\| base64 -d.*?$/,
        /\| uniq -u.*?$/,
        /\| tr.*?$/,
        /using awk.*?$/,
        /: nc localhost.*?$/
    ];
    
    for (let r of toRemove) {
        replaced = replaced.replace(r, '');
    }
    
    // Some manual overrides
    if (replaced.includes('Verify the script type')) replaced = 'Verify the script type in the current folder using the standard file inspection utility.';
    if (replaced.includes('Browse script configuration')) replaced = 'Print the script contents to your display to inspect where it moves configurations.';
    if (replaced.includes('Search for critical issues from hidden logs')) replaced = 'Search for critical issues within the hidden logs.';
    if (replaced.includes('Use the find command to locate files with size 1033 bytes')) replaced = 'Locate any files in the system with exactly 1033 bytes size.';
    
    replaced = replaced.replace(/\susing\s*$/, '').trim();
    if (replaced.endsWith(':')) replaced = replaced.slice(0, -1).trim();
    if (!replaced.endsWith('.')) replaced += '.';
    
    return `hintText: "${replaced}"`;
});

fs.writeFileSync('src/services/seedSyllabus.ts', code);
console.log("Rewrote hints successfully.");
