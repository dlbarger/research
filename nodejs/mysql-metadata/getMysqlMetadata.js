var mysql = require('mysql');
var aws = require('aws-sdk');
var s3 = new aws.S3();

// console.log(connection);
exports.handler = (event, context, callback) => {
    
    var sql = event['sql-cmd'];
    
    var connection = mysql.createConnection({
        host: event['host'],
        user: event['user'],
        password: event['password'],
        database: event['database']
    });
    
    connection.query(sql, function (error, results, fields) {
        if (error) {
            connection.destroy();
            throw error;
        } else {
            // connected!
            console.log(results);
            s3.putObject({
                Bucket: event['target-bucket'],
                Key: event['target-key'],
                Body: JSON.stringify(results)
            }).promise();
            callback(error, results);
            connection.end(function (err) { callback(err, results);});
        }
    });
};