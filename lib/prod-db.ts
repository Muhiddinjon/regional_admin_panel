import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.PROD_DB_HOST,
  port: 5432,
  database: process.env.PROD_DB_NAME,
  user: process.env.PROD_DB_USER,
  password: process.env.PROD_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 3,
})

export default pool
