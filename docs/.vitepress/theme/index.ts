import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

/*
 * Fonts are self-hosted, not linked from a CDN.
 *
 * A documentation site that fetches its typeface from fonts.googleapis.com asks
 * every reader's browser to announce that it is reading CertPilot's API docs to
 * a third party, and renders in a fallback face for anyone behind a network
 * that blocks it. Both of those are avoidable by shipping the files.
 *
 * IBM Plex Sans for prose and JetBrains Mono for anything a machine produced:
 * paths, methods, handler names, JSON. The pairing is the conventional one for
 * developer documentation because it works, and Plex has the wide aperture and
 * unambiguous 1/l/I that a page full of URL fragments needs.
 */
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/jetbrains-mono'

import HomeIndex from './HomeIndex.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeIndex', HomeIndex)
  },
} satisfies Theme
