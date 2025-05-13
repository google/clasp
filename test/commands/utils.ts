import {makeProgram} from '../../src/commands/program.js';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  message: string;
}

const EXIT_SENTINEL = '';

export async function runCommand(args: string[], passthrough = true): Promise<CommandResult> {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const result = {
    stdout: '',
    stderr: '',
    exitCode: 0,
    message: '',
  };
  process.stdout.write = (chunk: any) => {
    result.stdout += chunk;
    if (passthrough) {
      return originalStdout.call(process.stdout, chunk);
    }
    return true;
  };
  process.stderr.write = (chunk: any) => {
    result.stderr += chunk;
    if (passthrough) {
      return originalStderr.call(process.stderr, chunk);
    }
    return true;
  };
  const clasp = await makeProgram(err => {
    console.log('ERROR', err);
    if (err) {
      result.exitCode = err.exitCode || 1;
      result.message = err.message ?? '';
    }
    throw EXIT_SENTINEL;
  });
  try {
    await clasp.parseAsync(['node', 'index.js', ...args]);
  } catch (err) {
    if (err !== EXIT_SENTINEL) {
      result.exitCode = 1;
      console.error(err);
    }
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
  return result;
}
