import type { TransmissionType } from '../../state/appState';
import { SYSTEM_LESSONS } from './coreSystems';
import type { SystemLessonData } from './types';

const MANUAL_LESSON: SystemLessonData = {
  ...SYSTEM_LESSONS.transmission,
  variant: 'manual',
  glossaryTerms: ['transmission-gear', 'torque', 'differential'],
  parts: [
    ...SYSTEM_LESSONS.transmission.parts,
    {
      id: 'shifter-gate',
      name: 'H-Pattern Gear Shifter',
      plainEnglish:
        'A mechanical lever inside an H-shaped gate linked to the shift forks so the driver can pick any gear directly.',
      analogy: 'Like sliding a railroad track switch lever to steer a train onto a chosen track.',
    },
    {
      id: 'clutch-pedal',
      name: 'Clutch Pedal & Release Fork',
      plainEnglish:
        'Pressing the foot pedal pivots a release fork that pulls the pressure plate off the friction disc for clean shifts.',
      analogy: 'Like lifting the needle off a spinning vinyl record before changing tracks.',
    },
  ],
};

const AMT_LESSON: SystemLessonData = {
  id: 'transmission',
  variant: 'amt',
  title: 'Automated Manual Transmission (AMT)',
  subtitle: 'A mechanical manual gearbox operated by robotic clutch and shift actuators',
  intro:
    'An AMT keeps the simple, efficient shafts and [[transmission-gear|gears]] of a manual gearbox while an electronic TCU controls electro-hydraulic actuators to press the clutch and move shift forks automatically.',
  animationLabel: 'AMT Shift Sequence',
  glossaryTerms: ['transmission-gear', 'torque', 'differential'],
  phases: [
    {
      id: 'drive-1',
      label: '1st Drive',
      description: 'Clutch actuator locks the friction disc; engine torque drives the output through 1st gear.',
      color: '#38bdf8',
    },
    {
      id: 'pause-shift',
      label: 'Torque Pause',
      description: 'TCU momentarily lifts the throttle, opens the clutch actuator, and slides the fork to 2nd — creating a brief power pause.',
      color: '#f59e0b',
    },
    {
      id: 'drive-2',
      label: '2nd Engaged',
      description: 'Clutch actuator re-engages smoothly so engine power flows again at highway speed.',
      color: '#10b981',
    },
    {
      id: 'drive-3',
      label: '3rd Cruise',
      description: 'Highest gear ratio drops engine RPM for relaxed efficiency while TCU monitors road speed.',
      color: '#a78bfa',
    },
  ],
  parts: [
    ...SYSTEM_LESSONS.transmission.parts,
    {
      id: 'clutch-actuator',
      name: 'Clutch Actuator Motor',
      plainEnglish: 'An electric/hydraulic servo arm that presses and releases the clutch diaphragm automatically.',
      analogy: 'Like a robotic foot pressing the clutch pedal at the exact right millisecond.',
    },
    {
      id: 'shift-actuator',
      name: 'Shift-Fork Actuator',
      plainEnglish: 'Twin motorized pushers that select gears and slide the synchronizer collar along the output shaft.',
      analogy: 'Like an automated mechanical hand moving an H-pattern shifter inside the box.',
    },
    {
      id: 'tcu-module',
      name: 'Transmission Control Unit (TCU)',
      plainEnglish: 'The onboard computer reading throttle and wheel speed to command smooth automated shifts.',
      analogy: 'Like an orchestra conductor cueing the clutch and gear actuators on beat.',
    },
  ],
  quiz: [
    {
      question: 'What mechanical core sits inside an AMT (Automated Manual Transmission)?',
      options: [
        'Conventional manual shafts, gears, and synchronizers operated by robotic actuators',
        'A fluid torque converter and planetary ring gears',
        'A steel push-belt between two variable pulleys',
        'Two permanent-magnet electric rotors',
      ],
      correctIndex: 0,
      explanation: 'An AMT is literally a manual gearbox whose clutch and shift forks are automated by actuators and a TCU.',
    },
    {
      question: 'Why does an AMT create a brief "head-nod" pause during full-throttle upshifts?',
      options: [
        'It must briefly open its single clutch and pause power flow while sliding to the next gear',
        'Its battery runs out of charge between gears',
        'The brakes clamp automatically on every upshift',
        'The pistons reverse direction',
      ],
      correctIndex: 0,
      explanation: 'Because power passes through one clutch, torque interrupts briefly while the shift actuator selects the next gear.',
    },
    {
      question: 'Which component decides when an AMT should shift gears?',
      options: [
        'The Transmission Control Unit (TCU)',
        'The radiator thermostat',
        'The catalytic converter',
        'The exhaust muffler',
      ],
      correctIndex: 0,
      explanation: 'The TCU coordinates throttle cut, clutch release, fork movement, and clutch re-engagement.',
    },
    {
      question: 'Why do city hatchbacks often use an AMT instead of a hydraulic automatic?',
      options: [
        'Lower cost, lighter weight, and manual-like fuel economy without needing a clutch pedal',
        'It eliminates the need for engine oil',
        'It produces twice as much exhaust sound',
        'It allows unlimited top speed',
      ],
      correctIndex: 0,
      explanation: 'AMTs give two-pedal convenience with low mechanical drag and affordable manufacturing cost.',
    },
    {
      question: 'What happens if the TCU coordinates throttle blipping during a downshift?',
      options: [
        'Engine speed matches the lower gear smoothly, cutting jerkiness',
        'The differential locks both axles solid',
        'The cooling fan stops spinning',
        'Both front and rear gears engage simultaneously',
      ],
      correctIndex: 0,
      explanation: 'Rev-matching aligns input shaft speed with the lower gear ratio before releasing the clutch actuator.',
    },
  ],
};

