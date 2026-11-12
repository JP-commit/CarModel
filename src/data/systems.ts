import type { EngineLayout, Powertrain, SystemId, TransmissionType } from '../state/appState';

export interface VariantOption<T extends string = string> {
  id: T;
  shortLabel: string;
  label: string;
  badge?: string;
}

export const TRANSMISSION_VARIANT_OPTIONS: VariantOption<TransmissionType>[] = [
  { id: 'manual', shortLabel: 'Manual', label: 'Manual (MT)', badge: 'H-Gate' },
  { id: 'amt', shortLabel: 'AMT', label: 'Automated Manual (AMT)', badge: 'Actuated' },
  { id: 'at', shortLabel: 'Automatic', label: 'Automatic (AT)', badge: 'Planetary' },
  { id: 'cvt', shortLabel: 'CVT', label: 'CVT (Steel Belt)', badge: 'Stepless' },
  { id: 'dct', shortLabel: 'DCT', label: 'Dual-Clutch (DCT)', badge: 'Pre-select' },
  { id: 'ev-reducer', shortLabel: 'EV Gear', label: 'Single-Speed Reducer', badge: 'EV' },
];

export const ENGINE_VARIANT_OPTIONS: VariantOption<EngineLayout>[] = [
  { id: 'single-cylinder', shortLabel: '1-Cyl', label: 'Single-Cylinder (Basics)' },
  { id: 'i3', shortLabel: 'I3', label: 'Inline-3 (120°)' },
  { id: 'i4', shortLabel: 'I4', label: 'Inline-4 (Flat-Plane)' },
  { id: 'i6', shortLabel: 'I6', label: 'Inline-6 (Balanced)' },
  { id: 'v6', shortLabel: 'V6', label: 'V6 (60° Bank)' },
  { id: 'v8', shortLabel: 'V8', label: 'V8 (90° Cross-Plane)' },
  { id: 'v10', shortLabel: 'V10', label: 'V10 (72° Bank)' },
  { id: 'v12', shortLabel: 'V12', label: 'V12 (60° Exotic)' },
  { id: 'flat-4', shortLabel: 'Flat-4', label: 'Flat-4 Boxer (180°)' },
  { id: 'flat-6', shortLabel: 'Flat-6', label: 'Flat-6 Boxer (180°)' },
  { id: 'rotary', shortLabel: 'Rotary', label: 'Wankel Rotary' },
];

export interface SystemMetadata {
  id: SystemId;
  order: number;
  name: string;
  shortLabel: string;
  tagline: string;
  plainEnglish: string;
  analogy: string;
  keyParts: string[];
  accentColor: string;
  cameraOffset: [number, number, number];
  targetOffset: [number, number, number];
  prefersXray: boolean;
}

