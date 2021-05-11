// process.env.NODE_CONFIG_DIR = `../config`;
process.env.SUPPRESS_NO_CONFIG_WARNING = true;

const config = require('config');

const puppeteer = require('puppeteer');
const CREDS = require('../config/creds');

const database = config.get('mongoURIlocal');
const AzureTokensModel = require('../models/oauthtokens');

const { connect2db, closedb, save2db } = require('./mongoops');

const SIGNIN_SELECTOR = 'body > main > div > a';
const USERNAME_SELECTOR = 'input[name=loginfmt]';
const PASSWORD_SELECTOR = 'input[name=passwd]';
const SUBMIT_SELECTOR = 'input[type=submit]';
const STAY_CONNECTED_SELECTOR = '#idSIButton9';
const tokenServiceUrl = 'http://localhost:3000/gettoken';

function authenticate(url) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Initiating browser session...');
      const browser = await puppeteer.launch({
        headless: CREDS.browser.headless,
        ignoreHTTPSErrors: true,
        devtools: false,
        args: [
          '--disable-extensions',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--window-size=1024,768',
        ],
      });
      console.log(`loading home page URL ...`);
      const page = await browser.newPage();
      await page.goto(url);
      console.log(`inserting credentials ...`);
      await page.waitForTimeout(3 * 1000);
      await page.click(SIGNIN_SELECTOR);
      await page.waitForTimeout(5 * 1000);
      await page.click(USERNAME_SELECTOR);
      await page.keyboard.type(CREDS.azure.username);
      await page.click(SUBMIT_SELECTOR);
      console.log(`submiting login ...`);
      await page.waitForTimeout(5 * 1000);
      await page.click(PASSWORD_SELECTOR);
      await page.keyboard.type(CREDS.azure.password);
      await page.click(SUBMIT_SELECTOR);
      await page.waitForTimeout(3 * 1000);
      await page.click(STAY_CONNECTED_SELECTOR).catch(() => {
        console.log(
          'Error while trying to interact with STAY_CONNECTED_SELECTOR'
        );
      });
      await page.waitForTimeout(5 * 1000);
      await page.goto(url);
      await page.waitForTimeout(2 * 1000);
      const rawToken = await page.evaluate(
        () => document.querySelector('body').innerText
      );
      browser.close();
      console.log(`login sucessful!`);
      return resolve(rawToken);
    } catch (e) {
      return reject(e);
    }
  });
}

async function main() {
  const mongoUp = await connect2db(database);
  if (mongoUp) {
    try {
      const rawToken = await authenticate(tokenServiceUrl);
      await save2db(AzureTokensModel, JSON.parse(rawToken));
      console.log('Token saved sucessfully!');
    } catch {
      console.log(`Not able to get oauth tokens`);
    }
    closedb(database);
  }
}

main();
