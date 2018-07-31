/**
 * Generates the How To section of the docs.
 * Ensures the code for clasp commands is well documented.
 * @todo Generate a list of commands for the beginning of the README.
 */
const fs = require('fs');
const parseComments = require('parse-comments');
const extract = require('extract-comments');
const file = fs.readFileSync('src/index.ts').toString();
const ucfirst = require('ucfirst');

// The README will be a concatenation of lines in this variable.
let readme = [
  '## How To...',
];

// Remove first line (#!/usr/bin/env node)
const fileLines = file.split('\n');
fileLines.splice(0, 1);
const fileWithoutFirstLine = fileLines.join('\n');

// Extract JSDoc comments out of our file.
const comments = extract(fileWithoutFirstLine);
for (const command of comments) {
  // To use the parseComments module, complete the stripped comment.
  const comment = `/*${command.raw}*/`;
  const claspCommand = parseComments(comment)[0];
  // Only print valid commands.
  if (claspCommand && claspCommand.description && claspCommand.name) {
    readme.push('');
    readme.push(`### ${ucfirst(claspCommand.name)}`);
    readme.push('');
    readme.push(claspCommand.description);
    // Parameters (@param)
    if (claspCommand.params && claspCommand.params.length) {
      readme.push('');
      readme.push('#### Options\n');
      claspCommand.params.map(param => {
        const isOptional = param.type.indexOf('?') !== -1;
        // readme.push(JSON.stringify(param));
        const paramName = param.parent || param.description.split(' ')[0];
        if (isOptional) {
          readme.push([
            // `\`clasp ${claspCommand.name}`,
            `- \`${paramName}\`:`,
            param.description,
          ].join(' '));
        } else {
          // Required parameters descriptions aren't parsed by parse-comments. Parse them manually.
          readme.push([
            // `\`clasp ${claspCommand.name}`,
            `- \`${paramName}\`:`,
            param.description,
          ].join(' '));
        }
      });
    }
    // Examples (@example)
    if (claspCommand.example) {
      readme.push('');
      readme.push('#### Examples\n');
      const examples = claspCommand.example.split(',');
      examples.map(example => {
        readme.push(`- \`clasp ${example}\``);
      });
    }
    // Extra Description (@desc)
    if (claspCommand.desc) {
      readme.push('');
      const lines = claspCommand.desc.split('-');
      lines.map((line, i) => {
        let value = '';
        if (i) value += '- ';
        readme.push(value + line.trim());
      });
    }
  }
}
console.log(readme.join('\n'));