export const SYSTEMS: SystemMetadata[] = [
  {
    id: 'engine',
    order: 1,
    name: 'Engine',
    shortLabel: 'Engine',
    tagline: 'Turns fuel and air into spinning motion',
    plainEnglish:
      'Burns fuel and air in small, controlled bursts. Each push drives a piston down and spins the crankshaft, which makes the power.',
    analogy: 'Pedalling a bike: every piston is a leg pushing the cranks round.',
    keyParts: ['Pistons', 'Cylinders', 'Crankshaft', 'Valves', 'Spark plugs'],
    accentColor: '#d93a1e',
    cameraOffset: [1.55, 0.96, 1.45],
    targetOffset: [0, 0.04, 0],
    prefersXray: true,
  },
  {
    id: 'transmission',
    order: 2,
    name: 'Transmission',
    shortLabel: 'Transmission',
    tagline: 'Matches engine speed to wheel speed',
    plainEnglish:
      'Uses different-sized gear pairs so the car gets strong pulling power at low speed and relaxed, fuel-saving cruising on the highway.',
    analogy: 'Shifting gears on a multi-speed bike when climbing a hill vs. coasting flat.',
    keyParts: ['Clutch', 'Input Shaft', 'Gear Pairs', 'Synchronizer', 'Differential'],
    accentColor: '#d93a1e',
    cameraOffset: [1.85, 0.88, 0.5],
    targetOffset: [0, 0, 0],
    prefersXray: true,
  },
  {
    id: 'brakes',
    order: 3,
    name: 'Brakes',
    shortLabel: 'Brakes',
    tagline: 'Turns forward motion into heat to stop safely',
    plainEnglish:
      'Pressing the pedal squeezes hydraulic fluid through lines, clamping friction pads onto a spinning metal disc attached to each wheel.',
    analogy: 'Pinching a spinning bicycle rim between rubber brake pads with your hand.',
    keyParts: ['Brake Disc', 'Caliper', 'Friction Pads', 'Master Cylinder', 'Brake Lines'],
    accentColor: '#d93a1e',
    cameraOffset: [1.35, 0.45, 0.78],
    targetOffset: [0, 0, 0],
    prefersXray: false,
  },
  {
    id: 'suspension',
    order: 4,
    name: 'Suspension',
    shortLabel: 'Suspension',
    tagline: 'Absorbs bumps and keeps tires glued to the road',
    plainEnglish:
      'Coil springs soak up road impacts while shock absorbers calm the bounce so the cabin stays smooth and all four tires keep gripping.',
    analogy: 'Bending your knees when landing a jump instead of keeping your legs locked.',
    keyParts: ['Coil Spring', 'Shock Damper', 'Control Arm', 'Strut Mount', 'Wheel Hub'],
    accentColor: '#d93a1e',
    cameraOffset: [1.45, 0.58, -0.82],
    targetOffset: [0, 0.02, 0],
    prefersXray: true,
  },
  {
    id: 'steering',
    order: 5,
    name: 'Steering',
    shortLabel: 'Steering',
    tagline: 'Turns wheel rotation into front-tire angles',
    plainEnglish:
      'Turning the steering wheel spins a small pinion gear that slides a toothed rack left or right, pivoting both front wheels together.',
    analogy: 'Turning bicycle handlebars linked directly to the front wheel fork.',
    keyParts: ['Steering Wheel', 'Column', 'Pinion Gear', 'Toothed Rack', 'Tie Rods'],
    accentColor: '#d93a1e',
    cameraOffset: [1.18, 1.08, 0.9],
    targetOffset: [0, -0.04, 0],
    prefersXray: true,
  },
  {
    id: 'electrical',
    order: 6,
    name: 'Electrical & Battery',
    shortLabel: 'Electrical',
    tagline: 'Starts the engine and powers every light and sensor',
    plainEnglish:
      'The battery delivers the electrical burst that cranks the engine awake; once running, the belt-driven alternator recharges it on the move.',
    analogy: 'A rechargeable power bank paired with a small generator that refills it while riding.',
    keyParts: ['12V Battery', 'Starter Motor', 'Alternator', 'Drive Belt', 'Fuse Box'],
    accentColor: '#d93a1e',
    cameraOffset: [-1.45, 0.94, 1.3],
    targetOffset: [0, 0.04, 0],
    prefersXray: true,
  },
  {
    id: 'cooling',
    order: 7,
    name: 'Cooling',
    shortLabel: 'Cooling',
    tagline: 'Carries dangerous heat out of the engine block',
    plainEnglish:
      'A water pump circulates liquid coolant through hot engine channels and out to the front radiator, where rushing air dumps the extra heat.',
    analogy: 'Sweating and standing in front of a fan to release extra body heat.',
    keyParts: ['Radiator', 'Water Pump', 'Thermostat', 'Cooling Fan', 'Hoses'],
    accentColor: '#d93a1e',
    cameraOffset: [0.92, 0.62, 1.72],
    targetOffset: [0, 0.02, 0],
    prefersXray: true,
  },
  {
    id: 'exhaust',
    order: 8,
    name: 'Exhaust',
    shortLabel: 'Exhaust',
    tagline: 'Cleans, quiets, and vents leftover combustion gases',
    plainEnglish:
      'Hot gases leave the engine, pass through a catalytic converter that cleans harmful emissions, and exit quietly through a baffled muffler.',
    analogy: 'A kitchen range hood paired with an air purifier and a silencer.',
    keyParts: ['Manifold', 'Oxygen Sensor', 'Catalytic Converter', 'Resonator', 'Muffler'],
    accentColor: '#d93a1e',
    cameraOffset: [1.5, 0.56, -1.42],
    targetOffset: [0, 0.02, 0],
    prefersXray: true,
  },
];

export const SYSTEM_MAP: Record<SystemId, SystemMetadata> = Object.fromEntries(
  SYSTEMS.map((sys) => [sys.id, sys]),
) as Record<SystemId, SystemMetadata>;

type SystemCopyOverride = Partial<
  Pick<SystemMetadata, 'name' | 'shortLabel' | 'tagline' | 'plainEnglish' | 'analogy' | 'keyParts'>
>;