const AT_LESSON: SystemLessonData = {
  id: 'transmission',
  variant: 'at',
  title: 'Planetary Automatic Transmission (AT)',
  subtitle: 'Fluid torque converter + stacked planetary gearsets for seamless, unbroken shifts',
  intro:
    'A traditional automatic replaces the friction clutch with a fluid [[transmission-gear|torque converter]] driving compact planetary gearsets (sun, planets, and ring). Hydraulic clutch packs hold or release elements under oil pressure for smooth shifts without stopping [[torque|torque]] flow.',
  animationLabel: 'AT Operating Stage',
  glossaryTerms: ['transmission-gear', 'torque', 'hydraulics', 'differential'],
  phases: [
    {
      id: 'fluid-idle',
      label: 'Idle Coupling',
      description: 'Pump impeller spins ATF oil gently against the turbine while brakes hold the car stationary.',
      color: '#38bdf8',
    },
    {
      id: 'torque-mult',
      label: 'Launch Multiplication',
      description: 'Stator redirects returning ATF oil back into the impeller, nearly doubling launch torque at low speed.',
      color: '#f59e0b',
    },
    {
      id: 'lockup-cruise',
      label: 'Lock-Up Cruise',
      description: 'Internal lock-up clutch clamps pump to turbine mechanically, eliminating fluid slip for highway efficiency.',
      color: '#10b981',
    },
    {
      id: 'overdrive',
      label: 'Planetary Overdrive',
      description: 'Valve body routes ATF pressure to clutch packs, stepping up planetary carrier speed for quiet cruising.',
      color: '#a78bfa',
    },
  ],
  parts: [
    {
      id: 'casing',
      name: 'Bellhousing & Sump Oil Pan',
      plainEnglish: 'Encloses the torque converter, planetary sets, and lower ATF fluid reservoir pan.',
      analogy: 'Like the outer vault holding both spinning gearsets and pressurized hydraulic fluid.',
    },
    {
      id: 'torque-converter',
      name: 'Torque Converter (Pump, Stator, Turbine)',
      plainEnglish: 'Uses pressurized transmission fluid and a redirecting stator vane to couple the engine smoothly and multiply launch torque.',
      analogy: 'Like two curved water wheels facing each other inside a sealed oil-filled doughnut.',
    },
    {
      id: 'planetary-set',
      name: 'Planetary Gearsets (Sun, Planets, Ring)',
      plainEnglish: 'Compact coaxial gears that create multiple ratios simply by locking either the sun, planet carrier, or outer ring.',
      analogy: 'Like the solar system where holding the sun or outer ring still flips how fast the planets orbit.',
    },
    {
      id: 'clutch-packs',
      name: 'Multi-Plate Clutch Packs & Brake Bands',
      plainEnglish: 'Hydraulically clamped friction stacks that hold or lock planetary members for instant powershifting.',
      analogy: 'Like wet bicycle disc brakes gripping internal drums to switch gear ratios silently.',
    },
    {
      id: 'valve-body',
      name: 'Valve Body & ATF Pump',
      plainEnglish: 'A maze of hydraulic channels and solenoids that directs pressurized ATF fluid to each clutch pack.',
      analogy: 'Like a fluidic circuit board routing hydraulic pressure to the chosen gear.',
    },
    {
      id: 'differential',
      name: 'Output Shaft & Differential',
      plainEnglish: 'Transfers multiplied planetary torque outward to left and right drive axles.',
      analogy: 'Like a power splitter dividing effort fairly between two wheels around turns.',
    },
  ],
  quiz: [
    {
      question: 'Which part replaces a mechanical friction clutch at the front of a traditional automatic?',
      options: [
        'A fluid-filled torque converter',
        'A dry steel push-belt',
        'A secondary electric starter motor',
        'A chain-driven transfer fork',
      ],
      correctIndex: 0,
      explanation: 'A torque converter transmits power smoothly through Automatic Transmission Fluid (ATF) so the engine never stalls at idle.',
    },
    {
      question: 'What does the stator inside a torque converter do during hard takeoff?',
      options: [
        'Redirects returning fluid back into the impeller to multiply launch torque',
        'Drains all oil into the engine radiator',
        'Disengages the rear wheels completely',
        'Spins twice as fast as the camshaft',
      ],
      correctIndex: 0,
      explanation: 'Locked by its one-way clutch at low speed, the stator bends returning fluid flow to boost torque by ~2×.',
    },
    {
      question: 'Why does a torque converter engage its internal lock-up clutch on the highway?',
      options: [
        'To mechanically lock pump and turbine together, eliminating fluid slip and wasting less fuel',
        'To keep the car in 1st gear permanently',
        'To increase exhaust backpressure',
        'To reverse axle rotation',
      ],
      correctIndex: 0,
      explanation: 'Once up to cruise speed, direct mechanical lock-up eliminates fluid churning losses.',
    },
    {
      question: 'Name the three core toothed members of a single planetary gearset:',
      options: [
        'Sun gear, planet gears on a carrier, and outer ring gear',
        'Flywheel, cam belt, and spark rotor',
        'Rack, pinion, and tie rod',
        'Impeller, caliper, and muffler',
      ],
      correctIndex: 0,
      explanation: 'Holding or driving different combinations of sun, carrier, and ring yields underdrive, direct drive, overdrive, or reverse.',
    },
    {
      question: 'Which assembly acts like the hydraulic "brain" routing oil pressure to clutch packs?',
      options: [
        'The valve body and solenoid block',
        'The exhaust manifold',
        'The fuel rail',
        'The brake booster diaphragm',
      ],
      correctIndex: 0,
      explanation: 'Solenoids in the valve body route pressurized ATF to clamp specific clutch packs and bands seamlessly.',
    },
  ],
};

