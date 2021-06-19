// ==============================================================================
//  Script:     node_mysql/index.js
//  Author:     Dennis Barger, SEI
//  Date:       9/8/20
//
//  Description:
//  Wrapper to execute SQL command against AWS Aurora
//===============================================================================

'use strict';

var aws = require('aws-sdk');
var mysql = require('mysql');
var fs = require('fs');
var configuration = require('./config.json');

function connect(params, obj) {
    var connection = obj.createConnection({
        host: params['host'],
        user: params['user'],
        password: params['password'],
        database: params['database']
    });
    return(connection);
}

var sql = configuration['sql'];
var con = connect(configuration, mysql) 

con.query(sql, function(error, results, fields) {
    if (error) {
        con.destroy();
        throw error;
    } else {
        console.log(results);
        con.end();
    }
});