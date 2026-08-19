const fs = require('fs');

let code = fs.readFileSync('src/services/seedSyllabus.ts', 'utf8');

// Use a replacer function for any hintText field
code = code.replace(/hintText:\s*"([^"]+)"/g, (match, p1) => {
    let newHint = p1;
    
    // Check if the hint explicitly lists a command (e.g., using: cat foo, or : ls -la)
    const commandRegexes = [
        /:\s*(cat|ls|grep|find|file|echo|base64|tr|awk|sort|uniq|strings|nc).*$/i,
        /,\s*use( | command | the command )?(cat|ls|grep|find|file|echo|base64|tr|awk|sort|uniq|strings|nc).*$/i,
        /\busing:?.*$/i,
        /\brun.*$/i,
        /\bwith command:?.*$/i
    ];
    
    for (let rx of commandRegexes) {
        newHint = newHint.replace(rx, '').trim();
    }
    
    // Explicit manual mappings for left-overs
    if (newHint.includes('Verify the script type')) newHint = 'Verify the script type in the current folder using the file inspection utility.';
    if (newHint.includes('Browse script configuration reference')) newHint = 'Print the script contents to your display to inspect where it moves configurations.';
    if (newHint.includes('List files folder contents')) newHint = 'List all contents in the current directory, ensuring that hidden files are displayed.';
    if (newHint.includes('Search for critical issues')) newHint = 'Read the hidden error log and search for lines reporting critical events.';
    if (newHint.includes('Decode the Base64')) newHint = 'The vault key is likely encoded. Decode it from its Base64 format.';
    if (newHint.includes('Navigate inside')) newHint = 'Navigate inside the folder and locate the specific target value.';
    
    // Fallbacks if trailing words left
    newHint = newHint.replace(/\susing\s*$/, '.');
    newHint = newHint.replace(/:\s*$/, '.');
    
    if (!newHint.endsWith('.')) {
        newHint += '.';
    }
    
    return `hintText: "${newHint}"`;
});

fs.writeFileSync('src/services/seedSyllabus.ts', code);
console.log('Update complete.');
