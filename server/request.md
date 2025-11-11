Core Request:
*   I need to create a public asset server to store assets (images, videos, music).

Main Frameworks:
*   Python, FastAPI, SQLModel (with SQLite)

Memos:
*   Packages listed in `requirements.txt` are already installed.
*   I will conduct testing myself after the implementation is provided.
*   It's acceptable for temporary information, like cooldowns, to be lost on restart. Please store this in memory to create a prototype.

Technical Requirements:

Storage:
*   It must support both a local folder and S3 storage (specifically Backblaze).
*   The storage mechanism should be abstracted to allow for the potential addition of other storage types in the future.

Database:
*   It needs to store information about the assets.
*   The expected fields are `filename`, `file_type`, `file_size`, `upload_date`, and `last_accessed_date`, but you are free to add more if necessary for the implementation.
*   The `upload_date` and `last_accessed_date` for each asset must be managed.
*   There must be a way to identify and remove files that have not been accessed for more than 60 days.

Endpoints:

All Endpoints:
*   Requests must be rejected if the `x-risu-git-flag` header is missing.
*   CORS should be fully enabled (allow all origins).

`PUT /{filename}`:
*   Receives a file via multipart form data.
*   Rejects files larger than 25MB.
*   Rejects files that are not image, video, or music formats.
*   Calculates the SHA-256 hash of the file's content.
*   If the filename (excluding the extension) does not match the calculated hash, return a 400 Bad Request status.
*   Verify that the file content matches its type (i.e., check for malicious files with a changed extension).
*   If all checks pass, save the file to the configured storage, record its metadata in the database, and return a 200 OK status code.

`GET /{filename}`:
*   Check an in-memory cache to see if there was an attempt to read the file within the last hour.
*   If not, access the database to update the `last_accessed_date`. If the file does not exist in the database during this process, return a 404 Not Found.
*   Redirect the client to `https://risu-asset.mephistopheles.moe/{filename}`.