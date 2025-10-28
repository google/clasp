# Run

`clasp run [functionName]` allows you to execute Apps Script functions remotely.

### Prerequisites

To use `clasp run`, you need to complete 5 steps:

- Set up the **Project ID** in your `.clasp.json` if missing.
- Create an **OAuth Client ID** of type `Desktop Application`. Download as `client_secret.json`.
- `clasp login --creds client_secret.json --user <key>` with this downloaded file.
- Add the following to `appsscript.json`:
  ```json
  "executionApi": {
    "access": "ANYONE"
  }
  ```
- Deploy your project as an API Executable if necessary

#### Setup Instructions

1. Ensure you have upgraded to the latest version
    - `clasp -v`
1. Add a `projectId` to your `.clasp.json`. You can find your Project ID via:
    - [Create a GCP project](https://cloud.google.com/resource-manager/docs/creating-managing-projects)
    - Record the `Project ID` and `Project number`. (Example: `my-sample-project-191923.` and `314053285323`)
    - Manually add the `Project ID` to your `.clasp.json` file.
      ```json
      {
        "scriptId": "...",
        "projectId": "my-sample-project-191923"
      }
      ```
1. Set the `projectId` to your Apps Script project
    - Open `https://console.developers.google.com/apis/credentials/consent?project=[PROJECT_ID]`
    - Set `Application name` to `clasp project` and click `save`.
    - Run `clasp open-script`
    - In the menu, click `⚙️ Project Settings > Google Cloud Platform (GCP) Project`
    - If the `Project Number` is missing,
      - Click `Change Project`, paste the PROJECT_NUMBER, and click `Set project`
1. Use your own OAuth 2 client. Create one by following these instructions:
    - `clasp open-credentials-setup`
    - Press **Create credentials** > **OAuth client ID**
    - Application type: **Desktop App**
    - **Create** > **OK**
    - Download the file (⬇), move it to your directory, and name it `client_secret.json`. Please keep this file secret!
1. Ensure that the [scopes required to run the script are listed in `appsscript.json`](https://developers.google.com/apps-script/concepts/scopes#set-explicit).
1. Call `clasp login --user <name> --use-project-scopes --creds client_secret.json`
1. Add the following to `appsscript.json`:
      ```json
      "executionApi": {
        "access": "ANYONE"
      }
      ```
1. If you use Google Workspace, enable `Apps Script API`
    - Open `https://console.cloud.google.com/marketplace/product/google/script.googleapis.com?project=[PROJECT_ID]`
    - Press ENABLE button

### Run a function

After setup, you can remotely execute Apps Script functions from `clasp`:

- `clasp push` your files.
- Type `clasp run`. You'll be prompted for which function you want to run. Select and press **Enter**.
- The result is displayed in the output.
- You can also run functions directly. i.e. `clasp run helloWorld`.

If you get an "Script API executable not published/deployed." error, deploy your script as an API Executable:

- Run `clasp open-script`
- Click `Deploy > New deployment`
- Select type ⚙ > API Executable
- Type a `Description`
- Click `Deploy`

### Run a function that requires scopes

Many Apps Script functions require special OAuth Scopes (Gmail, Drive, etc.).

To run functions that use these scopes, you must add the scopes to your Apps Script manifest and `clasp login` again.

- `clasp open-script`
- `File > Project Properties > Scopes`
- Add these [scopes to your `appsscript.json`](https://developers.google.com/apps-script/concepts/scopes#set-explicit).
- Log in again: `clasp login --user <name> --use-project-scopes --creds creds.json`. This will add these scopes to your credentials.
- `clasp run --user <name> sendMail`
