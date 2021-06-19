"""
Script: get_image_blocks.py
Author: Dennis Barger
Date:   8/12/2020

Description:
Lambda function that calls DetectDocumdnText API in AWS Textract
"""

import json
import boto3

def lambda_handler(event, context):

    url = "s3://dbarger-sandbox/documents/blueprint.jpg"
    bucket = "dbarger-sandbox"
    document = "documents/blueprint.jpg"

    response = client.detect_document_text(
        doc = 'S3Object': {'Bucket': bucket, 'Name':document}
    )

    blocks = response['Blocks']
    return{
        'statusCode': 200,
        'body':json.dumps(blocks)
    }