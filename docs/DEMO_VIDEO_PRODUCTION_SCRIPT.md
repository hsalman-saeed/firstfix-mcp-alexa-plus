# FIRSTFIX MCP — 2:45 DEMO VIDEO PRODUCTION SCRIPT & SHOT LIST
**Target Duration:** 2 minutes 45 seconds (165 seconds)  
**Live Production URL:** `https://qe2khmjs7zmipvuuk2ailnsq340lfhrg.lambda-url.us-east-1.on.aws`  
**Video Resolution:** 1080p 60fps (Full Screen Browser with Dual-Screen Echo Show 15 Simulator + Fleet Console)  
**Audio:** Clear, professional developer narration with live UI interaction sound effects

---

## SCENE-BY-SCENE TIMED RUNBOOK & SHOT LIST

### SCENE 1: THE $150–$180 "SECOND TRUCK ROLL" CRISIS (0:00 – 0:25)
- **Time:** `0:00 - 0:25` (25 seconds)
- **Visual:** Split screen showing home appliance repair truck departing empty-handed vs. FirstFix MCP Echo Show 15 Dual-Screen Simulator (`https://qe2khmjs7zmipvuuk2ailnsq340lfhrg.lambda-url.us-east-1.on.aws/`).
- **Narration (Voiceover):**  
  *"Over 37% of residential appliance, HVAC, and plumbing service calls fail on the very first visit. Why? Because the contractor dispatched an available technician whose van wasn't stocked with the exact OEM part required for that specific serial production run. That wasted second truck roll costs homeowners days of waiting and costs contractors $150 to $180 in lost margin.*  
  *Meet FirstFix MCP—the first multimodal diagnostic, serial-variant OEM part matcher, and stocked-van booking engine built natively for Alexa+, Ring, and AWS Bedrock."*

---

### SCENE 2: SCENARIO 1 — BOSCH FD99 MULTIMODAL VISION & SERIAL DISAMBIGUATION (0:25 – 0:55)
- **Time:** `0:25 - 0:55` (30 seconds)
- **Visual:** On the live Echo Show 15 Simulator, click Preset 1: `"Bosch Dishwasher E24 (FD99 - 2019+ BLDC)"`. Click `"Simulate Alexa+ Voice Interaction & Image Upload"`.
- **UI Action:** The Echo Show 15 displays the rating plate thumbnail (`SHPM65Z55N/01`, `FD991001234`). Amazon Bedrock Nova Pro processes the image, and the deterministic BOM engine returns the interactive MCP App (`ui://firstfix/bom-diagram`).
- **Narration:**  
  *"Let's test Scenario 1. A homeowner says: 'Alexa, my Bosch dishwasher is flashing error E24 and won't drain.' Using the Echo Show 15 camera, Alexa captures the rating plate. Amazon Bedrock Nova Pro extracts the exact model and FD serial batch.*  
  *Watch this: In 2019, Bosch switched from an AC twist-lock pump to a 3-prong brushless DC pump in batch FD99. Fitting the wrong pump burns out the control board. FirstFix's deterministic BOM engine disambiguates the exact OEM part—SKU BOSCH-00631200—in under 35 milliseconds, with zero AI hallucinations."*

---

### SCENE 3: 1-TAP UCP CHECKOUT & REAL-TIME VAN STOCK DECREMENT (0:55 – 1:25)
- **Time:** `0:55 - 1:25` (30 seconds)
- **Visual:** Focus on the Contractor Fleet Matrix panel on the right side of the screen. Van #4 (Marcus Vance) shows 2 units of `BOSCH-00631200`. Van #2 (Unstocked) is greyed out. Inside the Echo Show 15 visual card, click `"Confirm $85 Deposit & Book 2:00 PM Slot"`.
- **UI Action:** UCP checkout session completes with 24h `Idempotency-Key`. Van #4 stock immediately decrements from **2 to 1**. Appointment card appears with confirmed booking ID and cryptographic `correlationToken`.
- **Narration:**  
  *"Next, FirstFix queries the local contractor fleet. Van #2 is available on the calendar, but has zero pumps in stock. Traditional booking apps would send Van #2 and fail. FirstFix excludes Van #2 and books Van #4 with Marcus Vance, who has the pump on his truck right now.*  
  *With one tap via Universal Commerce Protocol, the homeowner pays a transparent $85 diagnostic deposit—fully credited toward the repair balance. The 24-hour idempotent transaction executes, Van #4 inventory decrements from 2 to 1 in real time, and an Alexa+ Local Booking SPI appointment is confirmed."*

