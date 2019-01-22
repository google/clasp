# Run

`clasp run [functionName]` allows you to execute Apps Script functions remotely.

### Prerequisites

To use `clasp run`, you need to complete 3 steps:

- Set up a **Project ID**.
- Create an **OAuth Client ID** (Other). Download as `creds.json`.
- `clasp login --creds creds.json` with this downloaded file.

#### Setup Instructions

1. Ensure you have upgraded to the latest version
    - `clasp -v`
1. Add a `projectId` to your `.clasp.json`. You can find your Project ID via:
    - `clasp open`
    - In the menu, click `Resources > Cloud Platform project...`
    - Copy the project ID. Example: `project-id-7006438181792679938`.
    - Paste this in `projectId` in your `.clasp.json`.
1. Use your own OAuth 2 client. Create one by following these instructions:
    - `clasp open --creds`
1. Press **Create credentials** > OAuth client ID
    - Application type: **Other**
    - **Create** > **OK**
    - Download the file and name it `creds.json`

### Run a function

After setup, you can remotely execute Apps Script functions from `clasp`:

- `clasp push` your files.
- Type `clasp run`. You'll be prompted for which function you want to run. Select and press **Enter**.
- The result is displayed in the output.
- You can also run functions directly. i.e. `clasp run helloWorld`.

### Run a function that requires scopes

Many Apps Script functions require special OAuth Scopes (Gmail, Drive, etc.).

To run functions that use these scopes, you must add the scopes to your Apps Script manifest and `clasp login` again.

- `clasp open`
- `File > Project Properties > Scopes`
- Add these scopes to your `appsscript.json`.
- Log in again: `clasp login --creds creds.json`. This will add these scopes to your credentials.
- `clasp run sendMail`
