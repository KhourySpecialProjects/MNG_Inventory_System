import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";
import { doc } from "../aws";

const TABLE_NAME = process.env.DDB_TABLE_NAME || "mng-dev-data";

function newId(n = 10): string {
  return crypto
    .randomBytes(n)
    .toString("base64")
    .replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c] as string));
}

export const itemsRouter = router({
  /** CREATE ITEM */
  createItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        name: z.string().min(1),
        actualName: z.string().optional(),
        nsn: z.string().optional(),
        serialNumber: z.string().optional(),
        quantity: z.number().default(1),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const itemId = newId(12);
        const now = new Date().toISOString();
        const item = {
          PK: `TEAM#${input.teamId}`,
          SK: `ITEM#${itemId}`,
          Type: "Item",
          teamId: input.teamId,
          itemId,
          name: input.name,
          actualName: input.actualName,
          nsn: input.nsn,
          serialNumber: input.serialNumber,
          quantity: input.quantity,
          createdAt: now,
          updatedAt: now,
          createdBy: input.userId,
        };
        await doc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
        return { success: true, itemId, item };
      } catch (err: any) {
        console.error("❌ createItem error:", err);
        return { success: false, error: err.message || "Failed to create item." };
      }
    }),

  /** GET ALL ITEMS IN TEAM */
  getItems: publicProcedure
    .input(z.object({ teamId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
              ":pk": `TEAM#${input.teamId}`,
              ":sk": "ITEM#",
            },
          })
        );
        return { success: true, items: result.Items ?? [] };
      } catch (err: any) {
        console.error("❌ getItems error:", err);
        return { success: false, error: err.message || "Failed to fetch items." };
      }
    }),

  /** GET SINGLE ITEM */
  getItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        itemId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await doc.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `TEAM#${input.teamId}`,
              SK: `ITEM#${input.itemId}`,
            },
          })
        );
        if (!result.Item) {
          return { success: false, error: "Item not found." };
        }
        return { success: true, item: result.Item };
      } catch (err: any) {
        console.error("❌ getItem error:", err);
        return { success: false, error: err.message || "Failed to fetch item." };
      }
    }),

  /** UPDATE ITEM */
  updateItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        itemId: z.string().min(1),
        name: z.string().optional(),
        actualName: z.string().optional(),
        nsn: z.string().optional(),
        serialNumber: z.string().optional(),
        quantity: z.number().optional(),
        description: z.string().optional(),
        imageLink: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const now = new Date().toISOString();

        // Build update expression dynamically
        const updates: string[] = ["updatedAt = :updatedAt"];
        const values: Record<string, any> = { ":updatedAt": now };
        const names: Record<string, string> = {};

        if (input.name !== undefined) {
          updates.push("#name = :name");
          values[":name"] = input.name;
          names["#name"] = "name";
        }
        if (input.actualName !== undefined) {
          updates.push("actualName = :actualName");
          values[":actualName"] = input.actualName;
        }
        if (input.nsn !== undefined) {
          updates.push("nsn = :nsn");
          values[":nsn"] = input.nsn;
        }
        if (input.serialNumber !== undefined) {
          updates.push("serialNumber = :serialNumber");
          values[":serialNumber"] = input.serialNumber;
        }
        if (input.quantity !== undefined) {
          updates.push("quantity = :quantity");
          values[":quantity"] = input.quantity;
        }
        if (input.description !== undefined) {
          updates.push("description = :description");
          values[":description"] = input.description;
        }
        if (input.imageLink !== undefined) {
          updates.push("imageLink = :imageLink");
          values[":imageLink"] = input.imageLink;
        }
        if (input.status !== undefined) {
          updates.push("#status = :status");
          values[":status"] = input.status;
          names["#status"] = "status";
        }

        const updateParams: any = {
          TableName: TABLE_NAME,
          Key: {
            PK: `TEAM#${input.teamId}`,
            SK: `ITEM#${input.itemId}`,
          },
          UpdateExpression: `SET ${updates.join(", ")}`,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        };

        if (Object.keys(names).length > 0) {
          updateParams.ExpressionAttributeNames = names;
        }

        const result = await doc.send(new UpdateCommand(updateParams));

        return { success: true, item: result.Attributes };
      } catch (err: any) {
        console.error("❌ updateItem error:", err);
        return { success: false, error: err.message || "Failed to update item." };
      }
    }),

  /** DELETE ITEM */
  deleteItem: publicProcedure
    .input(
      z.object({
        teamId: z.string().min(1),
        itemId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await doc.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              PK: `TEAM#${input.teamId}`,
              SK: `ITEM#${input.itemId}`,
            },
          })
        );
        return { success: true, deleted: input.itemId };
      } catch (err: any) {
        console.error("❌ deleteItem error:", err);
        return { success: false, error: err.message || "Failed to delete item." };
      }
    }),
});

