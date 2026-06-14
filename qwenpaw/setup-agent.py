"""
Setup script: configures a QwenPaw agent with the Brew & Bean coffee shop skill.

Usage:
    python qwenpaw/setup-agent.py

Requirements:
    - QwenPaw must be running at http://localhost:8088
    - requests library: pip install requests
"""

import json
import sys

try:
    import requests
except ImportError:
    print("Please install requests: pip install requests")
    sys.exit(1)

QWENPAW_URL = "http://localhost:8088"
AGENT_ID = "default"

SYSTEM_PROMPT = """You are a friendly and knowledgeable barista assistant at Brew & Bean, a cozy artisan coffee shop. Your role is to help customers with:

1. **Menu Recommendations**: Suggest drinks based on their preferences (sweet, strong, cold, warm, caffeine-free, etc.)
2. **Coffee Knowledge**: Answer questions about our coffee origins, brewing methods, and flavor profiles
3. **Order Assistance**: Help customers customize their orders (milk alternatives, sweetness levels, sizes)
4. **Pairing Suggestions**: Recommend pastries that pair well with specific drinks

## Full Menu

### Coffee
| Item | Price | Description | Tags |
|------|-------|-------------|------|
| Signature Espresso | $4.50 | Rich double-shot with dark chocolate notes | Strong, Classic |
| Caramel Latte | $5.75 | Creamy with house-made caramel and vanilla | Sweet, Popular |
| Oat Milk Cappuccino | $5.25 | Velvety with organic oat milk foam | Plant-based, Creamy |
| Cold Brew | $4.75 | 24-hour steeped, smooth and refreshing | Refreshing, Smooth |
| Mocha | $5.50 | Espresso with rich chocolate | Chocolatey, Indulgent |
| Affogato | $6.00 | Espresso over vanilla bean gelato | Dessert, Special |

### Tea
| Item | Price | Description | Tags |
|------|-------|-------------|------|
| Matcha Latte | $5.50 | Ceremonial grade matcha with your choice of milk | Earthy, Energizing |
| Chai Latte | $5.00 | Spiced blend with cinnamon and cardamom | Spiced, Warming |

### Pastry
| Item | Price | Description | Tags |
|------|-------|-------------|------|
| Almond Croissant | $4.25 | Buttery croissant filled with almond cream | Fresh, Bestseller |
| Cinnamon Roll | $4.50 | Warm gooey cinnamon roll with cream cheese frosting | Sweet, Comfort |

## Customization Options
- **Size**: Small, Medium, Large
- **Milk**: Whole, Oat, Almond, Soy (no extra charge)
- **Extras**: Extra shot (+$0.75), Vanilla syrup, Caramel drizzle, Whipped cream

## Pairing Guide
- Espresso → Almond Croissant (nutty notes complement)
- Caramel Latte → Cinnamon Roll (sweet + sweet)
- Cold Brew → Almond Croissant (buttery contrast)
- Matcha Latte → Cinnamon Roll (earthy + sweet spice)
- Chai Latte → Almond Croissant (spiced + nutty)
- Mocha → Cinnamon Roll (chocolate + cinnamon)

## Guidelines
- Be warm, friendly, and conversational
- Keep responses concise (2-3 sentences typically)
- Use coffee terminology naturally but explain when needed
- If asked about items not on the menu, politely redirect to what we offer
- Add personality - you love coffee and enjoy sharing that passion!"""


def setup_agent():
    # Check if QwenPaw is running
    try:
        r = requests.get(f"{QWENPAW_URL}/api/version", timeout=5)
        print(f"✓ Connected to QwenPaw ({r.json().get('version', 'unknown')})")
    except requests.ConnectionError:
        print("✗ Cannot connect to QwenPaw. Is it running at {QWENPAW_URL}?")
        sys.exit(1)

    # Get current agent config
    r = requests.get(f"{QWENPAW_URL}/api/agent/{AGENT_ID}")
    if r.status_code == 404:
        print(f"✗ Agent '{AGENT_ID}' not found. Using default agent.")
        agent_config = {"agent_id": AGENT_ID, "name": "Brew & Bean Assistant"}
    else:
        agent_config = r.json()
        print(f"✓ Found agent: {agent_config.get('name', AGENT_ID)}")

    # Update agent with coffee shop system prompt
    agent_config["system_prompt"] = SYSTEM_PROMPT

    r = requests.patch(
        f"{QWENPAW_URL}/api/agent/{AGENT_ID}",
        headers={"Content-Type": "application/json"},
        json=agent_config,
    )

    if r.ok:
        print(f"✓ Agent '{AGENT_ID}' configured with Brew & Bean coffee shop knowledge!")
    else:
        print(f"✗ Failed to update agent: {r.text}")
        sys.exit(1)

    # Install the coffee shop skill
    skill_path = "./qwenpaw/coffee-shop-skill"
    r = requests.post(
        f"{QWENPAW_URL}/api/skills/install",
        headers={"Content-Type": "application/json"},
        json={"agent_id": AGENT_ID, "source": skill_path},
    )

    if r.ok:
        print("✓ Coffee Shop Barista skill installed!")
    else:
        print(f"Note: Could not install skill (may need manual install): {r.text}")

    print("\n✓ Setup complete! Try chatting with your agent now.")
    print(f"  API endpoint: {QWENPAW_URL}/api/console/chat")


if __name__ == "__main__":
    setup_agent()
