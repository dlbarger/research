var Loader = require('@sei-atl/load-sql');
var mssql = require('mssql');
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = process.env.LOGGER_LEVEL || 'error';

/**
 * @description Abstract base class for handling database interactions
 */
class MssqlDao {
  
  constructor(options) {
    if(options) {
      this.dbConfig = options.dbConfig;
    } 
    this.sqlDir = this.getSqlDir();
    this.sqlDir = this.sqlDir.endsWith('/') ? this.sqlDir : `${this.sqlDir}/`; 
    this.loadSql = new Loader(this.sqlDir);
  }

  openConnection() {
    return new mssql.ConnectionPool(this.dbConfig).connect();
  }

  getConnection(options = {}) {
    return new Promise((succeed, fail) => {
      let pool = options.useConnection;
      if(pool) {
        succeed(pool);
      } else {
        this.openConnection()
        .then(pool => {
          succeed(pool);
        }, fail).catch(fail);
      }
    });
  }

  beginTransaction(pool, options = {}) {
    options = Object.assign({
      isolationLevel: mssql.ISOLATION_LEVEL.READ_COMMITTED
    }, options);
    return new Promise((succeed, fail) => {
      ((typeof pool === 'undefined' || pool === null) ? this.getConnection(options) : Promise.resolve(pool))
      .then(pool => {
        const tx = new mssql.Transaction(pool);
        tx.begin(options.isolationLevel, err => {
          tx.rolledBack  = false;
          tx.on('rollback', aborted => {
            tx.aborted = aborted;
            tx.rolledBack = true;
          });
          if(err) {
            logger.error(err);
            fail(err);
          } else {
            succeed(tx);
          }
        });   
      });
    });
  }

  maybeCloseConnection(pool = {}, options = {}) {
    if(options.useConnection === undefined || options.useConnection === null) {
      pool.close();
    };
  }

  async commit(tx = {}) {
    return tx.commit(err => {
      if (err) {
        if(!tx.rolledBack) {
          tx.rollback(err2 => {
            if(err2) {
              throw err2;
            } else {
              throw err;
            }
          })
        } else {
          throw err;
        }
      }
      //commit automatically releases the connection back into the pool, no need to close
    });
  }

  closeConnection(pool) {
    pool.close();
  }

  getSqlDir() {
    throw new Error('Initialization Error: must implement getSqlDir');
  }

  rollback(tx) {
    return new Promise((succeed, fail) => {
      if (tx.rolledBack) {
        succeed();
      } else {
        tx.rollback(err => {
          if(err) {
            logger.error('ERROR: ', err);
            fail(err);
          } else {
            succeed();
          }
        });
      }
    })
  }

  queryOne(options) {
    logger.trace('entered MssqlDao.queryOne');
    return new Promise((succeed, fail) => {
      this.query(options)
      .then(result => {
        if(result) {
          succeed(result.data && Array.isArray(result.data) ? result.data[0] : result[0]);
        } else {
          succeed(null);
        }
      }, err => {
        logger.error(err);
        fail(err);
      }).catch(err => {
        logger.error(err);
        fail(err);
      });
    });
  }

