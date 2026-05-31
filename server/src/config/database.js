const { Sequelize } = require('sequelize');
const path = require('path');
const config = require('./index');

const dbDialect = process.env.DB_DIALECT || 'mysql';

let sequelize;

if (dbDialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../data/kuwanyubeiqi.db'),
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  });
} else {
  sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    logging: config.port === 3000 ? console.log : false,
    timezone: '+08:00',
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}

module.exports = sequelize;
