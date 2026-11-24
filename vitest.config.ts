import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Firebase ships separate builds; inlining keeps one shared copy of the SDK in tests.
    server: { deps: { inline: [/firebase/, /@firebase/] } },
    testTimeout: 20000,
  },
})
