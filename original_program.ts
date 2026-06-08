// ... (skip down to line 179)
  program.on('command:*', async function (this: Command, op) {
    const msg = intl.formatMessage(
      {
        defaultMessage: 'Unknown command "clasp {command}"',
      },
      {
        command: op[0],
      },
    );
    this.error(msg as string);
  });

  program.error;

  return program;
}
