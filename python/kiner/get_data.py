"""
    Script:     get_data.py
    Author:     Dennis Barger
    Date:       7/3/2020

    Description:
    Ingest streaming data from public API
"""
import json
import requests

"""
Global Variables
"""
#url = 'https://gbfs.citibikenyc.com/gbfs/en/station_information.json'
url = 'https://gbfs.citibikenyc.com/gbfs/en/free_bike_status.json'
headers ={}

"""
API call
"""

response = requests.get(url, headers = headers)
print(response.status_code)
if response.status_code == 200:
    dict_data = json.dumps(response.json(), sort_keys=True, indent=4)
    print(type(response.json()))
    print(response.json().keys())
    print(response.json()['data']['bikes'])
