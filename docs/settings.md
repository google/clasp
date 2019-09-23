# Settings

These 1-time-setup settings can enhance your Google Apps Script developer experience. (1 min)

## `appsscript.json` and `.clasp.json` Autocompletion

![autocompletion](https://user-images.githubusercontent.com/744973/44441171-2b8f2b00-a580-11e8-9470-4a846066de8e.gif)

You can get autocompletion for `appsscript.json` and `.clasp.json` in VSCode by following these steps:

1. Open VSCode settings.

    > **Code** > **Preferences** > **Settings**

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

### Other IDEs

- [IntelliJ instructions](https://www.jetbrains.com/help/idea/settings-languages-json-schema.html)
- [Sublime instructions](https://packagecontrol.io/packages/Schema%20Validator)

## `.gs` Syntax highlighting

You can also add `gs` color coding if you prefer not to use `js` or `ts` via this property in the same settings file:

```js
"files.associations": {
    "*.gs": "javascript"
},
```

## Missing Schema?

File a Pull Request in this repo:
https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/appsscript.json
