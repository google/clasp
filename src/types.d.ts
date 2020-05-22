declare module 'normalize-newline' {
  function normalizeNewline(inout: string | Buffer): string;
  export = normalizeNewline;
}

declare module 'split-lines' {
  interface Options {
    readonly preserveNewlines?: boolean;
  }
  function splitLines(inout: string, options?: Options): string[];
  export = splitLines;
}
