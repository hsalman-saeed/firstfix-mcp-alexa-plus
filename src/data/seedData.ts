import {
  OEMCatalogRule,
  HazardShutoffRule,
  ContractorVan,
  HouseholdEquipmentRecord,
} from '../types/index.js';

export const OEMCatalogBOM: OEMCatalogRule[] = [
  // 1. Bosch Dishwasher E24 Drainage Error (Signature Disambiguation Case)
  {
    brand: 'Bosch',
    modelNumber: 'SHPM65Z55N/01',
    category: 'DISHWASHER',
    errorCode: 'E24',
    errorDescription: 'Dishwasher fails to drain water within programmed cycle timeout',
    defaultSafePrecheck:
      'Check and snap shut the white plastic sump pump cover inside the bottom filter well (no tools required). If loose, pump cavitation triggers E24 error.',
    serialRanges: [
      {
        serialPrefixStart: 'FD99000000',
        serialPrefixEnd: 'FD99999999',
        serialPatternDescription: 'Manufacture date 2019+ (Batch FD99+)',
        oemPartSku: 'BOSCH-00631200',
        partName: 'Bosch 3-Prong BLDC Drain Pump Assembly',
        oemPartCostUsd: 42.0,
        whySerialVariantMatters:
          'Bosch migrated to a 3-prong brushless DC (BLDC) drain pump in FD99 production. Attempting to fit the older twist-lock pump causes direct control module short-circuit.',
        safe90sDiyPrecheck:
          'Check and snap shut the white plastic sump pump cover inside the bottom filter well (no tools required).',
        standardWarrantyYears: 2,
      },
      {
        serialPrefixStart: 'FD97000000',
        serialPrefixEnd: 'FD98999999',
        serialPatternDescription: 'Manufacture date 2017-2018 (Batch FD97-FD98)',
        oemPartSku: 'BOSCH-00611332',
        partName: 'Bosch Legacy Twist-Lock Drain Pump',
        oemPartCostUsd: 46.0,
        whySerialVariantMatters:
          'Legacy FD97-FD98 chassis uses an AC synchronous twist-lock bayonet mount pump with twin spade terminals.',
        safe90sDiyPrecheck:
          'Inspect and clear food debris from the wire mesh filter basket at the base of the tub.',
        standardWarrantyYears: 2,
      },
    ],
  },

  // 2. Rheem Performance Plus Gas Water Heater FV / Thermal Fault (Signature Disambiguation Case)
  {
    brand: 'Rheem',
    modelNumber: 'XG50T06EC36U1',
    category: 'WATER_HEATER',
    errorCode: '4_FLASHES',
    errorDescription: 'Status LED 4 flashes: Flammable Vapor (FV) sensor lockout or high chamber thermal cutoff',
    defaultSafePrecheck:
      'Inspect outer combustion air intake base ring for lint or pet hair accumulation choking flame airflow. Clean with dry microfiber cloth (no tools).',
    serialRanges: [
      {
        serialPrefixStart: 'M0122',
        serialPrefixEnd: 'M5226',
        serialPatternDescription: 'Manufactured Week 01 2022 to Week 52 2026',
        oemPartSku: 'RHEEM-SP20172',
        partName: 'Flammable Vapor (FV) Sensor & Harness Kit',
        oemPartCostUsd: 34.0,
        whySerialVariantMatters:
          'Post-2022 Rheem tanks use an updated solid-state FV resistance sensor with keyed 3-pin moisture-sealed harness. Older 2-pin sensors fail to communicate with the Honeywell gas valve.',
        safe90sDiyPrecheck:
          'Check for solvents, fresh paint, or gasoline canisters within 20 feet of the water heater base and relocate them outside.',
        standardWarrantyYears: 6,
      },
      {
        serialPrefixStart: 'M0115',
        serialPrefixEnd: 'M5221',
        serialPatternDescription: 'Manufactured Week 01 2015 to Week 52 2021',
        oemPartSku: 'RHEEM-SP20170',
        partName: 'Legacy Thermal Cutoff Switch & Pilot Assembly',
        oemPartCostUsd: 38.0,
        whySerialVariantMatters:
          'Pre-2022 models utilize a fusible link glass thermal switch integrated into the sealed burner door assembly.',
        safe90sDiyPrecheck:
          'Verify that the lower glass sight window is clean and pilot flame is not yellow or sooting.',
        standardWarrantyYears: 6,
      },
    ],
  },

  // 3. Carrier Comfort Central AC Condenser Run Capacitor (Signature Disambiguation Case)
  {
    brand: 'Carrier',
    modelNumber: '24ACC636A003',
    category: 'AC_CONDENSER',
    errorCode: 'NO_COOL_HUMMING',
    errorDescription: 'Condenser fan motor runs but compressor hums and fails to turn over',
    defaultSafePrecheck:
      'Verify that the outdoor disconnect switch handle is pulled all the way up and circuit breaker in main panel is not tripped.',
    serialRanges: [
      {
        serialPrefixStart: '2021',
        serialPrefixEnd: '2026',
        serialPatternDescription: 'Series Year 2021-2026 production',
        oemPartSku: 'CARRIER-HC98JA045D',
        partName: '45+5 uF 370V/440V Oval Dual Run Capacitor',
        oemPartCostUsd: 28.0,
        whySerialVariantMatters:
          'Carrier revised the high-efficiency scroll compressor in 2021, requiring an oval 45+5 uF capacitor. Round capacitors do not fit inside the weatherproof electrical partition without pinching wiring.',
        safe90sDiyPrecheck:
          'Inspect the outdoor condenser fins for blanketed cottonwood or grass clippings choking air exhaust.',
        standardWarrantyYears: 10,
      },
      {
        serialPrefixStart: '2015',
        serialPrefixEnd: '2020',
        serialPatternDescription: 'Series Year 2015-2020 production',
        oemPartSku: 'CARRIER-HC98JA040D',
        partName: '40+5 uF 370V/440V Round Dual Run Capacitor',
        oemPartCostUsd: 26.0,
        whySerialVariantMatters:
          'Pre-2021 compressors use a 40+5 uF round capacitor with a cylindrical mounting clamp.',
        safe90sDiyPrecheck:
          'Ensure the outdoor unit service disconnect fuse pull-out is firmly seated.',
        standardWarrantyYears: 10,
      },
    ],
  },

  // 4. Whirlpool Washer Long Drain Error
  {
    brand: 'Whirlpool',
    modelNumber: 'WTW5000DW0',
    category: 'WASHER',
    errorCode: 'F21',
    errorDescription: 'Long drain timeout exceeding 8 minutes',
    serialRanges: [
      {
        serialPrefixStart: 'C5000000',
        serialPrefixEnd: 'C9999999',
        serialPatternDescription: 'Production run C5000000-C9999999',
        oemPartSku: 'WHIRL-W10874400',
        partName: 'Whirlpool High-Efficiency Shrouded Drain Pump',
        oemPartCostUsd: 52.0,
        whySerialVariantMatters:
          'Later revisions upgraded to a thermal overload protected shrouded pump motor to prevent lint binding.',
        safe90sDiyPrecheck:
          'Check that the standpipe drain hose is not pushed more than 4.5 inches down the pipe to prevent siphon lock.',
        standardWarrantyYears: 1,
      },
      {
        serialPrefixStart: 'C0000000',
        serialPrefixEnd: 'C4999999',
        serialPatternDescription: 'Production run C0000000-C4999999',
        oemPartSku: 'WHIRL-W10536347',
        partName: 'Whirlpool Direct-Drive Drain Pump',
        oemPartCostUsd: 48.0,
        whySerialVariantMatters:
          'Early production uses direct clip-on pump with open impeller housing.',
        safe90sDiyPrecheck:
          'Inspect the drain hose for sharp kinks or crushed bends behind the washer.',
        standardWarrantyYears: 1,
      },
    ],
  },

  // 5. Trane Gas Furnace Inducer Pressure Switch
  {
    brand: 'Trane',
    modelNumber: 'S9X1C080U4PSAA',
    category: 'FURNACE',
    errorCode: '3_FLASHES',
    errorDescription: 'Draft inducer pressure switch failed to close or stayed open during startup',
    serialRanges: [
      {
        serialPrefixStart: '21000',
        serialPrefixEnd: '26999',
        serialPatternDescription: 'Production 2021-2026',
        oemPartSku: 'TRANE-COL18544',
        partName: 'Trane Differential Draft Pressure Switch -0.65 WC',
        oemPartCostUsd: 54.0,
        whySerialVariantMatters:
          'Post-2021 heat exchanger redesign operates at -0.65 in W.C. vacuum cutoff. Installing a -0.50 switch causes nuisance soot shutdown.',
        safe90sDiyPrecheck:
          'Inspect outdoor PVC exhaust termination pipe for snow drift, bird nest, or ice blockage.',
        standardWarrantyYears: 5,
      },
      {
        serialPrefixStart: '15000',
        serialPrefixEnd: '20999',
        serialPatternDescription: 'Production 2015-2020',
        oemPartSku: 'TRANE-COL15201',
        partName: 'Trane Single-Port Pressure Switch -0.50 WC',
        oemPartCostUsd: 49.0,
        whySerialVariantMatters:
          'Legacy furnace utilizes a single-port barb calibrated at -0.50 in W.C.',
        safe90sDiyPrecheck:
          'Inspect the furnace air filter; a completely choked filter can cause cabinet negative pressure.',
        standardWarrantyYears: 5,
      },
    ],
  },

  // 6. AO Smith Water Heater Upper Thermistor
  {
    brand: 'AO Smith',
    modelNumber: 'G6-T5040NV',
    category: 'WATER_HEATER',
    errorCode: 'E02',
    errorDescription: 'Upper electronic temperature thermistor circuit open or shorted',
    serialRanges: [
      {
        serialPrefixStart: '2020',
        serialPrefixEnd: '2026',
        serialPatternDescription: 'Manufacture Year 2020-2026',
        oemPartSku: 'AOSMITH-100109275',
        partName: 'AO Smith Direct Immersion Upper Thermistor Sensor',
        oemPartCostUsd: 32.0,
        whySerialVariantMatters:
          '2020+ models use direct immersion brass well probe. Older dry-well clips read 20% cooler water temperatures.',
        safe90sDiyPrecheck:
          'Ensure the electrical plug for the top electronic display is fully pushed into its socket.',
        standardWarrantyYears: 6,
      },
      {
        serialPrefixStart: '2014',
        serialPrefixEnd: '2019',
        serialPatternDescription: 'Manufacture Year 2014-2019',
        oemPartSku: 'AOSMITH-100108683',
        partName: 'AO Smith Clip-on Surface Thermistor Probe',
        oemPartCostUsd: 29.0,
        whySerialVariantMatters:
          'Pre-2020 tanks use an insulated spring-clip exterior surface thermistor.',
        safe90sDiyPrecheck:
          'Confirm no water is dripping onto the upper control housing from overhead pipes.',
        standardWarrantyYears: 6,
      },
    ],
  },

  // 7. GE French Door Refrigerator Evaporator Fan
  {
    brand: 'GE',
    modelNumber: 'GFE28GSKSS',
    category: 'REFRIGERATOR',
    errorCode: 'FF_WARM',
    errorDescription: 'Fresh food compartment warm (52°F+) while freezer remains cold',
    serialRanges: [
      {
        serialPrefixStart: 'HD000000',
        serialPrefixEnd: 'HD999999',
        serialPatternDescription: 'Serial Series HD (2020+)',
        oemPartSku: 'GE-WR60X26866',
        partName: 'GE Evaporator Fan Motor with Variable Speed PWM',
        oemPartCostUsd: 64.0,
        whySerialVariantMatters:
          'Series HD uses a 4-pin DC variable speed fan motor with feedback tachometer. 3-pin fans cause motherboard communication lock.',
        safe90sDiyPrecheck:
          'Ensure food containers in the upper rear shelf are not blocking the cold air return louvers.',
        standardWarrantyYears: 1,
      },
      {
        serialPrefixStart: 'HA000000',
        serialPrefixEnd: 'HC999999',
        serialPatternDescription: 'Serial Series HA-HC (2015-2019)',
        oemPartSku: 'GE-WR60X10307',
        partName: 'GE Single-Speed Evaporator Fan Motor',
        oemPartCostUsd: 55.0,
        whySerialVariantMatters:
          'Early production utilizes standard constant-speed 12V DC evaporator motor.',
        safe90sDiyPrecheck:
          'Check that French door center mullion flap flips completely flush when doors close.',
        standardWarrantyYears: 1,
      },
    ],
  },

  // 8. Samsung Dryer Thermistor Fault
  {
    brand: 'Samsung',
    modelNumber: 'DVE45R6100W',
    category: 'DRYER',
    errorCode: 'tS',
    errorDescription: 'Temperature thermistor shorted or open circuit detected by main PCB',
    serialRanges: [
      {
        serialPrefixStart: '0120',
        serialPrefixEnd: '1226',
        serialPatternDescription: 'Production dates 2020 to 2026',
        oemPartSku: 'SAMSUNG-DC32-00007A',
        partName: 'Samsung NTC Temperature Thermistor Assembly',
        oemPartCostUsd: 22.0,
        whySerialVariantMatters:
          'Later models relocated the 10k ohm NTC thermistor to the blower housing exhaust flange with a locking bayonet terminal.',
        safe90sDiyPrecheck:
          'Remove and vacuum the lint trap screen and wash under warm tap water to remove invisible fabric softener wax coating.',
        standardWarrantyYears: 1,
      },
      {
        serialPrefixStart: '0114',
        serialPrefixEnd: '1219',
        serialPatternDescription: 'Production dates 2014 to 2019',
        oemPartSku: 'SAMSUNG-DC32-30006S',
        partName: 'Samsung Legacy High-Limit Thermostat Assembly',
        oemPartCostUsd: 24.0,
        whySerialVariantMatters:
          'Pre-2020 dryers use a screw-mount thermistor with spade disconnects.',
        safe90sDiyPrecheck:
          'Inspect the flexible exterior dryer vent duct behind the unit for crushed bends.',
        standardWarrantyYears: 1,
      },
    ],
  },

  // 9. Moen Smart Valve Cartridge
  {
    brand: 'Moen',
    modelNumber: 'S3102',
    category: 'SMART_VALVE',
    errorCode: 'FLOW_RESTRICTED',
    errorDescription: 'Internal flow rate sensor detects high head pressure with sub-normal GPM output',
    serialRanges: [
      {
        serialPrefixStart: 'M2021',
        serialPrefixEnd: 'M2026',
        serialPatternDescription: 'Smart Series 2021-2026',
        oemPartSku: 'MOEN-100588',
        partName: 'Moen 1-Inch Ceramic High-Flow Cartridge Assembly',
        oemPartCostUsd: 45.0,
        whySerialVariantMatters:
          '2021+ computerized valve bodies use a precision 1-inch motorized ceramic rotary disc.',
        safe90sDiyPrecheck:
          'Run the self-cleaning flush cycle via the Moen mobile app to purge mineral sediment.',
        standardWarrantyYears: 5,
      },
      {
        serialPrefixStart: 'M2017',
        serialPrefixEnd: 'M2020',
        serialPatternDescription: 'Smart Series 2017-2020',
        oemPartSku: 'MOEN-1222',
        partName: 'Moen Posi-Temp 1/2-Inch Brass Balancing Cartridge',
        oemPartCostUsd: 38.0,
        whySerialVariantMatters:
          'Earlier iterations use the standard 1/2-inch mechanical balancing spool.',
        safe90sDiyPrecheck:
          'Cycle the manual bypass lever 3 times to dislodge trapped pipe scale.',
        standardWarrantyYears: 5,
      },
    ],
  },

  // 10. KitchenAid Dishwasher Wash Motor Stall
  {
    brand: 'KitchenAid',
    modelNumber: 'KDTM404KPS',
    category: 'DISHWASHER',
    errorCode: 'F9E1',
    errorDescription: 'Wash motor failed to reach operating RPM during cycle',
    serialRanges: [
      {
        serialPrefixStart: 'W2021',
        serialPrefixEnd: 'W2026',
        serialPatternDescription: 'Production 2021 to 2026',
        oemPartSku: 'KITCH-W11414075',
        partName: 'KitchenAid Heavy-Duty Circulation Pump & Sump Assembly',
        oemPartCostUsd: 128.0,
        whySerialVariantMatters:
          '2021+ models incorporate a micro-filtration circulation motor with integral high-pressure diverter.',
        safe90sDiyPrecheck:
          'Check that the lower spray arm spins freely by hand and is not blocked by a fallen utensil.',
        standardWarrantyYears: 2,
      },
      {
        serialPrefixStart: 'W2016',
        serialPrefixEnd: 'W2020',
        serialPatternDescription: 'Production 2016 to 2020',
        oemPartSku: 'KITCH-W10843323',
        partName: 'KitchenAid Legacy Wash Motor Assembly',
        oemPartCostUsd: 115.0,
        whySerialVariantMatters:
          'Legacy models utilize a discrete clip-mounted pump and separate diverter disk.',
        safe90sDiyPrecheck:
          'Inspect the upper wash arm water supply tube at the top rear of the tub.',
        standardWarrantyYears: 2,
      },
    ],
  },

  // 11. Lennox Heat Pump Defrost Sensor
  {
    brand: 'Lennox',
    modelNumber: 'EL16XP1-036-230',
    category: 'HEAT_PUMP',
    errorCode: 'E421',
    errorDescription: 'Outdoor coil defrost temperature sensor open or out of calibration',
    serialRanges: [
      {
        serialPrefixStart: '5821',
        serialPrefixEnd: '5826',
        serialPatternDescription: 'Serial run 2021-2026',
        oemPartSku: 'LENNOX-10Z81',
        partName: 'Lennox Ambient & Liquid Defrost Thermostat 50F',
        oemPartCostUsd: 39.0,
        whySerialVariantMatters:
          'High-efficiency coil geometry requires hermetic probe with 50°F cut-out point.',
        safe90sDiyPrecheck:
          'Inspect outdoor heat pump coil for solid block of ice thicker than 0.5 inches.',
        standardWarrantyYears: 5,
      },
      {
        serialPrefixStart: '5815',
        serialPrefixEnd: '5820',
        serialPatternDescription: 'Serial run 2015-2020',
        oemPartSku: 'LENNOX-67K34',
        partName: 'Lennox Bi-Metal Defrost Sensor Clip-on',
        oemPartCostUsd: 35.0,
        whySerialVariantMatters:
          'Legacy systems use mechanical bi-metal snap switch clipped to copper return bend.',
        safe90sDiyPrecheck:
          'Ensure the outdoor unit is not buried in snow drifts blocking bottom drainage holes.',
        standardWarrantyYears: 5,
      },
    ],
  },

  // 12. Maytag Front Load Washer Door Lock
  {
    brand: 'Maytag',
    modelNumber: 'MHW5630HW',
    category: 'WASHER',
    errorCode: 'F5E2',
    errorDescription: 'Door lock mechanism failed to engage or register locked state',
    serialRanges: [
      {
        serialPrefixStart: 'C2020',
        serialPrefixEnd: 'C2026',
        serialPatternDescription: 'Production 2020-2026',
        oemPartSku: 'MAYTAG-W11307244',
        partName: 'Maytag Front-Load 6-Wire Electronic Door Latch Lock',
        oemPartCostUsd: 58.0,
        whySerialVariantMatters:
          'Modern latch contains integral optical door position sensor requiring 6-pin wiring.',
        safe90sDiyPrecheck:
          'Push firmly on the center of the door until you hear a distinct physical click, then press Start.',
        standardWarrantyYears: 1,
      },
      {
        serialPrefixStart: 'C2015',
        serialPrefixEnd: 'C2019',
        serialPatternDescription: 'Production 2015-2019',
        oemPartSku: 'MAYTAG-W10643906',
        partName: 'Maytag 4-Wire Solenoid Door Latch Assembly',
        oemPartCostUsd: 51.0,
        whySerialVariantMatters:
          'Legacy latch uses solenoid pulse lock with 4-wire spade block.',
        safe90sDiyPrecheck:
          'Inspect the rubber door boot gasket for trapped socks or debris blocking the door strike.',
        standardWarrantyYears: 1,
      },
    ],
  },

  // 13. Bradford White Water Heater Pilot Thermopile
  {
    brand: 'Bradford White',
    modelNumber: 'RG250T6N',
    category: 'WATER_HEATER',
    errorCode: 'LED_6_FLASHES',
    errorDescription: 'Status LED 6 flashes: Pilot flame current low or millivolt thermopile weak',
    serialRanges: [
      {
        serialPrefixStart: 'ML2020',
        serialPrefixEnd: 'ML2026',
        serialPatternDescription: 'Production 2020-2026',
        oemPartSku: 'BW-415-52907-00',
        partName: 'Bradford White Resettable Resistor Pilot Thermopile Assembly',
        oemPartCostUsd: 62.0,
        whySerialVariantMatters:
          'Enhanced Defender safety system requires calibrated 750mV thermopile with built-in thermal diode.',
        safe90sDiyPrecheck:
          'Ensure the gas supply valve shutoff handle is turned fully parallel to the gas pipe.',
        standardWarrantyYears: 6,
      },
      {
        serialPrefixStart: 'ML2014',
        serialPrefixEnd: 'ML2019',
        serialPatternDescription: 'Production 2014-2019',
        oemPartSku: 'BW-265-42988-00',
        partName: 'Bradford White Standard 750mV Pilot Thermopile',
        oemPartCostUsd: 54.0,
        whySerialVariantMatters:
          'Standard Defender pilot assembly with screw-in coaxial connector.',
        safe90sDiyPrecheck:
          'Check that the pilot sight glass is not obscured by dust.',
        standardWarrantyYears: 6,
      },
    ],
  },

  // 14. LG Refrigerator Defrost Heater
  {
    brand: 'LG',
    modelNumber: 'LFXS28968S',
    category: 'REFRIGERATOR',
    errorCode: 'Er_dH',
    errorDescription: 'Defrost heater failed to warm evaporator coil to termination temperature',
    serialRanges: [
      {
        serialPrefixStart: 'LG2021',
        serialPrefixEnd: 'LG2026',
        serialPatternDescription: 'Production 2021-2026',
        oemPartSku: 'LG-ADX73410702',
        partName: 'LG Sheath Glass Defrost Heater with Controller Fuse',
        oemPartCostUsd: 72.0,
        whySerialVariantMatters:
          'Updated multi-airflow frost-free evaporator requires quartz glass sheath element with built-in 72°C thermal fuse.',
        safe90sDiyPrecheck:
          'Ensure freezer drawer is sealing tightly and ice dispenser chute door is fully closed.',
        standardWarrantyYears: 1,
      },
      {
        serialPrefixStart: 'LG2016',
        serialPrefixEnd: 'LG2020',
        serialPatternDescription: 'Production 2016-2020',
        oemPartSku: 'LG-5300JK1005D',
        partName: 'LG Calrod Element Defrost Heater Assembly',
        oemPartCostUsd: 64.0,
        whySerialVariantMatters:
          'Calrod metal-sheath heater element with external clip-on bimetal.',
        safe90sDiyPrecheck:
          'Check if frost build-up is visible on the rear wall of the freezer compartment.',
        standardWarrantyYears: 1,
      },
    ],
  },

  // 15. Bosch Wall Oven Temperature Sensor
  {
    brand: 'Bosch',
    modelNumber: 'HBL8451UC',
    category: 'OVEN',
    errorCode: 'E104',
    errorDescription: 'Oven temperature sensor signal erratic or resistance runaway',
    serialRanges: [
      {
        serialPrefixStart: 'FD98000000',
        serialPrefixEnd: 'FD99999999',
        serialPatternDescription: 'Serial batch FD98-FD99 (2018+)',
        oemPartSku: 'BOSCH-00627375',
        partName: 'Bosch Platinum RTD Precision Oven Temperature Sensor',
        oemPartCostUsd: 51.0,
        whySerialVariantMatters:
          'Modern control board requires 1080 ohm platinum RTD sensor. Older 1000 ohm probes trigger persistent E104 temperature mismatch.',
        safe90sDiyPrecheck:
          'Inspect the metallic probe protruding from the rear oven cavity wall; ensure no aluminum foil is touching it.',
        standardWarrantyYears: 2,
      },
      {
        serialPrefixStart: 'FD95000000',
        serialPrefixEnd: 'FD97999999',
        serialPatternDescription: 'Serial batch FD95-FD97 (2015-2017)',
        oemPartSku: 'BOSCH-00424037',
        partName: 'Bosch Standard Thermocouple Probe',
        oemPartCostUsd: 44.0,
        whySerialVariantMatters:
          'Early wall ovens utilize standard thermocouple probe with push-on spade connectors.',
        safe90sDiyPrecheck:
          'Verify oven door closes completely and interior light turns off when shut.',
        standardWarrantyYears: 2,
      },
    ],
  },
];