  //@TODO: support filtering and matching in mssql
  query(options = {}) {
    logger.trace('entered MssqlDao.query');
    options = Object.assign({}, {
      useConnection: null,
      useTransaction: null,
      dbType: 'mssql',
      sql: null,
      labelValueSql: null,
      countSql: null,
      params: null,
      resultSetExtractor: null,
      rowMapper: null,
      format: 'json',
      formats: {
        json: {
          sql: options.sql,
          resultSetExtractor: options.resultSetExtractor,
          rowMapper: options.rowMapper
        },
        'label-value': {
          sql: options.labelValueSql,
          resultSetExtractor: options.resultSetExtractor,
          rowMapper: options.rowMapper
        }
      }
    }, options);

    options = Object.assign({}, options, options.formats[options.format]);
    logger.trace('options', options);
    return new Promise((succeed, fail) => {
      let sql1, params1;
      this.loadSql.load(options.sql, options)
      .then(({sql, params}) => {
        sql1 = sql;
        params1 = params;
        return this.getConnection(options);
      })
      .then(pool => {
        let request = options.useTransaction ? options.useTransaction.request() : pool.request();
        if(options.params) {
          if(!Array.isArray(options.params)) {
            options.params = [options.params];
          }
          options.params.forEach(param => {
            let keys = Object.keys(param);
            if(keys && keys.length > 0) {
              let k = keys[0];
              if(typeof param[k] === 'object') {
                request.input(k, mssql[param[k].type], param[k].value);
              } else {
                request.input(k, param[k]);
              }
              
              logger.trace('added input parameter to main query:', k, param[k]);
            }
          });
        }
        let result;
        if(params1) {
          params1.forEach(param => {
            let keys = Object.keys(param);
            if(keys && keys.length > 0) {
              let k = keys[0];
              if(typeof param[k] === 'object') {
                request.input(k, mssql[param[k].type], param[k].value);
              } else {
                request.input(k, param[k]);
              }
              logger.trace('added input parameter to main query:', k, param[k]);
            }
          });
          logger.trace('sql: ', sql1);
          request.query(sql1)
          .then(r => {
            result = r;
            return this.loadSql.load(options.countSql);
          })
          .then(({sql}) => {
            let request2 = options.useTransaction ? options.useTransaction.request() : pool.request();
            if(options.params) {
              options.params.forEach(param => {
                let keys = Object.keys(param);
                if(keys && keys.length > 0) {
                  let k = keys[0];
                  if(typeof param[k] === 'object') {
                    request2.input(k, mssql[param[k].type], param[k].value);
                  } else {
                    request2.input(k, param[k]);
                  }
                  logger.trace('added input parameter to count query:', k, param[k]);
                }
              });
            }
            return request2.query(sql);
          })
          .then(result2 => {
            this.maybeCloseConnection(pool, options);
            let rows = result.recordset;
            let rows2 = result2.recordset;

            if(options.resultSetExtractor) {
              rows = options.resultSetExtractor.extractData(rows);
            } else if (options.rowMapper) {
              rows = rows.map(row => options.rowMapper.mapRow(row));
            }

            var data = {
              pages: Math.ceil(rows2[0].count / params1.find(p => p._size)._size),
              data: rows
            };
            succeed(data);
          }).catch(err => {
            logger.error('ERROR: ', err);
            this.maybeCloseConnection(pool, options);
            fail(err);
          });
        } else {
          logger.trace('sql: ', sql1);
          request.query(sql1)
          .then(r => {
            result = r;
            this.maybeCloseConnection(pool, options);
            let rows = result.recordset;
            if(options.resultSetExtractor) {
              rows = options.resultSetExtractor.extractData(rows);
            } else if (options.rowMapper) {
              rows = rows.map(row => options.rowMapper.mapRow(row));
            }
            succeed(rows);
          }).catch(err => {
            logger.error('ERROR: ', err);
            this.maybeCloseConnection(pool, options);
            fail(err);
          });
        }
      }).catch(err => {
        logger.error('ERROR: ', err);
        this.maybeCloseConnection(pool, options);
        fail(err);
      });
    });    
  } 
  
  async getAll(options = {}) {
    logger.trace('entered MssqlDao.getAll', options);
    options = Object.assign({
      sql: 'getAll',
      countSql: 'getAllCount'
    }, options);
    return this.query(options);
  }

  async getAllCount(options = {}) {
    logger.trace('entered MssqlDao.getAllCount', options);
    options = Object.assign({
      sql: 'getAllCount'
    }, options);
    return this.query(options);
  }  

  async getById(options = {}) {
    logger.trace('entered MssqlDao.getById', options);
    options = Object.assign({
      sql: 'getById'
    }, options);
    return this.queryOne(options);
  }  

  async insert(item, options = {}) {
    logger.trace('entered MssqlDao.insert', options);
    if(item) {
      options = Object.assign({
        sql: 'insert'
      }, options);
      return this.query(options);
    } else {
      throw new Error('An object to insert is required, but none was provided.');
    }
  }

  async insertAll(items, options = {}) {
    Object.assign({}, {
      useConnection: null,
      useTransaction: null,
      txIsolationLevel: mssql.ISOLATION_LEVEL.READ_COMMITTED,
    }, options);
    
    let con = await this.getConnection(options);
    let tx = options.useTransaction || await this.beginTransaction(con, { isolationLevel: options.txIsolationLevel });
    let errors = [];
    for(const item of items) {
      try {
        await this.insert(item, {useConnection: con, useTransaction: tx});
      } catch (err) {
        logger.error(err);
        if(tx) {
          this.rollback(tx, con, options);
          return {
            errors: [err]
          }
        }
        errors.push(err);
      }
    }
    if(tx) {
      this.commit(tx);
    } else {
      this.maybeCloseConnection(con, options);
    }
    return {
      errors: errors
    }
  }
}

module.exports = MssqlDao;