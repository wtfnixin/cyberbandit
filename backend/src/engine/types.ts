export type NodeType = 'directory' | 'file';

export interface BaseVfsNode {
  name: string;
  type: NodeType;
  permissions: string; // e.g. "755", "644"
  owner: string;       // e.g. "root", "student"
  group: string;       // e.g. "root", "student"
}

export interface FileNode extends BaseVfsNode {
  type: 'file';
  content: string;
}

export interface DirectoryNode extends BaseVfsNode {
  type: 'directory';
  children: Record<string, VfsNode>;
}

export type VfsNode = FileNode | DirectoryNode;

export interface CommandResult {
  stdout: string[];
  stderr: string[];
  cwd: string;
  vfsMutated: boolean;
  cwdMutated: boolean;
  newVFS?: DirectoryNode;
  newCWD?: string;
  specialAction?: {
    action: string;
    [key: string]: any;
  };
}

export interface ParsedCommand {
  cmd: string;
  args: string[];
  flags: string[];
  originalTokens?: string[];
}
