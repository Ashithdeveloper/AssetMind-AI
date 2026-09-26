import axios from 'axios';
import * as cheerio from 'cheerio';

function cleanNumber(val: string): number | null {
  if (!val) return null;
  const clean = val.replace(/,/g, '').replace(/₹/g, '').replace(/%/g, '').replace(/Cr\./i, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parseTable($: cheerio.CheerioAPI, selector: string) {
  const table = $(selector);
  if (!table.length) return { headers: [], rows: [] };

  const headers: string[] = [];
  table.find('thead th').each((_, th) => {
    headers.push($(th).text().trim());
  });

  const rows: Array<{ name: string; values: (number | null)[]; rawValues: string[] }> = [];
  table.find('tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (!tds.length) return;
    const name = $(tds[0]).text().replace(/\+/g, '').trim();
    if (!name) return;

    const values: (number | null)[] = [];
    const rawValues: string[] = [];
    tds.slice(1).each((_, td) => {
      const text = $(td).text().trim();
      rawValues.push(text);
      values.push(cleanNumber(text));
    });

    rows.push({ name, values, rawValues });
  });

  return { headers, rows };
}

async function testFull() {
  const url = 'https://www.screener.in/company/RELIANCE/consolidated/';
  const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
  const $ = cheerio.load(res.data);

  // 1. Company Name
  const companyName = $('h1').first().text().trim();

  // 2. BSE / NSE / Website
  let bseCode = '';
  let nseSymbol = '';
  let website = '';

  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = $(a).text().trim();
    const bseMatch = href.match(/bseindia\.com\/.*\/(\d{5,7})\/?/i);
    if (bseMatch) bseCode = bseMatch[1];

    const nseMatch = href.match(/nseindia\.com\/.*symbol=([^&]+)/i);
    if (nseMatch) nseSymbol = decodeURIComponent(nseMatch[1]);

    if (!website && ($(a).find('i.icon-link').length > 0 || $(a).find('i.icon-globe').length > 0 || (href.startsWith('http') && !href.includes('screener.in') && !href.includes('bseindia') && !href.includes('nseindia')))) {
      website = href;
    }
  });

  // 3. Peers: Sector / Industry
  let sector = '';
  let industry = '';
  $('#peers a[href*="/explore/"]').each((i, el) => {
    if (i === 0) sector = $(el).text().trim();
    if (i === 1) industry = $(el).text().trim();
  });

  // 4. Description
  const description = $('#about .sub, .about p, .company-profile p').first().text().trim();

  // 5. Top Ratios
  const topRatios: Record<string, number | null> = {};
  $('#top-ratios li').each((_, el) => {
    const label = $(el).find('.name').text().trim();
    const valText = $(el).find('.value').text().trim();
    topRatios[label] = cleanNumber(valText);
  });

  // 6. Statements
  const quarters = parseTable($, '#quarters table');
  const profitLoss = parseTable($, '#profit-loss table');
  const balanceSheet = parseTable($, '#balance-sheet table');
  const cashFlow = parseTable($, '#cash-flow table');

  console.log('=== PARSED DATA FOR RELIANCE ===');
  console.log('Company Name:', companyName);
  console.log('NSE Symbol:', nseSymbol);
  console.log('BSE Code:', bseCode);
  console.log('Website:', website);
  console.log('Sector:', sector, '| Industry:', industry);
  console.log('Description:', description.substring(0, 100) + '...');
  console.log('Top Ratios:', topRatios);
  console.log('Quarters: headers =', quarters.headers.slice(0, 5), 'rows count =', quarters.rows.length);
  console.log('P&L: headers =', profitLoss.headers.slice(0, 5), 'rows count =', profitLoss.rows.length);
  console.log('Balance Sheet: rows count =', balanceSheet.rows.length);
  console.log('Cash Flow: rows count =', cashFlow.rows.length);
}

testFull().catch(console.error);
