# Static smoke and integration tests

Run from the repository root (`gradus-team.github.io`):

```bash
node --test Games/ItsLLM/tests/*.test.cjs
```

The test suite uses Node.js built-in modules and mocked DOM elements; no browser framework or server is required. It checks homepage mode switching, checkout and screenshot behavior, FAQ/WebTools boundaries, game economics, hardware, banking, contracts, certificates, pause permissions, model competition and save migration. These checks do not replace visual QA in real desktop and mobile browsers.
