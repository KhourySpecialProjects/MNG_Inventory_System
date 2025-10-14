import { Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface DynamoStackProps extends StackProps {
  stage: string;
  serviceName?: string;
}

export class DynamoStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoStackProps) {
    super(scope, id, props);

    const service = (props.serviceName ?? "mng").toLowerCase();
    const stage = props.stage.toLowerCase();

    this.table = new dynamodb.Table(this, "Table", {
      tableName: `${service}-${stage}-data`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      pointInTimeRecovery: true,
      timeToLiveAttribute: "ttl", 
      removalPolicy: stage === "dev" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      // stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // enable triggers
    });

    //  Global Secondary Indexes 

    // Items by Item Profile (ITEM of type ITEM_PROFILE)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ItemsByProfile",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING }, // ITEM_PROFILE#<profileId>
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },      // ITEM#<itemId>
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Items by Parent Item (kits/assemblies)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ItemsByParent",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING }, //   PARENT#<parentItemId>
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },      //   ITEM#<itemId>
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Reports by User (reporter_user_id)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ReportsByUser",
      partitionKey: { name: "GSI3PK", type: dynamodb.AttributeType.STRING }, //   USER#<userId>
      sortKey: { name: "GSI3SK", type: dynamodb.AttributeType.STRING },      //   REPORT#<isoTime>#ITEM#<itemId>
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Reports by Item 
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_ReportsByItem",
      partitionKey: { name: "GSI4PK", type: dynamodb.AttributeType.STRING }, //   ITEM#<itemId>
      sortKey: { name: "GSI4SK", type: dynamodb.AttributeType.STRING },      //   REPORT#<isoTime>
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Locations by Parent (hierarchy)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_LocationsByParent",
      partitionKey: { name: "GSI5PK", type: dynamodb.AttributeType.STRING }, //   LOC_PARENT#<parentLocId|ROOT>
      sortKey: { name: "GSI5SK", type: dynamodb.AttributeType.STRING },      //   LOCATION#<locId>
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Users by external UID (fast auth lookup)
    this.table.addGlobalSecondaryIndex({
      indexName: "GSI_UsersByUid",
      partitionKey: { name: "GSI6PK", type: dynamodb.AttributeType.STRING }, //   UID#<uid>
      sortKey: { name: "GSI6SK", type: dynamodb.AttributeType.STRING },      //   USER#<userId>
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new CfnOutput(this, "TableName", { value: this.table.tableName });
    new CfnOutput(this, "TableArn", { value: this.table.tableArn });
    new CfnOutput(this, "Indexes", {
      value: [
        "GSI_ItemsByProfile",
        "GSI_ItemsByParent",
        "GSI_ReportsByUser",
        "GSI_ReportsByItem",
        "GSI_LocationsByParent",
        "GSI_UsersByUid",
      ].join(", "),
    });
  }
}
