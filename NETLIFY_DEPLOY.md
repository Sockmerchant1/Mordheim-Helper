# Deploying To Netlify

This app can run on Netlify as a static Vite site. On Netlify, rosters are stored in each user's browser storage. That means no paid database or server is required, but each player should use JSON export/import to back up or move rosters between devices.

## Recommended Setup

1. Put this project in a GitHub repository.
2. In Netlify, choose **Add new project**.
3. Choose **Import an existing project**.
4. Connect the GitHub repository.
5. Netlify should read `netlify.toml` automatically.

The configured settings are:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22.12.0`
- Roster storage: browser local storage

## What To Upload To GitHub

Upload the project source files, including:

- `src/`
- `server/`
- `tests/`
- `scripts/`
- `public/`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.mjs`
- `netlify.toml`
- `README.md`
- `DATA_CONTRIBUTION_GUIDE.md`
- `KNOWN_GAPS.md`
- `NETLIFY_DEPLOY.md`

Do not upload:

- `node_modules/`
- `.local/`
- `.npm-cache/`
- `.tools/`

Those folders are local machine files and are already ignored by `.gitignore`.

## Important Storage Note

The Netlify version is local-first. If someone opens the app on another computer or browser, their rosters will not automatically appear there. Use the app's JSON export/import for backups and transfers.

The local Windows version can still use the SQLite helper server when run with `npm run dev`.

## Optional Future Upgrade

If you later want shared accounts or cloud rosters, add a real hosted database/API and set:

```text
VITE_ROSTER_STORAGE=remote
VITE_ROSTER_API_BASE_URL=https://your-api.example.com
```

That is not required for the current Netlify setup.
