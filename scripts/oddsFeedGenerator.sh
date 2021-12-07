# Generate odds request with current timestamp
# Usage : sh oddsFeedGenerator.sh <feedsAPI stage URL>
# Eg : sh oddsFeedGenerator.sh https://y88rkd7oi3.execute-api.eu-west-2.amazonaws.com/prod
#echo "oddsFeedGenerator started"
sed -e "s/TIME/$(date +%s)/g" -e "s/{AWAY}/$(( ( RANDOM % 5 )  + 1 - 5 ))/g" -e "s/{HOME}/$(( ( RANDOM % 5 )  + 1 ))/g" odds_template.json > odds.json

response=$(curl -X PUT -H "Content-Type: application/json" -d @odds.json $1/feeds --silent)
echo ${response}
rm odds.json
#echo "oddsFeedGenerator ended"