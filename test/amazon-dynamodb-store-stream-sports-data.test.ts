import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AmazonDynamodbStoreStreamSportsData from '../lib/amazon-dynamodb-store-stream-sports-data-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AmazonDynamodbStoreStreamSportsData.AmazonDynamodbStoreStreamSportsDataStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
