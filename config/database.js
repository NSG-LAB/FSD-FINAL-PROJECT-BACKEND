const { URL } = require('url');
const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

const getConnectionConfig = () => {
  const logging = process.env.NODE_ENV === 'development' ? console.log : false;

  if (process.env.MYSQL_URI) {
    const url = new URL(process.env.MYSQL_URI);
    return {
      database: url.pathname.replace('/', '') || 'property_app',
      username: decodeURIComponent(url.username || 'root'),
      password: decodeURIComponent(url.password || ''),
      host: url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 3306,
      logging
    };
  }

  return {
    database: process.env.MYSQL_DB || process.env.MYSQLDATABASE || 'property_app',
    username: process.env.MYSQL_USER || process.env.MYSQLUSER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || '',
    host: process.env.MYSQL_HOST || process.env.MYSQLHOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306', 10),
    logging
  };
};

const createSequelizeInstance = () => {
  const config = getConnectionConfig();

  return new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: 'mysql',
    logging: config.logging
  });
};

const ensureDatabaseExists = async () => {
  const config = getConnectionConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.end();
};

const sequelize = createSequelizeInstance();

module.exports = { sequelize, ensureDatabaseExists, getConnectionConfig };
