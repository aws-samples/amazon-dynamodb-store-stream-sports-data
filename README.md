# Store & Stream sports data feeds using Amazon DynamoDB and Amazon Kinesis Data Streams

Sports data providers provide a variety of sports data feeds such as game details and odds for betting. Online bookmakers consume these data feeds to publish to its end customers and also to their sports trading analysts. As odds change based on the events in the game, sports trading analysts use continuously updated information to manage bets and odds for their customers. In order to remain competitive, bookmakers must provide updated odds to trading analysts in near-real time. 


## Solution overview
In this post, we walk through a solution to ingest, store, and stream sports data feeds using [Amazon API Gateway](https://aws.amazon.com/api-gateway/), [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) and [Amazon Kinesis Data Streams](https://aws.amazon.com/kinesis/data-streams/). The solution uses serverless services allowing you to focus on the application logic by offloading the undifferentiated heavy lifting aspects of infrastructure and maintenance to [Amazon Web Services (AWS)](https://aws.amazon.com/). The solution provides a near-real time streaming of sports data feeds to the trading analysts via a front-end application to make decisions based on the changing sports data feeds. The data flow in the solution can be divided into two flows:

Flow A: Sports data provider to DynamoDB

1.	The trading analyst logs in to the front-end application and establishes an API Gateway WebSocket connection. 
2.	The sports data provider continuously pushes the sports data feeds. 
3.	API Gateway serves the API layer for both the front-end application and sports data providers. 
4.	Lambda functions implement the application logic to store and read data feeds and WebSocket connections.
5.	DynamoDB handles the persistent storage of the feed to support the query access patterns. 

Flow B: DynamoDB to front-end application

6.	Kinesis Data Streams captures the change records from the DynamoDB table when new feeds are inserted.
7.	The StreamConsumer Lambda function receives the change event record from the stream. 
8.	The odds feed data is published to the front-end application via WebSocket connections. 

Figure 1 illustrates the solution architecture and the two flows described above.

<figure>
  <img src="images/arch_diagram.png" alt="AWS Architecture Diagram" />
  <figcaption align="center"> Figure 1 - Solution architecture and flow of sports data feeds </figcaption>
</figure>

To learn more about how this application works, review the Amazon DynamoDB Blog:
* [Store & Stream sports data feeds using Amazon DynamoDB and Amazon Kinesis Data Streams](https://aws.amazon.com/blogs)

Important: this application uses various AWS services and there are costs associated with these services after the Free Tier usage - please see the AWS Pricing page for details. You are responsible for any AWS costs incurred. No warranty is implied in this example.

```bash
.
├── README.MD              <-- This instructions file
├── bin                    <-- Combines the infrastructure and handlers into a single CDK app
├── images                 <-- Architecture diagram and images used for documentation
├── lambda                 <-- Lambda Functions for the application (NodeJS)
├── lib                    <-- Infrastructure stack shared across services 
├── scripts                <-- Script to simulate the sports data feeds

```

## Prerequisites
You must have the following prerequisites in place in order to deploy and test this solution: 

* An AWS account. ([Create an AWS account](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html) if you do not already have one and login.)
* [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html) installed with Administrator permission
* [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install) installed
* [NodeJS 14.x or higher installed](https://nodejs.org/en/download/)
* [wscat installed](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-wscat.html)


## Deploy the solution
The following commands needs to be run on your local terminal to clone the repository, install all its dependencies and deploy the solution: 

1. Clone the repo onto your local development machine:
```
git clone https://github.com/aws-samples/amazon-dynamodb-store-stream-sports-data
```
2. Install AWS CDK & Dependencies
```
cd amazon-dynamodb-store-stream-sports-data

npm install -g aws-cdk

cdk --version

npm install --save-exact @aws-cdk/aws-lambda @aws-cdk/aws-lambda-nodejs @aws-cdk/aws-dynamodb @aws-cdk/aws-apigatewayv2 @aws-cdk/aws-kinesis @aws-cdk/aws-apigatewayv2-integrations @aws-cdk/aws-lambda-event-sources
```
3. Configure AWS Access Key and Secret Access Key:
```
aws configure
```
4. Bootstrap the AWS Account:
```
cdk bootstrap
```
5. Deploy all the AWS resources:
```
cdk deploy
```

## Testing the Solution
Now that we have the application deployed, the next step is to test the flows. Make a note of the API Gateway REST API stage URL for feedsAPI and WebSocket API stage URL for bookmakerAPI. We need them for testing. 

__Step 1__: Initialize with sample Game data :

The repository includes a script to initialize the table with some sample data for the Games and Client Entities. 
```
cd amazon-dynamodb-store-stream-sports-data/scripts
sh initDB.sh
```
__Step 2__: Start Client applications :

For simulating the client application we can make use of the wscat tool to create a WebSocket client connection request. You can create multiple sessions from different terminals to simulate multiple clients. Navigate to API Gateway Service to copy the bookmakerAPI WebSocket URL and update the below command. 

```
wscat -c <bookmakerAPI URL>?client=client-001
```
__Step 3__: Odds Feed Generator :

The repository provides a script that can be used for generating test odds feed for different games. 

```
cd amazon-dynamodb-store-stream-sports-data/scripts
sh oddsFeedGenerator.sh <feedsAPI URL> 
```
To post the odds feeds continuously you may use the below while loop.
```
while true; do sh oddsFeedGenerator.sh <feedsAPI URL> ; sleep 2; done
```
__Step 4__: Verification :

As the feeds are posted to the /odds API, you should verify: 

The web socket connection from the client gets persisted into the table.
```
aws dynamodb scan \
     --table-name sportsfeeds \
     --filter-expression "SK = :sk" \
     --expression-attribute-values '{":sk":{"S":"con"}}'
```
The ingested odds feeds are stored into the DynamoDB table. 
```
aws dynamodb scan \
     --table-name sportsfeeds \
     --filter-expression "begins_with(SK, :sk)" \
     --expression-attribute-values '{":sk":{"S":"odds-"}}'
```

The odds feeds should get published to the client sessions. For our testing use the wscat tool, that display the published odds. 


## Cleanup
To avoid incurring future charges, delete all the resources used in this solution. You can follow the below step to clean up the resources using CDK

```
cdk destroy
```

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk destroy`     cleanup the stack created by CloudFormation template.


## Next steps

The AWS DynamoDB Blog at the top of this README file contains additional information about the application design and architecture.

If you have any questions, please contact the author or raise an issue in the GitHub repo.

==============================================

Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.

SPDX-License-Identifier: MIT-0