const CVT_LESSON: SystemLessonData = {
  id: 'transmission',
  variant: 'cvt',
  title: 'Continuously Variable Transmission (CVT)',
  subtitle: 'Variable conical pulleys and a steel belt deliver infinite, step-free ratios',
  intro:
    'A CVT skips fixed gear steps altogether. Hydraulic pistons squeeze or separate two V-shaped conical pulleys while a strong steel push-belt rides higher or lower on each cone—changing the [[transmission-gear|gear ratio]] continuously to hold the engine at peak efficiency or power.',
  animationLabel: 'CVT Ratio Sweep',
  glossaryTerms: ['transmission-gear', 'torque', 'hydraulics', 'differential'],
  phases: [
    {
      id: 'low-ratio',
      label: 'Low Ratio (Launch)',
      description: 'Primary pulley opens wide (small belt radius) while secondary clamps tight (large radius) for max launch torque.',
      color: '#f59e0b',
    },
    {
      id: 'mid-sweep',
      label: 'Continuous Climb',
      description: 'Hydraulic actuators squeeze the primary cone shut smoothly without any shift interruption.',
      color: '#38bdf8',
    },
    {
      id: 'overdrive-ratio',
      label: 'High Overdrive',
      description: 'Primary belt rides near the outer rim while secondary opens wide, letting the engine loaf at low RPM.',
      color: '#10b981',
    },
    {
      id: 'reverse-stage',
      label: 'Planetary Reverser',
      description: 'A compact forward/reverse planetary carrier swaps belt direction cleanly when selecting Reverse.',
      color: '#a78bfa',
    },
  ],
  parts: [
    {
      id: 'casing',
      name: 'CVT Housing & Oil Pan',
      plainEnglish: 'Supports both pulley shafts against high hydraulic clamping loads and stores high-friction CVT fluid.',
      analogy: 'Like a rigid aluminum frame bracing two spring-loaded rollers.',
    },
    {
      id: 'primary-pulley',
      name: 'Primary (Drive) Conical Pulley',
      plainEnglish: 'Two angled steel sheaves—one fixed, one sliding hydraulically—controlling how high the belt rides on the input side.',
      analogy: 'Like an adjustable front chainring that can grow larger or smaller on the fly.',
    },
    {
      id: 'secondary-pulley',
      name: 'Secondary (Driven) Pulley',
      plainEnglish: 'Squeezes back against the steel belt to keep constant tension while changing effective diameter inversely.',
      analogy: 'Like the rear gear cassette shrinking cleanly as the front pulley grows.',
    },
    {
      id: 'steel-belt',
      name: 'Segmented Steel Push-Belt',
      plainEnglish: 'Hundreds of thin steel segments bound by flexible steel bands that wedge frictionally between pulley cones.',
      analogy: 'Like a metal spine whose V-edges grip pulley walls cleanly without slipping.',
    },
    {
      id: 'forward-reverse',
      name: 'Forward / Reverse Planetary & Actuators',
      plainEnglish: 'Hydraulic pump and small planetary clutch pack that reverses output rotation for backing up.',
      analogy: 'Like a directional switch before power reaches the variable pulleys.',
    },
    {
      id: 'differential',
      name: 'Reduction Gear & Differential',
      plainEnglish: 'Steps down secondary pulley speed once more and splits torque cleanly to the front or rear wheels.',
      analogy: 'Like the final hub gear sending smooth twist to both drive axles.',
    },
  ],
  quiz: [
    {
      question: 'How does a CVT change its gear ratio without discrete toothed gear steps?',
      options: [
        'One half of each conical pulley slides sideways so the belt rides at larger or smaller radii',
        'It shuts off half the cylinders between shifts',
        'It flips a dual clutch between odd and even shafts',
        'It stretches the steel belt twice as long',
      ],
      correctIndex: 0,
      explanation: 'Changing cone spacing shifts the belt’s effective pitch radius smoothly while keeping total belt length constant.',
    },
    {
      question: 'For maximum acceleration from a standstill, how are CVT pulleys positioned?',
      options: [
        'Primary pulley wide open (small belt radius) and secondary squeezed shut (large radius)',
        'Primary squeezed shut and secondary wide open',
        'Both pulleys locked at the exact same radius',
        'Steel belt removed from the primary cone',
      ],
      correctIndex: 0,
      explanation: 'Small drive radius turning a large driven radius gives the highest torque multiplication for launch.',
    },
    {
      question: 'What keeps a steel push-belt from slipping under heavy engine torque?',
      options: [
        'High hydraulic clamping pressure squeezing the angled V-cones tightly against the belt edges',
        'Glue applied before every drive',
        'Magnetic attraction to the car hood',
        'An exhaust vacuum hose',
      ],
      correctIndex: 0,
      explanation: 'High-pressure hydraulic pistons generate intense normal force on the beveled belt blocks.',
    },
    {
      question: 'Why does an engine sometimes stay at one steady RPM while accelerating hard in a CVT car?',
      options: [
        'The CVT continuously lengthens the ratio so the engine holds its peak-power RPM sweet spot',
        'The tachometer needle is broken',
        'The clutch is permanently slipping',
        'The alternator disconnects the crankshaft',
      ],
      correctIndex: 0,
      explanation: 'Instead of climbing and dropping through steps, the CVT smoothly varies ratio to keep the engine at peak power or efficiency.',
    },
    {
      question: 'Why does a belt CVT still include a small planetary gearset or clutch near the input?',
      options: [
        'To provide Neutral, smooth launch engagement, and Reverse direction',
        'To cool the radiator fan',
        'To double the size of the fuel tank',
        'To pump brake fluid to rear calipers',
      ],
      correctIndex: 0,
      explanation: 'A push-belt only works well rotating forward under tension, so a small planetary reverser handles Reverse.',
    },
  ],
};

