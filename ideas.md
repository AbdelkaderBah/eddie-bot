# Ideas

## 1. Implement Technical analysis.

https://github.com/anandanand84/technicalindicators
https://www.npmjs.com/package/@d3fc/d3fc-technical-indicator
https://www.youtube.com/watch?v=XBcMiYK7qYY
https://www.youtube.com/watch?v=waKGeoeM6HU

## More

## Simulations.

## Re-invest into the same bot.


## Import trades data from server:


ON the server:
```bash
# docker run command to get the hash file.
#docker exec c05b70a10248 sh -c "redis-cli --raw HGETALL trade:closed | awk 'ORS=NR%2?\",\":\",\\n\"' | sed 's/^/{/;s/$/}/' > /server-data.json"

docker exec c05b70a10248 sh -c "
python3 -c '
import json
import subprocess

# Run redis-cli to fetch hash data
cmd = \"redis-cli --raw HGETALL trade:closed\"
output = subprocess.check_output(cmd, shell=True, text=True).strip().split(\"\\n\")

# Convert to key-value dictionary
data = dict(zip(output[0::2], output[1::2]))

# Save as JSON
with open(\"/server-data.json\", \"w\") as f:
    json.dump(data, f, indent=4)

print(\"Exported to /server-data.json\")
'"

docker cp c05b70a10248:/server-data.json /root/server-data.json
mv server-data.json vhhs/lodgingo-v3/public/
```

On the computer:

```bash
curl -O https://lodgingo.com/server-data.json
```