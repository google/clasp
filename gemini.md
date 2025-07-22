# Gemini Project Overview: @google/clasp

This document provides a high-level overview of the `@google/clasp` project to guide AI-based development and maintenance.

## Project Purpose

`clasp` is a command-line tool for developing and managing Google Apps Script projects locally. It allows developers to write code in their preferred local environment, use version control (like Git), and then push the code to their Apps Script projects. It also supports managing deployments, versions, and executing functions remotely.

## Tech Stack

-   **Language:** TypeScript
-   **Platform:** Node.js
-   **CLI Framework:** [Commander.js](https://github.com/tj/commander.js)
-   **Key Libraries:**
    -   `googleapis`: To interact with Google APIs (Apps Script, Drive, etc.).
    -   `google-auth-library`: For handling OAuth2 authentication.
    -   `inquirer`: For interactive command-line prompts.
    -   `ora`: For displaying spinners during long-running operations.
-   **Testing:**
    -   **Framework:** Mocha
    -   **Assertions:** Chai
    -   **Mocking:** Nock (for HTTP requests) and `mock-fs` (for filesystem).
-   **Linting & Formatting:** Biome

## Project Structure

```
.
├── src/
│   ├── commands/   # Definitions for each CLI command (e.g., push, pull, login).
│   ├── core/       # Core logic for interacting with APIs and the filesystem.
│   └── auth/       # Authentication-related logic.
├── test/
│   ├── commands/   # Tests for the CLI commands.
│   └── core/       # Tests for the core logic.
│   └── fixtures/   # Mock data and file templates used in tests.
├── build/          # Compiled JavaScript output from TypeScript.
├── package.json    # Project metadata, dependencies, and scripts.
├── tsconfig.json   # TypeScript compiler configuration.
├── biome.json      # Biome linter/formatter configuration.
└── README.md       # Project documentation.
```

## Development Workflow

### Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

### Common Commands

-   **Compile TypeScript:**
    ```bash
    npm run compile
    ```
    *(This is equivalent to running `tspc`, a patched version of `tsc`)*

-   **Build the project (compiles and installs):**
    ```bash
    npm run build
    ```

-   **Run tests:**
    ```bash
    npm test
    ```

-   **Check for linting and formatting issues:**
    ```bash
    npm run lint
    ```
    *(Uses `biome check`)*

-   **Fix linting and formatting issues:**
    ```bash
    npm run fix
    ```
    *(Uses `biome check --fix`)*

-   **Run the CLI locally for development:**
    ```bash
    npm run clasp -- <command>
    # Example:
    npm run clasp -- list-scripts
    ```

## Key Conventions & Architecture

-   **Command/Core Separation:** CLI command definitions in `src/commands/` are kept separate from the underlying business logic in `src/core/`. Commands primarily parse options and call methods from the core classes.
-   **Class-based Core:** The core logic is organized into classes like `Clasp`, `Project`, `Files`, and `Services` to encapsulate different areas of functionality.
-   **Heavy Mocking in Tests:** Tests rely heavily on `nock` to mock all outgoing Google API calls and `mock-fs` to simulate the filesystem. This makes tests fast and deterministic. When adding new API interactions, corresponding mocks must be added in `test/mocks.ts`.
-   **Asynchronous Code:** The entire codebase is asynchronous, using `async/await` extensively for all I/O and API operations.
-   **Configuration:** Project-specific settings are stored in a local `.clasp.json` file. Global user credentials are in `~/.clasprc.json`.
-   **Internationalization (i18n):** User-facing strings are managed through `@formatjs/intl` and are located in `src/messages/`.