const DCT_LESSON: SystemLessonData = {
  id: 'transmission',
  variant: 'dct',
  title: 'Dual-Clutch Transmission (DCT)',
  subtitle: 'Twin concentric input shafts and dual clutches pre-select the next gear in milliseconds',
  intro:
    'A DCT works like two parallel manual gearboxes inside one casing. Odd gears (1, 3, 5) sit on one shaft driven by Clutch K1, while even gears (2, 4) sit on a hollow concentric shaft driven by Clutch K2. While driving in one gear, the next is already waiting—so shifting just hands pressure from K1 to K2 with near-zero [[torque|torque]] drop.',
  animationLabel: 'DCT Pre-Select Cycle',
  glossaryTerms: ['transmission-gear', 'torque', 'differential'],
  phases: [
    {
      id: 'odd-1',
      label: '1st (Clutch K1)',
      description: 'Outer clutch K1 locks odd gears (1st engaged) while K2 opens and pre-selects 2nd gear on the even shaft.',
      color: '#38bdf8',
    },
    {
      id: 'handoff-2',
      label: 'Swap → 2nd (K2)',
      description: 'K1 releases as K2 clamps in overlapping milliseconds; power flows seamlessly through 2nd while 3rd pre-selects.',
      color: '#f59e0b',
    },
    {
      id: 'odd-3',
      label: 'Swap → 3rd (K1)',
      description: 'K2 releases and K1 engages 3rd gear instantly, keeping acceleration uninterrupted.',
      color: '#10b981',
    },
    {
      id: 'even-4',
      label: 'Swap → 4th (K2)',
      description: 'Even shaft engages 4th cruise ratio cleanly while K1 stands ready to downshift back to 3rd on demand.',
      color: '#a78bfa',
    },
  ],
  parts: [
    {
      id: 'casing',
      name: 'DCT Split Case',
      plainEnglish: 'Houses concentric dual shafts, twin clutch housing, and mechatronic oil channels.',
      analogy: 'Like a precision double-barreled gearbox case.',
    },
    {
      id: 'dual-clutch',
      name: 'Dual Concentric Clutch Pack (K1 & K2)',
      plainEnglish: 'Two independent clutches mounted together—K1 drives the solid odd shaft, K2 drives the hollow even shaft.',
      analogy: 'Like two relay runners each holding a separate set of gears ready to tag in.',
    },
    {
      id: 'concentric-shafts',
      name: 'Concentric Odd & Even Input Shafts',
      plainEnglish: 'A solid inner shaft spinning inside a hollow outer sleeve so both gearsets stay compact along one axis.',
      analogy: 'Like a telescope tube where the inner shaft spins independently inside the outer barrel.',
    },
    {
      id: 'mechatronic',
      name: 'Mechatronic Shifter Forks & TCU',
      plainEnglish: 'Electro-hydraulic actuators that pre-engage the upcoming synchronizer sleeve before the clutch even swaps.',
      analogy: 'Like queuing the next song on deck B before cross-fading the DJ slider.',
    },
    {
      id: 'synchronizer',
      name: 'Dual Synchronizer Collars',
      plainEnglish: 'Lock upcoming odd or even gears smoothly to the countershaft ahead of clutch handoff.',
      analogy: 'Like pre-latching the next bike sprocket before shifting your weight onto it.',
    },
    {
      id: 'differential',
      name: 'Final Drive & Differential',
      plainEnglish: 'Sums torque from the active gearset and splits power to both wheels.',
      analogy: 'Like the final axle bridge putting both gear paths onto the tarmac.',
    },
  ],
  quiz: [
    {
      question: 'Why can a Dual-Clutch Transmission shift in ~50–100 milliseconds?',
      options: [
        'The next gear is already pre-selected on the idle shaft, so shifting just cross-fades two clutches',
        'It has no gears at all inside',
        'It stops the engine pistons between every gear',
        'It disconnects the differential during shifts',
      ],
      correctIndex: 0,
      explanation: 'Pre-selecting the next ratio on the inactive shaft leaves only a fast overlapping clutch handoff.',
    },
    {
      question: 'How are the two input shafts arranged in most automotive DCTs?',
      options: [
        'Concentric—one solid inner shaft spinning inside a hollow outer shaft',
        'One mounted above the roof and one under the trunk',
        'Welded permanently into one solid rod',
        'Connected solely by rubber radiator hoses',
      ],
      correctIndex: 0,
      explanation: 'Concentric shafts fit dual independent drive paths neatly along a single centerline.',
    },
    {
      question: 'When accelerating in 2nd gear in a DCT, which gear is typically pre-selected on the other shaft?',
      options: [
        '3rd gear on the odd shaft',
        'Reverse gear',
        '2nd gear a second time',
        'All gears lock together simultaneously',
      ],
      correctIndex: 0,
      explanation: 'Under acceleration, the TCU predicts an upshift and pre-meshes 3rd gear while K2 drives 2nd.',
    },
    {
      question: 'What happens during an overlapping K1-to-K2 clutch swap?',
      options: [
        'Torque remains nearly continuous at the wheels with minimal acceleration dip',
        'The car rolls backward momentarily',
        'The fuel tank seals shut',
        'Both clutches stay locked forever',
      ],
      correctIndex: 0,
      explanation: 'Cross-fading hydraulic pressure between clutches avoids the pause typical of single-clutch AMTs.',
    },
    {
      question: 'How is a DCT different from a traditional planetary automatic (AT)?',
      options: [
        'A DCT uses computer-controlled friction clutches and manual-style layshaft gears instead of a fluid torque converter',
        'A DCT only works on electric cars',
        'A DCT has no synchronizers or forks',
        'A DCT uses rubber CVT cones',
      ],
      correctIndex: 0,
      explanation: 'Direct mechanical clutches avoid torque-converter fluid losses and deliver crisp sports-car shift feel.',
    },
  ],
};

