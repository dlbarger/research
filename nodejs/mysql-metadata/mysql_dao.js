let { Dao } = require('entity-common');
let { EmployeeDao } = require('employee-service');
let { EmailService } = require('email-service');
let FitnessIndexSqlMapper = require('./mapper/FitnessIndexSqlMapper');
let FitnessIndexSnapshotSqlMapper = require('./mapper/FitnessIndexSnapshotSqlMapper');
let UniqueSnapshotValuesSqlMapper = require('./mapper/UniqueSnapshotValuesSqlMapper');
let ScoresSqlMapper = require('./mapper/ScoresSqlMapper');
let FlattenValueRowMapper = require('./mapper/FlattenValueRowMapper');
let RankingRowMapper = require('./mapper/RankingRowMapper');
let FitnessIndexCalculator = require('calc-index');
let changeCase = require('change-case');
let moment = require('moment');
var Loader = require('@sei-atl/load-sql');
let loadSql = new Loader(__dirname + '/sql/');
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = process.env.LOGGER_LEVEL || 'error';

let getUsersHavingRole = (options) => {
  let employeeDao = new EmployeeDao(options);
  return employeeDao.getAllActiveHavingRole(process.env.SNAPSHOT_CHANGE_NOTIFY_ROLE, options);
}

sendEmailForDifferences = (mfi, snapShotDifferences, options = {}) => {
  let { differences, modifiedBy } = snapShotDifferences;
  return new Promise((f,r) => {
    getUsersHavingRole({useConnection: options.useConnection})
    .then(admins => {
      if(!admins || admins.length === 0) {
        f("No emails found with that role!");
      } else {
        let body = differences.reduce((s,difference) => {
          return s+`<b>${changeCase.titleCase(difference.field)}:</b><br/>From: ${this.normalizeValue(difference.previous)}<br/>To: ${this.normalizeValue(difference.new)}<br/><br/>`;
        },`The ${mfi.snapshotCreatedOn} snapshot for ${mfi.manufacturerName} has been modified by ${modifiedBy.firstName+" "+modifiedBy.lastName}.<br/><br/>\
        The following fields were changed:<br/><br/>`);
    
        let email = {
          to: admins.map(admin => admin.email).join(";"),
          subject: "A Fitness Index Snapshot Was Modified",
          from: 'noreply.tis@coca-cola.com',
          body: body
        };
        let rawEmail = EmailService.buildRawEmail(email);
        EmailService.sendRawEmail(rawEmail, (err,result) => {
          if(err) r(err);
          else f(result);
        });
      }
    })
    .catch(r);
  });
}

class FitnessIndexDao extends Dao {

  /**
   * @description Tell Dao where the sql files are kept
   *
   * @return {String} dir
   */
  getSqlDir() {
    return __dirname + '/sql/';
  }

