import { DirectoryNode, FileNode, VfsNode, CommandResult } from './types';
import { resolvePath } from './pathResolver';

// Helper to deep clone VFS tree to preserve immutability
function deepCloneVfs(dir: DirectoryNode): DirectoryNode {
  const cloneChildren: Record<string, VfsNode> = {};
  for (const [key, node] of Object.entries(dir.children)) {
    if (node.type === 'directory') {
      cloneChildren[key] = deepCloneVfs(node);
    } else {
      cloneChildren[key] = { ...node };
    }
  }
  return {
    ...dir,
    children: cloneChildren
  };
}

// Helper to check if user has permissions (Simulation)
function hasPermission(node: VfsNode, action: 'r' | 'w' | 'x'): boolean {
  // Simple simulator: permissions string like "755" or "644"
  // For this mock engine, we allow everything unless explicitly restricted (e.g. "000")
  if (node.permissions === '000') {
    return false;
  }
  return true;
}

export function runCommand(
  cmd: string,
  args: string[],
  flags: string[],
  cwd: string,
  vfsRoot: DirectoryNode,
  stdin: string[] = [],
  originalTokens: string[] = []
): CommandResult {
  const command = cmd.toLowerCase();
  
  // Prepare default result struct
  const result: CommandResult = {
    stdout: [],
    stderr: [],
    cwd,
    vfsMutated: false,
    cwdMutated: false
  };

  let mutatedRoot = vfsRoot;

  try {
    switch (command) {
      case 'pwd': {
        result.stdout.push(cwd);
        break;
      }

      case 'ls': {
        const targetPath = args[0] || '.';
        const { node } = resolvePath(cwd, targetPath, mutatedRoot);
        if (node.type !== 'directory') {
          result.stdout.push(node.name);
          break;
        }

        const showHidden = flags.some(f => f.includes('a'));
        const longListing = flags.some(f => f.includes('l'));

        let entries = Object.keys(node.children);
        if (!showHidden) {
          entries = entries.filter(e => !e.startsWith('.'));
        }
        
        entries.sort();

        if (longListing) {
          for (const entry of entries) {
            const childNode = node.children[entry];
            const typeFlag = childNode.type === 'directory' ? 'd' : '-';
            const permStr = childNode.permissions || '644';
            const owner = childNode.owner || 'student';
            const group = childNode.group || 'student';
            const size = childNode.type === 'file' ? childNode.content.length : 4096;
            result.stdout.push(`${typeFlag}${permStr} ${owner} ${group} ${size} Aug 08 ${entry}`);
          }
        } else {
          if (entries.length > 0) {
            result.stdout.push(entries.join('  '));
          }
        }
        break;
      }

      case 'cd': {
        const targetPath = args[0] || '/home/student';
        const { node, path: resolvedPath } = resolvePath(cwd, targetPath, mutatedRoot);
        if (node.type !== 'directory') {
          result.stderr.push(`cd: not a directory: ${targetPath}`);
        } else {
          result.cwd = resolvedPath;
          result.cwdMutated = true;
          result.newCWD = resolvedPath;
        }
        break;
      }

      case 'cat': {
        // If stdin is supplied and no args are provided, show stdin
        if (args.length === 0 && stdin.length > 0) {
          result.stdout = [...stdin];
          break;
        }

        const targetPath = args[0];
        if (!targetPath) {
          result.stderr.push("cat: missing file operand");
          break;
        }

        const { node } = resolvePath(cwd, targetPath, mutatedRoot);
        if (node.type === 'directory') {
          result.stderr.push(`cat: ${targetPath}: Is a directory`);
        } else {
          if (!hasPermission(node, 'r')) {
            result.stderr.push(`cat: ${targetPath}: Permission denied`);
          } else {
            result.stdout.push(...node.content.split('\n'));
          }
        }
        break;
      }

      case 'echo': {
        let content = args.join(' ');
        
        // Handle basic environment variables mock
        if (content.startsWith('$')) {
          const envVar = content.substring(1).toUpperCase();
          if (envVar === 'USER') content = 'student';
          else if (envVar === 'PATH') content = '/usr/bin:/bin';
          else if (envVar === 'PWD') content = cwd;
          else content = '';
        }
        
        result.stdout.push(content);
        break;
      }

      case 'mkdir': {
        const targetPath = args[0];
        if (!targetPath) {
          result.stderr.push("mkdir: missing operand");
          break;
        }

        const lastSlash = targetPath.lastIndexOf('/');
        let parentPath = '.';
        let newDirName = targetPath;

        if (lastSlash !== -1) {
          parentPath = targetPath.substring(0, lastSlash) || '/';
          newDirName = targetPath.substring(lastSlash + 1);
        }

        mutatedRoot = deepCloneVfs(mutatedRoot);
        
        const { node: parentNode } = resolvePath(cwd, parentPath, mutatedRoot);
        if (parentNode.type !== 'directory') {
          result.stderr.push(`mkdir: cannot create directory '${targetPath}': Parent is not a directory`);
        } else if (parentNode.children[newDirName]) {
          result.stderr.push(`mkdir: cannot create directory '${targetPath}': File exists`);
        } else {
          parentNode.children[newDirName] = {
            name: newDirName,
            type: 'directory',
            permissions: '755',
            owner: 'student',
            group: 'student',
            children: {}
          };
          result.vfsMutated = true;
          result.newVFS = mutatedRoot;
        }
        break;
      }

      case 'touch': {
        const targetPath = args[0];
        if (!targetPath) {
          result.stderr.push("touch: missing file operand");
          break;
        }

        const lastSlash = targetPath.lastIndexOf('/');
        let parentPath = '.';
        let newFileName = targetPath;

        if (lastSlash !== -1) {
          parentPath = targetPath.substring(0, lastSlash) || '/';
          newFileName = targetPath.substring(lastSlash + 1);
        }

        mutatedRoot = deepCloneVfs(mutatedRoot);

        const { node: parentNode } = resolvePath(cwd, parentPath, mutatedRoot);
        if (parentNode.type !== 'directory') {
          result.stderr.push(`touch: cannot touch '${targetPath}': Parent is not a directory`);
        } else {
          const existingFile = parentNode.children[newFileName];
          if (existingFile) {
            // updates timestamp basically mock, no shell mutation
          } else {
            parentNode.children[newFileName] = {
              name: newFileName,
              type: 'file',
              permissions: '644',
              owner: 'student',
              group: 'student',
              content: ''
            };
            result.vfsMutated = true;
            result.newVFS = mutatedRoot;
          }
        }
        break;
      }

      case 'rm': {
        const targetPath = args[0];
        if (!targetPath) {
          result.stderr.push("rm: missing operand");
          break;
        }

        const force = flags.some(f => f.includes('f'));
        const recursive = flags.some(f => f.includes('r'));

        const lastSlash = targetPath.lastIndexOf('/');
        let parentPath = '.';
        let targetName = targetPath;

        if (lastSlash !== -1) {
          parentPath = targetPath.substring(0, lastSlash) || '/';
          targetName = targetPath.substring(lastSlash + 1);
        }

        mutatedRoot = deepCloneVfs(mutatedRoot);

        let parentNode;
        try {
          const res = resolvePath(cwd, parentPath, mutatedRoot);
          parentNode = res.node;
        } catch (err) {
          if (!force) result.stderr.push(`rm: cannot remove '${targetPath}': No such file or directory`);
          break;
        }

        if (parentNode.type !== 'directory') {
          if (!force) result.stderr.push(`rm: cannot remove '${targetPath}': Parent is not a directory`);
          break;
        }

        const targetNode = parentNode.children[targetName];
        if (!targetNode) {
          if (!force) result.stderr.push(`rm: cannot remove '${targetPath}': No such file or directory`);
          break;
        }

        if (targetNode.type === 'directory' && !recursive) {
          result.stderr.push(`rm: cannot remove '${targetPath}': Is a directory`);
          break;
        }

        delete parentNode.children[targetName];
        result.vfsMutated = true;
        result.newVFS = mutatedRoot;
        break;
      }

      case 'grep': {
        const pattern = args[0];
        if (!pattern) {
          result.stderr.push("grep: missing pattern argument");
          break;
        }

        let linesToSearch: string[] = [];
        const fileArg = args[1];

        if (fileArg) {
          const { node } = resolvePath(cwd, fileArg, mutatedRoot);
          if (node.type === 'directory') {
            result.stderr.push(`grep: ${fileArg}: Is a directory`);
            break;
          }
          linesToSearch = node.content.split('\n');
        } else {
          linesToSearch = [...stdin];
        }

        const ignoreCase = flags.some(f => f.includes('i'));
        const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;

        result.stdout = linesToSearch.filter(line => {
          const matchingLine = ignoreCase ? line.toLowerCase() : line;
          return matchingLine.includes(searchPattern);
        });
        break;
      }

      case 'wc': {
        const countLines = flags.some(f => f.includes('l'));
        const countWords = flags.some(f => f.includes('w'));
        const countChars = flags.some(f => f.includes('c'));

        let text = '';
        const fileArg = args[0];

        if (fileArg) {
          const { node } = resolvePath(cwd, fileArg, mutatedRoot);
          if (node.type === 'directory') {
            result.stderr.push(`wc: ${fileArg}: Is a directory`);
            break;
          }
          text = node.content;
        } else {
          text = stdin.join('\n');
        }

        const lines = text ? text.split('\n').length : 0;
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const chars = text ? text.length : 0;

        const outputSegments: number[] = [];
        if (countLines) outputSegments.push(lines);
        if (countWords) outputSegments.push(words);
        if (countChars) outputSegments.push(chars);

        // Default outputs all if no flags
        if (outputSegments.length === 0) {
          outputSegments.push(lines, words, chars);
        }

        const displayLabel = fileArg || '';
        result.stdout.push(`${outputSegments.join(' ')} ${displayLabel}`.trim());
        break;
      }

      case 'sort': {
        let linesToSort = args[0] 
          ? resolvePath(cwd, args[0], mutatedRoot).node.type !== 'directory' 
            ? (resolvePath(cwd, args[0], mutatedRoot).node as FileNode).content.split('\n')
            : []
          : [...stdin];

        linesToSort.sort();
        result.stdout = linesToSort;
        break;
      }

      case 'uniq': {
        let linesToFilter = args[0]
          ? resolvePath(cwd, args[0], mutatedRoot).node.type !== 'directory'
            ? (resolvePath(cwd, args[0], mutatedRoot).node as FileNode).content.split('\n')
            : []
          : [...stdin];

        const clean: string[] = [];
        for (let i = 0; i < linesToFilter.length; i++) {
          if (i === 0 || linesToFilter[i] !== linesToFilter[i - 1]) {
            clean.push(linesToFilter[i]);
          }
        }
        result.stdout = clean;
        break;
      }

      case 'chmod': {
        const mode = args[0];
        const targetPath = args[1];
        if (!mode || !targetPath) {
          result.stderr.push("chmod: usage chmod <mode> <file>");
          break;
        }

        mutatedRoot = deepCloneVfs(mutatedRoot);
        const { node } = resolvePath(cwd, targetPath, mutatedRoot);
        node.permissions = mode;
        result.vfsMutated = true;
        result.newVFS = mutatedRoot;
        break;
      }

      case 'head': {
        const linesFlag = flags.find(f => f.startsWith('-n'));
        let limit = 10;
        if (linesFlag) {
          const num = parseInt(linesFlag.substring(2) || args.shift() || '10');
          if (!isNaN(num)) limit = num;
        }

        let totalLines = args[0]
          ? resolvePath(cwd, args[0], mutatedRoot).node.type !== 'directory'
            ? (resolvePath(cwd, args[0], mutatedRoot).node as FileNode).content.split('\n')
            : []
          : [...stdin];

        result.stdout = totalLines.slice(0, limit);
        break;
      }

      case 'tail': {
        const linesFlag = flags.find(f => f.startsWith('-n'));
        let limit = 10;
        if (linesFlag) {
          const num = parseInt(linesFlag.substring(2) || args.shift() || '10');
          if (!isNaN(num)) limit = num;
        }

        let totalLines = args[0]
          ? resolvePath(cwd, args[0], mutatedRoot).node.type !== 'directory'
            ? (resolvePath(cwd, args[0], mutatedRoot).node as FileNode).content.split('\n')
            : []
          : [...stdin];

        result.stdout = totalLines.slice(-limit);
        break;
      }

      case 'nano':
      case 'vim': {
        const fileName = args[0];
        if (!fileName) {
          result.stderr.push(`${command}: filename required`);
          break;
        }

        let initialContent = '';
        try {
          const { node } = resolvePath(cwd, fileName, mutatedRoot);
          if (node.type === 'file') {
            initialContent = node.content;
          } else {
            result.stderr.push(`${command}: cannot open: directory`);
            break;
          }
        } catch {
          // File does not exist, nano will create it, that is fine
        }

        const cleanPathString = cwd.endsWith('/') ? cwd + fileName : cwd + '/' + fileName;
        result.specialAction = {
          action: 'EDITOR_MODE',
          targetFile: cleanPathString,
          content: initialContent
        };
        break;
      }

      case 'clear': {
        result.specialAction = {
          action: 'CLEAR_SCREEN'
        };
        break;
      }

      case 'find': {
        const searchPath = originalTokens[0] && !originalTokens[0].startsWith('-') ? originalTokens[0] : '.';
        const nameFlagIndex = originalTokens.indexOf('-name');
        const searchName = nameFlagIndex !== -1 ? originalTokens[nameFlagIndex + 1] : null;
        const sizeFlagIndex = originalTokens.indexOf('-size');
        const searchSize = sizeFlagIndex !== -1 ? originalTokens[sizeFlagIndex + 1] : null;

        const { node: resolvedNode, path: resolvedPath } = resolvePath(cwd, searchPath, mutatedRoot);
        
        const results: string[] = [];

        function traverse(node: VfsNode, runningPath: string) {
          const normalizedPath = runningPath === '/' ? '' : runningPath;
          
          let matchesName = true;
          if (searchName) {
            const cleanPattern = searchName.replace(/\*/g, '');
            matchesName = node.name.includes(cleanPattern);
          }

          let matchesSize = true;
          if (searchSize && node.type === 'file') {
            const sizeInBytes = node.content.length;
            if (searchSize.endsWith('c')) {
              const targetSize = parseInt(searchSize.slice(0, -1));
              matchesSize = sizeInBytes === targetSize;
            } else {
              const targetSize = parseInt(searchSize) * 512;
              matchesSize = sizeInBytes === targetSize;
            }
          } else if (searchSize && node.type !== 'file') {
            matchesSize = false;
          }

          if (matchesName && matchesSize) {
            let displayedPath = runningPath;
            if (searchPath === '.' || searchPath === '..') {
              const rel = runningPath.substring(resolvedPath.length);
              displayedPath = searchPath + rel;
            } else if (!searchPath.startsWith('/')) {
              const rel = runningPath.substring(resolvedPath.length);
              displayedPath = searchPath + rel;
            }
            results.push(displayedPath);
          }

          if (node.type === 'directory') {
            for (const childName of Object.keys(node.children)) {
              traverse(node.children[childName], `${normalizedPath}/${childName}`);
            }
          }
        }

        traverse(resolvedNode, resolvedPath);
        result.stdout = results;
        break;
      }

      case 'file': {
        const targetPath = args[0];
        if (!targetPath) {
          result.stderr.push("file: missing filename");
          break;
        }

        try {
          const { node } = resolvePath(cwd, targetPath, mutatedRoot);
          if (node.type === 'directory') {
            result.stdout.push(`${targetPath}: directory`);
          } else {
            if (targetPath.endsWith('.sh') || node.content.startsWith('#!')) {
              result.stdout.push(`${targetPath}: POSIX shell script`);
            } else if (targetPath.includes('main.exe') || targetPath.includes('list_check')) {
              result.stdout.push(`${targetPath}: ELF 64-bit LSB executable`);
            } else {
              result.stdout.push(`${targetPath}: ASCII text`);
            }
          }
        } catch {
          result.stderr.push(`file: ${targetPath}: No such file or directory`);
        }
        break;
      }

      case 'base64': {
        const decode = flags.some(f => f.includes('d'));
        let input = '';
        if (args.length > 0 && !args[0].startsWith('-')) {
          try {
            const { node } = resolvePath(cwd, args[0], mutatedRoot);
            if (node.type === 'file') {
              input = node.content;
            } else {
              result.stderr.push(`base64: ${args[0]}: Is a directory`);
              break;
            }
          } catch {
            input = args[0];
          }
        } else {
          input = stdin.join('\n');
        }

        if (decode) {
          try {
            const decoded = Buffer.from(input.trim(), 'base64').toString('utf-8');
            result.stdout.push(...decoded.split('\n'));
          } catch (e) {
            result.stderr.push("base64: invalid input");
          }
        } else {
          const encoded = Buffer.from(input).toString('base64');
          result.stdout.push(encoded);
        }
        break;
      }

      case 'tr': {
        if (args.length < 2) {
          result.stderr.push("tr: missing operand");
          break;
        }
        const set1 = args[0];
        const set2 = args[1];
        const input = stdin.join('\n');

        if (set1 === 'A-Za-z' && set2 === 'N-ZA-Mn-za-m') {
          const rot13 = (str: string) => str.replace(/[a-zA-Z]/g, (c) => {
            const base = c <= 'Z' ? 65 : 97;
            return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
          });
          result.stdout.push(...rot13(input).split('\n'));
        } else {
          const map: Record<string, string> = {};
          for (let i = 0; i < Math.min(set1.length, set2.length); i++) {
            map[set1[i]] = set2[i];
          }
          const output = input.split('').map(char => map[char] || char).join('');
          result.stdout.push(...output.split('\n'));
        }
        break;
      }

      case 'strings': {
        const fileArg = args[0];
        if (!fileArg) {
          result.stderr.push("strings: target file required");
          break;
        }

        try {
          const { node } = resolvePath(cwd, fileArg, mutatedRoot);
          if (node.type === 'directory') {
            result.stderr.push(`strings: ${fileArg}: Is a directory`);
            break;
          }

          if (fileArg.includes('main.exe')) {
            result.stdout.push(
              '/lib64/ld-linux-x86-64.so.2',
              '__gmon_start__',
              'libc.so.6',
              'key=cGFzc19zdWNjZXNz',
              'main_db_handler',
              'GCC: (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0'
            );
          } else if (fileArg.includes('.service.bin')) {
            result.stdout.push(
              'init_service',
              'db_port_bind',
              'token=ROT13:greg',
              'exit_gracefully'
            );
          } else if (fileArg.includes('list_check')) {
            result.stdout.push(
              'check_integrity',
              'flag=ROT13:grag',
              'auth_status'
            );
          } else {
            result.stdout.push(...node.content.split('\n'));
          }
        } catch {
          result.stderr.push(`strings: ${fileArg}: No such file or directory`);
        }
        break;
      }

      case 'nc':
      case 'netcat': {
        const host = args[0];
        const port = args[1] || args[0];
        
        if (!port) {
          result.stderr.push("nc: port number required");
          break;
        }

        const portNum = parseInt(port);
        if (portNum === 1337) {
          result.stdout.push("c2VjcmV0X2RhdGEudHh0");
        } else if (portNum === 30001) {
          result.stdout.push("c2VydmVyX3NjcmFwZV9va2F5");
        } else if (portNum === 50000) {
          result.stdout.push("ROT13:fhjnl");
        } else if (portNum === 60000) {
          result.stdout.push("Y29tcGxldGVfMjAyNg==");
        } else {
          result.stderr.push(`nc: connect to localhost port ${port} failed: Connection refused`);
        }
        break;
      }

      case 'submit': {
        const flag = args.join(' ');
        if (!flag) {
          result.stderr.push("submit: flag argument required. Usage: submit flag{...}");
        } else {
          result.specialAction = {
            action: 'SUBMIT_FLAG',
            flag: flag
          };
        }
        break;
      }

      default: {
        result.stderr.push(`bash: ${command}: command not found`);
      }
    }
  } catch (error: any) {
    result.stderr.push(error.message || 'An error occurred during execution');
  }

  return result;
}
