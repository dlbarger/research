# Overview
The project represents API services to query and manage databae of historical rock songs.  The database is a catalog of the most popular rock songs released between 1956 and 2020. 

# Data Source
The rockhistory database is deployed in DynamoDB and captures the following attributes:

- Artist - Individual artist or group that recorded the song
- Index
- Length - Duration of song
- Name - Song title
- Popularity - Score indicating popularity in comparison to other songs
- Release Date - Year song was released
- Tempo - Tempo of song
- Time Signature - Time signature of song (i.e. 4/4, 3/4, etc.)

