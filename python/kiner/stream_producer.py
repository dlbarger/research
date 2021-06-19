"""
    Script:     stream_producer.py
    Author:     Dennis Barger
    Date:       7/2/3030

    Description:
    Data producer to test Kinesis stream in AWS
"""
from kiner.producer import KinesisProducer
from random_word import RandomWords
from datetime import date

today = date.today()


"""
    User Defined Functions
"""
def getRandomWords(obj):
    try:
        return(obj.get_random_words())
    except Exception as e:
        print(e)
        return('Error')

def getWordOfDay(obj, dte):
    try:
        return(obj.word_of_the_day(date=dte))
    except Exception as e:
        print(e)
        return('Error')

"""
    Main Logic
"""

stream_name = 'sandbox-stream'

p = KinesisProducer(
    stream_name,
    batch_size=500,
    max_retries=5,
    threads=10
)

resp = RandomWords()
words = getRandomWords(resp)
total_words = len(words)

for i in range(total_words):
    #p.put_record(words[1])
    print(words[i])

p.close()
