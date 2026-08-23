---
layout: home
hero:
  name: CertPilot
  text: REST API reference
  tagline: >-
    109 endpoints for certificate lifecycle management, CA health monitoring,
    and the estate you get paged about.
  actions:
    - theme: brand
      text: Get started
      link: /api/
    - theme: alt
      text: Browse endpoints
      link: /api/reference/dashboard
    - theme: alt
      text: Source
      link: https://github.com/mervin008/pki_project
features:
  - title: Generated from the router
    details: >-
      Every endpoint on this site is extracted from core/api/router.go, including
      the role gate on each one. A route cannot be added without appearing here,
      because the table is the router.
  - title: The reasoning, not just the rule
    details: >-
      CertPilot's router explains why each endpoint is gated where it is. That
      reasoning is carried through to these pages, so the reference tells you
      why deleting a deployment target is admin-only.
  - title: Built for the team that gets paged
    details: >-
      Authentication covers people, unattended wall displays, and host agents —
      three different credentials with deliberately different powers.
