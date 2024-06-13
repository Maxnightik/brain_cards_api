import { createServer } from 'node:http';
import path from 'node:path';
import * as url from 'node:url';
import { writeFile } from './lib/write.js';
import { readFile } from './lib/read.js';
import { checkDB } from './lib/check.js';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
export const DB_CARD_URL = path.resolve(__dirname, 'db_card.json');
const DB_USER_URL = path.resolve(__dirname, 'db_user.json');
const PORT = process.env.PORT || 3024;
const URI_PREFIX = '/api';

const drainJson = req =>
  new Promise(resolve => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(JSON.parse(data));
    });
  });

class ApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}

const shuffle = array => {
  const shuffleArray = [...array];
  for (let i = shuffleArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffleArray[i], shuffleArray[j]] = [shuffleArray[j], shuffleArray[i]];
  }

  return shuffleArray;
};

const createCategory = async (data, rewrite = false) => {
  if (!(typeof data.title === 'string')) {
    throw new ApiError(400, { message: 'title обовязкова властивість' });
  }

  if (!Array.isArray(data.pairs)) {
    throw new ApiError(400, {
      message: 'pairs обовязково має бути масив',
    });
  }

  if (data.pairs?.length) {
    if (!Array.isArray(data.pairs[0])) {
      throw new ApiError(400, {
        message: 'pairs може містити тільки масив',
      });
    }
  }

  if (
    !data.pairs.every(
      item =>
        Array.isArray(item) &&
        typeof item[0] === 'string' &&
        typeof item[1] === 'string',
    )
  ) {
    throw new ApiError(400, {
      message: 'pairs повинен містити масиви з двома рядками',
    });
  }
  const categoryList = await readFile(DB_CARD_URL);
  let category = null;
  if (rewrite) {
    category = categoryList.find(({ id }) => id === data.id);
    if (!category) throw new ApiError(404, { message: 'Item Not Found' });
    Object.assign(category, data);
  } else {
    category = { title: data.title, pairs: data.pairs };
    category.id =
      category.id || `bc${Math.random().toString(36).substring(2, 12)}`;
    categoryList.push(category);
  }
  await writeFile(DB_CARD_URL, categoryList);
  return categoryList.map(({ id, title, pairs }) => ({
    id,
    title,
    length: pairs.length,
  }));
};

const editCategory = async (itemId, data) => createCategory(data, true);

const delCategory = async itemId => {
  const categoryList = await readFile(DB_CARD_URL);
  const newList = categoryList.filter(item => item.id !== itemId);
  await writeFile(DB_CARD_URL, newList);
  return newList.map(({ id, title, pairs }) => ({
    id,
    title,
    length: pairs.length,
  }));
};

const getCategoryList = async () => {
  const categoryList = await readFile(DB_CARD_URL);
  return categoryList.map(({ id, title, pairs }) => ({
    id,
    title,
    length: pairs.length,
  }));
};

const getCategory = async itemId => {
  const categoryList = await readFile(DB_CARD_URL);
  const category = categoryList.find(({ id }) => id === itemId);
  if (!category) throw new ApiError(404, { message: 'Item Not Found' });
  return category;
};

