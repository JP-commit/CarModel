import type { Powertrain, SystemId } from '../state/appState';

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

export function getSystemMetadata(id: SystemId, powertrain: Powertrain = 'petrol'): SystemMetadata {
  const base = SYSTEM_MAP[id];
  const override = POWERTRAIN_OVERRIDES[powertrain]?.[id];
  if (!override) return base;
  return { ...base, ...override };
}
