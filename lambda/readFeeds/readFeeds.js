/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const AWS = require("aws-sdk")
AWS.config.region = process.env.REGION 
const tableName = process.env.TABLE_NAME
const ddbClient = new AWS.DynamoDB.DocumentClient()

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2))
  let game = event.queryStringParameters.game

  let oddsfeed = await findLatestOddsFeed(game)

  console.log("readfeeds : " + JSON.stringify(oddsfeed))

  const response = {
    statusCode: 200,
    body: JSON.stringify(oddsfeed),
  }
  return response
}
//to find latest odds for game
async function findLatestOddsFeed(game) {
  try {
    let params = {
      TableName: tableName,
      KeyConditionExpression: "#pk = :pk and begins_with(#sk, :sk)",
      ExpressionAttributeNames: {
        "#pk": "PK",
        "#sk": "SK",
      },
      ExpressionAttributeValues: {
        ":pk": game,
        ":sk": "odds-",
      },
      ScanIndexForward: false,
      Limit: 1,
    }

    const feed = await ddbClient.query(params).promise();
    return feed.Items[0]
  } catch (err) {
    return err
  }
}
