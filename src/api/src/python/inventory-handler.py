import os, io, json, base64, uuid, math
from datetime import datetime, timezone
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
import boto3

UPLOADS_BUCKET = os.environ.get("UPLOADS_BUCKET", "").strip()   
PHOTO_BUCKET   = os.environ.get("PHOTO_BUCKET", "").strip()
TABLE_NAME     = os.environ.get("TABLE_NAME", "").strip()

s3  = boto3.client("s3")
ddb = boto3.client("dynamodb")

COLS = [
    ("Image",       56),
    ("Material",    52),
    ("LV",          28),
    ("Description", 170),
    ("WTY",         38),
    ("ARC",         28),
    ("CIIC",        28),
    ("UI",          26),
    ("SCMC",        30),
    ("Auth Qty",    42),
    ("OH Qty",      42),
]

# ---- Layout constants ----
LEFT_MARGIN, RIGHT_MARGIN = 36, 36
PAGE_W = 612
TOP_Y          = 760
HEADER_LINE_H  = 14
TITLE_H        = 14
TABLE_HDR_H    = 22
ROW_H          = 46
BOTTOM_MARGIN  = 72
GAP            = 6

def na(v):
    """Return 'N/A' for missing/empty values; keep 0 and non-empty strings."""
    if v is None:
        return "N/A"
    if isinstance(v, str):
        s = v.strip()
        return s if s else "N/A"
    return v

def ddb_get(pk, sk="LATEST"):
    resp = ddb.get_item(
        TableName=TABLE_NAME,
        Key={"PK": {"S": pk}, "SK": {"S": sk}},
        ConsistentRead=True
    )
    if "Item" not in resp:
        raise RuntimeError("DDB item not found")
    from boto3.dynamodb.types import TypeDeserializer
    return {k: TypeDeserializer().deserialize(v) for k, v in resp["Item"].items()}

def s3_bytes(bucket, key):
    if not key:
        return None
    obj = s3.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read()

def draw_header_block(c, d, page_num, page_count):
    left, right = LEFT_MARGIN, PAGE_W - RIGHT_MARGIN
    y = TOP_Y
    c.setFont("Helvetica", 9)

    # Four header lines (with N/A defaults)
    c.drawString(left, y, f"FE: {na(d.get('fe'))}  UIC: {na(d.get('uic'))}  DESC: {na(d.get('unitDesc'))}")
    y -= HEADER_LINE_H

    ei = d.get("endItem", {}) or {}
    c.drawString(left, y, f"END ITEM NIIN: {na(ei.get('niin'))}  LIN: {na(ei.get('lin'))}  DESC: {na(ei.get('desc'))}")
    y -= HEADER_LINE_H

    pub = d.get("pub", {}) or {}
    c.drawString(left, y, f"PUB NUM: {na(pub.get('num'))}  PUB DATE: {na(pub.get('date'))}  BOM LAST UPDATED: {na(pub.get('bomUpdated'))}")
    y -= HEADER_LINE_H

    c.drawString(left, y, f"SER/EQUIP NO: {na(d.get('serEquipNo'))}   TO: {na(d.get('to'))}   FROM: {na(d.get('from'))}   SLOC: {na(d.get('sloc'))}")
    y -= (HEADER_LINE_H + 4)

    # Title line
    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, "COMPONENT LISTING / HAND RECEIPT")
    c.setFont("Helvetica", 8)
    c.drawString(left + 280, y, "(line-out whichever is not applicable)")

    # Date + pagination (right)
    c.setFont("Helvetica", 9)
    c.drawRightString(right, TOP_Y, f"Date: {d.get('date') or datetime.now().strftime('%Y-%m-%d')}")
    c.drawRightString(right, TOP_Y - HEADER_LINE_H, f"Page {page_num} of {page_count}")

def draw_table_header(c, y):
    c.setFont("Helvetica-Bold", 9)
    x = LEFT_MARGIN
    for name, w in COLS:
        c.rect(x, y - TABLE_HDR_H, w, TABLE_HDR_H, stroke=1, fill=0)
        c.drawString(x + 3, y - TABLE_HDR_H + 6, name)
        x += w
    return y - TABLE_HDR_H

def wrap_text(txt, width, font="Helvetica", size=8):
    words = (txt or "").split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(test, font, size) <= width:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