---

### SCENE 4: SCENARIO 2 — BLURRY FD98 RATING PLATE & HUMAN CONFIRMATION GATE (1:25 – 1:50)
- **Time:** `1:25 - 1:50` (25 seconds)
- **Visual:** Click Preset 2: `"Bosch Dishwasher (FD98 - Blurry Rating Plate)"`.
- **UI Action:** The vision engine returns an OCR confidence score of `0.78` (<0.90 threshold). The system does NOT guess. An amber modal appears: `"Requires Homeowner Serial Confirmation: Is your FD number FD98 or FD99?"`. Click `"Confirm FD98 (Legacy AC Twist-Lock)"`. The system resolves legacy pump `BOSCH-00611332`.
- **Narration:**  
  *"Now let's examine our strict reliability counterfactual. What happens when the rating plate photo is blurry? Here, Bedrock Nova Pro calculates a confidence score of 0.78, triggering our <0.90 safety gate.*  
  *FirstFix never hallucinates or guesses on mechanical parts. It pauses the workflow and asks the homeowner for voice confirmation. Once confirmed as FD98, the engine accurately selects legacy pump BOSCH-00611332. That's the difference between a first-visit fix and a ruined kitchen floor."*

---

### SCENE 5: RING SMART ARRIVAL & BIOMETRIC/PASS VERIFICATION (1:50 – 2:15)
- **Time:** `1:50 - 2:15` (25 seconds)
- **Visual:** On the Ring Smart Arrival simulator panel, select technician Marcus Vance (`TECH-MV-401`). Click `"Simulate Ring Doorbell Arrival"`. Ring Access Controller displays `"ACCESS GRANTED — Marcus Vance (Apex Home Services) — Van #4 Verified"`. Then click `"Simulate Unauthorized Person"`, showing immediate `"ACCESS DENIED"`.
- **Narration:**  
  *"Home service dispatch also requires physical security. FirstFix generates a temporary 2-hour digital access window via Ring Smart Access. When Marcus Vance arrives, the Ring Video Doorbell verifies his technician dispatch badge against our cryptographically signed correlation token and unlocks the service entryway. An unauthorized visitor attempting entry is instantly denied and flagged."*

---

### SCENE 6: SCENARIO 4 — GAS LEAK PRE-INFERENCE EMERGENCY SAFETY HALT (2:15 – 2:30)
- **Time:** `2:15 - 2:30` (15 seconds)
- **Visual:** Click Preset 4: `"Gas Water Heater (Rotten Egg Gas Odor Hazard)"`.
- **UI Action:** The entire screen flashes red. The simulator locks out all booking and BOM tools. Loud voice and visual alert: `"CRITICAL EMERGENCY — EVACUATE IMMEDIATELY — DO NOT OPERATE SWITCHES — CALL GAS UTILITY"`.
- **Narration:**  
  *"Safety always comes before software. When a homeowner reports the smell of rotten eggs near a gas water heater, FirstFix's life-safety guardrail executes a pre-inference halt in under 2 milliseconds. It locks all booking tools and commands immediate household evacuation and emergency contact numbers."*

---

### SCENE 7: LIVE AWS US-EAST-1 CLOUD ARCHITECTURE & OPEN SOURCE SDK (2:30 – 2:45)
- **Time:** `2:30 - 2:45` (15 seconds)
- **Visual:** Show the live Cloud Architecture diagram and GitHub repository for `packages/alexa-plus-ucp-mcp-kit`.
- **Narration:**  
  *"FirstFix MCP is deployed 100% live right now on AWS us-east-1 using a public Lambda Function URL, DynamoDB on-demand persistence, and Bedrock Nova Pro. To empower the entire developer community, we've open-sourced our core protocol tooling as the MIT-licensed alexa-plus-ucp-mcp-kit on GitHub.*  
  *Zero second truck rolls. Guaranteed first-visit fix. Built for Alexa+, Ring, and AWS."*
