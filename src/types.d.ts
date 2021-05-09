/** extract the *type* of elements from a typed array */
type Unpacked<T> = T extends Array<infer U> ? U : T;

declare module 'inquirer-autocomplete-prompt-ipt';

declare module 'normalize-newline' {
  /**
Normalize the newline characters in a string to `\n`.
@example
```
import normalizeNewline from 'normalize-newline';

normalizeNewline('foo\r\nbar\nbaz');
//=> 'foo\nbar\nbaz'

normalizeNewline(Buffer.from('foo\r\nbar\nbaz')).toString();
//=> 'foo\nbar\nbaz'
```
  */
  function normalizeNewline(input: string): string;
  function normalizeNewline(input: Buffer): Buffer;
  export = normalizeNewline;
}
