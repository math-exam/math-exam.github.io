# MathPath

[https://math-exam.github.io/](https://math-exam.github.io/)

Adaptive math practice in the style of MAP Growth Math. A static site on GitHub Pages that uses Google sign-in and stores everything in your own Google Drive.

The app's name is set once, as `APP_NAME` in `src/config.ts`.

## How it works

- Sign in with Google. The app finds or creates a `MathPath` folder in your Drive containing:
  - `assignments.json`: the tests you've added
  - `current.json`: the test in progress, saved after every answer
  - `sessions.json`: every finished test, with each question, the answer chosen, the correct answer, timing, the difficulty path and a summary
  - `state.json`: questions already used, so adaptive tests don't repeat
- **Home:** lists your active assignments (assignments not yet taken). Pick one to start or resume it. If there are none, use "Create a test".
- **Admin mode** (button at the top right):
  - add papers from `data/papers`, build papers by filter, or add adaptive tests with a focus
  - watch the test in progress, or end it
  - reset the no-repeat question bank
  - view past sessions
- The app uses the `drive.file` permission, so it can see only the files it created. The answer key ships to the browser, which is fine for home practice.

## Layout

```
src/            TypeScript: config, engine, auth/Drive helpers, pages/*.ts (one bundle per page), html/
data/questions  question bank (questions.json is generated; the other files are hand-written arrays)
data/papers     fixed papers: a title plus questionIds from the bank
scripts/build/  build.ts (validate data, bundle, write dist/) and generate-questions.ts
```

## Commands

```
npm install
npm run build      # typecheck, validate data, write dist/
npm run dev        # rebuild on change and serve dist/ at http://localhost:8000
npm run generate   # regenerate data/questions/questions.json
npm run format     # prettier on src and scripts
```

A pre-commit hook (husky + lint-staged) runs prettier on staged `.ts` and `.html` files.

The build fails on duplicate question or paper IDs, or on a paper that references a missing question.

## Google Cloud setup (one time)

1. Create a project at console.cloud.google.com and enable the **Google Drive API**.
2. Set up the OAuth consent screen (External) with the `.../auth/drive.file` scope. While the app is in "Testing", add your account as a test user.
3. Credentials → Create **OAuth client ID** (Web application). Authorized JavaScript origins: `https://<user>.github.io` and `http://localhost:8000`.
4. Put the client ID in `GOOGLE_CLIENT_ID` in `src/config.ts`. It is public by design; never commit the client secret (it isn't used).
5. Branding: set the home page to `https://<user>.github.io/<repo>/`, privacy policy to `.../privacy.html` and terms to `.../terms.html` (`src/html/privacy.html`, `src/html/terms.html`). Add `<user>.github.io` as an authorized domain.

## Deploying

Push to `main`. `.github/workflows/pages.yml` builds the site and deploys `dist/`. In the repo's settings, set Pages → Source to "GitHub Actions".
