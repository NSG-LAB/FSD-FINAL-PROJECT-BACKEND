const { Sequelize } = require('sequelize');

const createSequelizeInstance = () => {
  if (process.env.MYSQL_URI) {
    return new Sequelize(process.env.MYSQL_URI, {
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false
    });
  }

  const database = process.env.MYSQL_DB || 'property_app';
  const username = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306;

  return new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  });
};

const sequelize = createSequelizeInstance();

module.exports = { sequelize };
