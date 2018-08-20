# Settings

These 1-time-setup settings can enhance your Google Apps Script developer experience. (1 min)

## `appsscript.json` and `.clasp.json` Autocompletion

You can get autocompletion for `appsscript.json` and `.clasp.json` in VSCode by following these steps:

1. Open VSCode settings.

    > **File** > **Preferences** > **Settings**

1. Add these `"json.schemas"` in the **User Settings** file:

    ```js
    {
        "json.schemas": [{
            "fileMatch": [
                "appsscript.json"
            ],
            "url": "http://json.schemastore.org/appsscript"
        }, {
            "fileMatch": [
                ".clasp.json"
            ],
            "url": "http://json.schemastore.org/clasp"
        }]
    }
    ```

1. After adding this, upon editing these files:

    - `appsscript.json` – Apps Script manifest
    - `.clasp.json` – Clasp Project settings

## `.gs` Syntax highlighting

You can also add `gs` color coding if you prefer not to use `js` or `ts` via this property in the same settings file:

```js
"files.associations": {
    "*.gs": "javascript"
},
```
