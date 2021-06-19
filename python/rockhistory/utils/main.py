# Script:     rockhistory\utils\main.py
# Function:   rockhistory-utils
# Handler:    main.lambda_handler

#Description:
#Various utilities to create and populated DynamoDB table


import json
import boto3
import pandas as pd
import io

def lambda_handler(event, context):
    try:
        dynamodb = boto3.client("dynamodb")
        #response = create_table(event, dynamodb)
        
        '''
        response = upload(
            bucket = "dbarger-rockhistory", 
            key = "rockhistory-spotfy.csv", 
            tablename = event['Tablename'], 
            client = dynamodb
        )
        '''

        response = query_table(
            tablename = event['Tablename'],
            client = dynamodb
        )
    
        return {
            'statusCode': 200,
            'body': json.dumps(str(response))
        }
    except Exception as e:
        raise(e)

def create_table(tableschema, client):
    try:
        response = client.create_table(
            TableName = tableschema['Tablename'],
            AttributeDefinitions = tableschema['AttributeDefinitions'],
            KeySchema = tableschema["KeySchema"],
            ProvisionedThroughput = tableschema["ProvisionedThroughput"]
        )
        return (response)
    except Exception as e:
        raise(e)

def get_s3_object(source_bucket, source_key):
    try:
        client = boto3.client('s3')
        response = client.get_object(
            Bucket = source_bucket,
            Key = source_key
        )
        return(response)
    except Exception as e:
        raise(e)

def upload(bucket, key, tablename, client):
    try:
        obj = get_s3_object(bucket, key)
        df = pd.read_csv(io.BytesIO(obj['Body'].read()), encoding='utf8', dtype='unicode', index_col=False, error_bad_lines=False)

        for index, row in df.iterrows():
            print(index)
            item = {
                'index': {'N':  row['index']},
                'name': {'S':   row['name']},
                'artist': {'S': row['artist']},
                'release_date': {'S': row['release_date']},
                'length': {'N': row['length']},
                'popularity': {'N': row['popularity']},
                'tempo': {'N': row['tempo']},
                'time_signature': {'N': row['time_signature']}
            }
            
            response = client.put_item(
                TableName = tablename,
                Item = item
            )
            print(response)

        return("done")
    except Exception as e:
        raise(e)

def query_table(tablename, client):
    try:
        response = client.query(
            TableName = tablename,
            KeyConditionExpression = 'artist = :artist',
            ExpressionAttributeValues = {
                ':artist': {'S': 'The Rolling Stones'}
            }
        )
        return(response)
    except Exception as e:
        raise(e)


if __name__ == "__main__":

    schema = {
        "Tablename": "rockhistory",
        "AttributeDefinitions": [
            {
                "AttributeName": "index",
                "AttributeType": "N"
            },
            {
                "AttributeName": "artist",
                "AttributeType": "S"
            }
        ],
        "KeySchema": [
            {
                "AttributeName": "index",
                "KeyType": "HASH"
            },
            {
                "AttributeName": "artist",
                "KeyType": "RANGE"
            }
        ],
        "ProvisionedThroughput": {
            "ReadCapacityUnits": 1,
            "WriteCapacityUnits": 1
        }        
    }

    resp = lambda_handler(schema, None)

    print(resp)




