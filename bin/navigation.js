// Creates Puppeteer Session / authenticates with email & passwd
const puppeteer = require('puppeteer');
const CREDS = require('../config/creds');

async function createbrowsersession() {
  console.log('Initiating browser session...');
  const browser = await puppeteer.launch({
    headless: CREDS.browser.headless,
    ignoreHTTPSErrors: true,
    devtools: false,
    args: [
      CREDS.browser.proxy,
      '--disable-extensions',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1024,768',
    ],
  });
  const USERNAME_SELECTOR = '#field-1';
  const PASSWORD_SELECTOR = '#field-2';
  const LOGIN_BUTTON_SELECTOR =
    '#login-page-login-container > div > form > input';
  const LOGIN_PAGE = 'https://getpocket.com/login';
  const page = await browser.newPage();
  await page.setViewport({ width: 1056, height: 970 });
  console.log('Opening login page...');
  await page.goto(LOGIN_PAGE);
  console.log(`my user: ${CREDS.pocket.username}`);
  console.log(`my pass: ${CREDS.pocket.password}`);
  await page.waitForTimeout(2 * 1000);
  await page.click(USERNAME_SELECTOR);
  await page.keyboard.type(CREDS.pocket.username);
  await page.click(PASSWORD_SELECTOR);
  await page.keyboard.type(CREDS.pocket.password);
  // await page.screenshot({ path: '../screenshots/login.png' });
  await page.click(LOGIN_BUTTON_SELECTOR);
  // if you HIT Captcha, adjust the wait time here
  await page.waitForTimeout(CREDS.browser.LOGIN_WAIT_TIME * 1000);
  console.log('Login sucessful...');
  //
  // await page.screenshot({ path: '../screenshots/afterlogin.png' });
  await page.close();
  return { browserState: browser };
}

module.exports.createbrowsersession = createbrowsersession;
