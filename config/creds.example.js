module.exports = {
  browser: {
    LOGIN_WAIT_TIME: 5,
    SCROLL_PAGE_WAIT_TIME: 5,
    PAGELOAD_WAIT_TIME: 12,
    NEXT_PAGE_PIXEL: 1000,
    ANTI_RATE_LIMIT_RANDOM_MAX_WAIT: 10,
    headless: false,
    proxy: '--proxy-server=http://myproxy:3128',
  },
  scraper: {
    bypassList: 'redirect',
    supportedDomains: 'getpocket',
  },
  pocket: {
    username: 'user@email.com',
    password: '756475570087',
  },
  azure: {
    username: 'user@email.com',
    password: 'password',
    client_id: 'XXXXXXXX-YYYY-YYYY-YYYY-XXXXXXXX',
    client_secret: 'random-blob-here',
    scope:
      'email profile offline_access openid User.Read Files.ReadWrite Notes.ReadWrite calendars.read',
    redirect_uri: 'http://localhost:3000/auth/callback',
    grant_type: 'refresh_token',
    tokenHostname: 'login.microsoftonline.com',
    tokenEndpoint: '/common/oauth2/v2.0/token',
    msGraphHost: 'graph.microsoft.com',
    profileEndpoint: '/v1.0/me',
    notebookEndpoint: '/v1.0/me/onenote/notebooks',
    sectionsEndpoint: '/v1.0/me/onenote/sections',
    notebookName: 'MozillaPocketImports',
    maxPagesperSection: 50,
    postWaitTime: 8,
  },
};