const initServer = () => {
  const server = createServer(async (req, res) => {
    // req - об'єкт з інформацією про запит,
    // res - об'єкт для управління відповіддю, що відправляється

    // цей заголовок відповіді вказує, що тіло відповіді буде в форматі JSON
    res.setHeader('Content-Type', 'application/json');

    // CORS заголовки відповіді для підтримки крос-доменних запитів із браузера
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS',
    );
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

   // запит із методом OPTIONS може надсилати браузер автоматично
 // для перевірки CORS заголовків
 // у цьому випадку достатньо відповісти з порожнім тілом та цими заголовками
    if (req.method === 'OPTIONS') {
      // end = закінчити формувати відповідь та надіслати її клієнту
      res.end();
      return;
    }

    // якщо URI не починається з потрібного префікса – можемо відразу віддати 404
    if (!req.url || !req.url.startsWith(URI_PREFIX)) {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not Found' }));
      return;
    }

    // прибираємо із запиту префікс URI, розбиваємо його на шлях та параметри
    const [uri, query] = req.url.substring(URI_PREFIX.length).split('?');
    const queryParams = {};
   // параметри можуть бути відсутніми взагалі або мати вигляд a=b&b=c
 // у другому випадку наповнюємо об'єкт queryParams { a: 'b', b: 'c' }
    if (query) {
      for (const piece of query.split('&')) {
        const [key, value] = piece.split('=');
        queryParams[key] = value ? decodeURIComponent(value) : '';
      }
    }
    // запит на обробку POST запиту
    try {
      if (
        req.method === 'POST' &&
        (req.url === `${URI_PREFIX}/category` ||
          req.url === `${URI_PREFIX}/category/`)
      ) {
        const category = await createCategory(await drainJson(req));
        res.statusCode = 201;
        res.setHeader('Access-Control-Expose-Headers', 'Location');
        res.setHeader('Location', `${URI_PREFIX}/category/${category.id}`);
        res.end(JSON.stringify(category));
        return;
      }

      if (
        req.method === 'PATCH' &&
        req.url.startsWith(`${URI_PREFIX}/category/`)
      ) {
        const index = uri.lastIndexOf('/');
        const id = uri.substring(index + 1);
        const category = await editCategory(id, await drainJson(req));
        res.statusCode = 201;
        res.setHeader('Access-Control-Expose-Headers', 'Location');
        res.setHeader('Location', `${URI_PREFIX}/category/${category.id}`);
        res.end(JSON.stringify(category));
        return;
      }

      if (
        req.method === 'DELETE' &&
        req.url.startsWith(`${URI_PREFIX}/category/`)
      ) {
        const index = uri.lastIndexOf('/');
        const id = uri.substring(index + 1);
        const data = await delCategory(id);
        res.statusCode = 200;
        res.setHeader('Access-Control-Expose-Headers', 'Location');
        res.end(JSON.stringify(data));
        return;
      }
    } catch (err) {
      console.log('err: ', err);
      // обробляємо згенеровану нами ж помилку
      if (err instanceof ApiError) {
        res.writeHead(err.statusCode);
        res.end(JSON.stringify(err.data));
      } else {
        // якщо щось пішло не так - пишемо про це в консоль
        // і повертаємо 500 помилку сервера
        res.statusCode = 500;
        res.end(JSON.stringify({ message: 'Server Error' }));
      }
    }

    // запит на обробку GET запиту
    try {
      if (req.method === 'GET') {
        if (
          req.url === `${URI_PREFIX}/category` ||
          req.url === `${URI_PREFIX}/category/`
        ) {
          const categories = await getCategoryList();
          res.end(JSON.stringify(categories));
          return;
        }

        if (req.url.startsWith(`${URI_PREFIX}/category/`)) {
          const index = uri.lastIndexOf('/');
          const id = uri.substring(index + 1);
          const category = await getCategory(id);
          res.end(JSON.stringify(category));
          return;
        }
      }
    } catch (err) {
      console.log('err: ', err);
      // обробляємо згенеровану нами ж помилку
      if (err instanceof ApiError) {
        res.writeHead(err.statusCode);
        res.end(JSON.stringify(err.data));
      } else {
        // якщо щось пішло не так - пишемо про це в консоль
        // і повертаємо 500 помилку сервера
        res.statusCode = 500;
        res.end(JSON.stringify({ message: 'Server Error' }));
      }
    }
  });

  // виводимо інструкцію, як тільки сервер запустився...
  server.on('listening', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(
        `Сервер Brain Cards запущений. Ви можете використовувати його за адресою http://localhost:${PORT}`,
      );
      console.log('Натисніть CTRL+C, щоб зупинити сервер');
     console.log('Доступні методи:');
     console.log('GET /api/category - отримати список категорій');
     console.log(
     'GET /api/category/{id} - отримати список пар за категорією',
     );
     console.log('DELETE /api/category/{id} - видалити категорію');
     console.log(
        `POST /api/category         - додати категорію
        {
          title: {},
          pairs[]?:[[string, string]]
        }
      `,
      );
      console.log(
        `PATCH /api/category/{id}   - оновити категорію
        {
          title: {},
          pairs[]?:[[string, string]]
        }
      `,
      );
    }
  });
  // ...і викликаємо запуск сервера на вказаному порту

  server.listen(PORT);
};

const initApp = async () => {
  checkDB(DB_CARD_URL);

  initServer();
};

initApp();
