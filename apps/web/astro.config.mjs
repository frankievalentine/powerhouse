import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeBlack from 'starlight-theme-black';

export default defineConfig({
  integrations: [
    starlight({
      title: 'powerhouse',
      description: 'Get any machine ready for AI workflows in one command.',
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
          items: ['getting-started']
        },
        {
          label: 'Guides',
          items: ['profiles', 'domains']
        },
        {
          label: 'Reference',
          items: ['cli', 'registry']
        }
      ]
    })
  ]
});