const EV_REDUCER_LESSON: SystemLessonData = {
  ...SYSTEM_LESSONS.transmission,
  variant: 'ev-reducer',
  title: 'EV Single-Speed Reduction Gearbox',
  subtitle: 'Fixed helical gearset steps high motor speed down to strong wheel torque',
  intro:
    'Because electric motors spin cleanly past 14,000 RPM and make peak [[torque|torque]] from 0 RPM, EVs need neither multi-speed shifting nor a clutch. A rugged two-stage helical [[transmission-gear|reduction gear]] multiplies motor torque ~9:1 straight into the [[differential|differential]].',
  animationLabel: 'EV Drive vs Regen Flow',
  glossaryTerms: ['transmission-gear', 'torque', 'differential'],
  phases: [
    {
      id: 'launch',
      label: 'Instant Launch',
      description: 'Motor pinion turns the larger helical reduction gear, multiplying torque cleanly from 0 RPM.',
      color: '#38bdf8',
    },
    {
      id: 'cruise',
      label: 'High-RPM Cruise',
      description: 'Single-ratio gearset spins smoothly without shifts, gear hunting, or clutch wear.',
      color: '#f59e0b',
    },
    {
      id: 'reverse-ev',
      label: 'Electronic Reverse',
      description: 'Inverter simply reverses motor phase rotation—no reverse idler gear required.',
      color: '#a78bfa',
    },
    {
      id: 'regen',
      label: 'Regen Braking',
      description: 'Wheel momentum drives the reduction gear backward into the motor, recharging the battery.',
      color: '#10b981',
    },
  ],
  parts: [
    {
      id: 'casing',
      name: 'Aluminum Reduction Case',
      plainEnglish: 'Compact oil-splashed gearbox housing bolted straight onto the electric drive motor.',
      analogy: 'Like a sealed gearbox sleeve turning motor whirl into axle twist.',
    },
    {
      id: 'input-shaft',
      name: 'Motor Input Pinion Gear',
      plainEnglish: 'Small precision-ground helical gear splined directly to the high-RPM rotor shaft.',
      analogy: 'Like the small front sprocket spinning briskly to gain mechanical leverage.',
    },
    {
      id: 'countershaft',
      name: 'Intermediate Reduction Gear',
      plainEnglish: 'Steps speed down and torque up ~3× before passing load to the final ring gear.',
      analogy: 'Like a sturdy middle pulley multiplying twisting force quietly.',
    },
    {
      id: 'differential',
      name: 'Final Ring Gear & Differential',
      plainEnglish: 'Completes the ~9:1 overall reduction and feeds left and right drive axles cleanly.',
      analogy: 'Like the final hub splitter letting inner and outer wheels trace different arcs.',
    },
  ],
  quiz: [
    {
      question: 'Why don’t most electric vehicles need a 6-speed or 8-speed gearbox?',
      options: [
        'Electric motors deliver full torque from 0 RPM and rev cleanly past 14,000+ RPM in one ratio',
        'Electric motors cannot spin backward',
        'EV tires stretch automatically to change ratio',
        'Batteries regulate gear teeth electronically',
      ],
      correctIndex: 0,
      explanation: 'A flat, ultra-wide torque band covers standstill to highway speed using a single ~9:1 reduction gearset.',
    },
    {
      question: 'How does an EV drive in Reverse with a single-speed gearbox?',
      options: [
        'The power inverter reverses phase sequence so the electric motor spins backward',
        'A mechanical reverse idler gear slides across the shaft',
        'A hydraulic torque converter flips the axles',
        'The rear steering locks in place',
      ],
      correctIndex: 0,
      explanation: 'Solid-state electronics reverse magnetic field rotation silently with zero mechanical reverse gears.',
    },
    {
      question: 'Why are EV reduction gears typically helical (angled teeth) instead of straight-cut?',
      options: [
        'Helical teeth mesh gradually for near-silent operation with no engine noise to mask gear whine',
        'Angled teeth melt excess battery heat',
        'Straight teeth cannot turn left',
        'Helical teeth store extra electrical charge',
      ],
      correctIndex: 0,
      explanation: 'Quiet EV cabins make gear whine obvious, so helical teeth overlap smoothly to minimize noise.',
    },
    {
      question: 'During regenerative braking, which way does mechanical power flow through the reducer?',
      options: [
        'From the road wheels back through the differential and reducer into the electric motor (now a generator)',
        'From the motor into the radiator',
        'Out through the tailpipe',
        'Only to the brake calipers',
      ],
      correctIndex: 0,
      explanation: 'Coast momentum back-drives the single-speed gearset, spinning the rotor to recharge the HV battery.',
    },
    {
      question: 'What approximate overall gear reduction ratio is common in single-speed EVs?',
      options: ['Around 8:1 to 10:1', 'Around 1:1', 'Around 100:1', 'Variable from 0:1 to 50:1'],
      correctIndex: 0,
      explanation: 'An ~8–10:1 reduction lets a 15,000 RPM motor cruise comfortably at highway wheel speeds (~1,500 wheel RPM).',
    },
  ],
};

export const TRANSMISSION_LESSONS: Record<TransmissionType, SystemLessonData> = {
  manual: MANUAL_LESSON,
  amt: AMT_LESSON,
  at: AT_LESSON,
  cvt: CVT_LESSON,
  dct: DCT_LESSON,
  'ev-reducer': EV_REDUCER_LESSON,
};

