import { defineConfig } from 'vitepress'
import generated from './sidebar-generated.json' with { type: 'json' }

const REPO = 'https://github.com/mervin008/certpilot-docs'
const CODE = 'https://github.com/mervin008/pki_project'

export default defineConfig({
  title: 'CertPilot API',
  description:
    'REST API reference for CertPilot — PKI and certificate lifecycle management.',
  lang: 'en-GB',

  // Project pages are served from a subpath. Getting this wrong produces a
  // site whose every asset 404s while the HTML itself loads fine.
  base: '/certpilot-docs/',

  cleanUrls: true,
  lastUpdated: true,

  // A dead link in an API reference sends somebody hunting for an endpoint
  // that does not exist, so it fails the build rather than shipping.
  ignoreDeadLinks: false,

  head: [
    ['meta', { name: 'theme-color', content: '#5ac8fa' }],
    ['meta', { name: 'colour-scheme', content: 'dark light' }],
  ],

  themeConfig: {
    outline: { level: [2, 3], label: 'On this page' },

    nav: [
      { text: 'Guide', link: '/api/', activeMatch: '^/api/(?!reference)' },
      {
        text: 'Endpoints',
        link: generated[0]?.link ?? '/api/',
        activeMatch: '^/api/reference/',
      },
      { text: 'CertPilot', link: CODE },
    ],

    sidebar: [
      {
        text: 'Getting started',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/api/' },
          { text: 'Authentication', link: '/api/authentication' },
          { text: 'Roles and permissions', link: '/api/roles' },
          { text: 'Conventions', link: '/api/conventions' },
          { text: 'Errors', link: '/api/errors' },
        ],
      },
      {
        text: 'Live data',
        collapsed: false,
        items: [
          { text: 'Event stream (SSE)', link: '/api/events' },
          { text: 'Unattended screens', link: '/api/display-tokens' },
        ],
      },
      {
        text: 'Endpoint reference',
        collapsed: false,
        items: generated.map((s) => ({
          text: `${s.text} (${s.count})`,
          link: s.link,
        })),
      },
    ],

    socialLinks: [{ icon: 'github', link: CODE }],

    editLink: {
      pattern: `${REPO}/edit/main/docs/:path`,
      text: 'Edit this page',
    },

    search: { provider: 'local' },

    footer: {
      message: 'CertPilot documentation',
      copyright: `Generated from <a href="${CODE}">core/api/router.go</a>`,
    },
  },
})
