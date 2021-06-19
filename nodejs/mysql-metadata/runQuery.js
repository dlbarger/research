var mysql = require('mysql');
var aws = require('aws-sdk');


var mysql = require('mysql');

var sql = "SHOW TABLES";

var con = mysql.createConnection({
  host: "ccna-tis-test.c3r26e1u3bfm.us-east-1.rds.amazonaws.com",
  user: "ccna_tis",
  password: "ccna_tispass",
  database: "ccna_tis"
});

con.connect(function(err) {
  if (err) throw err;
  con.query(sql, function (err, result, fields) {
    if (err) throw err;
    console.log(result);
  });
});