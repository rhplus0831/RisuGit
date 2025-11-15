# Request
- Create an overlay for changing setting values.

# Frameworks in Use
- Typescript
- tailwindcss: using the 'rg-' prefix

# Other Implementation Details
- Utilize the existing baseOverlay system.
  - Use the progress component or other elements as usage examples.
- For values that have a public server, there should be a nearby button that, when pressed, automatically uses the public server's value.
- The actual values should not be changed until the save button is pressed.
- Helper functions in `configure.ts` can be utilized.

# List of Setting Items
## Encryption Related
//@arg encrypt_key string - Password for encryption

## Git Related
//@arg git_proxy string - Value used for CORS bypass. If empty, it uses the official server (not the public server). (Public server: https://cors.mephistopheles.moe/)
//@arg git_url string - URL of the Git repository to use
//@arg git_id string - ID for the Git repository
//@arg git_password string - Password for the Git repository
//@arg git_branch string - Name of the branch to use
//@arg git_client_name string - Name to be written when committing

## Auto-Save Related
- //@arg git_on_request_save_chat string - Attempt to save the current chat after an API request
- //@arg git_setting_close_save_other string - Attempt to save other items when the settings window is opened and then closed
- //@arg git_automatic_push string - Attempt to automatically push to the server after an auto-save function is performed

## Behavior on Boot Related
- //@arg git_bootstrap_pull string - Pulls the Git repository when first started
- //@arg git_bootstrap_save_push_character string - After pulling, pushes the character.
- //@arg git_bootstrap_save_push_other string - After pulling, pushes other settings.
- //@arg git_bootstrap_push_asset - If enabled, pushes assets

## Asset Related
- //@arg git_asset_server string - Server URL for handling assets (Public server: https://arisu.mephistopheles.moe/)