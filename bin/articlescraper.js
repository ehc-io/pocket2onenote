process.env.NODE_CONFIG_DIR = `../config`;
const config = require('config');
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
  const bypassList = /redirect|youtube|twitter|pdf/g;
  const cssArticleTags = '#root > div > div > div > div > header > div > div a';
  const cssMainArticle = 'header';
  const maxScrapeErrors = 5;
  const resultArray = [];
  let errorsCounter = 0;
  let itemTags;
  //
  for (let i = 0; i < articles.length; i += 1) {
    if (articles[i].url.search(bypassList) !== -1) {
      console.log(`${articles[i].url} bypassed`);
      continue;
    }
    const randomWait = [Math.floor(Math.random() * 15)];
    const page = await browser.newPage();
    try {
      await page.goto(articles[i].url);
    } catch {
      console.log(`Error while trying to open URL - skipping ...`);
      page.close();
      continue;
    }
    console.log(`sleeping for ${randomWait} sec ...`);
    await page.waitFor(randomWait * 1000);
    console.log(`Scraping: ${articles[i].url}`);
    await page.screenshot({ path: '../screenshots/article.png' });
    const articleHandler = await page.evaluateHandle(
      css => document.querySelector(css),
      cssMainArticle
    );
    try {
      itemTags = await page.$$eval(cssArticleTags, nodes =>
        nodes.map(node => node.textContent)
      );
    } catch (err) {
      itemTags = [];
      console.log(`${err}`);
    }
    try {
      resultArray[i] = await page.evaluate(
        (handler, articleTags) => {
          const title = handler.children[0].textContent;
          const tags = articleTags;
          const body = handler.nextElementSibling.outerHTML;
          const scraped = true;
          return { title, tags, body, scraped };
        },
        articleHandler,
        itemTags
      );
    } catch (err) {
      console.log(`Alert! Got an error while scraping article`);
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
      console.log(`Articles scraped: ${articlesScraped}`);
    }
    closedb(database);
  }
}

main();
