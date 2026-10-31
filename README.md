# OWEN / Build Notes — local first version

Canonical remote repository (user confirmed 2026-10-31): https://github.com/owenboxes/blog.io.git
GitHub API repository path: `owenboxes/blog.io`; default branch: `main`.
Use this repository for subsequent project work, not the previous username/repository names. After Pages configuration and successful deployment, the project-site base URL is `https://owenboxes.github.io/blog.io/`. See Actions for actual deployment status; a configured URL is not proof of a successful deployment.

Run with Python 3.12+:

```sh
python3 serve.py
```

Open **http://localhost:8765**. Do not open index.html directly: the worker fetch and actual paused stepping need HTTP and isolation headers. First Python execution downloads pinned Pyodide 0.27.7 from jsDelivr; fonts use Google Fonts with system fallbacks. An internet connection is needed for initial runtime loading.

## Features
The runner is fixed to the viewport bottom on the article page. Collapsing leaves a compact bottom bar; expanding reserves reader scroll space so the last paragraph is not covered. List navigation hides the dock. Expanded/fullscreen modes supersede docking. On short/mobile screens the dock body scrolls independently, with sticky execution controls.

Ivory editorial sample article, list navigation, desktop/mobile contents, collapsed Python runner, full execution, real CPython line-event stepping, variable snapshots, bounded stdout, interactive terminal-style input, terminate/reset, viewport expansion and browser fullscreen when supported. All code remains local to the page; no visitor accounts, persistence, analytics or Notion secrets.

When `input()` runs, its prompt appears above a dedicated input row. Enter or the submit button sends one line, including an empty string. Prompts and submitted values are displayed in the separately labeled, collapsible input record, never echoed into the program result panel. `print(input("이름"))` with input `문영성` therefore shows only `문영성` in the result panel. This is an intentional split-view presentation, not a byte-for-byte terminal transcript; Python's returned input string is unchanged. Repeated prompts wait individually without replay. Step mode pauses at the next executable line. Stop/reset cancels the worker. Input waits up to five minutes and accepts at most 65,536 UTF-8 bytes; the active watchdog is suspended during waiting. Isolation headers are required for live input and stepping. No terminal editing history or Ctrl-D EOF emulation.

Stepping advances one CPython line event and pauses at the next event, highlighting the position just executed. The first click executes the first position. The final position is held until another click finishes the session. Variables reflect the current paused frame; entering a function can expose its initial locals while the caller expression is still in progress. Loop headers recur and functions introduce additional positions; blank/comment lines are skipped. This is not expression-level or whole-statement debugging. Full execution clears highlighting immediately and emits no stepping UI events. Worker termination remains available while Python is busy. Five minutes without a step ends the run. Ten-second UI watchdog covers active execution; reload clears the session. This is a learning runner, not a hardened sandbox for hostile code. Do not type secrets or sensitive information.

## Deployment and privacy
The Pages workflow tests Python and JavaScript, then uploads only `site/` as the public website. Initial setup: repository Settings → Pages → Source → GitHub Actions. Run the "Verify and deploy blog" workflow after enabling Pages. Future pushes to main also run it. No personal token is required in site files.

`coi-serviceworker.js` v0.1.7 (MIT, Guido Zuidhof and contributors) is vendored unchanged alongside its license. Source blob: `9901474cc3175733262abb208b1f9e39e1c99595` from https://github.com/gzuidhof/coi-serviceworker. It adds isolation headers through a service worker for static hosts; initial loading can refresh once to activate it. Configuration uses require-corp, like local preview, and the registration scope is `/blog.io/`. This mechanism has local protocol tests, not a claim of hosted-browser verification. Unsupported/private browser modes may not allow interactive stepping/input. Do not enter sensitive data in the runner.

Administrator authentication and automatic Notion publishing are not enabled. On 2026-10-31 the user approved publication of 10 learning notes and 5 practice articles, in addition to the original demo. Only the approved public bodies are stored under site/posts; internal sources and review metadata remain outside this repository. Learning records retain their execution/verification limits, and AI practice proposals are not claims of user completion. Client-side hiding is not privacy protection; raw/private TIL data must never be committed or deployed.

## Public article catalog
Changed UI assets use `?v=<first 12 characters of SHA-256>` in `index.html`. Update the key when app.js, catalog.js or style.css changes; the deployment test rejects stale keys to prevent mixed cached versions after release.

`site/catalog.js` contains only approved public entries. Registration timestamps (`publishedAt`) sort newest first, with `sequence` as a tie breaker; the article's displayed learning date is separate. The desktop sidebar and mobile disclosure use the same catalog as the list page. A compact newest learning note sits above topic-grouped rows with all/note/practice filters.

For a newly approved article, first create its public static HTML page under `site/posts/`, then add its catalog entry with `kind: 'note'` or `'practice'`, category, title, summary, display date and registration timestamp. The existing embedded demo uses `#article`. Catalog links accept only that target or `posts/<slug>.html`. Do not add unpublished entries: filtering a row is not privacy protection because this file is publicly downloadable. Notion drafts and their metadata remain outside this repository.

## Tests
`node tests/test_worker_pyodide.cjs /absolute/path/to/pyodide` runs the exact worker and engine against Pyodide 0.27.7 using Node worker threads (only transport/runtime loading are adapted). CI installs this pinned runtime and covers stepping, post-line state, mode switching, input, functions, while loops and syntax errors. Browser visual checks remain separate.

`python3 -m unittest discover -s tests -v`

`node tests/run-js.cjs` checks the UTF-8 input channel, dock logic, app state transitions and JS syntax. Input echo is shortened after 1,000 characters for display; Python receives the complete submitted line.

Tests use the exact engine.py loaded by the worker, on native CPython. Browser/Pyodide integration requires separate validation. See docs/implementation.md for decisions and verification log.
