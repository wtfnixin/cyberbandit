export interface VFSNode {
  name: string;
  type: 'file' | 'directory';
  permissions: string;
  owner?: string;
  group?: string;
  content?: string;
  children?: Record<string, VFSNode>;
}

export function resolvePath(cwd: string, target: string): string {
  if (!target) return cwd;
  let raw = target.startsWith('/') ? target : `${cwd}/${target}`;
  const parts = raw.split('/').filter(Boolean);
  const stack: string[] = [];
  for (const p of parts) {
    if (p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return '/' + stack.join('/');
}

export function walkVfs(vfs: VFSNode, resolvedPath: string): VFSNode | null {
  if (resolvedPath === '/') return vfs;
  const parts = resolvedPath.split('/').filter(Boolean);
  
  let current: VFSNode = vfs;
  for (const part of parts) {
    if (current.type !== 'directory' || !current.children || !current.children[part]) {
      return null;
    }
    current = current.children[part];
  }
  return current;
}

export function buildVfsTree(files: Record<string, string>): VFSNode {
  const root: VFSNode = { name: '/', type: 'directory', permissions: '755', owner: 'root', group: 'root', children: { home: { name: 'home', type: 'directory', permissions: '755', owner: 'root', group: 'root', children: { student: { name: 'student', type: 'directory', permissions: '700', owner: 'student', group: 'student', children: {} } } } } };
  for (const [fullPath, content] of Object.entries(files)) {
    const normalizedPath = fullPath.startsWith('/') ? fullPath : `/home/student/${fullPath}`;
    const parts = normalizedPath.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (!current.children) current.children = {};
      if (isLast) {
        current.children[part] = { name: part, type: 'file', permissions: part.startsWith('.') ? '600' : '644', owner: normalizedPath.startsWith('/home/student') ? 'student' : 'root', group: normalizedPath.startsWith('/home/student') ? 'student' : 'root', content };
      } else {
        if (!current.children[part]) current.children[part] = { name: part, type: 'directory', permissions: '755', owner: normalizedPath.startsWith('/home/student') ? 'student' : 'root', group: normalizedPath.startsWith('/home/student') ? 'student' : 'root', children: {} };
        current = current.children[part];
      }
    }
  }
  return root;
}