export const SafetyRules: HazardShutoffRule[] = [
  {
    hazardType: 'GAS_LEAK',
    triggerKeywords: [
      'gas smell',
      'smell gas',
      'rotten eggs',
      'hissing gas',
      'gas leak',
      'odor of gas',
      'gas line',
    ],
    severity: 'CRITICAL_EMERGENCY',
    shutoffGuidance:
      'IMMEDIATELY EVACUATE the home. Do NOT flip light switches, do NOT operate doorbells, and do NOT use phones inside. If accessible from outside, shut off the main gas valve at your gas meter by turning the valve perpendicular to the pipe. Call your local gas utility and 911 from a safe distance.',
    evacuationAdvice: 'Evacuate all family members and pets immediately to a location at least 100 feet away.',
  },
  {
    hazardType: 'CARBON_MONOXIDE',
    triggerKeywords: [
      'co alarm',
      'carbon monoxide',
      'dizzy near furnace',
      'headache near furnace',
      'beeping alarm furnace',
      'co detector',
    ],
    severity: 'CRITICAL_EMERGENCY',
    shutoffGuidance:
      'IMMEDIATELY EVACUATE into fresh outdoor air. Carbon monoxide is odorless and lethal. Leave doors and windows open only if you can do so immediately while exiting. Call 911 and emergency services from outside.',
    evacuationAdvice: 'Move everyone into fresh air immediately and seek emergency medical evaluation for dizziness or nausea.',
  },
  {
    hazardType: 'ELECTRICAL_FIRE',
    triggerKeywords: [
      'sparking',
      'burning wire',
      'sparks',
      'smoke coming from',
      '240v panel',
      'breaker sizzling',
      'electrical fire',
      'arcing',
    ],
    severity: 'CRITICAL_EMERGENCY',
    shutoffGuidance:
      'DANGER: HIGH VOLTAGE / FIRE HAZARD. Do NOT touch exposed wiring, metal cabinets, or water near the appliance. If you can safely access your home main breaker panel without standing in water, switch off the main electrical breaker. If open flame or persistent smoke is present, evacuate and call 911 immediately.',
    evacuationAdvice: 'Keep clear of all electrical enclosures and keep a Class C dry-chemical extinguisher at hand.',
  },
  {
    hazardType: 'ACTIVE_FLOODING',
    triggerKeywords: [
      'burst pipe',
      'water gushing',
      'flooding ceiling',
      'major leak gushing',
      'pipe spewing',
      'water spraying everywhere',
    ],
    severity: 'CRITICAL_EMERGENCY',
    shutoffGuidance:
      'IMMEDIATELY SHUT OFF THE MAIN WATER SUPPLY VALVE to your home. The main shutoff is typically located in the basement, crawlspace, or near the water meter at the street (quarter-turn ball valve or wheel handle). Shut off power to your water heater to prevent tank dry-fire. Open the lowest outside hose spigot to relieve water line pressure.',
    evacuationAdvice: 'Shut down electrical circuit breakers feeding submerged rooms to eliminate electrocution risk.',
  },
];

