/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const AWS = require("aws-sdk")
AWS.config.region = process.env.REGION 
const tableName = process.env.TABLE_NAME
const ddb = new AWS.DynamoDB({ apiVersion: "2012-08-10" })

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2))

  let odds = JSON.parse(event.body).odds

  let requestsArray = []
  //to write feeds to sportsfeeds table

  for (let i = 0; i < odds.length; i++) { 
 
   console.log(odds[i])
    let created = String(Math.floor(new Date().getTime() / 1000))
    //epoch timestamp for TTL attribute to automatically delete items after 1 year 
    let expire = String(
      Math.floor(
        new Date(new Date().setFullYear(new Date().getFullYear() + 1)) / 1000
      )
    );

    requestsArray.push({
      PutRequest: {
        Item: {
          PK: { S: odds[i].gameId },
          SK: { S: "odds-" + odds[i].date},
          AWAY: { N: odds[i].away.toString() },
          HOME: { N: odds[i].home.toString() },
          AWAYODDS: { N: odds[i].awayOdds.toString() },
          HOMEODDS: { N: odds[i].homeOdds.toString() },
          CREATED: { N: created },
          EXPIRE: { N: expire }
        },
      },
    })
  }

  let params = {
    RequestItems: {
      [tableName]: requestsArray,
    }
  }
  console.log(" params : " + JSON.stringify(params))
  console.log("Batch Write of Feeds - begin.")

  try {
   const data = await ddb.batchWriteItem(params).promise()
    console.log("Batch Write of Feeds - end")
  } catch (err) {
    console.log("Error adding Batch Items :" + err)
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("Feeds Added Successfully"),
  }
  return response
}
