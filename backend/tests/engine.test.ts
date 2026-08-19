import { describe, it, expect } from 'vitest';
import { executeCommandLine } from '../src/engine/pipeline';
import { DirectoryNode } from '../src/engine/types';

// Mock initial VFS for unit testing
const getTestVfs = (): DirectoryNode => ({
  name: '/',
  type: 'directory',
  permissions: '755',
  owner: 'root',
  group: 'root',
  children: {
    home: {
      name: 'home',
      type: 'directory',
      permissions: '755',
      owner: 'root',
      group: 'root',
      children: {
        student: {
          name: 'student',
          type: 'directory',
          permissions: '700',
          owner: 'student',
          group: 'student',
          children: {
            'flag.txt': {
              name: 'flag.txt',
              type: 'file',
              permissions: '644',
              owner: 'student',
              group: 'student',
              content: 'flag{welcome_to_cyberbandit_challenge}'
            },
            notes: {
              name: 'notes',
              type: 'file',
              permissions: '644',
              owner: 'student',
              group: 'student',
              content: 'Line 1: important details\nLine 2: password=admin123\nLine 3: backup finished'
            },
            logs: {
              name: 'logs',
              type: 'directory',
              permissions: '755',
              owner: 'student',
              group: 'student',
              children: {}
            }
          }
        }
      }
    }
  }
});

describe('Virtual Filesystem Engine tests', () => {
  it('should resolve cwd path and execute pwd', () => {
    const vfs = getTestVfs();
    const res = executeCommandLine('pwd', '/home/student', vfs);
    expect(res.stdout).toEqual(['/home/student']);
    expect(res.stderr).toEqual([]);
  });

  it('should list children of active directory', () => {
    const vfs = getTestVfs();
    const res = executeCommandLine('ls', '/home/student', vfs);
    expect(res.stdout[0]).toContain('flag.txt');
    expect(res.stdout[0]).toContain('notes');
    expect(res.stdout[0]).toContain('logs');
  });

  it('should change current working directory', () => {
    const vfs = getTestVfs();
    const res = executeCommandLine('cd logs', '/home/student', vfs);
    expect(res.cwdMutated).toBe(true);
    expect(res.newCWD).toBe('/home/student/logs');
  });

  it('should cat a file and print contents', () => {
    const vfs = getTestVfs();
    const res = executeCommandLine('cat flag.txt', '/home/student', vfs);
    expect(res.stdout).toEqual(['flag{welcome_to_cyberbandit_challenge}']);
  });

  it('should successfully filter inputs with grep', () => {
    const vfs = getTestVfs();
    const res = executeCommandLine('cat notes | grep password', '/home/student', vfs);
    expect(res.stdout).toEqual(['Line 2: password=admin123']);
  });

  it('should execute pipeline chain: cat | grep | wc -l', () => {
    const vfs = getTestVfs();
    const res = executeCommandLine('cat notes | grep Line | wc -l', '/home/student', vfs);
    expect(res.stdout).toEqual(['3']);
  });

  it('should make a new directory and write to a new file via output redirection', () => {
    const vfs = getTestVfs();
    
    // Create new folder
    const mkdirRes = executeCommandLine('mkdir output_dir', '/home/student', vfs);
    expect(mkdirRes.vfsMutated).toBe(true);
    const updatedVfs = mkdirRes.newVFS!;

    // Echo into redirect file inside that folder
    const redirectRes = executeCommandLine('echo "level complete" > output_dir/result.log', '/home/student', updatedVfs);
    expect(redirectRes.vfsMutated).toBe(true);
    const vfsPostWrite = redirectRes.newVFS!;

    // Cat result
    const catRes = executeCommandLine('cat output_dir/result.log', '/home/student', vfsPostWrite);
    expect(catRes.stdout).toEqual(['level complete']);
  });

  it('should correctly throw directories/files not found errors', () => {
    const vfs = getTestVfs();
    const res = executeCommandLine('cat missing.txt', '/home/student', vfs);
    expect(res.stderr[0]).toContain('No such file or directory');
  });
});