const POWERTRAIN_OVERRIDES: Partial<Record<Powertrain, Partial<Record<SystemId, SystemCopyOverride>>>> = {
  diesel: {
    engine: {
      name: 'Diesel Engine',
      shortLabel: 'Engine',
      tagline: 'Ignites fuel via extreme air compression instead of sparks',
      plainEnglish:
        'Draws in pure air and squeezes it far tighter than a petrol engine, heating it past 500 °C. High-pressure injectors spray diesel mist that ignites on contact, producing huge low-speed torque.',
      analogy:
        'Like pumping a bicycle tire so fast and hard the barrel gets hot enough to ignite fuel on contact.',
      keyParts: ['Pistons', 'High-Pressure Injectors', 'Glow Plugs', 'Turbocharger', 'Crankshaft'],
    },
  },
  ev: {
    engine: {
      name: 'Electric Motor',
      shortLabel: 'Motor',
      tagline: 'Turns battery electricity into instant spinning torque',
      plainEnglish:
        'Alternating current energizes stationary copper stator coils, pulling a magnetic rotor smoothly at full torque from zero speed—and reverses into a generator to recover energy during braking.',
      analogy:
        'Like racing a strong magnet inside a ring of shifting electromagnets with zero pistons or explosions.',
      keyParts: ['Copper Stator', 'Magnetic Rotor', 'Reduction Gear', 'Half-Shafts', 'Regen Mode'],
    },
    transmission: {
      name: 'Single-Speed Reducer',
      shortLabel: 'Reducer',
      tagline: 'Matches high-RPM motor spin to road-wheel torque',
      plainEnglish:
        'Because an electric motor produces peak pulling torque from 0 RPM up past 14,000 RPM, EVs skip clutches and shifting gears for a strong single-speed reduction gearset and differential.',
      analogy: 'Like a single rugged heavy-duty bicycle gear tuned for instant launch and highway speed.',
      keyParts: ['Input Pinion', 'Helical Reducer', 'Differential', 'Parking Pawl', 'Half-Shafts'],
    },
    electrical: {
      name: 'Battery and Inverter',
      shortLabel: 'Battery',
      tagline: 'Stores high-voltage DC and shapes AC power for the motor',
      plainEnglish:
        'An underfloor lithium-ion battery pack stores hundreds of volts of DC power, while the power inverter transforms DC into variable 3-phase AC for smooth throttle control and captures regen braking energy.',
      analogy:
        'Like a huge energy reservoir paired with a digital dimmer switch responding in milliseconds.',
      keyParts: ['HV Battery Pack', 'Power Inverter', 'Onboard Charger', 'BMS', '12V Aux Battery'],
    },
    cooling: {
      name: 'Battery Cooling',
      shortLabel: 'Cooling',
      tagline: 'Keeps cells, inverter, and motor in their optimal temperature zone',
      plainEnglish:
        'Liquid coolant flows through flat aluminum cold plates beneath battery modules and past the inverter and stator, carrying heat to the front heat exchanger during fast charging or hard driving.',
      analogy: 'Like chilled computer liquid-cooling plates drawing heat out of high-power chips.',
      keyParts: ['Battery Cold Plates', 'Coolant Pump', 'Chiller Valve', 'Heat Exchanger', 'Sensors'],
    },
  },
};

const TRANSMISSION_COPY_OVERRIDES: Partial<Record<TransmissionType, SystemCopyOverride>> = {
  manual: {
    name: 'Manual Transmission',
    shortLabel: 'Manual',
    tagline: 'Driver-controlled H-gate shifter, friction clutch, and stepped gears',
  },
  amt: {
    name: 'AMT Gearbox',
    shortLabel: 'AMT',
    tagline: 'Computer-actuated manual gearbox with robotic clutch and shift forks',
    plainEnglish:
      'Uses the same rugged shafts and gears as a manual transmission, while an electronic TCU drives hydraulic or electric actuators to work the clutch and shift forks automatically.',
    analogy: 'Like an invisible co-driver pressing the clutch and sliding the H-shifter for you.',
    keyParts: ['Clutch Actuator', 'Shift Fork Motor', 'TCU Module', 'Countershaft', 'Differential'],
  },
  at: {
    name: 'Automatic (AT)',
    shortLabel: 'Automatic',
    tagline: 'Fluid torque converter + planetary gearsets for seamless shifts',
    plainEnglish:
      'Replaces the friction clutch with a fluid torque converter that multiplies launch torque, feeding compact sun-planet-ring planetary gearsets engaged silently by hydraulic clutch packs.',
    analogy: 'Like two desk fans facing each other in oil—fluid spin locks them together as speed rises.',
    keyParts: ['Torque Converter', 'Planetary Gearsets', 'Clutch Packs', 'Valve Body', 'ATF Pump'],
  },
  cvt: {
    name: 'CVT Transmission',
    shortLabel: 'CVT',
    tagline: 'Variable-width conical pulleys linked by a steel belt for stepless ratios',
    plainEnglish:
      'Instead of fixed gear steps, two hydraulic conical pulleys squeeze together or slide apart to vary the steel belt radius continuously—keeping the engine in its sweet spot.',
    analogy: 'Like a bicycle derailleur sliding smoothly through infinite ratios with zero shift jolt.',
    keyParts: ['Primary Pulley', 'Secondary Pulley', 'Steel Push-Belt', 'Forward/Reverse Planetary', 'Hydraulic Pump'],
  },
  dct: {
    name: 'Dual-Clutch (DCT)',
    shortLabel: 'DCT',
    tagline: 'Twin concentric input shafts pre-select the next gear for lightning shifts',
    plainEnglish:
      'Splits gears into odd (1-3-5) and even (2-4-6) shafts, each with its own clutch. While driving in 2nd, 3rd is already waiting so one clutch releases as the other bites in milliseconds.',
    analogy: 'Like a relay runner passing the baton at full sprint without slowing down.',
    keyParts: ['K1/K2 Dual Clutch', 'Odd/Even Concentric Shafts', 'Mechatronic Unit', 'Synchronizers', 'Differential'],
  },
  'ev-reducer': {
    name: 'Single-Speed Reducer',
    shortLabel: 'EV Gear',
    tagline: 'Matches high-RPM motor spin to road-wheel torque',
  },
};

