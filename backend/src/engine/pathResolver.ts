import { DirectoryNode, VfsNode } from './types';

/**
 * Resolves path sequences dynamically relative to client's active working directory
 * and guarantees operations do not escape virtual filesystem boundaries.
 */
export function resolvePath(
  currentDir: string,
  targetPath: string,
  vfsRoot: DirectoryNode
): { node: VfsNode; path: string } {
  // 1. Normalize trailing slashes and split path
  const absolutePath = targetPath.startsWith('/');
  const segments = targetPath.split('/');
  
  let currentStack: string[] = absolutePath ? [] : currentDir.split('/').filter(Boolean);

  for (const part of segments) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (currentStack.length > 0) {
        currentStack.pop();
      }
    } else {
      currentStack.push(part);
    }
  }

  // 2. Traversal validation
  let current: VfsNode = vfsRoot;
  const resolvedPathSegments: string[] = [];

  for (const segment of currentStack) {
    if (current.type !== 'directory') {
      throw new Error(`Not a directory: /${resolvedPathSegments.join('/')}`);
    }
    
    const dirNode = current as DirectoryNode;
    const nextNode = dirNode.children[segment];
    if (!nextNode) {
      throw new Error(`No such file or directory: /${resolvedPathSegments.concat(segment).join('/')}`);
    }
    current = nextNode;
    resolvedPathSegments.push(segment);
  }

  return {
    node: current,
    path: '/' + resolvedPathSegments.join('/')
  };
}
