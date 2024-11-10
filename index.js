// index.js

const knex = require('knex')(require('./knexfile'));
const { google } = require('googleapis');
const cron = require('node-cron');
const fs = require('fs');

// Google Sheets API setup
const auth = new google.auth.GoogleAuth({
    keyFile: './wildberries-441114-4316f0ae7ca5.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = '1nqMd0M2jQ3lGk5Y1XjebV16kyUhNW2wPaPu7oXy1d8g';

// Переменная для отслеживания индекса последней добавленной строки
let currentIndex = 5; // Начинаем с 5, так как первые 5 строк будут добавлены при запуске

// Функция для добавления строки в Google Sheets
async function appendToGoogleSheets(row) {
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1!A:D',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[row.id, row.name, row.price, row.price_change]],
            },
        });
        console.log(`Added row with ID: ${row.id}`);
    } catch (error) {
        console.error('Error appending data to Google Sheets:', error.message);
    }
}

// Функция для получения строки из PostgreSQL по индексу
async function fetchRowByIndex(index) {
    try {
        const row = await knex('cryptocurrencies').orderBy('id').offset(index).first();
        return row;
    } catch (error) {
        console.error('Error fetching data from PostgreSQL:', error.message);
        return null;
    }
}

// Функция для добавления нескольких строк при запуске
async function addInitialRows() {
    const rows = await knex('cryptocurrencies').orderBy('id').limit(5);
    if (rows.length > 0) {
        for (const row of rows) {
            await appendToGoogleSheets(row);
        }
        console.log('Initial 5 rows added to Google Sheets.');
    } else {
        console.log('No data found in PostgreSQL.');
    }
}

// Функция для добавления одной строки каждые 2 минуты
async function addNewRow() {
    const row = await fetchRowByIndex(currentIndex);
    if (row) {
        await appendToGoogleSheets(row);
        currentIndex += 1;
    } else {
        console.log('Reached end of data. Resetting index to 0.');
        currentIndex = 0;
    }
}

// Планировщик, который добавляет новую строку каждые 2 минуты
cron.schedule('*/2 * * * *', async () => {
    console.log('Adding a new row every 2 minutes:', new Date().toLocaleString());
    await addNewRow();
});

// Добавляем 5 строк при запуске приложения
(async () => {
    await addInitialRows();
    console.log('Service started. A new row will be added every 2 minutes.');
})();
