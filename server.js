const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

// Включаем поддержку JSON в body
app.use(express.json());
// Включаем CORS для доступа из браузера
app.use(cors());

// --- Подключение к PostgreSQL ---
// Railway автоматически устанавливает переменную DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Важно для Railway
    rejectUnauthorized: false
  }
});

// --- Маршруты API ---

// GET /api/routes - получить все маршруты
app.get('/api/routes', async (req, res) => {
  try {
    // Запрос к таблице routes, преобразование геометрии в GeoJSON
    const result = await pool.query(`
      SELECT
        id,
        ST_AsGeoJSON(geom) AS geometry,
        weight,
        editor_name,
        editor_date_time
      FROM routes;
    `);

    const features = result.rows.map(row => ({
      type: "Feature",
      properties: {
        id: row.id,
        weight: row.weight,
        editor_name: row.editor_name,
        editor_date_time: row.editor_date_time,
      },
      geometry: JSON.parse(row.geometry) // ST_AsGeoJSON возвращает строку
    }));

    const geojson = {
      type: "FeatureCollection",
      features: features
    };

    res.json(geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки маршрутов' });
  }
});

// POST /api/routes/update - обновить вес маршрута
app.post('/api/routes/update', async (req, res) => {
  const { feature_id, weight, editor_name, editor_date_time } = req.body;

  if (!feature_id || weight === undefined || !editor_name || !editor_date_time) {
    return res.status(400).json({ error: 'Отсутствуют необходимые поля' });
  }

  try {
    const result = await pool.query(
      `UPDATE routes
       SET weight = $1, editor_name = $2, editor_date_time = $3
       WHERE id = $4
       RETURNING id;`,
      [weight, editor_name, editor_date_time, feature_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Маршрут не найден' });
    }

    res.json({ success: true, updated_id: feature_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления маршрута' });
  }
});

// --- Запуск сервера ---
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
