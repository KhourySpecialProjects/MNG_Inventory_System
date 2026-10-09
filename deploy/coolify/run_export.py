"""Runs one of SupplyNet's export scripts the way AWS Lambda used to.

Usage: python3 run_export.py <handler.py>   (the event JSON is read from stdin)
The result is printed after a __RESULT__ marker, or an error after __ERROR__.
"""
import importlib.util
import json
import os
import sys
import tempfile
import traceback

# Garage needs path-style addresses (https://host/bucket/key), so tell boto3 before it loads.
_cfg = os.path.join(tempfile.gettempdir(), "supplynet-aws-config")
with open(_cfg, "w") as f:
    f.write("[default]\ns3 =\n    addressing_style = path\n")
os.environ["AWS_CONFIG_FILE"] = _cfg


def main():
    handler_path = sys.argv[1]
    event = json.loads(sys.stdin.read() or "{}")
    try:
        spec = importlib.util.spec_from_file_location("export_handler", handler_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        result = module.lambda_handler(event, None)
        sys.stdout.write("\n__RESULT__" + json.dumps(result, default=str) + "\n")
    except Exception as exc:  # report the failure back to the API
        traceback.print_exc()
        sys.stdout.write("\n__ERROR__" + json.dumps({"errorMessage": str(exc)}) + "\n")


if __name__ == "__main__":
    main()