export const ContractorVans: ContractorVan[] = [
  // Contractor 1: Missing the FD99 part (BOSCH-00631200 qty 0)
  {
    contractorId: 'contractor_metro_01',
    companyName: 'Metro Rapid Appliance',
    vanId: 'van_metro_02',
    technicianName: 'Dave Kowalski',
    rating: 4.6,
    zipCodesCovered: ['98101', '98102', '98103', '98104', '98105', '98109', '98115', '98122'],
    inventory: [
      {
        oemPartSku: 'BOSCH-00611332',
        quantity: 2,
        partDescription: 'Bosch Legacy Twist-Lock Drain Pump',
      },
      {
        oemPartSku: 'BOSCH-00631200',
        quantity: 0, // EXPLICITLY ZERO - missing the required part
        partDescription: 'Bosch 3-Prong BLDC Drain Pump Assembly',
      },
      {
        oemPartSku: 'WHIRL-W10874400',
        quantity: 1,
        partDescription: 'Whirlpool High-Efficiency Shrouded Drain Pump',
      },
    ],
    availableSlots: [
      {
        slotId: 'slot_metro_1330',
        dateIso: '2026-10-15',
        startTime: '13:30',
        endTime: '15:00',
      },
    ],
    pricing: {
      diagnosticFeeUsd: 69.0,
      diagnosticCreditPercentage: 100,
      bindingEstimateMinUsd: 175.0,
      bindingEstimateMaxUsd: 205.0,
      laborBaseRateUsd: 120.0,
      typicalLaborHours: 1.0,
    },
    baselineFtfr: 0.63,
    stockedFtfr: 0.94,
  },

  // Contractor 2: Apex Home Services, Van #4 (Tech: Marcus Vance, 4.9★)
  {
    contractorId: 'contractor_apex_04',
    companyName: 'Apex Home Services',
    vanId: 'van_apex_04',
    technicianName: 'Marcus Vance',
    rating: 4.9,
    zipCodesCovered: ['98101', '98102', '98103', '98104', '98105', '98109', '98115', '98122'],
    inventory: [
      {
        oemPartSku: 'BOSCH-00631200',
        quantity: 2, // STOCKED!
        partDescription: 'Bosch 3-Prong BLDC Drain Pump Assembly',
      },
      {
        oemPartSku: 'BOSCH-00611332',
        quantity: 1,
        partDescription: 'Bosch Legacy Twist-Lock Drain Pump',
      },
      {
        oemPartSku: 'GE-WR60X26866',
        quantity: 2,
        partDescription: 'GE Evaporator Fan Motor with Variable Speed PWM',
      },
      {
        oemPartSku: 'KITCH-W11414075',
        quantity: 1,
        partDescription: 'KitchenAid Heavy-Duty Circulation Pump',
      },
    ],
    availableSlots: [
      {
        slotId: 'slot_apex_1400',
        dateIso: '2026-10-15',
        startTime: '14:00',
        endTime: '15:30',
      },
      {
        slotId: 'slot_apex_1630',
        dateIso: '2026-10-15',
        startTime: '16:30',
        endTime: '18:00',
      },
    ],
    pricing: {
      diagnosticFeeUsd: 85.0,
      diagnosticCreditPercentage: 100, // 100% credited toward repair
      bindingEstimateMinUsd: 185.0,
      bindingEstimateMaxUsd: 215.0,
      laborBaseRateUsd: 135.0,
      typicalLaborHours: 1.0,
    },
    baselineFtfr: 0.68,
    stockedFtfr: 0.96,
  },

  // Contractor 3: Precision Trade Pros, Van #1 (Tech: Elena Rostova, 4.8★)
  {
    contractorId: 'contractor_precision_01',
    companyName: 'Precision Trade Pros',
    vanId: 'van_precision_01',
    technicianName: 'Elena Rostova',
    rating: 4.8,
    zipCodesCovered: ['98101', '98102', '98103', '98104', '98105', '98109', '98115', '98122'],
    inventory: [
      {
        oemPartSku: 'BOSCH-00631200',
        quantity: 1, // STOCKED!
        partDescription: 'Bosch 3-Prong BLDC Drain Pump Assembly',
      },
      {
        oemPartSku: 'WHIRL-W10874400',
        quantity: 2,
        partDescription: 'Whirlpool High-Efficiency Shrouded Drain Pump',
      },
      {
        oemPartSku: 'MAYTAG-W11307244',
        quantity: 1,
        partDescription: 'Maytag Front-Load Electronic Door Latch Lock',
      },
    ],
    availableSlots: [
      {
        slotId: 'slot_precision_1530',
        dateIso: '2026-10-15',
        startTime: '15:30',
        endTime: '17:00',
      },
    ],
    pricing: {
      diagnosticFeeUsd: 79.0,
      diagnosticCreditPercentage: 100,
      bindingEstimateMinUsd: 195.0,
      bindingEstimateMaxUsd: 225.0,
      laborBaseRateUsd: 140.0,
      typicalLaborHours: 1.0,
    },
    baselineFtfr: 0.65,
    stockedFtfr: 0.94,
  },

  // Contractor 4: Valley HVAC & Plumbing, Van #7 (Tech: Devon Brooks, 4.9★)
  {
    contractorId: 'contractor_valley_07',
    companyName: 'Valley HVAC & Plumbing',
    vanId: 'van_valley_07',
    technicianName: 'Devon Brooks',
    rating: 4.9,
    zipCodesCovered: ['98101', '98102', '98103', '98104', '98105', '98109', '98115', '98122'],
    inventory: [
      {
        oemPartSku: 'RHEEM-SP20172',
        quantity: 3, // STOCKED!
        partDescription: 'Flammable Vapor (FV) Sensor & Harness Kit',
      },
      {
        oemPartSku: 'CARRIER-HC98JA045D',
        quantity: 4, // STOCKED!
        partDescription: '45+5 uF 370V/440V Oval Dual Run Capacitor',
      },
      {
        oemPartSku: 'TRANE-COL18544',
        quantity: 2,
        partDescription: 'Trane Differential Draft Pressure Switch',
      },
      {
        oemPartSku: 'AOSMITH-100109275',
        quantity: 2,
        partDescription: 'AO Smith Direct Immersion Upper Thermistor',
      },
    ],
    availableSlots: [
      {
        slotId: 'slot_valley_1100',
        dateIso: '2026-10-15',
        startTime: '11:00',
        endTime: '12:30',
      },
      {
        slotId: 'slot_valley_1430',
        dateIso: '2026-10-15',
        startTime: '14:30',
        endTime: '16:00',
      },
    ],
    pricing: {
      diagnosticFeeUsd: 89.0,
      diagnosticCreditPercentage: 100,
      bindingEstimateMinUsd: 189.0,
      bindingEstimateMaxUsd: 239.0,
      laborBaseRateUsd: 145.0,
      typicalLaborHours: 1.0,
    },
    baselineFtfr: 0.70,
    stockedFtfr: 0.97,
  },
];

