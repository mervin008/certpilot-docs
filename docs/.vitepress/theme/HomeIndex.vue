<script setup lang="ts">
/**
 * The home page.
 *
 * Replaces VitePress's stock hero-and-three-cards. That layout is the single
 * most recognisable template signature on the web, and on an API reference it
 * spends the entire first screen on three paragraphs of prose while the reader
 * is looking for an endpoint.
 *
 * Everything quoted here is read from `census-generated.json`, which the
 * endpoint generator emits from routes.json. Nothing on this page is a number
 * somebody typed: the previous hand-written tagline advertised 109 endpoints
 * against a router serving 111, which is exactly the drift the generated
 * reference tables exist to prevent.
 */
import { withBase } from 'vitepress'
import census from '../census-generated.json'
import sections from '../sidebar-generated.json'

// Widest method count, so the bars are proportional to each other rather than
// each filling its own row.
const peak = Math.max(...census.methods.map((m) => m.count))
</script>

<template>
  <div class="home">
    <!-- Asymmetric, not centred. The right column carries real data rather
         than the empty half a centred hero leaves behind. -->
    <header class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">CertPilot REST API</h1>
        <p class="hero-lede">
          {{ census.routeCount }} endpoints across {{ census.sectionCount }} areas of the
          control plane: certificate issuance and renewal, CA health, discovery,
          deployment, and host agents. Each endpoint table gives the role required
          to call it.
        </p>
        <div class="hero-actions">
          <a class="act act-primary" :href="withBase('/api/')">Get started</a>
          <a class="act" :href="withBase('/api/reference/dashboard')">Browse endpoints</a>
        </div>
      </div>

      <!-- The census. Real counts, and the honest visual for a reference site:
           a picture of the actual shape of the API. -->
      <aside class="census" aria-label="Endpoints by HTTP method">
        <p class="census-head">By method</p>
        <dl class="census-list">
          <div v-for="m in census.methods" :key="m.method" class="census-row">
            <dt class="census-method" :data-method="m.method">{{ m.method }}</dt>
            <dd class="census-bar">
              <span :style="{ width: `${(m.count / peak) * 100}%` }" />
            </dd>
            <dd class="census-count">{{ m.count }}</dd>
          </div>
        </dl>
        <p class="census-foot">
          {{ census.displayTokenReadable }} of them are readable by an unattended
          wall screen. The rest need a person or an agent.
        </p>
      </aside>
    </header>

    <!-- The directory. On a reference site the most useful thing the home page
         can do is get out of the way and list what is actually here. -->
    <section class="directory">
      <h2 class="directory-head">Endpoint reference</h2>
      <ul class="directory-grid">
        <li v-for="s in sections" :key="s.link">
          <a :href="withBase(s.link)">
            <span class="dir-name">{{ s.text }}</span>
            <span class="dir-count">{{ s.count }}</span>
          </a>
        </li>
      </ul>
    </section>

    <section class="roles">
      <h2 class="directory-head">Who can call what</h2>
      <p class="roles-lede">
        Four roles, held in CertPilot's own table rather than read from a token
        claim, so an identity provider cannot grant or change them.
      </p>
      <ol class="roles-scale">
        <li v-for="(r, i) in census.roles" :key="r">
          <span class="roles-rank">{{ i + 1 }}</span>
          <span class="roles-name">{{ r }}</span>
        </li>
      </ol>
      <p class="roles-foot">
        <a :href="withBase('/api/roles')">How the gates work</a>
      </p>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: 1120px;
  margin: 0 auto;
  /* Clears the fixed nav, then the page's own opening space. */
  padding: calc(var(--vp-nav-height) + 3.5rem) 1.5rem 6rem;
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 4rem;
  align-items: start;
  padding-bottom: 3.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.hero-title {
  /* Capped rather than scaled freely: above this the title crowds the census
     column beside it at tablet widths. */
  font-size: clamp(1.875rem, 3.4vw, 2.5rem);
  line-height: 1.08;
  letter-spacing: -0.028em;
  font-weight: 600;
  margin: 0;
  color: var(--vp-c-text-1);
}

