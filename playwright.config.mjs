import { defineConfig, devices } from '@playwright/test';

/* Recette de Skull King Score.
   Chaque fichier de tests/ correspond a une anomalie relevee en recette et
   porte le numero de son issue. Un test doit echouer sur le code d'avant la
   correction et passer apres : c'est le filet qui empeche la regression. */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:8123/',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore'
  },
  use: {
    baseURL: 'http://127.0.0.1:8123',
    trace: 'retain-on-failure',
    locale: 'fr-FR'
  },
  /* Trois moteurs. WebKit est celui de Safari et de tous les navigateurs iOS,
     ou l'application est justement censee s'installer. */
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 412, height: 915 } } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } }
  ]
});
