/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const AWS = require("aws-sdk")
AWS.config.region = process.env.AWS_REGION 
const tableName = process.env.TABLE_NAME
const ddbClient = new AWS.DynamoDB.DocumentClient()

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2))

  let connectionId = event.requestContext.connectionId
  let endpoint = "https://" + event.requestContext.domainName + "/" + event.requestContext.stage

  if (event.requestContext.routeKey == "$connect") {
    // tolerate if client parameter is not passed. 
    let clientId = "client"
    try
    {
       clientId = event.queryStringParameters.client
    }catch(err){}
    let created = String(Math.floor(new Date().getTime() / 1000))
    //epoch timestamp for TTL attribute to automatically delete items after 30 mins
    let expire = String(
      Math.floor(new Date(new Date().getTime() + 30 * 60000) / 1000)
    );
    let params = {
      TableName: tableName,
      Item: {
        PK: connectionId,
        SK: "con",
        CONNECTION: connectionId,
        CLIENT: clientId,
        ENDPOINT: endpoint,
        CREATED: created,
        EXPIRE: expire,
      },
    }

    try {
      // Add connection to the table on $connect
      const data = await ddbClient.put(params).promise()
      console.log("Added Client Connection :" + JSON.stringify(data, null, 2))
    } catch (err) {
      console.log("Error adding Connection :" + err);
      return {
        statusCode: 500,
        body: "Failed to connect: " + JSON.stringify(err),
      }
    }

    return { statusCode: 200, body: "Connected." + connectionId }
  } else if (event.requestContext.routeKey == "$disconnect") {
    let connectionId = event.requestContext.connectionId

    let params = {
      TableName: tableName,
      Key: {
        PK: connectionId,
        SK: "con",
      },
    }

    try {
      //remove connection from table on $disconnect
      const resp = await ddbClient.delete(params).promise()
      console.log(
        "Successfully deleted Client Connection :" +
        JSON.stringify(resp, null, 2)
      );
    } catch (err) {
      console.log("Error Deleting Connection :" + err);
      return {
        statusCode: 500,
        body: "Failed to Disconnect: " + JSON.stringify(err),
      }
    }

    return { statusCode: 200, body: "Disconnected." + connectionId }
  } else {
    console.log("Invalid Route Key : " + event.requestContext.routeKey)
    return { statusCode: 200, body: "Invalid Route Key. Doing Nothing.. " }
  }
}
