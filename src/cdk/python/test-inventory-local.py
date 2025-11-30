from inventory_handler import render_inventory_csv

sample_data = {
    "overrides": {
        "fe": "FE123",
        "uic": "UIC999",
        "teamName": "Alpha Team",
        "endItemDesc": "Default End Item Description",
    },
    "items": [
        # --- Group 1: NIIN-1 / LIN-1 ---

        # Root 1
        {
            "itemId": "KIT1",
            "parent": None,
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "endItemDesc": "Vehicle Tool Kit",
            "name": "Toolkit Alpha",
            "nsn": "NSN-0001",
            "description": "Main toolkit for vehicle A",
            "authQuantity": 1,
            "ohQuantity": 1,
        },
        # Child of KIT1
        {
            "itemId": "ITEM1",
            "parent": "KIT1",
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "name": "Wrench Set",
            "nsn": "NSN-0002",
            "description": "Full wrench assortment",
            "authQuantity": 1,
            "ohQuantity": 1,
        },
        # Grandchild of ITEM1
        {
            "itemId": "ITEM1A",
            "parent": "ITEM1",
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "name": "Small Wrench",
            "nsn": "NSN-0003",
            "description": "Small size wrench",
            "authQuantity": 2,
            "ohQuantity": 2,
        },
        # Root 2 in same NIIN/LIN group
        {
            "itemId": "KIT2",
            "parent": None,
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "name": "Toolkit Bravo",
            "nsn": "NSN-0004",
            "description": "Secondary toolkit",
            "authQuantity": 1,
            "ohQuantity": 1,
        },
        # Child of KIT2
        {
            "itemId": "ITEM2",
            "parent": "KIT2",
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "name": "Hammer",
            "nsn": "NSN-0005",
            "description": "Standard hammer",
            "authQuantity": 1,
            "ohQuantity": 1,
        },

        # --- Group 2: NIIN-2 / LIN-2 ---

        {
            "itemId": "KIT3",
            "parent": None,
            "endItemNiin": "NIIN-2",
            "liin": "LIN-2",
            "endItemDesc": "Communications Kit",
            "name": "Radio Set",
            "nsn": "NSN-0100",
            "description": "Radio base unit",
            "authQuantity": 1,
            "ohQuantity": 1,
        },
        {
            "itemId": "ITEM3",
            "parent": "KIT3",
            "endItemNiin": "NIIN-2",
            "liin": "LIN-2",
            "name": "Handset",
            "nsn": "NSN-0101",
            "description": "Radio handset",
            "authQuantity": 2,
            "ohQuantity": 1,
        },
    ],
}


if __name__ == "__main__":
    csv_bytes = render_inventory_csv(sample_data)

    # Show CSV in terminal
    print(csv_bytes.decode("utf-8"))

    # Save to file
    with open("test_inventory.csv", "wb") as f:
        f.write(csv_bytes)

    print("\nWrote test_inventory.csv")
