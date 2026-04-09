require('dotenv').config();
const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const bodyParser = require('body-parser');

try {
  oracledb.initOracleClient(); 
} catch (err) {
  console.error("Failed to initialize Oracle Client:", err);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  connectString: process.env.DB_CONNECTION_STRING
};

async function runQuery(sql, binds = [], autoCommit = true) {
  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);
    const result = await conn.execute(sql, binds, { 
        autoCommit, 
        outFormat: oracledb.OUT_FORMAT_OBJECT 
    });
    return result;
  } finally {
    if (conn) await conn.close();
  }
}

const databaseTables = [
  { name: 'CUSTOMER', endpoint: 'customers', pk: 'CUSTOMERID' },
  { name: 'CUSTOMER_PHONE', endpoint: 'customer_phones', pk: 'PHONE' },
  { name: 'CATEGORY', endpoint: 'categories', pk: 'CATEGORYID' },
  { name: 'SUPPLIER', endpoint: 'suppliers', pk: 'SUPPLIERID' },
  { name: 'PRODUCT', endpoint: 'products', pk: 'PRODUCTID' },
  { name: 'ORDERS', endpoint: 'orders', pk: 'ORDERID' },
  { name: 'ORDER_ITEM', endpoint: 'order_items', pk: 'SEQUENCEID' },
  { name: 'PAYMENT', endpoint: 'payments', pk: 'PAYMENTID' },
  { name: 'SHIPMENT', endpoint: 'shipments', pk: 'SHIPMENTID' },
  { name: 'REVIEW', endpoint: 'reviews', pk: 'REVIEWID' },
  { name: 'SAVES', endpoint: 'saves', pk: 'PRODUCTID' },
  { name: 'SUPPLIED_BY', endpoint: 'supplied_by', pk: 'PRODUCTID' }
];

databaseTables.forEach(table => {
  
  app.get(`/api/${table.endpoint}`, async (req, res) => {
    try { 
      res.json((await runQuery(`SELECT * FROM ${table.name} ORDER BY ${table.pk}`)).rows); 
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post(`/api/${table.endpoint}`, async (req, res) => {
    try {
      const values = Object.values(req.body);
      const placeholders = values.map((_, i) => `:${i + 1}`).join(', '); 
      await runQuery(`INSERT INTO ${table.name} VALUES (${placeholders})`, values);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put(`/api/${table.endpoint}/:id`, async (req, res) => {
    try {
      const data = req.body;
      // Get all fields except the Primary Key
      const fieldsToUpdate = Object.keys(data).filter(key => key !== table.pk);
      const setString = fieldsToUpdate.map((key, index) => `${key} = :${index + 1}`).join(', ');
      
      const values = fieldsToUpdate.map(key => data[key]);
      values.push(req.params.id); // Add the ID at the end for the WHERE clause

      const sql = `UPDATE ${table.name} SET ${setString} WHERE ${table.pk} = :${values.length}`;
      await runQuery(sql, values);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete(`/api/${table.endpoint}/:id`, async (req, res) => {
    try {
      await runQuery(`DELETE FROM ${table.name} WHERE ${table.pk} = :1`, [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
});

app.listen(3000, () => console.log(`Master API Gateway actively listening on port 3000`));