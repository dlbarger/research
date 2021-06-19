import json
import base64
import boto3

def put_s3_object(data, bucket, key):
    try:
        s3 = boto3.resource('s3')
        s3.Object(bucket, key).put(Body = data)
        return("done")
    except Exception as e:
        raise(e)

def lambda_handler(event, context):
    try:
        for record in event['Records']:
            #payload = base64.b64encode(record["kinesis"]["data"])
            #response = str(payload)
            response = record["kinesis"]["data"]
            put_s3_object(response, record["eventTargetBucket"],record["eventTargetKey"])
            
        return {
            'status': 'Done',
            'body': json.dumps(response)
        }
    except Exception as e:
        raise(e)