export const InitialHouseholdEquipment: HouseholdEquipmentRecord[] = [
  {
    householdId: 'household_demo_001',
    equipmentId: 'eq_dishwasher_001',
    brand: 'Bosch',
    modelNumber: 'SHPM65Z55N/01',
    serialNumber: 'FD990400412',
    category: 'DISHWASHER',
    installDateIso: '2024-03-15T00:00:00Z',
    locationInHome: 'Kitchen Island',
    notes: 'Installed during kitchen renovation; connected to hot water line.',
    lastServiceDateIso: '2024-03-15T00:00:00Z',
    updatedAtIso: '2026-10-15T10:00:00Z',
  },
  {
    householdId: 'household_demo_001',
    equipmentId: 'eq_hvac_condenser_001',
    brand: 'Carrier',
    modelNumber: '24ACC636A003',
    serialNumber: '2022-C88192',
    category: 'AC_CONDENSER',
    installDateIso: '2022-06-10T00:00:00Z',
    locationInHome: 'Exterior East Yard Pad',
    notes: '3-ton 16 SEER condenser with 10-year parts warranty.',
    lastServiceDateIso: '2025-05-18T00:00:00Z',
    updatedAtIso: '2026-10-15T10:00:00Z',
  },
  {
    householdId: 'household_demo_001',
    equipmentId: 'eq_water_heater_001',
    brand: 'Rheem',
    modelNumber: 'XG50T06EC36U1',
    serialNumber: 'M0423-88710',
    category: 'WATER_HEATER',
    installDateIso: '2023-04-12T00:00:00Z',
    locationInHome: 'Garage Utility Closet',
    notes: '50-gallon natural gas atmospheric water heater.',
    lastServiceDateIso: '2023-04-12T00:00:00Z',
    updatedAtIso: '2026-10-15T10:00:00Z',
  },
];
