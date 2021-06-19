"""
    Script:     stream_producer.py
    Author:     Dennis Barger
    Date:       7/2/3030

    Description:
    Data producer to test Kinesis stream in AWS
"""
from kiner.producer import KinesisProducer
from datetime import date
import json

"""
    User Defined Functions
"""

def getFile(fileName):
    try:
        return(open(fileName))
    except Exception as e:
        return(e)
"""
    Main Logic
"""
today = date.today()
stream_name = 'sandbox-stream'

p = KinesisProducer(
    stream_name,
    batch_size=500,
    max_retries=1,
    threads=10
)

response = getFile('iis_log_raw.txt')
payload = response.read()
p.put_record(payload)
print(payload)

p.close()
