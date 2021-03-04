process.env.NODE_CONFIG_DIR = `../config`;

const config = require('config');
const CREDS = require('../config/creds');
//
const database = config.get('mongoURIlocal');
const ArticleModel = require('../models/pocketarticles');
//
const { connect2db, closedb, findDocs, save2db } = require('./mongoops');
const { createbrowsersession } = require('./navigation');

const cssArticles = 'article';

//
// Receives array with all article elements in a page, eliminate dupes then populates array (filteredArray) for later scraping those
async function getUrlArticlesForPage(page) {
  const filteredArray = [];
  const results = await page.evaluate(function(css) {
    const elArray = [];
    const items = document.querySelectorAll(css);
    items.forEach(function(article) {
      elArray.push(article.children[1].href);
    });
    return elArray;
  }, cssArticles);
  results.forEach(el => {
    console.log(`debug: ${el}`);
  });
  // filtering existing URLs
  console.log(`here I have ${results.length}`);
  for (const articleUrl of results) {
    const existingDocs = await findDocs(ArticleModel, { url: articleUrl });
    if (existingDocs.length < 1) {
      filteredArray.push(articleUrl);
      await save2db(ArticleModel, { url: articleUrl, dateOfEntry: Date.now() });
    }
  }
  // console.log(`returning ${filteredArray.length}`);
  return filteredArray;
}
//
// Scrapes pages for elements/articles then populates results array for later scraping articles individually
async function pagescraper(browser) {
  console.log('Opening home page...');
  const page = await browser.newPage();
  await page.goto('https://app.getpocket.com/');
  await page.waitFor(CREDS.browser.PAGELOAD_WAIT_TIME * 1000);
  // await page.screenshot({ path: '../screenshots/home.png' });
  console.log('Parsing the DOM ...');
  //
  let lastArticleUrl = null;
  let lastArticleUrlSfterScrolling = null;
  let results = [];
  let newResults = [];
  let pageCounter = 1;
  let noNewArticlesCounter = 0;
  const maxBlankPageReturns = 5;
  let lastPageElementHandler = await page.evaluateHandle(css => {
    const elArray = document.querySelectorAll(css);
    return elArray[elArray.length - 1];
  }, cssArticles);
  //
  do {
    // updating article array
    console.log(`Getting articles for the page ${pageCounter}...`);
    newResults = await getUrlArticlesForPage(page);
    results = results.concat(newResults);
    // mapping latest URL in the article array before scrolling
    lastArticleUrl = await page.evaluate(el => {
      console.log(`teste lastArticleUrl: ${el.children[1].href}`);
      const lastElementUrl = el.children[1].href;
      return lastElementUrl;
    }, lastPageElementHandler);
    // scrolling based on the current latest item obtained before scrolling takes place
    console.log(`Scrolling to the next page ...`);
    await page.evaluate(lastElement => {
      // lastElement.scrollIntoViewIfNeeded();
      lastElement.scrollIntoView({
        behavior: 'auto',
        block: 'end',
        inline: 'end',
      });
    }, lastPageElementHandler);
    // fine tunning to force srolling and new article refresh
    await page.evaluate(() => {
      window.scrollBy(0, 200);
    });
    // wait timeout in order for scrolling takes place and elements change
    await page.waitFor(CREDS.browser.PAGELOAD_WAIT_TIME * 1000);
    pageCounter += 1;
    if (newResults.length === 0) {
      noNewArticlesCounter += 1;
    } else {
      noNewArticlesCounter = 0;
    }
    // console.log(`noNewArticlesCounter: ${noNewArticlesCounter}`);
    // After scrolling occurs a new page handler is required to updated article elements
    lastPageElementHandler = await page.evaluateHandle(css => {
      const elArray = document.querySelectorAll(css);
      return elArray[elArray.length - 1];
    }, cssArticles);
    //
    lastArticleUrlSfterScrolling = await page.evaluate(el => {
      console.log(`lastArticleUrlSfterScrolling: ${el.children[1].href}`);
      const lastElementUrl = el.children[1].href;
      return lastElementUrl;
    }, lastPageElementHandler);
    // console.log(`debug - lastArticleUrl: ${lastArticleUrl}`);
    // console.log(`debug - noNewArticlesCounter: ${noNewArticlesCounter}`);
  } while (
    noNewArticlesCounter < maxBlankPageReturns &&
    lastArticleUrl !== lastArticleUrlSfterScrolling
  );
  await lastPageElementHandler.dispose();
  browser.close();
  console.log(`I've found ${results.length} articles`);
  // return results;
}
// Main function
async function main() {
  const mongoUp = await connect2db(database);
  if (mongoUp) {
    const webSession = await createbrowsersession();
    await pagescraper(webSession.browserState);
    // const articleArray = await articlescraper(webSession.browserState);
    // console.log(`We have processed ${articleArray.length} articles`);
    closedb(database);
  }
}

main();
