import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'powerhouse',
      description: 'Bootstrap AI-native development environments from one curated control plane.',
      sidebar: [
        {
          label: 'Start Here',
          items: ['index', 'getting-started']
        }
      ]
    })
  ]
});

