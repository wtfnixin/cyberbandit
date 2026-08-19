import { DirectoryNode, CommandResult, FileNode } from './types';
import { splitPipeline, parseCommandLine, parseRedirection } from './parser';
import { runCommand } from './executor';
import { resolvePath } from './pathResolver';

// Helper to deep clone VFS tree (needed for redirection writes)
function cloneVfsRoot(dir: DirectoryNode): DirectoryNode {
  const childrenClone: any = {};
  for (const [key, node] of Object.entries(dir.children)) {
    if (node.type === 'directory') {
      childrenClone[key] = cloneVfsRoot(node);
    } else {
      childrenClone[key] = { ...node };
    }
  }
  return { ...dir, children: childrenClone };
}

/**
 * Main parser pipeline handler that processes pipeline commands ('|') and standard file write redirections ('>', '>>').
 */
export function executeCommandLine(
  line: string,
  cwd: string,
  vfsRoot: DirectoryNode
): CommandResult {
  const overallResult: CommandResult = {
    stdout: [],
    stderr: [],
    cwd,
    vfsMutated: false,
    cwdMutated: false
  };

  if (!line.trim()) {
    return overallResult;
  }

  let currentVFS = vfsRoot;
  let currentCWD = cwd;

  // 1. Check for global trailing output redirections (e.g., > file.txt, >> audit.log)
  const { cleanCommand, redirectTo, append } = parseRedirection(line);

  // 2. Parse pipeline streams/stages
  const stages = splitPipeline(cleanCommand);
  if (stages.length === 0) {
    return overallResult;
  }

  let activeStdin: string[] = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const { cmd, args, flags, originalTokens } = parseCommandLine(stage);

    if (!cmd) {
      continue;
    }

    const stageResult = runCommand(cmd, args, flags, currentCWD, currentVFS, activeStdin, originalTokens);

    // Collect stderr
    if (stageResult.stderr.length > 0) {
      overallResult.stderr.push(...stageResult.stderr);
    }

    // Capture mutations
    if (stageResult.vfsMutated && stageResult.newVFS) {
      currentVFS = stageResult.newVFS;
      overallResult.vfsMutated = true;
    }
    if (stageResult.cwdMutated && stageResult.newCWD) {
      currentCWD = stageResult.newCWD;
      overallResult.cwdMutated = true;
    }

    // Set stdout of this stage as stdin for the next stage
    activeStdin = stageResult.stdout;

    // Preserve special actions (like opening nano/vim) from the latest executed stage
    if (stageResult.specialAction) {
      overallResult.specialAction = stageResult.specialAction;
    }
  }

  // 3. Handle redirection writes if redirection is present
  if (redirectTo && overallResult.stderr.length === 0) {
    const lastSlash = redirectTo.lastIndexOf('/');
    let parentPath = '.';
    let targetFileName = redirectTo;

    if (lastSlash !== -1) {
      parentPath = redirectTo.substring(0, lastSlash) || '/';
      targetFileName = redirectTo.substring(lastSlash + 1);
    }

    try {
      currentVFS = cloneVfsRoot(currentVFS);
      const { node: parentNode } = resolvePath(currentCWD, parentPath, currentVFS);

      if (parentNode.type !== 'directory') {
        overallResult.stderr.push(`bash: ${redirectTo}: Parent is not a directory`);
      } else {
        const fileNode = parentNode.children[targetFileName];
        const newPayload = activeStdin.join('\n');

        if (fileNode) {
          if (fileNode.type === 'directory') {
            overallResult.stderr.push(`bash: ${redirectTo}: Is a directory`);
          } else {
            // Append or overwrite file content
            const file = fileNode as FileNode;
            if (append) {
              file.content = file.content ? file.content + '\n' + newPayload : newPayload;
            } else {
              file.content = newPayload;
            }
            overallResult.vfsMutated = true;
          }
        } else {
          // File does not exist, create it
          parentNode.children[targetFileName] = {
            name: targetFileName,
            type: 'file',
            permissions: '644',
            owner: 'student',
            group: 'student',
            content: newPayload
          };
          overallResult.vfsMutated = true;
        }
      }
    } catch (err: any) {
      overallResult.stderr.push(`bash: ${redirectTo}: No such file or directory`);
    }
  } else {
    // If no redirections occurred, display final stdout to stream
    overallResult.stdout = activeStdin;
  }

  if (overallResult.vfsMutated) {
    overallResult.newVFS = currentVFS;
  }
  if (overallResult.cwdMutated) {
    overallResult.newCWD = currentCWD;
    overallResult.cwd = currentCWD;
  }

  return overallResult;
}