const ENGINE_COPY_OVERRIDES: Partial<Record<EngineLayout, SystemCopyOverride>> = {
  'single-cylinder': {
    shortLabel: '1-Cyl',
    tagline: 'One cylinder clearly shows every beat of the 4-stroke cycle',
  },
  i3: {
    name: 'Inline-3 Engine',
    shortLabel: 'I3',
    tagline: 'Three upright cylinders timed 240° apart for compact efficiency',
  },
  i4: {
    name: 'Inline-4 Engine',
    shortLabel: 'I4',
    tagline: 'Four inline cylinders firing evenly every 180° of crank rotation',
  },
  i6: {
    name: 'Inline-6 Engine',
    shortLabel: 'I6',
    tagline: 'Naturally balanced six-in-a-row cylinders firing every 120°',
  },
  v6: {
    name: 'V6 Engine (60°)',
    shortLabel: 'V6',
    tagline: 'Two angled 3-cylinder banks sharing a compact crankshaft',
  },
  v8: {
    name: 'V8 Engine (90°)',
    shortLabel: 'V8',
    tagline: 'Two 4-cylinder banks on a cross-plane crank delivering muscular V8 rumble',
  },
  v10: {
    name: 'V10 Engine (72°)',
    shortLabel: 'V10',
    tagline: 'Ten cylinders firing every 72° for high-revving supercar power',
  },
  v12: {
    name: 'V12 Engine (60°)',
    shortLabel: 'V12',
    tagline: 'Two inherently balanced 6-cylinder banks firing continuously',
  },
  'flat-4': {
    name: 'Flat-4 Boxer Engine',
    shortLabel: 'Flat-4',
    tagline: 'Opposed horizontal cylinders punch outward together for a low center of gravity',
  },
  'flat-6': {
    name: 'Flat-6 Boxer Engine',
    shortLabel: 'Flat-6',
    tagline: 'Six horizontally opposed pistons delivering velvety balance low in the chassis',
  },
  rotary: {
    name: 'Wankel Rotary Engine',
    shortLabel: 'Rotary',
    tagline: 'An orbiting triangular rotor completes 4-stroke combustion inside an oval housing',
    plainEnglish:
      'Instead of up-and-down pistons and valves, a three-sided rotor orbits eccentrically inside an epitrochoid chamber, turning intake, squeeze, burn, and exhaust into pure rotary motion.',
    analogy: 'Like a spinning triangle surfing smoothly inside a figure-eight racetrack.',
    keyParts: ['Triangular Rotor', 'Trochoid Housing', 'Eccentric Shaft', 'Apex Seals', 'Intake/Exhaust Ports'],
  },
};

export function getSystemMetadata(
  id: SystemId,
  powertrain: Powertrain = 'petrol',
  variant?: string,
): SystemMetadata {
  const base = SYSTEM_MAP[id];
  const ptOverride = POWERTRAIN_OVERRIDES[powertrain]?.[id];
  let result = ptOverride ? { ...base, ...ptOverride } : base;

  if (variant && id === 'transmission' && powertrain !== 'ev') {
    const varOverride = TRANSMISSION_COPY_OVERRIDES[variant as TransmissionType];
    if (varOverride) result = { ...result, ...varOverride };
  } else if (variant && id === 'engine' && powertrain !== 'ev') {
    const varOverride = ENGINE_COPY_OVERRIDES[variant as EngineLayout];
    if (varOverride) result = { ...result, ...varOverride };
  }

  return result;
}
