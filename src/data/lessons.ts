import type { Powertrain, SystemId } from '../state/appState';

export interface LessonPartData {
  id: string;
  name: string;
  plainEnglish: string;
  analogy: string;
}

export interface CyclePhaseInfo {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface SystemLessonData {
  id: SystemId;
  title: string;
  subtitle: string;
  /** Supports [[glossary-id|display text]] inline tooltips */
  intro: string;
  animationLabel: string;
  phases?: CyclePhaseInfo[];
  parts: LessonPartData[];
  quiz: QuizQuestion[];
}

export const SYSTEM_LESSONS: Record<SystemId, SystemLessonData> = {
  engine: {
    id: 'engine',
    title: 'Internal Combustion Engine',
    subtitle: 'How the 4-stroke cycle turns fuel and air into spinning motion',
    intro:
      'Most petrol cars use a [[four-stroke|4-stroke cycle]] inside each cylinder. A sliding [[piston|piston]] pumps up and down while timed valves breathe air in and push exhaust out, turning chemical fuel energy into twisting [[torque|torque]] at the [[crankshaft|crankshaft]].',
    animationLabel: '4-Stroke Cycle',
    phases: [
      {
        id: 'intake',
        label: '1. Intake',
        description:
          'Intake valve opens while the piston moves down, pulling a fresh mist of air and fuel into the cylinder.',
        color: '#38bdf8',
      },
      {
        id: 'compression',
        label: '2. Compression',
        description:
          'Both valves seal shut and the rising piston squeezes the air-fuel mix tight toward Top Dead Center.',
        color: '#a78bfa',
      },
      {
        id: 'power',
        label: '3. Power',
        description:
          'The spark plug fires a bright arc at the peak, burning the compressed mix and slamming the piston down to spin the crankshaft.',
        color: '#f59e0b',
      },
      {
        id: 'exhaust',
        label: '4. Exhaust',
        description:
          'The exhaust valve opens and the rising piston sweeps the leftover burnt gas out toward the tailpipe.',
        color: '#fb7185',
      },
    ],
    parts: [
      {
        id: 'cylinder-block',
        name: 'Cylinder Block & Cooling Sleeve',
        plainEnglish:
          'The thick metal housing that guides the piston straight up and down and contains combustion pressure.',
        analogy: 'Like the sturdy barrel of a bicycle air pump.',
      },
      {
        id: 'piston',
        name: 'Piston',
        plainEnglish:
          'A lightweight aluminum plunger sealed with rings that absorbs the combustion push and travels up and down.',
        analogy: 'Like a tight-fitting plunger pushing inside a syringe.',
      },
      {
        id: 'connecting-rod',
        name: 'Connecting Rod',
        plainEnglish:
          'The strong steel link connecting the straight-moving piston to the spinning crankshaft throw.',
        analogy: 'Like your shin bone linking your knee to the bicycle pedal.',
      },
      {
        id: 'crankshaft',
        name: 'Crankshaft & Flywheel',
        plainEnglish:
          'An offset spinning shaft whose heavy flywheel smooths out power pulses and sends rotation to the transmission.',
        analogy: 'Like bicycle pedal cranks turning linear leg pushes into wheel rotation.',
      },
      {
        id: 'camshaft',
        name: 'Camshaft & Timing Gear',
        plainEnglish:
          'Spins at exactly half the crankshaft speed so its egg-shaped lobes nudge valves open at the precise stroke.',
        analogy: 'Like bumps on a music-box drum hitting notes right on time.',
      },
      {
        id: 'intake-valve',
        name: 'Intake Valve',
        plainEnglish:
          'A spring-loaded metal door that opens during Stroke 1 to let fresh air and atomized fuel enter.',
        analogy: 'Like your lungs breathing fresh air in through your mouth.',
      },
      {
        id: 'exhaust-valve',
        name: 'Exhaust Valve',
        plainEnglish:
          'A heat-resistant valve that opens during Stroke 4 so spent gases can escape out to the exhaust.',
        analogy: 'Like exhaling stale breath after holding it.',
      },
      {
        id: 'spark-plug',
        name: 'Spark Plug',
        plainEnglish:
          'Delivers a high-voltage electric spark at Top Dead Center to ignite the compressed air-fuel mixture.',
        analogy: 'Like the click sparker that lights a gas stove burner.',
      },
    ],
    quiz: [
      {
        question: 'Which stroke is the ONLY one that actually creates pushing power to turn the wheels?',
        options: ['1. Intake', '2. Compression', '3. Power', '4. Exhaust'],
        correctIndex: 2,
        explanation:
          'Only Stroke 3 (Power) burns the squeezed air-fuel mixture to push the piston downward; flywheel momentum carries the other three strokes.',
      },
      {
        question: 'What is the main job of the crankshaft?',
        options: [
          'To cool hot engine oil',
          'To convert up-and-down piston motion into spinning rotation',
          'To filter dust out of incoming air',
          'To charge the 12V battery directly',
        ],
        correctIndex: 1,
        explanation:
          'The crankshaft offset throws convert linear piston strokes into continuous rotational motion.',
      },
      {
        question: 'How fast does the camshaft spin compared to the crankshaft in a 4-stroke engine?',
        options: ['Twice as fast', 'The exact same speed', 'Half as fast', 'One-quarter speed'],
        correctIndex: 2,
        explanation:
          'One complete 4-stroke cycle takes two full crankshaft rotations (720°), while each valve opens only once per cycle—so the camshaft turns at 1/2 speed.',
      },
      {
        question: 'Why are both valves closed during the Compression stroke?',
        options: [
          'To trap and squeeze the air-fuel mix tightly before ignition',
          'To keep rainwater out of the cylinders',
          'To slow down the engine at traffic lights',
          'To let exhaust gas flow backward',
        ],
        correctIndex: 0,
        explanation:
          'Sealing both valves lets the rising piston pack the air and fuel tightly, creating a much stronger push when the spark plug fires.',
      },
      {
        question: 'Which part acts like the flint sparker on a gas stove?',
        options: ['Connecting Rod', 'Intake Valve', 'Spark Plug', 'Flywheel'],
        correctIndex: 2,
        explanation:
          'The spark plug fires a tiny electrical arc right at Top Dead Center to ignite the compressed fuel-air mixture.',
      },
    ],
  },

  transmission: {
    id: 'transmission',
    title: 'Transmission & Differential',
    subtitle: 'How meshing gears match engine speed to wheel speed',
    intro:
      'An engine works best within a narrow RPM band, so the gearbox uses selectable [[transmission-gear|gear ratios]] to multiply pulling [[torque|torque]] at low speeds and relax engine RPM on highways. A [[differential|differential]] then splits power smoothly to the left and right wheels.',
    animationLabel: 'Gear Selection Stages',
    phases: [
      {
        id: 'gear-1',
        label: '1st Gear (Torque)',
        description:
          'Small input gear drives a large output gear—wheels spin slower with strong pulling force for starting from a stop.',
        color: '#f05a28',
      },
      {
        id: 'gear-2',
        label: '2nd Gear (Accelerate)',
        description:
          'Synchronizer shifts to medium gear pair, trading a bit of pulling force for higher road speed.',
        color: '#f05a28',
      },
      {
        id: 'gear-3',
        label: '3rd Gear (Cruise)',
        description:
          'Output shaft approaches input speed so the car cruises smoothly without the engine screaming.',
        color: '#f05a28',
      },
      {
        id: 'diff',
        label: 'Differential Split',
        description:
          'Ring and bevel spider gears route final spinning power out to both axle shafts—even when turning corners.',
        color: '#f05a28',
      },
    ],
    parts: [
      {
        id: 'casing',
        name: 'Gearbox Casing',
        plainEnglish:
          'The ribbed aluminum housing that holds bearings aligned and seals in lubricating gear oil.',
        analogy: 'Like the protective shell around a mechanical wristwatch.',
      },
      {
        id: 'clutch',
        name: 'Clutch Assembly',
        plainEnglish:
          'Smoothly disconnects the spinning engine from the gearbox so you can shift gears or stop without stalling.',
        analogy: 'Like squeezing two spinning plates together gently to share motion.',
      },
      {
        id: 'input-shaft',
        name: 'Input Shaft & Drive Gear',
        plainEnglish:
          'Brings spinning power directly from the engine clutch into the gearbox.',
        analogy: 'Like the front sprocket attached to bicycle pedals.',
      },
      {
        id: 'countershaft',
        name: 'Countershaft (Layshaft)',
        plainEnglish:
          'A lower shaft carrying fixed gears of different sizes that constantly mesh with the upper output gears.',
        analogy: 'Like a stepped cluster of gears waiting on a bike cassette.',
      },
      {
        id: 'synchronizer',
        name: 'Synchronizer Collar',
        plainEnglish:
          'Slides back and forth to lock one chosen output gear to the shaft after matching its spin speed.',
        analogy: 'Like matching footsteps before stepping onto a moving escalator.',
      },
      {
        id: 'differential',
        name: 'Differential & Axles',
        plainEnglish:
          'Splits rotation 90° out to the left and right wheels while letting the outer wheel spin faster in turns.',
        analogy: 'Like a playground seesaw gear letting two wheels travel different arc lengths.',
      },
    ],
    quiz: [
      {
        question: 'Why does a petrol car need a multi-speed transmission?',
        options: [
          'Engines only generate good power within a limited speed range',
          'To store extra fuel when going downhill',
          'To cool the brake rotors automatically',
          'To turn DC battery power into AC',
        ],
        correctIndex: 0,
        explanation:
          'Gear ratios let the engine stay in its comfortable RPM band from 0 mph launch up to highway speed.',
      },
      {
        question: 'What happens in 1st gear compared to top gear?',
        options: [
          'Highest top speed, lowest pulling force',
          'Strongest pulling torque, lowest wheel speed',
          'The engine disconnects completely from the wheels',
          'The tires spin backward',
        ],
        correctIndex: 1,
        explanation:
          'A small driving gear turning a large driven gear multiplies twisting torque for easy launches and hill climbs.',
      },
      {
        question: 'What is the job of the clutch in a manual gearbox?',
        options: [
          'To ignite fuel inside the cylinder',
          'To temporarily separate the engine from the transmission while shifting or stopping',
          'To inflate the tires automatically',
          'To steer the rear wheels',
        ],
        correctIndex: 1,
        explanation:
          'Disengaging the clutch takes load off the gear teeth so the synchronizer can slide cleanly into the next gear.',
      },
      {
        question: 'Why do cars need a differential between the driven wheels?',
        options: [
          'So the outside wheel can spin faster than the inside wheel around corners',
          'To make both wheels lock together permanently',
          'To increase exhaust volume',
          'To replace shock absorbers',
        ],
        correctIndex: 0,
        explanation:
          'Around a corner, the outer wheel travels a wider circle and must spin faster without scrubbing the tire.',
      },
      {
        question: 'Which sliding sleeve locks the selected gear ratio to the output shaft?',
        options: ['Flywheel', 'Synchronizer collar', 'Master cylinder', 'Thermostat'],
        correctIndex: 1,
        explanation:
          'The synchronizer matches speeds via friction cones and slides over dog teeth to lock that gear to the shaft.',
      },
    ],
  },

  brakes: {
    id: 'brakes',
    title: 'Hydraulic Disc Brakes',
    subtitle: 'How fluid pressure turns foot force into stopping power',
    intro:
      'When you tap the brake pedal, incompressible [[hydraulics|hydraulic pressure]] travels down sealed fluid lines to each wheel. Inside the [[caliper|brake caliper]], sliding pistons squeeze pads tightly against a spinning disc, converting kinetic motion safely into heat.',
    animationLabel: 'Braking Sequence',
    phases: [
      {
        id: 'coast',
        label: '1. Free Coast',
        description:
          'Pedal is released—fluid pressure is zero and pads sit fractions of a millimeter off the spinning disc.',
        color: '#f05a28',
      },
      {
        id: 'press',
        label: '2. Fluid Push',
        description:
          'Pressing the pedal drives the master cylinder piston, sending pressurized fluid down the brake line.',
        color: '#f05a28',
      },
      {
        id: 'clamp',
        label: '3. Friction Clamp',
        description:
          'Caliper pistons pinch both friction pads against the rotor, slowing wheel spin and warming the disc.',
        color: '#f05a28',
      },
      {
        id: 'release',
        label: '4. Clean Release',
        description:
          'Lifting your foot drops line pressure so square-cut piston seals pull pads smoothly back off the rotor.',
        color: '#f05a28',
      },
    ],
    parts: [
      {
        id: 'master-cylinder',
        name: 'Pedal & Master Cylinder',
        plainEnglish:
          'Turns your foot press into pressurized brake fluid inside a narrow hydraulic cylinder.',
        analogy: 'Like pushing the plunger on a sealed syringe full of oil.',
      },
      {
        id: 'brake-lines',
        name: 'Hydraulic Brake Lines',
        plainEnglish:
          'Strong steel and braided hoses carrying fluid pressure evenly from the pedal to all four corners.',
        analogy: 'Like rigid garden hoses delivering instant water pressure at the nozzle.',
      },
      {
        id: 'caliper',
        name: 'Brake Caliper',
        plainEnglish:
          'A rigid C-clamp bolted to the suspension that houses hydraulic pistons straddling the spinning rotor.',
        analogy: 'Like a heavy C-clamp with built-in water-powered fingers.',
      },
      {
        id: 'brake-pads',
        name: 'Friction Brake Pads',
        plainEnglish:
          'Heat-resistant composite pads pressed against both faces of the rotor to create controlled friction.',
        analogy: 'Like grippy rubber bicycle brake blocks wearing down so the rim stays safe.',
      },
      {
        id: 'brake-disc',
        name: 'Ventilated Brake Disc',
        plainEnglish:
          'A cast-iron rotor bolted to the wheel hub with cooling slots and holes to shed intense braking heat.',
        analogy: 'Like a heavy metal dinner plate spinning with the wheel.',
      },
    ],
    quiz: [
      {
        question: 'Where does a car’s kinetic (moving) energy go when you brake to a stop?',
        options: [
          'It turns into heat through friction between the pads and disc',
          'It turns directly back into petrol inside the tank',
          'It disappears into the steering rack',
          'It gets stored in the muffler',
        ],
        correctIndex: 0,
        explanation:
          'Friction slows the spinning rotor and converts forward motion into thermal energy that vents into the air.',
      },
      {
        question: 'Why do car brakes use incompressible liquid fluid instead of air?',
        options: [
          'Air would compress like a sponge instead of pushing the pads firmly right away',
          'Liquid freezes easily in summer',
          'Air makes the car accelerate forward',
          'Fluid adds weight to the steering wheel',
        ],
        correctIndex: 0,
        explanation:
          'Liquids barely compress under pressure, transmitting pedal force instantaneously to the calipers.',
      },
      {
        question: 'What do the drilled holes or cooling vents in a brake disc do?',
        options: [
          'Help shed extreme braking heat so the brakes don’t fade',
          'Make the car drive faster on highways',
          'Hold the tire air inside',
          'Lubricate the pads with oil',
        ],
        correctIndex: 0,
        explanation:
          'Cooler rotors keep friction consistent during repeated hard stops and prevent brake fluid from boiling.',
      },
      {
        question: 'Which component squeezes the brake pads onto the rotor?',
        options: ['The Spark Plug', 'The Brake Caliper', 'The Camshaft', 'The Alternator'],
        correctIndex: 1,
        explanation:
          'Hydraulic fluid pushes the caliper pistons inward to clamp both pads onto the disc.',
      },
      {
        question: 'What happens when you release the brake pedal?',
        options: [
          'Fluid pressure drops and the pads retract slightly so the wheel spins freely',
          'The calipers lock tighter permanently',
          'The master cylinder drains onto the road',
          'The engine shuts off',
        ],
        correctIndex: 0,
        explanation:
          'Pressure relaxes immediately and elastic caliper seals pull the pistons slightly back from the disc.',
      },
    ],
  },

  suspension: {
    id: 'suspension',
    title: 'Suspension & Damping',
    subtitle: 'How springs and dampers absorb bumps while keeping tires planted',
    intro:
      'A car’s suspension has two jobs: soak up road jolts and keep every tire pressed firmly onto the asphalt. Helical coil springs compress over bumps while an oil-filled [[damper|shock absorber (damper)]] stops the body from bouncing endlessly afterward.',
    animationLabel: 'Road Bump Cycle',
    phases: [
      {
        id: 'flat',
        label: '1. Smooth Roll',
        description:
          'On flat pavement, the coil spring holds the car level at its normal ride height.',
        color: '#f05a28',
      },
      {
        id: 'bump',
        label: '2. Bump Impact',
        description:
          'Wheel rides up a bump, pivoting the control arm and squeezing the coil spring to shield the cabin.',
        color: '#f05a28',
      },
      {
        id: 'rebound',
        label: '3. Controlled Rebound',
        description:
          'The shock absorber forces oil through tiny valves to gently slow the spring’s upward snap-back.',
        color: '#f05a28',
      },
      {
        id: 'grip',
        label: '4. Settled Grip',
        description:
          'Wheel settles cleanly back onto flat ground in one motion with zero lingering pogo bounce.',
        color: '#f05a28',
      },
    ],
    parts: [
      {
        id: 'wheel-hub',
        name: 'Wheel Hub & Tire',
        plainEnglish:
          'Follows the ups and downs of the road surface while spinning freely on precision wheel bearings.',
        analogy: 'Like the foot of a runner flexing over uneven pebbles.',
      },
      {
        id: 'control-arm',
        name: 'Lower Control Arm',
        plainEnglish:
          'A hinged triangular A-arm linking the wheel carrier to the frame so the tire travels cleanly up and down.',
        analogy: 'Like a hinge arm on a desk lamp keeping the head steady as it moves.',
      },
      {
        id: 'coil-spring',
        name: 'Helical Coil Spring',
        plainEnglish:
          'Coiled spring steel that compresses instantly when hitting a bump and supports the car’s weight.',
        analogy: 'Like a heavy mattress spring cushioning a sudden drop.',
      },
      {
        id: 'shock-damper',
        name: 'Shock Absorber (Damper)',
        plainEnglish:
          'A piston pushing thick oil through tiny holes inside a tube, turning spring bounce energy into gentle heat.',
        analogy: 'Like trying to plunge a perforated spoon quickly through a jar of honey.',
      },
      {
        id: 'strut-mount',
        name: 'Upper Strut Mount',
        plainEnglish:
          'A rubber-insulated bearing plate anchoring the top of the strut to the car body while allowing steering pivot.',
        analogy: 'Like a padded ball joint at the top of your leg socket.',
      },
    ],
    quiz: [
      {
        question: 'If a car had coil springs WITHOUT shock absorbers, how would it behave after a bump?',
        options: [
          'It would bounce up and down like a pogo stick for several seconds',
          'It would become completely rigid like solid wood',
          'The steering wheel would spin nonstop',
          'The brakes would overheat immediately',
        ],
        correctIndex: 0,
        explanation:
          'Springs store and release energy back and forth; shock absorbers damp out the oscillation in one smooth cycle.',
      },
      {
        question: 'How does a shock absorber slow down suspension bounce?',
        options: [
          'By pushing hydraulic oil through tiny internal valves',
          'By firing electric sparks at the tire',
          'By blowing air from the radiator',
          'By clamping brake pads onto the spring',
        ],
        correctIndex: 0,
        explanation:
          'Forcing viscous damper fluid through tight orifices resists fast movement and turns kinetic bounce into mild heat.',
      },
      {
        question: 'What is the main safety job of suspension beyond comfort?',
        options: [
          'Keeping all four tires pressed onto the road for grip, steering, and braking',
          'Increasing top engine RPM',
          'Purifying exhaust gases',
          'Recharging the 12V battery',
        ],
        correctIndex: 0,
        explanation:
          'If a wheel skips into the air over bumps, it cannot steer or brake—damped suspension keeps rubber planted.',
      },
      {
        question: 'Which part guides the bottom of the wheel hub in a controlled arc?',
        options: ['Lower Control Arm', 'Alternator', 'Catalytic Converter', 'Spark Plug'],
        correctIndex: 0,
        explanation:
          'The lower control arm (wishbone) pivots on chassis bushings to hold wheel alignment steady as it moves vertically.',
      },
      {
        question: 'Why does the upper strut mount include thick rubber insulation?',
        options: [
          'To filter out high-frequency road vibration and noise from entering the cabin',
          'To make the spring stiffer',
          'To store coolant',
          'To drive the rear differential',
        ],
        correctIndex: 0,
        explanation:
          'Rubber isolation stops harsh tire buzz and gravel impacts from resonating into the car body.',
      },
    ],
  },

  steering: {
    id: 'steering',
    title: 'Rack & Pinion Steering',
    subtitle: 'How turning the steering wheel angles both front tires smoothly',
    intro:
      'Almost every modern car uses a [[rack-pinion|rack-and-pinion]] gear set. Rotating the steering wheel spins a small cogwheel (pinion) that slides a straight toothed bar (rack) sideways, pulling both front wheels together into a turn.',
    animationLabel: 'Steering Sweep',
    phases: [
      {
        id: 'center',
        label: '1. Straight Ahead',
        description:
          'Steering wheel sits centered; the rack rests evenly in the middle and both front tires point straight.',
        color: '#f05a28',
      },
      {
        id: 'left',
        label: '2. Turn Left',
        description:
          'Counter-clockwise wheel rotation turns the pinion, sliding the rack right to push/pull the wheels left.',
        color: '#f05a28',
      },
      {
        id: 'return',
        label: '3. Self-Center',
        description:
          'Front suspension geometry naturally helps guide the tires and steering wheel back toward straight.',
        color: '#f05a28',
      },
      {
        id: 'right',
        label: '4. Turn Right',
        description:
          'Clockwise rotation drives the rack left, smoothly pivoting both steering knuckles to the right.',
        color: '#f05a28',
      },
    ],
    parts: [
      {
        id: 'steering-wheel',
        name: 'Steering Wheel',
        plainEnglish:
          'Your hands’ control lever—modern wheels multiply your turning motion smoothly across 2.5–3 turns lock-to-lock.',
        analogy: 'Like turning the helm wheel on a boat.',
      },
      {
        id: 'steering-column',
        name: 'Steering Column & U-Joint',
        plainEnglish:
          'A jointed shaft carrying rotation safely down from the dashboard angle to the low steering rack.',
        analogy: 'Like a flexible socket-wrench extension bending around corners.',
      },
      {
        id: 'pinion-gear',
        name: 'Pinion Gear',
        plainEnglish:
          'A compact steel gear at the end of the column whose teeth mesh directly into the steering rack.',
        analogy: 'Like the small cogwheel moving a sliding motorized driveway gate.',
      },
      {
        id: 'steering-rack',
        name: 'Toothed Steering Rack',
        plainEnglish:
          'A sliding steel bar with gear teeth cut along its face that translates left or right inside a sealed tube.',
        analogy: 'Like a straight zipper track pushed sideways by a rotating wheel.',
      },
      {
        id: 'tie-rods',
        name: 'Tie Rods & Knuckles',
        plainEnglish:
          'Ball-jointed steel links at both ends of the rack that pivot the front wheel hubs as the rack slides.',
        analogy: 'Like puppet rods pushing and pulling both front wheels in unison.',
      },
    ],
    quiz: [
      {
        question: 'What kind of motion conversion does a rack-and-pinion system perform?',
        options: [
          'Circular steering-wheel rotation into side-to-side linear sliding',
          'Linear tire bounce into electrical voltage',
          'Combustion heat into braking force',
          'Engine RPM into exhaust sound',
        ],
        correctIndex: 0,
        explanation:
          'The round pinion gear turns rotational input into left-right translation of the toothed rack.',
      },
      {
        question: 'Which parts connect the sliding steering rack directly to the front wheel hubs?',
        options: ['Tie rods', 'Piston rings', 'Valve springs', 'Water pumps'],
        correctIndex: 0,
        explanation:
          'Ball-jointed tie rods allow the wheels to pivot left/right while simultaneously moving up and down over bumps.',
      },
      {
        question: 'Why does the steering column include a universal joint (U-joint)?',
        options: [
          'To transfer rotation across an angle between the dashboard wheel and the low floor rack',
          'To inject fuel into the cylinder',
          'To double the speed of the tires',
          'To store spare brake fluid',
        ],
        correctIndex: 0,
        explanation:
          'A U-joint cleanly bends the steering shaft line without binding when rotated.',
      },
      {
        question: 'Why are tie rods fitted with flexible ball joints at their ends?',
        options: [
          'So wheels can steer AND bounce up and down on the suspension at the same time',
          'To prevent the wheels from spinning forward',
          'To generate sparks for the engine',
          'To circulate engine coolant',
        ],
        correctIndex: 0,
        explanation:
          'Without flexible ball joints, suspension travel over bumps would jam or bend the steering linkage.',
      },
      {
        question: 'If the pinion gear rotates clockwise and pushes the rack left, what happens to the wheels?',
        options: [
          'Both tie rods shift left, pivoting the front wheels smoothly together',
          'Only one wheel turns while the other stays straight',
          'The transmission shifts into reverse',
          'The radiator fan stops spinning',
        ],
        correctIndex: 0,
        explanation:
          'Because both tie rods attach behind or ahead of the hub pivot axis, sliding the rack turns both front wheels in sync.',
      },
    ],
  },

  electrical: {
    id: 'electrical',
    title: 'Electrical, Starter & Alternator',
    subtitle: 'How the 12V battery wakes the engine and gets recharged on the road',
    intro:
      'Your car’s electrical loop has two power sources: a chemical 12V battery that supplies huge current to crank the engine awake, and a belt-driven [[alternator|alternator]] that takes over once running to power every light and refill the battery.',
    animationLabel: 'Starting & Charging Cycle',
    phases: [
      {
        id: 'key',
        label: '1. Ignition Burst',
        description:
          'Turning the key sends 12V battery power to the starter solenoid, waking the electrical system.',
        color: '#f05a28',
      },
      {
        id: 'crank',
        label: '2. Starter Cranks',
        description:
          'Starter pinion gear slides forward to mesh with the flywheel and spin the sleeping engine awake.',
        color: '#f05a28',
      },
      {
        id: 'run',
        label: '3. Engine Runs',
        description:
          'Starter disengages; the running engine spins the serpentine belt connected to the alternator pulley.',
        color: '#f05a28',
      },
      {
        id: 'charge',
        label: '4. Alternator Recharges',
        description:
          'Alternator generates steady ~14V electricity to power headlights, computers, and refill the 12V battery.',
        color: '#f05a28',
      },
    ],
    parts: [
      {
        id: 'battery',
        name: '12V Lead-Acid Battery',
        plainEnglish:
          'Six chemical cells linked together storing electrical energy for starting the car and running electronics when parked.',
        analogy: 'Like a heavy-duty rechargeable power bank under the hood.',
      },
      {
        id: 'ignition-switch',
        name: 'Ignition Relay & Key',
        plainEnglish:
          'A safe low-current switch that triggers the heavy-duty starter solenoid without thick wires inside the cabin.',
        analogy: 'Like a light switch triggering a massive industrial breaker.',
      },
      {
        id: 'starter-motor',
        name: 'Starter Motor & Solenoid',
        plainEnglish:
          'A powerful high-torque electric motor whose small gear pops out to crank the engine flywheel at startup.',
        analogy: 'Like an electric wind-up key that spins the engine until it catches.',
      },
      {
        id: 'alternator',
        name: 'Alternator & Pulley',
        plainEnglish:
          'Spins magnets inside copper coils via an engine belt to produce continuous electrical power while driving.',
        analogy: 'Like a mini windmill or bike dynamo powered by the running engine.',
      },
      {
        id: 'wiring-harness',
        name: 'Wiring Harness & Lamps',
        plainEnglish:
          'Color-coded copper cables protected by fuses delivering electricity safely to lights, ignition, and sensors.',
        analogy: 'Like the house wiring inside walls feeding every outlet and lamp.',
      },
    ],
    quiz: [
      {
        question: 'Which component provides the burst of electrical power needed to start a parked car?',
        options: ['12V Battery', 'Alternator', 'Radiator Fan', 'Muffler'],
        correctIndex: 0,
        explanation:
          'The alternator only makes power when the engine is already spinning—the battery supplies startup current.',
      },
      {
        question: 'Once the engine is running, what recharges the 12V battery?',
        options: ['The Alternator', 'The Starter Motor', 'The Brake Calipers', 'The Exhaust Pipe'],
        correctIndex: 0,
        explanation:
          'A belt turns the alternator pulley, generating ~14V DC to top up the battery and power accessories.',
      },
      {
        question: 'Why does the starter motor gear retract right after the engine fires up?',
        options: [
          'Because the running engine spins far faster and would destroy the starter motor if left meshed',
          'To drain the battery quickly',
          'To turn off the headlights',
          'To lock the steering wheel',
        ],
        correctIndex: 0,
        explanation:
          'The starter only engages the flywheel ring gear for a second or two during cranking.',
      },
      {
        question: 'How does an alternator create electricity?',
        options: [
          'By spinning a magnetic rotor inside stationary copper wire coils',
          'By burning gasoline inside plastic battery cells',
          'By compressing brake fluid',
          'By filtering exhaust smoke',
        ],
        correctIndex: 0,
        explanation:
          'Electromagnetic induction turns mechanical belt spin into AC electricity, which built-in diodes convert to 14V DC.',
      },
      {
        question: 'If the alternator fails while driving, what happens eventually?',
        options: [
          'The battery slowly drains powering ignition and lights until the car stalls',
          'The car doubles its horsepower',
          'The brakes lock permanently',
          'The transmission shifts into 5th gear',
        ],
        correctIndex: 0,
        explanation:
          'Without the alternator refilling it, the battery runs down trying to keep computers, fuel pumps, and sparks alive.',
      },
    ],
  },

  cooling: {
    id: 'cooling',
    title: 'Liquid Cooling System',
    subtitle: 'How circulating coolant keeps the engine from melting down',
    intro:
      'Combustion inside an engine reaches over 2,000°C—hot enough to warp metal without cooling. A water pump pushes liquid [[coolant|coolant]] through hot engine jackets to a front finned radiator, where a fan and rushing air dump the heat.',
    animationLabel: 'Thermal Cooling Loop',
    phases: [
      {
        id: 'warmup',
        label: '1. Cold Warm-Up',
        description:
          'Thermostat stays closed when cold so coolant loops locally inside the block to reach ideal temperature fast.',
        color: '#f05a28',
      },
      {
        id: 'pump',
        label: '2. Pump Circulates',
        description:
          'Spinning impeller pushes coolant cleanly through narrow metal passages surrounding the hot cylinders.',
        color: '#f05a28',
      },
      {
        id: 'thermostat',
        label: '3. Thermostat Opens',
        description:
          'At ~90°C, the wax-pellet thermostat valve opens wide, sending hot orange coolant toward the radiator.',
        color: '#f05a28',
      },
      {
        id: 'radiator',
        label: '4. Radiator Cools',
        description:
          'Thin aluminum fins and the electric cooling fan shed heat to passing air, returning cool blue fluid back.',
        color: '#f05a28',
      },
    ],
    parts: [
      {
        id: 'engine-jacket',
        name: 'Engine Cooling Jacket',
        plainEnglish:
          'Hollow liquid channels cast right around the hot cylinder walls to soak up combustion heat.',
        analogy: 'Like cold water running through a double-walled kettle sleeve.',
      },
      {
        id: 'water-pump',
        name: 'Water Pump & Impeller',
        plainEnglish:
          'A belt-driven spinning paddle wheel that keeps coolant moving nonstop throughout the entire loop.',
        analogy: 'Like the heart pumping blood through your arteries.',
      },
      {
        id: 'thermostat',
        name: 'Thermostat Valve',
        plainEnglish:
          'A temperature-sensitive valve that stays shut when cold and opens automatically once the engine reaches ~90°C.',
        analogy: 'Like a smart bath tap keeping water warm before venting extra heat.',
      },
      {
        id: 'radiator',
        name: 'Finned Aluminum Radiator',
        plainEnglish:
          'Splits hot coolant into dozens of ultra-thin tubes surrounded by crinkled metal fins to dump heat into airflow.',
        analogy: 'Like blowing over hot soup spread wide across a shallow metal tray.',
      },
      {
        id: 'cooling-fan',
        name: 'Electric Cooling Fan',
        plainEnglish:
          'Pulls fresh outside air straight through the radiator fins when the car is idling in traffic.',
        analogy: 'Like a desk fan cooling a radiator when there is no natural breeze.',
      },
    ],
    quiz: [
      {
        question: 'Why does the thermostat stay closed when you first start a cold engine?',
        options: [
          'So the engine warms up quickly to its clean, efficient operating temperature',
          'To freeze the coolant into ice',
          'To stop the wheels from spinning',
          'To save headlight electricity',
        ],
        correctIndex: 0,
        explanation:
          'Engines wear faster and pollute more when stone-cold; holding coolant inside until ~90°C speeds warm-up.',
      },
      {
        question: 'Why are car radiators built with hundreds of thin flat fins?',
        options: [
          'To create huge surface area so passing air carries heat away rapidly',
          'To filter leaves out of gasoline',
          'To make the front bumper heavier',
          'To quiet down exhaust noise',
        ],
        correctIndex: 0,
        explanation:
          'More metal surface touching outside air means faster heat transfer out of the coolant.',
      },
      {
        question: 'When does the electric radiator cooling fan matter most?',
        options: [
          'When stopped in traffic or creeping slowly with little natural wind through the grille',
          'Only when parked with the key removed overnight',
          'Only when driving backward',
          'When shifting into 5th gear on an empty highway',
        ],
        correctIndex: 0,
        explanation:
          'At highway speed, rushing air cools the radiator naturally; at idle, the electric fan pulls air through.',
      },
      {
        question: 'Why do cars use coolant (water + antifreeze) instead of pure tap water?',
        options: [
          'Antifreeze stops winter freezing, raises the boiling point, and prevents internal rust',
          'Antifreeze fuels the spark plugs',
          'Tap water is too slippery',
          'Antifreeze inflates the tires',
        ],
        correctIndex: 0,
        explanation:
          'Ethylene/propylene glycol raises boiling temperature past 120°C under pressure and protects aluminum channels.',
      },
      {
        question: 'What happens if the water pump stops spinning?',
        options: [
          'Hot coolant stalls inside the engine block and the engine rapidly overheats',
          'The transmission doubles its gears',
          'The cabin air gets colder',
          'Fuel economy improves',
        ],
        correctIndex: 0,
        explanation:
          'Without circulation to carry heat to the front radiator, cylinder temperatures spike within minutes.',
      },
    ],
  },

  exhaust: {
    id: 'exhaust',
    title: 'Exhaust & Emissions Control',
    subtitle: 'How pipes clean toxic gases and quiet loud engine explosions',
    intro:
      'Every power stroke creates a fiery pressure bang and leftover combustion gases. Curved pipes collect those pulses, scrub toxic pollutants inside a hot [[catalytic-converter|catalytic converter]], smooth pressure waves in a resonator, and hush sound inside a baffled muffler.',
    animationLabel: 'Exhaust Cleaning Flow',
    phases: [
      {
        id: 'manifold',
        label: '1. Hot Manifold',
        description:
          'Equal-length header tubes gather roaring exhaust pulses cleanly from each cylinder port.',
        color: '#f05a28',
      },
      {
        id: 'cat',
        label: '2. Catalytic Scrub',
        description:
          'Hot gases flow through thousands of precious-metal honeycomb tunnels, neutralizing CO and NOx.',
        color: '#f05a28',
      },
      {
        id: 'resonator',
        label: '3. Wave Smoothing',
        description:
          'Resonator chamber cancels harsh droning frequencies using tuned acoustic reflection.',
        color: '#f05a28',
      },
      {
        id: 'muffler',
        label: '4. Quiet Exit',
        description:
          'Perforated tubes and internal muffler chambers quiet the blast before cleaner gas exits the tailpipe.',
        color: '#f05a28',
      },
    ],
    parts: [
      {
        id: 'manifold',
        name: 'Exhaust Manifold Headers',
        plainEnglish:
          'Heat-proof steel tubes bolted to the engine head that merge individual cylinder exhaust ports into one pipe.',
        analogy: 'Like four narrow mountain streams merging cleanly into one river.',
      },
      {
        id: 'o2-sensor',
        name: 'Oxygen (O₂) Sensor',
        plainEnglish:
          'Sniffs leftover oxygen in the exhaust stream and tells the engine computer to tweak fuel injection instantly.',
        analogy: 'Like a chef tasting soup constantly to adjust seasoning.',
      },
      {
        id: 'catalytic-converter',
        name: 'Catalytic Converter',
        plainEnglish:
          'A ceramic honeycomb coated in platinum, palladium, and rhodium that converts toxic gases into harmless N₂, CO₂, and H₂O.',
        analogy: 'Like a super-hot chemical purifier scrubbing smoke inside a chimney.',
      },
      {
        id: 'resonator',
        name: 'Acoustic Resonator',
        plainEnglish:
          'An inline expansion chamber tuned to cancel out annoying exhaust hums at cruising RPM.',
        analogy: 'Like noise-cancelling ear muffs targeting one specific buzz.',
      },
      {
        id: 'muffler',
        name: 'Baffled Muffler & Tip',
        plainEnglish:
          'Reflects sound waves against perforated walls inside chambers so loud cylinder bangs cancel each other out.',
        analogy: 'Like a labyrinth of padded sound baffles inside a recording booth.',
      },
    ],
    quiz: [
      {
        question: 'What is the main job of the catalytic converter?',
        options: [
          'To chemically turn harmful exhaust pollutants into cleaner gases like water vapor and nitrogen',
          'To make the exhaust sound louder',
          'To inject extra fuel into the tailpipe',
          'To cool the brake rotors',
        ],
        correctIndex: 0,
        explanation:
          'Precious metals inside the hot honeycomb trigger redox reactions that break down CO, unburned hydrocarbons, and NOx.',
      },
      {
        question: 'Why is the catalytic converter packed with a dense honeycomb grid?',
        options: [
          'To maximize surface contact with exhaust gases without blocking airflow',
          'To trap liquid engine coolant',
          'To spin a cooling fan',
          'To hold spare spark plugs',
        ],
        correctIndex: 0,
        explanation:
          'Thousands of parallel micro-channels expose exhaust gas to catalytic coatings with minimal back-pressure.',
      },
      {
        question: 'How does a muffler quiet a roaring engine?',
        options: [
          'Sound waves bounce inside perforated chambers and cancel each other out',
          'It plugs the pipe shut with solid rubber',
          'It freezes the exhaust gas',
          'It turns off the engine between strokes',
        ],
        correctIndex: 0,
        explanation:
          'Opposing reflected pressure waves interfere destructively, smoothing loud shockwaves into a quiet hum.',
      },
      {
        question: 'What does the Oxygen (O₂) sensor tell the engine computer?',
        options: [
          'Whether the fuel mixture is burning too rich or too lean so fuel injection stays exact',
          'How fast the front wheels are turning',
          'How much air is in the tires',
          'Whether the headlights are on',
        ],
        correctIndex: 0,
        explanation:
          'Closed-loop O₂ feedback keeps combustion clean and efficient for the catalytic converter.',
      },
      {
        question: 'Why do exhaust gases leave the engine hot and fast?',
        options: [
          'They come directly from high-pressure combustion power strokes inside the cylinders',
          'They are heated by the battery',
          'They come from the air conditioning',
          'They are pushed by the radiator fan',
        ],
        correctIndex: 0,
        explanation:
          'Even after pushing the piston down, combustion gas retains high heat and pressure when the exhaust valve opens.',
      },
    ],
  },
};

const DIESEL_ENGINE_LESSON: SystemLessonData = {
  id: 'engine',
  title: 'Diesel Compression-Ignition Engine',
  subtitle: 'How high compression turns pure air hot enough to ignite diesel fuel without spark plugs',
  intro:
    'Unlike petrol engines that rely on spark plugs, a diesel engine uses [[compression-ignition|compression ignition]]. On Stroke 1 it breathes pure air, squeezes that air dramatically on Stroke 2 past 500 °C, and injects a high-pressure mist of diesel fuel that self-ignites for high-pulling [[torque|torque]] at low RPM.',
  animationLabel: '4-Stroke Diesel Cycle',
  phases: [
    {
      id: 'intake',
      label: '1. Pure Air Intake',
      description:
        'Intake valve opens while the piston travels down, drawing only filtered fresh air (no fuel mixed yet) into the cylinder.',
      color: '#38bdf8',
    },
    {
      id: 'compression',
      label: '2. High Compression',
      description:
        'Both valves lock shut and the piston squeezes pure air at roughly 20:1 ratio, heating it past 500 °C.',
      color: '#a78bfa',
    },
    {
      id: 'power',
      label: '3. Inject & Ignite',
      description:
        'At Top Dead Center, high-pressure injectors mist diesel directly into the super-hot air, self-igniting immediately to drive strong torque.',
      color: '#f59e0b',
    },
    {
      id: 'exhaust',
      label: '4. Exhaust',
      description:
        'The exhaust valve opens and the rising piston expels burnt gases toward the turbocharger and emissions scrubbers.',
      color: '#fb7185',
    },
  ],
  parts: [
    {
      id: 'cylinder-block',
      name: 'Heavy-Duty Cylinder Block',
      plainEnglish:
        'Reinforced cast-iron or high-strength aluminum cylinders built to withstand nearly double the peak pressure of a petrol engine.',
      analogy: 'Like a thick steel hydraulic barrel engineered for heavy squeezing loads.',
    },
    {
      id: 'piston',
      name: 'Crown-Dish Piston',
      plainEnglish:
        'A rugged piston with a bowl shaped into its top face to swirl air and atomized diesel mist together evenly.',
      analogy: 'Like a whisk cup swirling cream right before ignition.',
    },
    {
      id: 'connecting-rod',
      name: 'Forged Connecting Rod',
      plainEnglish:
        'Extra-stout forged steel arm transferring high low-RPM diesel combustion force down to the crankshaft.',
      analogy: 'Like a heavy-lift pushrod built for strong, steady leg presses.',
    },
    {
      id: 'crankshaft',
      name: 'Crankshaft & Heavy Flywheel',
      plainEnglish:
        'Converts straight piston pushes into high-torque rotational power and smooths out strong compression pulses.',
      analogy: 'Like heavy crank pedals giving steady pushing leverage uphill.',
    },
    {
      id: 'camshaft',
      name: 'Camshaft & Timing Drive',
      plainEnglish:
        'Spins at half crankshaft speed to time intake air breathing and exhaust scavenging accurately.',
      analogy: 'Like a steady metronome opening intake and exhaust gates in sequence.',
    },
    {
      id: 'intake-valve',
      name: 'Intake Air Valve',
      plainEnglish:
        'Admits pure fresh or turbocharged air—never mixed with fuel until the top of compression.',
      analogy: 'Like taking a crisp deep breath before lifting something heavy.',
    },
    {
      id: 'exhaust-valve',
      name: 'Exhaust Valve',
      plainEnglish:
        'Opens to send high-energy exhaust out past the turbocharger turbine and particulate filter.',
      analogy: 'Like releasing wind toward a pinwheel turbine.',
    },
    {
      id: 'spark-plug',
      name: 'High-Pressure Fuel Injector',
      plainEnglish:
        'Replaces the spark plug in a diesel head, misting fuel at massive pressure straight into glowing compressed air.',
      analogy: 'Like a pressure nozzle spraying mist straight onto hot coals.',
    },
  ],
  quiz: [
    {
      question: 'How does fuel ignite inside a diesel engine instead of using a spark plug?',
      options: [
        'Extreme compression heats pure air hot enough that injected diesel ignites on contact',
        'A constant candle flame stays lit in the manifold',
        'Static electricity from the tires triggers ignition',
        'Coolant boils the fuel outside the cylinder',
      ],
      correctIndex: 0,
      explanation:
        'Diesel engines use compression ratios around 18:1–22:1 to heat trapped air well above diesel’s auto-ignition temperature.',
    },
    {
      question: 'What enters a diesel cylinder during Stroke 1 (Intake)?',
      options: ['Only air (often boosted by a turbo)', 'Pre-mixed petrol and oil', 'Coolant mist', 'Burnt exhaust'],
      correctIndex: 0,
      explanation:
        'Because air is compressed so intensely without premature detonation, diesel fuel is kept out until the end of Stroke 2.',
    },
    {
      question: 'What replaces the spark plug at the top of a diesel cylinder?',
      options: [
        'A high-pressure direct fuel injector (paired with cold-start glow plugs)',
        'A rubber plug',
        'A radiator cap',
        'An alternator belt',
      ],
      correctIndex: 0,
      explanation:
        'Common-rail injectors spray finely atomized diesel droplets at Top Dead Center; glow plugs only warm cold metal before startup.',
    },
    {
      question: 'Why are diesel SUVs prized for towing and heavy loads?',
      options: [
        'Longer piston leverage and full air-compression burns produce strong torque at low RPM',
        'They spin twice as fast as Formula engines',
        'They have no pistons or crankshaft',
        'They disable brakes while climbing hills',
      ],
      correctIndex: 0,
      explanation:
        'Diesel combustion stays broad and high-pressure as the piston descends, delivering high pulling torque at relaxed highway RPM.',
    },
    {
      question: 'What helps warm a cold diesel cylinder before turning the key on freezing mornings?',
      options: ['Glow plugs', 'Brake pads', 'Catalytic honeycombs', 'Shock absorbers'],
      correctIndex: 0,
      explanation:
        'Pencil-shaped glow plugs preheat the combustion pocket briefly so cold cylinder walls do not quench compression heat.',
    },
  ],
};

const EV_ENGINE_LESSON: SystemLessonData = {
  id: 'engine',
  title: 'Electric Motor & Regenerative Braking',
  subtitle: 'How magnetic fields spin the wheels directly—and reverse into a generator when you brake',
  intro:
    'An EV needs no pistons, valves, or burning fuel. Guided by the [[inverter|power inverter]], alternating electric current flows through stationary copper stator coils to spin a magnetic rotor silently with full [[torque|torque]] from 0 RPM—and captures motion via [[regenerative-braking|regenerative braking]] whenever you slow down.',
  animationLabel: 'Electric Drive & Regen Cycle',
  phases: [
    {
      id: 'energize',
      label: '1. Energize Stator',
      description:
        'High-voltage DC leaves the battery and enters the power inverter, creating a smoothly rotating magnetic field inside copper stator coils.',
      color: '#38bdf8',
    },
    {
      id: 'torque',
      label: '2. Magnetic Torque',
      description:
        'Permanent magnets on the central rotor chase that shifting magnetic field, spinning the reduction gearset with instant pulling force.',
      color: '#f59e0b',
    },
    {
      id: 'cruise',
      label: '3. Efficient Cruise',
      description:
        'At steady highway speed, the inverter trims current pulses cleanly, keeping energy draw low with minimal heat or mechanical friction.',
      color: '#a78bfa',
    },
    {
      id: 'regen',
      label: '4. Regen Braking',
      description:
        'Lift off the pedal and wheel inertia turns the motor as a generator—creating magnetic braking drag while sending energy back into the battery.',
      color: '#10b981',
    },
  ],
  parts: [
    {
      id: 'stator',
      name: 'Copper Stator Windings',
      plainEnglish:
        'Stationary bundles of insulated copper coils arranged in a ring that generate rotating magnetic poles when energized by AC electricity.',
      analogy: 'Like a circular ring of electromagnets passing a baton around a track.',
    },
    {
      id: 'rotor',
      name: 'Permanent-Magnet Rotor',
      plainEnglish:
        'The spinning central steel drum holding powerful magnets that chase the stator field—with zero metal-on-metal contact.',
      analogy: 'Like a magnetic merry-go-round pulled smoothly without anyone touching it.',
    },
    {
      id: 'inverter',
      name: 'Bi-Directional Power Inverter',
      plainEnglish:
        'Ultra-fast semiconductor switches converting battery DC to variable 3-phase AC to accelerate—and reversing back to DC during regen braking.',
      analogy: 'Like a robotic conductor speeding up or reversing the magnetic rhythm in microseconds.',
    },
    {
      id: 'reduction_gear',
      name: 'Single-Speed Reduction Gear',
      plainEnglish:
        'A compact fixed pair of helical gears that steps high-RPM motor spin down into strong axle wheel torque.',
      analogy: 'Like a rugged, maintenance-free single bike gear built for both launches and cruising.',
    },
    {
      id: 'battery_bus',
      name: 'HV Battery & Regen Bus',
      plainEnglish:
        'Orange high-voltage cables linking the underfloor battery pack to the motor controller—carrying power both out and back in.',
      analogy: 'Like a two-way energy highway between your fuel tank and wheels.',
    },
  ],
  quiz: [
    {
      question: 'Why can an electric motor deliver maximum torque right from 0 MPH without a multi-speed gearbox?',
      options: [
        'Electromagnetic attraction pushes the rotor cleanly at full current before it even starts spinning',
        'A tiny hidden 2-stroke engine pre-spins the wheels',
        'Exhaust pressure pressurizes the battery',
        'Friction brakes spin the motor forward',
      ],
      correctIndex: 0,
      explanation:
        'Unlike combustion engines that need higher RPM to breathe and make torque, magnetic fields deliver peak force instantaneously at standstill.',
    },
    {
      question: 'What happens inside the electric motor during Regenerative Braking?',
      options: [
        'Car momentum spins the rotor inside the coils, turning the motor into a generator that recharges the battery',
        'Reverse sparks burn leftover electricity',
        'The inverter shuts the wheels completely off the axles',
        'Battery fluid drains onto the brake pads',
      ],
      correctIndex: 0,
      explanation:
        'An electric motor and generator are the same physical machine run in opposite energy directions—charging slows the car gently without wearing brake pads.',
    },
    {
      question: 'What job does the Power Inverter perform between battery and motor?',
      options: [
        'Converts battery DC into precisely timed 3-phase AC (and back to DC during regen)',
        'Mixes coolant with gasoline',
        'Sprays windshield fluid on hot rotors',
        'Shifts a 10-speed clutch fork',
      ],
      correctIndex: 0,
      explanation:
        'EV batteries store direct current (DC), while traction motors use controlled alternating magnetic fields shaped by the inverter.',
    },
    {
      question: 'Why does an Electric Car need NO Exhaust system?',
      options: [
        'Zero fuel is burned inside the car, so there are no combustion fumes to vent or muffle',
        'Exhaust gases are stored inside the glovebox',
        'Tires absorb all exhaust smoke',
        'It uses a giant muffler wrapped around the roof',
      ],
      correctIndex: 0,
      explanation:
        'Electric propulsion creates torque directly from electromagnetism with zero tailpipe emissions.',
    },
    {
      question: 'Roughly how many primary moving power parts turn torque in an EV drive unit compared to an engine?',
      options: [
        'Far fewer—primarily just the spinning rotor, reduction gears, and half-shafts',
        'Over 200 valves and pistons',
        'Four heavy crankshafts per wheel',
        'Only a water pump',
      ],
      correctIndex: 0,
      explanation:
        'Simpler rotating mechanics mean smoother operation, virtually zero vibration, and minimal routine wear items.',
    },
  ],
};

const EV_ELECTRICAL_LESSON: SystemLessonData = {
  ...SYSTEM_LESSONS.electrical,
  title: 'Battery Pack & Power Inverter',
  subtitle: 'How high-voltage lithium-ion modules store energy and feed both traction drive and cabin electronics',
  intro:
    'In an EV, the underfloor battery replaces the fuel tank while the [[inverter|power inverter]] and Battery Management System (BMS) orchestrate safe charging, instant power delivery, and [[regenerative-braking|regenerative energy]] capture. A smaller 12V battery still runs safety relays, wipers, and screens.',
  parts: [
    {
      id: 'battery',
      name: 'Underfloor HV Battery Pack & 12V Aux',
      plainEnglish:
        'Hundreds of sealed lithium-ion cells bolted flat under the floor store energy at 400–800V DC, lowering the car’s center of gravity.',
      analogy: 'Like banking hundreds of fast-charging power banks safely into a skateboard chassis.',
    },
    {
      id: 'ignition-switch',
      name: 'HV Contactors & Power-On',
      plainEnglish:
        'Heavy computer-checked relays powered by the 12V battery that safely close the high-voltage circuit when you step on the brake to drive.',
      analogy: 'Like dual industrial safety switches that confirm everything is insulated before energizing.',
    },
    {
      id: 'starter-motor',
      name: 'Onboard Charger (AC → DC)',
      plainEnglish:
        'Built-in converter used when plugging into a wall AC charger to step and rectify electricity cleanly into DC for the battery.',
      analogy: 'Like a rugged, liquid-cooled phone brick built right inside the car.',
    },
    {
      id: 'alternator',
      name: 'DC-DC Converter (Replaces Alternator)',
      plainEnglish:
        'Steps 400V traction battery power smoothly down to ~14V so headlights, wipers, and screens never drain the 12V battery.',
      analogy: 'Like a silent solid-state transformer instead of a spinning belt generator.',
    },
    {
      id: 'wiring-harness',
      name: 'Shielded HV Bus & 12V Harness',
      plainEnglish:
        'Bright-orange insulated high-voltage cables paired with low-voltage wiring carrying sensors, headlights, and safety interlock loops.',
      analogy: 'Like thick armored power mains alongside lightweight nerve cables.',
    },
  ],
  quiz: [
    {
      question: 'Why do electric vehicles mount the heavy battery pack flat under the passenger floor?',
      options: [
        'It keeps weight low and centered for stable cornering and maximizes cabin room',
        'To heat the brake calipers continuously',
        'So sunlight shines straight onto the cells',
        'Because there is nowhere under the hood for wires',
      ],
      correctIndex: 0,
      explanation:
        'A flat "skateboard" pack gives EVs an exceptionally low center of gravity while opening interior legroom and trunk space.',
    },
    {
      question: 'What color jackets identify high-voltage cables (often 400V–800V) under an EV?',
      options: ['Bright orange', 'Clear plastic', 'Silver foil', 'Camo green'],
      correctIndex: 0,
      explanation:
        'International safety standards require high-voltage EV cables to wear bright orange insulation so technicians and first responders recognize them instantly.',
    },
    {
      question: 'What replaces a belt-driven alternator inside an EV to keep the 12V auxiliary battery charged?',
      options: ['A solid-state DC-DC converter', 'A spare exhaust fan', 'A hydraulic brake master cylinder', 'A flywheel clutch'],
      correctIndex: 0,
      explanation:
        'Because an EV has no continuously spinning combustion engine belt, a DC-DC converter taps energy from the main HV pack to feed 12V accessories.',
    },
    {
      question: 'What does the Battery Management System (BMS) monitor constantly?',
      options: [
        'Cell voltages, temperatures, and safe charging/discharging limits',
        'Tire tread depth every mile',
        'Windshield washer soap level',
        'Exhaust oxygen richness',
      ],
      correctIndex: 0,
      explanation:
        'The BMS balances cell voltages and requests cooling or current throttling before any cell overheats or overcharges.',
    },
    {
      question: 'Why does an EV still carry a regular 12V auxiliary battery?',
      options: [
        'To power door locks, lights, computers, and safely close the high-voltage relays at startup',
        'To turn the main drive axle uphill',
        'To ignite spark plugs in cylinder #1',
        'To spin the steering wheel automatically',
      ],
      correctIndex: 0,
      explanation:
        'Keeping high-voltage relays open while parked protects the car; the 12V battery wakes controllers and runs safety self-checks first.',
    },
  ],
};

const EV_COOLING_LESSON: SystemLessonData = {
  ...SYSTEM_LESSONS.cooling,
  title: 'Battery & Electronics Cooling',
  subtitle: 'How liquid thermal plates protect lithium-ion longevity and enable rapid charging',
  intro:
    'Batteries hate extremes—too hot shortens cell life, and freezing cold slows fast charging. An EV thermal loop pumps [[coolant|coolant]] through thin cold plates under the battery pack, past the [[inverter|power inverter]], and out to a heat exchanger or cabin heat pump.',
  parts: [
    {
      id: 'engine-jacket',
      name: 'Battery Cold Plates & Inverter Channels',
      plainEnglish:
        'Slim aluminum ribbon channels pressed beneath the battery modules and across motor/inverter electronics to draw heat evenly out.',
      analogy: 'Like water-cooled chill plates cradling high-powered computer processors.',
    },
    {
      id: 'water-pump',
      name: 'Electric Coolant Pumps',
      plainEnglish:
        'Variable-speed 12V/HV pumps that keep cooling liquid moving even while parked during DC fast charging.',
      analogy: 'Like silent circulation pumps keeping a building evenly tempered.',
    },
    {
      id: 'thermostat',
      name: 'Multi-Way Thermal Valve',
      plainEnglish:
        'Routes coolant flexibly between battery pre-heating, chiller cooling, motor waste-heat recovery, or radiator shedding.',
      analogy: 'Like a smart plumbing manifold redirecting warm or cold water on demand.',
    },
    {
      id: 'radiator',
      name: 'Front Heat Exchanger & Chiller',
      plainEnglish:
        'Dumps excess battery and inverter warmth into outside airflow—or links with the AC refrigerant circuit during scorching fast-charge sessions.',
      analogy: 'Like a fridge heat-exchanger coil working together with a wind-swept radiator.',
    },
    {
      id: 'cooling-fan',
      name: 'Active Grille & Fan Assembly',
      plainEnglish:
        'Opens active aero flaps and spins when parked fast-charging so airflow strips heat even at 0 MPH.',
      analogy: 'Like an extractor fan kicking in while the charger works hard.',
    },
  ],
  quiz: [
    {
      question: 'Why does an EV need active thermal cooling even when parked at a DC fast charger?',
      options: [
        'High-rate fast charging pushes huge current through battery resistance, generating cell heat at 0 MPH',
        'The pistons continue pumping while parked',
        'Exhaust pipes heat the rear trunk',
        'The starter motor never turns off',
      ],
      correctIndex: 0,
      explanation:
        'Electric coolant pumps, chillers, and front fans remove charging heat while stationary so cells charge fast without aging prematurely.',
    },
    {
      question: 'How does coolant physically remove heat from EV battery cells?',
      options: [
        'By flowing through thin aluminum cold plates bonded tightly against battery modules',
        'By spraying directly inside sealed lithium pouches',
        'By flooding the passenger cabin floor',
        'By routing engine exhaust through the pack',
      ],
      correctIndex: 0,
      explanation:
        'Cold plates transfer heat cleanly across electrically insulating thermal pads without liquid ever touching live cells.',
    },
    {
      question: 'In freezing winter weather, what extra job can an EV thermal system perform?',
      options: [
        'Pre-warming battery modules gently so fast charging and regen braking work safely',
        'Boiling fuel in a carburetor',
        'Freezing the brake lines',
        'Increasing tire drag',
      ],
      correctIndex: 0,
      explanation:
        'Warming cold cells prevents lithium plating during fast charging and restores full regenerative braking power.',
    },
    {
      question: 'Besides the battery pack, which two drive components share EV liquid cooling?',
      options: [
        'The power inverter and electric motor stator',
        'The catalytic converter and muffler',
        'The mechanical clutch and carburetors',
        'The rear bumper and windshield',
      ],
      correctIndex: 0,
      explanation:
        'Semiconductor switches in the inverter and copper stator coils run cooler and more efficiently when liquid-cooled.',
    },
    {
      question: 'Why do many EVs open small lower grille shutters only when cooling is needed?',
      options: [
        'Keeping aero flaps closed at highway cruise reduces wind drag and extends driving range',
        'To feed oxygen to a combustion engine',
        'To vent loud tailpipe sound',
        'To cool the glovebox',
      ],
      correctIndex: 0,
      explanation:
        'Active aero shutters balance cooling capacity during climbs/charging against ultra-slick aerodynamics on the highway.',
    },
  ],
};

export function getSystemLesson(
  systemId: SystemId,
  powertrain: Powertrain = 'petrol',
): SystemLessonData {
  if (powertrain === 'diesel' && systemId === 'engine') {
    return DIESEL_ENGINE_LESSON;
  }
  if (powertrain === 'ev') {
    if (systemId === 'engine') return EV_ENGINE_LESSON;
    if (systemId === 'electrical') return EV_ELECTRICAL_LESSON;
    if (systemId === 'cooling') return EV_COOLING_LESSON;
  }
  return SYSTEM_LESSONS[systemId];
}
