// process.env.NODE_CONFIG_DIR = `../config`;
process.env.SUPPRESS_NO_CONFIG_WARNING = true;

const config = require('config');
const CREDS = require('../config/creds');

//
const database = config.get('mongoURIlocal');
const { createbrowsersession } = require('./navigation');
const {
  connect2db,
  closedb,
  findDocs,
  save2db,
  findAndUpdate,
} = require('./mongoops');
const ArticleModel = require('../models/pocketarticles');
const DBLogModel = require('../models/operations');
// these articles shall not pass

// Individually scrapes articles
async function articlescraper(browser, articles) {
  // bypass url
  const bypassMarkers = new RegExp('redirect');
  const supportedDomainList = new RegExp(CREDS.scraper.supportedDomains);
  const cssArticleTags =
    '#__next > main > article > header > div ~ div > div > ul > li';
  const cssMainArticle = 'article';
  const maxScrapeErrors = 5;
  const resultArray = [];
  let errorsCounter = 0;
  let itemTags;
  //
  for (let i = 0; i < articles.length; i += 1) {
    // console.log(articles[i].url)
    if (!supportedDomainList.test(articles[i].url) || bypassMarkers.test(articles[i].url)) {
      // console.log(`${articles[i].url} bypassed`);
      continue;
    }
    const randomWait = [
      Math.floor(Math.random() * CREDS.browser.ANTI_RATE_LIMIT_RANDOM_MAX_WAIT),
    ];
    const page = await browser.newPage();
    try {
      await page.goto(articles[i].url);
    } catch {
      console.log(`Error while trying to open URL - skipping ...`);
      page.close();
      continue;
    }
    console.log(`sleeping for ${randomWait} sec ...`);
    await page.waitForTimeout(randomWait * 1000);
    console.log(`Scraping: ${articles[i].url}`);
    // await page.screenshot({ path: '../screenshots/article.png' });
    const articleHandler = await page.evaluateHandle(
      css => document.querySelector(css),
      cssMainArticle
    );
    try {
      itemTags = await page.$$eval(cssArticleTags, liNodes =>
        liNodes.map(node => node.textContent)
      );
    } catch (err) {
      itemTags = [];
      console.log(`${err}`);
    }
    try {
      resultArray[i] = await page.evaluate(
        (handler, articleTags) => {
          const title = handler.querySelector('h1').textContent;
          const tags = articleTags;
          const scraped = true;
          const body = handler.querySelector('article').outerHTML;
          return { title, tags, body, scraped };
        },
        articleHandler,
        itemTags
      );
    } catch (err) {
      console.log(`Alert! Got an error while scraping article: ${err}`);
      errorsCounter += 1;

      save2db(DBLogModel, {
        url: articles[i].url,
        statusMsg: err,
        operationType: 'scraping error',
      });
    }
    if (resultArray[i]) {
      // reset error counter - Only used for consecutive scraping errors
      errorsCounter = 0;
      await findAndUpdate(
        ArticleModel,
        { url: articles[i].url },
        resultArray[i]
      );
    }
    await articleHandler.dispose();
    page.close();
    // console.log(`Error counter: ${errorsCounter}`);
    if (errorsCounter > maxScrapeErrors) {
      console.log(
        `Max scraper errors triggered - probably the rate limit threshold was hit! - please check`
      );
      process.exit(1);
    }
  }
  browser.close();
  return resultArray;
}

async function main() {
  const mongoUp = await connect2db(database);
  if (mongoUp) {
    const documents = await findDocs(
      ArticleModel,
      {
        sync: false,
        scraped: false,
      },
      { dateOfEntry: -1 }
    );
    if (documents) {
      const webSession = await createbrowsersession();
      const articlesScraped = await articlescraper(
        webSession.browserState,
        documents
      );
      console.log(`Articles scraped: ${articlesScraped.length}`);
    }
    closedb(database);
  }
}

main();
