# Clasp src/

`clasp`'s source code lives in this directory with the entry point `index.ts`.

## [auth.ts](auth.ts)

- Google Oauth Setup
- Load API Credentials (`~/.clasp.json`)
- Login with or without localhost

## [commands/](commands/)

- Each clasp command is exported as a function in their respective files.

## [docs.ts](docs.ts)

- Generates the "How to" section for the meeting docs.

## [files.ts](files.ts)

- Handles file processing
  - Reading files
  - Writing files
    - Transpiling `ts` -> `js`

## [index.ts](index.ts)

- Creates the `clasp` commands via [`commander`](https://www.npmjs.com/package/commander).
- JSDoc comments are parsed by `docs.ts` to generate part of the README.

## [utils.ts](utils.ts)

- Dotfiles, errors, logging, other utils

---

Note: There are other files that are not documented here.
