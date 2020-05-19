# Run

`clasp run [functionName]` allows you to execute Apps Script functions remotely.

### Prerequisites

To use `clasp run`, you need to complete 4 steps:

- Set up a **Project ID**.
- Create an **OAuth Client ID** (Other). Download as `creds.json`.
- `clasp login --creds creds.json` with this downloaded file.
- Add the following to `appsscript.json`:
  ```json
  "executionApi": {
    "access": "ANYONE"
  }
  ```

#### Setup Instructions

1. Ensure you have upgraded to the latest version
    - `clasp -v`
1. Add a `projectId` to your `.clasp.json`. You can find your Project ID via:
    - [Create a GCP project](https://cloud.google.com/resource-manager/docs/creating-managing-projects)
    - Record the `Project ID` and `Project number`. (Example: `my-sample-project-191923.` and `314053285323`)
    - Run the command with your `Project ID`: `clasp setting projectId <PROJECT_ID>`
1. Set the `projectId` to your Apps Script project
    - Open `https://console.developers.google.com/apis/credentials/consent?project=[PROJECT_ID]`
    - Set `Application name` to `clasp project` and click `save`.
    - `clasp open`
    - In the menu, click `Resources > Cloud Platform project...`
    - Paste `Project number` in `Change Project` and click `Set Project`
1. Use your own OAuth 2 client. Create one by following these instructions:
    - `clasp open --creds`
    - Press **Create credentials** > **OAuth client ID**
    - Application type: **Desktop App**
    - **Create** > **OK**
    - Download the file (⬇), move it to your directory, and name it `creds.json`. Please keep this file secret!
1. Call `clasp login --creds creds.json`

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
