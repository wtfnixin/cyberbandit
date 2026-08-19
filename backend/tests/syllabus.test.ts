import { describe, it, expect } from 'vitest';
import { executeCommandLine } from '../src/engine/pipeline';
import { DirectoryNode } from '../src/engine/types';

// Helper to create a custom VFS with specific files for testing commands
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
            'update.sh': {
              name: 'update.sh',
              type: 'file',
              permissions: '755',
              owner: 'student',
              group: 'student',
              content: '#!/bin/bash\necho "test"'
            },
            'main.exe': {
              name: 'main.exe',
              type: 'file',
              permissions: '755',
              owner: 'student',
              group: 'student',
              content: 'ELF_HEADER_PLACEHOLDER'
            },
            'plain.txt': {
              name: 'plain.txt',
              type: 'file',
              permissions: '644',
              owner: 'student',
              group: 'student',
              content: 'hello world'
            },
            'exact12.txt': {
              name: 'exact12.txt',
              type: 'file',
              permissions: '644',
              owner: 'student',
              group: 'student',
              content: '123456789012' // size 12 bytes
            }
          }
        }
      }
    }
  }
});

describe('Syllabus Additional Command Tests', () => {
  it('should verify file type classification', () => {
    const vfs = getTestVfs();
    const resScript = executeCommandLine('file update.sh', '/home/student', vfs);
    expect(resScript.stdout).toEqual(['update.sh: POSIX shell script']);

    const resBin = executeCommandLine('file main.exe', '/home/student', vfs);
    expect(resBin.stdout).toEqual(['main.exe: ELF 64-bit LSB executable']);

    const resText = executeCommandLine('file plain.txt', '/home/student', vfs);
    expect(resText.stdout).toEqual(['plain.txt: ASCII text']);
  });

  it('should encode/decode base64 payloads', () => {
    const vfs = getTestVfs();
    // Encode hello world
    const resEnc = executeCommandLine('echo "hello" | base64', '/home/student', vfs);
    expect(resEnc.stdout[0].trim()).toBe('aGVsbG8=');

    // Decode hello world
    const resDec = executeCommandLine('echo "aGVsbG8=" | base64 -d', '/home/student', vfs);
    expect(resDec.stdout[0].trim()).toBe('hello');
  });

  it('should perform ROT13 transliteration mapping with tr', () => {
    const vfs = getTestVfs();
    // Encrypt pelcgb -> crypto
    const resRot = executeCommandLine("echo \"pelcgb\" | tr 'A-Za-z' 'N-ZA-Mn-za-m'", '/home/student', vfs);
    expect(resRot.stdout[0].trim()).toBe('crypto');
  });

  it('should extract strings from executable and grep keys', () => {
    const vfs = getTestVfs();
    const resStrings = executeCommandLine('strings main.exe | grep key', '/home/student', vfs);
    expect(resStrings.stdout).toEqual(['key=cGFzc19zdWNjZXNz']);
  });

  it('should query mock netcat port listeners', () => {
    const vfs = getTestVfs();
    const resNc = executeCommandLine('nc localhost 1337', '/home/student', vfs);
    expect(resNc.stdout).toEqual(['c2VjcmV0X2RhdGEudHh0']);
  });

  it('should perform find with size filtering', () => {
    const vfs = getTestVfs();
    const resFind = executeCommandLine('find . -type f -size 12c', '/home/student', vfs);
    expect(resFind.stdout).toEqual(['./exact12.txt']);
  });
});
