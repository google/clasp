import {makeProgram} from './build/src/commands/program.js';

const program = makeProgram((err) => {
  console.log("ERR CODE:", err.code);
  throw err;
});

program.parseAsync(['node', 'clasp', 'abc']).catch(e => console.log("CAUGHT CODE:", e.code));
