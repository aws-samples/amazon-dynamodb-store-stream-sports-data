
#Insert some games from the template
echo "initDB started"
sed -e "s/{TIME}/$(date +%s)/g"   games_template.json > games.json
cat games.json
aws dynamodb batch-write-item --request-items file://games.json

#Insert some clients from the template
sed -e "s/{TIME}/$(date +%s)/g"  clients_template.json > clients.json
cat clients.json
aws dynamodb batch-write-item --request-items file://clients.json

rm games.json clients.json
echo "initDB ended"