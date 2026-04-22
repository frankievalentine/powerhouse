import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeBlack from 'starlight-theme-black';
import sitemap from '@astrojs/sitemap';
import path from 'node:path';

/**
 * Vite plugin that forces a full page reload when markdown content files change.
 * Workaround for Astro 6 content collection HMR issues where markdown edits
 * are not reflected without restarting the dev server.
 * @see https://github.com/withastro/astro/issues/15223
 */
function contentHmrPlugin() {
  return {
    name: 'content-hmr',
    enforce: 'post',
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.md') || file.endsWith('.mdx')) {
        const contentModule = server.moduleGraph.getModuleById('astro:content');
        if (contentModule) {
          server.moduleGraph.invalidateModule(contentModule);
        }
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    }
  };
}

export default defineConfig({
  site: 'https://powerhouse-pi.vercel.app',
  vite: {
    plugins: [contentHmrPlugin()],
    resolve: {
      alias: {
        'starlight-theme-black/overrides/Sidebar.astro': path.resolve('src/starlight-theme-black/overrides/Sidebar.astro')
      }
    }
  },
  integrations: [
    sitemap(),
    starlight({
      title: 'powerhouse',
      description: 'Get any machine ready for AI workflows in one command.',
      disable404Route: true,
      customCss: ['./src/styles/docs.css'],
      plugins: [
        starlightThemeBlack({
          navLinks: [
            { label: 'GitHub', link: 'https://github.com/frankievalentine/powerhouse' },
          ],
          footerText: 'powerhouse v0.1.0',
        }),
      ],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/frankievalentine/powerhouse' }],
      editLink: {
        baseUrl: 'https://github.com/frankievalentine/powerhouse/edit/main/apps/web/'
      },
      lastUpdated: true,
      components: {
        Head: './src/components/DocHead.astro',
      },
      sidebar: [
        {
          label: 'Start Here',
          items: ['what-is-powerhouse', 'getting-started']
        },
        {
          label: 'Harnesses',
          collapsed: true,
          items: [
            {
              label: 'Overview',
              slug: 'harnesses'
            },
            'harnesses/claude',
            'harnesses/codex',
            'harnesses/opencode',
            'harnesses/cursor',
            'harnesses/goose',
            'harnesses/gemini',
            'harnesses/openclaw',
            'harnesses/antigravity',
            'harnesses/github-copilot',
            'harnesses/t3code',
            'harnesses/conductor',
            'harnesses/superset'
          ]
        },
        {
          label: 'Domains',
          collapsed: true,
          items: [
            {
              label: 'Overview',
              slug: 'domains'
            },
            'domains/general',
            'domains/web',
            'domains/backend',
            'domains/mobile',
            'domains/devops',
            'domains/security',
            'domains/engineering',
            'domains/qa',
            'domains/design',
            'domains/data',
            'domains/ai',
            'domains/docs',
            'domains/content',
            'domains/marketing',
            'domains/product-management',
            'domains/social-media'
          ]
        },
        {
          label: 'Integrations',
          collapsed: true,
          items: [
            {
              label: 'Claude',
              collapsed: true,
              items: [
                { label: 'GitHub', slug: 'integrations/claude-github' }
              ]
            },
            {
              label: 'Codex',
              collapsed: true,
              items: [
                { label: 'Gmail', slug: 'integrations/codex-gmail' }
              ]
            },
            {
              label: 'Gemini',
              collapsed: true,
              items: [
                { label: 'Workspace', slug: 'integrations/gemini-workspace' }
              ]
            },
          ]
        },
        {
          label: 'MCP Servers',
          collapsed: true,
          items: [
            {
              label: 'Claude',
              collapsed: true,
              items: [
                { label: 'Context7', slug: 'mcp/claude-context7' },
                { label: 'Sequential Thinking', slug: 'mcp/claude-sequential-thinking' },
                { label: 'Fetch', slug: 'mcp/claude-fetch' },
                { label: 'Memory', slug: 'mcp/claude-memory' },
                { label: 'Filesystem', slug: 'mcp/claude-filesystem' },
                { label: 'Git', slug: 'mcp/claude-git' }
              ]
            },
            {
              label: 'Codex',
              collapsed: true,
              items: [
                { label: 'Context7', slug: 'mcp/codex-context7' },
                { label: 'Sequential Thinking', slug: 'mcp/codex-sequential-thinking' }
              ]
            },
            {
              label: 'Cursor',
              collapsed: true,
              items: [
                { label: 'Context7', slug: 'mcp/cursor-context7' },
                { label: 'Sequential Thinking', slug: 'mcp/cursor-sequential-thinking' }
              ]
            },
            {
              label: 'Gemini',
              collapsed: true,
              items: [
                { label: 'Context7', slug: 'mcp/gemini-context7' },
                { label: 'Sequential Thinking', slug: 'mcp/gemini-sequential-thinking' }
              ]
            },
            {
              label: 'OpenCode',
              collapsed: true,
              items: [
                { label: 'Context7', slug: 'mcp/opencode-context7' },
                { label: 'Sequential Thinking', slug: 'mcp/opencode-sequential-thinking' }
              ]
            }
          ]
        },
        {
          label: 'Reference',
          items: ['cli', 'registry', 'ledger', 'uninstalling']
        }
      ]
    })
  ]
});