.hero-lede {
  margin: 1.25rem 0 0;
  font-size: 1.0625rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  max-width: 46ch;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  margin-top: 2rem;
}

/*
 * Square, like every other edge on this site.
 *
 * VitePress ships full-radius pill buttons, which sat on a stylesheet that had
 * already squared the code blocks and the tables. One page, two shape systems,
 * and the pills were the loudest thing on it.
 */
.act {
  display: inline-flex;
  align-items: center;
  padding: 0.5625rem 1.125rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 2px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: border-color 0.14s ease, background 0.14s ease;
}

.act:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.act-primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  font-weight: 600;
}

.act-primary:hover {
  filter: brightness(1.08);
  background: var(--vp-c-brand-1);
}

/* ── Census ──────────────────────────────────────────────────────────────── */
.census {
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  padding: 1.25rem;
  background: var(--vp-c-bg-alt);
}

.census-head,
.census-foot {
  font-family: var(--vp-font-family-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  margin: 0;
}

.census-foot {
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.75rem;
  line-height: 1.5;
  margin-top: 1.125rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--vp-c-divider);
}

.census-list {
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.census-row {
  display: grid;
  grid-template-columns: 4.25rem minmax(0, 1fr) 2rem;
  align-items: center;
  gap: 0.625rem;
}

.census-method {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

/* Only DELETE is coloured, matching the reference tables. In this product it
   rarely means "remove a row": deleting a deployment target stops an estate
   being deployed to while every renewal carries on reporting success. */
.census-method[data-method='DELETE'] { color: var(--cp-critical); }

.census-bar {
  margin: 0;
  height: 3px;
  background: var(--vp-c-divider);
  overflow: hidden;
}

.census-bar > span {
  display: block;
  height: 100%;
  background: var(--vp-c-brand-1);
}

.census-count {
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--vp-c-text-1);
}

/* ── Directory ───────────────────────────────────────────────────────────── */
.directory,
.roles {
  padding-top: 3.5rem;
}

.directory-head {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  font-weight: 500;
  margin: 0 0 1.25rem;
  border: 0;
  padding: 0;
}

.directory-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0;
  border-top: 1px solid var(--vp-c-divider);
}

.directory-grid a {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 0.75rem 0.625rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
  text-decoration: none;
  color: var(--vp-c-text-2);
  font-size: 0.9375rem;
  transition: color 0.14s ease, padding-left 0.14s ease;
}

.directory-grid a:hover {
  color: var(--vp-c-brand-1);
  padding-left: 0.5rem;
}

.dir-count {
  font-family: var(--vp-font-family-mono);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-3);
}

/* ── Roles ───────────────────────────────────────────────────────────────── */
.roles-lede {
  margin: 0 0 1.5rem;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  max-width: 58ch;
}

.roles-scale {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.roles-scale li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  padding: 0.4375rem 0.75rem;
}

.roles-rank {
  font-family: var(--vp-font-family-mono);
  font-size: 0.6875rem;
  color: var(--vp-c-text-3);
}

.roles-name {
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  color: var(--vp-c-text-1);
}

.roles-foot {
  margin: 1.5rem 0 0;
  font-size: 0.9375rem;
}

.roles-foot a { color: var(--vp-c-brand-1); text-decoration: none; }
.roles-foot a:hover { text-decoration: underline; }

/* ── Narrow ──────────────────────────────────────────────────────────────── */
@media (max-width: 860px) {
  .home { padding: calc(var(--vp-nav-height) + 2rem) 1.25rem 4rem; }
  .hero { grid-template-columns: 1fr; gap: 2.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .act,
  .directory-grid a { transition: none; }
  .directory-grid a:hover { padding-left: 0; }
}
</style>