  /**
   * Create a new fitness index
   **/
  insert (fitnessIndex = {}, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'insert'
    }, options);
    let fitnessIndexSqlMapper = new FitnessIndexSqlMapper();
    fitnessIndex.statusId = fitnessIndex.statusId || 1;
    options.params = fitnessIndexSqlMapper.map(fitnessIndex);
    options.params.created_by = fitnessIndex.createdBy || 'guest';
    options.params.created_on = fitnessIndex.createdOn || new Date();
    options.params.modified_by = fitnessIndex.modifiedBy || 'guest';
    options.params.modified_on = new Date();
    return this.query(options);
  }

  normalizeValue(val) {
    if(typeof (val || {}).getMonth === "function") {
      return moment(val).format("MM/DD/YYYY");
    }
    return val;
  }

  getSnapShotDifferences(prevMfi, modifiedBy, options) {
    return new Promise((f,r) => {
      this.getSnapshotsByIdDate(prevMfi.id, prevMfi.snapshotCreatedOn, {useConnection: options.useConnection})
      .then(mfi => {
        let differences = Object.keys(prevMfi).reduce((s,key) => {

          if(this.normalizeValue(prevMfi[key]) !== this.normalizeValue(mfi[key])) {
            s.push({
              field: key,
              previous: prevMfi[key],
              new: mfi[key]
            });
          }
          return s;
        },[]);
        f({ differences, modifiedBy });
      })
      .catch(r);
    });
  }

 /**
   * Update an existing fitness index snapshot
   **/
  updateSnapshot (snapshot, options) {
    logger.trace('Entered FitnessIndexDao.updateSnapshot');
    logger.trace('snapshot: ', snapshot);
    let fitnessIndexSnapshotSqlMapper = new FitnessIndexSnapshotSqlMapper();
    options = Object.assign({}, {
      useConnection: null,
      sql: 'snapshots/update',
      params: [fitnessIndexSnapshotSqlMapper.map(snapshot), snapshot.snapshotId]
    }, options);

    logger.trace('options: ', options);
    return new Promise((succeed, fail) => {
      let prevMfi;
      let con;
      this.getConnection(options)
      .then(connection => {
        con = connection;
        return this.getSnapshotsByIdDate(snapshot.id, snapshot.snapshotCreatedOn, {useConnection: con})
      }).then(result => {
        prevMfi = result;
        logger.trace('prevMfi: ', prevMfi);

        let options1 = Object.assign({}, { useConnection: con}, options);
        logger.trace('options1: ', options1);

        return this.query(options1);
      }).then(() => {
        if(prevMfi) {
          return this.getSnapShotDifferences(prevMfi, snapshot.modifiedBy, {useConnection: con})
        } else {
          return {differences: [], modifiedBy: {}};
        }
      }).then(differences => {
        return sendEmailForDifferences(snapshot, differences, {useConnection: con});
      }).then(result => {
        this.maybeCloseConnection(con, options);
        succeed({
          resp: result,
          mfi: snapshot
        });
      })
      .catch(e => {
        this.maybeCloseConnection(con, options);
        fail(e);
      });
    });
  }

  updateScores(fitnessIndex, options) {
    let scoresSqlMapper = new ScoresSqlMapper();
    options = Object.assign({}, {
      useConnection: null,
      sql: 'update',
      params: [scoresSqlMapper.map(fitnessIndex), fitnessIndex.id]
    }, options);
    return this.query(options);
  }  

  /**
   * Update an existing fitness index
   **/
  update (fitnessIndex, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'update'
    }, options);
    return new Promise((succeed, fail) => {
      let con;
      this.getConnection(options)
      .then(connection => {
        con = connection;
        return this.beginTransaction(con);  
      })
      .then(() => {
        //update
        let fitnessIndexSqlMapper = new FitnessIndexSqlMapper();
        let fi = fitnessIndexSqlMapper.map(fitnessIndex)
        fi.modified_by = fitnessIndex.modifiedBy || 'guest';
        fi.modified_on = new Date();
        options.params = [fi, fitnessIndex.id];
        return this.query(options);
      })
      .then(() => {
        return this.getRankingById(fitnessIndex.id, {useConnection: con});
      })        
      .then(result => {
        fitnessIndex.ranking = result.ranking;
        return this.updateJoinTables(fitnessIndex, {useConnection: con});
      }).then(() => {
        this.tryCommitAndMaybeCloseConnection(con, options);
        succeed({mfi: fitnessIndex});
      }, err => {
        rollback(err,() => { fail(err) }, con, options);
      }).catch(err => {
        rollback(err,() => { fail(err) }, con, options);
      });
    });
  }

  /*
   * Get distinct values in the snapshot table based on the given field
   */
  getUniqueSnapshotValues (field, options) {
    let uniqueSnapshotValuesSqlMapper = new UniqueSnapshotValuesSqlMapper();
    let col = uniqueSnapshotValuesSqlMapper.map(field);
    options = Object.assign({}, {
      useConnection: null,
      sql: 'snapshots/distinctValues',
      rowMapper: new FlattenValueRowMapper(),
      params: [col, col]
    }, options);
    return this.query(options);
  }

  /*
   * Get all fitness index snapshot dates by id
   */
  getSnapshotDatesById (id, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'snapshots/getCreatedOnById',
      params: id
    }, options);
    return this.query(options);
  }

  getSnapshotsByIdDate(id, date, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'snapshots/getByIdDate',
      params: [date, date, date, id]
    }, options);
    return new Promise((succeed, fail) => {
      let result, con;
      this.getConnection(options)
      .then(connection => {
        con = connection;
        let options1 = Object.assign({
          useConnection: con
        }, options);
        return this.queryOne(options1);
      })
      .then(result1 => {
        result = result1;
        let options2 = Object.assign({
          useConnection: con
        }, options, {
          sql: 'snapshots/getSnapshotRankingByIdDate',
          params: [date, id]
        });
        return this.queryOne(options2);
      })
      .then(result2 => {
        this.maybeCloseConnection(con, options);
        if(result) {
          try {
            result.ranking = parseInt(result2.rank, 10);
          } catch (err) {
            result.ranking = result2.rank;
          }
        }
        succeed(result);
      }, err => {
        this.maybeCloseConnection(con, options);
        logger.error(err);
        fail(err);
      }).catch(err => {
        this.maybeCloseConnection(con, options);
        logger.error(err);
        fail(err);
      })
    });
  }

  deleteById (id, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'deleteById',
      params: id
    }, options);
    return this.query(options);
  }

  /**
   * Archive an existing fitness index
   **/
  archive (id, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'update',
      params: [{
        fitness_index_status_id: 2,
        modified_by: 'system',
        modified_on: new Date()
      }, id]
    }, options);
    return this.query(options);
  }

  /**
   * Reactivate an archived fitness index
   **/
  activate (id, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'update',
      params: [{
        fitness_index_status_id: 1,
        modified_by: 'system',
        modified_on: new Date()
      }, id]
    }, options);
    return this.query(options);
  }

  getRankingById (id, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getRankingById',
      params: id,
      rowMapper: new RankingRowMapper()
    }, options);
    return this.queryOne(options);
  }

  updateJoinTables (mfi, options = {}) {
    let con = options.useConnection;
    let deleteFromCustomertoMfr = () => {
      return new Promise((f,r) => {
        loadSql.load('deleteKeyCustomers', {}, (sql, params) => {
          var sqlParams = parseInt(mfi.manufacturerId,10);
          con.query(sql, sqlParams, (err, result) => {
            if(err) {r(err);}
            f(result);
          });
        });
      });
    };
    let deleteFromProcessToMfr = () => {
      return new Promise((f,r) => {
        loadSql.load('deleteProcessTypes', {}, (sql, params) => {
          var sqlParams = parseInt(mfi.manufacturerId,10);
          con.query(sql, sqlParams, (err, result) => {
            if(err) {r(err);}
            f(result);
          });
        });
      });
    };
    let insertIntoCustomertomfr = () => {
      return new Promise((f,r) => {
        let sql = "INSERT INTO manufacturer_customer (manufacturer_id, customer_id, eff_dt, end_dt)\nVALUES ";
        let i = 0;
        let sqlParams = mfi.keyCustomers.map((item) => {
          i++;
          sql += `(${parseInt(mfi.manufacturerId)},${parseInt(item)},"2010-01-01","9999-01-01"),`;
        });
        sql = sql.substring(0, sql.length - 1);
        if(i > 0) {
          con.query(sql, {}, (err, result) => {
            if(err) {r(err);}
            f(result);
          });
        }
        else {
          f("nothing to insert");
        }
      });
    };
    let insertIntoProcesstomfr = () => {
      return new Promise((f,r) => {
        let sql = "INSERT INTO manufacturer_process_type (manufacturer_id, process_type_id, eff_dt, end_dt)\nVALUES ";
        let i = 0;
        let sqlParams = mfi.processTypes.map((item) => {
          i++;
          sql += `(${parseInt(mfi.manufacturerId)},${parseInt(item)},"2010-01-01","9999-01-01"),`;
        });
        sql = sql.substring(0, sql.length - 1);
        if(i > 0) {
          con.query(sql, {}, (err, result) => {
            if(err) {r(err);}
            f(result);
          });
        }
        else {
          f("nothing to insert");
        }
      });
    };

    return new Promise((f,r) => {

      deleteFromProcessToMfr()
      .then((res) => {
        return deleteFromCustomertoMfr();
      })
      .then((res) => {
        return insertIntoCustomertomfr();
      })
      .then((res) => {
        return insertIntoProcesstomfr();
      })
      .then((res) => {
        f(res);
      })
      .catch((err) => {
        rollback(err,() => { fail(err) }, con, options);
      });
    });
  }

  /*
   * Get all active fitness indexes
   */
  getAllActive(options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getAllActive',
      countSql: 'getAllActiveCount'
    }, options);
    return new Promise((succeed, fail) => {
      this.query(options)
      .then(result => {
        if(result.data) {
          result.data = FitnessIndexCalculator.calculateRanks(result.data);
        } else {
          result = FitnessIndexCalculator.calculateRanks(result);
        }
        succeed(result);
      }, err => {
        logger.error(err);
        fail(err);
      }).catch(err => {
        logger.error(err);
        fail(err);
      })
    });
  }

  /*
   * Get current scores for fitness index by id
   */
  getScoresById(id, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getScoresById',
      params: id
    }, options);
    return new Promise((succeed, fail) => {
      let result = null;
      let con;
      this.getConnection(options)
      .then(connection => {
        con = connection;
        let options2 = Object.assign({
          useConnection: con
        }, options);
        return this.query(options2)
      })
      .then(result1 => {
        if(result1) {
          result = FitnessIndexCalculator.calculateRanks(result1);
        }
        return this.getRankingById(id, { useConnection: con })
      })
      .then(ranking => {
        this.maybeCloseConnection(con, options);
        if(result && result.length > 0 && ranking) {
          result[0].ranking = ranking.ranking; 
        }
        succeed(result);
      }, err => {
        this.maybeCloseConnection(con, options);
        logger.error(err);
        fail(err);
      }).catch(err => {
        this.maybeCloseConnection(con, options);
        logger.error(err);
        fail(err);
      })
    });
  }

  /*
   * Get historical scores for fitness indexes on or after a date
   */
  getScoresByIdFromDate(id, fromDate, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getScoresByIdFrom',
      params: [id, fromDate]
    }, options);
    return this.getScoresById(id, options);
  }

  /*
   * Get historical scores for fitness indexes between two dates (inclusive)
   */
  getScoresByIdBetweenDates(id, fromDate, toDate, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getScoresByIdFromTo',
      params: [id, fromDate, toDate]
    }, options);
    return this.getScoresById(id, options);
  }

  getAll(options = {}) {
    return this.getAllActive(options);
  }

  /*
   * Get all active fitness indexes with all fields
   */
  getAllDetailed(options) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getAllDetailed'
    }, options);
    return this.query(options);
  }

  /*
   * Get all archived fitness indexes
   */
  getAllArchived(options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getAllArchived',
      countSql: 'getAllArchivedCount'
    }, options);
    return this.query(options);
  }

  /*
   * Get fitness index by id
   */
  getById(id, options = {}) {
    options = Object.assign({}, {
      useConnection: null,
      sql: 'getById',
      params: id
    }, options);
    return new Promise((succeed, fail) => {
      this.getScoresById(id, options)
      .then(result => {
        let fitnessIndex = result.reduce((s, item) => {
          item.keyCustomers = item.keyCustomers ? item.keyCustomers.split(",") : [];
          item.processTypes = item.processTypes ? item.processTypes.split(",") : [];
          item.keyCustomerCount = item.keyCustomers.length;
          item.processCount = item.processTypes.length;
          s.push(item);
          return s;
        },[]);
        succeed(fitnessIndex ? fitnessIndex[0] : null);  
      }, err => {
        logger.error(err);
        fail(err);
      }).catch(err => {
        logger.error(err);
        fail(err);
      })
    });
  }

  getNextSnapshotDate(current) {
    let now = new Date(current);
    let year = now.getFullYear();
    let month = now.getMonth() + 1; //month is zero-indexed
    let date;
    if(month === 12) {
      date = `${year + 1}-1-15`;
    } else {
      date = `${year}-${month + 1}-15`;
    }
    return new Date(date);
  }

  getCurrentSnapshotDate(current) {
    let now = typeof current === 'string' ? new Date(current)
      : current !== null && typeof current === 'object' && typeof current.getMonth === 'function' ? current
      : new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1; //month is zero-indexed
    let date;
    date = `${year}-${month}-15 00:00:00`;
    return new Date(date);
  }

  snapshot(date, options) {
    let currentDate = this.getCurrentSnapshotDate(date);
    options = Object.assign({}, {
      useConnection: null,
      sql: 'monthlySnapshot',
      params: currentDate
    }, options);
    return this.query(options);
  }

  calculateIndexes(indexes) {
    return indexes.map(index => {
      let calculated = new FitnessIndexCalculator(index);
      let { kbdScore } = calculated;
      return Object.assign(index, calculated.indexScores, { kbdScore });
    });
  }

  monthlySnapshot(snapshotDate, options) {
    logger.info("The snapshot ran at:", new Date());
    options = Object.assign({}, {
      useConnection: null
    }, options);

    return new Promise((succeed, fail) => {
      let con;
      this.getConnection(options)
      .then(connection => {
        con = connection;
        return this.beginTransaction(con);  
      })
      .then(() => {
        return this.snapshot(snapshotDate, {useConnection: con});
      })
      .then(() => {
        return this.getAllDetailed({useConnection: con});
      })
      .then(indexes => {
        return this.calculateIndexes(indexes);
      })
      .then(calculated => {
        let promises = calculated.map(idx => {
          return this.updateScores(idx, {useConnection: con});
        });
        return Promise.all(promises);
      })
      .then(results => {
        this.tryCommitAndMaybeCloseConnection(con, options);
        succeed(results);
      }, err => {
        rollback(err,() => { fail(err) }, con, options);
      }).catch(err => {
        rollback(err,() => { fail(err) }, con, options);
      })
    });
  }
}

// Private methods
let rollback = (err, r, con, options) => {
  logger.error('There was an error while attempting to update the Fitness Index: ', err);
  con.rollback((err) => {
    this.maybeCloseConnection(con, options);
    r(err);
  });
};

module.exports = FitnessIndexDao;