def draw_row(c, y, row):
    c.setFont("Helvetica", 8)
    x = LEFT_MARGIN
    cells = [
        ("imageKey", None),
        ("material", str),
        ("lv", str),
        ("description", str),
        ("wty", str),  
        ("arc", str),
        ("ciic", str),
        ("ui", str),
        ("scmc", str),
        ("authQty", lambda v: f"{v}"),
        ("ohQty",   lambda v: f"{v}"),
    ]
    for idx, ((field, cast), (_, w)) in enumerate(zip(cells, COLS)):
        c.rect(x, y - ROW_H, w, ROW_H, stroke=1, fill=0)
        val = row.get(field)

        if idx == 0 and na(row.get("imageKey")) != "N/A":
            # image cell
            try:
                b = s3_bytes(PHOTO_BUCKET, row.get("imageKey"))
                if b:
                    img = ImageReader(io.BytesIO(b))
                    c.drawImage(img, x + 2, y - ROW_H + 2, width=w - 4, height=ROW_H - 4,
                                preserveAspectRatio=True, anchor='sw')
                else:
                    c.setFont("Helvetica-Oblique", 7)
                    c.drawCentredString(x + w/2, y - ROW_H/2, "N/A")
                    c.setFont("Helvetica", 8)
            except Exception:
                c.setFont("Helvetica-Oblique", 7)
                c.drawCentredString(x + w/2, y - ROW_H/2, "N/A")
                c.setFont("Helvetica", 8)
        else:
            # text cells (N/A fallback)
            raw = na(val)
            txt = raw if cast is None or raw == "N/A" else cast(raw)
            if field == "description":
                lines = wrap_text(txt if txt != "N/A" else "N/A", w - 6)
                max_lines = max(1, (ROW_H - 6) // 10)
                for i, line in enumerate(lines[:max_lines]):
                    c.drawString(x + 3, y - 12 - i * 10, line)
                if len(lines) > max_lines:
                    c.drawRightString(x + w - 3, y - 12 - (max_lines - 1) * 10, "…")
            else:
                c.drawString(x + 3, y - 12, str(txt))
        x += w
    return y - ROW_H

def draw_signature_block(c):
    y = BOTTOM_MARGIN + 40
    x = LEFT_MARGIN
    c.setFont("Helvetica", 9)
    labels = [("ISSUED BY:", 120), ("SIGNATURE:", 160), ("DATE:", 100), ("GRADE:", 80)]
    for _ in range(2):
        cx = x
        for label, w in labels:
            c.drawString(cx, y, label)
            c.line(cx + pdfmetrics.stringWidth(label, "Helvetica", 9) + 6, y + 1, cx + w, y + 1)
            cx += w + 20
        y -= 24

def render_inventory_pdf(d):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    rows = d.get("items", []) or []

    # compute rows per page
    y = TOP_Y
    y -= (HEADER_LINE_H * 4 + 4)  # header block
    y -= (TITLE_H + 4)            # title line
    y -= GAP
    y -= TABLE_HDR_H
    usable = y - BOTTOM_MARGIN
    rows_per_page = max(1, int(usable // ROW_H))
    page_count = max(1, math.ceil(len(rows) / rows_per_page)) if rows else 1

    # draw pages
    c = canvas.Canvas(buf, pagesize=letter)
    c.setTitle("Component Listing / Hand Receipt")
    idx = 0
    for page in range(1, page_count + 1):
        draw_header_block(c, d, page, page_count)
        y = TOP_Y
        y -= (HEADER_LINE_H * 4 + 4)
        y -= (TITLE_H + 4)
        y -= GAP
        y = draw_table_header(c, y)
        for _ in range(rows_per_page):
            if idx >= len(rows):
                break
            # normalize each row with N/A fallbacks
            r = rows[idx] or {}
            norm = {
                "imageKey": r.get("imageKey") or r.get("imageLink") or None,
                "material": na(r.get("material")),
                "lv":       na(r.get("lv")),
                "description": na(r.get("description") or r.get("name") or r.get("actualName")),
                "wty":      na(r.get("wty")),
                "arc":      na(r.get("arc")),
                "ciic":     na(r.get("ciic")),
                "ui":       na(r.get("ui")),
                "scmc":     na(r.get("scmc")),
                "authQty":  r.get("authQty") if r.get("authQty") is not None else "N/A",
                "ohQty":    r.get("ohQty")   if r.get("ohQty")   is not None else "N/A",
            }
            y = draw_row(c, y, norm)
            idx += 1
        if page == page_count:
            draw_signature_block(c)
        c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()

def s3_put_pdf(bucket, key, b):
    s3.put_object(Bucket=bucket, Key=key, Body=b, ContentType="application/pdf", ACL="private")

def _resp(code, body):
    return {
        "statusCode": code,
        "headers": {"Access-Control-Allow-Origin": "*", "Cache-Control": "no-store"},
        "body": json.dumps(body)
    }

def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _resp(200, "")

    if event.get("httpMethod") != "POST":
        return _resp(405, {"error": "Use POST"})

    try:
        payload = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp(400, {"error": "Invalid JSON"})

    pk = payload.get("pk")
    sk = payload.get("sk", "LATEST")
    save_to_s3 = bool(payload.get("saveToS3", True))

    try:
        d = ddb_get(pk, sk)
    except Exception as e:
        return _resp(404, {"error": f"DDB not found: {e}"})

    try:
        pdf_bytes = render_inventory_pdf(d)
    except Exception as e:
        return _resp(500, {"error": f"PDF build failed: {e}"})

    # filename derived from NSN
    nsn = (d.get("nsn")
           or (d.get("endItem") or {}).get("niin")
           or str(uuid.uuid4()))
    filename = f"{nsn}.pdf"

    if save_to_s3:
        key = f"Documents/inventory/{filename}"  
        try:
            s3_put_pdf(UPLOADS_BUCKET, key, pdf_bytes)
        except Exception as e:
            return _resp(500, {"error": f"S3 put failed: {e}"})
        return _resp(200, {"ok": True, "s3Key": key, "contentType": "application/pdf", "downloadB64": None})

    b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    return _resp(200, {"ok": True, "s3Key": None, "contentType": "application/pdf", "downloadB64": b64})
