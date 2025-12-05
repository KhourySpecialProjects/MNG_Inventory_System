import os
import io
import json
import base64
from datetime import datetime, timezone

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
import boto3
import sys

TEMPLATE_PATH  = os.environ.get("TEMPLATE_PATH", "").strip()
TABLE_NAME     = os.environ.get("TABLE_NAME", "").strip()
UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET", "").strip()

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET"
}

_ddb_cli = None
_s3 = None

def ddb_client():
    global _ddb_cli
    if _ddb_cli is None:
        _ddb_cli = boto3.client("dynamodb")
    return _ddb_cli

def s3_client():
    global _s3
    if _s3 is None:
        from botocore.config import Config
        _s3 = boto3.client("s3", config=Config(signature_version='s3v4'))
    return _s3

FIELD_COORDS = {
    "ORGANIZATION": (90, 720),
    "NOMENCLATURE": (390, 720),
    "SERIAL_NUMBER": (90, 690),
    "DATE": (400, 690),
}

REMARKS_TABLE = {
    "x": 110,
    "y_start": 364,
    "row_gap": 24,
    "max_rows": 28,
    "max_width": 194,
    "font": "Helvetica",
    "size": 8,
    "wrap_gap": 10,
}

def _wrap_to_width(text, max_width, font, size):
    words = (text or "").split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(test, font, size) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def _draw_remarks_list(c, values):
    rows = values.get("REMARKS_LIST") or []
    if not rows:
        rows = ["N/A"]

    x = REMARKS_TABLE["x"]
    y = REMARKS_TABLE["y_start"]
    gap = REMARKS_TABLE["row_gap"]
    wrap_gap = REMARKS_TABLE["wrap_gap"]
    max_w = REMARKS_TABLE["max_width"]
    font = REMARKS_TABLE["font"]
    size = REMARKS_TABLE["size"]

    c.setFont(font, size)

    for raw in rows[:REMARKS_TABLE["max_rows"]]:
        group_y = y
        wrapped = _wrap_to_width(str(raw), max_w, font, size)
        max_lines = max(1, 1 + ((gap - 2) // wrap_gap))
        if len(wrapped) > max_lines:
            wrapped = wrapped[:max_lines]
            last = wrapped[-1]
            ell = " …"
            while last and pdfmetrics.stringWidth(last + ell, font, size) > max_w:
                last = last[:-1]
            wrapped[-1] = last + ell

        for i, wl in enumerate(wrapped):
            c.drawString(x, int(group_y - i * wrap_gap), wl)

        y = group_y - gap

def make_overlay(w, h, values):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(w, h))
    c.setFont("Helvetica", 9)

    _draw_remarks_list(c, values)

    for f, (x, y) in FIELD_COORDS.items():
        v = (values.get(f) or "").strip()
        if v:
            c.drawString(x, y, v)

    c.save()
    buf.seek(0)
    return PdfReader(buf)

def stamp(template_bytes, values):
    tmpl = PdfReader(io.BytesIO(template_bytes))
    writer = PdfWriter()
    mb = tmpl.pages[0].mediabox
    w, h = float(mb.width), float(mb.height)

    overlay = make_overlay(w, h, values)

    for i, page in enumerate(tmpl.pages):
        if i == 0:
            page.merge_page(overlay.pages[0])
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    out.seek(0)
    return out.getvalue()

def read_template_bytes():
    key = TEMPLATE_PATH or "templates/2404-template.pdf"
    obj = s3_client().get_object(Bucket=UPLOADS_BUCKET, Key=key)
    return obj["Body"].read()

def ddb_query_team_items(team_id):
    from boto3.dynamodb.types import TypeDeserializer
    deser = TypeDeserializer()

    resp = ddb_client().query(
        TableName=TABLE_NAME,
        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues={
            ":pk": {"S": f"TEAM#{team_id}"},
            ":sk": {"S": "ITEM#"}
        }
    )
    return [{k: deser.deserialize(v) for k, v in raw.items()} for raw in resp.get("Items", [])]

def ddb_get_team(team_id):
    from boto3.dynamodb.types import TypeDeserializer
    deser = TypeDeserializer()

    resp = ddb_client().get_item(
        TableName=TABLE_NAME,
        Key={"PK": {"S": f"TEAM#{team_id}"}, "SK": {"S": "METADATA"}},
        ConsistentRead=True,
    )
    item = resp.get("Item")
    return {k: deser.deserialize(v) for k, v in item.items()} if item else {}


def s3_put_pdf(bucket, key, body):
    kms = os.environ.get("KMS_KEY_ARN", "").strip()
    params = {
        "Bucket": bucket,
        "Key": key,
        "Body": body,
        "ContentType": "application/pdf"
    }
    if kms:
        params["ServerSideEncryption"] = "aws:kms"
        params["SSEKMSKeyId"] = kms
    s3_client().put_object(**params)

def to_pdf_values(payload):
    reports = payload.get("damageReports") or []
    if isinstance(reports, str):
        reports = [r for r in reports.splitlines() if r.strip()]
    if not reports:
        reports = ["N/A"]

    return {
        "ORGANIZATION": payload.get("name") or "N/A",
        "NOMENCLATURE": (payload.get("actualName") or "").strip(),
        "SERIAL_NUMBER": payload.get("serialNumber") or payload.get("nsn") or "N/A",
        "DATE": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "REMARKS_LIST": reports,
    }

def _resp(code, body=None):
    return {
        "statusCode": code,
        "headers": CORS,
        "body": json.dumps(body or {})
    }

def lambda_handler(event, context):
  
    if isinstance(event, dict) and "teamId" in event:
        payload = event
        method = "POST"
    else:
        method = (event.get("httpMethod") or "").upper()
        if method == "POST":
            raw = event.get("body") or "{}"
            if event.get("isBase64Encoded"):
                raw = base64.b64decode(raw).decode()
            payload = json.loads(raw)
        else:
            payload = {}

    if method == "OPTIONS":
        return _resp(200, {})
    if method == "GET":
        return _resp(200, {"ok": True})
    if method != "POST":
        return _resp(405, {"error": "Method not allowed"})

    team_id = (payload.get("teamId") or "").strip()
    if not team_id:
        return _resp(400, {"error": "teamId is required"})

    tmpl = read_template_bytes()
    items = ddb_query_team_items(team_id)
    team = ddb_get_team(team_id)

    root_name = team.get("name") or "N/A"

    damaged = []
    for itm in items:
        rep = itm.get("damageReports")
        if isinstance(rep, list) and rep:
            damaged.append(itm)
        elif isinstance(rep, str) and rep.strip():
            damaged.append(itm)

    if not damaged:
        return _resp(200, {"ok": True, "message": "No damaged items"})

    writer = PdfWriter()

    for itm in damaged:
        values = to_pdf_values({
            "name": root_name,
            "actualName": itm.get("actualName") or itm.get("name"),
            "serialNumber": itm.get("serialNumber"),
            "damageReports": itm.get("damageReports")
        })
        stamped = stamp(tmpl, values)
        for p in PdfReader(io.BytesIO(stamped)).pages:
            writer.add_page(p)

    out = io.BytesIO()
    writer.write(out)
    pdf_bytes = out.getvalue()

    safe_team_name = (root_name or "team").replace(" ", "_").replace("/", "_")
    file = f"2404_{safe_team_name}.pdf"
    key = f"Documents/{team_id}/2404/{file}"
    key = f"Documents/{team_id}/2404/{file}"

    s3_put_pdf(UPLOADS_BUCKET, key, pdf_bytes)

    url = s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": UPLOADS_BUCKET, "Key": key},
        ExpiresIn=3600
    )

    return _resp(200, {"ok": True, "url": url, "s3Key": key, "teamId": team_id})

main = lambda_handler
