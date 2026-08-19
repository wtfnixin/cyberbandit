import { ParsedCommand } from './types';

/**
 * Parses arguments respecting quotes (single/double) and splits flags from normal arguments.
 */
export function parseCommandLine(cmdString: string): ParsedCommand {
  const trimmed = cmdString.trim();
  if (!trimmed) {
    return { cmd: '', args: [], flags: [] };
  }

  // Regex to split command string by spaces, ignoring spaces inside quotes
  const matches = trimmed.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  if (matches.length === 0 || !matches[0]) {
    return { cmd: '', args: [], flags: [] };
  }

  // The first token is the command itself
  const rawCmd = matches[0];
  const cmd = rawCmd.replace(/^["']|["']$/g, ''); // strip outer quotes

  const args: string[] = [];
  const flags: string[] = [];
  const originalTokens: string[] = [];

  for (let i = 1; i < matches.length; i++) {
    let token = matches[i];
    // Strip outer quotes if present
    token = token.replace(/^["']|["']$/g, '');
    originalTokens.push(token);

    if (token.startsWith('-')) {
      // It is a flag (e.g. -l, -la, --recursive)
      flags.push(token);
    } else {
      args.push(token);
    }
  }

  return { cmd, args, flags, originalTokens };
}

/**
 * Splits a full shell line containing pipeline characters `|` ignoring pipes within quotes
 */
export function splitPipeline(fullLine: string): string[] {
  // Split by '|' only if it is outside quotes
  const stages = fullLine.split(/\|(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  return stages.map(s => s.trim()).filter(Boolean);
}

/**
 * Splits and extracts output redirections (e.g., `>` or `>>`) at the very end of a command string
 */
export function parseRedirection(stageString: string): {
  cleanCommand: string;
  redirectTo: string | null;
  append: boolean;
} {
  // Regex to match a trailing redirection target to the right
  // e.g. "cat flag.txt > output.txt" or "echo 'hello' >> log.txt"
  const redirectMatch = stageString.match(/(>>|>)\s*("[^"]+"?'[^']+'?|[^\s>]+)\s*$/);
  if (!redirectMatch) {
    return { cleanCommand: stageString, redirectTo: null, append: false };
  }

  const operator = redirectMatch[1];
  let target = redirectMatch[2].trim();
  target = target.replace(/^["']|["']$/g, ''); // strip quotes

  const cleanCommand = stageString.substring(0, redirectMatch.index).trim();
  return {
    cleanCommand,
    redirectTo: target,
    append: operator === '>>'
  };
}
