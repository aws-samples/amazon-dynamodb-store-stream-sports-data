/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const AWS = require("aws-sdk")
AWS.config.region = process.env.REGION 
const tableName = process.env.TABLE_NAME
const docClient = new AWS.DynamoDB.DocumentClient()
const parse = AWS.DynamoDB.Converter.output

exports.handler = async (event) => {
  var records = event.Records

  console.log("Recieved Event :" + JSON.stringify(event))

  //to traverse kinesis stream records to process stream
  const asyncRes = await Promise.all(
    records.map(async (record) => {
      var payload = Buffer.from(record.kinesis.data, "base64").toString(
        "ascii"
      )
      var jsonpayload = JSON.parse(payload)

      var image = parse({ M: jsonpayload.dynamodb.NewImage })
      console.log(image);

      if (jsonpayload.eventName == "INSERT" && image.SK.startsWith("odds-")) {
       
        var feed = {
            "gameId": image.PK,
            "away": image.AWAY,
            "home": image.HOME,
            "awayOdds": image.AWAYODDS,
            "homeOdds": image.HOMEODDS,
            "date": image.CREATED
        }
        
        console.log( "feed :" + feed)
        var connections = await findAllConnections()
        var items = connections.Items

        const asyncResp = await Promise.all(
          items.map(async (item) => {
            var conn = item.CONNECTION
            var endpoint = item.ENDPOINT
            await pushDataToClient(conn, endpoint, feed)
          })
        )
      }
    })
  )
  const response = {
    statusCode: 200,
    body: JSON.stringify("StreamConsumer - Succeeded publishing"),
  }
  return response
}
// scan for connections in the sparse GSI-CON
async function findAllConnections() {
  try {
    var params = {
      TableName: tableName,
      IndexName: "GSI-2",
      ProjectionExpression: "#PK, CLIENT, ENDPOINT",
      ExpressionAttributeNames: {
        "#PK": "CONNECTION",
      },
    }

    const connections = await docClient.scan(params).promise()
    return connections
  } catch (err) {
    return err;
  }
}

//to publish feeds to websocket connection
async function pushDataToClient(connectionId, endpointURL, feed) {
  try {
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
      apiVersion: "2018-11-29",
      endpoint: endpointURL,
    })
    console.log("pushToConnection : " + connectionId + " feed  : " + JSON.stringify(feed))
    var testfeed="Test feed"
    var resp = await apigwManagementApi
      .postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(feed) })
      .promise()
    return resp;
  } catch (err) {
    return err;
  }
}
