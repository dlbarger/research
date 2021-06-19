"""
Script: json_parser.py
Author: Dennis Barger
Date:   8/12/2020
"""
import json 

fl = './data/get-image-response.json'

with open(fl) as f:
    data = json.load(f)
f.close()

body_data = data['body']
print(body_data)


"""
for (k, v) in data.items(['body']):
    print("Key: " + k)
    print("Value: " + str(v))
"""

# Pretty json print
#print(json.dumps(data, indent = 4, sort_keys=True))