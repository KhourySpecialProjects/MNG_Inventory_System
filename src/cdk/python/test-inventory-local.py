

from inventory_handler import render_inventory_csv   


sample_data = {
    "overrides": {
        "fe": "FE123",
        "uic": "UIC999",
        "teamName": "Alpha Team",
        "endItemDesc": "Default End Item Description",
    },
    "items": [
        
        # Root 1
        {
            "itemId": "KIT1",
            "parent": None,
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "endItemDesc": "Vehicle Tool Kit",
            "name": "Toolkit Alpha",
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
            "description": "Small size wrench",
            "authQuantity": 2,
            "ohQuantity": 2,
        },
       
        {
            "itemId": "KIT2",
            "parent": None,
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "name": "Toolkit Bravo",
            "description": "Secondary toolkit",
            "authQuantity": 1,
            "ohQuantity": 1,
        },
       
        {
            "itemId": "ITEM2",
            "parent": "KIT2",
            "endItemNiin": "NIIN-1",
            "liin": "LIN-1",
            "name": "Hammer",
            "description": "Standard hammer",
            "authQuantity": 1,
            "ohQuantity": 1,
        },

       
        {
            "itemId": "KIT3",
            "parent": None,
            "endItemNiin": "NIIN-2",
            "liin": "LIN-2",
            "endItemDesc": "Communications Kit",
            "name": "Radio Set",
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
