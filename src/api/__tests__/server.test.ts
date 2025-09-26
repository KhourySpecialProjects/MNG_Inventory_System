import request from "supertest";
import app from "../src/server";

describe("tRPC Routes", () => {
  it("GET /trpc/hello should return message", async () => {
    // For queries, the express adapter supports GET with `?input=` (JSON-encoded)
    const res = await request(app).get("/trpc/hello?input=null");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("result");
    expect(res.body.result).toHaveProperty("data");
    expect(res.body.result.data).toEqual({ message: "Hello from tRPC API!" });
  });

  it("GET / should return root message", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain("API up");
  });
});
