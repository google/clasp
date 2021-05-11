export class ClaspError extends Error {
  constructor(message: string, exitCode = 1) {
    super(message);
    // @see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
    Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain
    this.name = ClaspError.name; // Stack traces display correctly now
    process.exitCode = exitCode;
  }
}
