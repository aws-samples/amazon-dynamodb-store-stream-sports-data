import * as cdk from "aws-cdk-lib"
import * as kinesis from "aws-cdk-lib/aws-kinesis"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { PolicyStatement } from "aws-cdk-lib/aws-iam"
import { Cors, RestApi, LambdaIntegration } from "aws-cdk-lib/aws-apigateway"
import { AttributeType, Table, BillingMode } from "aws-cdk-lib/aws-dynamodb"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { RemovalPolicy, Duration } from "aws-cdk-lib/core"
import { WebSocketApi, WebSocketStage } from "aws-cdk-lib/aws-apigatewayv2"
import * as apigw2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { CfnStreamConsumer } from 'aws-cdk-lib/aws-kinesis';
import { EventSourceMapping, StartingPosition } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'


export class AmazonDynamodbStoreStreamSportsDataStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const region = cdk.Stack.of(this).region
    const tableName = "sportsfeeds"
    const kinesisStream = "feedstream"
    

    const feedStream = new kinesis.Stream(this, kinesisStream, {
      streamName: kinesisStream,
      shardCount: 3,
    })

    const table = new Table(this, tableName, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: tableName,
      kinesisStream: feedStream,
    })

    table.addGlobalSecondaryIndex({
      indexName: "GSI-1",
      partitionKey: { name: "ISSCHEDULED", type: dynamodb.AttributeType.STRING },
      sortKey: {name: 'GAMEDATE', type: dynamodb.AttributeType.NUMBER},
      projectionType: dynamodb.ProjectionType.ALL,
    })

    table.addGlobalSecondaryIndex({
      indexName: "GSI-2",
      partitionKey: { name: "CONNECTION", type: dynamodb.AttributeType.STRING },
      
      projectionType: dynamodb.ProjectionType.ALL,
    })

    const writeFeeds = new lambda.Function(this, "writeFeeds", {
      code: lambda.Code.fromAsset("lambda/writeFeeds"),
      handler: "writeFeeds.handler",
      functionName: "writeFeeds",
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 256,
      environment : { "TABLE_NAME" : tableName, "REGION" : region } 
    })

    table.grant(writeFeeds, "dynamodb:BatchWriteItem")

    const readFeeds = new lambda.Function(this, "readFeeds", {
      code: lambda.Code.fromAsset("lambda/readFeeds"),
      handler: "readFeeds.handler",
      functionName: "readFeeds",
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 256,
      environment : { "TABLE_NAME" : tableName, "REGION" : region }
    })

    table.grant(readFeeds, "dynamodb:Query")

    const connectionManager = new lambda.Function(this, "connectionManager", {
      code: lambda.Code.fromAsset("lambda/connectionManager"),
      handler: "connectionManager.handler",
      functionName: "connectionManager",
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 256,
      environment : { "TABLE_NAME" : tableName, "REGION" : region }
    })

    table.grant(
      connectionManager,
      "dynamodb:putitem",
      "dynamodb:DeleteItem"
    )

    const streamConsumer = new lambda.Function(this, "streamConsumer", {
      code: lambda.Code.fromAsset("lambda/streamConsumer"),
      handler: "streamConsumer.handler",
      functionName: "streamConsumer",
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 256,
      environment : { "TABLE_NAME" : tableName, "REGION" : region }
    })

    table.grant(streamConsumer, "dynamodb:scan")

    const consumer = new CfnStreamConsumer(this, 'stream-consumer', {
      consumerName: 'feed-stream-consumer',
      streamArn: feedStream.streamArn,
    });

    const eventSourceMapping = new EventSourceMapping(this, 'event-source-mapping', {
      batchSize: 10,
      eventSourceArn: consumer.attrConsumerArn,
      startingPosition: StartingPosition.TRIM_HORIZON,
      target: streamConsumer,
    });

    const api = new RestApi(this, `feedsAPI`, {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
      },
      restApiName: `feedsAPI`,
    })

    const ticksResource = api.root.addResource("feeds")
    ticksResource.addMethod("GET", new LambdaIntegration(readFeeds))
    ticksResource.addMethod("PUT", new LambdaIntegration(writeFeeds))

    const webSocketApi = new WebSocketApi(this, "bookmakerAPI", {
      connectRouteOptions: {
        integration:  new apigw2Integrations.WebSocketLambdaIntegration('ws-connect',connectionManager),
      },
      disconnectRouteOptions: {
        integration: new apigw2Integrations.WebSocketLambdaIntegration( 'ws-disconnect', connectionManager),
      },
      defaultRouteOptions: {
        integration: new apigw2Integrations.WebSocketLambdaIntegration('ws-default',connectionManager),
      },
    })

    const apiStage = new WebSocketStage(this, "ProdStage", {
      webSocketApi,
      stageName: "prod",
      autoDeploy: true,
    })

    const connectionsArns = this.formatArn({
      service: "execute-api",
      resourceName: `${apiStage.stageName}/POST/*`,
      resource: webSocketApi.apiId,
    })

    const kinesisStreamReadPolicyStmt = new PolicyStatement({
      resources: [feedStream.streamArn],
      actions: [
        'kinesis:DescribeStreamSummary',
        'kinesis:GetRecords',
        'kinesis:GetShardIterator',
        'kinesis:ListShards',
      ],
    });
    
    const kinesisConsumerPolicyStmt = new PolicyStatement({
      resources: [consumer.attrConsumerArn],
      actions: ['kinesis:SubscribeToShard'],
    });
    
    streamConsumer.addToRolePolicy(kinesisStreamReadPolicyStmt);
    streamConsumer.addToRolePolicy(kinesisConsumerPolicyStmt);

    streamConsumer.addToRolePolicy(
      new PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: [connectionsArns],
      })
    )
  }
}
